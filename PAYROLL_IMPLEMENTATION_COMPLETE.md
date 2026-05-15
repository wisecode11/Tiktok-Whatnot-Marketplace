# Complete Payroll & QuickBooks Flow - Implementation Summary

## ✅ What Has Been Implemented

### Backend Components

#### 1. **Payroll Controller** (`payrollController.js`)
- `GET /api/payroll/staff-rates` - Get all staff compensation rates
- `POST /api/payroll/staff-rates` - Update staff member hourly rate
- `POST /api/payroll/generate` - Generate payroll for period
- `POST /api/payroll/approve` - Approve and finalize payroll
- `GET /api/payroll/runs` - List all payroll runs
- `GET /api/payroll/runs/:payroll_run_id` - Get payroll details with staff breakdown

#### 2. **Payroll Routes** (`payrollRoutes.js`)
- All endpoints mounted at `/api/payroll/*`
- All endpoints require Clerk authentication

#### 3. **Payroll Service** (`payrollService.js`)
- `calculatePayrollForPeriod()` - Core payroll calculation
- `getPayrollSummary()` - Dashboard summary data
- `getPayrollWithUserDetails()` - Detailed payroll with user info
- `exportPayrollToCSV()` - CSV export functionality

#### 4. **QuickBooks Service** (updated)
- `syncPayrollRunToQuickBooks()` - Sync approved payroll to QB
- Token refresh logic for expired OAuth tokens
- Journal entry creation with automatic debit/credit balancing

#### 5. **App Integration** (`app.js`)
- Registered payroll routes: `app.use("/api/payroll", payrollRoutes)`

### Frontend Components

#### 1. **Payroll Management Page** (`/seller/payroll`)
Complete dashboard with 4 tabs:
- **Staff Rates**: View current hourly rates and deductions
- **Generate Payroll**: Select date range and generate payroll
- **Payroll Runs**: List all historical payroll runs
- **Details**: View detailed breakdown of selected payroll

Features:
- Real-time payroll calculation preview
- Approve/reject workflows
- QB sync status tracking
- Summary cards showing totals

#### 2. **Manage Staff Page** (updated)
- Added Payroll Management card with "Manage Payroll" button
- Navigation to `/seller/payroll` page

### Database Models

#### PayrollRun Model
```javascript
{
  _id: String,
  workspace_id: String,
  period_start: Date,
  period_end: Date,
  status: "draft" | "finalized",
  lines: [{
    user_id: String,
    minutes_worked: Number,
    regular_minutes: Number,
    overtime_minutes: Number,
    hourly_rate_cents: Number,
    gross_cents: Number,
    deduction_cents: Number,
    net_cents: Number
  }],
  quickbooks_sync: {
    synced_at: Date,
    realm_id: String,
    journal_entry_id: String,
    error: String
  },
  created_at: Date,
  updated_at: Date
}
```

#### EmployeeCompensation Model (existing)
```javascript
{
  user_id: String,
  workspace_id: String,
  hourly_rate_cents: Number,
  deduction_fixed_cents: Number,
  deduction_percent: Number
}
```

#### AttendanceSegment Model (existing)
```javascript
{
  workspace_id: String,
  user_id: String,
  clock_in_at: Date,
  clock_out_at: Date
}
```

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    STAFF ATTENDANCE                             │
│  Staff Clock In/Out via Web/Mobile Application                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE: AttendanceSegment                    │
│  Stores: clock_in_at, clock_out_at for each shift              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│              SELLER: Set Staff Hourly Rates                     │
│  POST /api/payroll/staff-rates                                  │
│  - user_id: staff member                                        │
│  - hourly_rate_cents: $15/hr = 1500 cents                      │
│  - deduction_fixed_cents: $0                                    │
│  - deduction_percent: 10%                                       │
│                                                                 │
│  DATABASE: EmployeeCompensation                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│            SELLER: Generate Payroll for Period                  │
│  POST /api/payroll/generate                                     │
│  - period_start: "2026-05-01"                                  │
│  - period_end: "2026-05-31"                                    │
│                                                                 │
│  Backend Process:                                               │
│  1. Fetch all AttendanceSegments for period                    │
│  2. For each staff member:                                      │
│     a. Sum total minutes worked                                │
│     b. Get hourly rate from EmployeeCompensation              │
│     c. Calculate regular hours (up to 160/month)              │
│     d. Calculate overtime hours (>160/month × 1.5)            │
│     e. gross_pay = (regular × rate) + (OT × rate × 1.5)      │
│     f. deductions = gross × deduction_percent                  │
│     g. net_pay = gross_pay - deductions                        │
│  3. Create PayrollRun with all lines (status: "draft")        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓ Response: payroll_run with all staff details
                 │
