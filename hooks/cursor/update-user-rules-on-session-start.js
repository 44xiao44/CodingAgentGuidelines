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

// [业务] 从规则仓库下载单个规则文件的原始内容。
// [设计] GitHub raw 是静态文件，直接 GET 取整份内容；文件名由调用方从清单给出，不再从正文解析。
async function fetchRuleContent(fileName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/${fileName}`, {
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

async function updateRules(ruleFiles = RULE_FILES, rulesDir = RULES_DIR) {
  for (const fileName of ruleFiles) {
    try {
      // [业务] 用仓库中的 .md 源名下载，Cursor 端落地时改写扩展名为 .mdc。
      // [设计] 仓库只维护一套 .md，Cursor 识别 .mdc，故仅在写入文件名处做转换，正文不变。
      const body = await fetchRuleContent(fileName);
      const localName = fileName.replace(/\.md$/i, ".mdc");
      const writtenPath = await writeRuleFile(rulesDir, localName, body);
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
  writeRuleFile
};
