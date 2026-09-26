EyeCare AI / DR Healthcare
PHASE 10K — VISION EXPERIENCE SIMULATOR
Complete replacement patch
Prepared: September 2026

======================================================================
1. PURPOSE
======================================================================

Phase 10K adds an interactive, local Vision Experience Simulator to EyeCare AI.
The goal is educational demonstration — not diagnosis and not a prediction of a
patient's personal eyesight.

The feature intentionally does NOT add another AI model or image-processing
backend. It uses a deterministic local rendering pipeline built from components
already present in the Expo project.

Core pipeline:

    Base Scene / Local Photo
            ↓
       Preset Matrix
            ↓
        Blur Layer
            ↓
       Contrast Wash
            ↓
      Glare Overlay
            ↓
   Soft Obscuration Masks
            ↓
      Floater Overlays
            ↓
  Draggable Comparison Clip
            ↓
       Displayed Result

This gives the FYP a visible engineering pipeline that can be explained and
inspected instead of hiding the behavior behind a black-box generation API.

======================================================================
2. WHAT IS IMPLEMENTED
======================================================================

A. NEW PATIENT PAGE
-------------------
Route:

    /vision-simulator

Navigation label:

    Vision Simulator

The page is also linked from:
- Patient Dashboard
- Learn & Eye Health / Eye Health Library
- Completed retinal screening result

B. FIVE BUILT-IN SCENES
-----------------------
The simulator contains five responsive native illustrated scenes:

- Reading
- Driving
- Street
- Face
- Phone

These are drawn with React Native views + Expo LinearGradient instead of remote
stock images, so they work offline and do not add image-download dependencies.

C. USE MY OWN IMAGE
-------------------
The patient can choose an image from the device photo library.

Important behavior:
- the simulator does not call any backend endpoint for that image;
- the selected image is not uploaded by this feature;
- it is not inserted into MongoDB/GridFS;
- it is used only by the local simulator UI for the current screen/session.

This reduces unnecessary exposure of personal photos.

IMPORTANT COMPLIANCE NOTE:
Local processing is a privacy advantage, but local-only image handling by itself
does NOT make the entire application automatically HIPAA- or GDPR-compliant.
Compliance depends on the complete system, deployment, policies, access control,
contracts, logging, retention, security controls, and jurisdiction.

D. DRAGGABLE ORIGINAL ↔ SIMULATION COMPARISON
---------------------------------------------
The simulator displays one scene with a draggable vertical comparison line.

Left side:
    ORIGINAL / NORMAL

Right side:
    EDUCATIONAL SIMULATION

The line can be dragged horizontally. The control also exposes accessibility
increment/decrement actions for assistive technologies.

E. GENERAL SEVERITY PRESETS
---------------------------

- Normal
- Mild
- Moderate
- Severe
- Advanced

Each preset selects a deterministic mix of:
- blur intensity
- contrast wash
- obscuration strength
- floater opacity/count
- glare strength

The UI deliberately calls these RENDERING INTENSITIES rather than clinical
measurements.

F. DR ILLUSTRATION PRESETS
--------------------------

- No DR
- Mild DR
- Moderate DR
- Severe DR
- Proliferative DR

These names select educational effect presets only.

The application explicitly warns:

    DR stage does not map one-to-one to subjective vision.

For example, Mild DR may cause no noticeable symptoms. Therefore the simulator
does NOT claim that a patient with a particular DR stage will see exactly what
is rendered on screen.

G. LAYER INSPECTOR
------------------
Each rendering layer can be switched ON/OFF independently:

- Clarity / blur
- Contrast
- Obscuration
- Floaters
- Glare

This is useful in a demo or viva because the examiner can see exactly which
layer produces which effect.

H. EFFECT MIX PANEL
-------------------
The page displays relative rendering strength such as:

    Clarity reduction  — Moderate
    Contrast wash      — Light
    Obscuration        — Moderate
    Floaters            — Moderate
    Glare               — Light

These are deliberately qualitative rendering labels.

The simulator does NOT display misleading values such as:
- "Visual acuity 20/80"
- "Retina damage 40%"
- a claimed clinical field-loss percentage

because this renderer has not clinically measured those values.

I. SCREENING RESULT INTEGRATION
-------------------------------
A completed retinal result now includes:

    Explore Educational Vision Simulation

The result passes the available DR stage/diagnosis into the simulator.
The simulator automatically opens DR illustration mode and maps common labels:

    No DR            -> No DR
    Mild             -> Mild DR
    Moderate         -> Moderate DR
    Severe           -> Severe DR
    Proliferative    -> Proliferative DR

The result page also displays a warning that stage does not predict exactly what
the patient sees.

J. EDUCATION CENTER INTEGRATION
-------------------------------
Learn & Eye Health now contains an Interactive Learning card that opens the
Vision Experience Simulator.

K. DASHBOARD INTEGRATION
------------------------
Patient Dashboard now contains a Vision Simulator care-tool card.

L. APPEARANCE / ACCESSIBILITY INTEGRATION
-----------------------------------------
The simulator uses the existing Phase 10B design tokens and theme refresh layer.
It therefore remains compatible with:

- Light mode
- Dark mode
- System theme
- Eye-Friendly mode
- larger text settings

The simulation artwork itself intentionally keeps stable scene colors because it
represents the source visual scene, while the surrounding application UI follows
the active EyeCare theme.