┌─────────────────────────────────────────────────────────────────┐
│            DATABASE: PayrollRun (status: "draft")              │
│  - period_start/end                                             │
│  - lines: [{user_id, hours, rate, gross, deductions, net}]   │
│  - totals: {total_gross, total_deductions, total_net}         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│          SELLER: Review Payroll in Dashboard                    │
│  GET /api/payroll/runs/:payroll_run_id                         │
│  UI shows:                                                       │
│  - Summary cards (Total Gross, Deductions, Net)                │
│  - Staff breakdown table                                        │
│  - [Approve Button] [Reject Button]                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│              SELLER: Approve Payroll                            │
│  POST /api/payroll/approve                                      │
│  - payroll_run_id: "xxx"                                        │
│                                                                 │
│  Backend:                                                        │
│  - Update PayrollRun status: "draft" → "finalized"            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│         DATABASE: PayrollRun (status: "finalized")              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│        SELLER: Sync to QuickBooks (Optional)                    │
│  POST /api/integrations/quickbooks/payroll/sync                │
│  - payrollRunId: "xxx"                                          │
│                                                                 │
│  Backend Process:                                               │
│  1. Validate PayrollRun exists & approved                      │
│  2. Get QB Connected Account for user                         │
│  3. Decrypt QB access token                                    │
│  4. Check if token expired:                                    │
│     - YES: Use refresh_token to get new access_token         │
│     - NO: Use existing token                                   │
│  5. Create QB Journal Entry:                                   │
│     DEBIT:  Payroll Expense    $X,XXX.XX                       │
│     CREDIT: Wages Payable      $X,XXX.XX                       │
│     CREDIT: Tax Withholdings   $XXX.XX                         │
│  6. Verify debit = credit (accounting balance)                │
│  7. POST to QB API                                             │
│  8. Update PayrollRun:                                          │
│     - quickbooks_sync.synced_at = now                         │
│     - quickbooks_sync.journal_entry_id = QB_ID                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│      QUICKBOOKS ONLINE: Accounting Update                       │
│  Journal Entry Created:                                          │
│  - Date: May 31, 2026                                           │
│  - Reference: "SellerHub payroll run xxx"                       │
│  - Accounts affected:                                           │
│    • Payroll Expense: +$12,000 (DEBIT)                         │
│    • Wages Payable: +$10,800 (CREDIT)                          │
│    • Tax Withholdings: +$1,200 (CREDIT)                        │
│                                                                 │
│  ✓ Real-time accounting update in QB                           │
│  ✓ Financial statements automatically updated                  │
│  ✓ Ready for tax reporting and bank reconciliation            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Real-Time Calculation Example

### Scenario: May 2026 Payroll

**Staff Members:**
1. Ahmed Ali - $15/hr, 10% tax
2. Fatima Khan - $12/hr, 10% tax

**Attendance Data:**
- Ahmed: Worked 160 hours
- Fatima: Worked 152 hours

**Payroll Calculation:**

```javascript
// Ahmed Ali
total_hours = 160
regular_hours = min(160, 160) = 160
overtime_hours = max(0, 160-160) = 0
gross_pay = (160 × $15) = $2,400
deductions = $2,400 × 10% = $240
net_pay = $2,400 - $240 = $2,160

// Fatima Khan
total_hours = 152
regular_hours = min(152, 160) = 152
overtime_hours = max(0, 152-160) = 0
gross_pay = (152 × $12) = $1,824
deductions = $1,824 × 10% = $182.40
net_pay = $1,824 - $182.40 = $1,641.60

// Totals
total_gross = $2,400 + $1,824 = $4,224
total_deductions = $240 + $182.40 = $422.40
total_net = $2,160 + $1,641.60 = $3,801.60
```

**QB Journal Entry Created:**
```
DEBIT:  Payroll Expense         $4,224.00
CREDIT: Wages Payable           $3,801.60
CREDIT: Tax Withholdings          $422.40
───────────────────────────────────────────
        Net:                        $0.00 ✓ Balanced
```

---

## 🚀 Overtime Example

**Scenario: Ahmed works 180 hours (OT)**

