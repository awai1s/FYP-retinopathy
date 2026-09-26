EyeCare AI / DR Healthcare
PHASE 10B — GLOBAL THEME + DARK/LIGHT + EYE-FRIENDLY MODE
Complete replacement patch
Prepared: September 2026

======================================================================
1. WHAT THIS PATCH DOES
======================================================================

This patch implements the Phase 10B appearance/accessibility foundation on top
of the CURRENT EyeCare AI frontend. It is designed to preserve the existing
Patient, Doctor, Hospital, medication, analytics, clinic, report, screening,
RAG/voice and Phase 10A security work.

Implemented:

1) Global AppThemeProvider
   - System / Light / Dark mode
   - Eye-Friendly Mode
   - Text size: Normal / Large / Extra Large
   - Reduce Motion
   - Persistent local settings using AsyncStorage

2) Saved preference keys
   - @eyecare/theme-mode
   - @eyecare/eye-friendly
   - @eyecare/text-scale
   - @eyecare/reduce-motion

3) Semantic theme palettes
   - background
   - surface
   - surfaceRaised
   - surfaceSecondary
   - primary / primaryStrong / primarySoft / primaryText
   - textPrimary / textSecondary / textMuted
   - border / borderStrong
   - success / warning / error / info + matching surfaces
   - focus / scrim / inverse colors

4) Compatibility layer for the EXISTING project
   The old codebase has many imports such as:
       colors.textPrimary
       colors.surface
       Colors.background
       Colors.textPrimary

   Those imports are intentionally preserved. Phase 10B converts them into
   runtime theme-aware tokens instead of forcing a risky rewrite of all screens.

5) Runtime StyleSheet bridge
   Existing StyleSheet.create(...) definitions can now resolve theme colors
   dynamically. It also applies global accessibility behavior to old screens:
   - text scaling
   - increased spacing in Eye-Friendly Mode
   - stronger thin borders in Eye-Friendly Mode
   - larger small minimum touch targets
   - reduced decorative shadow depth

6) Current route refresh integration
   All current Expo Router screens subscribe to appearance changes so changing
   the theme is reflected across existing screens without creating duplicate
   light/dark page files.

7) New Appearance & Accessibility screen
   Route:
       /settings

   Available from the role-based side navigation for:
       Patient
       Doctor
       Hospital

8) Eye-Friendly Mode behavior
   - larger readable text
   - larger shared buttons/touch targets
   - increased spacing
   - stronger borders
   - reduced decorative depth
   - clearer status presentation
   - status components already use icon + text, not color alone

9) Reduce Motion behavior
   Reduced decorative animation has been added to high-frequency shared UI:
   - shared buttons
   - bottom navigation
   - mobile drawer
   - language toggle
   - AI assistant opening/closing
   - splash experience

   Clinical/functional animations inside vision tests are not globally removed,
   because some are part of the test interaction rather than decoration.

10) No duplicate screens
   This patch does NOT create files such as:
       darkProfile.tsx
       eyeFriendlyProfile.tsx
       normalProfile.tsx

   The same existing screens respond to the global theme.

======================================================================
2. HOW TO APPLY
======================================================================

Target project folder:

    F:\Fyp retinopathy\

1. Make a backup of your current project folder first.
2. Extract this ZIP.
3. Copy the contents directly into:

       F:\Fyp retinopathy\

4. Choose:

       Replace files in destination

The ZIP contains a frontend/ folder and the Phase 10B documentation files.
It does NOT replace your backend.

======================================================================
3. PACKAGE INSTALLATION
======================================================================

NO NEW npm package is required for Phase 10B.

Your existing package.json already contains the two things this implementation
needs:

    @react-native-async-storage/async-storage
    expo-system-ui

Do not run a random package upgrade.

======================================================================
4. RUN THE PROJECT
======================================================================

Keep the same local setup already used by the project.

Frontend:

    cd "F:\Fyp retinopathy\frontend"
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
    .\run-web-8081.ps1

Expected frontend:

    http://localhost:8081

Your Phase 10A/backend setup remains unchanged.

