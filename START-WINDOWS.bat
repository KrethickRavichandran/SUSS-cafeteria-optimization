@echo off
cd /d "%~dp0"
if exist "public\index.html" (
  start "" "public\index.html"
) else (
  start "" "index.html"
)
