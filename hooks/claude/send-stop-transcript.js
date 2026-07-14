#!/usr/bin/env node

/**
 * [业务] 在 Claude Code `Stop` 事件触发时，把会话内容上报到外部接口。
 * [设计] 与 Cursor 版差异：会话 ID 字段是 session_id（非 conversation_id）；数据目录用
 *        os.homedir() 锚定（Claude hook 的 cwd 是项目目录）。使用 Node 内置能力（无三方依赖）；
 *        所有失败只写 stderr，默认 fail-open，不阻塞 Claude。
 */

// [业务] 读取 transcript 和用户级工具 trace 文件。
// [设计] 使用 fs/promises 简化异步文件读取和删除逻辑。
const fs = require("node:fs/promises");

// [业务] 计算用户主目录，锚定用户级数据目录绝对路径。
const os = require("node:os");

// [业务] 拼接用户级 trace 文件路径。
// [设计] 使用 path.join，避免手写路径分隔符导致跨环境问题。
const path = require("node:path");

// [字段] DEFAULT_ENDPOINT：默认上报地址。公开仓不内置任何团队后端地址，默认为空即不上报。
// [设计] 团队部署时通过环境变量 CLAUDE_STOP_WEBHOOK_URL 注入真实上报地址后才启用上报。
const DEFAULT_ENDPOINT = "";

// [字段] ENDPOINT：实际上报地址，优先使用环境变量 CLAUDE_STOP_WEBHOOK_URL。
const ENDPOINT = process.env.CLAUDE_STOP_WEBHOOK_URL || DEFAULT_ENDPOINT;

// [字段] TOKEN：可选 Bearer Token；配置后会写入 Authorization 请求头。
const TOKEN = process.env.CLAUDE_STOP_WEBHOOK_TOKEN || "";

// [字段] TIMEOUT_MS：HTTP 上报超时时间，避免 stop hook 长时间挂起。
const TIMEOUT_MS = Number.parseInt(process.env.CLAUDE_STOP_WEBHOOK_TIMEOUT_MS || "15000", 10);

// [字段] MAX_TRANSCRIPT_BYTES：会话 transcript 最大读取字节数，默认 2 MiB。
const MAX_TRANSCRIPT_BYTES = Number.parseInt(
  process.env.CLAUDE_STOP_MAX_TRANSCRIPT_BYTES || "2097152",
  10
);

// [业务] Claude 用户级配置根目录。
// [设计] Claude hook 的 cwd 是项目目录，必须用 homedir 锚定，才能读到 capture hook 写的 trace。
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

// [业务] 这里要和 capture-post-tool-use.js 使用同一个目录，才能在 stop 阶段读到工具调用记录。
const DATA_DIR = process.env.CLAUDE_HOOK_DATA_DIR || path.join(CLAUDE_DIR, "hooks", ".data");

// [字段] MAX_TOOL_TRACE_BYTES：工具 trace 最大读取字节数，默认 3 MiB。
const MAX_TOOL_TRACE_BYTES = Number.parseInt(
  process.env.CLAUDE_STOP_MAX_TOOL_TRACE_BYTES || "3145728",
  10
);

/**
 * [业务] 读取 Claude hook 通过 stdin 传入的 stop 事件 JSON 原文。
 * [设计] stdin 是异步流，逐块累加为字符串，后续统一解析。
 *
 * @returns {Promise<string>} Claude hook 输入的原始 JSON 字符串；没有输入时返回空字符串。
 */
async function readStdin() {
  // [字段] raw：累计 stdin 中所有 chunk 的原始文本。
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
  }
  return raw;
}

/**
 * [业务] 安全解析 Claude hook 输入或 JSONL 中的单行工具 trace。
 * [设计] 解析失败返回 null，避免坏输入阻断 stop hook 的整体上报流程。
 *
 * @param {string} text 需要解析的 JSON 字符串。
 * @returns {object|null} 解析成功时返回对象；解析失败时返回 null。
 */
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

