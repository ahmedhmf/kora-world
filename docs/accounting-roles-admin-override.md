# Accounting Roles: Accountant and Administrator Overrides

This change is limited to the `feature/accounting-redesign` branch. No migrations, user records, passwords, or production data were modified.

## User management
- Both backend create/update DTOs accept `accountant` alongside existing `admin`, `employee`, and `supplier`.
- The existing Users → New/Edit user form offers **Accountant (Journal Approval & Reversal)**.
- Admin-only user management remains unchanged.
- `users.role` is a string field, so no database schema change is required.

## Journal workflow permissions

| Action | Employee | Accountant | Admin | Supplier |
|---|---|---|---|---|
| Create a draft | Yes | Yes | Yes | No |
| Submit own draft | Yes | Yes | Yes | No |
| Submit someone else's draft | No | No | Yes | No |
| Approve someone else's submitted journal | No | Yes | Yes | No |
| Approve own submitted journal | No | No | Yes | No |
| Reverse posted manual journal | No | Yes | Yes | No |
| View all pending journals | No | Yes | Yes | No |

The admin exception is intentional: admin approval still requires the journal to be `pending_approval`, passes balance/account checks and remains audited using `approved_by_id`. It does not bypass accounting validations or permit double reversal. Accountant maker-checker separation remains enforced.

**Scope:** These changes control manual journal lifecycle operations; they do not introduce an application-wide authorization redesign.

## Verification

```powershell
cd D:\Ahmed\project\kora-world
git switch feature/accounting-redesign
git pull --ff-only origin feature/accounting-redesign

cd api
npm run build
npm test -- --runInBand journal-workflow.service.spec.ts

cd ..\web
npm run build
```

Browser checks:
1. As Admin, open Users → New User. Confirm Accountant is available; create a local test accountant user.
2. As that Accountant, open Accounting → Journal. Verify pending journals can be approved, but own journals cannot.
3. As Admin, create and submit an EGP journal draft, then approve it using the same admin session.
4. As Admin, submit someone else's draft and reverse a posted manual journal.
5. Check that Supplier cannot create or submit journals through the API.

No migration is required for adding the role. Do not deploy to production as part of validation.
