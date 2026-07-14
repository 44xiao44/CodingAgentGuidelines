#!/usr/bin/env node

/**
 * [业务] 记录每次工具调用结果，补齐 stop transcript 里可能缺失的工具输出。
 * [设计] 按 conversation_id 增量写入用户级 JSONL；任何异常只记录日志，默认 fail-open，不阻塞 Cursor。
 */

// [业务] 访问用户级 hook 临时目录，创建目录并追加 JSONL 文件。
// [设计] 使用 Node 内置 fs/promises，避免为 hook 引入第三方依赖。
const fs = require("node:fs/promises");

// [业务] 拼接用户级 trace 文件路径。
// [设计] 使用 path.join 兼容不同运行环境的路径分隔符。
const path = require("node:path");

// [业务] 用户级 hook 从 ~/.cursor 目录运行，所有工程共享同一份临时工具调用记录。
// [设计] 允许通过 CURSOR_HOOK_DATA_DIR 覆盖默认目录，便于迁移或单独清理数据。
const DATA_DIR = process.env.CURSOR_HOOK_DATA_DIR || "hooks/.data";

// [业务] 单次工具输出的最大保留字节数，避免大输出撑爆用户级 trace 文件。
// [设计] 默认 256 KiB，可通过 CURSOR_TOOL_OUTPUT_MAX_BYTES 调整；按十进制解析环境变量。
const MAX_TOOL_OUTPUT_BYTES = Number.parseInt(
  process.env.CURSOR_TOOL_OUTPUT_MAX_BYTES || "262144",
  10
);

/**
 * [业务] 读取 Cursor hook 通过 stdin 传入的事件 JSON 原文。
 * [设计] stdin 是异步流，逐块累加为字符串，交给调用方决定如何解析。
 *
 * @returns {Promise<string>} Cursor hook 输入的原始 JSON 字符串；没有输入时返回空字符串。
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
 * [业务] 安全解析 Cursor hook 输入或 JSONL 中的单行记录。
 * [设计] 解析失败返回 null 而不是抛出异常，避免坏输入阻断 Cursor 主流程。
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
 * [业务] 将 conversation_id 转成可安全落盘的文件名片段。
 * [设计] 只保留字母、数字、点、下划线、短横线，其他字符统一替换成下划线。
 *
 * @param {string} text 原始 conversation_id 或其他标识。
 * @returns {string} 可用于文件名的安全字符串；空值返回 unknown。
 */
