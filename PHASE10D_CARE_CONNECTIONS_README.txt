EyeCare AI / DR Healthcare
PHASE 10D - COMPLETE DOCTOR <-> PATIENT CARE CONNECTION SYSTEM
Replacement patch - September 2026
=====================================================================

PATCH BASIS
-----------
This patch is built for the current EyeCare AI architecture after:
- Phase 1-8 application work
- RAG + English/Urdu Voice
- Phase 10A centralized authorization / clinical access controls
- Phase 10B Light/Dark/Eye-Friendly theme + stability fixes
- Phase 10C SuperAdmin + provider verification

It DOES NOT create a new application. It extends the current project and keeps:
- FastAPI backend on port 8001
- Expo frontend on port 8081
- MongoDB / GridFS
- current Patient / Doctor / Hospital / SuperAdmin roles
- Phase 10A require_patient_access() authorization
- Phase 10C VerifiedProviderChecker()
- current medication, reports, screening, appointments and RAG data

INSTALLATION
------------
1. Back up your current project folder.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. DO NOT delete or replace backend/.env.
5. No new pip package is required.
6. No new npm package is required.

Recommended backend/.env values after Phase 10D:

   ENFORCE_PROVIDER_VERIFICATION=true
   REQUIRE_PATIENT_CONNECTION=true
   ALLOW_LEGACY_CLINICAL_RELATIONSHIPS=false

See backend/.env.phase10d.example.

WHAT PHASE 10D ADDS
-------------------
1. Formal canonical MongoDB relationship

   care_connections

   Final statuses:
   - pending
   - accepted
   - declined
   - revoked
   - blocked

   New requests after a declined/revoked relationship reuse the same formal
   relationship record rather than creating duplicate active relationships.
   Every transition is appended to a relationship history array.

2. New centralized care-connection backend

   NEW: backend/connection_service.py
   NEW: backend/routers/connections.py

   API:
   GET    /api/connections
   GET    /api/connections/requests
   GET    /api/connections/directory?q=...
   GET    /api/connections/directory/{targetId}
   POST   /api/connections/request
   PATCH  /api/connections/{id}/accept
   PATCH  /api/connections/{id}/decline
   PATCH  /api/connections/{id}/cancel
   PATCH  /api/connections/{id}/revoke
   PATCH  /api/connections/{id}/block
   PATCH  /api/connections/{id}/unblock

   Compatibility endpoints/functions remain for older frontend behavior, but
   records are never deleted just to "remove" a care relationship.

3. Patient -> Doctor flow

   Patient
     -> Find Doctor
     -> ONLY verified + active doctors are shown
     -> View verified doctor profile
     -> Connect with Doctor
     -> pending request
     -> Doctor accepts
     -> accepted care connection
     -> Phase 10A clinical authorization becomes active

4. Doctor -> Patient flow

   Verified Doctor
     -> Find Patient
     -> ONLY basic directory identity is returned
     -> Send Care Request
     -> Patient accepts
     -> accepted care connection
     -> Doctor may open protected patient clinical routes

   Before acceptance the directory does NOT return diagnoses, reports, HbA1c,
   medication, retinal images, email, mobile number or other clinical content.

5. Verified doctor enforcement

   Phase 10D does not merely hide unverified doctors in the UI.
   Backend connection actions check Phase 10C verification as well.

   A pending/rejected/suspended/disabled doctor cannot use the formal care
   connection workflow to gain clinical access.

6. Duplicate request protection

   Existing accepted relationship -> 409 Already connected
   Existing pending request        -> 409 Request already pending
   Blocked relationship            -> 403 Relationship blocked
   Declined/revoked                -> may be requested again

7. Requests workflow

   Incoming:
   - Accept
   - Decline
   - Block

   Outgoing:
   - Cancel Request

   `declined` is the final Phase 10D name. The hidden `/reject` compatibility
   endpoint maps old behavior to `declined`.

8. Connection removal is NON-DESTRUCTIVE

   Remove Connection -> status = revoked

   It does NOT delete:
   - appointments
   - prescriptions
   - reports
   - patient_history
   - completed encounters when Phase 10F is added
   - the connection transition history itself

   After revocation the Doctor loses general ongoing access because Phase 10A
   only authorizes accepted connections.

9. Block / Unblock handling

   Either participant can block a relationship.
   A blocked pair is hidden from normal directory search.
   Only the account that created the block can unblock it.
   Unblock returns the relationship to revoked (not automatically accepted),
   so a fresh request/approval is required.

10. Patient care-team UI

    Patient sidebar now includes:

       My Care Team

    Connected doctor cards show:
    - name
    - Verified badge
    - specialization
    - hospital/clinic when available
    - connected-since date
    - View Profile
    - Book Appointment
    - Remove Connection

11. Doctor connected-patient UI

    Doctor sees:
    - connected patients
    - connected-since date
    - last visit when available
    - next appointment when available
    - Open Patient
    - Remove Connection

    The Open Patient action is only shown from an accepted relationship.
    The protected patient endpoint still independently enforces authorization.

12. Safe patient directory

    The older Doctor Search Patient screen previously encouraged opening a
    patient chart directly. It now uses the formal care-directory workflow.

    Before acceptance it intentionally exposes only basic directory identity.