/**
 * [业务] 将 session_id 转成可安全落盘和回读的文件名片段。
 * [设计] 只保留字母、数字、点、下划线、短横线，其他字符统一替换成下划线。
 *
 * @param {string} text 原始 session_id 或其他标识。
 * @returns {string} 可用于文件名的安全字符串；空值返回 unknown。
 */
function sanitizeForFileName(text) {
  // [业务] session_id 会作为工具 trace 文件名的一部分，需要先转换成安全文件名。
  // [设计] 使用白名单字符集，其他字符统一替换为下划线。
  // [字段] safe：替换危险字符后的文件名片段。
  const safe = String(text || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (safe) {
    return safe;
  }
  return "unknown";
}

/**
 * [业务] 读取 Claude stop 事件提供的 transcript 文件。
 * [设计] 按字节上限读取，返回正文和读取状态；读取失败不抛出，交给 payload meta 表达。
 *
 * @param {string|undefined} transcriptPath Claude 传入的 transcript 文件路径（JSONL）。
 * @returns {Promise<object>} transcript 正文、读取状态、原始大小、截断状态和错误信息。
 */
async function readTranscript(transcriptPath) {
  // [业务] stop 事件会提供 Claude 会话 transcript 路径（JSONL），作为上报的主内容。
  // [设计] transcript 可能很大，按字节上限读取并把截断状态放进 meta。
  if (!transcriptPath) {
    return {
      // [字段] transcript：缺少路径时没有 transcript 正文。
      transcript: null,
      // [字段] transcriptState：missing_path 表示未提供 transcript_path。
      transcriptState: "missing_path",
      // [字段] transcriptBytes：未读取文件时原始字节数记为 0。
      transcriptBytes: 0,
      // [字段] truncated：未读取文件时不会发生截断。
      truncated: false
    };
  }

  try {
    // [字段] fileBuffer：transcript 文件的完整二进制内容。
    const fileBuffer = await fs.readFile(transcriptPath);

    // [字段] transcriptBytes：transcript 文件原始字节数。
    const transcriptBytes = fileBuffer.byteLength;

    // [字段] shouldTruncate：是否超过 MAX_TRANSCRIPT_BYTES，需要截断正文。
    const shouldTruncate = transcriptBytes > MAX_TRANSCRIPT_BYTES;

    // [字段] slicedBuffer：最终上报的 transcript 二进制片段。
    const slicedBuffer = shouldTruncate ? fileBuffer.subarray(0, MAX_TRANSCRIPT_BYTES) : fileBuffer;

    return {
      // [字段] transcript：上报的 transcript 正文，可能被截断。
      transcript: slicedBuffer.toString("utf8"),
      // [字段] transcriptState：ok 表示读取成功。
      transcriptState: "ok",
      // [字段] transcriptBytes：截断前的原始字节数。
      transcriptBytes,
      // [字段] truncated：是否因超过上限而截断。
      truncated: shouldTruncate
    };
  } catch (error) {
    return {
      // [字段] transcript：读取失败时没有 transcript 正文。
      transcript: null,
      // [字段] transcriptState：read_failed 表示路径存在但读取失败或权限不足。
      transcriptState: "read_failed",
      // [字段] transcriptBytes：读取失败时无法确认原始大小，记为 0。
      transcriptBytes: 0,
      // [字段] truncated：读取失败时不会发生正文截断。
      truncated: false,
      // [字段] transcriptError：读取失败的错误文本，便于排查权限或路径问题。
      transcriptError: String(error)
    };
  }
}

/**
 * [业务] 读取当前会话由 PostToolUse hook 累积的工具 trace JSONL。
 * [设计] 每行独立解析，坏行会被过滤；文件不存在视为无工具 trace，不视为异常。
 *
 * @param {string|undefined} sessionId Claude 会话 ID。
 * @returns {Promise<object>} 工具事件列表、读取状态、原始大小、截断状态、路径和错误信息。
 */
async function readToolTrace(sessionId) {
  // [业务] tool trace 来自 PostToolUse hook，用于补齐 transcript 里可能缺失的工具输出。
  // [设计] 一行一个 JSON 事件；解析失败的行会被忽略，避免单条坏数据影响整次上报。
  if (!sessionId) {
    return {
      // [字段] events：没有会话 ID 时无法定位 trace 文件，返回空列表。
      events: [],
      // [字段] state：missing_session_id 表示 stop 输入缺少 session_id。
      state: "missing_session_id",
      // [字段] bytes：没有读取文件时原始字节数为 0。
      bytes: 0,
      // [字段] truncated：没有读取文件时不会发生截断。
      truncated: false,
      // [字段] path：没有会话 ID 时无法计算 trace 文件路径。
      path: null,
      // [字段] lineCount：没有读取文件时有效行数为 0。
      lineCount: 0
    };
  }

  // [字段] fileName：当前会话工具 trace 的 JSONL 文件名。
  const fileName = `tool-trace-${sanitizeForFileName(sessionId)}.jsonl`;

  // [字段] tracePath：当前会话工具 trace 的完整路径。
  const tracePath = path.join(DATA_DIR, fileName);

  try {
    // [字段] fileBuffer：工具 trace 文件的完整二进制内容。
    const fileBuffer = await fs.readFile(tracePath);

    // [字段] fileBytes：工具 trace 文件截断前的原始字节数。
    const fileBytes = fileBuffer.byteLength;

    // [字段] shouldTruncate：是否超过 MAX_TOOL_TRACE_BYTES，需要截断 trace 正文。
    const shouldTruncate = fileBytes > MAX_TOOL_TRACE_BYTES;

    // [字段] slicedBuffer：最终参与解析的 trace 二进制片段。
    const slicedBuffer = shouldTruncate ? fileBuffer.subarray(0, MAX_TOOL_TRACE_BYTES) : fileBuffer;

    // [字段] text：工具 trace 的 UTF-8 文本内容。
    const text = slicedBuffer.toString("utf8");

    // [字段] lines：去掉空行后的 JSONL 行列表。
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    // [字段] events：成功解析出的工具事件对象列表。
    const events = lines
      .map((line) => safeJsonParse(line))
      .filter((item) => item && typeof item === "object");

    return {
      // [字段] events：可上报的工具事件对象列表。
      events,
      // [字段] state：ok 表示 trace 文件读取并解析成功。
      state: "ok",
      // [字段] bytes：trace 文件截断前的原始字节数。
      bytes: fileBytes,
      // [字段] truncated：是否因超过上限而截断。
      truncated: shouldTruncate,
      // [字段] path：trace 文件路径，上报后用于清理。
      path: tracePath,
      // [字段] lineCount：参与解析的非空 JSONL 行数。
      lineCount: lines.length
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        // [字段] events：trace 文件不存在时没有工具事件。
        events: [],
        // [字段] state：not_found 表示本会话尚无 PostToolUse trace 文件。
        state: "not_found",
        // [字段] bytes：文件不存在时原始字节数为 0。
        bytes: 0,
        // [字段] truncated：文件不存在时不会发生截断。
        truncated: false,
        // [字段] path：预期的 trace 文件路径，便于排查。
        path: tracePath,
        // [字段] lineCount：文件不存在时有效行数为 0。
        lineCount: 0
      };
    }
    return {
      // [字段] events：读取失败时不返回任何工具事件。
      events: [],
      // [字段] state：read_failed 表示 trace 文件读取失败或权限不足。
      state: "read_failed",
      // [字段] bytes：读取失败时无法确认原始大小，记为 0。
      bytes: 0,
      // [字段] truncated：读取失败时不会发生正文截断。
      truncated: false,
      // [字段] path：读取失败的 trace 文件路径。
      path: tracePath,
      // [字段] lineCount：读取失败时有效行数为 0。
      lineCount: 0,
      // [字段] error：读取失败的错误文本。
      error: String(error)
    };
  }
}

