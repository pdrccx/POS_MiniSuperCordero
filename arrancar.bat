@echo off
title Mini Super Cordero
cd /d "%~dp0"

echo Iniciando Mini Super Cordero...

rem ===== 1. Revisar si Node.js esta instalado =====
where node >nul 2>nul
if %errorlevel% equ 0 goto tiene_node

echo.
echo Esta computadora no tiene Node.js. Se va a instalar automaticamente.
echo Si aparece una ventana pidiendo permiso, dale clic en "Si".
echo.

rem Primero intentamos con winget (viene incluido en Windows 10 y 11)
where winget >nul 2>nul
if %errorlevel% neq 0 goto instalar_msi

winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
goto refrescar_path

:instalar_msi
echo Descargando Node.js, esto puede tardar unos minutos...
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi' -OutFile '%TEMP%\node_instalador.msi'"
if not exist "%TEMP%\node_instalador.msi" goto fallo_node
echo Instalando Node.js...
msiexec /i "%TEMP%\node_instalador.msi" /passive /norestart

:refrescar_path
set "PATH=%PATH%;%ProgramFiles%\nodejs;%APPDATA%\npm"
where node >nul 2>nul
if %errorlevel% equ 0 goto tiene_node

:fallo_node
echo.
echo No se pudo instalar Node.js automaticamente.
echo Entra a https://nodejs.org , descarga el boton que dice LTS,
echo instalalo dando "Siguiente" a todo, y vuelve a dar doble clic a este archivo.
echo.
pause
exit /b 1

:tiene_node
rem ===== 2. Instalar el programa la primera vez =====
if not exist node_modules (
    echo.
    echo Preparando el programa por primera vez, espera un momento...
    call npm install
    if errorlevel 1 (
        echo.
        echo Algo fallo al preparar el programa. Revisa que haya internet y
        echo vuelve a dar doble clic a este archivo.
        pause
        exit /b 1
    )
)

rem ===== 3. Arrancar =====
echo.
echo Abriendo Mini Super Cordero en el navegador...
echo Para apagar el sistema, cierra esta ventana negra.
echo.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server.js
pause
