#!/usr/bin/env node

/**
 * [业务] 在 Claude Code 会话开始（SessionStart）时，每天最多一次同步团队规则到用户级目录。
 * [设计] 与 Cursor 版差异：Claude hook 的 cwd 是项目目录而非 ~/.claude，因此所有目录都必须用
 *        os.homedir() 锚定为绝对路径，否则规则会散落到各个项目里。规则写成 .md 并通过
 *        CLAUDE.md 的 @import 块被加载；更新当天额外通过 stdout 的 additionalContext 注入，
 *        让规则在当前会话即生效。所有失败只写 stderr，默认 fail-open，不阻塞会话启动。
 */

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

// [业务] Claude 用户级配置根目录，所有生成物都锚定在这里。
// [设计] cwd 不可靠（是项目目录），必须用 homedir 计算绝对路径。
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

// [业务] hook 运行状态与临时数据目录，用于保存"今天是否已同步"的幂等记录。
const DATA_DIR = process.env.CLAUDE_RULE_HOOK_DATA_DIR || path.join(CLAUDE_DIR, "hooks", ".data");
const RECORD_PATH =
  process.env.CLAUDE_RULE_HOOK_RECORD_PATH || path.join(DATA_DIR, "rules-last-update-date.txt");

// [业务] 团队规则专用子目录，与用户个人 rules 隔离，绝不覆盖用户已有规则文件。
const RULES_DIR = process.env.CLAUDE_RULE_HOOK_RULES_DIR || path.join(CLAUDE_DIR, "rules", "team-sync");

// [业务] CLAUDE.md 是 Claude 加载用户级记忆的入口，通过 @import 引用团队规则文件。
const CLAUDE_MD_PATH = process.env.CLAUDE_RULE_HOOK_MEMORY_PATH || path.join(CLAUDE_DIR, "CLAUDE.md");

// [业务] CLAUDE.md 中团队规则导入块的起止标记，用于幂等更新，绝不触碰标记外的用户内容。
const BLOCK_BEGIN = "<!-- TEAM-RULES:BEGIN (auto-managed by rule-install hook, do not edit) -->";
const BLOCK_END = "<!-- TEAM-RULES:END -->";

// [业务] 文档内容代理接口地址：把指定 wiki 文档转换为 rule 文件内容。
// [设计] 不内置任何团队私有地址，通过环境变量 CLAUDE_RULE_HOOK_REQUEST_URL 注入；
//        未配置时为空，main 会直接跳过同步。doc 地址放在请求体里，网关地址保持固定，
//        避免每个文档重复拼接完整请求 URL。
const REQUEST_URL = process.env.CLAUDE_RULE_HOOK_REQUEST_URL || "";
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.CLAUDE_RULE_HOOK_TIMEOUT_MS || "20000", 10);

// [业务] 需要同步为用户级 rules 的团队文档地址列表。
// [设计] 通过 CLAUDE_RULE_HOOK_DOC_URLS 注入，多个地址用逗号或换行分隔；未配置时为空、跳过同步。
const DOC_URLS = (process.env.CLAUDE_RULE_HOOK_DOC_URLS || "")
  .split(/[\n,]/)
  .map((item) => item.trim())
  .filter(Boolean);

