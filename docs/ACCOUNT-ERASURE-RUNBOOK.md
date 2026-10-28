# Geraina account-erasure operation

Updated 29 October 2026. The supported software paths are store closure, shared-product identities, staff-only removal, minimum-data retention, interruption/retry/cancellation and restore replay. The Android request entry remains support-assisted; no public destructive endpoint was added. No customer account was erased by the verification tests.

## Deployment and write protection

Deploy the matching `erasure_guard.py`, database adapter, request context and authentication hooks to **both GerainaOS and DapurOS**. Finish the coordinated rollout and allow old, unfenced deployments/in-flight work to drain before the first customer erasure. The production operator CLI checks both official `/api/system/erasure-capabilities` responses and requires their normalized implementation fingerprints to match its local version. A test environment flag cannot bypass this check; only a marked, random loopback fixture can do so.

Every application mutation locks its account/module/store/membership guards in the same real MongoDB transaction as the write. Closing a guard serializes against earlier transactions and rejects later writes, including previously authenticated requests and callbacks. A crash leaves the scope closed until explicit resume or cancellation. Request-token expiry is checked again at write time. Active guards are touched once per transaction; equality-scoped business writes avoid extra record reads. Ordinary menu reads gain no new database round trips.

Support uses the raw, privileged connection; application routes cannot mutate the erasure jobs, guards or retention store. Privileged database edits/imports are not application writers: do not bypass the process or write into a closed scope manually.

## Verify the request and its scope

1. Verify the requester and authority over the affected store/data. Keep the verification record private. An email address or a successful form delivery alone does not establish authority.
2. Use `scope: store` for an owner's Geraina store, or `scope: staff` for the verified employee membership. Store closure removes its operational data and exclusive identities. Identities, credentials and subscriptions needed by DapurOS or other memberships survive; only the removed Geraina entitlement/access and stale store pointers are changed. Staff-only removal leaves the merchant store operational and replaces structured staff attribution in sales/history with a deleted-staff label while preserving amounts.
3. Review the preview, payment reconciliation and data inventory. Pending/uncertain payments, conflicting product data, duplicate identities, unknown linked collections and indefinite legal holds require resolution. Never repair a blocked case by deleting ownership or hold fields merely to pass the check.
4. Identify legitimately retained data, its reason and a real expiry date. Configure only the minimum approved financial/time fields. Credentials, contact fields, support messages, notes, provider responses and API keys are not eligible retention fields. Staff-only vault retention applies to personal time records, not a copy of the merchant's sales database. A finite existing retention marker cannot be shortened.
5. Explain the exact scope, expected completion date, retained categories/reasons/expiry and continuing other-product access to the requester. This tool does not choose a legal/business retention period. Audit/recovery expiry must outlive the retained records and the currently valid session lifetime.

## Private case and read-only preview

Keep cases outside source control, preferably in the ignored `backend/.private-erasure/` directory. Use IDs and private evidence references, not passwords, provider keys or copied message bodies.

```json
{
  "user_id": "verified-account-id",
  "store_id": "verified-store-id",
  "scope": "store",
  "request_reference": "private-support-case-reference",
  "identity_verification_reference": "private-verification-record",
  "retention_review_reference": "private-approved-disposition-record",
  "disposition": "erase_all_after_review",
  "audit_expires_at": "REPLACE_WITH_APPROVED_ISO_UTC_DEADLINE"
}
```

For approved retention use `disposition: retain_minimum_after_review` and `retention_rules`, each containing `collection`, a reviewed `fields` list, `reason`, and timezone-qualified `expires_at`. Field allowlists are in `backend/erasure_inventory.py`. An invalid or incomplete case is rejected without echoing its contents. The example deliberately supplies no invented default deadline.

Use the approved operator environment for `MONGO_URL` and `DB_NAME`; the utility does not load an application `.env`. Never paste or log a connection string. From `GerainaOS/backend`, the default command is read-only:

