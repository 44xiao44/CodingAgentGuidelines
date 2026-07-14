# [业务] 为 Cursor 和 / 或 Claude Code 安装团队 hook（会话规则同步 + 工具调用记录 + 会话上报）。
# [设计] Windows 端安装脚本，与 install.sh 职责对齐：重活（JSON 智能合并）交给
#        node lib/merge-config.js，本脚本只负责检测 node、拷贝 hook 文件、调用合并脚本。
#        JSON 合并不依赖 PowerShell 版本特性，因此可在 Windows 8 / Server 2012+（PS 3.0+）运行。

[CmdletBinding()]
param(
    # [字段] Target：安装目标，cursor / claude / both，默认 both。
    [ValidateSet('cursor', 'claude', 'both')]
    [string]$Target = 'both'
)

# [设计] 任一命令出错即抛异常并中止，避免拷了一半配置留下不一致状态。
$ErrorActionPreference = 'Stop'

# [业务] 定位脚本所在目录，作为所有源文件（hooks / config / lib）的根。
# [设计] 用 $PSScriptRoot 解析真实路径，可在任意工作目录调用。
$ScriptDir = $PSScriptRoot

# [字段] MinNodeMajor：hook 使用了全局 fetch / AbortController，需 Node 18+。
$MinNodeMajor = 18

function Write-Log  { param([string]$Message) Write-Host "[install] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[install] $Message" -ForegroundColor Yellow }
function Write-Err  { param([string]$Message) Write-Host "[install] $Message" -ForegroundColor Red }

# [业务] 校验 node 存在且版本达标，否则 hook 无法运行，直接中止。
# [设计] 用 process.versions.node 取主版本号，比解析文本更稳。
function Test-Node {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Err "未检测到 node。这些 hook 是 Node.js 脚本，请先安装 Node.js $MinNodeMajor+ 后重试。"
        exit 1
    }
    # [字段] nodeMajor：当前 node 主版本号。
    $nodeMajor = (& node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>$null)
    if ([string]::IsNullOrEmpty($nodeMajor) -or [int]$nodeMajor -lt $MinNodeMajor) {
        $current = (& node --version 2>$null)
        Write-Err "Node 版本过低（需 $MinNodeMajor+，当前 $current）。hook 依赖全局 fetch，请升级后重试。"
        exit 1
    }
    Write-Log "已检测到 Node $(& node --version)"
}

# [业务] 安装单个工具的 hook：拷贝脚本 + 智能合并配置。
# [设计] cursor 与 claude 的目标目录、配置文件名、模板不同，用参数区分。
function Install-Tool {
    param(
        # [字段] Tool：目标工具名，cursor 或 claude。
        [Parameter(Mandatory = $true)]
        [ValidateSet('cursor', 'claude')]
        [string]$Tool
    )

    # [字段] toolHome：该工具的用户级配置根目录。
    # [字段] configFile：该工具的 hook 配置文件绝对路径。
    # [字段] template：对应的配置模板文件。
    switch ($Tool) {
        'cursor' {
            $toolHome = Join-Path $HOME '.cursor'
            $configFile = Join-Path $toolHome 'hooks.json'
            $template = Join-Path $ScriptDir 'config/cursor-hooks.template.json'
        }
        'claude' {
            $toolHome = Join-Path $HOME '.claude'
            $configFile = Join-Path $toolHome 'settings.json'
            $template = Join-Path $ScriptDir 'config/claude-settings.template.json'
        }
    }

    # [字段] srcHooks：仓库内该工具的 hook 源目录。
    $srcHooks = Join-Path $ScriptDir "hooks/$Tool"
    # [字段] dstHooks：目标机器上的 hook 安装目录。
    $dstHooks = Join-Path $toolHome 'hooks'

    if (-not (Test-Path $srcHooks)) {
        Write-Err "找不到源 hook 目录：$srcHooks"
        return
    }

    Write-Log "安装 $Tool hook 到 $dstHooks"
    New-Item -ItemType Directory -Force -Path $dstHooks | Out-Null
    # [业务] 拷贝三个 hook 脚本到目标目录。
    Copy-Item -Path (Join-Path $srcHooks '*.js') -Destination $dstHooks -Force

    # [业务] 调用共用合并脚本，把团队配置合并进用户已有配置（幂等、自动备份）。
    & node (Join-Path $ScriptDir 'lib/merge-config.js') `
        --tool $Tool `
        --config $configFile `
        --template $template `
        --hooks-dir $dstHooks
    if ($LASTEXITCODE -ne 0) {
        throw "合并 $Tool 配置失败。"
    }
}

Test-Node

if ($Target -eq 'cursor' -or $Target -eq 'both') {
    Install-Tool -Tool cursor
}
if ($Target -eq 'claude' -or $Target -eq 'both') {
    Install-Tool -Tool claude
}

Write-Log '完成。请重启 Cursor / Claude Code 使 hook 生效。'
Write-Warn '注意：stop hook 会把会话记录与工具调用（可能含代码 / 文件内容）上报到团队后端，详见 README 的安全说明。'
