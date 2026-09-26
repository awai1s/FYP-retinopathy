EyeCare AI / DR Healthcare
PHASE 10C — SUPERADMIN + PROVIDER VERIFICATION
Complete replacement patch
Prepared: September 2026
======================================================================

PATCH BASIS
-----------
This patch was built on top of the current EyeCare AI project state after:
- Phases 1–8 application work
- Bilingual RAG + English/Urdu Voice Assistant
- Phase 10A Security / Authorization / Clinical Access Foundation
- Phase 10B Global Theme / Dark-Light / Eye-Friendly Mode
- Phase 10B web Proxy hotfix
- Phase 10B stability / contrast / encoding / backend fix

It is a replacement patch, NOT a new project. It preserves the current:
- FastAPI + MongoDB Atlas + GridFS backend
- Expo SDK 54 + React Native + TypeScript frontend
- backend port 8001 / frontend port 8081 local setup
- Phase 10A patient-access rules
- Phase 10B appearance/accessibility work
- RAG/voice, medication, analytics, reports, appointments and screening flows

INSTALLATION
------------
1. Back up your current project folder.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. DO NOT replace or delete your real backend/.env.
5. No new pip package is required.
6. No new npm package is required.

IMPORTANT SECURITY FLAG
-----------------------
Phase 10A originally kept provider verification disabled while Phase 10C did
not yet exist. Phase 10C is now implemented and config.py defaults to:

   ENFORCE_PROVIDER_VERIFICATION=true

If you previously copied this line into backend/.env:

   ENFORCE_PROVIDER_VERIFICATION=false

change it to:

   ENFORCE_PROVIDER_VERIFICATION=true

or remove the old line so the secure default is used.

See backend/.env.phase10c.example for the non-secret Phase 10C settings.

======================================================================
1. WHAT PHASE 10C ADDS
======================================================================

A. NEW SUPERADMIN ROLE
----------------------
A new role now exists:

   SuperAdmin

SuperAdmin is NOT accepted by the normal signup API model and is NOT shown in
the signup role selector. A patient cannot self-promote through the profile role
endpoint either.

The first SuperAdmin is created manually with the secure bootstrap script:

   backend/seed_superadmin.py

The script uses getpass, so the password is not placed in shell history.

B. PROVIDER VERIFICATION STATES
-------------------------------
Doctor and Hospital accounts now have two independent states:

verificationStatus:
   pending
   under_review
   needs_changes
   verified
   rejected

accountStatus:
   active
   suspended
   disabled

These states are deliberately independent.

Examples:
   verified + active     -> provider may use protected clinical APIs
   verified + suspended  -> clinical access denied
   pending + active      -> can login, complete profile/verification, but no clinical access
   rejected + active     -> can login to see status, but no clinical access
   any + disabled        -> login/current authenticated access denied

A provider cannot self-reactivate a suspended account by editing or resubmitting
verification. Only a SuperAdmin account-status decision can reactivate it.

C. PROVIDER SIGNUP / LEGACY MIGRATION
-------------------------------------
New Doctor/Hospital signup now creates:

   verificationStatus = pending
   accountStatus = active
   provider_verifications record

Email OTP verification and professional provider verification are separate.

Existing Doctor/Hospital accounts from before Phase 10C are migrated safely at
backend startup. Missing verification records are created as pending. The
migration NEVER automatically approves a legacy provider.

D. LIMITED PROVIDER EXPERIENCE
------------------------------
Pending / under-review / needs-changes / rejected / suspended providers can
still access the non-clinical areas required to manage their account:

Doctor:
   Dashboard
   Profile
   Provider Verification
   Notifications
   Appearance / Accessibility

Hospital:
   Dashboard
   Profile
   Provider Verification
   Notifications
   Appearance / Accessibility

Their dashboards display a clear verification banner and do not call protected
clinical dashboard APIs while restricted.

The Doctor/Hospital route layouts also redirect restricted providers away from
clinical sub-routes if they try to open them manually in the frontend.

Most importantly, the backend still performs the real enforcement, so manually
calling a protected API does NOT bypass the restriction.

E. VERIFIED PROVIDER BACKEND DEPENDENCY
---------------------------------------
backend/dependencies.py now contains:

   VerifiedProviderChecker()

Protected Doctor/Hospital APIs use the Phase 10A authorization layer through
require_verified_provider(), and key clinical endpoints also use the FastAPI
VerifiedProviderChecker dependency.