======================================================================
5. FIRST TEST — PATIENT
======================================================================

Login as Patient.

Open the side menu and choose:

    Appearance

Test:

A) THEME
   System -> follows device theme
   Light  -> forces Light
   Dark   -> forces Dark

After switching, visit:
   Dashboard
   History
   Profile
   Analytics
   Prescriptions
   Appointments
   Screening Result
   Clinic Locator

Confirm backgrounds, cards, text, borders and shared controls adapt.

B) EYE-FRIENDLY MODE
   Turn ON.

Check for:
   - larger text
   - larger shared buttons
   - larger small touch targets
   - stronger borders
   - more spacing
   - reduced card/shadow decoration
   - status labels remain readable with icon + text

C) TEXT SIZE
   Test:
      Normal
      Large
      Extra Large

D) REDUCE MOTION
   Turn ON and test:
      buttons
      drawer
      bottom navigation
      language toggle
      AI assistant

======================================================================
6. DOCTOR / HOSPITAL TEST
======================================================================

Login as Doctor and Hospital separately.

The same Appearance page is available from each role's side navigation.
The preference is device-level and therefore remains consistent across the app.

Verify several pages for each role after switching Light/Dark and text sizes.

======================================================================
7. SYSTEM MODE TEST
======================================================================

Select:

    Theme -> System

Then change Windows/device appearance from Light to Dark (or Dark to Light).
EyeCare should follow the device appearance while System is selected.

If Light or Dark is explicitly selected inside EyeCare, that explicit choice
wins over the device setting.

======================================================================
8. ARCHITECTURE ADDED
======================================================================

New core files:

    frontend/providers/AppThemeProvider.tsx
    frontend/design/theme/runtimeTheme.ts
    frontend/design/theme/palettes.ts
    frontend/app/settings.tsx

The provider is mounted once in:

    frontend/app/_layout.tsx

The legacy design token bridge remains at:

    frontend/design/tokens/colors.ts
    frontend/constants/Colors.ts

This is deliberate: the rest of the application can migrate gradually toward
semantic values without breaking the existing UI in this phase.

======================================================================
9. IMPORTANT DEVELOPMENT RULE FOR PHASE 10C+
======================================================================

For NEW screens, prefer:

    const { colors } = useAppTheme();

and semantic names such as:

    colors.background
    colors.surface
    colors.surfaceRaised
    colors.primary
    colors.textPrimary
    colors.textSecondary
    colors.border
    colors.success
    colors.warning
    colors.error

Do not introduce new fixed light-only page colors unless the color is truly a
brand/decorative value that should be identical in both themes.

Do not create separate Dark/Light versions of screens.

======================================================================
10. INTENTIONAL SAFETY / UX DECISIONS
======================================================================

- Theme preference is local UI state only; no clinical data is copied.
- No backend or MongoDB schema is changed.
- No authentication/security behavior from Phase 10A is weakened.
- Reduce Motion targets decorative UI motion; it does not blindly disable
  clinical interactions where animation is part of the test/workflow.
- Eye-Friendly Mode increases readability without changing clinical meanings.
- Status meaning is not represented by color alone in the shared status badge.

======================================================================
11. STATIC VALIDATION PERFORMED BEFORE PACKAGING
======================================================================

The patch was checked for:

- TypeScript/TSX syntax across the complete merged frontend
- local relative-import resolution
- theme subscription coverage across current route files
- runtime theme color switching with a smoke test
- text scaling with a smoke test
- Eye-Friendly border/spacing transformation with a smoke test
- no new package requirement

Runtime theme smoke test result:

    PASS

Expected example transition verified in the test:

    Light surface  #FFFFFF
          ->
    Dark surface   #0B2026

and text/font/border/spacing values also changed from the same existing style.

======================================================================
12. ROLLBACK
======================================================================

If you want to roll back Phase 10B, restore the frontend/ folder from the backup
you made immediately before applying this ZIP.

Do not restore/replace the backend just to undo Phase 10B because this patch does
not modify backend files.

======================================================================
END OF PHASE 10B PATCH README
======================================================================
