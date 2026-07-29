@echo off
set "PROJECT_DIR=%~dp0"
set "PATH=%PROJECT_DIR%.tools\mingit-2.54.0\cmd;%PROJECT_DIR%.tools\gh-2.92.0\bin;%PATH%"
cd /d "%PROJECT_DIR%"
echo HardGainWAF Dev Shell
echo.
git --version
gh --version
echo.
echo Tipp: Mit "gh auth login" meldest du GitHub CLI fuer Pushes an.
echo.
cmd /k
