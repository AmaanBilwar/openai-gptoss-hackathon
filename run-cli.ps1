# Kite CLI Runner Script for Windows
# This script starts the TypeScript backend and Go CLI

Write-Host "🚀 Starting Kite CLI..." -ForegroundColor Green

# Function to cleanup on exit
function Cleanup {
    Write-Host "🛑 Shutting down..." -ForegroundColor Yellow
    if ($BackendProcess -and !$BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force
    }
    exit 0
}

# Set up signal handlers
Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

# Check if we're in the right directory
if (!(Test-Path "kite/package.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Check if Go is installed
if (!(Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Go is not installed. Please install Go 1.21+" -ForegroundColor Red
    exit 1
}

# Check if bun is installed
if (!(Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Bun is not installed. Please install Bun" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Blue

# Install TypeScript dependencies
Set-Location kite
bun install
Set-Location ..

# Install Go dependencies
Set-Location tui
go mod tidy
Set-Location ..

Write-Host "🔧 Starting TypeScript backend..." -ForegroundColor Blue

# Start the TypeScript backend in the background
Set-Location kite
$BackendProcess = Start-Process -FilePath "bun" -ArgumentList "run", "api:dev" -PassThru -WindowStyle Hidden
Set-Location ..

# Wait a moment for the backend to start
Start-Sleep -Seconds 3

# Check if backend is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend is running on http://localhost:3001" -ForegroundColor Green
    } else {
        throw "Backend not responding"
    }
} catch {
    Write-Host "❌ Error: Backend failed to start. Check the logs above." -ForegroundColor Red
    Cleanup
}

Write-Host "🎨 Starting Go CLI..." -ForegroundColor Blue

# Start the Go CLI
Set-Location tui
go run main.go
Set-Location ..

# Cleanup when CLI exits
Cleanup
