EyeCare AI / DR Healthcare
PHASE 10E — PATIENT PRIVACY CENTER + DIGITAL HEALTH CARD + SECURE QR
Complete replacement patch
Prepared: September 2026

======================================================================
1. PATCH BASIS
======================================================================

This patch is built on the current EyeCare AI state after Phases 10A, 10B,
10C and 10D. It preserves the existing FastAPI + MongoDB/GridFS backend,
Expo/React Native frontend, provider verification, formal care connections,
clinical access control, RAG/voice, medication, analytics, clinic, reports,
screening and theme/accessibility work.

The patch extends the security foundation rather than creating a parallel
patient-record system. Existing collections remain authoritative:
- predictions            -> retinal screening / DR output
- health_metrics         -> HbA1c and glucose
- prescriptions          -> medication
- reports + GridFS       -> clinical files
- patient_profiles       -> patient-owned profile and consent data
- care_connections       -> accepted Doctor <-> Patient relationships
- clinical_access_logs   -> metadata-only clinical access history

======================================================================
2. INSTALLATION
======================================================================

1. Make a backup of the current project folder.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Do NOT replace/delete your existing backend/.env.
5. No new pip package is required.
6. No new npm package is required.

The implementation reuses packages already in the project:
- reportlab for server-generated QR SVG
- react-native-webview for native QR rendering
- Expo/React Native Web for the web QR rendering

OPTIONAL PRODUCTION SETTING
---------------------------
For deployed QR codes, set the real public frontend URL in backend/.env:

HEALTH_CARD_PUBLIC_BASE_URL=https://your-real-frontend-domain.example

Local Expo Web may leave this blank; the backend derives the current host and
uses the project's existing frontend port 8081.

Keep the previous security chain enabled:

ENFORCE_PROVIDER_VERIFICATION=true
REQUIRE_PATIENT_CONNECTION=true
ALLOW_LEGACY_CLINICAL_RELATIONSHIPS=false

See backend/.env.phase10e.example for non-secret examples only.

======================================================================
3. DIGITAL PATIENT HEALTH CARD
======================================================================

LOCATION
--------
Patient Profile -> Digital Health Card

The Health Card is deliberately NOT added as another permanent sidebar item.
The Patient Profile contains the Digital Health Card entry point, while the
Privacy Center is available in Patient navigation.

CARD CONTENT
------------
The private in-app card shows:
- EyeCare AI branding
- patient name
- stable EyeCare ID
- blood group when saved
- emergency contact when saved
- secure QR action

The patient profile now includes editable fields for:
- Blood Group
- Address
- Emergency Contact
- Allergies

EyeCare IDs are randomly allocated and persisted in patient_profiles. The
public EyeCare ID does not expose the MongoDB user ObjectId.

======================================================================
4. MOST IMPORTANT QR SECURITY RULE
======================================================================

NO medical data is encoded directly in the QR.

The QR encodes only an opaque tokenized frontend URL similar to:

https://frontend.example/health-card/q/<opaque-token>

The token is constructed from a cryptographically random public id plus an
HMAC-SHA256 signature derived from the backend SECRET_KEY. The database stores:
- random publicId
- SHA-256 tokenHash
- patientId
- share type
- allowed scopes
- expiry/revocation state
- usedCount / optional maxUses
- lastUsedAt

The database does NOT store the raw usable token and the QR does NOT contain:
- patient name
- phone number
- diagnosis
- report text/file
- medication
- HbA1c
- retinal image

Every public request re-validates token signature, hash, expiry, revocation and
usage limit before reading live data from the authoritative collections.

Public Health Card API responses include no-cache/no-store and no-index headers.

======================================================================
5. EMERGENCY QR
======================================================================

The patient chooses exactly what the Emergency QR may reveal:

- Basic Identity
- Emergency Contact
- Blood Group
- Allergies
- Active Medication
- Latest DR Result
- Latest HbA1c

Defaults are conservative:
- basic identity, emergency contact, blood group, allergies = ON
- active medication, latest DR result, latest HbA1c = OFF

If Basic Identity is switched OFF, the public share does not reveal name or
EyeCare ID. The selected fields are honored exactly.

Emergency shares are longer-lived (365 days) but can be revoked/replaced at
any time.

IMPORTANT ROTATION RULE
-----------------------
If an active Emergency QR exists and the patient changes its disclosure fields,
the old token is revoked and a new token is created. Therefore an old screenshot
cannot continue revealing fields under stale permissions.

Changing privacy settings does NOT silently create an Emergency QR if the
patient never created one.

======================================================================
6. TEMPORARY MEDICAL QR
======================================================================

The patient can choose:
- Profile
  (basic identity + emergency contact + blood group + allergies)
- Latest Screening
- Current Medication
- Recent Reports
- Latest HbA1c

Expiry options:
- 15 minutes
- 1 hour
- 24 hours

After expiry the public endpoint returns HTTP 410 and the frontend displays:
"This medical share link has expired."

