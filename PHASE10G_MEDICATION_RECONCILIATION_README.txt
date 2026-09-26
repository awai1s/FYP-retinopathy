EyeCare AI / DR Healthcare
PHASE 10G — MEDICATION RECONCILIATION + FULL MEDICATION UI REDESIGN
Complete replacement patch
Prepared: September 2026

======================================================================
1. PATCH BASIS
======================================================================
This patch is built for the current EyeCare AI project after Phases 10A–10F.
It preserves the existing FastAPI + MongoDB + GridFS backend, Expo/React Native
frontend, dose-level adherence, local medication reminders, provider verification,
care connections, Privacy Center, and Consultation Cockpit.

It does NOT replace the medication foundation. It reorganizes the patient UX and
adds a doctor reconciliation workflow on top of the existing prescriptions and
medication_adherence data.

No new pip package is required.
No new npm package is required.
Do not replace backend/.env.

======================================================================
2. PATIENT MEDICATION UI
======================================================================
frontend/app/prescriptions.tsx is reorganized into:

  [ Today ] [ My Medications ] [ History & Adherence ]

TODAY
- Only today's scheduled doses and adherence summary.
- Shows completed/expected doses and today's percentage.
- Dose status is explicit text + icon, not color-only:
    ✓ TAKEN
    ! MISSED
    − SKIP / SKIPPED
    ⏰ SNOOZE
- Existing Taken/Missed/Skipped/Pending backend history remains authoritative.
- Existing 10-minute snooze and local notification behavior is preserved.

MY MEDICATIONS
- Doctor Prescriptions and My Added Medications are separated.
- Doctor prescriptions are read-only for patients.
- Patient-added medicines keep Edit and Stop controls.
- Stopping a patient-added medicine preserves history.

HISTORY & ADHERENCE
- 7-day adherence summary and bar view.
- 30-day adherence summary.
- Missed-dose history.
- Skipped-dose history.
- Completed, Stopped, and Changed medication history.
- Changed/Stopped medications are never deleted.

======================================================================
3. DOCTOR MEDICATION RECONCILIATION
======================================================================
New backend router:
  backend/routers/medication_reconciliation.py

New frontend workspace:
  /doctor/medication-reconciliation/{encounterId}

The Consultation Cockpit Medication section now opens this workspace.

Security requirements are enforced on the backend:
- Doctor role.
- Verified provider.
- Doctor must own the consultation.
- Consultation must still be active.
- Accepted patient care connection is required through Phase 10A/10D access control.

Reconciliation actions:
  Confirmed
  Changed
  Stopped
  Started

======================================================================
4. MEDICAL HISTORY PRESERVATION RULE
======================================================================
A medication change never overwrites the old prescription.

Example:
  Metformin 500 mg
       ↓ Changed
  Old record:
      active = false
      stoppedAt = timestamp
      reconciliationStatus = "changed"
      replacedByPrescriptionId = <new id>

  New record:
      Metformin 1000 mg
      active = true
      previousPrescriptionId = <old id>
      source = Doctor

Stopping behaves similarly:
  active = false
  stoppedAt = timestamp
  reconciliationStatus = "stopped"

The old record stays in prescriptions and patient_history.

======================================================================
5. NEW COLLECTION
======================================================================
medication_reconciliations

Each consultation gets one reconciliation record:
- encounterId
- patientId
- doctorId / doctorName
- status: in_progress | completed
- actions[]
- notes
- startedAt
- performedAt
- updatedAt

Each action can contain:
- actionId
- prescriptionId
- action: confirmed | changed | stopped | started
- reason
- newPrescriptionId when applicable
- medication names
- performedAt

Indexes are added in backend/database.py.
The encounterId is unique so one consultation has one reconciliation session.

======================================================================
6. IDEMPOTENCY / RETRY SAFETY
======================================================================
Each frontend reconciliation mutation includes a unique actionId.
If a browser/mobile retry sends the same action again, the backend returns the
existing reconciliation instead of creating a second medication record.

