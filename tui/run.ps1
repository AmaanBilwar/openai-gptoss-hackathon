# Cerebras GPT-OSS Chat Runner
# Make sure to set your API key in .env file or environment variable

Write-Host "Starting Kite - The Personal Git Assistant..." -ForegroundColor Green

# Ensure we run from the script's directory regardless of where it's invoked
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $scriptDir

# Check if .env file exists (in script directory)
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
    go build -o kite-cli.exe
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Build successful!" -ForegroundColor Green
        Write-Host "Starting chat interface..." -ForegroundColor Blue
        Write-Host ""

        $exePath = Join-Path $scriptDir "kite-cli.exe"
        if (-not (Test-Path $exePath)) {
            Write-Host "Executable not found at $exePath" -ForegroundColor Red
            exit 1
        }

        # Prefer Windows Terminal fullscreen when available
        $wt = Get-Command wt.exe -ErrorAction SilentlyContinue
        if ($wt) {
            Write-Host "Launching Windows Terminal in fullscreen..." -ForegroundColor Green
            # Use wt to run the exe directly to avoid nested PowerShell quoting issues
            Start-Process wt.exe -ArgumentList @(
                '-F',
                '--title', 'Kite',
                '-d', "$scriptDir",
                "$exePath"
            ) | Out-Null
        }
        else {
            # Fallback: run the exe directly, maximized
            Write-Host "Launching app (maximized)..." -ForegroundColor Yellow
            Start-Process -FilePath "$exePath" -WorkingDirectory "$scriptDir" -WindowStyle Maximized | Out-Null
        }
    } else {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
