# FYP retinopathy

EyeCare AI final year project: a FastAPI backend and an Expo/React Native frontend for retinal screening records, patient care, provider workflows, vision tools, and hospital administration.

## Run locally on Windows

Use PowerShell in two terminals. Python 3.11 and Node.js/npm are required.

### Backend

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Fill `MONGODB_URL`, `DATABASE_NAME`, and `SECRET_KEY` in `backend/.env` before starting. Then run:

The example file retains the current mail account settings as requested. Keep this repository private and rotate that mail credential before giving broader access.

```powershell
.\run-local-8001.ps1
```

The backend serves `http://127.0.0.1:8001` and `http://127.0.0.1:8001/health`.

### Frontend

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
.\run-web-8081.ps1
```

Open `http://localhost:8081`. The checked-in `.ps1` scripts use the same ports as the local project setup.

The retinal upload flow saves images and creates pending screening records. Automated retinal classification requires a model and inference worker, which are not part of this repository yet.

## Checks

```powershell
cd frontend
npx tsc --noEmit

cd ..\backend
.\.venv\Scripts\python.exe -m pytest tests -q
```

The backend regression suite uses an in-memory database by default. Set `PHASE10O_REAL_MONGO=1` only when intentionally testing against the dedicated `dr_healthcare_phase10o_test` database.
