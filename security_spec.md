# MOTR Security Specification

## 1. Data Invariants
- A `Vehicle` must belong to exactly one `userId`.
- A `TimelineEvent` must belong to exactly one `vehicleId` and one `userId`.
- The `userId` in any document must match the authenticating user's UID.
- `mileage` must always be a non-negative number.
- `createdAt` and `updatedAt` should be server-assigned.

## 2. The "Dirty Dozen" Payloads (Denial Tests)
1. **Identity Theft**: Create a vehicle with someone else's `userId`.
2. **Ghost Field**: Update a vehicle with `isAdmin: true`.
3. **Mileage Poisoning**: Update mileage with a negative value or a 1MB string.
4. **Orphaned Event**: Create a `TimelineEvent` for a `vehicleId` that doesn't exist or belongs to another user.
5. **Time Spoofing**: Provide a custom `createdAt` date from the client.
6. **PII Leak**: Read another user's `UserProfile`.
7. **Cross-User Event Update**: User B updates User A's service record.
8. **Invalid Enum**: Create an event with `type: "Nuclear Reactor Service"`.
9. **Bulk Scrape**: Use `list` on `vehicles` without filtering by `userId`.
10. **Immutable Hijack**: Change the `userId` of an existing vehicle.
11. **Shadow Location**: Inject a massive string into the location address field.
12. **Future Mileage**: Set current mileage to a value higher than 10,000,000 (sanity check).

## 3. Test Invariant
All payloads above must return `PERMISSION_DENIED`.
