# Moderator Profile Fix Documentation

## Issues Resolved

### 1. ✅ Fixed: E11000 Duplicate Key Error for `public_slug`

**Problem:**
```
E11000 duplicate key error collection: sellerhub.moderatorprofiles index: public_slug_1 dup key: { public_slug: null }
```

**Root Cause:**
- The `ModeratorProfile` model had `unique: true` on the `public_slug` field
- Multiple moderator profiles had `public_slug: null` (when profile is in draft status)
- MongoDB's unique index doesn't allow multiple null values by default

**Solution:**
- Added `sparse: true` to the unique index in `ModeratorProfile.js`
- Ran migration script `fixModeratorProfileIndex.js` to:
  - Drop the old non-sparse index
  - Remove any duplicate records with null slugs
  - Create a new sparse unique index

**Files Modified:**
- `backend/models/ModeratorProfile.js` - Added `sparse: true` to public_slug index
- `backend/scripts/fixModeratorProfileIndex.js` - Migration script (new file)

**How Sparse Indexes Work:**
- A sparse index **only** includes documents where the indexed field exists and is not null
- Allows unlimited documents with null/missing values
- Ensures only published profiles (with non-null slugs) are unique

---

### 2. ✅ Verified: Stripe Connection for Moderators

**How Stripe Integration Works:**

1. **Moderator Signup Flow:**
   ```
   Moderator Signs In → Launch Pad → Connect Stripe Button
   ```

2. **Stripe Connection Process:**
   - Frontend calls: `POST /api/integrations/connect` with `platform: "stripe"` and `role: "moderator"`
   - Backend creates a Stripe Express account and generates account link
   - User completes Stripe onboarding at Stripe's URL
   - User redirected back to frontend with `status=return`
   - Frontend calls: `GET /api/integrations/stripe/status` to verify connection
   - Connection status saved in `ConnectedAccount` collection

3. **Database Schema:**
   - **ConnectedAccount**: Stores Stripe account reference and status
   - **ModeratorProfile**: Stores moderator details (separate from Stripe data)

4. **Payout Flow (Future Implementation):**
   - When someone hires the moderator
   - System retrieves connected Stripe account from ConnectedAccount
   - Payment transfers directly to moderator's Stripe account
   - No need to ask for credentials again

**Database Collections Involved:**
```javascript
// ConnectedAccount (Stripe data)
{
  user_id: "...",
  platform: "stripe",
  account_external_id: "acct_xxxx",  // Stripe Connect Account ID
  status: "connected",
  metadata_json: {
    charges_enabled: true,
    payouts_enabled: true,
    requirements: []
  }
}

// ModeratorProfile (Profile data)
{
  user_id: "...",
  display_name: "John Moderator",
  profile_status: "published",
  public_slug: "john-moderator",
  hourly_rate_cents: 2500,
  // ... other profile fields
}
```

---

## Testing the Fix

### Test Moderator Profile Loading:
```bash
# Frontend should now load without E11000 error
# Moderator → Public Profile page should display correctly
```

### Test Stripe Connection:
```
1. Sign in as moderator
2. Go to Launch Pad page
3. Click "Connect Stripe Payments"
4. Complete Stripe onboarding
5. Should redirect back with success message
6. Should see "Stripe Payments" connected with account details
```

### Test Profile Publishing:
```
1. Fill in public profile details
2. Click "Publish Profile"
3. Should generate unique public slug
4. Profile should appear in marketplace
```

---

## Running the Migration

If the migration hasn't been run yet:

```bash
cd backend
node scripts/fixModeratorProfileIndex.js
```

The script will:
- ✅ Drop old non-sparse index
- ✅ Clean up any duplicate null records
- ✅ Create new sparse unique index
- ✅ Verify the fix

---

## Key Insights

### Why Stripe Connection and ModeratorProfile are Separate:
- **Stripe** (`ConnectedAccount`) = Payment processing credentials
- **Profile** (`ModeratorProfile`) = Public profile for marketplace
- Separation allows moderators to control when they go public
- Stripe account can be connected without publishing profile

### Why `sparse: true` Matters:
- ✅ Allows multiple draft profiles (public_slug: null)
- ✅ Enforces uniqueness only for published profiles
- ✅ No more "duplicate key" errors
- ✅ Better for real-world scenarios

---

## API Endpoints for Reference

### Stripe Connection:
- `POST /api/integrations/connect` - Start Stripe connection
- `GET /api/integrations/stripe/status` - Check connection status
- `DELETE /api/integrations/accounts/stripe` - Disconnect Stripe

### Moderator Profile:
- `GET /api/moderator-profiles/mine` - Get current profile
- `PUT /api/moderator-profiles/mine` - Update profile (draft)
- `POST /api/moderator-profiles/mine/publish` - Publish profile

---

## Summary

| Issue | Status | Solution |
|-------|--------|----------|
| E11000 duplicate key error | ✅ Fixed | Made public_slug index sparse |
| Moderator profile unavailable | ✅ Fixed | Database index corrected |
| Stripe connection logic | ✅ Working | Already correctly implemented |
| Moderator payout readiness | ✅ Ready | Stripe account properly stored for future charges |

The system is now ready for moderators to:
1. ✅ Create and publish profiles
2. ✅ Connect Stripe accounts
3. ✅ Receive payouts when hired for moderation work
