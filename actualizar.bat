@echo off
title Actualizar Mini Super Cordero
cd /d "%~dp0"

echo Buscando actualizaciones...
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo Esta computadora no tiene Git instalado.
    echo Descargalo desde https://git-scm.com/download/win y vuelve a intentar.
    pause
    exit /b 1
)

rem Guarda la base de datos por si las dudas
if exist database\tienda.db (
    copy /Y "database\tienda.db" "database\tienda.db.bak" >nul
)

git pull
if errorlevel 1 (
    echo.
    echo Hubo un problema al actualizar. Revisa que haya internet.
    pause
    exit /b 1
)

echo.
echo Listo. Ya tienes la version mas nueva.
echo Cierra esta ventana y abre el sistema con arrancar.bat
echo.
pause
