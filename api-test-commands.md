# PowerShell API Testing Commands

## **DIAGNOSIS RESULTS**

### **Root Cause Identified:**

- **Backend is running** (health check successful)
- **API endpoint is working** (chat endpoint responds)
- **Issue**: PowerShell command syntax and JSON formatting problems

### **Working Solutions:**

## **1. WORKING POWERSHELL COMMANDS**

### **Method 1: Invoke-RestMethod (Recommended)**

```powershell
# Create JSON body properly
$body = @{
    userId = "test"
    message = "hello"
} | ConvertTo-Json

# Send request
$response = Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
$response
```

### **Method 2: One-liner Command**

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body (@{userId="test"; message="hello"} | ConvertTo-Json) -TimeoutSec 30
```

### **Method 3: Using PowerShell Hashtable**

```powershell
$params = @{
    Uri = "http://localhost:4000/chat"
    Method = "POST"
    ContentType = "application/json"
    Body = @{userId="test"; message="hello"} | ConvertTo-Json
    TimeoutSec = 30
}
Invoke-RestMethod @params
```

## **2. CURL ALTERNATIVE**

### **Windows curl command:**

```powershell
curl -X POST http://localhost:4000/chat -H "Content-Type: application/json" -d "{\"userId\":\"test\",\"message\":\"hello\"}"
```

### **Powerhell curl equivalent:**

```powershell
Invoke-WebRequest -Uri "http://localhost:4000/chat" -Method POST -Headers @{"Content-Type"="application/json"} -Body (@{userId="test"; message="hello"} | ConvertTo-Json)
```

## **3. EXPECTED RESPONSE**

### **Success Response:**

```json
{
    "response": "Great question! Here's what I think...",
    "timestamp": "2026-04-29T15:48:24.331Z"
}
```

### **Error Response:**

```json
{
    "error": "Missing required fields: userId and message",
    "message": "Bad request"
}
```

## **4. DEBUGGING STEPS**

### **Step 1: Verify Backend Health**

```powershell
# Check if server is running
Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET
```

### **Step 2: Check Port Availability**

```powershell
# Check if port 4000 is listening
netstat -an | findstr :4000
```

### **Step 3: Test with Different Methods**

```powershell
# Test GET request first
Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET

# Then test POST with simple body
Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body '{"userId":"test","message":"hello"}' -TimeoutSec 30
```

### **Step 4: Check Server Logs**

```powershell
# View backend server output
# Look for errors in the terminal where server is running
```

## **5. COMMON ISSUES & SOLUTIONS**

### **Issue: "Canceled terminal command"**

**Cause**: Command hanging due to timeout or server not responding
**Solution**: Add timeout parameter

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
```

### **Issue: JSON parsing errors**

**Cause**: Incorrect JSON formatting in PowerShell
**Solution**: Use ConvertTo-Json properly

```powershell
$body = @{userId="test"; message="hello"} | ConvertTo-Json
```

### **Issue: Connection refused**

**Cause**: Backend server not running
**Solution**: Start the server first

```powershell
cd C:\Users\SUN\CascadeProjects\ai-voice-chat-backend
node server.js
```

## **6. IMPROVED REQUEST METHODS**

### **With Error Handling:**

```powershell
try {
    $body = @{
        userId = "test"
        message = "hello"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
    Write-Host "Success: $response" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
}
```

### **With Detailed Logging:**

```powershell
$requestParams = @{
    Uri = "http://localhost:4000/chat"
    Method = "POST"
    ContentType = "application/json"
    Body = @{userId="test"; message="hello"} | ConvertTo-Json
    TimeoutSec = 30
    Verbose = $true
}

Write-Host "Sending request to $($requestParams.Uri)" -ForegroundColor Cyan
$response = Invoke-RestMethod @requestParams
Write-Host "Response received: $response" -ForegroundColor Green
```

## **7. BATCH TESTING SCRIPT**

```powershell
# Test multiple scenarios
$testCases = @(
    @{userId="test"; message="hello"},
    @{userId="test"; message="how are you?"},
    @{userId="test"; message="what can you do?"}
)

foreach ($testCase in $testCases) {
    Write-Host "Testing: $($testCase.message)" -ForegroundColor Yellow
    
    try {
        $body = $testCase | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
        Write-Host "Response: $($response.response)" -ForegroundColor Green
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}
```

## **8. QUICK VERIFICATION COMMANDS**

```powershell
# Quick health check
Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET

# Quick chat test
Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST -ContentType "application/json" -Body (@{userId="test"; message="hello"} | ConvertTo-Json) -TimeoutSec 30

# Check server status
netstat -an | findstr :4000
```

## **SUMMARY**

The main issue was **PowerShell JSON formatting** and **command syntax**. The backend is working correctly. Use the working commands above to successfully test your API endpoints.
