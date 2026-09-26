EyeCare AI / DR Healthcare
PHASE 10N — DOCTOR CREDENTIAL & PRIVILEGE MANAGER
Complete replacement patch
Prepared: September 2026

======================================================================
1. PURPOSE
======================================================================
Phase 10N deliberately separates two trust questions:

SUPERADMIN VERIFICATION
  "Is this person a legitimate, currently verified doctor?"

HOSPITAL PRIVILEGE MANAGEMENT
  "What is this verified doctor authorized to do in THIS hospital?"

The patch does NOT create a second independent doctor-license database.
The existing Phase 10C provider_verifications record remains the canonical
source for medical license number, licensing authority, specialization,
qualification, issue/expiry dates, verification status and account status.

Hospital-specific authority is stored separately in:
  hospital_doctor_affiliations
  doctor_privileges

This prevents a hospital from altering a SuperAdmin-verified professional
credential while still allowing each hospital to manage its own staff and
clinical privileges.

======================================================================
2. INSTALLATION
======================================================================
1. Back up the current project.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Keep your current backend/.env.
5. No new pip install is required.
6. No new npm install is required.
7. Restart backend and frontend so MongoDB indexes and Expo routes refresh.

Backend:
  cd "F:\Fyp retinopathy\backend"
  .\.venv\Scripts\Activate.ps1
  .\run-local-8001.ps1

Frontend:
  cd "F:\Fyp retinopathy\frontend"
  .\run-web-8081.ps1

Keep the Phase 10C/10D security configuration enabled:
  ENFORCE_PROVIDER_VERIFICATION=true
  REQUIRE_PATIENT_CONNECTION=true
  ALLOW_LEGACY_CLINICAL_RELATIONSHIPS=false

======================================================================
3. GLOBAL DOCTOR CREDENTIALS — SUPERADMIN OWNED
======================================================================
The global credential remains inside the already-approved provider verification
record. Fields used by Phase 10N include:

  Medical License Number
  Licensing Authority
  Specialization
  Qualification
  License Issue Date
  License Expiry Date
  Verification Status
  Account Status

A hospital can VIEW these fields but cannot modify them.

For an already verified Doctor, the SuperAdmin verification-detail screen now
contains "Global Doctor Credential Maintenance". Changes require an audit
reason and write an immutable doctor_credential_audit event containing the
previous values, new values, reviewer and timestamp.

The patch exposes SuperAdmin endpoints:
  GET   /api/superadmin/doctors/{doctorId}/credentials
  PATCH /api/superadmin/doctors/{doctorId}/credentials

Credential state is derived as:
  valid
  expiring      (license expires within 60 days)
  expired
  unverified
  inactive_account

A verified doctor whose account is suspended/disabled is NOT considered an
active usable credential.

======================================================================
4. HOSPITAL–DOCTOR AFFILIATION
======================================================================
New operational collection:
  hospital_doctor_affiliations

Core record:
  hospitalId
  doctorId
  department
  position
  status = active | inactive | ended
  joinedAt
  createdAt
  updatedAt

A hospital can search only verified + active Doctors with a current credential
and create an affiliation. Typical values:

  Department: Ophthalmology
  Position: Consultant

Uniqueness:
  hospitalId + doctorId

The same doctor may therefore be affiliated with more than one hospital, while
only one affiliation exists for that doctor within a particular hospital.

Pausing or ending an affiliation immediately revokes that hospital's active
privileges. Historical affiliation and privilege records are retained.

======================================================================
5. HOSPITAL PRIVILEGES
======================================================================
New operational collection:
  doctor_privileges

FYP-sized catalogue:
  general_eye_consultation
  retinal_examination
  fundus_image_review
  oct_review
  laser_procedure
  surgical_procedure

Each granted privilege stores:
  hospitalId
  doctorId
  privilege
  status
  grantedBy
  grantedAt
  expiresAt (optional)
  revokedBy / revokedAt
  updatedAt

Unique:
  hospitalId + doctorId + privilege

Hospital UI displays friendly names:
  General Eye Consultation
  Retinal Examination
  Fundus Image Review
  OCT Review
  Laser Procedure
  Surgical Procedure

A hospital can grant/revoke a privilege and optionally give it an expiry date.
An expired privilege becomes ineffective automatically even if its stored DB
status was still "active".

