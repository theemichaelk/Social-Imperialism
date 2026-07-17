@echo off
REM Double-click this file — zero-touch local Social Imperialism.
REM Starts Docker (if needed), Floci S3, API, and web. No Amplify.
cd /d "%~dp0"
title Social Imperialism — local
echo.
echo  Starting Social Imperialism (local)...
echo  Leave this window open. Web: http://localhost:3000
echo.
call npm run dev
if errorlevel 1 (
  echo.
  echo  Something failed. Common fix: install/start Docker Desktop, then double-click again.
  pause
)