/**
 * [业务] 上报成功后清理当前会话的临时工具 trace 文件。
 * [设计] 文件不存在视为已清理；其他删除失败只记录日志，不改变 hook 退出状态。
 *
 * @param {string|null} tracePath 需要删除的 trace 文件路径。
 * @returns {Promise<void>} 无返回值。
 */
async function cleanupToolTrace(tracePath) {
  // [业务] 上报成功后清理当前会话的临时工具记录，避免用户级目录长期积累。
  // [设计] 清理失败只记录日志，不影响 Claude 正常结束。
  if (!tracePath) {
    return;
  }
  try {
    await fs.unlink(tracePath);
  } catch (error) {
    if (!(error && error.code === "ENOENT")) {
      console.error(`[stop-hook] 清理 tool trace 失败: ${String(error)}`);
    }
  }
}

/**
 * [业务] 将会话归档 payload 上报到团队或自定义服务端。
 * [设计] 用 fetch + AbortController 控制超时；HTTP 非 2xx 会抛错交由 main 统一记录。
 *
 * @param {object} payload 需要上报的会话归档数据。
 * @returns {Promise<void>} 上报成功时正常返回；失败时抛出异常。
 */
async function postPayload(payload) {
  // [业务] 将会话 transcript 和工具 trace 汇总后发送到团队/自定义服务端。
  // [设计] 使用 AbortController 做超时控制；失败由 main 捕获，保持 fail-open。
  if (!ENDPOINT) {
    console.error("[stop-hook] CLAUDE_STOP_WEBHOOK_URL 未配置，跳过上报。");
    return;
  }

  // [字段] controller：用于在 TIMEOUT_MS 到达后取消 HTTP 请求。
  const controller = new AbortController();

  // [字段] timeout：超时计时器句柄，请求结束后必须清理。
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // [字段] headers：HTTP 请求头，默认声明 JSON；可选追加 Bearer Token。
    const headers = {
      // [字段] content-type：告诉服务端请求体是 JSON。
      "content-type": "application/json"
    };
    if (TOKEN) {
      // [字段] authorization：可选鉴权头，值来自 CLAUDE_STOP_WEBHOOK_TOKEN。
      headers.authorization = `Bearer ${TOKEN}`;
    }

    // [字段] response：服务端上报接口的 HTTP 响应。
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${response.statusText} ${text}`.trim());
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * [业务] stop hook 主流程：读取 stop 输入、读取 transcript、读取工具 trace、组装 payload 并上报。
 * [设计] 上报失败只写日志；只有上报成功才清理 trace，便于失败后保留数据排查。
 *
 * @returns {Promise<void>} 无返回值；结果通过 HTTP 上报或 stderr 日志体现。
 */
async function main() {
  // [字段] stdinRaw：Claude 传入的 stop 事件原始 JSON。
  const stdinRaw = await readStdin();

  // [字段] hookInput：解析后的 stop 事件对象，包含会话 ID、transcript 路径等元信息。
  const hookInput = safeJsonParse(stdinRaw);

  if (!hookInput) {
    console.error("[stop-hook] 无法解析 stdin JSON。");
    return;
  }

  // [字段] transcriptInfo：transcript 正文和读取状态信息。
  const transcriptInfo = await readTranscript(hookInput.transcript_path);

  // [字段] toolTraceInfo：工具调用 trace 事件和读取状态信息。
  // [设计] Claude 用 session_id 定位 capture hook 写入的 trace 文件。
  const toolTraceInfo = await readToolTrace(hookInput.session_id);

  // [业务] payload 保留 Claude 会话元信息、transcript 正文和工具调用明细，便于服务端统一归档。
  // [设计] 内容和状态分开存放：正文放 transcript/toolTrace，读取状态与截断信息放 meta。
  // [字段] payload：最终发送给服务端的会话归档数据。
  const payload = {
    // [字段] event：事件类型，固定标识这是一条 Claude stop 上报。
    event: "claude_stop",
    // [字段] sentAt：hook 发送 payload 的时间，使用 ISO 字符串便于服务端排序。
    sentAt: new Date().toISOString(),
    // [字段] claude：Claude 会话相关元信息。
    claude: {
      // [字段] sessionId：Claude 会话 ID，用于服务端聚合同一会话数据。
      sessionId: hookInput.session_id || null,
      // [字段] hookEventName：触发脚本的 hook 事件名，默认 Stop。
      hookEventName: hookInput.hook_event_name || "Stop",
      // [字段] permissionMode：当前会话权限模式，便于分析授权上下文。
      permissionMode: hookInput.permission_mode || null,
      // [字段] cwd：会话工作目录，便于关联项目。
      cwd: hookInput.cwd || null,
      // [字段] stopHookActive：是否处于 stop hook 续跑循环，用于分析自动续跑。
      stopHookActive: hookInput.stop_hook_active ?? null,
      // [字段] transcriptPath：Claude transcript 文件路径，便于服务端或日志回溯。
      transcriptPath: hookInput.transcript_path || null
    },
    // [字段] transcript：读取到的会话 transcript 正文，可能为 null 或被截断。
    transcript: transcriptInfo.transcript,
    // [字段] transcriptMeta：transcript 读取状态和体积信息。
    transcriptMeta: {
      // [字段] state：transcript 读取状态，例如 ok、missing_path、read_failed。
      state: transcriptInfo.transcriptState,
      // [字段] bytes：transcript 截断前的原始字节数。
      bytes: transcriptInfo.transcriptBytes,
      // [字段] truncated：transcript 是否因超过 MAX_TRANSCRIPT_BYTES 被截断。
      truncated: transcriptInfo.truncated,
      // [字段] maxBytes：本次读取 transcript 使用的最大字节数。
      maxBytes: MAX_TRANSCRIPT_BYTES,
      // [字段] error：transcript 读取失败时的错误信息；成功时为 null。
      error: transcriptInfo.transcriptError || null
    },
    // [字段] toolTrace：PostToolUse hook 累积的工具调用事件列表。
    toolTrace: toolTraceInfo.events,
    // [字段] toolTraceMeta：工具 trace 读取状态和体积信息。
    toolTraceMeta: {
      // [字段] state：工具 trace 读取状态，例如 ok、not_found、read_failed。
      state: toolTraceInfo.state,
      // [字段] bytes：工具 trace 截断前的原始字节数。
      bytes: toolTraceInfo.bytes,
      // [字段] truncated：工具 trace 是否因超过 MAX_TOOL_TRACE_BYTES 被截断。
      truncated: toolTraceInfo.truncated,
      // [字段] maxBytes：本次读取工具 trace 使用的最大字节数。
      maxBytes: MAX_TOOL_TRACE_BYTES,
      // [字段] lineCount：参与解析的 JSONL 非空行数。
      lineCount: toolTraceInfo.lineCount,
      // [字段] path：工具 trace 文件路径；上报成功后会尝试删除。
      path: toolTraceInfo.path,
      // [字段] error：工具 trace 读取失败时的错误信息；成功或不存在时为 null。
      error: toolTraceInfo.error || null
    }
  };

  try {
    await postPayload(payload);
    await cleanupToolTrace(toolTraceInfo.path);
  } catch (error) {
    console.error(`[stop-hook] 上报失败: ${String(error)}`);
  }
}

// [业务] 启动 stop hook 主流程。
// [设计] 捕获所有未处理异常并写入 stderr，避免非零退出干扰 Claude 主流程。
main().catch((error) => {
  console.error(`[stop-hook] 未处理异常: ${String(error)}`);
});
