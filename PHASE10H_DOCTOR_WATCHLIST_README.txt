EyeCare AI / DR Healthcare
PHASE 10H — DOCTOR CASE BOOKMARK / WATCHLIST
Complete replacement patch
Prepared: September 2026

======================================================================
1. PURPOSE
======================================================================

Phase 10H adds a private Doctor Case Watchlist on top of the existing Phase
10A–10G architecture. It does NOT create another clinical record system and it
does NOT weaken the Doctor–Patient authorization model.

A watchlist entry is only a doctor's private case-management reminder:

    Doctor + Connected Patient
              ↓
        Add to Watchlist
              ↓
       Reason / Priority
          / Review Date
              ↓
      Private Doctor List

The patient is not notified that they were bookmarked and the watchlist is not
shown in the Patient app or Privacy Center.

Most importantly:

    WATCHLIST BOOKMARK ≠ PATIENT AUTHORIZATION

If the patient later revokes the care connection, the bookmark may remain for
the doctor's private reminder/history, but it does not unlock the patient chart.
The existing Phase 10A/10D authorization layer continues to control all clinical
access.

======================================================================
2. NEW MONGODB COLLECTION
======================================================================

    doctor_watchlist

Canonical record:

{
  doctorId: "...",
  patientId: "...",

  patientName: "Aima Perveen",          // identity snapshot captured while connected
  patientUsername: "aima...",          // identity snapshot captured while connected

  reason: "High-risk progression",
  priority: "important",                // normal | important
  reviewDate: "2026-09-28",             // date-only clinical reminder

  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}

Indexes:

- UNIQUE doctorId + patientId
- doctorId + reviewDate
- doctorId + priority + reviewDate

The unique pair means one doctor has one current bookmark per patient. The
same patient can independently appear on different doctors' watchlists.

======================================================================
3. BACKEND SECURITY MODEL
======================================================================

New router:

    backend/routers/watchlist.py

All endpoints require:

- authenticated account
- role = Doctor
- Phase 10C VerifiedProviderChecker()
- active provider account

Creating a NEW bookmark also requires the Phase 10D accepted Doctor–Patient
care connection.

The watchlist intentionally does NOT call patient-facing notification code and
does NOT write a patient-facing clinical_access_logs event merely because a
doctor bookmarked a case. It is private doctor workflow metadata.

A retained bookmark after connection revocation returns:

    accessAvailable = false

and the UI disables Open Patient. Directly calling a protected patient endpoint
still receives the existing authorization 403.

Extra privacy protection:

When access is revoked, the watchlist API does not fetch fresh patient profile
identity from the users collection merely to render the bookmark. It uses the
basic identity snapshot captured when the watchlist entry was originally
created. Therefore a stale bookmark is not a path to ongoing patient data.

======================================================================
4. API CONTRACT
======================================================================

GET /api/doctor/watchlist?limit=50
    Returns only the logged-in doctor's private watchlist.

GET /api/doctor/watchlist/patient/{patientId}
    Returns the doctor's bookmark state for one patient.
    - accepted connection + no bookmark -> editor can create
    - existing bookmark + revoked connection -> private metadata remains,
      accessAvailable=false
    - no bookmark + no accepted connection -> 403

POST /api/doctor/watchlist

{
  "patientId": "...",
  "reason": "High-risk progression",
  "priority": "important",
  "reviewDate": "2026-09-28"
}

Rules:
- patient must exist
- accepted connection required
- duplicate doctorId + patientId -> 409
- reason 3–500 characters
- priority = normal | important
- reviewDate = YYYY-MM-DD

PATCH /api/doctor/watchlist/{watchlistId}

{
  "reason": "Retinal progression review",
  "priority": "normal",
  "reviewDate": "2026-10-03"
}

Only the owning doctor may update the bookmark.
Updating the private reminder does not grant patient access.

DELETE /api/doctor/watchlist/{watchlistId}

Only the owning doctor may remove it.
Removing a bookmark does NOT:
- remove the care connection
- delete appointments
- delete consultations
- delete prescriptions
- delete reports
- delete patient history

======================================================================
5. DOCTOR UI
======================================================================

A. CONNECTED PATIENT CARD

Doctor -> My Patients now includes:

    [ Open Patient ]
    [ ☆ Add to Watchlist ]
    [ Remove ]

The watchlist button opens the private case editor.

B. PATIENT CLINICAL PROFILE

Connected patient chart also includes:

    ☆ Add to Watchlist

so the doctor can bookmark the case while reviewing it.

C. WATCHLIST EDITOR

Doctor selects:

Reason
[ High-risk progression................ ]

Priority
( ) Normal
( ) Important

Review Date
[ YYYY-MM-DD ]

[ SAVE TO WATCHLIST ]

Existing entries become an edit screen and can also be removed.

D. FULL WATCHLIST

Doctor navigation now includes:

    Watchlist

The screen displays:
- patient name/basic snapshot
- private reason
- Normal / Important priority
- Review Today / Review Tomorrow / Overdue / date label
- current access status
- Open Patient when access is still accepted
- Edit
- Remove

If a care connection is revoked:

    Clinical access revoked — bookmark retained privately.

and Open Patient becomes disabled.

E. DOCTOR DASHBOARD

The dashboard now includes a real WATCHLIST preview with up to four private
cases and a View All action.

Examples:

Aima Perveen
High-risk progression
Review Tomorrow

Ahmed Ali
Post-treatment review
Sep 29

Important cases receive a visible IMPORTANT label and border. The UI does not
rely on color alone for priority.

The preview refreshes whenever the doctor returns to the Dashboard so newly
created/edited watchlist items appear without restarting the app.

======================================================================
6. PRIVACY GUARANTEES
======================================================================