`python fulfill_account_erasure.py --case <private-case.json>`

Review counts, identities to remove/preserve, attribution changes and the digest. No customer document contents are printed. A changed case or relevant record invalidates the preview. Unrelated DapurOS profile/product activity is preserved and does not get overwritten by Geraina cleanup.

## Execution and recovery

After the verified request, scope, disposition and destructive action are approved:

| Command options after `--case <file>` | Behavior |
| --- | --- |
| `--begin --plan-digest <reviewed-digest>` | Durably close the scope without erasing records yet. |
| `--apply --plan-digest <reviewed-digest>` | Begin and commit primary-database fulfillment. |
| `--status` | Read the durable case phase and redacted outcome. |
| `--resume` | Continue a frozen case, or return its already committed result. |
| `--cancel` | Reopen only an uncommitted closing case. Committed erasure cannot be undone. |
| `--restore --plan-digest <fresh-reviewed-digest>` | Reapply a verified case to reintroduced backup data. External checks reset to pending. |

An interrupted transaction rolls back all deletions, attribution changes and retention copies. Its durable closure remains recoverable. If the response is lost after commit, status/resume returns the stored result; it does not make duplicate retention copies. If relevant records changed, investigate, preview/review again and use the new digest to refresh the closing case. Do not interpret a timeout or intake receipt as success.

## Retained and external data

Approved minimum records move atomically into the private `erasure_retained` collection with explicit deadlines. They have no public reader. A Mongo TTL index expires them; `python fulfill_account_erasure.py --purge-expired` provides a deterministic due-only reconciliation path. Recovery/audit receipts and hashed closure guards expire only after all completion steps are recorded, at the approved audit deadline. Do not expire recovery evidence while a backup can still reintroduce erased data.

`primary-database-erased` is deliberately not overall completion. The case remains `database_complete` with separate pending steps for mail, providers, files, logs, backups, offline devices and unstructured content. Check actual Resend/Gmail/Hermes copies, hosting/security logs, external images/uploads, subscription/payment copies, all backup/restore paths and applicable client/browser/Android local data. Free-text content needs review; structured redaction is not a promise to identify personal information in arbitrary notes. Another merchant's independent customer relationship is outside a staff-membership request and must be addressed with the appropriate controller.

Record each verified outcome with `--ack-external <step> --evidence-ref <private-record-reference> --outcome completed` or `not_applicable`. Only a hash of the evidence reference is retained. Do not mark a service not applicable without checking. Existing completion evidence cannot be silently replaced. Overall phase becomes `complete` only after every step has an outcome. The result lists the approved retained categories/fields/reasons/deadlines and preserved-identity count for the support response.

Before restoring service from a backup, isolate the restored environment, keep current closure guards/recovery cases, run the read-only preview and reviewed restore replay, verify absence/attribution again, and only then reopen traffic. Actual provider/backup destruction is not performed by this utility. Keep case/contact and completion-notice records only according to the reviewed audit policy.

## Verification

`test_account_erasure.py`, `test_erasure_workflow.py` and `test_erasure_runtime.py` cover scope, minimum retention and deployment gates. `verify_erasure_workflow_replica.py` (also available through the older `verify_erasure_replica.py` entry point) uses fresh, explicitly marked loopback databases, real transactions, actual Geraina HTTP requests, an independent DapurOS process, the real operator CLI and the built frontend through Playwright on desktop/phone. It verifies in-flight write fencing, normal cash/void/offline behavior, rollback, lost-response retry, shared access, staff attribution, retention expiry, cancellation and backup replay. Success is recorded only after its disposable fixtures have been removed.

Exact evidence is in `docs/ACCOUNT-ERASURE-VERIFICATION.json`. Google Play registration/approval, physical printer output, real bank settlement and actual third-party erasure remain separate evidence; these software tests do not certify them.

[Google Play account-deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) permits a support-assisted request path while requiring actual fulfillment and clear retention practices.
