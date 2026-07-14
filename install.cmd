@echo off
rem [业务] Windows 双击启动器：调用同目录下的 install.ps1 安装团队 hook。
rem [设计] 客户端默认执行策略会拦截 .ps1，这里用 -ExecutionPolicy Bypass 仅对本次进程放行，
rem        不修改系统策略；-File 传入脚本，%* 透传 cursor/claude/both 等参数。

setlocal
rem [字段] SCRIPT_DIR：本 .cmd 所在目录，用于定位 install.ps1。
set "SCRIPT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

rem [设计] 双击运行时窗口会一闪而过，暂停让用户看到安装结果和安全提示。
if "%~1"=="" pause
exit /b %EXIT_CODE%
