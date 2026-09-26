EyeCare AI / DR Healthcare
PHASE 10M — HOSPITAL EYE EQUIPMENT LIFECYCLE MANAGER
Complete replacement patch
Prepared: September 2026

======================================================================
1. PURPOSE
======================================================================

Phase 10M turns the Hospital role into a real operational portal for eye-care
hardware. It adds lifecycle management for ophthalmic equipment without mixing
asset/service history into patient clinical collections.

This patch is built on top of the current EyeCare AI architecture through
Phase 10L and preserves:
- Phase 10A centralized authorization/security
- Phase 10B dynamic Light/Dark/Eye-Friendly theme
- Phase 10C verified Provider workflow
- Phase 10D formal care connections
- Phase 10E Privacy + secure QR
- Phase 10F Consultation Cockpit
- Phase 10G Medication Reconciliation
- Phase 10H Doctor Watchlist
- Phase 10I Vision & Lens Vault
- Phase 10J Eye Health Education
- Phase 10K Vision Simulator
- Phase 10L Offline Mode

No new pip package is required.
No new npm package is required.
No .env replacement is required.

======================================================================
2. INSTALLATION
======================================================================

1. Back up the current project folder.
2. Extract the ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Keep your existing backend/.env.
5. Restart both backend and frontend.

Backend:

   cd "F:\Fyp retinopathy\backend"
   .\.venv\Scripts\Activate.ps1
   .\run-local-8001.ps1

Frontend:

   cd "F:\Fyp retinopathy\frontend"
   .\run-web-8081.ps1

MongoDB indexes are created automatically at backend startup.

======================================================================
3. HOSPITAL NAVIGATION
======================================================================

A verified + active Hospital account now receives:

   Equipment

in the Hospital navigation.

Pending/unverified/suspended Hospital accounts do NOT receive equipment access.
The existing Phase 10C route protection and backend VerifiedProviderChecker
remain the security mechanism.

Main routes:

   /hospital/equipment
   /hospital/equipment/new
   /hospital/equipment/{equipmentId}
   /hospital/equipment/{equipmentId}/edit
   /hospital/equipment/{equipmentId}/event

The Hospital Dashboard also gets an Eye Equipment operational summary with:
- Active Devices
- Service Due
- Calibration Due
- Out of Service

======================================================================
4. SUPPORTED EQUIPMENT CATEGORIES
======================================================================

- Fundus Camera
- OCT Scanner
- Slit Lamp
- Retinal Laser
- Visual Field Analyzer
- Tonometer
- Other

The architecture intentionally uses a controlled category list while keeping
"Other" available for equipment not covered by the initial FYP taxonomy.

======================================================================
5. EQUIPMENT MASTER RECORD
======================================================================

New collection:

   eye_equipment

Each record includes:
- hospitalId
- assetId
- deviceName
- type
- manufacturer
- model
- serialNumber
- department
- location
- purchaseDate
- status
- lastService
- nextService
- lastCalibration
- nextCalibration
- notes
- createdByUserId
- createdAt
- updatedAt
- optional downtime/retirement timestamps

Asset ID is normalized to uppercase and is unique PER HOSPITAL.
Therefore two different hospitals may both use asset ID "OCT-001", while one
hospital cannot accidentally create OCT-001 twice.

There is deliberately NO hard delete endpoint.
Lifecycle history should be retained. Permanent removal is represented by a
RETIREMENT event.

======================================================================
6. STATUS MODEL
======================================================================

Visible statuses:

   Operational
   Service Due
   Calibration Due
   Under Maintenance
   Out of Service
   Retired

The database stores explicit operational states:

   Operational
   Under Maintenance
   Out of Service
   Retired

Service Due / Calibration Due are DERIVED from the next due dates so status
cannot become stale merely because the date changed overnight.

Explicit non-operational states take priority on the device badge:
- Retired
- Out of Service
- Under Maintenance

Service/calibration due counters are still calculated independently, so a
maintenance device can still be visible as overdue in operational metrics.

======================================================================
7. LIFECYCLE EVENTS
======================================================================

New collection:

   equipment_events

