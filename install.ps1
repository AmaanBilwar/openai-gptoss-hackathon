Write-Host "Installing Kite CLI wrapper..." -ForegroundColor Green

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = $scriptDir
$cmdPath = Join-Path $repoRoot "kite.cmd"

if (-not (Test-Path $cmdPath)) {
  Write-Host "Could not find kite.cmd at $cmdPath" -ForegroundColor Red
  exit 1
}

# Add repo root to user PATH if not already present
$currentUserPath = [Environment]::GetEnvironmentVariable('Path','User')
$pathParts = ($currentUserPath -split ';') | Where-Object { $_ -ne '' }
$isPresent = $pathParts | ForEach-Object { $_.TrimEnd('\') } | Where-Object { $_ -ieq $repoRoot.TrimEnd('\') } | Measure-Object | Select-Object -ExpandProperty Count

if ($isPresent -eq 0) {
  $newPath = if ([string]::IsNullOrWhiteSpace($currentUserPath)) { $repoRoot } else { "$currentUserPath;$repoRoot" }
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  Write-Host "Added to PATH (User): $repoRoot" -ForegroundColor Green
} else {
  Write-Host "PATH already contains: $repoRoot" -ForegroundColor Yellow
}

# Update current session PATH
if (-not ($env:Path -split ';' | Where-Object { $_ -ieq $repoRoot })) {
  $env:Path = "$env:Path;$repoRoot"
}

# Set a session alias for immediate use
Set-Alias -Name kite -Value $cmdPath -Scope Global -Force
Write-Host "Session alias set: kite -> $cmdPath" -ForegroundColor Green

# Optionally persist alias in PowerShell profile
try {
  if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force | Out-Null
  }
  $aliasLine = "Set-Alias -Name kite -Value `"$cmdPath`" -Scope Global -Force"
  $profileContent = Get-Content -Path $PROFILE -ErrorAction SilentlyContinue
  if (-not ($profileContent -match [regex]::Escape($aliasLine))) {
    Add-Content -Path $PROFILE -Value $aliasLine
    Write-Host "Persisted alias to profile: $PROFILE" -ForegroundColor Green
  } else {
    Write-Host "Alias already present in profile" -ForegroundColor Yellow
  }
} catch {
  Write-Host "Could not update PowerShell profile: $_" -ForegroundColor Yellow
}

Write-Host "Done. Open a new terminal or use 'kite run' now in this session." -ForegroundColor Cyan


