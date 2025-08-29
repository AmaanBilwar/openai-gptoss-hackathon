@echo off
setlocal ENABLEDELAYEDEXPANSION

set "SCRIPT_DIR=%~dp0"
set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=run"

if /I "%ACTION%"=="run" (
  powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%tui\run.ps1"
  exit /b %ERRORLEVEL%
)

if /I "%ACTION%"=="build" (
  powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%SCRIPT_DIR%tui'; go build -o kite-cli.exe"
  exit /b %ERRORLEVEL%
)

echo Unknown command: %ACTION%
echo Usage: kite [run^|build]
exit /b 1


