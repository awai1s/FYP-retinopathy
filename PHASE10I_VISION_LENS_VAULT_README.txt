EyeCare AI / DR Healthcare
PHASE 10I — PERSONAL GLASSES & LENS VAULT
Complete replacement patch
Prepared: September 2026

======================================================================
1. PURPOSE
======================================================================

Phase 10I adds a patient-owned long-term vault for glasses and contact-lens
prescriptions without replacing any existing EyeCare AI clinical collection.
The new module is intentionally independent from retinal screening and does not
require the AI model.

The patient gets:
- Current glasses prescription
- Current contact-lens prescription
- Historical prescriptions that are never deleted by this workflow
- Expiring Soon view
- Optional original prescription PDF/JPEG/PNG stored in existing GridFS
- In-app expiry reminders
- Native local expiry reminders at 30, 7 and 1 day(s) before expiry
- Provider / clinic / notes metadata
- Profile shortcut plus Patient sidebar navigation

======================================================================
2. INSTALLATION
======================================================================

1. Back up the current project folder.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Keep the existing backend/.env. This patch does not replace it.
5. No new pip package is required.
6. No new npm package is required. The project already contains:
   - expo-document-picker
   - expo-file-system
   - expo-sharing
   - expo-notifications

Restart backend:

   cd "F:\Fyp retinopathy\backend"
   .\.venv\Scripts\Activate.ps1
   .\run-local-8001.ps1

Restart frontend:

   cd "F:\Fyp retinopathy\frontend"
   .\run-web-8081.ps1

======================================================================
3. NAVIGATION
======================================================================

Patient sidebar:

   Vision & Lens Vault

Patient Profile also contains a Vision & Lens Vault shortcut directly below the
Digital Health Card entry.

Routes:

   /vision-vault
   /vision-vault/add?type=glasses
   /vision-vault/add?type=contact_lens
   /vision-vault/{prescriptionId}

======================================================================
4. NEW DATABASE COLLECTION
======================================================================

   vision_prescriptions

A record stores:

   patientId
   type                  glasses | contact_lens
   isCurrent             true | false
   lifecycleStatus       current | history
   issuedDate
   expiryDate
   doctorOptometrist
   clinic
   notes
   glasses               nested optical values
   contactLens           nested contact-lens values
   attachment            optional GridFS reference
   expiryReminderThresholdsSent
   createdAt
   updatedAt
   supersededAt

Indexes:
- patientId + type + isCurrent
- unique current patientId + type (partial unique index where isCurrent=true)
- patientId + issuedDate
- patientId + expiryDate
- attachment.fileId

======================================================================
5. HISTORY-PRESERVATION RULE
======================================================================

The vault does NOT delete an older prescription when the patient records an
updated prescription.

Example:

   Current glasses prescription A
              ↓
   Patient adds glasses prescription B
              ↓
   A -> isCurrent=false, lifecycleStatus=history, supersededAt=...
   B -> isCurrent=true, lifecycleStatus=current

The same rule is applied independently to contact-lens prescriptions.

There is deliberately no patient DELETE endpoint for vision_prescriptions in
this phase.

Original attachments are also treated as historical evidence. After a record
already has an attachment, the backend refuses silent attachment replacement.
If the underlying prescription was corrected, create a new prescription record.

======================================================================
6. GLASSES FIELDS
======================================================================

Right eye:
- SPH
- CYL
- Axis

Left eye:
- SPH
- CYL
- Axis

Additional:
- ADD
- PD

All optical values are optional because not every prescription uses every field.
Backend ranges prevent obviously invalid values while still allowing common
clinical prescriptions.

======================================================================
7. CONTACT-LENS FIELDS
======================================================================

- Right power
- Left power
- Base curve
- Diameter
- Brand
- Lens type
- Replacement schedule

======================================================================
8. SHARED INFORMATION
======================================================================

Both prescription types support:

- Issued Date (required, YYYY-MM-DD)
- Expiry Date (optional, YYYY-MM-DD)
- Doctor / Optometrist
- Clinic
- Notes
- Optional source attachment

The backend rejects an expiry date earlier than the issued date.

======================================================================
9. ATTACHMENTS / GRIDFS
======================================================================

The module reuses the project's Phase 10A hardened GridFS upload helper.
Allowed attachment types therefore remain:

- PDF
- JPEG
- PNG

Existing configured upload-size validation and file-signature validation are
preserved.

Backend endpoints:

POST /api/patient/vision-prescriptions/{id}/attachment
GET  /api/patient/vision-prescriptions/{id}/attachment/download

Only the logged-in Patient who owns the prescription can upload/download its
attachment.

======================================================================
10. API CONTRACT
======================================================================

GET /api/patient/vision-prescriptions

Returns:

   currentGlasses
   currentContactLens
   history
   expiringSoon
   records

GET /api/patient/vision-prescriptions/{id}
POST /api/patient/vision-prescriptions
POST /api/patient/vision-prescriptions/{id}/attachment
GET /api/patient/vision-prescriptions/{id}/attachment/download

