@echo off
chcp 65001 >nul
echo.
echo ==================================================
echo   🚀 Iniciando Sistema em MODO DESENVOLVIMENTO
echo ==================================================
echo.

echo [1/2] Iniciando Backend LOCAL (porta 3001)...
cd backend
start "Backend LOCAL" cmd /k "npm run dev"
cd ..
timeout /t 3 >nul
echo ✅ Backend iniciando em http://localhost:3001
echo.

echo [2/2] Iniciando Frontend (porta 5173)...
echo      Usando servidor LOCAL (localhost:3001)
start "Frontend DEV" cmd /k "npm run dev"
echo ✅ Frontend iniciando em http://localhost:5173
echo.

echo ==================================================
echo   ✅ Sistema Iniciado em MODO DESENVOLVIMENTO!
echo ==================================================
echo.
echo 🌐 Frontend: http://localhost:5173
echo 🔧 Backend:  http://localhost:3001
echo.
echo ⚠️  Usando SERVIDOR LOCAL (não produção)
echo.
echo Para fechar, feche as janelas abertas
echo.
pause

