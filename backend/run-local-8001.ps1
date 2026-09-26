$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$port = 8001
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if ($existing) {
    Write-Host ""
    Write-Host "Port $port is already in use." -ForegroundColor Red
    Write-Host "Run this to see the process:" -ForegroundColor Yellow
    Write-Host "  Get-NetTCPConnection -LocalPort $port -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess"
    Write-Host "Then inspect it with:"
    Write-Host "  Get-Process -Id <PID>"
    exit 1
}

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "Backend virtual environment not found at .\.venv" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting FastAPI on http://127.0.0.1:$port" -ForegroundColor Green
Write-Host "Health check: http://127.0.0.1:$port/health" -ForegroundColor Cyan
Write-Host ""

& ".\.venv\Scripts\python.exe" -m uvicorn main:app --reload --host 127.0.0.1 --port $port
