# Working PowerShell script to test the API endpoint

# Method 1: Using Invoke-RestMethod with proper JSON
Write-Host "Testing Method 1: Invoke-RestMethod" -ForegroundColor Green
try {
    $body = @{
        userId = "test"
        message = "hello"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
    Write-Host "Response: $response" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" + "="*50 + "`n"

# Method 2: Using Invoke-WebRequest
Write-Host "Testing Method 2: Invoke-WebRequest" -ForegroundColor Green
try {
    $body = @{
        userId = "test"
        message = "hello"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" + "="*50 + "`n"

# Method 3: Using curl (if available)
Write-Host "Testing Method 3: curl" -ForegroundColor Green
try {
    $curlCommand = 'curl -X POST http://localhost:4000/chat -H "Content-Type: application/json" -d "{\"userId\":\"test\",\"message\":\"hello\"}"'
    $response = Invoke-Expression $curlCommand
    Write-Host "Response: $response" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" + "="*50 + "`n"

# Health check
Write-Host "Testing Health Check" -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET -TimeoutSec 10
    Write-Host "Health Response: $response" -ForegroundColor Green
} catch {
    Write-Host "Health Error: $($_.Exception.Message)" -ForegroundColor Red
}
