# pnpm Installation & Troubleshooting Guide

## **ROOT CAUSE IDENTIFIED**

### **Issue 1: Command Typo**
- **Error**: `npnm is not recognized as a command`
- **Cause**: Typo - should be `pnpm` not `npnm`

### **Issue 2: PowerShell Execution Policy**
- **Error**: Scripts disabled on system
- **Cause**: Default PowerShell security policy

### **Issue 3: SQLite3 Native Dependencies**
- **Error**: Could not locate the bindings file
- **Cause**: Missing Visual Studio Build Tools for native compilation

---

## **SOLUTIONS**

### **1. CORRECT COMMAND USAGE**

#### **Navigate to Project Directory**
```powershell
cd C:\Users\SUN\CascadeProjects\ai-voice-chat-backend
```

#### **Install Dependencies with pnpm**
```powershell
# Method 1: With execution policy bypass
powershell -ExecutionPolicy Bypass -Command "pnpm install"

# Method 2: Set execution policy permanently
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
pnpm install
```

#### **Verify pnpm Installation**
```powershell
powershell -ExecutionPolicy Bypass -Command "pnpm --version"
```

---

### **2. SQLITE3 COMPILATION FIX**

#### **Option A: Use Prebuilt SQLite3 (Recommended)**
```powershell
# Clear node_modules and reinstall
Remove-Item -Recurse -Force node_modules
powershell -ExecutionPolicy Bypass -Command "pnpm install --ignore-scripts"
powershell -ExecutionPolicy Bypass -Command "pnpm install sqlite3@5.1.7 --save"
```

#### **Option B: Install Visual Studio Build Tools**
```powershell
# Install Visual Studio Build Tools 2019 or later
# Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

# Then rebuild
powershell -ExecutionPolicy Bypass -Command "pnpm rebuild sqlite3"
```

#### **Option C: Use Alternative Database (Quick Fix)**
```powershell
# Switch to better-sqlite3 (easier to install)
powershell -ExecutionPolicy Bypass -Command "pnpm remove sqlite3"
powershell -ExecutionPolicy Bypass -Command "pnpm add better-sqlite3"
```

---

### **3. STEP-BY-STEP WORKING FLOW**

#### **Step 1: Navigate to Project**
```powershell
cd C:\Users\SUN\CascadeProjects\ai-voice-chat-backend
```

#### **Step 2: Clean Installation**
```powershell
# Remove existing node_modules if present
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# Install with pnpm
powershell -ExecutionPolicy Bypass -Command "pnpm install --ignore-scripts"
```

#### **Step 3: Handle SQLite3**
```powershell
# Try installing sqlite3 without build
powershell -ExecutionPolicy Bypass -Command "pnpm add sqlite3@5.1.7 --ignore-scripts"

# Or use better-sqlite3 alternative
# powershell -ExecutionPolicy Bypass -Command "pnpm add better-sqlite3"
```

#### **Step 4: Start Server**
```powershell
powershell -ExecutionPolicy Bypass -Command "pnpm start"
```

---

### **4. COPY-PASTE READY COMMANDS**

#### **Complete Setup (One-Liner)**
```powershell
cd C:\Users\SUN\CascadeProjects\ai-voice-chat-backend; Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue; powershell -ExecutionPolicy Bypass -Command "pnpm install --ignore-scripts"; powershell -ExecutionPolicy Bypass -Command "pnpm add better-sqlite3"; powershell -ExecutionPolicy Bypass -Command "pnpm start"
```

#### **Test Server Health**
```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Uri http://localhost:4000/health -Method GET"
```

---

### **5. COMMON MISTAKES & FIXES**

#### **Mistake 1: Wrong Directory**
```powershell
# Wrong
cd C:\Users\SUN
pnpm install

# Correct
cd C:\Users\SUN\CascadeProjects\ai-voice-chat-backend
pnpm install
```

#### **Mistake 2: Command Typo**
```powershell
# Wrong
npnm install

# Correct
pnpm install
```

#### **Mistake 3: Missing Execution Policy**
```powershell
# Wrong (will fail)
pnpm install

# Correct
powershell -ExecutionPolicy Bypass -Command "pnpm install"
```

#### **Mistake 4: SQLite3 Build Issues**
```powershell
# If sqlite3 fails, use better-sqlite3
powershell -ExecutionPolicy Bypass -Command "pnpm remove sqlite3"
powershell -ExecutionPolicy Bypass -Command "pnpm add better-sqlite3"
```

---

### **6. ALTERNATIVE APPROACHES**

#### **Use npm Instead (Fallback)**
```powershell
cd C:\Users\SUN\CascadeProjects\ai-voice-chat-backend
npm install
npm start
```

#### **Use yarn (Alternative)**
```powershell
cd C:\Users\SUN\CascadeProjects\ai-voice-chat-backend
yarn install
yarn start
```

---

### **7. VERIFICATION COMMANDS**

#### **Check pnpm Version**
```powershell
powershell -ExecutionPolicy Bypass -Command "pnpm --version"
```

#### **Check Node Version**
```powershell
node --version
```

#### **Check Project Dependencies**
```powershell
powershell -ExecutionPolicy Bypass -Command "pnpm list"
```

#### **Test API Endpoint**
```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Uri http://localhost:4000/health -Method GET"
```

---

### **8. FINAL SUCCESSFUL RUN FLOW**

```powershell
# Step 1: Navigate to project
cd C:\Users\SUN\CascadeProjects\ai-voice-chat-backend

# Step 2: Clean install
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# Step 3: Install dependencies
powershell -ExecutionPolicy Bypass -Command "pnpm install --ignore-scripts"

# Step 4: Replace sqlite3 if needed
powershell -ExecutionPolicy Bypass -Command "pnpm remove sqlite3"
powershell -ExecutionPolicy Bypass -Command "pnpm add better-sqlite3"

# Step 5: Start server
powershell -ExecutionPolicy Bypass -Command "pnpm start"

# Step 6: Verify server is running (in new terminal)
powershell -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Uri http://localhost:4000/health -Method GET"
```

---

## **EXPECTED OUTPUT**

### **Successful Installation**
```
Packages: +500
Done in 30s using pnpm v10.33.2
```

### **Successful Server Start**
```
> ai-voice-chat-backend@1.0.0 start
> node server.js

Server running on port 4000
Environment: development
```

### **Successful Health Check**
```json
{
  "status": "ok",
  "timestamp": "2026-04-29T15:48:24.331Z"
}
```

---

## **TROUBLESHOOTING SUMMARY**

1. **Command Typo**: Use `pnpm` not `npnm`
2. **Execution Policy**: Use `powershell -ExecutionPolicy Bypass`
3. **SQLite3 Issues**: Use `better-sqlite3` instead
4. **Directory**: Ensure you're in the correct project folder
5. **Dependencies**: Clean install with `--ignore-scripts`

**The project should now run successfully using pnpm!**
