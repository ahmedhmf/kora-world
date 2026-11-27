# Phase 2H — Local supplier payment and reversal UI

**Branch:** `feature/accounting-redesign`. **Not deployed or independently build-verified.**
No migrations, database writes, API privilege changes, or production branch changes were made in this phase.

## Implementation

On **Accounting → Invoices → Pilot balance**, when the frontend is running on localhost/127.0.0.1 and the authenticated user is an admin/accountant, incoming EGP invoices show a pilot-only panel:

- **Admin only**: "Record supplier payment" form, with exact EGP amount, payment date, active EGP leaf cash/bank account (11xx), optional description.
- **Accountant/admin**: "Reverse" beside each *active* pilot payment, with a required explanation (1–500 characters) and separate confirmation panel.
- Existing read-only payment history, amounts, original and reversal journal IDs, and audit details remain visible.
- On success, the invoice list and pilot balance are refreshed.

Both API routes already exist:
- `POST /payments/supplier-egp-pilot` — **admin-only**; body: `{invoiceId, bankAccountId, amountCents, date, requestKey, description?}`.
- `POST /payments/supplier-egp-pilot/:id/reverse` — **accountant/admin**; body: `{reason}`.

Server still requires `SUPPLIER_EGP_PILOT=true`, explicit `DATABASE_NAME=kora_test`, loopback host and verified actual `kora_test`. A local frontend alone cannot bypass the backend restrictions.

## Duplicate prevention on the frontend

- A **new browser-generated UUID** is created only for a new payment submission. Integer cents are derived from a validated decimal string (not floating-point multiplication).
- The form becomes disabled during submission.
- On a failed/uncertain response, the exact payload and UUID are kept and fields are locked. Retrying uses the SAME UUID, never a new one.
- The dialog cannot be closed while an uncertain retry remains. The user can explicitly discard the retry identity only after a warning to check the payment history, to avoid accidental duplicate payments.
- Pending identities are **in-memory only**. A browser reload or tab closure does not preserve them. This is a known limitation, so after an uncertain result and a browser reload, verify the ledger/history before creating a new payment.
- A failed reversal shows an uncertain-result warning and refreshes payment history; the service enforces no duplicate reversal.
- This is a test-only pilot UI. It does **not** replace the legacy payment page or make any claims about the company-wide AP report.

## Local verification (disposable kora_test ONLY)

```powershell
cd D:\Ahmed\project\kora-world
git pull --ff-only origin feature/accounting-redesign
cd web
npm run build
```

The backend API should be separately checked using the Phase 2G PostgreSQL integration tests. The pilot must remain **off in production**.

For manual browser tests, first verify that your local API is connected to disposable `kora_test` and ONLY then enable the local pilot flag in its own process; do **not** copy pilot environment settings to a production deployment.

1. Sign in locally as admin. Open an incoming EGP test invoice and click **Pilot balance**.
2. Select an active EGP leaf 11xx bank account. Submit EGP 40.00 and verify paid/outstanding balances and the linked payment journal.
3. Double-click prevention: while the request is pending the submit button is disabled.
4. Test uncertain response: if the request fails, retry the same payload/UUID. Check the history before discarding the old request.
5. Reverse the active payment using a nonempty reason; verify the original is retained, reversal journal listed, and paid/outstanding totals restored.
6. Sign in as accountant: view and reverse are allowed, but new payment submission is hidden. Employee users should not see the local pilot controls.
7. Production web pages and preexisting foreign-currency invoice workflows should be unchanged.

## Remaining before production consideration

- No full automated Angular component test suite was introduced; build and browser testing are required.
- The pilot report is not the legacy AP report; reports that sum original Payment rows can still overstate effective paid amounts after reversals.
- After refresh, account history must be inspected before submitting an additional payment following an uncertain result.
- Production migration, immutable request key enforcement, legacy route restrictions and broader authorization coverage must be separately reviewed and authorized.
