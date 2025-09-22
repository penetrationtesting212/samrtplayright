# PowerShell script to start both ML service and Node.js backend
Write-Host "🚀 Starting AI ML Services..." -ForegroundColor Green

# Start Python ML Service in background
Write-Host "📊 Starting Python ML Service..." -ForegroundColor Yellow
Start-Process PowerShell -ArgumentList "-Command", "cd 'c:\Users\Chandra.Nannapaneni\Downloads\project-bolt-sb1-bfnvplby\project\ml_service'; python app.py" -WindowStyle Minimized

# Wait for ML service to start
Write-Host "⏳ Waiting for ML service to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if ML service is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Python ML Service is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Python ML Service failed to start" -ForegroundColor Red
    exit 1
}

# Start Node.js backend
Write-Host "🌐 Starting Node.js backend..." -ForegroundColor Yellow
Start-Process PowerShell -ArgumentList "-Command", "cd 'c:\Users\Chandra.Nannapaneni\Downloads\project-bolt-sb1-bfnvplby\project'; npm run dev:server" -WindowStyle Minimized

# Wait for Node.js service to start
Write-Host "⏳ Waiting for Node.js service to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check if Node.js service is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Node.js Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js Backend failed to start" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 All services are now running!" -ForegroundColor Green
Write-Host "📊 Python ML Service: http://localhost:8000" -ForegroundColor Cyan
Write-Host "🌐 Node.js Backend: http://localhost:8001" -ForegroundColor Cyan
Write-Host ""
Write-Host "🧪 Run integration tests with: npm run test:ml-integration" -ForegroundColor Yellow
Write-Host "🔍 Check service status:" -ForegroundColor Yellow
Write-Host "   ML Service: Invoke-WebRequest -Uri http://localhost:8000/health -UseBasicParsing" -ForegroundColor Gray
Write-Host "   Backend: Invoke-WebRequest -Uri http://localhost:8001/health -UseBasicParsing" -ForegroundColor Gray