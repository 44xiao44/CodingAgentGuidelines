#!/usr/bin/env node

/**
 * [业务] 把团队 hook 配置智能合并进用户已有的 Cursor hooks.json 或 Claude settings.json。
 * [设计] 三端（mac/linux/windows）安装脚本共用这一份合并逻辑，保证行为一致：
 *        - 只增改我们管理的三个 hook 条目，完整保留用户其余配置；
 *        - 幂等：以脚本文件名为键，"先删我们的、再加我们的"，重复安装不产生重复项；
 *        - 写入前对已有文件做 .bak 备份；已有 JSON 损坏时备份为 .corrupt.bak 并中止，绝不覆盖。
 *        纯 Node 内置能力，无第三方依赖。
 *
 * 用法：
 *   node merge-config.js --tool <cursor|claude> --config <路径> --template <路径> --hooks-dir <路径>
 */

const fs = require("node:fs");
const path = require("node:path");

// [业务] 我们管理的三个 hook 脚本文件名，作为合并去重的唯一标识。
// [设计] 命令字符串里只要包含这些文件名，就视为"我们的"旧条目，合并时先清除再重建。
const MANAGED_SCRIPT_NAMES = [
  "update-user-rules-on-session-start.js",
  "capture-post-tool-use.js",
  "send-stop-transcript.js"
];

// [业务] Cursor 与 Claude 各自管理的事件名，用于限定只在这些事件上做合并。
const MANAGED_EVENTS = {
  cursor: ["sessionStart", "postToolUse", "stop"],
  claude: ["SessionStart", "PostToolUse", "Stop"]
};

/**
 * [业务] 解析命令行参数为键值对象。
 * [设计] 只支持 --key value 形式，足够安装脚本调用；未知参数忽略。
 *
 * @param {string[]} argv process.argv.slice(2)。
 * @returns {Record<string,string>} 参数键值对。
 */
function parseArgs(argv) {
  // [字段] args：解析后的参数键值对。
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1];
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

/**
 * [业务] 判断某条命令是否引用了我们管理的脚本。
 * [设计] 用文件名子串匹配，兼容相对路径（Cursor）和 node "绝对路径"（Claude）两种写法。
 *
 * @param {string} command 命令字符串。
 * @returns {boolean} 命中我们管理的脚本则返回 true。
 */
function isManagedCommand(command) {
  if (typeof command !== "string") {
    return false;
  }
  return MANAGED_SCRIPT_NAMES.some((name) => command.includes(name));
}

/**
 * [业务] 递归把对象内所有字符串里的 __HOOKS_DIR__ 占位符替换为真实 hooks 目录。
 * [设计] 在 JSON 解析后的对象上替换，避免路径中的反斜杠（Windows）破坏 JSON 文本；
 *        统一使用正斜杠，Node 在 Windows 上同样识别正斜杠路径。
 *
 * @param {*} node 任意 JSON 值。
 * @param {string} hooksDir 已归一化为正斜杠的 hooks 目录绝对路径。
 * @returns {*} 替换后的同类型值。
 */
function replacePlaceholders(node, hooksDir) {
  if (typeof node === "string") {
    return node.split("__HOOKS_DIR__").join(hooksDir);
  }
  if (Array.isArray(node)) {
    return node.map((item) => replacePlaceholders(item, hooksDir));
  }
  if (node && typeof node === "object") {
    // [字段] next：逐键替换后的新对象。
    const next = {};
    for (const key of Object.keys(node)) {
      next[key] = replacePlaceholders(node[key], hooksDir);
    }
    return next;
  }
  return node;
}

/**
 * [业务] 读取并解析已有配置文件；不存在返回空对象。
 * [设计] JSON 损坏时不静默丢弃：备份为 .corrupt.bak 后抛错，交由调用方中止，保护用户数据。
 *
 * @param {string} configPath 配置文件绝对路径。
 * @returns {object} 解析后的配置对象；文件不存在时为 {}。
 */
function readExistingConfig(configPath) {
  let raw;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      // [业务] 首次安装，尚无配置文件。
      return {};
    }
    throw error;
  }

  // [业务] 空文件视为空配置，避免 JSON.parse 空串报错。
  if (raw.trim() === "") {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    // [设计] 现有 JSON 无法解析时，先留证据再中止，绝不覆盖用户数据。
    const corruptPath = `${configPath}.corrupt.bak`;
    fs.writeFileSync(corruptPath, raw, "utf8");
    throw new Error(
      `现有配置文件不是合法 JSON，已备份到 ${corruptPath}，请修复或删除后重试：${configPath}`
    );
  }
}

/**
 * [业务] 合并 Cursor 结构：hooks[event] 是 [{command, timeout}] 数组。
 * [设计] 先移除引用我们脚本的旧条目，再追加模板中的新条目，实现幂等。
 *
 * @param {object} existing 现有配置对象（会被就地修改）。
 * @param {object} template 已替换占位符的模板对象。
 * @returns {object} 合并后的配置对象。
 */
