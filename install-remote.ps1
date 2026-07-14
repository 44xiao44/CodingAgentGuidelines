# [业务] 一行命令远程安装引导脚本（Windows）：下载整个工程压缩包，解压后调用 install.ps1 完成安装。
# [设计] 供 `irm <url> | iex` 或 `iwr <url> -UseBasicParsing | iex` 方式执行。下载解压是唯一远程动作，
#        真正的安装逻辑复用已测过的 install.ps1。所有地址通过环境变量可覆盖，便于切换托管方式，无需改脚本。

$ErrorActionPreference = 'Stop'

# [字段] repo：GitHub 仓库路径 owner/repo，默认公开仓。
$repo = if ($env:RULE_INSTALL_REPO) { $env:RULE_INSTALL_REPO } else { '44xiao44/CodingAgentGuidelines' }
# [字段] ref：要安装的分支、标签或提交号。
$ref = if ($env:RULE_INSTALL_REF) { $env:RULE_INSTALL_REF } else { 'main' }
# [字段] token：私有仓库访问令牌；仓库非公开时通过 Authorization 头传入。公开仓无需设置。
$token = $env:RULE_INSTALL_TOKEN
# [字段] target：安装目标 cursor/claude/both，可用环境变量指定，默认 both。
$target = if ($env:RULE_INSTALL_TARGET) { $env:RULE_INSTALL_TARGET } else { 'both' }

# [字段] archiveUrl：工程压缩包下载地址；默认走 GitHub archive，可整体覆盖为内网或后端静态地址。
$archiveUrl = if ($env:RULE_INSTALL_ARCHIVE_URL) {
    $env:RULE_INSTALL_ARCHIVE_URL
} else {
    "https://github.com/$repo/archive/$ref.zip"
}

function Write-Log { param([string]$Message) Write-Host "[install-remote] $Message" -ForegroundColor Green }
function Write-Err { param([string]$Message) Write-Host "[install-remote] $Message" -ForegroundColor Red }

# [业务] node 是 hook 运行前提，缺失直接中止。
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err '未检测到 node。请先安装 Node.js 18+ 后重试。'
    exit 1
}

# [字段] tmp：临时工作目录，安装结束后清理。
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("rule-install-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
    # [字段] zipPath：下载的压缩包落地路径。
    $zipPath = Join-Path $tmp 'coding-agent-guidelines.zip'

    Write-Log "下载工程压缩包：$archiveUrl"
    # [业务] 组装请求头，私有仓库时附带访问令牌。
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }

    # [设计] -UseBasicParsing 兼容无 IE 引擎的环境；下载失败会抛异常被 catch 捕获。
    Invoke-WebRequest -Uri $archiveUrl -Headers $headers -OutFile $zipPath -UseBasicParsing

    # [业务] 解压压缩包。GitLab archive 会多套一层顶层目录，需定位其中的 install.ps1。
    $extractDir = Join-Path $tmp 'extracted'
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    # [字段] installScript：解压内容中定位到的 install.ps1。
    $installScript = Get-ChildItem -Path $extractDir -Filter 'install.ps1' -Recurse | Select-Object -First 1
    if (-not $installScript) {
        Write-Err '压缩包内未找到 install.ps1，请检查 RULE_INSTALL_REF / RULE_INSTALL_ARCHIVE_URL 是否正确。'
        exit 1
    }

    Write-Log '开始安装……'
    # [业务] 调用工程内已测过的安装脚本，传入安装目标。
    & powershell -NoProfile -ExecutionPolicy Bypass -File $installScript.FullName -Target $target
    if ($LASTEXITCODE -ne 0) {
        throw "安装脚本返回非零退出码：$LASTEXITCODE"
    }
}
catch {
    Write-Err "下载或安装失败：$($_.Exception.Message)"
    Write-Err '若为私有仓库，请设置 RULE_INSTALL_TOKEN 环境变量；或确认下载地址可访问。'
    exit 1
}
finally {
    # [设计] 无论成功失败都清理临时目录。
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
