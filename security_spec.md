# Security Specification — Kasir Bengkel & Inventaris Firestore

## 1. Data Invariants

1. **Identity & PII Isolation (`/users/{userId}`)**:
   - Every user profile belongs strictly to `request.auth.uid` (`uid == userId`).
   - Email and personal profile metadata cannot be read by other non-admin users (`isOwner(userId) || isEmailAdmin()`).
   - Non-admin users cannot self-assign `role: "admin"` during creation or elevate their `role` during updates.
   - Only `barabereapp1@gmail.com` with `request.auth.token.email_verified == true` holds admin privilege.

2. **Verified Authentication & Owner Integrity**:
   - Every read and write requires `request.auth != null && request.auth.token.email_verified == true`.
   - Every document created in `spareParts`, `customers`, `transactions`, `transactions/{txId}/items`, and `serviceHistories` must stamp `ownerId == request.auth.uid`.
   - `ownerId` and `createdAt` are immutable after creation.

3. **Temporal Integrity & Path Hardening**:
   - All `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
   - All single-document path IDs (`userId`, `partId`, `customerId`, `transactionId`, `itemId`, `historyId`) must pass `isValidId()` (`^[a-zA-Z0-9_\-]+$`, length 1–128).
   - Every string field has explicit `.size()` bounds; numeric prices and stocks are non-negative.

4. **Relational Atomicity (`existsAfter` / `getAfter`) & Master Gate**:
   - A `Transaction` cannot be created without a valid `customerId` that exists (`existsAfter`).
   - A `TransactionItem` under `transactions/{transactionId}/items/{itemId}` enforces the Master Gate via `getAfter` on the parent transaction so parent ownership is verified synchronously during batch checkout.
   - A `ServiceHistory` record cannot be created without valid `transactionId` and `customerId` existing atomically (`existsAfter`).

5. **Query Enforcer (`allow list`)**:
   - No `allow list` rule delegates filtering to the client or calls `get()`/`exists()`. Every `allow list` evaluates `resource.data.ownerId == request.auth.uid || isEmailAdmin()`.

6. **Terminal State Locking**:
   - Once a `Transaction` transitions to `status == "Batal"`, non-admin updates are blocked permanently.

---

## 2. The "Dirty Dozen" Attack Payloads

1. **Unverified Email Admin Spoof**: Token has `email: "barabereapp1@gmail.com"` with `email_verified: false` attempting to list `users` -> **DENIED**.
2. **Self-Assigned Admin Role**: User `uid_attacker` creates `/users/uid_attacker` with `{ role: "admin" }` -> **DENIED**.
3. **Privilege Escalation Update**: User `uid_attacker` updates `/users/uid_attacker` changing `role` from `"cashier"` to `"admin"` -> **DENIED**.
4. **Shadow Ghost Field Injection**: Creating `/spareParts/part_1` with valid fields plus `{ isFeatured: true }` -> **DENIED** by `keys().hasOnly(...)`.
5. **Cross-Tenant Identity Spoofing**: User `uid_A` creates `/spareParts/part_2` with `{ ownerId: "uid_B" }` -> **DENIED**.
6. **PII Cross-User Read**: User `uid_A` attempts `get` on `/users/uid_B` -> **DENIED**.
7. **Blanket List Query Scraping**: User `uid_A` runs un-scoped `list` on `/transactions` without `where("ownerId", "==", "uid_A")` -> **DENIED**.
8. **ID Poisoning / Oversized Path**: Creating `/customers/invalid$id..over128chars...` -> **DENIED** by `isValidId()`.
9. **Client Timestamp Forgery**: Creating `/transactions/tx_1` with backdated `createdAt` not equal to `request.time` -> **DENIED**.
10. **Orphaned Service History**: Creating `/serviceHistories/hist_1` pointing to non-existent `transactionId: "fake_tx"` -> **DENIED** by `existsAfter()`.
11. **Negative Stock / Price Poisoning**: Updating `/spareParts/part_1` with `{ stock: -50 }` or `{ sellPrice: -1000 }` -> **DENIED**.
12. **Terminal Transaction Tampering**: Non-admin attempting to edit `totalAmount` or revert `status: "Selesai"` on a `"Batal"` transaction -> **DENIED**.
