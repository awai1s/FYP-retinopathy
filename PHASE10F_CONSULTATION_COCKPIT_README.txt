EyeCare AI / DR Healthcare
PHASE 10F — CONSULTATION COCKPIT
Complete replacement patch
Prepared: September 2026

======================================================================
1. PATCH BASIS
======================================================================

This patch is built on the latest project state after Phase 10A through Phase
10E. It does NOT create a second appointment, medication, report, screening,
or patient-history system.

It reuses the current authoritative collections:
- appointments
- predictions
- health_metrics
- prescriptions
- reports / GridFS
- patient_history
- notifications
- care_connections
- provider_verifications
- clinical_access_logs

Phase 10F adds a real clinical encounter layer on top of confirmed
appointments.

No new pip package is required.
No new npm package is required.
No .env setting is required for this phase.
The existing backend 8001 / frontend 8081 local setup is preserved.

======================================================================
2. MAIN CLINICAL FLOW
======================================================================

Patient books appointment
        ↓
Doctor confirms appointment
        ↓
[ START CONSULTATION ]
        ↓
Backend verifies:
- authenticated Doctor
- verified + active provider
- doctor owns appointment
- appointment is Confirmed
- accepted Doctor ↔ Patient care connection exists
        ↓
clinical_encounters record is created once
        ↓
Consultation Cockpit
        ↓
Findings / observations / medication review / procedures /
education / clinical notes / instructions / next action / follow-up
        ↓
Autosave
        ↓
[ COMPLETE VISIT ]
        ↓
encounter = completed
appointment = Completed
patient_history event added
follow-up task created if requested
education assignments created if selected
patient notification created
        ↓
Doctor gets read-only encounter + addenda
Patient gets simplified Visit Summary

======================================================================
3. NEW BACKEND COLLECTIONS
======================================================================

clinical_encounters
-------------------
One encounter per appointment.

Main fields:
- appointmentId
- patientId / patientName
- doctorId / doctorName
- reasonForVisit
- status: draft | in_progress | completed
- startedAt / completedAt
- findings[]
- observations[]
- procedures[]
- clinicalNotes
- medicationReconciliationId
- medicationReview
- educationAssignments[]
- nextAction
- patientInstructions
- followUp
- revision
- createdAt / updatedAt

Completed encounters also receive a small immutable completionSnapshot of the
encounter-owned clinical decisions. Live screening/HbA1c/medication/report data
is NOT copied into that snapshot.

clinical_encounter_addenda
--------------------------
Corrections after completion are appended here instead of silently rewriting a
completed encounter.

clinical_follow_ups
-------------------
Created idempotently when the consultation chooses Follow-up.

education_assignments
---------------------
Created from the consultation's selected education topics. Phase 10J can use
these directly to show "Recommended by Dr. X" inside the Education Center.

======================================================================
4. LIVE PATIENT CONTEXT — NO DUPLICATE CLINICAL DATA
======================================================================

The Consultation Cockpit's "Recent Clinical Information" is assembled live
from the existing authoritative collections:

Latest Screening  -> predictions
Latest HbA1c       -> health_metrics
Current Medication -> prescriptions
Recent Reports     -> reports
Last Consultation  -> clinical_encounters

The encounter does not permanently duplicate those values.

This means the doctor always sees the latest current context while the actual
encounter record only stores what happened during that visit.

======================================================================
5. CONSULTATION COCKPIT FEATURES
======================================================================

A. Findings
- Finding
- Severity: Not specified / Mild / Moderate / Severe
- Eye: Not specified / Right / Left / Both
- Note

B. Observations
- Observation
- Clinical note
- Recorded time
- Doctor ID / name

C. Medication Review
- Displays current active medication from existing prescriptions
- Doctor confirms the current medication list was reviewed
- Review notes can be recorded
- Does NOT overwrite prescriptions
- medicationReconciliationId remains ready for Phase 10G

D. Procedures
- Procedure Type
- Result / Outcome
- Notes

Phase 10N can later enforce hospital privileges for procedure types without
redesigning the encounter schema.

E. Education
Built-in Phase 10F assignment options:
- Understanding Diabetic Retinopathy
- Understanding Moderate DR
- Diabetes and Eye Health
- Eye Screening and Follow-up
- Eye Warning Signs

Selected items are stored in education_assignments on completion.

F. Clinical Notes
Doctor-only clinical notes are part of the encounter.
They are NOT automatically exposed in the simplified patient summary.

G. Patient Instructions
Patient-facing instructions become part of the Visit Summary.

H. Next Action
- No immediate action
- Follow-up
- New screening
- Referral
- Medication change
- Further investigation