Supported event types exactly match the Phase 10M plan:

   SERVICE
   CALIBRATION
   DOWNTIME_START
   DOWNTIME_END
   REPAIR
   STATUS_CHANGE
   RETIREMENT

Each event can preserve:
- equipmentId
- hospitalId
- assetId snapshot
- eventType
- eventDate
- nextDueDate where applicable
- targetStatus where applicable
- performedBy / vendor
- reference / work-order number
- optional cost
- notes
- createdByUserId
- createdAt

Service/calibration history is NOT embedded into the equipment master document.
The master record stores only the current schedule fields; full history lives in
equipment_events.

======================================================================
8. EVENT BUSINESS RULES
======================================================================

SERVICE
- updates lastService
- optionally updates nextService
- creates an immutable lifecycle event

CALIBRATION
- updates lastCalibration
- optionally updates nextCalibration
- creates an immutable lifecycle event

DOWNTIME_START
- changes device status to Out of Service
- records downtimeStartedAt
- cannot be started twice

DOWNTIME_END
- only allowed while device is Out of Service
- returns status to Operational
- closes the downtime timestamp

REPAIR
- records repair details
- can return device to Operational or another allowed non-retired state

STATUS_CHANGE
- supports Operational / Under Maintenance / Out of Service
- cannot be used to bypass proper retirement

RETIREMENT
- marks the asset Retired
- records retiredAt
- preserves the equipment and all lifecycle events
- retired devices are read-only and cannot be reactivated

Date validation:
- date format is YYYY-MM-DD
- next service cannot be earlier than last service
- next calibration cannot be earlier than last calibration
- event nextDueDate cannot be earlier than eventDate

======================================================================
9. MAIN EQUIPMENT PAGE
======================================================================

The Equipment page contains:

EYE EQUIPMENT

Active Devices
Service Due
Calibration Due
Out of Service

It also includes:
- search by asset/device/manufacturer/model/serial/department/location
- type filter
- status filter
- due-within-7-days warning
- responsive equipment cards
- next service/calibration dates
- quick access to each lifecycle record
- Add Device action

The interface uses the existing Phase 10B semantic theme bridge, so it works
with Light, Dark, System, Eye-Friendly, and text-size preferences.

======================================================================
10. DEVICE DETAIL PAGE
======================================================================

Example:

   Fundus Camera FC-002
   Canon XYZ
   Retina Department

   STATUS
   Operational

   SERVICE
   Last: 12 Jun 2026
   Next: 12 Dec 2026

   CALIBRATION
   Last: 20 Aug 2026
   Next: 20 Nov 2026

Actions include:

   SERVICE RECORD
   CALIBRATE
   REPORT DOWNTIME / END DOWNTIME
   REPAIR
   CHANGE STATUS
   EDIT ASSET
   RETIRE DEVICE

The same screen also contains the chronological lifecycle history.

======================================================================
11. DUE NOTIFICATIONS
======================================================================

Phase 10M adds Hospital equipment notifications without introducing Celery,
Redis workers, cron infrastructure, or a paid scheduler.

When a verified Hospital checks its dashboard/equipment/notifications, the
backend refreshes due reminders idempotently.

Reminder windows:
- within 30 days
- within 7 days
- due today
- overdue

Example:

   OCT-003 calibration is due in 7 days.

Notification type:

   equipment

Tapping the notification opens the exact equipment lifecycle page.

Duplicate prevention:
- deterministic equipmentReminderKey
- upsert-based creation
- unique sparse MongoDB index where possible

Repeated refreshes therefore do not create the same reminder again.

======================================================================
12. DATABASE INDEXES
======================================================================

eye_equipment
- UNIQUE hospitalId + assetId
- hospitalId + type + status
- hospitalId + nextService
- hospitalId + nextCalibration
- hospitalId + serialNumber

equipment_events
- hospitalId + equipmentId + eventDate
- hospitalId + eventType + createdAt

notifications
- userId + type + equipmentReminderKey

======================================================================
13. SECURITY / OWNERSHIP
======================================================================

All equipment endpoints require:

1. authenticated user
2. Hospital role
3. verified provider
4. active account

