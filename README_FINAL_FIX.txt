FINAL LOCAL API PORT FIX

Why this patch exists
---------------------
The FastAPI source already contains GET /health, but the browser response shown
for 127.0.0.1:8000/health is not FastAPI's response format and the Uvicorn
terminal did not log a GET /health request. That means browser traffic to local
port 8000 is being intercepted/routed somewhere else before it reaches this
FastAPI process.

This patch leaves all Phase 1-8 backend functionality untouched and moves only
the local API endpoint to port 8001.

Files
-----
frontend/.env.local
frontend/services/api.ts
backend/run-local-8001.ps1
frontend/run-web-8081.ps1
verify-backend-8001.ps1

Run
---
1. Extract this ZIP into:
   F:\Fyp retinopathy\

2. Backend:
   cd "F:\Fyp retinopathy\backend"
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   .\run-local-8001.ps1

3. Frontend, in another PowerShell:
   cd "F:\Fyp retinopathy\frontend"
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   .\run-web-8081.ps1

4. Verify:
   cd "F:\Fyp retinopathy"
   powershell -ExecutionPolicy Bypass -File .\verify-backend-8001.ps1

Browser URLs
------------
Backend health: http://127.0.0.1:8001/health
Expo Web:       http://localhost:8081

Expected health response begins with:
{"status":"ok", ...}

No backend Python source files are replaced by this patch.
