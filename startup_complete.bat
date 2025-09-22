@echo off
REM Complete startup script for AI-powered testing suite with Python ML service

echo 🚀 Starting AI-Powered Testing Suite with Python ML Service
echo ============================================================

REM Check if Python ML service is already running
echo 🔍 Checking if Python ML service is running...
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Python ML service is already running
) else (
    echo 🐍 Starting Python ML service...
    echo Opening new window for Python ML service...
    start "Python ML Service" cmd /k "cd ml_service && ml_env\Scripts\activate.bat && python app.py"
    
    REM Wait for Python service to start
    echo 🕐 Waiting for Python ML service to initialize...
    timeout /t 10 /nobreak >nul
    
    REM Check if it started successfully
    curl -s http://localhost:8000/health >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Python ML service started successfully
    ) else (
        echo ❌ Python ML service failed to start
        echo 💡 Please check the Python ML service window for errors
        pause
        exit /b 1
    )
)

echo.
echo 🧪 Running integration test...
node test_ml_integration.js

echo.
echo 🌐 All services are ready!
echo.
echo 📊 Available Services:
echo    • Python ML Service: http://localhost:8000
echo    • ML API Documentation: http://localhost:8000/docs
echo    • Health Check: http://localhost:8000/health
echo.
echo 🎯 You can now:
echo    • Start Node.js backend: npm run dev:server (port 3000)
echo    • Start frontend: npm run dev (port 5173)  
echo    • Run tests: npm run test:e2e
echo    • View models: curl http://localhost:8000/models
echo.
echo 💡 Press any key to continue or Ctrl+C to exit...
pause >nul