EyeCare AI / DR Healthcare
PHASE 10L — OFFLINE MODE + SAFE SYNCHRONIZATION
Complete replacement patch
Prepared: September 2026

======================================================================
1. PATCH BASIS
======================================================================

This patch is built on the current EyeCare AI project after Phases 10A–10K.
It extends the existing Expo/React Native frontend, FastAPI backend, medication
adherence, appointments, Digital Health Card, retinal screening summary and
Eye Health Education Center. It is a replacement patch, not a new project.

Existing local development ports remain unchanged:
- Backend:  http://127.0.0.1:8001
- Frontend: http://localhost:8081

No new npm package is required.
No new pip package is required.
Do NOT replace your real backend/.env.

======================================================================
2. OFFLINE DESIGN PRINCIPLE
======================================================================

Phase 10L deliberately does NOT create a full local copy of the clinical
system. Only a small, patient-owned working set is cached.

Cached for offline use:
- Today's/active medication plan and instructions
- 7-day and 30-day adherence working data needed by the Medication UI
- Upcoming Pending/Confirmed appointments
- Patient's own minimal Digital Health Card / emergency information
- Small patient dashboard summary + latest screening summary
- Doctor-assigned education list
- Patient-selected education article IDs

NOT automatically cached:
- Retinal photographs
- Full retinal-image history
- Medical PDF files
- Complete report bodies
- Complete patient history/database
- Doctor private clinical notes
- Provider records
- Consultation Cockpit clinical workspace

This reduces unnecessary copies of clinical information on the device.
AsyncStorage is still application storage, not a substitute for hardware-backed
encrypted clinical storage. This phase minimizes what is stored and clears it
on logout; it does not claim legal/regulatory compliance by itself.

======================================================================
3. NEW OFFLINE ARCHITECTURE
======================================================================

NEW: frontend/services/offlineCache.ts

Cache envelope:

{
  "schemaVersion": 1,
  "updatedAt": "...",
  "data": {}
}

If a future application release changes the cache schema, incompatible entries
can be invalidated safely.

Private cache keys are namespaced by a one-way local hash of the account email.
If another account logs in, previous private offline data is cleared before the
new account namespace is activated.

NEW: frontend/services/syncQueue.ts

The queue currently handles medication dose mutations. Every queued operation
has a unique client operation ID, the original scheduledDate and an attempt
count. Offline edits update the local adherence view optimistically without
falsely updating the server "Last sync" timestamp.

NEW: frontend/providers/NetworkProvider.tsx

Connectivity means "the EyeCare AI backend is reachable", not merely that the
device has Wi-Fi. The provider checks /health, watches app foreground state,
listens to browser online/offline events on Expo Web, retries periodically and
flushes queued medication actions after reconnection.

NEW: frontend/services/offlineBootstrap.ts

While a Patient is authenticated and the backend is reachable, it refreshes
only the approved essential offline dataset using the existing services.

NEW: frontend/components/offline/OfflineStatusBanner.tsx
NEW: frontend/app/offline.tsx

Every Patient AppShell shows a clear OFFLINE MODE banner when the backend cannot
be reached. Tapping it opens the detailed Offline Mode screen.

======================================================================
4. OFFLINE MEDICATION WORKFLOW
======================================================================

Existing local medication notifications remain device-local and therefore can
continue without an active network connection once scheduled.

Viewing medication offline:
- getPatientPrescriptions() falls back to the synchronized active medication
  plan and instructions.
- getMedicationAdherence(7/30) falls back to synchronized adherence data.

Recording a dose offline:

Patient taps TAKEN / MISSED / SKIP / SNOOZE
        |
        v
Normal backend request attempted
        |
        v
Network unavailable
        |
        v
Unique local operation generated
        |
        v
Original scheduledDate preserved
        |
        v
Cached Today's Medication updates immediately
        |
        v
Operation stays in private sync queue
        |
        v
Backend becomes reachable
        |
        v
NetworkProvider flushes queue
        |
        v
Server confirms operation
        |
        v
Operation removed from queue