Temporary shares can also be revoked before expiry.

The backend supports optional maxUses for future controlled sharing without
changing the token architecture.

======================================================================
7. PUBLIC SCANNING FLOW
======================================================================

QR scanned
    -> frontend token route opens
    -> backend validates token signature/hash
    -> checks expiry
    -> checks revoked state
    -> checks usage limit
    -> reads only scopes authorized by that token
    -> reconstructs current allowed values from existing collections
    -> writes metadata-only QR_SCAN access event
    -> returns the limited share

The public screen never requires the viewer to know a patient database id.

If Recent Reports is shared, report download also requires the same valid token,
reports.recent scope, matching patient ownership, and a still-valid share. The
GridFS file is fetched only after those checks pass.

======================================================================
8. PATIENT PRIVACY CENTER
======================================================================

Patient navigation now includes:

Privacy & Access

The Privacy Center contains:

1. RECENT ACCESS
   - who accessed
   - what category/action
   - when
   - how (Care Connection, QR, etc.)

2. CONNECTED PROVIDERS
   - accepted Phase 10D providers
   - verification badge
   - specialization/hospital
   - connected date
   - Remove connection control

3. QR SHARING
   - active Emergency/Temporary shares
   - usedCount
   - expiry
   - human-readable shared categories
   - revoke control
   - expired/revoked historical shares

4. CONSENT SETTINGS
   - retinal screening storage consent
   - Digital Health Card QR sharing consent

Turning Digital Health Card QR sharing OFF immediately revokes all active QR
shares and prevents creation of new shares until the patient re-enables it.

There is intentionally NO endpoint or UI for a Patient to delete access logs.
Access history is historical audit metadata.

======================================================================
9. PATIENT DASHBOARD PRIVACY ACTIVITY
======================================================================

The Patient Dashboard now has a dedicated PRIVACY ACTIVITY card showing the two
latest meaningful access events and a "View All Activity" action.

The dashboard also has a Privacy & Access care-tool card.

======================================================================
10. MEANINGFUL ACCESS NOTIFICATIONS
======================================================================

Phase 10A clinical access logging is extended so meaningful actions can create
patient notifications, including:
- VIEW_SCREENING
- VIEW_RETINAL_IMAGE
- VIEW_REPORT
- DOWNLOAD_REPORT
- VIEW_MEDICATION
- CREATE_PRESCRIPTION
- START_CONSULTATION
- VIEW_CONSULTATION
- QR_SCAN

The notification is metadata-only. It does not copy clinical data.

QR example:
"Your Health Card was scanned."

Provider example:
"Dr. Ahmed accessed your retinal screening."

Repeated identical access is notification-throttled to avoid flooding the
patient, while clinical_access_logs still remains the source of privacy history.

Tapping a privacy-access notification opens Privacy & Access.

======================================================================
11. ACCESS LOG PRIVACY RULE
======================================================================

clinical_access_logs contains metadata such as:
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

It MUST NOT contain copies of:
- report contents
- diagnosis text
- medication names
- clinical notes
- retinal images
- HbA1c values
- other viewed medical payloads

This rule is preserved by access_log_service.py.

======================================================================
12. DATABASE CHANGES
======================================================================

NEW COLLECTIONS
---------------
health_card_settings
- patientId (unique)
- fields
- createdAt
- updatedAt

qr_share_tokens
- publicId (unique)
- tokenHash (unique)
- patientId
- type: emergency | temporary
- scopes
- createdAt
- expiresAt
- revoked / revokedAt / revokedReason
- usedCount
- optional maxUses
- lastUsedAt

REUSED COLLECTION
-----------------
clinical_access_logs
No second audit collection is introduced.

ADDITIONAL INDEXES
------------------
patient_profiles
- unique sparse eyeCareId

clinical_access_logs
- patientId + createdAt
- actorUserId + createdAt
- resourceType + resourceId
- patientId + action + createdAt

qr_share_tokens
- unique publicId
- unique tokenHash
- patientId + createdAt
- patientId + type + revoked + expiresAt

======================================================================
13. NEW BACKEND ENDPOINTS
======================================================================

PATIENT AUTHENTICATED
---------------------
GET   /api/patient/privacy/summary
GET   /api/patient/privacy/access-logs
GET   /api/patient/privacy/health-card
PATCH /api/patient/privacy/health-card/settings
POST  /api/patient/privacy/health-card/emergency-qr
POST  /api/patient/privacy/health-card/temporary-qr
GET   /api/patient/privacy/health-card/shares
PATCH /api/patient/privacy/health-card/shares/{share_id}/revoke
POST  /api/patient/privacy/health-card/shares/revoke-all

PUBLIC TOKEN-GATED
------------------
GET /api/public/health-card/{token}
GET /api/public/health-card/{token}/reports/{report_id}/download

The public routes are not ordinary anonymous patient-record endpoints. Access is
bounded entirely by the high-entropy signed token and the stored allowed scopes.

======================================================================
14. HEALTH CHECK
======================================================================