I. Follow-up
When required:
- YYYY-MM-DD due date is validated
- reason is required
- clinical_follow_ups receives one idempotent record

======================================================================
6. AUTOSAVE / DRAFT RECOVERY
======================================================================

The Cockpit autosaves after meaningful edits.

Every backend save:
- updates updatedAt
- increments revision
- keeps the encounter in_progress

If the doctor closes the browser/app and returns later, the appointment and
Consultations screens detect the existing encounter and show:

Consultation Draft Found
[ Continue Consultation ]

The doctor also has a manual [ Save Draft ] button.

======================================================================
7. COMPLETION CHECKLIST
======================================================================

Before COMPLETE VISIT succeeds, the backend requires:
- Clinical notes completed
- Medication reviewed
- Patient instructions added
- Follow-up / next-action decision recorded

If follow-up is selected:
- Follow-up date required
- Follow-up date must be YYYY-MM-DD
- Follow-up reason required

The frontend shows the same checklist, but the backend remains authoritative.
Direct API calls cannot bypass it.

======================================================================
8. COMPLETION SIDE EFFECTS
======================================================================

Completion is designed to be retry-safe / idempotent where possible.

1. Encounter -> completed
2. Associated appointment -> Completed
3. patient_history gets/upserts a Consultation event
4. clinical_follow_ups gets/upserts follow-up when requested
5. education_assignments gets/upserts selected topics
6. Patient receives one "Visit summary ready" notification
7. Clinical access event COMPLETE_CONSULTATION is recorded

The existing Doctor appointment status API can no longer be used to mark a
visit Completed before the Consultation Cockpit has been completed.

======================================================================
9. COMPLETED ENCOUNTERS ARE IMMUTABLE
======================================================================

PATCH /api/consultations/{id}
returns 409 after completion.

The original completed encounter is not silently edited.

Corrections use:
POST /api/consultations/{id}/addenda

Each addendum stores:
- encounterId
- patientId
- doctorId / doctorName
- text
- createdAt

There is no edit/delete endpoint for addenda in this phase.

======================================================================
10. CONNECTION REVOCATION / HISTORICAL RECORD RULE
======================================================================

Ongoing consultation actions require the accepted Phase 10D care connection.
If the patient revokes access while a consultation is still in progress, the
doctor can no longer continue editing the patient's current clinical data.

Completed encounters are different:
- the authoring verified Doctor may retain/view the historical encounter they
  created even after the care connection is later revoked;
- live current patient context is NOT returned without an accepted connection;
- the doctor can add a dated addendum to their own completed encounter;
- this historical access does not restore general access to current patient
  profile, reports, medication, screening or other clinical resources.

This preserves medical history without turning an old encounter into an access
bypass.

======================================================================
11. PATIENT EXPERIENCE
======================================================================

Patient Appointments now receives encounter metadata.

Completed appointment with a completed encounter:
[ View Visit Summary ]

The simplified Visit Summary contains:
- Doctor
- Visit reason
- Completion time
- Medication review summary
- Patient instructions
- Next action
- Follow-up date/reason
- Procedures
- Assigned education
- Addenda

It intentionally does NOT expose the doctor's full private clinical notes.

When a doctor starts a consultation, the patient cannot cancel that visit from
the appointment screen anymore.

======================================================================
12. PRIVACY CENTER INTEGRATION
======================================================================

Phase 10F continues using the Phase 10A/10E clinical_access_logs foundation.
Meaningful actions include:
- START_CONSULTATION
- VIEW_CONSULTATION
- COMPLETE_CONSULTATION
- ADD_CONSULTATION_ADDENDUM

Privacy & Access has friendly labels for these actions.

Normal autosave requests are NOT written as patient-visible access events, so
an active consultation does not flood the Privacy Center.

======================================================================
13. FRONTEND ROUTES ADDED
======================================================================

Doctor:
- /doctor/consultations
- /doctor/consultation/{encounterId}

Patient:
- /visit-summary/{encounterId}

Doctor navigation now includes:
- Consultations

Doctor Dashboard and Doctor Appointments can both Start / Continue a confirmed
consultation.

======================================================================
14. BACKEND API ADDED
======================================================================

GET  /api/consultations/education-options
POST /api/consultations/from-appointment/{appointmentId}
GET  /api/consultations/doctor
GET  /api/consultations/patient
GET  /api/consultations/{encounterId}
PATCH /api/consultations/{encounterId}
POST /api/consultations/{encounterId}/complete
POST /api/consultations/{encounterId}/addenda

======================================================================
15. DATABASE INDEXES ADDED
======================================================================

