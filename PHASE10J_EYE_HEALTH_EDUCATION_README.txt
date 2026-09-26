EyeCare AI / DR Healthcare
PHASE 10J — EYE HEALTH EDUCATION CENTER
========================================

PATCH BASIS
-----------
This replacement patch is designed to be applied on top of the completed
Phase 10A–10I project. It preserves the existing FastAPI + MongoDB backend,
Expo/React Native frontend, global theme system, provider verification,
care-connections, Privacy Center, Consultation Cockpit, medication
reconciliation, watchlist and Vision & Lens Vault.

INSTALLATION
------------
1. Back up the project folder.
2. Extract this ZIP directly into:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Keep the existing backend/.env unchanged.
5. No new pip package is required.
6. No new npm package is required.

WHAT PHASE 10J ADDS
-------------------
1. Patient navigation item:

   Learn & Eye Health

   Route:
   /education

2. Eye Health Library home screen
   - Recommended by Doctor
   - Search
   - Category filters
   - Latest Articles
   - Trusted Videos
   - English / Urdu presentation using the existing global language preference
   - Theme / Dark / Light / Eye-Friendly compatibility

3. Curated content remains local and version controlled

   frontend/content/educationContent.ts

   There is deliberately NO article CMS in this phase. Article content is not
   copied into MongoDB. If a future SuperAdmin CMS is added, the same article
   schema can be moved to education_content without redesigning the screens.

4. Required categories
   - Diabetic Retinopathy
   - Diabetes & Eye Health
   - Eye Screening
   - Eye Safety
   - Medication
   - Lifestyle
   - Warning Signs

5. Article schema
   - id
   - title
   - shortDescription
   - category
   - readingMinutes
   - image
   - content sections
   - languages
   - source
   - updatedAt

6. Bilingual content
   The core library contains English and Urdu versions where available. Urdu is
   rendered RTL and the article reader can switch between English and Urdu.

7. Offline-friendly article visuals
   Instead of downloading stock images or adding another image package, each
   article has an `image` key rendered through a built-in EyeCare educational
   artwork component. This keeps the content lightweight and avoids broken
   remote images while preserving the article image field in the schema.

8. Trusted external videos
   The initial video list contains official National Eye Institute / NIH links.
   Videos open externally. EyeCare AI does not upload, proxy or host video files.

CONSULTATION INTEGRATION
------------------------
Phase 10F already created `education_assignments` when a Doctor completes a
consultation. Phase 10J now exposes those assignments to the Patient through:

   GET /api/patient/education/assignments

and displays matching local articles as:

   Recommended by Dr. <name>

Opening an assigned article records only viewing state:

   PATCH /api/patient/education/assignments/{assignmentId}/viewed

This updates `status=viewed` and `viewedAt`. It does not copy article content
into MongoDB and does not expose another patient's assignments.

DOCTOR CONSULTATION
-------------------
The existing Consultation Cockpit's Assign Education section remains the source
of doctor assignments. The server-side education options were expanded to align
with the local article library while preserving every old topic key.

Assignment becomes visible to the patient only after the consultation completion
flow creates the existing `education_assignments` record.

DATA OWNERSHIP
--------------
Authoritative article content:
   frontend/content/educationContent.ts

Doctor assignment metadata:
   MongoDB education_assignments

No new education_content collection is created in Phase 10J.

No full CMS is added.

No video file storage is added.

SECURITY / PRIVACY
------------------
- /api/patient/education/* is Patient-role only.
- Assignment queries always include the authenticated patient ID.
- A patient cannot mark another patient's assignment as viewed.
- Articles contain general education only, not patient clinical data.
- Doctor recommendation metadata contains topic, doctor and assignment timing;
  it does not duplicate the encounter's private clinical notes.
- Source/video links are opened externally only after user action.

FILES ADDED
-----------
backend/routers/education.py
frontend/content/educationContent.ts
frontend/services/education.ts
frontend/components/education/EducationArtwork.tsx
frontend/app/education/index.tsx
frontend/app/education/[id].tsx

FILES UPDATED
-------------
backend/main.py
backend/consultation_service.py
frontend/design/components/AppShell.tsx
frontend/app/tabs/dashboard.tsx
frontend/app/doctor/consultation/[id].tsx

RUN
---
Backend:

cd "F:\Fyp retinopathy\backend"
.\.venv\Scripts\Activate.ps1
.\run-local-8001.ps1

Frontend:

cd "F:\Fyp retinopathy\frontend"
.\run-web-8081.ps1

END-TO-END TEST
---------------
A. BASIC LIBRARY
1. Login as Patient.
2. Open Learn & Eye Health.
3. Confirm EYE HEALTH LIBRARY opens.
4. Search for "retinopathy".
5. Test DR Basics / Screening / Diabetes / Eye Safety filters.
6. Open an article.
7. Switch English -> اردو -> English.
8. Open the source link.
9. Test Light / Dark / Eye-Friendly mode.

B. DOCTOR ASSIGNMENT
1. Login as a verified Doctor with an accepted patient connection.
2. Start or continue a Consultation.
3. Under Assign Education choose, for example:
      Understanding Moderate DR
      Diabetes and Eye Health
4. Complete the consultation.
5. Login as that Patient.
6. Open Learn & Eye Health.
7. The Recommended for You section should show:
      Recommended by Dr. <doctor name>
8. Open the assigned article.
9. In MongoDB education_assignments confirm status changes from assigned to viewed.

C. PRIVACY CHECK
1. Login as Patient A and note one assignment ID.
2. Login as Patient B.
3. Direct PATCH of Patient A's assignment ID must return 404.
4. No clinical notes or other encounter internals should appear in the library API.

D. STATIC CONTENT CHECK
1. Stop the backend temporarily.
2. Existing local articles should still render if you navigate directly to them;
   only the Recommended by Doctor list depends on the backend.

FUTURE CMS PATH
---------------
If SuperAdmin editing is later required, move the same EducationArticle schema to
an `education_content` collection and replace the local content loader with an API.
The current screens, IDs and consultation topic keys are intentionally structured
so that migration does not require a UI redesign.