Normal protected behavior:

   pending doctor
      -> POST /api/doctor/prescriptions
      -> HTTP 403 Provider verification required

   verified + active doctor
      -> provider verification gate passes
      -> Phase 10A patient-connection authorization is still checked

Provider verification does NOT replace patient consent/connection checks.

F. PROVIDER VERIFICATION WORKSPACE
----------------------------------
NEW frontend route:

   /provider-verification

Doctor form supports:
- Full Name
- CNIC / identity information (optional)
- Medical License Number
- Licensing Authority
- Specialization
- Qualification
- Years of Experience
- License Issue Date
- License Expiry Date
- Current Hospital / Clinic (optional)
- Phone
- Address

Doctor required documents:
- Medical License
- Identity Proof
- Degree / Qualification
- Optional supporting documents

Hospital form supports:
- Hospital Name
- Registration Number
- Facility Type
- Address
- City
- Official Email
- Phone
- Responsible Contact Person
- Registration Authority
- Registration Expiry (optional)

Hospital required documents:
- Hospital Registration Proof
- Facility License
- Optional supporting documents

Where possible, common account/profile values are prefilled to reduce repeated
entry.

G. VERIFICATION DOCUMENT SECURITY
---------------------------------
Provider evidence is stored with the existing GridFS architecture. Phase 10A's
upload hardening is reused, so verification uploads accept only supported
JPEG/PNG/PDF files that pass MIME/extension/signature/size checks.

Provider document download is owner-protected.
SuperAdmin document download is role-protected and checks that the requested
GridFS file belongs to the verification record being reviewed.

Replacing a required provider document removes the previous GridFS object for
that document type so stale copies are not left behind by the normal UI flow.

H. SUBMISSION WORKFLOW
----------------------
Provider can edit while:

   pending
   needs_changes

Provider cannot silently change professional evidence while:

   under_review
   verified
   rejected

Submission requires every role-specific required field and required document.
Successful submission changes:

   pending / needs_changes -> under_review

The provider's independent accountStatus is preserved. A suspended account does
not become active merely by submitting verification.

A notification is created for each active SuperAdmin:

   New Doctor Verification Request
or
   New Hospital Verification Request

The provider also receives:

   Verification submitted

I. SUPERADMIN DASHBOARD
-----------------------
NEW routes:

   /superadmin/dashboard
   /superadmin/verifications
   /superadmin/verification/[id]
   /superadmin/audit

Dashboard metrics:
- Pending Verification
- Under Review
- Needs Changes
- Verified Providers
- Suspended
- Doctor account count
- Hospital account count

Administration sections:
- Doctors
- Hospitals
- Verification Queue
- Verified Accounts
- Suspended Accounts
- Verification Audit History

The queue can filter by verification status, provider role and account status,
and can search by name, email, license number or registration number.

J. SUPERADMIN REVIEW
--------------------
Review page shows:
- provider identity
- provider role
- current verification status
- current account status
- professional fields
- uploaded evidence
- missing requirements when applicable
- document download
- decision reason box

Supported actions:

   Verify
   Request Changes
   Reject
   Suspend
   Reactivate
   Disable Account

Every action requires a reason.

Verification and account status are separate:
- Verify changes verificationStatus only.
- Request Changes changes verificationStatus only.
- Reject changes verificationStatus only.
- Suspend changes accountStatus only.
- Reactivate changes accountStatus only.
- Disable changes accountStatus only.

Verify is only allowed after the provider has submitted a complete record and it
is under_review. Required information/documents are rechecked on the backend;
the button state alone is not trusted.

K. IMMUTABLE VERIFICATION AUDIT
-------------------------------
NEW collection:

   provider_verification_audit

Every SuperAdmin decision records:
- verificationId
- provider userId
- provider role
- decision
- reviewerId
- reason
- previous verification status
- new verification status
- previous account status
- new account status
- timestamp

There are no update/delete endpoints for this history in Phase 10C.

L. PROVIDER + SUPERADMIN NOTIFICATIONS
--------------------------------------
Provider receives an in-app notification for:
- verification approved
- changes requested
- verification rejected
- account suspended
- account reactivated
- account disabled

The decision email is also attempted using the project's existing Gmail API /
SMTP infrastructure. Email delivery is best-effort: if email is temporarily
unavailable, the already-committed SuperAdmin decision is NOT rolled back.