Patient-facing application:
- no "You were bookmarked" notification
- no Watchlist page
- no Watchlist field in Patient Profile
- no Watchlist activity in Privacy Center

Doctor privacy:
- every query is scoped to the authenticated doctorId
- another doctor cannot edit/delete another doctor's bookmark by ID
- patient cannot call Doctor Watchlist routes
- Hospital cannot call Doctor Watchlist routes
- unverified/suspended Doctor cannot call Doctor Watchlist routes

Patient authorization:
- creating a bookmark requires an accepted care connection
- bookmark survival after revocation preserves only private reminder metadata
- bookmark does not recreate/reaccept a care connection
- bookmark does not bypass require_patient_access()
- Open Patient is disabled when live access is unavailable
- protected patient APIs still independently enforce the Phase 10A security
  layer, even if a user manually bypasses the frontend.

======================================================================
7. FILES ADDED / UPDATED
======================================================================

NEW
- backend/routers/watchlist.py
- frontend/services/watchlist.ts
- frontend/app/doctor/watchlist.tsx
- PHASE10H_DOCTOR_WATCHLIST_README.txt

UPDATED
- backend/database.py
- backend/main.py
- frontend/app/doctor/_layout.tsx
- frontend/app/doctor/dashboard.tsx
- frontend/app/doctor/patient-profile.tsx
- frontend/components/ConnectionScreen.tsx
- frontend/design/components/AppShell.tsx

No existing medication, consultation, appointment, report, screening, privacy,
RAG, theme, provider-verification or connection collection is replaced.

======================================================================
8. INSTALLATION
======================================================================

1. Make a backup of the project.
2. Extract the ZIP directly into:

       F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Keep your current backend/.env.
5. No new pip package is required.
6. No new npm package is required.

Restart backend:

    cd "F:\Fyp retinopathy\backend"
    .\.venv\Scripts\Activate.ps1
    .\run-local-8001.ps1

Restart frontend:

    cd "F:\Fyp retinopathy\frontend"
    .\run-web-8081.ps1

The existing frontend runner uses Expo --clear, which also clears stale Metro
bundles.

======================================================================
9. REQUIRED PHASE 10 SECURITY FLAGS
======================================================================

Keep the secure state introduced by previous phases:

    ENFORCE_PROVIDER_VERIFICATION=true
    REQUIRE_PATIENT_CONNECTION=true
    ALLOW_LEGACY_CLINICAL_RELATIONSHIPS=false

No new environment variable is required for Phase 10H.

======================================================================
10. END-TO-END TEST PLAN
======================================================================

TEST A — CONNECTED VERIFIED DOCTOR
1. Login as verified + active Doctor.
2. Open My Patients.
3. On an accepted patient press ☆ Add to Watchlist.
4. Enter:
      Reason: High-risk progression
      Priority: Important
      Review Date: a valid YYYY-MM-DD date
5. Save.
6. Expected: entry is stored and appears on Doctor Dashboard + Watchlist.

TEST B — DUPLICATE PROTECTION
1. Open the same patient again.
2. Press Add to Watchlist.
3. Expected: existing record loads for editing instead of creating another row.
4. A direct duplicate POST should return HTTP 409.

TEST C — PRIVACY
1. Login as the Patient.
2. Check Notifications and Privacy & Access.
3. Expected: no watchlist/bookmark notification or event exists.
4. Patient should have no Doctor Watchlist navigation or API access.

TEST D — ACCESS REVOCATION
1. Doctor bookmarks an accepted patient.
2. Patient removes/revokes the doctor connection.
3. Doctor opens Watchlist.
4. Expected:
      bookmark remains
      accessAvailable=false
      Open Patient disabled
      private reason/review reminder remains
5. Manually call a protected patient clinical endpoint.
6. Expected: HTTP 403 Accepted patient care connection required.

TEST E — RESTORE CONNECTION
1. Create/accept a fresh care connection again.
2. Return to Watchlist.
3. Expected: accessAvailable=true and Open Patient is enabled again.
4. Bookmark reason/date are preserved.

TEST F — REMOVE BOOKMARK
1. Remove a watchlist item.
2. Expected: only doctor_watchlist row is removed.
3. Confirm the care connection, consultations, prescriptions, appointments and
   patient history remain unchanged.

TEST G — OWNERSHIP
1. Doctor A creates a bookmark.
2. Doctor B attempts PATCH/DELETE using Doctor A's watchlist ID.
3. Expected: 404 Watchlist entry not found.

TEST H — PROVIDER VERIFICATION
1. Try routes as pending/rejected/suspended provider.
2. Expected: existing Phase 10C provider security rejects access.

======================================================================
11. VALIDATION PERFORMED BEFORE PACKAGING
======================================================================

- Entire backend Python source tree compiled successfully.
- All frontend .ts/.tsx source files (excluding declaration-only .d.ts) were
  syntax-transpiled with TypeScript: 0 syntax errors.
- Changed frontend relative imports: 0 broken paths.
- Changed Phase 10H files: 0 mojibake/encoding markers detected.
- No new package dependency was introduced.
- ZIP integrity test performed after packaging.

A real MongoDB Atlas + Expo end-to-end test still needs to be run on the user's
machine because this build environment does not have the user's live database,
JWT sessions or local Expo runtime.

======================================================================
12. PHASE OUTCOME
======================================================================

After Phase 10H:

    Verified Doctor
          +
    Accepted Patient Connection
          ↓
    Add Private Watchlist Reminder
          ↓
    Reason + Priority + Review Date
          ↓
    Dashboard / Watchlist Follow-up

while:

    Revoked Patient Connection
          ↓
    Bookmark may remain
          ↓
    NO clinical access

Doctors can therefore return quickly to clinically interesting or difficult
cases without turning a private bookmark into an authorization shortcut.