```javascript
total_hours = 180
regular_hours = min(180, 160) = 160
overtime_hours = max(0, 180-160) = 20

gross_pay = (160 × $15) + (20 × $15 × 1.5)
          = $2,400 + $450
          = $2,850

deductions = $2,850 × 10% = $285
net_pay = $2,850 - $285 = $2,565

// Comparison
No OT: $2,160 net
With OT: $2,565 net
Difference: +$405 (20 hrs × $15 × 1.5 - tax)
```

---

## 📱 User Journey

### As a Seller:

```
1. Staff Management
   → Create staff accounts
   → Assign hourly rates
   
2. Attendance Tracking
   → Staff clock in/out daily
   → System auto-tracks hours
   
3. Payroll Generation
   → Month end arrives
   → Click "Manage Payroll"
   → Select May 1-31
   → Click "Generate"
   → Review calculated payroll
   
4. Approval
   → Review staff hours
   → Review gross/net calculations
   → Click "Approve"
   
5. QB Sync (if connected)
   → Click "Sync to QuickBooks"
   → Confirm
   → Journal entry created in QB
   → Accounting updated in real-time
   
6. Reporting
   → View payroll history
   → Export to CSV if needed
   → Track QB sync status
```

---

## 🔐 Security Features

1. **Authentication**: All endpoints require Clerk auth token
2. **Encryption**: QB tokens encrypted with AES-256-GCM
3. **CSRF Protection**: OAuth state signed with HMAC-SHA256
4. **Token Refresh**: Automatic refresh for expired QB access tokens
5. **Data Validation**: All inputs validated before processing
6. **Audit Trail**: Created_at/updated_at timestamps on all records

---

## 📋 Testing Checklist

### Unit Tests
- [ ] Payroll calculation accuracy (regular + OT)
- [ ] Deduction calculation (fixed + percentage)
- [ ] QB journal entry balancing
- [ ] Token refresh logic
- [ ] Attendance minutes calculation

### Integration Tests
- [ ] End-to-end payroll generation
- [ ] QB sync with real tokens
- [ ] Staff rate updates
- [ ] Multiple staff payroll calculation
- [ ] CSV export functionality

### User Acceptance Tests
- [ ] Staff can clock in/out
- [ ] Seller can view rates
- [ ] Seller can generate payroll
- [ ] Seller can approve payroll
- [ ] Payroll appears in QB
- [ ] Calculations are correct

---

## 📞 API Reference

### Generate Payroll
```bash
POST /api/payroll/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "period_start": "2026-05-01",
  "period_end": "2026-05-31"
}

Response:
{
  "success": true,
  "payroll_run": {
    "_id": "payroll-123",
    "period_start": "2026-05-01",
    "period_end": "2026-05-31",
    "status": "draft",
    "lines": [
      {
        "user_id": "staff1",
        "minutes_worked": 9600,
        "gross_cents": 240000,
        "deduction_cents": 24000,
        "net_cents": 216000
      }
    ],
    "totals": {
      "total_gross": "2400.00",
      "total_deductions": "240.00",
      "total_net": "2160.00"
    }
  }
}
```

### Approve Payroll
```bash
POST /api/payroll/approve
Authorization: Bearer {token}
Content-Type: application/json

{
  "payroll_run_id": "payroll-123"
}

Response:
{
  "success": true,
  "message": "Payroll approved and ready for QuickBooks sync",
  "payroll_run": {
    "_id": "payroll-123",
    "status": "finalized"
  }
}
```

### Sync to QuickBooks
```bash
POST /api/integrations/quickbooks/payroll/sync
Authorization: Bearer {token}
Content-Type: application/json

{
  "payrollRunId": "payroll-123"
}

Response:
{
  "success": true,
  "journalEntryId": "1234567890",
  "payrollRunId": "payroll-123",
  "message": "Payroll successfully synced to QuickBooks"
}
```

---

## ✨ Features Completed

✅ Staff hourly rate management
✅ Attendance tracking (clock in/out)
✅ Automatic payroll calculation
✅ Regular and overtime calculation
✅ Multi-type deductions (fixed + percentage)
✅ Payroll approval workflow
✅ QuickBooks integration & sync
✅ Token refresh for expired OAuth
✅ Journal entry creation with balance verification
✅ Frontend dashboard with tabs
✅ CSV export capability
✅ Payroll history tracking

---

## 🎯 Next Steps (Optional)

- [ ] Email notifications for payroll approval
- [ ] Scheduled payroll generation (month-end automation)
- [ ] Multi-currency support
- [ ] Payroll scheduling/drafting
- [ ] Bank integration for direct deposit
- [ ] Tax form generation (1099, W2)
- [ ] Payroll analytics dashboard
