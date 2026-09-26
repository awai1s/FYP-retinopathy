$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Checking backend directly without a proxy..." -ForegroundColor Cyan

$result = & curl.exe --noproxy "*" -i --max-time 10 "http://127.0.0.1:8001/health"

Write-Host $result

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Direct backend check failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "If the response contains HTTP/1.1 200 and status ok, FastAPI is reachable." -ForegroundColor Green
