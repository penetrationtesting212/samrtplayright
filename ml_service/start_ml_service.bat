@echo off
REM Python ML Service Startup Script for Windows

echo 🐍 Starting Python ML Service...

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not in PATH
    pause
    exit /b 1
)

echo ✅ Python version check passed
python --version

REM Create virtual environment if it doesn't exist
if not exist "ml_env" (
    echo 📦 Creating Python virtual environment...
    python -m venv ml_env
)

REM Activate virtual environment
echo 🔌 Activating virtual environment...
call ml_env\Scripts\activate.bat

REM Install/upgrade pip
echo ⬆️  Upgrading pip...
python -m pip install --upgrade pip

REM Install requirements
echo 📚 Installing Python dependencies...
pip install -r requirements.txt

REM Create model directories
if not exist "ml_models" mkdir ml_models
if not exist "model_configs" mkdir model_configs

REM Set environment variables
set PYTHONPATH=%PYTHONPATH%;%cd%
set TF_CPP_MIN_LOG_LEVEL=2

REM Start the service
echo.
echo 🚀 Starting FastAPI ML Service on http://localhost:8000
echo 📊 API Documentation available at http://localhost:8000/docs
echo 🔧 Health check: http://localhost:8000/health
echo.
echo Press Ctrl+C to stop the service
echo.

uvicorn app:app --host 0.0.0.0 --port 8000 --reload

pause