The shared Notifications screen now detects Patient / Doctor / Hospital /
SuperAdmin role instead of hardcoding the Patient shell. Verification
notifications use the shield icon and navigate to the appropriate provider or
SuperAdmin verification page.

M. SUPERADMIN DOCUMENT DOWNLOAD
--------------------------------
Verification evidence can be downloaded on Expo Web and on native Expo targets.
Native download uses the existing expo-file-system / expo-sharing dependencies;
no new package is added.

======================================================================
2. NEW BACKEND API CONTRACT
======================================================================

Provider (Doctor/Hospital):

GET    /api/provider-verification/status
PUT    /api/provider-verification/details
POST   /api/provider-verification/documents/{document_type}
DELETE /api/provider-verification/documents/{file_id}
GET    /api/provider-verification/documents/{file_id}/download
POST   /api/provider-verification/submit

SuperAdmin:

GET  /api/superadmin/dashboard
GET  /api/superadmin/verifications
GET  /api/superadmin/verifications/{verification_id}
GET  /api/superadmin/verifications/{verification_id}/documents/{file_id}/download
POST /api/superadmin/verifications/{verification_id}/decision
GET  /api/superadmin/audit

======================================================================
3. NEW / UPDATED DATABASE LAYER
======================================================================

provider_verifications
- one canonical provider review record per normal Phase 10C flow
- status + account status
- details
- GridFS document references
- submission/review metadata

provider_verification_audit
- immutable SuperAdmin decision events

Additional indexes are created for:
- provider verification status + updatedAt
- provider role + status
- provider account status + updatedAt
- audit timestamp
- audit provider userId + timestamp
- audit verificationId + timestamp

The existing users collection mirrors verificationStatus/accountStatus so login,
navigation and authorization can make fast decisions while the full professional
record remains in provider_verifications.

======================================================================
4. CREATE THE FIRST SUPERADMIN
======================================================================

Do this AFTER extracting the patch and while your normal backend .env still has
your MongoDB connection configured.

PowerShell:

   cd "F:\Fyp retinopathy\backend"
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   .\.venv\Scripts\Activate.ps1
   python seed_superadmin.py --email your-admin-email@example.com --name "EyeCare Admin"

The script asks for the password twice without echoing it.
Minimum password length: 12 characters.

Example result:

   SuperAdmin created successfully.

If that exact email already belongs to a SuperAdmin and you intentionally need
to rotate the password:

   python seed_superadmin.py --email your-admin-email@example.com --name "EyeCare Admin" --reset-password

The script refuses to promote an existing Patient/Doctor/Hospital email into
SuperAdmin. Use a dedicated admin email instead.

======================================================================
5. RUN THE EXISTING PROJECT
======================================================================

Backend:

   cd "F:\Fyp retinopathy\backend"
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   .\run-local-8001.ps1

Frontend:

   cd "F:\Fyp retinopathy\frontend"
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   .\run-web-8081.ps1

Existing local URLs stay:

   Backend:  http://127.0.0.1:8001
   Frontend: http://localhost:8081

======================================================================
6. RECOMMENDED FUNCTIONAL TEST ORDER
======================================================================

A. HEALTH / SECURITY FLAG
1. Open http://127.0.0.1:8001/health
2. Confirm provider_verification_enforced is true.
3. Keep require_patient_connection true for the secure Phase 10A state.

B. NEW DOCTOR
1. Register a Doctor normally.
2. Verify email OTP.
3. Login.
4. Expected: Doctor dashboard loads but clinical cards are locked.
5. Sidebar should contain only Dashboard, Profile, Provider Verification,
   Notifications and Appearance.
6. Direct API call to a protected Doctor clinical endpoint -> 403.

C. DOCTOR VERIFICATION
1. Open Provider Verification.
2. Complete all required professional details.
3. Upload Medical License, Identity Proof, Qualification.
4. Save.
5. Submit.
6. Expected status: under_review.
7. Editing is locked while under review.

D. SUPERADMIN
1. Login with the seeded SuperAdmin account.
2. Expected route: /superadmin/dashboard.
3. Open Verification Queue.
4. Open the Doctor request.
5. Review fields and download documents.
6. Enter an admin reason.
7. Press Verify.
8. Expected:
      verificationStatus = verified
      accountStatus remains active
      audit event written
      provider notification written
      best-effort email attempted

