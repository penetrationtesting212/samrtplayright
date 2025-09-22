#!/bin/bash

# Python ML Service Startup Script

echo "🐍 Starting Python ML Service..."

# Check if Python 3.8+ is installed
PYTHON_VERSION=$(python3 --version 2>&1 | grep -oP '\d+\.\d+')
REQUIRED_VERSION="3.8"

if python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)"; then
    echo "✅ Python version check passed: $(python3 --version)"
else
    echo "❌ Python 3.8+ is required. Current version: $(python3 --version)"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "ml_env" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv ml_env
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source ml_env/bin/activate

# Install/upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📚 Installing Python dependencies..."
pip install -r requirements.txt

# Create model directories
mkdir -p ml_models model_configs

# Set environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
export TF_CPP_MIN_LOG_LEVEL=2  # Reduce TensorFlow logging

# Start the service
echo "🚀 Starting FastAPI ML Service on http://localhost:8000"
echo "📊 API Documentation available at http://localhost:8000/docs"
echo "🔧 Health check: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop the service"

uvicorn app:app --host 0.0.0.0 --port 8000 --reload