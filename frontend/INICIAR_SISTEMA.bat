@echo off
chcp 65001 >nul
echo.
echo ==================================================
echo   🚀 Iniciando Sistema WhatsApp + Gemini AI
echo ==================================================
echo.

echo [1/2] Iniciando Backend...
start "Backend - WhatsApp Gemini" cmd /k "cd backend && npm start"
timeout /t 3 >nul
echo ✅ Backend iniciando...
echo.

echo [2/2] Iniciando Frontend...
start "Frontend - Dashboard" cmd /k "npm run dev"
echo ✅ Frontend iniciando...
echo.

echo ==================================================
echo   ✅ Sistema Iniciado!
echo ==================================================
echo.
echo 🌐 Acesse o frontend em:
echo    http://localhost:5173
echo.
echo 🔧 Backend rodando em:
echo    http://localhost:3001
echo.
echo 📋 Para configurar o Gemini:
echo    1. Faça login
echo    2. Conecte WhatsApp
echo    3. Clique em "Configurar Agente"
echo    4. Cole API Key do Google AI Studio
echo.
echo Para fechar, feche as janelas abertas ou pressione Ctrl+C
echo.
pause