function sanitizeForFileName(text) {
  // [业务] conversation_id 会进入文件名，必须避免路径分隔符或特殊字符影响落盘。
  // [设计] 保留常见安全字符，其他字符统一替换成下划线。
  // [字段] safe：替换危险字符后的文件名片段。
  const safe = String(text || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (safe) {
    return safe;
  }
  return "unknown";
}

/**
 * [业务] 将任意工具输出转换成带大小信息的字符串。
 * [设计] 使用 UTF-8 字节数判断是否超限；超限时截断正文，并保留原始字节数。
 *
 * @param {*} value Cursor 工具输出，可能是字符串、对象、数组或空值。
 * @param {number} maxBytes 最大保留字节数。
 * @returns {{text: string, bytes: number, truncated: boolean}} 带正文、原始大小和截断状态的对象。
 */
function toSizedString(value, maxBytes) {
  // [业务] 工具输出可能很大，只保留足够排查问题的一段内容，避免 hook 数据无限膨胀。
  // [设计] 按 UTF-8 字节数截断，并在 meta 中记录原始大小和是否截断。
  // [字段] asString：统一后的字符串形式，便于后续计算字节数和写入 JSONL。
  const asString = typeof value === "string" ? value : JSON.stringify(value);

  // [字段] byteLength：工具输出原始 UTF-8 字节数，服务端可据此判断是否发生数据缩减。
  const byteLength = Buffer.byteLength(asString, "utf8");
  if (byteLength <= maxBytes) {
    return {
      // [字段] text：未截断的工具输出正文。
      text: asString,
      // [字段] bytes：工具输出原始 UTF-8 字节数。
      bytes: byteLength,
      // [字段] truncated：false 表示正文完整保留。
      truncated: false
    };
  }

  // [字段] sliced：按最大字节数截断后的工具输出正文。
  const sliced = Buffer.from(asString, "utf8").subarray(0, maxBytes).toString("utf8");
  return {
    // [字段] text：截断后的工具输出正文。
    text: sliced,
    // [字段] bytes：截断前的原始 UTF-8 字节数。
    bytes: byteLength,
    // [字段] truncated：true 表示正文只保留了前 maxBytes 字节。
    truncated: true
  };
}

/**
 * [业务] postToolUse hook 主流程：读取事件、抽取工具调用信息，并追加到会话级 JSONL trace。
 * [设计] 使用 guard clause 处理无效输入；写入失败只记录日志，保持 fail-open。
 *
 * @returns {Promise<void>} 无返回值；所有结果通过文件落盘或 stderr 日志体现。
 */
async function main() {
  // [字段] stdinRaw：Cursor 传入的 postToolUse 事件原始 JSON。
  const stdinRaw = await readStdin();

  // [字段] hookInput：解析后的 hook 事件对象，包含工具名、工具输入、工具输出等信息。
  const hookInput = safeJsonParse(stdinRaw);
  if (!hookInput) {
    console.error("[postToolUse-hook] 无法解析 stdin JSON。");
    return;
  }

  // [字段] conversationId：当前会话 ID，用于把同一会话的多次工具调用聚合到同一个 JSONL 文件。
  const conversationId = hookInput.conversation_id || "";
  if (!conversationId) {
    console.error("[postToolUse-hook] 缺少 conversation_id，跳过记录。");
    return;
  }

  // [字段] outputInfo：标准化后的工具输出，包含正文、原始字节数和截断状态。
  const outputInfo = toSizedString(hookInput.tool_output ?? "", MAX_TOOL_OUTPUT_BYTES);

  // [字段] record：写入 JSONL 的单条工具调用记录；每次工具调用追加一行。
  const record = {
    // [字段] recordedAt：本地记录时间，用于排查 hook 写入顺序和延迟。
    recordedAt: new Date().toISOString(),
    // [字段] conversationId：会话 ID，stop hook 用它回读同一会话的 trace 文件。
    conversationId,
    // [字段] generationId：Cursor 本轮生成 ID，用于关联一次 agent 响应中的工具调用。
    generationId: hookInput.generation_id || null,
    // [字段] toolUseId：单次工具调用 ID，用于定位具体工具调用。
    toolUseId: hookInput.tool_use_id || null,
    // [字段] toolName：工具名称，例如 Shell、ReadFile、ApplyPatch 等。
    toolName: hookInput.tool_name || null,
    // [字段] cwd：工具执行时的工作目录，便于解释相对路径和命令上下文。
    cwd: hookInput.cwd || null,
    // [字段] toolInput：工具调用入参，服务端可用于还原 agent 做了什么。
    toolInput: hookInput.tool_input ?? null,
    // [字段] toolOutput：工具调用输出正文，可能已按 MAX_TOOL_OUTPUT_BYTES 截断。
    toolOutput: outputInfo.text,
    // [字段] toolOutputMeta：工具输出的体积和截断状态，避免服务端误判正文完整性。
    toolOutputMeta: {
      // [字段] bytes：工具输出截断前的原始 UTF-8 字节数。
      bytes: outputInfo.bytes,
      // [字段] truncated：是否因超过上限而截断。
      truncated: outputInfo.truncated,
      // [字段] maxBytes：本脚本本次运行使用的最大保留字节数。
      maxBytes: MAX_TOOL_OUTPUT_BYTES
    }
  };

  try {
    // [业务] stop hook 会按 conversation_id 回读这些 JSONL 记录，补齐 transcript 中缺失的工具结果。
    // [设计] 每次 postToolUse 只追加一行 JSON，避免频繁读写完整文件。
    await fs.mkdir(DATA_DIR, { recursive: true });

    // [字段] fileName：当前会话的 JSONL 文件名。
    const fileName = `tool-trace-${sanitizeForFileName(conversationId)}.jsonl`;

    // [字段] targetPath：当前会话 JSONL 文件的完整路径。
    const targetPath = path.join(DATA_DIR, fileName);
    await fs.appendFile(targetPath, `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    console.error(`[postToolUse-hook] 写入失败: ${String(error)}`);
  }
}

// [业务] 启动 hook 主流程。
// [设计] 捕获所有未处理异常并写入 stderr，避免非零退出干扰 Cursor 主流程。
main().catch((error) => {
  console.error(`[postToolUse-hook] 未处理异常: ${String(error)}`);
});
