@echo off
chcp 65001 >nul
title Deadline nazorati
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js topilmadi. https://nodejs.org saytidan o'rnating.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Kutubxonalar o'rnatilmoqda, bir oz kuting...
  call npm install
  if errorlevel 1 (
    echo O'rnatishda xatolik bo'ldi.
    pause
    exit /b 1
  )
)

echo.
echo  Sayt brauzerda ochiladi: http://localhost:5173
echo  Jamoadoshlar bir xil Wi-Fi/tarmoqda bo'lsa, pastdagi "Network" manzilini ochishi mumkin.
echo  To'xtatish uchun shu oynani yoping yoki Ctrl+C bosing.
echo.
call npm start
pause
