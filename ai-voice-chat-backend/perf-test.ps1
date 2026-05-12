# Performance Test Script
$body = @{userId="test"; message="hello"} | ConvertTo-Json

# Test 1: Health endpoint
Write-Host "=== Health Endpoint Test ===" -ForegroundColor Cyan
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET -TimeoutSec 10
    $sw.Stop()
    Write-Host "Status: $($response.status)" -ForegroundColor Green
    Write-Host "Response Time: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green
} catch {
    $sw.Stop()
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Time: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Red
}

# Test 2: Chat endpoint
Write-Host "`n=== Chat Endpoint Test ===" -ForegroundColor Cyan
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 60
    $sw.Stop()
    Write-Host "Response: $($response.response.Substring(0, [Math]::Min(80, $response.response.Length)))..." -ForegroundColor Green
    Write-Host "Response Time: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green
} catch {
    $sw.Stop()
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Time: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Red
}

# Test 3: Multiple health checks for average
Write-Host "`n=== Average Response Time (5 requests) ===" -ForegroundColor Cyan
$totalMs = 0
for ($i = 1; $i -le 5; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET -TimeoutSec 10 | Out-Null
        $sw.Stop()
        $totalMs += $sw.ElapsedMilliseconds
        Write-Host "Request $i`: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Yellow
    } catch {
        $sw.Stop()
        Write-Host "Request $i`: FAILED ($($sw.ElapsedMilliseconds)ms)" -ForegroundColor Red
    }
}
$avg = $totalMs / 5
Write-Host "Average: $avg ms" -ForegroundColor Green
