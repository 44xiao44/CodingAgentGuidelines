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

// [业务] 文档内容代理接口地址：把指定 wiki 文档转换为 rule 文件内容。
// [设计] 不内置任何团队私有地址，通过环境变量 CURSOR_RULE_HOOK_REQUEST_URL 注入；
//        未配置时为空，main 会直接跳过同步。doc 地址放在请求体里，网关地址保持固定，
//        避免每个文档重复拼接完整请求 URL。
const REQUEST_URL = process.env.CURSOR_RULE_HOOK_REQUEST_URL || "";
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.CURSOR_RULE_HOOK_TIMEOUT_MS || "20000", 10);

// [业务] 需要同步为用户级 rules 的团队文档地址列表。
// [设计] 通过 CURSOR_RULE_HOOK_DOC_URLS 注入，多个地址用逗号或换行分隔；未配置时为空、跳过同步。
const DOC_URLS = (process.env.CURSOR_RULE_HOOK_DOC_URLS || "")
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
  const safeName = rawName.replace(/[\\/:*?"<>|]/g, "_");
  return {
    fileName: `${safeName}.mdc`,
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

async function updateRules(docUrls = DOC_URLS, rulesDir = RULES_DIR) {
  for (const docUrl of docUrls) {
    // [业务] 每个文档独立生成一个 .mdc 规则文件。
    const content = await fetchRuleContent(docUrl);
    const ruleFile = splitRuleContent(content);
    const writtenPath = await writeRuleFile(rulesDir, ruleFile);
    console.error(`[sessionStart-rule-hook] 已更新规则：${writtenPath}`);
  }
}

async function main() {
  // [业务] 未配置团队文档来源时，规则同步整体跳过，保持 hook 无害可用。
  // [设计] 公开仓不内置任何私有地址；团队通过 CURSOR_RULE_HOOK_REQUEST_URL / _DOC_URLS 注入后才启用。
  if (!REQUEST_URL || DOC_URLS.length === 0) {
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
  splitRuleContent,
  writeRuleFile
};