clinical_encounters
- appointmentId unique where possible
- doctorId + status + updatedAt
- patientId + status + completedAt
- patientId + completedAt

clinical_encounter_addenda
- encounterId + createdAt

clinical_follow_ups
- encounterId unique
- patientId + status + dueDate
- doctorId + status + dueDate

education_assignments
- encounterId + topicKey unique
- patientId + status + assignedAt

patient_history
- patientId + sourceId + type

======================================================================
16. INSTALLATION
======================================================================

1. Back up your current project folder.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Keep your existing backend/.env.
5. Do NOT run npm install for this phase.
6. Do NOT run pip install for this phase.

Restart backend:

cd "F:\Fyp retinopathy\backend"
.\.venv\Scripts\Activate.ps1
.\run-local-8001.ps1

Restart frontend:

cd "F:\Fyp retinopathy\frontend"
.\run-web-8081.ps1

======================================================================
17. REQUIRED SECURITY SETTINGS FROM EARLIER PHASES
======================================================================

Keep the Phase 10C/10D secure configuration:

ENFORCE_PROVIDER_VERIFICATION=true
REQUIRE_PATIENT_CONNECTION=true
ALLOW_LEGACY_CLINICAL_RELATIONSHIPS=false

Phase 10F does not introduce a new environment variable.

======================================================================
18. RECOMMENDED END-TO-END TEST
======================================================================

A. PRECONDITIONS
1. Login as a verified + active Doctor.
2. Use a Patient with an accepted Phase 10D care connection.
3. Patient books an appointment with that Doctor.
4. Doctor confirms it.

B. START
1. Doctor -> Appointments.
2. Open confirmed visit.
3. Press START CONSULTATION.
4. Expected: Cockpit opens.
5. MongoDB: one clinical_encounters record exists for appointmentId.
6. Repeating start must reuse the same encounter, not create a duplicate.

C. LIVE CONTEXT
Confirm Cockpit reads current:
- latest completed screening
- latest HbA1c
- active medication
- reports
- last consultation

D. AUTOSAVE
1. Add a finding.
2. Add an observation.
3. Add notes.
4. Wait about one second.
5. Refresh/close/reopen.
6. Expected: Consultation Draft Found and saved content restored.

E. COMPLETION SECURITY
Try COMPLETE VISIT without required items.
Expected: blocked by checklist/backend 422.

Then complete:
- clinical notes
- medication reviewed
- patient instructions
- next action
- follow-up date/reason if applicable

Press COMPLETE VISIT.

Expected:
- encounter status completed
- appointment Completed
- patient_history Consultation event
- Visit summary notification
- follow-up record if selected
- education assignment records if selected

F. IMMUTABILITY
After completion:
1. Cockpit is read-only.
2. Direct PATCH should return 409.
3. Add an Addendum.
4. Original encounter remains unchanged; new addendum record appears.

G. PATIENT
1. Login as Patient.
2. Appointments -> Past Visit Records.
3. Press View Visit Summary.
4. Confirm patient instructions / next action / follow-up are visible.
5. Full doctor clinicalNotes must NOT be exposed in the patient summary.

H. CONNECTION REVOCATION
1. Complete a consultation.
2. Patient removes Doctor connection.
3. Doctor must lose general/current patient clinical access.
4. Doctor may still open their own completed historical encounter.
5. That historical encounter must NOT include live current patient context.

======================================================================
19. FILES CHANGED BY THIS PATCH
======================================================================

NEW
- PHASE10F_CONSULTATION_COCKPIT_README.txt
- backend/consultation_service.py
- backend/routers/consultations.py
- frontend/services/consultations.ts
- frontend/app/doctor/consultations.tsx
- frontend/app/doctor/consultation/[id].tsx
- frontend/app/visit-summary/[id].tsx

UPDATED
- backend/database.py
- backend/main.py
- backend/routers/appointments.py
- backend/routers/privacy.py
- frontend/services/appointment.ts
- frontend/services/notification.ts
- frontend/app/doctor/appointments.tsx
- frontend/app/doctor/dashboard.tsx
- frontend/app/doctor/_layout.tsx
- frontend/app/appointments.tsx
- frontend/app/notifications.tsx
- frontend/design/components/AppShell.tsx

======================================================================
20. PHASE BOUNDARY
======================================================================

Phase 10F deliberately does NOT implement full Medication Reconciliation.
It records that medication was reviewed and preserves medication-review notes.

Phase 10G can now add Confirm / Change / Stop / Start New Medication against
this encounter using the existing medicationReconciliationId field without
redesigning the Consultation Cockpit.
