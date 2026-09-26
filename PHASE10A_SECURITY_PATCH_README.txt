EyeCare AI - Phase 10A Security, Authorization & Clinical Access Foundation
===========================================================================

PATCH BASIS
-----------
This patch was built against the latest EyeCare AI code digest plus the previous
Bilingual RAG + English/Urdu Voice patch structure. It is a replacement patch,
not a new project. It keeps the existing FastAPI + MongoDB + GridFS architecture,
patient/doctor/hospital routes, Phase 1-8 features, RAG assistant, backend port
8001 and frontend port 8081.

INSTALLATION
------------
1. Make a backup of the current project folder.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Do NOT delete your existing backend/.env.
5. No new pip package and no new npm package is required for this phase.

The ZIP contains only the files added/changed by Phase 10A.

WHAT PHASE 10A ADDS
-------------------
1. Central clinical authorization layer
   NEW: backend/access_control.py

   Core functions implemented:
   - require_verified_provider()
   - has_patient_connection()
   - require_patient_access()
   - require_hospital_doctor_affiliation()
   - require_doctor_privilege()
   - record_clinical_access()
   - list_authorized_patient_ids()

   Internal permission scopes include:
   - profile.basic.read
   - profile.clinical.read
   - screening.read
   - screening.image.read
   - reports.read / reports.download / reports.write
   - medications.read / medications.write
   - consultation.read / consultation.write
   - prescription.write
   - health_metrics.read
   - appointments.read
   - ai.patient_context.read

2. Clinical access event foundation
   NEW: backend/access_log_service.py
   NEW MongoDB collection: clinical_access_logs

   Meaningful provider access records:
   - patientId
   - actorUserId
   - actorName
   - actorRole
   - action
   - resourceType
   - resourceId
   - accessChannel
   - scope
   - reason
   - createdAt

   IMPORTANT: the access log stores access metadata only. It does NOT copy the
   medical report text, diagnosis, medications, clinical notes, retinal images,
   HbA1c values, or other viewed clinical content.

3. Connection-based authorization
   Canonical future collection: care_connections
   Compatibility collection also recognized: connections

   Accepted/active provider-patient connection -> clinical access can proceed.
   No accepted connection -> 403 for protected provider-to-patient access.

   Current patient self-access remains unchanged.

4. Provider verification foundation
   provider_verifications indexes and require_verified_provider() are ready.

   IMPORTANT PHASE ORDER RULE:
   Phase 10C is the phase that creates the full SuperAdmin verification workflow.
   Therefore this patch defaults to:

   ENFORCE_PROVIDER_VERIFICATION=false

   This prevents all existing Doctor/Hospital accounts from being locked out
   before Phase 10C has created/approved verification records. Explicitly
   suspended/disabled/rejected provider accounts are still denied.

   After Phase 10C is complete, set:

   ENFORCE_PROVIDER_VERIFICATION=true

5. Existing patient profile exposure fixed
   /api/patients/{patient_id} no longer allows Doctor/Hospital role alone to read
   a patient's full profile. It now uses require_patient_access().

   /api/patients/search remains a directory function, but returns intentionally
   minimal identity instead of returning the full user document.

6. Screening / generated report access hardened
   /api/clinical/summary/patient/{patient_id}/latest
   /api/clinical/summary/{prediction_id}
   /api/clinical/summary/{prediction_id}/download

   Provider access now requires centralized patient authorization and meaningful
   accesses are written to clinical_access_logs.

7. Hospital report/GridFS access hardened
   A Hospital can download its own uploaded report.
   Access to another patient's report requires centralized patient authorization.
   Hospital report upload linked to a patient also requires authorized access.
   File bytes are fetched from GridFS only after route authorization succeeds.

8. Doctor prescription write hardened
   A Doctor cannot create a prescription for an arbitrary patient ID anymore.
   Patient existence + centralized patient authorization are checked first.
   Successful prescription creation writes a CREATE_PRESCRIPTION access event.

9. RAG patient context integrated with Phase 10A
   The AI Assistant no longer treats an appointment/prescription/report alone as
   authorization by default. Doctor/Hospital patient context is obtained through
   the same centralized care-connection authorization layer.

   Patient self-context continues to work.

10. Sensitive development logging removed
    - Authorization header is no longer printed.
    - JWT token is no longer printed.
    - decoded token payload is no longer printed.
    - full user object is no longer printed.
    - OTP values are no longer logged.

11. Safe production errors
    The global 500 handler logs technical details on the server but returns only:

    { "detail": "Internal server error" }

    Database and RAG/report provider failures no longer expose raw exception text
    in the patched routes.

12. Upload hardening
    Existing JPEG/PNG/PDF GridFS uploads now validate:
    - declared MIME type
    - filename extension
    - actual magic bytes/file signature
    - configured maximum size
    - empty file rejection

    Default max size remains 5 MB, so current application behavior is preserved.

13. Production CORS hardening
    Local development remains Expo-friendly.
    Railway/production requires explicit CORS_ORIGINS. If missing, /health reports
    degraded configuration and production CORS does not silently become wildcard.

14. Diagnostic endpoints hardened
    /test-email
    /test-gmail
    /network-test

    remain convenient in local development but are hidden with 404 when
    ENABLE_DIAGNOSTIC_ENDPOINTS=false. Railway defaults to false.

