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

// [业务] 团队规则文件下载根地址，默认指向本公开仓的 claude 规则目录。
// [设计] 规则文件已随仓库发布且脱敏，默认开箱即用；可用 CLAUDE_RULE_HOOK_BASE_URL 覆盖为内网或私有地址。
//        末尾斜杠统一去除，拼接文件名时不重复。
const BASE_URL = (
  process.env.CLAUDE_RULE_HOOK_BASE_URL ||
  "https://raw.githubusercontent.com/44xiao44/CodingAgentGuidelines/main/rules"
).replace(/\/+$/, "");

// [业务] 由 GitHub raw 根地址推导 jsDelivr CDN 镜像地址，作为 raw 拉取失败时的兜底。
// [设计] 仅当 BASE_URL 是 GitHub raw 时才推导（jsDelivr 只镜像公开 GitHub 仓）；
//        用户若把 BASE_URL 覆盖为内网/后端地址，则返回空串、不启用兜底。
//        raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}
//        → cdn.jsdelivr.net/gh/{owner}/{repo}@{ref}/{path}
function deriveJsdelivrBase(rawBase) {
  const m = /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)$/.exec(rawBase);
  if (!m) {
    return "";
  }
  const [, owner, repo, ref, rest] = m;
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${rest}`.replace(/\/+$/, "");
}

// [字段] FALLBACK_BASE_URL：jsDelivr 兜底根地址；为空表示无兜底（非 GitHub raw 来源）。
const FALLBACK_BASE_URL = deriveJsdelivrBase(BASE_URL);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.CLAUDE_RULE_HOOK_TIMEOUT_MS || "20000", 10);

// [业务] 需要同步为用户级 rules 的规则文件名列表。
// [设计] 通过 CLAUDE_RULE_HOOK_FILES 覆盖（逗号或换行分隔）；默认同步本仓库现有全部规则。
const RULE_FILES = (
  process.env.CLAUDE_RULE_HOOK_FILES ||
  "Android.md,Flutter.md,general.md,iOS.md,Java.md,React.md,ReactNative.md,readme.md,uni-app.md"
)
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

async function writeRuleFile(rulesDir, fileName, body) {
  await fs.mkdir(rulesDir, { recursive: true });
  const targetPath = path.join(rulesDir, fileName);
  await fs.writeFile(targetPath, body, "utf8");
  return targetPath;
}

// [业务] 从单个 URL 下载规则文件的原始内容，独立超时。
// [设计] 每次尝试用各自的 AbortController，避免一次超时影响另一个来源的重试。
async function fetchFrom(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/plain, */*" },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // [设计] raw 文件即规则正文，无需再解析 JSON 或拆分文件名。
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

// [业务] 下载单个规则文件：GitHub raw 优先，失败时用 jsDelivr CDN 镜像兜底。
// [设计] 国内直连 raw.githubusercontent.com 常因 DNS 污染失败，jsDelivr（Fastly）更稳；
//        但 jsDelivr 对分支有 ~12h 缓存，故 raw 优先以拿最新，仅在 raw 失败时兜底。
//        无兜底地址（非 GitHub raw 来源）时直接抛出 raw 的错误。
async function fetchRuleContent(fileName) {
  try {
    return await fetchFrom(`${BASE_URL}/${fileName}`);
  } catch (primaryError) {
    if (!FALLBACK_BASE_URL) {
      throw primaryError;
    }
    console.error(`[sessionStart-rule-hook] ${fileName} raw 拉取失败（${primaryError.message}），改用 jsDelivr 兜底`);
    return await fetchFrom(`${FALLBACK_BASE_URL}/${fileName}`);
  }
}

/**
 * [业务] 遍历规则文件清单，逐个下载并写入本地 .md 规则文件。
 * [设计] 返回已写入文件的元信息列表，供后续更新 CLAUDE.md 导入块和注入 additionalContext。
 *        单个文件失败只记录、不中断，保证其余规则仍能同步。
 *
 * @returns {Promise<Array<{fileName: string, body: string, path: string}>>} 已写入规则文件列表。
 */
async function updateRules(ruleFiles = RULE_FILES, rulesDir = RULES_DIR) {
  // [字段] written：本次成功写入的规则文件元信息。
  const written = [];
  for (const fileName of ruleFiles) {
    try {
      // [业务] 每个规则文件独立下载并落地。
      const body = await fetchRuleContent(fileName);
      const writtenPath = await writeRuleFile(rulesDir, fileName, body);
      written.push({ fileName, body, path: writtenPath });
      console.error(`[sessionStart-rule-hook] 已更新规则：${writtenPath}`);
    } catch (error) {
      console.error(`[sessionStart-rule-hook] 规则 ${fileName} 同步失败：${error.message}`);
    }
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
  // [业务] 未配置下载源或文件清单时跳过同步，保持 hook 无害可用。
  // [设计] 默认指向本公开仓、开箱即用；把 CLAUDE_RULE_HOOK_BASE_URL 或 _FILES 设为空即可关闭同步。
  if (!BASE_URL || RULE_FILES.length === 0) {
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
  writeRuleFile,
  ensureImportBlock
};