The sync queue never presents a failed server mutation as synchronized.
Retryable failures remain queued. Non-retryable server rejection is retained as
a stored/terminal operation rather than silently disappearing.

======================================================================
5. BACKEND REPLAY / DUPLICATE PROTECTION
======================================================================

UPDATED: backend/routers/patient.py

MedicationAdherenceCreate now accepts:

clientOperationId

The existing medication_adherence collection already has a UNIQUE natural dose
key:

patientId + prescriptionId + scheduledDate + doseKey

Phase 10L additionally stores lastClientOperationId. If the exact same queued
request is replayed because the client lost a response, the backend returns the
already-saved dose state without changing timestamps again.

This prevents reconnection/retry behavior from creating duplicate:

Taken
Taken
Taken

records for the same medication dose.

======================================================================
6. APPOINTMENTS OFFLINE
======================================================================

Patient appointment list:
- Works offline using the last synchronized upcoming Pending/Confirmed visits.

Creating a new appointment:
- Internet required.
- The Book Appointment UI explains why.
- Doctor availability is not fetched offline.
- The Confirm Appointment action is disabled offline.
- No local request is displayed as "confirmed" or "booked" before the server
  accepts it.

Cancelling an appointment:
- Internet required because the provider/server must receive the change.

This intentionally avoids offline slot conflicts.

======================================================================
7. DIGITAL HEALTH CARD OFFLINE
======================================================================

The patient's own last synchronized minimal Health Card can be displayed on the
patient's device without internet.

Offline QR behavior remains secure:
- NO patient medical data is inserted into the QR payload.
- Emergency/temporary secure QR creation requires the backend.
- QR settings changes require the backend.
- QR revocation requires the backend.
- Remote scanning of an existing secure QR requires the backend.

The offline card therefore does not undo Phase 10E's opaque-token privacy
architecture.

======================================================================
8. LATEST SCREENING SUMMARY OFFLINE
======================================================================

A deliberately small dashboard cache stores the latest screening summary and
basic dashboard counts. Report files and recent report bodies are NOT cached.

If the Result page requests the same latest prediction while offline, the
service can provide only the limited synchronized summary:
- stage/diagnosis
- confidence
- risk score
- date/status

It does NOT invent findings and does NOT cache/return Grad-CAM imagery. The UI
receives an explicit offline-summary message until reconnection.

======================================================================
9. EDUCATION OFFLINE
======================================================================

Phase 10J education articles are curated application content bundled with the
frontend, so their text does not require a server request to render.

Patients can now mark an article "Save offline". The application stores only
article IDs as a non-sensitive preference and lists those selections on the
Offline Mode page.

Doctor education assignments are synchronized in a small patient-owned cache so
the recommended-learning list remains available offline.

======================================================================
10. SESSION / APP RESTART BEHAVIOR
======================================================================

UPDATED: frontend/app/index.tsx

The splash route now respects an existing saved authenticated session instead
of forcing the login page on every app restart. Therefore, if a Patient has
previously logged in and synchronized data, the application can reopen into the
Patient workspace while the backend is temporarily unreachable.

If the server is reachable but the token is actually invalid/expired, normal
401/403 handling still routes the user back to login rather than treating an
authentication failure as an offline condition.

The AI Assistant is hidden while offline because its RAG/backend workflow is a
server feature and should not pretend to work disconnected.

======================================================================
11. LOGOUT PRIVACY
======================================================================

Logout now clears private offline data before removing the authentication token.
This includes:
- medication cache
- adherence cache
- appointment cache
- patient health-card cache
- screening/dashboard summary cache
- education assignment cache
- queued medication mutations
- last-sync metadata
- account cache namespace

Non-sensitive application preferences remain, including theme/language and the
IDs of education articles the user chose to save.

======================================================================
12. FILES ADDED / UPDATED
======================================================================

NEW
- frontend/services/offlineCache.ts
- frontend/services/syncQueue.ts
- frontend/services/offlineBootstrap.ts
- frontend/providers/NetworkProvider.tsx
- frontend/components/offline/OfflineStatusBanner.tsx
- frontend/app/offline.tsx

