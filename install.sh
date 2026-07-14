#!/usr/bin/env bash

# [业务] 为 Cursor 和 / 或 Claude Code 安装团队 hook（会话规则同步 + 工具调用记录 + 会话上报）。
# [设计] mac 与 linux 共用本脚本：重活（JSON 智能合并）交给 node lib/merge-config.js，
#        本脚本只负责检测 node、拷贝 hook 文件、调用合并脚本。所有路径基于脚本自身位置解析，
#        因此可在任意工作目录调用。

set -u

# [业务] 定位脚本所在目录，作为所有源文件（hooks / config / lib）的根。
# [设计] 用 BASH_SOURCE 解析真实路径，避免依赖调用方的当前目录。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# [字段] MIN_NODE_MAJOR：hook 使用了全局 fetch / AbortController，需 Node 18+。
MIN_NODE_MAJOR=18

log()  { printf '\033[32m[install]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[install]\033[0m %s\n' "$1"; }
err()  { printf '\033[31m[install]\033[0m %s\n' "$1" >&2; }

# [业务] 校验 node 存在且版本达标，否则 hook 根本无法运行，直接中止。
# [设计] 用 process.versions.node 取主版本号，比解析 `node --version` 文本更稳。
check_node() {
  if ! command -v node >/dev/null 2>&1; then
    err "未检测到 node。这些 hook 是 Node.js 脚本，请先安装 Node.js ${MIN_NODE_MAJOR}+ 后重试。"
    exit 1
  fi
  # [字段] node_major：当前 node 主版本号。
  local node_major
  node_major="$(node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null)"
  if [ -z "${node_major}" ] || [ "${node_major}" -lt "${MIN_NODE_MAJOR}" ]; then
    err "Node 版本过低（需 ${MIN_NODE_MAJOR}+，当前 $(node --version 2>/dev/null)）。hook 依赖全局 fetch，请升级后重试。"
    exit 1
  fi
  log "已检测到 Node $(node --version)"
}

# [业务] 安装单个工具的 hook：拷贝脚本 + 智能合并配置。
# [设计] cursor 与 claude 的目标目录、配置文件名、模板、命令路径形式不同，用参数区分。
#
# 参数：$1 = cursor | claude
install_tool() {
  # [字段] tool：目标工具名。
  local tool="$1"
  # [字段] tool_home：该工具的用户级配置根目录（~/.cursor 或 ~/.claude）。
  local tool_home
  # [字段] config_file：该工具的 hook 配置文件绝对路径。
  local config_file
  # [字段] template：对应的配置模板文件。
  local template

  case "${tool}" in
    cursor)
      tool_home="${HOME}/.cursor"
      config_file="${tool_home}/hooks.json"
      template="${SCRIPT_DIR}/config/cursor-hooks.template.json"
      ;;
    claude)
      tool_home="${HOME}/.claude"
      config_file="${tool_home}/settings.json"
      template="${SCRIPT_DIR}/config/claude-settings.template.json"
      ;;
    *)
      err "未知工具：${tool}"
      return 1
      ;;
  esac

  # [字段] src_hooks：仓库内该工具的 hook 源目录。
  local src_hooks="${SCRIPT_DIR}/hooks/${tool}"
  # [字段] dst_hooks：目标机器上的 hook 安装目录。
  local dst_hooks="${tool_home}/hooks"

  if [ ! -d "${src_hooks}" ]; then
    err "找不到源 hook 目录：${src_hooks}"
    return 1
  fi

  log "安装 ${tool} hook 到 ${dst_hooks}"
  mkdir -p "${dst_hooks}"
  # [业务] 拷贝三个 hook 脚本到目标目录。
  cp "${src_hooks}"/*.js "${dst_hooks}/"
  # [设计] Cursor 通过 shebang 直接执行 .js，必须可执行；Claude 经 node 调用，加执行位也无害。
  chmod +x "${dst_hooks}"/*.js 2>/dev/null || true

  # [业务] 调用共用合并脚本，把团队配置合并进用户已有配置（幂等、自动备份）。
  node "${SCRIPT_DIR}/lib/merge-config.js" \
    --tool "${tool}" \
    --config "${config_file}" \
    --template "${template}" \
    --hooks-dir "${dst_hooks}"
}

main() {
  # [字段] target：安装目标，cursor / claude / both，默认 both。
  local target="${1:-both}"

  case "${target}" in
    cursor|claude|both) ;;
    -h|--help)
      printf '用法: %s [cursor|claude|both]\n默认 both，同时为两个工具安装。\n' "$0"
      exit 0
      ;;
    *)
      err "未知参数：${target}（可选 cursor|claude|both）"
      exit 1
      ;;
  esac

  check_node

  if [ "${target}" = "cursor" ] || [ "${target}" = "both" ]; then
    install_tool cursor
  fi
  if [ "${target}" = "claude" ] || [ "${target}" = "both" ]; then
    install_tool claude
  fi

  log "完成。请重启 Cursor / Claude Code 使 hook 生效。"
  warn "注意：stop hook 会把会话记录与工具调用（可能含代码 / 文件内容）上报到团队后端，详见 README 的安全说明。"
}

main "$@"
