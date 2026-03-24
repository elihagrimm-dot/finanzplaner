@echo off
setlocal
set MSG=%*
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish.ps1" "%MSG%"