NEW DATABASE INDEXES
--------------------
clinical_access_logs
  - patientId + createdAt
  - actorUserId + createdAt
  - resourceType + resourceId

care_connections + compatibility connections
  - patientId + doctorId
  - patientId + providerId
  - status

provider_verifications
  - userId
  - status

Future authorization foundation also indexes:
  - hospital_doctor_affiliations
  - doctor_privileges

IMPORTANT: STRICT CONNECTION MODE
---------------------------------
Phase 10A deliberately fixes the previous insecure behavior. The default is:

REQUIRE_PATIENT_CONNECTION=true
ALLOW_LEGACY_CLINICAL_RELATIONSHIPS=false

Because Phase 10D has not yet built the final connection backend/workflow, a
Doctor/Hospital without an accepted connection document will receive:

403 Accepted patient care connection required

That is intentional and is the secure Phase 10A state.

If you temporarily need the old demo relationships to work before Phase 10D,
you can copy this ONE transitional setting into backend/.env:

ALLOW_LEGACY_CLINICAL_RELATIONSHIPS=true

In that temporary mode, an existing Doctor appointment/prescription or Hospital
report can act as legacy relationship evidence. Turn it back to false as soon as
Phase 10D formal care connections are available.

Do NOT set REQUIRE_PATIENT_CONNECTION=false except for emergency debugging.

OPTIONAL ENV FILE
-----------------
See:

backend/.env.phase10a.example

It contains only non-secret example flags. Do not overwrite your current .env.

RUN ON THE EXISTING PORTS
-------------------------
Backend:

cd "F:\Fyp retinopathy\backend"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\run-local-8001.ps1

Frontend remains unchanged:

cd "F:\Fyp retinopathy\frontend"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\run-web-8081.ps1

FIRST HEALTH CHECK
------------------
Open:

http://127.0.0.1:8001/health

Check that:
- status is ok locally when DB/config are valid
- require_patient_connection = true
- provider_verification_enforced = false until Phase 10C
- legacy_relationship_bridge = false for strict testing
- diagnostics_enabled is appropriate for the environment

If Railway reports degraded because CORS_ORIGINS is missing, configure the real
frontend origin(s) in Railway environment variables.

FUNCTIONAL SECURITY TEST ORDER
------------------------------
A. PATIENT SELF ACCESS
1. Login as Patient.
2. Dashboard, medication, analytics, uploads, own predictions and own generated
   reports should continue working normally.
3. RAG personal questions should still use the Patient's own authorized context.

B. UNCONNECTED DOCTOR
1. Login as Doctor.
2. Search patient directory -> basic identity search may appear.
3. Open /api/patients/{patientId} for a patient with NO accepted care connection.
4. Expected:

   HTTP 403
   Accepted patient care connection required

5. Try provider clinical summary or creating a prescription for that patient.
6. Expected: 403 again.

C. ACCEPTED CONNECTION
Until Phase 10D supplies the UI/backend flow, this can only be tested if an
accepted connection already exists in care_connections/connections. Expected:

Connected provider
  -> protected clinical endpoint succeeds
  -> clinical_access_logs receives a metadata-only event

D. ACCESS LOG
In MongoDB Atlas inspect clinical_access_logs after a successful provider access.
Expected shape:

{
  patientId: "...",
  actorUserId: "...",
  actorName: "...",
  actorRole: "Doctor" | "Hospital",
  action: "VIEW_PROFILE" | "VIEW_SCREENING" | "DOWNLOAD_REPORT" | ...,
  resourceType: "...",
  resourceId: "...",
  accessChannel: "care_connection",
  scope: "...",
  reason: "accepted_care_connection",
  createdAt: ISODate(...)
}

There must be NO copied clinical payload inside this log.

E. GRIDFS / UPLOAD HARDENING
1. Upload a valid JPEG/PNG/PDF <= 5 MB -> should work.
2. Rename a .txt or executable to .pdf -> should be rejected because its bytes do
   not contain a PDF signature.
3. Upload > configured limit -> 413.

F. PRODUCTION CHECK
On Railway:
- set exact CORS_ORIGINS
- ENABLE_DIAGNOSTIC_ENDPOINTS=false
- keep REQUIRE_PATIENT_CONNECTION=true
- keep ALLOW_LEGACY_CLINICAL_RELATIONSHIPS=false once Phase 10D is available
- set ENFORCE_PROVIDER_VERIFICATION=true after Phase 10C verification data exists

FILES IN THIS PATCH
-------------------
NEW
- PHASE10A_SECURITY_PATCH_README.txt
- backend/access_control.py
- backend/access_log_service.py
- backend/.env.phase10a.example

REPLACED / UPDATED
- backend/config.py
- backend/database.py
- backend/dependencies.py
- backend/main.py
- backend/storage.py
- backend/routers/shared.py
- backend/routers/reports.py
- backend/routers/doctor.py
- backend/routers/hospital.py
- backend/routers/ai_assistant.py

NO FRONTEND FILES ARE REPLACED IN PHASE 10A.
The existing RAG/voice frontend and all Phase 1-8 screens remain untouched.

NEXT PHASE
----------
The secure base is now prepared for Phase 10B (global theme / dark-light /
Eye-Friendly mode), followed by Phase 10C provider verification and Phase 10D
formal Doctor-Patient Connections.
