#!/usr/bin/env node

/**
 * [业务] 在 Cursor 会话开始时，每天最多一次同步用户级 rules。
 * [设计] 使用 Node 内置能力实现，失败只写 stderr，避免阻塞 Cursor 会话启动。
 */

const fs = require("node:fs/promises");
const path = require("node:path");

// [业务] 这些路径默认相对用户级 Cursor 配置目录，用于保存同步状态和生成 rules 文件。
// [设计] 允许通过环境变量覆盖，方便本地调试或迁移到不同目录结构。
const DATA_DIR = process.env.CURSOR_RULE_HOOK_DATA_DIR || "hooks/.data";
const RECORD_PATH = process.env.CURSOR_RULE_HOOK_RECORD_PATH || path.join(DATA_DIR, "rules-last-update-date.txt");
const RULES_DIR = process.env.CURSOR_RULE_HOOK_RULES_DIR || "rules";

// [业务] 团队规则文件下载根地址，默认指向本公开仓的规则目录。
// [设计] 规则文件已随仓库发布且脱敏，默认开箱即用；可用 CURSOR_RULE_HOOK_BASE_URL 覆盖为内网或私有地址。
//        末尾斜杠统一去除，拼接文件名时不重复。
const BASE_URL = (
  process.env.CURSOR_RULE_HOOK_BASE_URL ||
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
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.CURSOR_RULE_HOOK_TIMEOUT_MS || "20000", 10);

// [业务] 需要同步为用户级 rules 的规则文件名列表。
// [设计] 仓库只维护一套 .md 源文件；此处列 .md 源名，下载后 Cursor 端落地时改写为 .mdc。
//        通过 CURSOR_RULE_HOOK_FILES 覆盖（逗号或换行分隔），保持与 Claude 端同一份清单。
const RULE_FILES = (
  process.env.CURSOR_RULE_HOOK_FILES ||
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

// [业务] 在 Cursor .mdc 正文末尾追加溯源注释，指回团队通用规则源文件，方便阅读者知道从何而来、去哪修改。
// [设计] 用 HTML 注释形式，不污染 Markdown 渲染，也不影响 Cursor 对 frontmatter 的识别（frontmatter 在开头原样保留）；
//        幂等——正文已含标记则原样返回，避免每天同步反复堆叠注释。
function appendSourceRef(body, fileName) {
  // [字段] marker：溯源注释的固定前缀，兼作幂等判定标记。
  const marker = "<!-- team-rule-source:";
  if (body.includes(marker)) {
    return body;
  }
  // [设计] 去掉尾部空白再拼接，保证注释与正文之间恰好空一行，多次运行结果稳定。
  const trimmed = body.replace(/\s+$/, "");
  return `${trimmed}\n\n${marker} 来源 rules/${fileName}，由 rule-install 会话 hook 自动同步，请勿手动编辑；修改请提交到规则源仓库。 -->\n`;
}

async function updateRules(ruleFiles = RULE_FILES, rulesDir = RULES_DIR) {
  for (const fileName of ruleFiles) {
    try {
      // [业务] 用仓库中的 .md 源名下载，Cursor 端落地时改写扩展名为 .mdc。
      // [设计] 仓库只维护一套 .md，Cursor 识别 .mdc，故仅在写入文件名处做转换；正文仅追加溯源注释，规则内容不变。
      const body = await fetchRuleContent(fileName);
      const localName = fileName.replace(/\.md$/i, ".mdc");
      const withAttribution = appendSourceRef(body, fileName);
      const writtenPath = await writeRuleFile(rulesDir, localName, withAttribution);
      console.error(`[sessionStart-rule-hook] 已更新规则：${writtenPath}`);
    } catch (error) {
      // [设计] 单个文件失败只记录，不影响其余规则同步。
      console.error(`[sessionStart-rule-hook] 规则 ${fileName} 同步失败：${error.message}`);
    }
  }
}

async function main() {
  // [业务] 未配置下载源或文件清单时跳过同步，保持 hook 无害可用。
  // [设计] 默认指向本公开仓、开箱即用；把 CURSOR_RULE_HOOK_BASE_URL 或 _FILES 设为空即可关闭同步。
  if (!BASE_URL || RULE_FILES.length === 0) {
    return;
  }

  const today = getLocalDateText();
  const shouldUpdate = await ensureDailyUpdate(RECORD_PATH, today);
  if (!shouldUpdate) {
    return;
  }

  try {
    await updateRules();
  } catch (error) {
    // [设计] sessionStart hook 失败时只记录错误，避免影响 Cursor 正常启动。
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
  appendSourceRef
};
