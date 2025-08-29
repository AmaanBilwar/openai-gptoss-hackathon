# Cerebras GPT-OSS Chat Runner
# Make sure to set your API key in .env file or environment variable

Write-Host "Starting Kite - The Personal Git Assistant..." -ForegroundColor Green

# Check if .env file exists
if (Test-Path ".env") {
    Write-Host "Found .env file" -ForegroundColor Green
    
    # Load .env file into environment variables
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove surrounding quotes if present
            if ($value -match '^"(.*)"$') {
                $value = $matches[1]
            }
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "Loaded environment variables from .env file" -ForegroundColor Green
} else {
    Write-Host "No .env file found. Creating one from template..." -ForegroundColor Yellow
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-Host "Created .env file from env.example" -ForegroundColor Green
        Write-Host "Please edit .env file and add your CEREBRAS_API_KEY" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "No env.example found. Please create a .env file with your CEREBRAS_API_KEY" -ForegroundColor Red
        exit 1
    }
}

# Check if API key is set (either in .env or environment)
if (-not $env:CEREBRAS_API_KEY) {
    Write-Host "CEREBRAS_API_KEY not found in environment variables" -ForegroundColor Yellow
    Write-Host "Make sure it's set in your .env file" -ForegroundColor Yellow
    Write-Host "Example: CEREBRAS_API_KEY=your_api_key_here" -ForegroundColor Cyan
    exit 1
}

Write-Host "API key found" -ForegroundColor Green

# Build and run
try {
    Write-Host "Building application..." -ForegroundColor Blue
    go build -o cerebras-chat.exe main.go cerebras.go
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Build successful!" -ForegroundColor Green
        Write-Host "Starting chat interface..." -ForegroundColor Blue
        Write-Host ""
        ./cerebras-chat.exe
    } else {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
