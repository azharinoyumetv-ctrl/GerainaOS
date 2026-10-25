# Geraina website APK updates, 1.2.3

The website-distributed Android app can check for, download and hand an update to Android's system installer. Installing 1.2.3 from the website once enables this for later releases. The previous release has no updater and cannot gain native code remotely.

## User flow

- Check quietly on opening/returning to the app, at most daily. Failures remain quiet and retry after 15 minutes. A cached available release restores its banner between launches.
- The banner, native **Periksa pembaruan** menu and About button offer a user-initiated update. There is no mandatory update and no download on mobile data without a confirmation.
- Ask the user to finish/save current work. Stream the APK into private cache with progress and cancellation. No shared storage permission is used.
- Verify the file, then request Android's per-source installation permission if necessary. Returning without permission cancels installation. Allowing the source continues only the explicitly requested update. Android still asks whether to update Geraina.
- Install over the same app ID with the original signing key, preserving app data. Uninstalling or clearing data is never part of this flow. System/device-management restrictions are reported, not bypassed.

## Release contract

`https://dagangos.com/downloads/geraina/latest.json` supplies the stable version, increasing versionCode, app ID, bytes, SHA-256, minimumSdk, supportedAbis and signingCertificateSha256. Downloads are restricted to the matching immutable versioned APK path on the same HTTPS origin. Redirects, userinfo, alternate hosts/ports, query strings and fragments are rejected. Manifest reads are bounded to 64 KiB; APK streams are bounded to the advertised bytes and a 100 MiB native ceiling (the current website hosting limit is 25 MiB).

An untrusted manifest cannot substitute an unrelated signing key: the manifest certificate and archive signer must both match the installed app's actual certificate. The downloaded package ID, version code/name and minimum SDK must match the manifest, and the version code must exceed the installed version. Before each installer launch, the checksum and archive identity are verified again. The FileProvider is private and grants read access only to files in its updates cache directory. The JS bridge offers only a check command, not a URL or install command; downloads/installation require native confirmation.

Publish a tested APK at its immutable versioned URL before advertising it in `latest.json`. The parent portal staging script produces metadata only for the verified APK bytes. Keep the signing key permanently. A signing-key rotation needs a separately designed migration; the current updater deliberately requires the current signer to match exactly.

## Verification

`UpdatePolicyTest` rejects alternate download sources, malformed/oversized metadata, incompatible Android/CPU, wrong package/signers, truncated/tampered files and old/mismatched archive versions.

`scripts/verify-updater-android.cjs` uses production HTTPS endpoints and the real Android installer. In upgrade mode it uses a locally retained signed bootstrap build of this exact updater source with an older version code, then upgrades to the already-public signed release. A strict IndexedDB write places an isolated pending-sale sentinel in Geraina's actual offline database; both that record and a localStorage preference must survive the installation. No merchant account or business write is used. The four final release profiles check the pre-login menu, rejection of older/current releases, offline error dismissal and the About action. The bootstrap APK is a local test fixture, never a public release or a replacement for historical release files.

The usual signed phone/tablet usability and offline checks still apply. These are AOSP emulator tests, not physical HyperOS/One UI certification. The source installer approval screens may vary by vendor or device policy.

## Google Play

This release is for the website distribution requested by the owner. Google Play prohibits using `REQUEST_INSTALL_PACKAGES` for app self-updates outside its allowed device-management exception. Before submitting to Play, remove the website updater/permission/provider and use Play's in-app update mechanism. Do not upload this release's AAB unchanged. References: [Android website distribution and source approval](https://developer.android.com/studio/publish), [Google Play permission policy](https://support.google.com/googleplay/android-developer/answer/18258653?hl=en-GB).