======================================================================
3. IMPLEMENTATION DESIGN
======================================================================

NEW:

frontend/app/vision-simulator.tsx
    Main simulator page, controls, disclaimer, local photo picker, mode switch,
    layer inspector, effect mix and engineering pipeline explanation.

frontend/components/vision-simulator/SimulationCanvas.tsx
    Comparison canvas, clipped simulated region, BlurView, contrast wash, glare,
    deterministic soft masks, deterministic floater overlays and draggable line.

frontend/components/vision-simulator/SceneArtwork.tsx
    Five responsive offline illustrated scenes.

frontend/content/visionSimulationPresets.ts
    Typed preset matrix and DR-stage mapping.

UPDATED:

frontend/design/components/AppShell.tsx
    Adds Vision Simulator to Patient navigation.

frontend/app/tabs/dashboard.tsx
    Adds dashboard shortcut.

frontend/app/education/index.tsx
    Adds Interactive Learning entry.

frontend/app/result.tsx
    Adds post-screening simulator entry with DR-stage preselection.

======================================================================
4. WHY THE IMPLEMENTATION DOES NOT REQUIRE NEW PACKAGES
======================================================================

The current project already has the required packages:

- expo-blur
- expo-linear-gradient
- expo-image-picker
- @expo/vector-icons
- React Native / Expo Router

Therefore this patch does NOT modify package.json and requires NO new npm command.

The suggestion to use masked-view/SVG is conceptually valid, but adding a new
masking dependency is unnecessary for the current architecture. The patch uses a
clipped simulated region plus nested soft native overlays, which provides the
same comparison architecture while keeping the existing dependency graph stable.

======================================================================
5. PRIVACY / SAFETY RULES
======================================================================

1. No selected personal photo is uploaded by the simulator.
2. No new backend API or database collection is created for Phase 10K.
3. The simulator does not store a personal-image copy in EyeCare AI clinical data.
4. DR presets are labelled illustrative.
5. The simulator is not a vision test.
6. It does not calculate visual acuity.
7. It does not calculate retinal damage percentages.
8. It does not decide whether treatment is required.
9. It does not replace urgent eye assessment or clinician advice.

The final screen also reminds users that sudden vision loss, new flashes/floaters
or a curtain-like shadow can require urgent eye assessment.

======================================================================
6. INSTALLATION
======================================================================

1. Back up your current project folder.
2. Extract this ZIP directly into:

       F:\Fyp retinopathy\

3. Choose "Replace files in destination".
4. Do NOT delete or replace backend/.env.
5. No pip install is required.
6. No npm install is required.

Restart frontend:

    cd "F:\Fyp retinopathy\frontend"
    .\run-web-8081.ps1

Backend changes are not required by Phase 10K, but it can remain running normally
on port 8001 for the rest of EyeCare AI.

======================================================================
7. END-TO-END TEST PLAN
======================================================================

TEST A — BASIC ROUTE
1. Login as Patient.
2. Open sidebar.
3. Select Vision Simulator.
4. Confirm the page opens without backend calls/errors.

TEST B — BUILT-IN SCENES
1. Select Reading, Driving, Street, Face and Phone.
2. Confirm each scene changes immediately.
3. Confirm no remote-image loading spinner is required.

TEST C — DRAG COMPARISON
1. Drag the vertical comparison line left/right.
2. Confirm the left side remains original.
3. Confirm the right side shows only the simulated effects.

TEST D — GENERAL PRESETS
Test:
    Normal -> Mild -> Moderate -> Severe -> Advanced

Confirm effects progressively become stronger.

TEST E — DR PRESETS
Switch to DR illustration mode and test all five DR labels.
Confirm the DR disclaimer remains visible.

TEST F — LAYER INSPECTOR
Turn Blur OFF.
Turn Contrast OFF.
Turn Obscuration OFF.
Turn Floaters OFF.
Turn Glare OFF.

Confirm each layer disappears independently.

TEST G — MY IMAGE
1. Select My Image.
2. Grant photo permission.
3. Select a normal personal/non-medical test photo.
4. Drag the comparison line.
5. Confirm the selected image is used locally.
6. Check Network tools: the simulator should not upload the image to backend 8001.

TEST H — SCREENING INTEGRATION
1. Open a completed screening result.
2. Press Explore Educational Vision Simulation.
3. Confirm the simulator opens in DR mode.
4. For a Moderate result, confirm Moderate DR is selected.

TEST I — EDUCATION INTEGRATION
1. Open Learn & Eye Health.
2. Find Interactive Learning.
3. Open Vision Experience Simulator.

TEST J — THEME
Test:
- Light
- Dark
- Eye-Friendly
- Large text

Confirm all controls remain readable.

TEST K — RESET
1. Change scene, mode, preset, effects and comparison position.
2. Press Reset Simulator.
3. Confirm it returns to Driving + Moderate + all layers enabled + 50% compare.

======================================================================
8. PHASE OUTCOME
======================================================================

EyeCare AI now has a visually strong FYP demonstration that goes beyond a simple
classification output while remaining explainable and deterministic:

    Screening / Education
            ↓
    Vision Simulator
            ↓
    Native Local Rendering
            ↓
    Inspectable Effect Layers
            ↓
    Original ↔ Simulation Comparison

The feature is intentionally educational, privacy-conscious and technically
transparent rather than pretending to predict a patient's exact eyesight.