function mergeCursor(existing, template) {
  // [业务] Cursor 顶层需要 version 字段；缺失时补上模板值。
  if (existing.version === undefined && template.version !== undefined) {
    existing.version = template.version;
  }
  if (!existing.hooks || typeof existing.hooks !== "object") {
    existing.hooks = {};
  }

  const templateHooks = template.hooks || {};
  for (const event of MANAGED_EVENTS.cursor) {
    // [字段] ours：模板中该事件下我们要写入的条目列表。
    const ours = Array.isArray(templateHooks[event]) ? templateHooks[event] : [];
    // [字段] current：用户现有的该事件条目；非数组则重置为空。
    const current = Array.isArray(existing.hooks[event]) ? existing.hooks[event] : [];
    // [业务] 保留用户自定义条目，剔除我们上次写入的同名条目。
    const kept = current.filter((entry) => !isManagedCommand(entry && entry.command));
    existing.hooks[event] = kept.concat(ours);
  }
  return existing;
}

/**
 * [业务] 合并 Claude 结构：hooks[event] 是 [{matcher?, hooks: [{type, command, timeout}]}] 分组数组。
 * [设计] 对每个现有分组，剔除其 hooks[] 内引用我们脚本的条目；分组因此清空则丢弃；
 *        最后追加模板中的分组。用户自有分组和 hook 全部保留。
 *
 * @param {object} existing 现有配置对象（会被就地修改）。
 * @param {object} template 已替换占位符的模板对象。
 * @returns {object} 合并后的配置对象。
 */
function mergeClaude(existing, template) {
  if (!existing.hooks || typeof existing.hooks !== "object") {
    existing.hooks = {};
  }

  const templateHooks = template.hooks || {};
  for (const event of MANAGED_EVENTS.claude) {
    // [字段] ourGroups：模板中该事件下我们要追加的分组。
    const ourGroups = Array.isArray(templateHooks[event]) ? templateHooks[event] : [];
    // [字段] current：用户现有该事件的分组列表；非数组则重置为空。
    const current = Array.isArray(existing.hooks[event]) ? existing.hooks[event] : [];

    // [字段] kept：清洗后仍需保留的用户分组。
    const kept = [];
    for (const group of current) {
      if (!group || typeof group !== "object") {
        continue;
      }
      const innerHooks = Array.isArray(group.hooks) ? group.hooks : [];
      // [业务] 只剔除引用我们脚本的内层 hook，用户其他 hook 原样保留。
      const keptInner = innerHooks.filter((h) => !isManagedCommand(h && h.command));
      if (keptInner.length > 0) {
        group.hooks = keptInner;
        kept.push(group);
      }
      // [设计] 内层清空说明该分组原本只含我们的 hook，直接丢弃，避免留下空分组。
    }

    existing.hooks[event] = kept.concat(ourGroups);
  }
  return existing;
}

/**
 * [业务] 合并入口：按 tool 选择结构，写入前备份，写入后打印摘要。
 * [设计] 备份、目录创建、格式化写入集中在此，保证三端调用行为一致。
 */
function main() {
  const args = parseArgs(process.argv.slice(2));
  const tool = args.tool;
  const configPath = args.config;
  const templatePath = args.template;
  const hooksDirRaw = args["hooks-dir"];

  // [业务] 入口参数校验，缺失即 fail fast，避免写坏文件。
  if (!tool || !MANAGED_EVENTS[tool]) {
    throw new Error('参数 --tool 必须是 "cursor" 或 "claude"。');
  }
  if (!configPath) {
    throw new Error("缺少参数 --config <目标配置文件路径>。");
  }
  if (!templatePath) {
    throw new Error("缺少参数 --template <模板文件路径>。");
  }

  // [字段] hooksDir：归一化为正斜杠的 hooks 目录，供占位符替换使用。
  const hooksDir = (hooksDirRaw || "").split("\\").join("/");

  // [字段] templateRaw：模板文件原文。
  const templateRaw = fs.readFileSync(templatePath, "utf8");
  // [字段] template：解析并替换占位符后的模板对象。
  const template = replacePlaceholders(JSON.parse(templateRaw), hooksDir);

  // [字段] existing：用户现有配置；不存在为 {}，损坏则在 readExistingConfig 内中止。
  const existing = readExistingConfig(configPath);

  // [字段] fileExisted：记录合并前配置文件是否已存在，决定是否需要备份。
  const fileExisted = fs.existsSync(configPath);

  // [字段] merged：按工具类型合并后的最终配置。
  const merged = tool === "cursor" ? mergeCursor(existing, template) : mergeClaude(existing, template);

  // [设计] 写入前对已有文件做 .bak 备份，给用户一个明确的回退点。
  if (fileExisted) {
    fs.copyFileSync(configPath, `${configPath}.bak`);
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  // [业务] 打印结果摘要，安装脚本据此向用户反馈。
  const action = fileExisted ? "已合并（原文件备份为 .bak）" : "已创建";
  console.log(`[merge-config] ${tool} 配置${action}：${configPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[merge-config] 失败：${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  isManagedCommand,
  replacePlaceholders,
  mergeCursor,
  mergeClaude,
  MANAGED_SCRIPT_NAMES
};