Every grant/update/revocation writes an immutable doctor_privilege_audit event.

======================================================================
6. HOSPITAL UI
======================================================================
Hospital navigation now includes:
  Doctors & Privileges

The screen provides:
  - Active Doctor count
  - License expiry alerts (within 60 days)
  - Expired license count
  - Privilege expiry alerts (within 30 days)
  - Expired privilege count
  - Current affiliated doctors
  - Search verified Doctors
  - Add hospital affiliation

Doctor detail page contains:

  DOCTOR CREDENTIALS
  Dr. Ahmed Khan  ✓ Verified
  Consultant Ophthalmologist

  GLOBAL DOCTOR CREDENTIAL
  [SUPERADMIN MANAGED]
  License Number
  Licensing Authority
  Specialization
  Qualification
  Issue Date
  Expiry Date

  HOSPITAL AFFILIATION
  Department
  Position
  Joined Date

  HOSPITAL PRIVILEGES
  ✓ General Eye Consultation
  ✓ Retinal Examination
  ✓ Fundus Image Review
  ✓ OCT Review
  ○ Laser Procedure
  ○ Surgical Procedure

A hospital cannot grant privileges when:
  - affiliation is inactive/ended
  - doctor is not globally verified
  - doctor account is not active
  - medical license is expired

======================================================================
7. DOCTOR UI
======================================================================
Doctor navigation now includes:
  Hospital Privileges

This is read-only from the Doctor side. A Doctor can see:
  - global credential/license state
  - hospital affiliations
  - department/position
  - active/expired/revoked hospital privileges
  - privilege expiry dates

Doctors cannot grant themselves privileges.

Hospital affiliation/privilege changes create in-app notifications for the
Doctor. Privilege notifications open this page.

======================================================================
8. HOSPITAL DASHBOARD ALERTS
======================================================================
The existing Hospital Dashboard now includes a credential/privilege summary:

  Active Doctors
  Licenses ≤60 days
  Expired Licenses
  Privileges ≤30 days
  Expired Privileges

This satisfies the operational alert requirement without creating a separate
scheduled-job service. The values are calculated from authoritative records at
request time so the dashboard cannot become stale because an expiry date passed.

======================================================================
9. CONSULTATION COCKPIT INTEGRATION
======================================================================
Phase 10F consultations now support an optional hospital context.
A Doctor can choose:
  Independent / no hospital context
or
  one of the Doctor's ACTIVE hospital affiliations.

When a hospital context is selected, the backend—not only the UI—requires:
  1. active hospital-doctor affiliation
  2. valid global verified Doctor credential
  3. active General Eye Consultation privilege

Hospital-governed procedure catalogue:
  Retinal Examination  -> retinal_examination
  Fundus Image Review  -> fundus_image_review
  OCT Review           -> oct_review
  Laser Procedure      -> laser_procedure
  Surgical Procedure   -> surgical_procedure

Before autosave and again before COMPLETE VISIT, the backend checks the current
privilege. This means a privilege that expires or is revoked between opening a
consultation and completion cannot be bypassed.

If unavailable the backend returns HTTP 403 with:
  "This procedure is not authorized for your current hospital privileges."

There is also keyword fallback for manually crafted API payloads (laser,
surgical, OCT, fundus, retinal) so simply omitting procedureCode does not bypass
the hospital authority check.

"Other / documentation only" remains available for an ungoverned free-text
entry and does not pretend this FYP privilege catalogue represents every real
ophthalmology procedure.

======================================================================
10. IMPORTANT SECURITY / DATA-OWNERSHIP RULES
======================================================================
- SuperAdmin owns global professional verification.
- Hospital can never rewrite the global verified license from Hospital UI/API.
- Hospital owns only its own affiliation and privileges.
- Doctor cannot self-grant privileges.
- Hospital A cannot manage Hospital B's affiliation/privileges.
- Expired global license blocks new privilege grants and hospital procedures.
- Suspended/disabled Doctor account blocks hospital clinical authority.
- Ending an affiliation revokes active hospital privileges.
- Historical audit records are retained.
- Phase 10A/10D patient care-connection authorization remains separate; hospital
  privilege never grants access to an unrelated Patient record.

