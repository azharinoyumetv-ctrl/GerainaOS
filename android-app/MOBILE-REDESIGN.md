# Geraina Android redesign

Version 1.2 bundles the actual frontend for cold offline startup and adds durable offline cash checkout, safe synchronization, native camera scanning and receipt-printer integration. See `OFFLINE-AND-HARDWARE.md`. The UI and test descriptions below preserve earlier release history.

## Current usability update, 1.1.2

Android 14 is now the minimum supported version. Native navigation has four bottom shortcuts on narrow windows and a top-left drawer button. Wide tablets show a persistent left sidebar and hide the bottom shortcuts. Android navigation groups expand without changing routes, so their links remain available.

Login foreground, autofill text, caret and placeholders now use explicit colors against light inputs; the minimum measured typed-text contrast is 12.28:1. Suite cards, statuses and labels also have explicit readable colors. Category, brand and unit forms validate required input, show saving progress and API errors, retain input on failure and allow retry.

Ordinary page text resists long-press selection. Inputs retain normal selection and copy/paste. Android Back dismisses the keyboard or an open panel first. Otherwise it returns to the dashboard and shows an exit prompt; another press within two seconds closes the activity without logging out. Expired exit prompts do not close the app.

The signed release is checked on Android 14 and 17 phones and Android 16 large-tablet screen profiles. See `releases/android-usability-report/index.html` and `release-verification.json` for the current matrix. The earlier redesign and 1.1.1 results below are historical.

The user approved `design-preview/index.html` on 24 October 2026. The Android implementation carries that direction into the live application instead of shipping the preview's sample products or revenue.

## Presentation

- A single native, light header replaces the previous dark header plus duplicate web header. The title follows the route and the subtitle names the actual store.
- Native Dasbor, Kasir, Produk, Laporan and Menu tabs have consistent outline icons and an active indicator. The system keyboard temporarily hides these tabs. The top overflow menu retains exports, printing, privacy and deletion requests.
- The bundled `mobile-ui.css` and `mobile-ui.js` style the authenticated web application only inside the Android client. The deployed desktop frontend is unchanged.
- Product rows retain the existing React edit/delete buttons, category filter and import forms. The three overview counts use the full store catalogue and refresh after a successful product write.
- Cashier cards use real product images, or a neutral placeholder. A fixed summary opens the existing React checkout as a scrollable sheet. Android Back closes the sheet; landscape shows checkout beside the catalogue. Quantity, discount, tax, customer selection, payment and receipt logic remain in the existing application.
- Support has moved into the native menu. The existing first-party support widget is bundled as a lazy factory so it also works after starting directly on an authenticated route. Opening it creates no support request; sending still requires the user's explicit action in the chat form. It uses the existing `/api/support-chat` service.

## Data and lifecycle

The mobile dashboard reads the current session's `/orders/stats`, `/products` and `/orders?limit=1000` with the existing bearer token and Geraina module header. These are read-only requests to the production origin. No account or credentials are packaged in these assets.

Revenue and transaction totals come from the backend. The seven calendar-day bars aggregate real paid orders in UTC, matching the backend's sales-day convention. They do not show the previous frontend's fabricated distribution, estimated cash balance, or assumed profit margin. When 1,000 orders do not cover the requested dates, the daily chart is replaced with a link to the full reports. Empty stores show zero revenue and an honest empty state. Failed requests show unavailable values and retry access. Each widget can populate as its own response arrives.

Record text is escaped before HTML rendering. Requests are aborted on dashboard departure, timed out, and checked against the current token and mounted view before display. Navigation and file/print integrations retain the origin-scoped AndroidX message listener. Android Back handles the drawer, support panel, barcode input and cashier sheet before browser history.

## Verification

`scripts/verify-mobile-ui.cjs` checks the bundled presentation in Chromium with real authentication and network-isolated product/order fixtures: live API totals, product search/edit, overview refresh after an intercepted edit, cashier quantity/totals, actual daily order aggregation, escaping, truncated data, API failure, support after a full reload, and landscape geometry. Screenshots from this script are explicitly WebView/browser evidence, not store-listing Android captures.

`scripts/run-android-bench.cjs` verifies the installed debug APK on the Android 16 emulator. The suite includes the original login, POS receipt, imports, exports, print preview, offline and HTTP recovery checks plus geometry, live dashboard data, five-tab navigation, cashier Back handling, and support-menu access. Merchant products, sales and support conversations are not changed; payment and product-write scenarios are intercepted local fixtures.

The Android styles target the current frontend's existing test IDs and structure. A future deployed frontend redesign needs another local bench run and may require a corresponding Android asset update. Physical printer output and other Android/device configurations remain separate checks.

## Large-tablet update, 1.1.1

The dashboard retains zero vertical margin while centering horizontally on wide screens. The cashier heading and search are stacked so the search control cannot compress the title into two lines. Wide checkout uses a viewport-bounded grid with independent catalogue and cart scrolling; its intrinsic content height can no longer push payment controls below the native bottom navigation.

All 29 checks passed on each Xiaomi Pad 6S Pro and Samsung Ultra-size AOSP profile in portrait and landscape (116 total), including actual soft-keyboard resizing. The phone regression passed all 24 checks; 9 presentation checks, 9 bridge checks and 9 unit tests also passed. Reports distinguish emulator evidence from physical devices and from vendor firmware. Google Play release is postponed; the signed APK is published at https://dagangos.com/geraina/android, with independently verified file bytes and checksum.