function getLocalDateText(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function ensureDailyUpdate(recordPath, today) {
  try {
    const recordedDate = (await fs.readFile(recordPath, "utf8")).trim();
    if (recordedDate === today) {
      // [业务] 当天已经同步过，直接跳过，避免每次会话启动都请求文档接口。
      return false;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      // [业务] 记录点损坏或不可读时仍尝试同步，保证 rules 尽量能更新到最新。
      console.error(`[sessionStart-rule-hook] 读取记录点失败，将尝试继续更新：${error.message}`);
    }
  }

  // [设计] 先写入当天记录，避免接口持续失败时同一天反复触发网络请求。
  await fs.mkdir(path.dirname(recordPath), { recursive: true });
  await fs.writeFile(recordPath, today, "utf8");
  return true;
}

function splitRuleContent(content) {
  // [业务] 文档第一段约定为规则文件名，空行后才是实际 rule 正文。
  const separatorIndex = content.indexOf("\n\n");
  if (separatorIndex < 0) {
    throw new Error("规则内容缺少文件名和正文分隔空行。");
  }

  const rawName = content.slice(0, separatorIndex).trim();
  if (!rawName) {
    throw new Error("规则内容缺少文件名。");
  }

  // [设计] 文件名来自远端文档，需要替换操作系统不允许的路径字符。
  // [设计] Claude 记忆文件用 .md 扩展名（Cursor 用 .mdc）。
  const safeName = rawName.replace(/[\\/:*?"<>|]/g, "_");
  return {
    fileName: `${safeName}.md`,
    body: content.slice(separatorIndex + 2)
  };
}

async function writeRuleFile(rulesDir, ruleFile) {
  await fs.mkdir(rulesDir, { recursive: true });
  const targetPath = path.join(rulesDir, ruleFile.fileName);
  await fs.writeFile(targetPath, ruleFile.body, "utf8");
  return targetPath;
}

async function fetchRuleContent(docUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // [业务] 向文档代理接口请求指定 wiki 的 Markdown/rule 内容。
    const response = await fetch(REQUEST_URL, {
      method: "POST",
      headers: {
        "User-Agent": "yaak",
        Accept: "*/*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ doc: docUrl }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    // [设计] 快速校验接口契约，避免把异常响应写入本地 rules 文件。
    if (!payload || payload.success !== true || !payload.data || typeof payload.data.content !== "string") {
      throw new Error("接口返回内容不符合预期。");
    }

    return payload.data.content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * [业务] 遍历所有团队文档，逐个生成 .md 规则文件。
 * [设计] 返回已写入文件的元信息列表，供后续更新 CLAUDE.md 导入块和注入 additionalContext。
 *
 * @returns {Promise<Array<{fileName: string, body: string, path: string}>>} 已写入规则文件列表。
 */
async function updateRules(docUrls = DOC_URLS, rulesDir = RULES_DIR) {
  // [字段] written：本次成功写入的规则文件元信息。
  const written = [];
  for (const docUrl of docUrls) {
    // [业务] 每个文档独立生成一个 .md 规则文件。
    const content = await fetchRuleContent(docUrl);
    const ruleFile = splitRuleContent(content);
    const writtenPath = await writeRuleFile(rulesDir, ruleFile);
    written.push({ fileName: ruleFile.fileName, body: ruleFile.body, path: writtenPath });
    console.error(`[sessionStart-rule-hook] 已更新规则：${writtenPath}`);
  }
  return written;
}

/**
 * [业务] 在 CLAUDE.md 中维护团队规则的 @import 块，让规则在后续会话被自动加载。
 * [设计] 用 BEGIN/END 标记做幂等替换：已存在标记则只替换标记之间内容，否则追加到文件末尾；
 *        绝不改动标记之外的任何用户内容。@import 路径相对 CLAUDE.md 所在的 ~/.claude 目录。
 *
 * @param {string} claudeMdPath CLAUDE.md 绝对路径。
 * @param {string} rulesDir 团队规则目录绝对路径。
 * @param {Array<{fileName: string}>} written 已写入的规则文件列表。
 * @returns {Promise<void>} 无返回值。
 */
async function ensureImportBlock(claudeMdPath, rulesDir, written) {
  if (written.length === 0) {
    return;
  }

  // [业务] @import 路径需相对 CLAUDE.md 所在目录，用 posix 分隔符保证跨平台一致。
  const claudeDir = path.dirname(claudeMdPath);
  const importLines = written.map((item) => {
    const rel = path.relative(claudeDir, path.join(rulesDir, item.fileName));
    return `@${rel.split(path.sep).join("/")}`;
  });

  // [字段] block：完整的团队规则导入块，含起止标记。
  const block = `${BLOCK_BEGIN}\n${importLines.join("\n")}\n${BLOCK_END}`;

  // [字段] existing：CLAUDE.md 现有内容；文件不存在时视为空。
  let existing = "";
  try {
    existing = await fs.readFile(claudeMdPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  // [字段] next：写回 CLAUDE.md 的新内容。
  let next;
  const beginIndex = existing.indexOf(BLOCK_BEGIN);
  const endIndex = existing.indexOf(BLOCK_END);
  if (beginIndex >= 0 && endIndex > beginIndex) {
    // [业务] 已有导入块，只替换标记之间内容，保留用户其余记忆内容。
    const before = existing.slice(0, beginIndex);
    const after = existing.slice(endIndex + BLOCK_END.length);
    next = `${before}${block}${after}`;
  } else {
    // [业务] 首次写入，把导入块追加到文件末尾，与已有内容用空行隔开。
    const prefix = existing.length > 0 && !existing.endsWith("\n") ? `${existing}\n\n` : existing ? `${existing}\n` : "";
    next = `${prefix}${block}\n`;
  }

  await fs.mkdir(claudeDir, { recursive: true });
  await fs.writeFile(claudeMdPath, next, "utf8");
  console.error(`[sessionStart-rule-hook] 已更新 CLAUDE.md 导入块：${claudeMdPath}`);
}

/**
 * [业务] 把本次更新的规则内容通过 stdout 的 additionalContext 注入当前会话。
 * [设计] Claude 在 SessionStart 之前已经读过 CLAUDE.md，导入块要到下次会话才生效；
 *        为了让规则当天立即可用，这里把正文拼接后作为 additionalContext 输出。
 *        只在真正更新的那次运行输出，daily 幂等保证一天最多一次，避免重复注入。
 *
 * @param {Array<{fileName: string, body: string}>} written 已写入的规则文件列表。
 * @returns {void} 通过 process.stdout 输出，无返回值。
 */
function injectAdditionalContext(written) {
  if (written.length === 0) {
    return;
  }

  // [字段] sections：每个规则文件转成一段带来源标题的正文。
  const sections = written.map((item) => `## 团队规则：${item.fileName}\n\n${item.body}`);

  // [字段] additionalContext：注入当前会话上下文开头的团队规则全文。
  const additionalContext = `以下是团队统一编码规则（由 rule-install hook 同步）：\n\n${sections.join("\n\n---\n\n")}`;

  // [设计] SessionStart hook 通过 stdout 输出该结构即可把内容注入当前会话首个 prompt 之前。
  const output = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext
    }
  };
  process.stdout.write(JSON.stringify(output));
}

async function main() {
  // [业务] 未配置团队文档来源时，规则同步整体跳过，保持 hook 无害可用。
  // [设计] 公开仓不内置任何私有地址；团队通过 CLAUDE_RULE_HOOK_REQUEST_URL / _DOC_URLS 注入后才启用。
  if (!REQUEST_URL || DOC_URLS.length === 0) {
    return;
  }

  const today = getLocalDateText();
  const shouldUpdate = await ensureDailyUpdate(RECORD_PATH, today);
  if (!shouldUpdate) {
    // [业务] 当天已同步，规则已在上次会话写入 CLAUDE.md 导入块，本次无需再注入。
    return;
  }

  try {
    const written = await updateRules();
    await ensureImportBlock(CLAUDE_MD_PATH, RULES_DIR, written);
    injectAdditionalContext(written);
  } catch (error) {
    // [设计] SessionStart hook 失败时只记录错误，避免影响 Claude 正常启动。
    console.error(`[sessionStart-rule-hook] 更新用户级 rules 失败：${error.message}`);
  }
}

if (require.main === module) {
  // [设计] 支持命令行直接运行，同时保留函数导出给测试或调试脚本复用。
  main().catch((error) => {
    console.error(`[sessionStart-rule-hook] 执行失败：${error.message}`);
  });
}

module.exports = {
  ensureDailyUpdate,
  getLocalDateText,
  splitRuleContent,
  writeRuleFile,
  ensureImportBlock
};