UPDATED
- backend/routers/patient.py
- frontend/app/_layout.tsx
- frontend/app/index.tsx
- frontend/app/appointments.tsx
- frontend/app/book-appointment.tsx
- frontend/app/tabs/dashboard.tsx
- frontend/app/health-card/index.tsx
- frontend/app/education/[id].tsx
- frontend/components/LogoutButton.tsx
- frontend/design/components/AppShell.tsx
- frontend/design/components/MobileSidebar.tsx
- frontend/services/auth.ts
- frontend/services/patient.ts
- frontend/services/prescriptions.ts
- frontend/services/appointment.ts
- frontend/services/privacy.ts
- frontend/services/education.ts

======================================================================
13. INSTALLATION
======================================================================

1. Back up the current project folder.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Keep your existing backend/.env.
5. Do not run npm install or pip install for this phase.

Restart backend:

cd "F:\Fyp retinopathy\backend"
.\.venv\Scripts\Activate.ps1
.\run-local-8001.ps1

Restart frontend:

cd "F:\Fyp retinopathy\frontend"
.\run-web-8081.ps1

The existing frontend script clears Metro/Expo cache.

======================================================================
14. RECOMMENDED END-TO-END TEST
======================================================================

A. PRIME THE CACHE
1. Start backend + frontend with internet/backend available.
2. Login as Patient.
3. Open Medication, Appointments, Digital Health Card, Dashboard and Learn & Eye
   Health at least once, or simply leave the app online long enough for the
   NetworkProvider essential-cache bootstrap to complete.
4. Confirm the Offline Mode page reports synchronized data.

B. DISCONNECT
1. Stop backend or disconnect the device/network.
2. Wait for the OFFLINE MODE banner, or background/foreground the app.
3. Verify the banner shows the previous Last Sync time.
4. Open the Offline Mode page.

C. MEDICATION
1. Open Medication while offline.
2. Confirm Today's medication/instructions remain visible.
3. Mark one dose TAKEN.
4. Confirm the dose changes locally and the offline banner/page reports a stored
   action.
5. Do not reconnect yet; close/reopen the app and confirm the cached dose still
   appears.

D. APPOINTMENTS
1. Open Appointments offline -> synchronized upcoming appointments appear.
2. Try New Appointment -> page explains internet is required.
3. Confirm no fake success/confirmation is shown.

E. HEALTH CARD
1. Open Digital Health Card offline -> cached emergency information appears.
2. Try to create/rotate/revoke QR -> Internet required message appears.
3. Inspect QR architecture: no medical fields are encoded into a local offline QR.

F. SCREENING
1. From the dashboard/latest result, open the synchronized latest screening.
2. Verify only the limited summary is available; no retinal image/Grad-CAM is
   loaded from an offline cache.

G. EDUCATION
1. Open an article online and select Save offline.
2. Disconnect and reopen it -> article remains readable because curated content
   is bundled with the app.
3. Offline Mode page lists the saved article.

H. RECONNECT / SYNC
1. Restore backend/network.
2. Wait for reconnection or press Check Connection & Sync.
3. Verify the queued dose is sent once and the stored-action count clears.
4. Refresh medication data from MongoDB/API and verify there is only one dose
   record for patientId + prescriptionId + scheduledDate + doseKey.

I. LOGOUT
1. While logged in, synchronize private data.
2. Logout.
3. Confirm private offline cache and queued operations are removed.
4. Login as a different patient and confirm no previous patient's cached medical
   information is visible.

======================================================================
15. PHASE OUTCOME
======================================================================

EyeCare AI remains useful during poor connectivity without pretending that
server-only actions succeeded. The offline experience is deliberately limited,
patient-owned and synchronization-aware:

Online
  -> synchronize minimum useful patient dataset

Offline
  -> read safe cached summaries
  -> local medication reminders continue
  -> queue medication dose actions with unique operation IDs
  -> block server-authoritative booking/QR mutations

Reconnect
  -> replay queued dose actions idempotently
  -> refresh server-authoritative data

Logout
  -> delete private offline state