This is especially important for Changed and Started actions.

======================================================================
7. CONSULTATION COCKPIT INTEGRATION
======================================================================
Phase 10F already required medication review before completing a consultation.
Phase 10G connects that checklist item to the real reconciliation workspace.

When the doctor completes Medication Reconciliation:
- medication_reconciliations.status -> completed
- clinical_encounters.medicationReconciliationId is set
- clinical_encounters.medicationReview.reviewed -> true
- doctor notes are saved into medicationReview.notes
- encounter revision is incremented
- patient receives a medication-review notification
- a clinical access event is recorded

Returning to Consultation Cockpit reloads the encounter so the checklist shows:
  ✓ Completed

The consultation can then be completed normally.

======================================================================
8. COMPLETED VISIT / PATIENT SUMMARY
======================================================================
consultation_service.py now exposes a deliberately limited reconciliation summary.
The patient Visit Summary can show medication decisions such as:
- CONFIRMED
- CHANGED
- STOPPED
- STARTED

It does not expose the doctor's internal clinical notes beyond the existing
patient-facing medication-review notes and safe reconciliation summary.

======================================================================
9. PATIENT PRESCRIPTION SERIALIZATION
======================================================================
backend/routers/patient.py adds completionReason:
- Changed
- Stopped
- Completed

This allows the History & Adherence tab to distinguish why a medication left the
active plan without deleting or rewriting the record.

======================================================================
10. INSTALLATION
======================================================================
1. Back up the current project folder.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Do NOT delete or replace backend/.env.
5. No pip install is required.
6. No npm install is required.

Restart backend:

   cd "F:\Fyp retinopathy\backend"
   .\.venv\Scripts\Activate.ps1
   .\run-local-8001.ps1

Restart frontend:

   cd "F:\Fyp retinopathy\frontend"
   .\run-web-8081.ps1

======================================================================
11. RECOMMENDED END-TO-END TEST
======================================================================
A. PATIENT MEDICATION SCREEN
1. Login as Patient.
2. Open Medication.
3. Verify Today contains only current-day doses.
4. Mark a dose Taken, Missed, Skipped, then test Snooze.
5. Open My Medications.
6. Confirm doctor prescriptions cannot be edited.
7. Confirm self-added medications can be edited/stopped.
8. Open History & Adherence and verify 7/30-day information plus history.

B. DOCTOR RECONCILIATION
1. Login as a verified Doctor with an accepted patient connection.
2. Open a confirmed appointment and start/continue Consultation Cockpit.
3. Open Medication Reconciliation.
4. Confirm one medication.
5. Change another medication.
6. Stop another medication.
7. Start a new medication.
8. Complete Medication Review.
9. Return to Consultation Cockpit and verify Medication Reconciliation shows completed.

C. HISTORY SAFETY
After changing a medication inspect MongoDB prescriptions:
- old medication still exists
- old active=false
- old stoppedAt exists
- old replacedByPrescriptionId points to new record
- new medication is a separate active document

D. COMPLETE VISIT
1. Finish the Consultation Cockpit checklist.
2. Complete visit.
3. Login as Patient.
4. Open Visit Summary.
5. Verify safe medication reconciliation actions appear.

======================================================================
12. FILES IN THIS PATCH
======================================================================
NEW
- backend/routers/medication_reconciliation.py
- frontend/services/medicationReconciliation.ts
- frontend/app/doctor/medication-reconciliation/[id].tsx

UPDATED
- backend/main.py
- backend/database.py
- backend/routers/patient.py
- backend/consultation_service.py
- frontend/app/prescriptions.tsx
- frontend/app/doctor/consultation/[id].tsx
- frontend/app/visit-summary/[id].tsx
- frontend/services/prescriptions.ts
- frontend/services/consultations.ts

======================================================================
13. NEXT PHASE
======================================================================
The project is now ready for Phase 10H — Case Bookmark / Watchlist.