GET http://127.0.0.1:8001/health

The config section now also reports:

health_card_public_url_configured: true/false

Local development does not require it to be true. Production should configure
the correct frontend URL unless the first CORS_ORIGINS value is intentionally
used as the frontend public base URL.

======================================================================
15. TESTING ORDER
======================================================================

A. PATIENT PROFILE
1. Login as Patient.
2. Profile -> Edit Profile.
3. Save Blood Group, Address, Emergency Contact and Allergies.
4. Reopen Profile and confirm the values persist.
5. Open Digital Health Card.

B. EMERGENCY QR DEFAULT PRIVACY
1. Confirm Basic Identity / Emergency Contact / Blood Group / Allergies are ON.
2. Confirm Active Medication / Latest DR Result / Latest HbA1c are OFF.
3. Press QR on the Health Card or "Show My Emergency QR".
4. Open the shared view.
5. Confirm only selected fields appear.
6. Confirm no report/medication/HbA1c appears unless explicitly enabled.

C. FIELD-CHANGE ROTATION
1. Keep the old Emergency QR/link open in a browser tab.
2. In the app, change one Emergency QR field.
3. The existing share is automatically rotated.
4. Refresh the OLD link -> it must be revoked/unavailable.
5. Show the Emergency QR again -> the NEW link must use the updated fields.

D. TEMPORARY QR
1. Select Profile + Latest Screening.
2. Choose 15 minutes.
3. Generate QR.
4. Open it and confirm only selected categories are present.
5. Revoke it from the Health Card or Privacy Center.
6. Refresh the old link -> it must return unavailable/revoked.

E. EXPIRY
For normal UI testing use 15 minutes, or temporarily alter only your local test
data's expiresAt in MongoDB Atlas to a past timestamp.
The expired share must return HTTP 410 and show the expired message.

F. QR ACCESS LOG
1. Scan/open a valid QR.
2. Open Privacy & Access.
3. Confirm an Anonymous QR Scan / Health Card event appears with Via QR.
4. Confirm the clinical_access_logs document contains metadata only.

G. CONNECTED PROVIDER
1. Have a verified Doctor with an accepted Phase 10D connection access a route
   already instrumented by Phase 10A, such as a screening/report.
2. Patient -> Privacy & Access.
3. Confirm provider name, action, date/time and Care Connection channel appear.
4. Remove the provider from Privacy Center.
5. Confirm the connection becomes revoked and the doctor loses general current
   clinical access while historical medical records remain.

H. CONSENT
1. Privacy & Access -> turn Digital Health Card QR sharing OFF.
2. Confirm all active shares become revoked.
3. Attempt to create Emergency/Temporary QR -> expected 403.
4. Turn sharing ON and create a new QR.

I. NOTIFICATIONS
1. Trigger a QR scan.
2. Open Notifications.
3. Confirm privacy access notification appears.
4. Tap it -> Privacy & Access.

J. DARK / LIGHT / EYE-FRIENDLY
Repeat Health Card, Privacy Center and public-share screens in:
- Light
- Dark
- Eye-Friendly
- larger text settings

======================================================================
16. PRODUCTION NOTES
======================================================================

Before production:
- use a strong SECRET_KEY and keep it private
- configure exact CORS_ORIGINS
- configure HEALTH_CARD_PUBLIC_BASE_URL to the real HTTPS frontend domain
- keep diagnostics disabled
- keep provider verification enabled
- keep formal patient connection enforcement enabled
- do not enable the legacy relationship bridge
- use HTTPS so QR tokens are not exposed in plaintext transit

Rotating SECRET_KEY invalidates existing Health Card token signatures. This is a
security-safe behavior but means patients would need to generate new QR shares.

======================================================================
17. FILES ADDED / CHANGED
======================================================================

NEW
- PHASE10E_PRIVACY_HEALTH_CARD_README.txt
- backend/.env.phase10e.example
- backend/privacy_service.py
- backend/routers/privacy.py
- frontend/components/SecureQrView.tsx
- frontend/components/SecureQrView.web.tsx
- frontend/components/SecureQrView.native.tsx
- frontend/services/privacy.ts
- frontend/app/privacy.tsx
- frontend/app/health-card/index.tsx
- frontend/app/health-card/q/[token].tsx

UPDATED
- backend/access_log_service.py
- backend/config.py
- backend/database.py
- backend/main.py
- backend/models.py
- backend/routers/patient.py
- frontend/app/notifications.tsx
- frontend/app/tabs/dashboard.tsx
- frontend/app/tabs/profile.tsx
- frontend/design/components/AppShell.tsx
- frontend/services/common.ts
- frontend/services/consent.ts
- frontend/services/notification.ts

======================================================================
18. NEXT PHASE
======================================================================

After Phase 10E is stable, the roadmap can proceed to Phase 10F — Consultation
Cockpit. Phase 10F can reuse the provider verification, care-connection access,
clinical access logging and patient privacy foundations already established.