All routes require an authenticated Patient account.

======================================================================
11. EXPIRY REMINDERS
======================================================================

Two complementary reminder mechanisms are included.

A) IN-APP NOTIFICATION

When the Patient opens/refreshes the vault, the backend checks the current
prescriptions and creates a meaningful notification at the nearest crossed
threshold:

- 30 days
- 7 days
- 1 day
- expired

Thresholds already sent are stored on the prescription so opening the screen
repeatedly does not spam duplicate reminders.

Notification example:

   Vision prescription expiring soon
   Your current glasses prescription will expire in 30 days.
   Consider scheduling an eye examination.

Tapping this notification opens the matching prescription record.

B) NATIVE LOCAL NOTIFICATIONS

On Android/iOS, the frontend uses the already-installed expo-notifications
package to schedule future 30-day, 7-day and 1-day reminders for current
prescriptions that have an expiry date.

When a newer prescription replaces an older current record, old scheduled local
reminders are cancelled during the next vault sync.

Expo Web cannot schedule the same native local notifications; the in-app
notification mechanism still works on web.

======================================================================
12. SCREEN STRUCTURE
======================================================================

VISION & LENS VAULT

[ Current ] [ Contact Lenses ] [ History ] [ Expiring Soon ]

Current:
- Current Glasses
- Issued / expiry dates
- SPH / CYL / AXIS table
- ADD
- PD
- Add Updated Glasses

Contact Lenses:
- Current Contact Lens prescription
- Right / left power
- Base curve
- Diameter
- Brand / lens type / replacement schedule
- Add Updated Contact Lens

History:
- Every superseded glasses/contact-lens record
- Original issued/expiry date
- Provider name when recorded
- Attachment indicator

Expiring Soon:
- Current prescriptions due in <= 30 days
- Already-expired current records
- Human-readable expiry state

======================================================================
13. SECURITY / PRIVACY
======================================================================

- Patient-only router dependency is applied to every endpoint.
- Every database query is also scoped by the logged-in patientId.
- A patient cannot fetch another patient's prescription by guessing an ID.
- GridFS bytes are fetched only after record ownership is checked.
- There is no public QR/share exposure of lens prescriptions in Phase 10I.
- No doctor/provider access is introduced by this module.
- Historical data is not a substitute for Phase 10A patient authorization.

======================================================================
14. TEST PLAN
======================================================================

A. GLASSES
1. Login as Patient.
2. Open Vision & Lens Vault.
3. Add glasses prescription:
   Right SPH -1.50 / CYL -0.50 / Axis 90
   Left SPH -1.25 / CYL -0.25 / Axis 85
   PD 63
4. Confirm it appears under Current.
5. Add a second glasses prescription.
6. Confirm the first record appears under History and the second becomes Current.

B. CONTACT LENSES
1. Add a contact-lens record with powers, base curve, diameter and brand.
2. Confirm it appears under Contact Lenses.
3. Add an updated contact-lens record.
4. Confirm the older record moves to History.

C. ATTACHMENT
1. Add or open a prescription without an attachment.
2. Upload PDF/JPEG/PNG.
3. Open the stored attachment.
4. Try uploading another attachment to the same record.
5. Expected: 409 historical-evidence protection.

D. EXPIRY
1. Create a prescription with expiry inside 30 days.
2. Open Expiring Soon.
3. Confirm the record appears there.
4. Open Notifications and verify an expiry reminder appears.
5. Re-open the vault repeatedly and confirm the same threshold is not duplicated.

E. SECURITY
1. Login with a different Patient account.
2. Request the first Patient's prescription ID directly.
3. Expected: 404 (record not available to this account).
4. Request the first Patient's attachment URL.
5. Expected: 404.

F. THEME / ACCESSIBILITY
Test the vault in:
- Light
- Dark
- Eye-Friendly
- Large / Extra Large text

All new screens use the existing Phase 10B dynamic theme tokens.

======================================================================
15. FILES ADDED / UPDATED
======================================================================

NEW
- backend/routers/vision_prescriptions.py
- frontend/app/vision-vault/index.tsx
- frontend/app/vision-vault/add.tsx
- frontend/app/vision-vault/[id].tsx
- frontend/services/visionPrescriptions.ts
- frontend/services/visionPrescriptionNotifications.ts
- PHASE10I_VISION_LENS_VAULT_README.txt
- PHASE10I_PATCH_MANIFEST.txt

UPDATED
- backend/main.py
- backend/database.py
- frontend/design/components/AppShell.tsx
- frontend/app/tabs/profile.tsx
- frontend/app/notifications.tsx
- frontend/services/notification.ts

======================================================================
16. NEXT PHASE
======================================================================

After Phase 10I, the roadmap can continue to Phase 10J — Eye Health Education
Center. Phase 10F already created education_assignments, so that later module can
reuse the existing doctor-assigned education relationship instead of creating a
second assignment system.
