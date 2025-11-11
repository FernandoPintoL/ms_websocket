@echo off
REM MS WebSocket Docker Helper Script para Windows

setlocal enabledelayedexpansion

REM Colores (simulados con caracteres)
set "INFO=[INFO]"
set "SUCCESS=[OK]"
set "ERROR=[ERROR]"
set "WARNING=[WARN]"

:menu
cls
echo.
echo ===============================================
echo    MS WebSocket - Docker Helper (Windows)
echo ===============================================
echo.
echo 1) Iniciar contenedor (build)
echo 2) Iniciar contenedor (sin rebuild)
echo 3) Parar contenedor
echo 4) Ver logs
echo 5) Ver estado
echo 6) Limpiar (eliminar contenedor)
echo 7) Verificar conexion a BD
echo 8) Salir
echo.

set /p option="Selecciona una opcion: "

if "%option%"=="1" goto start_build
if "%option%"=="2" goto start_no_build
if "%option%"=="3" goto stop
if "%option%"=="4" goto logs
if "%option%"=="5" goto status
if "%option%"=="6" goto cleanup
if "%option%"=="7" goto check_bd
if "%option%"=="8" goto exit_script

echo %ERROR% Opcion no valida
timeout /t 2 /nobreak
goto menu

:start_build
cls
echo %INFO% Construyendo e iniciando contenedor...
docker-compose up --build -d
if %errorlevel% equ 0 (
  echo %SUCCESS% Contenedor iniciado
  timeout /t 2 /nobreak
  goto status
) else (
  echo %ERROR% Error al iniciar contenedor
  pause
  goto menu
)

:start_no_build
cls
echo %INFO% Iniciando contenedor...
docker-compose up -d
if %errorlevel% equ 0 (
  echo %SUCCESS% Contenedor iniciado
  timeout /t 2 /nobreak
  goto status
) else (
  echo %ERROR% Error al iniciar contenedor
  pause
  goto menu
)

:stop
cls
echo %INFO% Parando contenedor...
docker-compose down
if %errorlevel% equ 0 (
  echo %SUCCESS% Contenedor parado
) else (
  echo %ERROR% Error al parar contenedor
)
timeout /t 2 /nobreak
goto menu

:logs
cls
echo %INFO% Mostrando logs (Ctrl+C para salir)...
echo.
docker-compose logs -f --tail=50
goto menu

:status
cls
echo %INFO% Estado del contenedor:
echo.
docker-compose ps
echo.

REM Verificar salud
echo %INFO% Verificando salud del servicio...
timeout /t 1 /nobreak
curl -f http://localhost:4004/health >nul 2>&1
if %errorlevel% equ 0 (
  echo %SUCCESS% Servicio esta saludable
  echo.
  echo Puertos disponibles:
  echo   - WebSocket: http://localhost:4004
  echo   - Health: http://localhost:4004/health
  echo   - GraphQL: http://localhost:4004/graphql
  echo   - Playground: http://localhost:4004/playground
) else (
  echo %WARNING% No se pudo verificar salud (servicio podria estar iniciandose)
)
echo.
pause
goto menu

:check_bd
cls
echo %INFO% Verificando conexion a Redis...
redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
  echo %SUCCESS% Redis esta corriendo en localhost:6379
) else (
  echo %ERROR% Redis no responde. Verifica que esta ejecutandose.
)
echo.
pause
goto menu

:cleanup
cls
echo %WARNING% Esto eliminara el contenedor y los volumenes
set /p confirm="Estas seguro? (s/N): "
if /i "%confirm%"=="s" (
  echo %INFO% Limpiando...
  docker-compose down -v
  if %errorlevel% equ 0 (
    echo %SUCCESS% Limpieza completada
  ) else (
    echo %ERROR% Error durante la limpieza
  )
) else (
  echo %INFO% Cancelado
)
timeout /t 2 /nobreak
goto menu

:exit_script
cls
echo %INFO% Hasta luego!
timeout /t 1 /nobreak
exit /b 0
