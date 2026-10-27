# Geraina 1.2.14 — account-bound support

About > Hubungi dukungan opens a form inside Android/web. The native Help and account-deletion request controls use the same form. Account deletion remains a request for human verification; preparing the form does not send a message or delete an account.

The backend reads the authenticated customer's account email and store. These cannot be supplied or overridden by the form. The existing Resend SMTP service sends to contact@dagangos.com with the customer's email in Reply-To. From remains the authenticated DagangOS delivery address; this does not log in to or send through the customer's personal mailbox.

Submission shows loading feedback and stores an account/store-scoped request reference for recovery after a lost response. A repeated request ID cannot dispatch twice; changed content with the same ID is rejected. Concurrent requests share an account lock and a five-requests-per-hour limit. Server acceptance is reported separately from uncertain delivery. Missing delivery configuration disables submission and never reports a sent email. Support remains available to authenticated employees and expired customers.

Production configuration: RESEND_API_KEY is a server-only Vercel Secret. Default SMTP transport is smtp.resend.com:465 with certificate verification and username resend. Optional server-only SUPPORT_SMTP_* settings support another authenticated SSL/STARTTLS relay. No credential is included in frontend code, Android assets, client responses or committed configuration.

Verification includes real Mongo transaction/concurrency cases, SMTP header tests, phone/tablet browser journeys, installed Android support/menu/permission checks, and real device network-off/reconnect cash-sale checks against a disposable local backend. Live test email delivery and the final publication state are recorded separately in the release verification document.