13. Verified Doctor Profile fixed

    The Patient Doctor Profile now loads through a dedicated connection
    directory endpoint instead of incorrectly treating a directory-search
    response as a profile.

    It can show:
    - verified status
    - specialization
    - hospital/clinic
    - experience
    - qualification
    - Connect / Pending / Connected state

    Book Appointment appears as a direct action only after acceptance.

14. Appointment integration hardened

    The frontend already selected accepted doctors for booking. Phase 10D now
    also enforces this on the backend:

       POST /api/appointments

    requires an accepted Doctor <-> Patient care connection.

    Therefore a manual API call cannot bypass patient approval.

    The booking screen also accepts a doctorId from My Care Team / Doctor
    Profile and now generates upcoming dates dynamically instead of keeping
    stale hard-coded dates.

15. Connection notifications

    Both parties receive meaningful in-app notifications for:
    - request sent / received
    - accepted
    - declined
    - cancelled
    - revoked
    - blocked

    Tapping a `connection` notification routes Patient -> My Care Team and
    Doctor -> My Patients.

16. Phase 10A integration

    The existing access_control.py already authorizes accepted records from
    `care_connections`. Phase 10D now supplies the real official workflow that
    creates and updates those records.

    Trust chain:

       Verified Doctor
            +
       Patient approval
            |
            v
       Accepted care connection
            |
            v
       require_patient_access(...)
            |
            v
       Authorized clinical endpoint + access log

17. Legacy compatibility

    `care_connections` is canonical for new Phase 10D writes.

    If an older `connections` record exists, Phase 10D can still read it for
    migration safety. When a status-changing action is performed, the legacy
    relationship is materialized into `care_connections` while the original is
    left intact so historical references are not destroyed.

DATABASE / INDEX CHANGES
------------------------
care_connections:
- patientId + doctorId
- patientId + providerId
- status + updatedAt
- requestedByUserId + status
- new databases attempt a unique patientId + doctorId pair index

Existing databases that already have the old Phase 10A non-unique pair index
continue to work safely. Startup will not fail simply because that older index
already exists.

users:
- role + verificationStatus + accountStatus + name
  for provider directory lookup support

SECURITY TEST ORDER
-------------------
A. VERIFIED DOCTOR VISIBILITY
1. Login as Patient.
2. Open My Care Team.
3. Search doctors.
4. Expected: only verified + active doctors appear.

B. PATIENT -> DOCTOR REQUEST
1. Patient sends a request.
2. Patient sees it under Outgoing Requests.
3. Doctor receives notification + Incoming Request.
4. Doctor accepts.
5. Both now see Connected.

C. DOCTOR -> PATIENT REQUEST
1. Login as verified Doctor.
2. Find patient.
3. Confirm search result shows only basic identity.
4. Send request.
5. Patient accepts.
6. Doctor can now open Patient Clinical Profile.

D. ACCESS CONTROL BEFORE / AFTER ACCEPTANCE
Before acceptance:
   GET /api/patients/{patientId}
   -> 403 Accepted patient care connection required

After acceptance:
   same protected request
   -> succeeds
   -> Phase 10A clinical_access_logs records meaningful access

E. DUPLICATE PROTECTION
- send same pending request twice -> 409
- request already connected doctor -> 409

F. REVOKE
1. Patient removes doctor.
2. relationship becomes revoked.
3. historical appointments/reports/etc. remain.
4. doctor protected patient read -> 403 again.

G. APPOINTMENT
1. Connected Patient -> booking succeeds.
2. Unconnected Patient manual POST /api/appointments -> 403.

H. BLOCK
1. Block a relationship.
2. Pair disappears from normal directory search.
3. blocked relationship appears in Blocked Relationships.
4. only blocker can unblock.
5. unblock -> revoked; a fresh request is required.

I. NOTIFICATIONS
Tap a care-connection notification:
- Patient -> /connections
- Doctor  -> /doctor/connections

RUN
---
Backend:

   cd "F:\Fyp retinopathy\backend"
   .\.venv\Scripts\Activate.ps1
   .\run-local-8001.ps1

Frontend:

   cd "F:\Fyp retinopathy\frontend"
   .\run-web-8081.ps1

The frontend script already clears Expo/Metro cache.

FILES ADDED / UPDATED
---------------------
NEW
- backend/connection_service.py
- backend/routers/connections.py
- backend/.env.phase10d.example
- PHASE10D_CARE_CONNECTIONS_README.txt
- PHASE10D_PATCH_MANIFEST.txt

UPDATED
- backend/main.py
- backend/database.py
- backend/routers/appointments.py
- frontend/services/connections.ts
- frontend/components/ConnectionScreen.tsx
- frontend/app/doctor-profile.tsx
- frontend/app/doctor/search-patient.tsx
- frontend/app/book-appointment.tsx
- frontend/services/notification.ts
- frontend/app/notifications.tsx
- frontend/design/components/AppShell.tsx

NO DATA DELETION
----------------
This patch does not delete existing clinical records, reports, prescriptions,
appointments, RAG sessions, provider verification records, GridFS files or
historical care relationships.

NEXT PHASE
----------
Phase 10E - Patient Privacy Center + Digital Health Card + Secure QR
can now safely build on:
- verified provider identity
- formal patient approval
- accepted care connections
- Phase 10A access logging
