@echo off
setlocal
cd /d "%~dp0"
if not exist "frontend\.next\BUILD_ID" (
  echo Preparing the optimized website. This first build can take a minute.
  call npm run build:storefront
  if errorlevel 1 goto failed
)
if not exist "backend\dist\index.js" (
  call npm run build:api
  if errorlevel 1 goto failed
)
echo Starting ATELIER in production mode at http://localhost:3000
call npm start
if errorlevel 1 goto failed
exit /b 0
:failed
echo ATELIER could not start. Check the error above.
pause
exit /b 1