Every equipment read/update/event query also checks:

   hospitalId == logged-in Hospital user ID

Therefore one Hospital cannot read or modify another Hospital's equipment by
guessing a MongoDB ObjectId.

Operational equipment actions also create the existing Hospital audit-log
metadata records. No patient clinical data is copied into equipment records.

======================================================================
14. BACKEND API
======================================================================

GET    /api/hospital/equipment/summary
GET    /api/hospital/equipment
POST   /api/hospital/equipment
GET    /api/hospital/equipment/{equipmentId}
PATCH  /api/hospital/equipment/{equipmentId}
GET    /api/hospital/equipment/{equipmentId}/events
POST   /api/hospital/equipment/{equipmentId}/events

No DELETE endpoint is intentionally provided.

======================================================================
15. FUTURE SCREENING INTEGRATION
======================================================================

Phase 10M does NOT alter the current screening/prediction contract.

Each equipment record already has a stable MongoDB ID. A later version can add:

   predictions.equipmentId

or equivalent screening metadata to record which Fundus Camera/OCT produced an
image. That can be added without redesigning the equipment lifecycle system.

======================================================================
16. RECOMMENDED END-TO-END TEST
======================================================================

A. Access control
1. Login as pending Hospital -> Equipment should remain unavailable.
2. Login as verified + active Hospital -> Equipment navigation appears.

B. Create
1. Open Equipment -> Add Device.
2. Add:
      Asset ID: FC-002
      Device Name: Fundus Camera
      Type: Fundus Camera
      Department: Retina Department
3. Save.
4. Try FC-002 again -> expect HTTP/UI conflict instead of duplicate record.

C. Service
1. Open FC-002.
2. Add SERVICE event.
3. Set event date and next service date.
4. Confirm master Last/Next Service changed.
5. Confirm service event appears in Lifecycle History.

D. Calibration
1. Add CALIBRATION event.
2. Confirm Last/Next Calibration changed.
3. Confirm event history remains intact.

E. Downtime
1. REPORT DOWNTIME -> status becomes Out of Service.
2. Repeat start -> should be rejected.
3. END DOWNTIME -> status returns Operational.

F. Maintenance
1. Change Status -> Under Maintenance.
2. Confirm dashboard operational counts update.

G. Notifications
1. Set next calibration within 7 days.
2. Open Notifications.
3. Confirm equipment reminder appears once.
4. Refresh repeatedly -> no duplicate reminder for same due window.
5. Tap reminder -> exact device opens.

H. Retirement
1. Retire a test device.
2. Confirm device remains visible as Retired.
3. Confirm full event history remains.
4. Confirm attempts to reactivate/edit lifecycle are denied.

I. Cross-hospital security
1. Capture an equipment ID from Hospital A.
2. Login as Hospital B.
3. Call/open that equipment ID.
4. Expected: 404 Equipment not found.

======================================================================
17. FILES ADDED / CHANGED
======================================================================

NEW BACKEND
- backend/equipment_service.py
- backend/routers/equipment.py

UPDATED BACKEND
- backend/database.py
- backend/main.py
- backend/routers/notifications.py

NEW FRONTEND
- frontend/services/equipment.ts
- frontend/components/hospital/EquipmentForm.tsx
- frontend/app/hospital/equipment/index.tsx
- frontend/app/hospital/equipment/new.tsx
- frontend/app/hospital/equipment/[id]/index.tsx
- frontend/app/hospital/equipment/[id]/edit.tsx
- frontend/app/hospital/equipment/[id]/event.tsx

UPDATED FRONTEND
- frontend/design/components/AppShell.tsx
- frontend/app/hospital/dashboard.tsx
- frontend/services/notification.ts
- frontend/app/notifications.tsx

======================================================================
18. PHASE OUTCOME
======================================================================

Hospital accounts now manage operational ophthalmic assets instead of acting
only as report repositories. Equipment readiness, service, calibration,
downtime, repairs, retirement and lifecycle history are represented explicitly,
with verified ownership and due-date reminders.

This architecture is ready for the next Hospital operational phase without
copying lifecycle history into clinical patient records.
