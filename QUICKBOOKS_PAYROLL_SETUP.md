# QuickBooks & Payroll Configuration

This document outlines all environment variables needed for QuickBooks integration and Payroll management.

## QuickBooks OAuth Credentials

Set these in your `.env` file:

```env
# Intuit OAuth Client Credentials
INTUIT_CLIENT_ID=ABoYwWgSRSv0lmfw42CFl3BV5wc5ceEGuo9v9tJOsgCQOyz9YS
INTUIT_CLIENT_SECRET=lqJ4wy7LEECUiBUK00TwZOFP1eHEqbWygss8DSLB

# OAuth Redirect URI (must match registered in Intuit App Center)
INTUIT_REDIRECT_URI=http://localhost:5000/api/integrations/quickbooks/callback

# QuickBooks Environment
INTUIT_ENVIRONMENT=sandbox
# Options: sandbox | production

# Intuit Realm ID (Company ID in QuickBooks)
# This is auto-populated during OAuth flow, but can be set manually if needed
INTUIT_REALM_ID=

# QB Account Mapping - Set these to your QB Chart of Accounts IDs
# You can find these in your QB Company Settings
INTUIT_PAYROLL_EXPENSE_ACCOUNT_ID=60000001
INTUIT_PAYROLL_WAGES_PAYABLE_ACCOUNT_ID=25000001
INTUIT_PAYROLL_DEDUCTIONS_PAYABLE_ACCOUNT_ID=25000002
```

## How to Find Your QB Account IDs

1. Log into QuickBooks Online
2. Navigate to: **Settings** → **Chart of Accounts**
3. Find the following accounts:
   - **Payroll Expense** (typically Payroll Expenses)
   - **Wages Payable** (typically Payroll Liabilities)
   - **Deductions Payable** (typically Payroll Liabilities)
4. Click on each account and copy the ID from the URL

Example URL: `https://qbo.intuit.com/app/account/1234567890`
The `1234567890` is your Account ID.

## Payroll Workflow

### 1. Staff Tracks Hours
- Staff members clock in/out through the app
- Hours are automatically recorded in `AttendanceSegment` model

### 2. Seller Sets Compensation Rates
```bash
POST /api/payroll/staff-rates
{
  "user_id": "staff123",
  "hourly_rate_cents": 1500,         // $15.00
  "deduction_fixed_cents": 0,        // $0.00 fixed
  "deduction_percent": 10            // 10%
}
```

### 3. Generate Payroll
```bash
POST /api/payroll/generate
{
  "period_start": "2026-05-01",
  "period_end": "2026-05-31"
}
```

Automatically calculates:
- Regular hours (up to 160/month)
- Overtime hours (1.5x rate over 160)
- Gross pay
- Deductions (fixed + percentage)
- Net pay

### 4. Review & Approve
```bash
POST /api/payroll/approve
{
  "payroll_run_id": "run-123"
}
```

### 5. Sync to QuickBooks
```bash
POST /api/integrations/quickbooks/payroll/sync
{
  "payrollRunId": "run-123"
}
```

Creates QB Journal Entry:
```
DEBIT:  Payroll Expense              $X,XXX.XX
CREDIT: Wages Payable                $X,XXX.XX
CREDIT: Tax Withholdings Payable     $XXX.XX
```

## API Endpoints

### Payroll Management
- `GET /api/payroll/staff-rates` - List all staff rates
- `POST /api/payroll/staff-rates` - Update staff rate
- `POST /api/payroll/generate` - Generate payroll for period
- `POST /api/payroll/approve` - Approve payroll
- `GET /api/payroll/runs` - List payroll runs
- `GET /api/payroll/runs/:id` - Get payroll details

### QuickBooks Integration
- `GET /api/integrations/quickbooks/connect` - Start OAuth flow
- `GET /api/integrations/quickbooks/callback` - OAuth callback
- `POST /api/integrations/quickbooks/payroll/sync` - Sync payroll
- `GET /api/integrations/accounts` - List connected accounts
- `DELETE /api/integrations/accounts/quickbooks` - Disconnect QB

## Frontend Pages

- `/seller/manage-staff` - Staff management with QB card
- `/seller/payroll` - Payroll management dashboard

## Encryption

Sensitive data (QB tokens) is encrypted using:
- Algorithm: AES-256-GCM
- Key: `APP_ENCRYPTION_KEY` environment variable

## Testing

### 1. Test OAuth Connection
1. Go to `/seller/manage-staff`
2. Click "Connect QuickBooks"
3. Login to Intuit
4. Select QB company
5. Verify "Connected" badge appears

### 2. Test Payroll Generation
```bash
# 1. Staff member clocks in/out
POST /api/attendance/clock-in
POST /api/attendance/clock-out

# 2. Generate payroll
POST /api/payroll/generate
{
  "period_start": "2026-05-01",
  "period_end": "2026-05-31"
}

# 3. View results
GET /api/payroll/runs
GET /api/payroll/runs/{payroll_run_id}

# 4. Approve
POST /api/payroll/approve
{
  "payroll_run_id": "..."
}

# 5. Sync to QB
POST /api/integrations/quickbooks/payroll/sync
{
  "payrollRunId": "..."
}
```

### 3. Check QB Journal Entry
1. Log into QB
2. Go to **+ New** → **Journal Entry**
3. Filter by "SellerHub payroll"
4. Verify amounts and accounts

## Troubleshooting

### "OAuth state expired"
- State tokens expire after 10 minutes
- Solution: Click "Connect" again

### "QuickBooks token refresh failed"
- Refresh token may have expired (90 days in sandbox)
- Solution: Disconnect and reconnect QB account

### "Payroll journal entry not balanced"
- Debit total ≠ Credit total
- Check: `INTUIT_PAYROLL_EXPENSE_ACCOUNT_ID` and wage account IDs
- Solution: Verify account IDs in QB

### "Missing QuickBooks realm ID"
- Intuit didn't return company ID
- Solution: Check INTUIT_REALM_ID env var or reconnect QB

## Security Notes

1. **Token Storage**: All QB tokens are encrypted in database
2. **CSRF Protection**: State tokens are HMAC-signed with 10-minute expiry
3. **Authentication**: All endpoints require Clerk auth token
4. **HTTPS**: QB OAuth requires HTTPS in production

## Production Deployment

1. Change `INTUIT_ENVIRONMENT=production`
2. Update OAuth credentials from production Intuit app
3. Update `FRONTEND_URL` and `BACKEND_URL` for production domains
4. Update `QUICKBOOKS_REDIRECT_URI` to production callback URL
5. Set strong `APP_ENCRYPTION_KEY`
6. Verify QB account IDs in production company

## Support

For issues or questions:
- Intuit QB API Docs: https://developer.intuit.com/
- OAuth Flow: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
