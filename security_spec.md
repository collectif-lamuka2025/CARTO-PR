# Security Specification - CartoPartenaires

## 1. Data Invariants
- Only authenticated users with verified credentials can record field GPS locations and define categories.
- Every partner location must have a valid non-empty name, categoryId, latitude (-90 to 90), longitude (-180 to 180), and non-negative accuracy.
- `agentId` on creation must strictly match `request.auth.uid`.
- `createdBy` on category creation must strictly match `request.auth.uid`.
- Immutable fields (`createdAt`, `agentId`, `createdBy`) cannot be altered during updates.
- Timestamps and text field lengths are rigorously capped to prevent Denial-of-Wallet and payload injection attacks.

## 2. The Dirty Dozen Payloads (Rejection Matrix)
1. Anonymous user attempting to create category: REJECT (Unauthorized).
2. Location creation with spoofed `agentId != request.auth.uid`: REJECT (Identity Spoofing).
3. Location creation with latitude > 90 or < -90: REJECT (Out of bounds).
4. Location creation with missing `name`: REJECT (Schema violation).
5. Category creation with missing `color`: REJECT (Missing required key).
6. Malicious payload injecting unwhitelisted keys (e.g. `isAdmin: true`): REJECT (Shadow field injection).
7. Location update trying to mutate original `agentId`: REJECT (Immutability violation).
8. Location with 50KB name string: REJECT (Denial of Wallet size limit).
9. Path variable injection with non-alphanumeric junk: REJECT (Invalid ID pattern).
10. Blanket unauthenticated read of location coordinates: REJECT (Zero-Trust baseline).
11. Update attempting to wipe category association: REJECT (Mandatory field).
12. Deletion of location by unauthorized third-party user: REJECT (Ownership violation).