E. VERIFIED DOCTOR
1. Reload/login as the approved Doctor.
2. Full Doctor navigation becomes available.
3. Provider-verification gate now passes.
4. Patient-specific APIs STILL obey Phase 10A care-connection rules.

IMPORTANT:
A verified Doctor can still receive:

   403 Accepted patient care connection required

for a patient-specific resource when no accepted care connection exists. That
is correct. Provider verification proves WHO the provider is; Phase 10A/10D
controls WHICH patient they may access.

F. REQUEST CHANGES
1. Submit a Hospital or Doctor verification.
2. SuperAdmin -> Request Changes with a reason.
3. Provider sees needs_changes and the admin note.
4. Provider can edit and upload replacements again.
5. Provider resubmits -> under_review.

G. SUSPENSION INDEPENDENCE
1. Verify a provider.
2. SuperAdmin -> Suspend with reason.
3. Expected state:
      verificationStatus = verified
      accountStatus = suspended
4. Clinical API -> 403.
5. Provider can login and see account/status areas, but not clinical areas.
6. SuperAdmin -> Reactivate.
7. accountStatus returns to active; verification remains verified.

H. DISABLE ACCOUNT
1. SuperAdmin -> Disable Account.
2. Login attempt -> 403 account disabled.
3. An already-issued token also fails get_current_user-protected APIs.
4. SuperAdmin can Reactivate later if required.

I. AUDIT
Open SuperAdmin -> Audit History.
Confirm decision, provider, reviewer, reason, state transition and timestamp are
present. There should be no UI/API to delete historical decision events.

J. SIGNUP SECURITY
Try to send SuperAdmin as role to POST /signup manually.
Expected: validation failure because normal signup accepts only:

   Patient / Doctor / Hospital

======================================================================
7. PHASE 10A + PHASE 10C INTERACTION
======================================================================

Two separate authorization questions now exist:

1. Is this provider legitimate and active?
   -> Phase 10C provider verification

2. May this provider access THIS patient?
   -> Phase 10A patient access / Phase 10D care connection

Both gates are required for protected patient clinical data.

Do not disable Phase 10A authorization just because a provider is verified.

Until Phase 10D creates the final care-connection workflow, the old Phase 10A
transitional bridge still exists if you absolutely need legacy demo relationships:

   ALLOW_LEGACY_CLINICAL_RELATIONSHIPS=true

Use it only temporarily. The secure target remains false.

======================================================================
8. FILES / MODULES ADDED BY PHASE 10C
======================================================================

Backend new:
- backend/verification_service.py
- backend/routers/provider_verification.py
- backend/routers/superadmin.py
- backend/seed_superadmin.py
- backend/.env.phase10c.example

Frontend new:
- frontend/components/ProviderVerificationBanner.tsx
- frontend/app/provider-verification.tsx
- frontend/services/providerVerification.ts
- frontend/services/superadmin.ts
- frontend/app/hospital/profile.tsx
- frontend/app/superadmin/_layout.tsx
- frontend/app/superadmin/dashboard.tsx
- frontend/app/superadmin/verifications.tsx
- frontend/app/superadmin/verification/[id].tsx
- frontend/app/superadmin/audit.tsx

Updated existing security/auth/navigation/provider files are listed in the patch
manifest.

======================================================================
9. VALIDATION PERFORMED WHILE BUILDING THIS PATCH
======================================================================

- Python compileall across backend: PASS
- TypeScript/TSX syntax transpile across 166 source files: PASS, 0 syntax errors
- Relative frontend import resolution scan: PASS, 0 missing relative imports
- Phase 10C state-independence review: PASS
  * verification decisions do not silently reactivate suspended accounts
  * submit does not silently reactivate suspended accounts
- Normal signup model still excludes SuperAdmin: PASS
- SuperAdmin routes have backend RoleChecker protection: PASS
- Provider verification documents have owner/admin authorization checks: PASS
- Verified-provider gate remains separate from Phase 10A patient access: PASS

A full live MongoDB/Expo end-to-end run must still be performed on your local
project because this patch builder does not have your live Atlas database,
credentials or installed project node_modules/virtualenv.

======================================================================
10. NEXT PHASE
======================================================================

After Phase 10C is tested and providers can be verified properly, the next
planned work is Phase 10D: Complete Doctor–Patient Connection System.

That phase will turn the existing connection UI into the canonical care
relationship used by Phase 10A require_patient_access().