======================================================================
11. MONGODB INDEXES
======================================================================
hospital_doctor_affiliations
  UNIQUE hospitalId + doctorId
  hospitalId + status + updatedAt
  doctorId + status + updatedAt

doctor_privileges
  UNIQUE hospitalId + doctorId + privilege
  hospitalId + status + expiresAt
  doctorId + status + expiresAt

doctor_privilege_audit
  hospitalId + doctorId + createdAt
  doctorId + privilege + createdAt

doctor_credential_audit
  doctorId + createdAt
  reviewerId + createdAt

Development databases containing duplicate legacy rows will not prevent startup;
the app falls back to non-unique lookup indexes and logs a warning so duplicates
can be cleaned deliberately rather than crashing the backend.

======================================================================
12. END-TO-END TEST PLAN
======================================================================
A. GLOBAL CREDENTIAL
1. Login as SuperAdmin.
2. Open a VERIFIED Doctor verification record.
3. Confirm Global Doctor Credential Maintenance is visible.
4. Change one allowed credential field + enter an audit reason.
5. Save.
6. Confirm doctor_credential_audit contains previous/current/reviewer/timestamp.

B. HOSPITAL AFFILIATION
1. Login as a verified Hospital.
2. Open Doctors & Privileges.
3. Search the verified Doctor.
4. Add affiliation: Ophthalmology / Consultant.
5. Confirm hospital_doctor_affiliations contains one record.
6. Re-adding the same Doctor must not create a duplicate relationship.

C. PRIVILEGES
1. Open the affiliated Doctor.
2. Grant General Eye Consultation + Retinal Examination + OCT Review.
3. Give OCT Review a future expiry date.
4. Save.
5. Confirm doctor_privileges records and doctor_privilege_audit events.
6. Confirm the Doctor receives a notification and can see the same privileges
   read-only in Hospital Privileges.

D. EXPIRY
1. Use a Doctor whose license expires within 60 days.
2. Hospital Dashboard should show the license-expiry warning.
3. Use a privilege expiring within 30 days.
4. Dashboard should show privilege-expiry warning.
5. An expired privilege must no longer authorize its governed procedure.

E. CONSULTATION ENFORCEMENT
1. Use Doctor + Patient with valid Phase 10D connection and confirmed appointment.
2. Start/continue consultation.
3. Select the hospital affiliation.
4. With OCT Review granted, add OCT Review and save: expected success.
5. Revoke OCT Review from Hospital account.
6. Try saving/completing with OCT Review again: expected HTTP 403.
7. Grant it again and confirm workflow succeeds.
8. Remove General Eye Consultation privilege and confirm hospital-context
   consultation is denied even if a procedure-specific privilege exists.

F. AFFILIATION CLOSED
1. Hospital ends the Doctor affiliation.
2. Active hospital privileges should become revoked.
3. Doctor Hospital Privileges page should show the affiliation ended.
4. Consultation must no longer accept this hospital as an active authority.

G. CROSS-HOSPITAL ISOLATION
1. Login as a different Hospital.
2. Try direct API call using the first hospital's Doctor relationship.
3. Expected: no matching affiliation / access denied.

======================================================================
13. FILES ADDED / UPDATED BY THIS PATCH
======================================================================
NEW BACKEND
  backend/credential_privilege_service.py
  backend/routers/credentials_privileges.py

UPDATED BACKEND
  backend/access_control.py
  backend/consultation_service.py
  backend/database.py
  backend/main.py
  backend/routers/consultations.py
  backend/routers/superadmin.py

NEW FRONTEND
  frontend/app/doctor/privileges.tsx
  frontend/app/hospital/doctors/index.tsx
  frontend/app/hospital/doctors/[doctorId]/index.tsx
  frontend/services/credentialsPrivileges.ts

UPDATED FRONTEND
  frontend/app/doctor/consultation/[id].tsx
  frontend/app/hospital/dashboard.tsx
  frontend/app/notifications.tsx
  frontend/app/superadmin/verification/[id].tsx
  frontend/design/components/AppShell.tsx
  frontend/services/consultations.ts
  frontend/services/notification.ts
  frontend/services/superadmin.ts

No .env file is replaced.
No database secrets are included.

======================================================================
14. NEXT PHASE
======================================================================
Phase 10N completes the planned feature-development sequence before the final
Phase 10O integration, testing and production hardening pass.
