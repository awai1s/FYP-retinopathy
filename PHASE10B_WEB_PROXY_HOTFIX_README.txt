EyeCare AI — Phase 10B Web Proxy Crash Hotfix
==============================================

Problem fixed
-------------
Expo Web / React Native Web could crash on the splash screen with an error similar to:

'get' on proxy: property 'backgroundColor' is a read-only and non-configurable data property ...
expected 'rgba(39,229,198,0.26)' but got 'rgba(73,234,213,0.22)'

Why it happened
---------------
The Phase 10B compatibility layer made legacy StyleSheet.create() styles resolve colors dynamically.
React Native Web freezes StyleSheet-created style objects in development. The previous implementation
wrapped those frozen objects directly in a JavaScript Proxy. When the active theme changed, the Proxy
returned a different backgroundColor than the frozen target actually contained. JavaScript Proxy
invariants forbid that for read-only/non-configurable properties, and Animated/StyleSheet.flatten()
therefore threw the runtime error.

The fix
-------
The dynamic theme bridge now clones each StyleSheet-created style into a normal configurable object
before wrapping it in the runtime theme Proxy. The visual/theme behavior stays the same, but Animated
components and StyleSheet.flatten() can safely read the dynamically resolved values on Expo Web.

Files changed
-------------
frontend/design/theme/runtimeTheme.ts

No backend files are changed.
No package.json changes are required.
No npm install is required.

How to apply
------------
1. Stop the currently running Expo process.
2. Extract this ZIP into your project root:

   F:\Fyp retinopathy\

3. Choose "Replace files in destination" when Windows asks.
4. Start the frontend again using your existing command:

   cd "F:\Fyp retinopathy\frontend"
   .\run-web-8081.ps1

Your existing run-web-8081.ps1 already starts Expo with --clear, so Metro's cached copy is removed.
If you start Expo manually instead, use:

   npx expo start --clear --web --port 8081

Verification
------------
After the app loads:
1. Confirm the splash screen opens without the Proxy error.
2. Open Appearance & Accessibility.
3. Switch Light -> Dark -> Light.
4. Test System theme.
5. Turn Eye-Friendly Mode ON/OFF.
6. Test Normal / Large / Extra Large text.
7. Test Reduce Motion.
8. Return to the splash/login/dashboard and confirm Animated elements still render.

This hotfix is intended to be applied on top of the Phase 10B patch already installed.
