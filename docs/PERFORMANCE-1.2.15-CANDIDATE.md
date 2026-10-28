# Geraina startup and menu performance candidate

Unpublished candidate, 28 October 2026. Public release remains 1.2.14/build 19.

## Changes prepared locally

- Keep the application layout, login, dashboard, products and cashier in the initial bundle; load secondary screens separately with an in-page loading state.
- Remove the whole-screen 420 ms movement/fade/blur from operational route transitions.
- Run the dashboard's six independent, store-scoped database reads concurrently. Authentication, store filters, monetary calculations and output fields are unchanged.
- Update the old performance fixture to the current statistics/history/catalogue/records response contracts. Await real rendered content in the route audit rather than relying on the removed animation as an accidental wait.

## Evidence

- Initial JavaScript: 1,253,813 to 510,164 uncompressed bytes; gzip build output 346.17 to 156.54 kB (about 55% smaller compressed).
- Controlled replay with 500 synthetic products, fixed 250 ms API latency and 1500 ms session latency: at simulated 4x CPU slowdown, dashboard shell 962 to 614 ms and dashboard data 1208 to 875 ms. At normal CPU, shell 297 to 267 ms. This does not reproduce a physical POCO/Samsung/Xiaomi processor or production network latency.
- 168 route checks passed across phone, Xiaomi-sized and Samsung-sized browser layouts.
- 21 navigation/employee-access checks passed; three additional Back/Forward checks passed. Secondary screens retained the authenticated document and app layout.
- 34 backend tests passed against the isolated local replica, including store timezone/statistics and concurrent read coverage. The concurrency test failed against sequential reads before the change, then passed. An earlier real-database run errored because the local replica was stopped; those errors are retained and are not counted as passing tests.
- TestSprite test `465c0b73-0aa2-43a2-9279-f9cb75dc0a18`, run `1ab855f0-0380-4806-aa78-13fad3a95ee2`: passed on the disposable preview. Initial preview attempts failed because the tunnel inherited unrelated routing configuration. A later browser Forward shortcut attempt failed remotely; direct browser Back/Forward checks passed locally on all three layouts. The final external plan tests app navigation and Back, and does not claim remote Forward shortcut coverage.
- Signed candidate APK/AAB built with Android unit tests and release lint. Signature, unchanged signing certificate, bundle structure, 16 KB alignment and private-credential exclusion passed. All 81 frontend bundle entries matched their manifest hashes, including 41 JavaScript files.
- Installed signed candidate passed the focused phone-emulator startup/navigation/session-retention check. Seven menu shells appeared in 73–419 ms on that emulator. No merchant writes were permitted. Report: `android-app/app/build/reports/startup-android/2026-10-28T07-48-07-468Z/verification.json`.

Initial performance-only candidate APK SHA256: `2cd94ceb89ef4654fb7fc18f616dcee16b459a5db28d22cb459f321ec91b2152` (superseded before publication).

## Subscription correction included before publication

The final candidate shares one subscription presentation across billing, About and the tier notice. Unknown plan identifiers show "Belum diketahui" and a billing warning, never "AKTIF". A trial expiry is never reused as the expiry of a paid package. This changes presentation only; server authorization and add-on eligibility remain authoritative. Product-scoped manual Business grants through 2099 are covered without creating a payment order or granting another product's paid access.

Final APK SHA256: `6269ab17db619d48cf6cd9ab759c362c63f588f561524cb9e96f807d65b908d0`, build 20. All 81 bundled assets, including 41 JavaScript entries, match the packaged manifest. Android release checks passed with 26 unit tests and zero lint errors.

The final package passed focused subscription checks on Android phone and 14.6-inch tablet emulators, plus a fresh phone startup/navigation/session-retention run. Twenty-four browser subscription cases passed across three layouts. The isolated backend suite passed 411 tests. The broad browser audit passed 222 cases initially; its 12 transaction-dependent failures were rerun successfully after replacing the mock database with the local replica. The retired external-preview test harness is excluded from the isolated backend suite; its initial 15 setup errors and three failures are retained in the local discovery log. TestSprite subscription run `98129062-89a8-46ab-9039-d895045a98d3` passed all eight steps against the disposable preview. No customer data was used in these automated tests.

The machine-readable final release record is in the parent portal repository at `docs/geraina-1.2.15-release-verification.json`. These focused results do not certify physical printer/camera hardware, real payment settlement or physical-phone timing.

## Limits and remaining work

No physical POCO F7, Snapdragon tablet or Samsung timing was captured. A broader signed-package usability attempt hit an x86 System WebView native crash during a theme change. The prior 1.2.14 package passed theme checks on the same emulator but later hit an outdated metadata fixture; neither incomplete run is claimed as full usability certification. The focused candidate test passed after a fresh app launch. Complete current release checks before publishing 1.2.15.

Live investigation also found the larger server-region mismatch: Atlas was already in GCP Jakarta, while both API backends ran in Vercel `iad1`. A separate configuration-only publication moved Geraina and DapurOS API execution to Singapore (`sin1`). Live post-deployment Geraina samples: login 763 ms, session 538 ms, dashboard stats 314 ms, categories 256 ms, catalogue 244 ms. That correction is already available to the current 1.2.14 APK and web app. No Atlas data migration occurred.
