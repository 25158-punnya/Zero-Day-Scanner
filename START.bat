@echo off
title Zero-Day Scanner — E-commerce Security Tool
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║        ZERO-DAY SCANNER — E-COMMERCE SECURITY       ║
echo  ║              Starting Application...                 ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo  Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

:: Install dependencies
echo  [*] Installing / verifying dependencies...
pip install -r requirements.txt --quiet

echo.
echo  [+] Dependencies OK
echo  [*] Launching scanner at http://localhost:5000
echo  [*] Press Ctrl+C to stop
echo.

:: Open browser after 2s
start /b timeout /t 2 /nobreak >nul && start http://localhost:5000

:: Run Flask app
cd scanner
python app.py

pause
