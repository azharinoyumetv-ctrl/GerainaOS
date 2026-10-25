# Geraina 1.2.2 defect audit

This update follows reports of an incorrect About version, slow startup/menu changes, missing password visibility controls and no camera scan in the product editor.

## Corrections

| Area | Cause and correction |
| --- | --- |
| System information | About used fixed version, device and licence strings. Android now supplies its installed BuildConfig version, version code, Android release and device model; the account plan comes from the authenticated user. Web displays its platform without inventing an Android version. |
| Startup | Saved Android sessions waited for `/auth/me`. The saved interface opens while the server revalidates; a rejected token still clears the session. |
| Menu navigation | Native buttons reloaded the entire document. Valid internal app destinations now use the mounted React router, with normal loading as a fallback. |
| Session checks | Focus/pageshow could duplicate validation, and an older response could restore a logged-out user. Requests are shared/throttled and every response checks that its token is still current. |
| Dashboard | The hidden desktop dashboard fetched seven data sets alongside the compact Android dashboard. Android now fetches only the compact dashboard's visible sources. |
| Android startup resources | The packaged interface requested remote fonts and a web analytics bootstrap despite using system fonts. Those dependencies are removed from the Android bundle; existing brand icons are packaged locally. The web build retains its own presentation. |
| Password fields | Login, registration and integration secrets now have explicit show/hide controls. They remain masked initially; toggling never submits the form. |
| Product camera | Scanning was restricted to POS. The native result now includes its purpose and is delivered only to the originating product/checkout screen. Product scanning fills SKU/barcode and retains the draft, with explicit Save still required. |
| Product validation | Invalid amounts, rapid repeated Save and structured server validation errors had unsafe/error-prone paths. Validation retains optional cost/stock as zero, guards repeated submission, and keeps drafts open with readable errors. |
| Product loading | Duplicate initial list requests and unhandled failures could show an empty catalogue. The initial request is issued once; failures have a retry state. |
| Settings | Partial settings could crash a screen, and legal/tax placeholders were fabricated. Settings now merge safe empty defaults, block saving before a successful load and show retry/save feedback. |
| Import panel | Android Back now dismisses the import dialog, and a tall import panel can scroll within the screen. |
| Rotation/resizing | Screen recreation discarded running document state. The activity now retains the WebView across size/orientation changes and redraws it, following [Android's state-management guidance](https://developer.android.com/develop/adaptive-apps/cookbook/webview-state). Product-draft checks cover rotation before camera use. |

## Evidence and limits

- `scripts/verify-release-quality.cjs` exercises cached startup against a deliberately delayed session response, actual version/device fields, password controls, product scan-result routing, explicit/duplicate Save, error recovery, session expiry/logout races and partial settings. It uses isolated records and tests the packaged frontend.
- `scripts/audit-screens-readonly.cjs` visits 26 app screens using the supplied account and production read-only APIs. All merchant mutations are blocked. This is a screen/runtime audit, not proof that every business action works.
- `Run-FinalVerification.ps1` runs the signed-APK suites on Android 14/17 phones and Xiaomi/Samsung-size tablet profiles: 50 usability checks plus 32 offline/native checks.
- The native camera preview and permission/cancel paths are exercised. Product barcode return values are explicit fixtures; `BarcodeScanPolicyTest` checks the native routing guard. The unchanged decoder's EAN-13 instrumentation result remains the 1.2.0 baseline. Physical optical scanning and printer output are not certified by these emulator tests.
- A crash in the emulator's WebView 133 native code occurred during the old activity-recreation/rotation path with the test debugger attached. Twelve rotations without the debugger did not reproduce it. The retained-document change avoids that recreation path; the rotation regression checks retain an actual unfinished draft. This does not claim to patch Chromium itself.
- Isolated MongoDB transaction/replay checks are unchanged from 1.2.0. No production cash sale, product record or support message is created by this audit.

Final counts, APK checksum, timing results, scope and public verification are recorded in `releases/release-verification.json`. Synthetic/emulator timing is not a guarantee of physical-device or server response times. Physical HyperOS/One UI behaviour, proprietary peripherals and flows outside the tested scope remain unverified.
