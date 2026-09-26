$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$port = 8081
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if ($existing) {
    Write-Host ""
    Write-Host "Port $port is already in use." -ForegroundColor Red
    Write-Host "Stop the old Expo process first, then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Starting Expo Web on http://localhost:$port" -ForegroundColor Green
Write-Host "API configured for backend port 8001." -ForegroundColor Cyan
Write-Host ""

npx expo start --clear --web --port $port
