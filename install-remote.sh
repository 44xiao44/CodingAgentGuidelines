#!/usr/bin/env bash

# [业务] 一行命令远程安装引导脚本：下载整个工程压缩包，解压后调用本地 install.sh 完成安装。
# [设计] 供 `curl -fsSL <url> | bash` 方式执行。下载与解压是唯一的远程动作，真正的安装逻辑
#        复用已测过的 install.sh，避免逻辑分叉。所有地址通过环境变量可覆盖，便于切换托管方式
#        （GitLab archive / 后端静态托管），无需改脚本。

set -euo pipefail

# [字段] REPO：GitHub 仓库路径 owner/repo，默认公开仓。
REPO="${RULE_INSTALL_REPO:-44xiao44/CodingAgentGuidelines}"
# [字段] REF：要安装的分支、标签或提交号。
REF="${RULE_INSTALL_REF:-main}"
# [字段] TOKEN：私有仓库访问令牌；仓库非公开时通过 Authorization 头传入。公开仓无需设置。
TOKEN="${RULE_INSTALL_TOKEN:-}"

# [字段] ARCHIVE_URL：工程压缩包下载地址。
# [设计] 默认用 GitHub 的 archive 接口打包整个 ref 为 tar.gz（branch/tag/sha 通用）；
#        改为内网 GitLab 或后端静态托管时整体覆盖此变量即可，无需改脚本。
ARCHIVE_URL="${RULE_INSTALL_ARCHIVE_URL:-https://github.com/${REPO}/archive/${REF}.tar.gz}"

log() { printf '\033[32m[install-remote]\033[0m %s\n' "$1"; }
err() { printf '\033[31m[install-remote]\033[0m %s\n' "$1" >&2; }

# [业务] 前置依赖校验：curl 用于下载，tar 用于解压，node 是 hook 运行前提。
for bin in curl tar node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    err "缺少依赖：${bin}。请先安装后重试（hook 需要 Node.js 18+）。"
    exit 1
  fi
done

# [字段] TMP：临时工作目录，安装结束后自动清理。
TMP="$(mktemp -d)"
# [设计] 无论成功失败都清理临时目录，避免残留下载文件。
trap 'rm -rf "$TMP"' EXIT

log "下载工程压缩包：${ARCHIVE_URL}"

# [业务] 组装 curl 参数，私有仓库时附带访问令牌。
# [设计] 用数组传参避免 token 被 shell 词法拆分或记录进历史。GitHub 用 Authorization 头。
curl_args=(-fsSL)
if [ -n "$TOKEN" ]; then
  curl_args+=(-H "Authorization: Bearer ${TOKEN}")
fi

# [业务] 下载并解压到临时目录，剥掉压缩包顶层目录，使 install.sh 落在 $TMP 根下。
# [设计] 下载与解压用管道串联；任一环节失败 set -e 会中止，避免半成品安装。
if ! curl "${curl_args[@]}" "$ARCHIVE_URL" | tar -xz -C "$TMP" --strip-components=1; then
  err "下载或解压失败。请确认地址可访问；若为私有仓库，请设置 RULE_INSTALL_TOKEN 环境变量。"
  exit 1
fi

if [ ! -f "$TMP/install.sh" ]; then
  err "压缩包内未找到 install.sh，请检查 RULE_INSTALL_REF / RULE_INSTALL_ARCHIVE_URL 是否正确。"
  exit 1
fi

log "开始安装……"
# [业务] 调用工程内已测过的安装脚本，透传 cursor/claude/both 参数。
bash "$TMP/install.sh" "$@"
