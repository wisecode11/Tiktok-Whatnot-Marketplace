# 🚀 Quick Start Guide - Payroll & QuickBooks

## What's Ready to Use

You now have a **complete payroll management system** integrated with QuickBooks that works like this:

```
Staff Clock In/Out → Payroll Generated → QB Sync → Real-time Accounting
```

---

## Step-by-Step: How It Works

### **STEP 1: Set Staff Hourly Rates**

**Where**: `/seller/manage-staff` → "Manage Payroll" button

**How**:
```
1. Click: [Manage Payroll]
2. Go to: "Staff Rates" tab
3. View all staff hourly rates
```

**To Update Rate** (API call):
```bash
POST /api/payroll/staff-rates
{
  "user_id": "staff123",
  "hourly_rate_cents": 1500,      // $15.00/hour
  "deduction_percent": 10         // 10% tax
}
```

---

### **STEP 2: Staff Tracks Hours (Automatic)**

**Staff Action**:
```
1. Staff login to app
2. Clock In when starting work
3. Clock Out when done
4. Hours auto-saved in database
```

**Under the Hood**:
- `POST /api/attendance/clock-in`
- `POST /api/attendance/clock-out`
- AttendanceSegment model stores: clock_in_at, clock_out_at

---

### **STEP 3: Generate Payroll**

**Where**: `/seller/payroll` → "Generate Payroll" tab

**How**:
```
1. Select: Start Date (e.g., May 1)
2. Select: End Date (e.g., May 31)
3. Click: [Generate Payroll]
4. System calculates:
   ✓ Hours worked
   ✓ Regular vs Overtime
   ✓ Gross pay
   ✓ Deductions
   ✓ Net pay
```

**API Call**:
```bash
POST /api/payroll/generate
{
  "period_start": "2026-05-01",
  "period_end": "2026-05-31"
}
```

**Returns**:
```json
{
  "payroll_run": {
    "_id": "payroll-xyz",
    "status": "draft",
    "lines": [
      {
        "user_id": "staff1",
        "hours_worked": 160,
        "gross_pay": "$2,400.00",
        "deductions": "$240.00",
        "net_pay": "$2,160.00"
      }
    ],
    "totals": {
      "total_gross": "$4,224.00",
      "total_deductions": "$422.40",
      "total_net": "$3,801.60"
    }
  }
}
```

---

### **STEP 4: Review Payroll**

**Where**: `/seller/payroll` → "Details" tab

**What You See**:
- Summary cards: Total Gross, Deductions, Net
- Staff breakdown table with individual calculations
- Hours, Rate, Gross, Deductions, Net per staff

**What's Calculated**:
```javascript
// For each staff member:
Total Hours = sum(all clock_out_at - clock_in_at)

Regular Hours = min(160, Total Hours)        // Cap at 160/month
Overtime Hours = max(0, Total Hours - 160)   // Everything over 160

Gross Pay = (Regular × Rate) + (OT × Rate × 1.5)
Deductions = Gross × Deduction%
Net Pay = Gross - Deductions
```

---

### **STEP 5: Approve Payroll**

**Where**: `/seller/payroll` → "Payroll Runs" tab

**How**:
```
1. Find payroll run (May 2026)
2. Click: [Approve]
3. Confirm in dialog
4. Status changes: "draft" → "finalized"
```

**Why Approve?**
- Locks payroll from editing
- Makes it ready for QB sync
- Marks final salary amounts

---

### **STEP 6: Sync to QuickBooks**

**Prerequisites**:
- ✅ QB account connected (see Manage Staff page)
- ✅ Payroll is approved (status: finalized)

**How**:
```
1. In "Payroll Runs" tab
2. Click: [Sync to QB]
3. Confirm dialog
4. System creates QB Journal Entry
5. QB shows: "✓ Synced" in 2-3 seconds
```

**What Happens in QB**:
```
Journal Entry Created:
Date: May 31, 2026
Reference: "SellerHub payroll run xyz"

DEBIT:  Payroll Expense           $4,224.00
CREDIT: Wages Payable             $3,801.60
CREDIT: Tax Withholdings            $422.40
─────────────────────────────────────────────
Total Balance:                         $0.00 ✓

Your QB financial statements are updated immediately!
```

---

## 📊 Example: Complete Payroll Flow

**Scenario**: May 2026, 2 Staff Members

### Input Data:

**Staff Setup**:
| Staff | Rate | Tax |
|-------|------|-----|
| Ahmed | $15/hr | 10% |
| Fatima | $12/hr | 10% |

**Attendance** (Hours Worked):
| Staff | Hours |
|-------|-------|
| Ahmed | 160 |
| Fatima | 152 |

### Calculation Process:

**Ahmed Ali**:
```
Total Hours: 160
Regular Hours: min(160, 160) = 160
Overtime Hours: max(0, 160-160) = 0

Gross Pay = (160 × $15) + (0 × $15 × 1.5)
          = $2,400 + $0
          = $2,400

Deductions = $2,400 × 10% = $240

Net Pay = $2,400 - $240 = $2,160
```

**Fatima Khan**:
```
Total Hours: 152
Regular Hours: min(152, 160) = 152
Overtime Hours: max(0, 152-160) = 0

Gross Pay = (152 × $12) + (0 × $12 × 1.5)
          = $1,824 + $0
          = $1,824

Deductions = $1,824 × 10% = $182.40

Net Pay = $1,824 - $182.40 = $1,641.60
```

### Payroll Run Summary:

```
Total Gross:      $4,224.00
Total Deductions: $  422.40
Total Net:        $3,801.60
```

### QB Journal Entry:

```
Date: 2026-05-31
Ref: "SellerHub payroll run xyz"

Account                     Debit       Credit
─────────────────────────────────────────────
Payroll Expense           $4,224.00
Wages Payable                         $3,801.60
Tax Withholdings                      $  422.40
─────────────────────────────────────────────
TOTAL                     $4,224.00    $4,224.00 ✓
```

---

## 🎯 Real-Time Features

✅ **Auto-Calculation**: When you generate payroll, calculations happen instantly
✅ **Overtime Tracking**: Automatically calculates 1.5x for hours over 160/month
✅ **Multi-Deduction**: Supports both fixed and percentage deductions
✅ **QB Real-Time**: QB accounting updates immediately upon sync
✅ **Token Auto-Refresh**: QB tokens refresh automatically if expired
✅ **Dashboard**: View payroll history anytime

---

## 📁 Files Created/Modified

### Backend

**New Files**:
- ✅ `backend/controllers/payrollController.js` - 6 payroll endpoints
- ✅ `backend/routes/payrollRoutes.js` - Payroll route registration
- ✅ `backend/services/payrollService.js` - Payroll calculation logic
- ✅ `QUICKBOOKS_PAYROLL_SETUP.md` - QB setup guide
- ✅ `PAYROLL_IMPLEMENTATION_COMPLETE.md` - Complete documentation

**Modified Files**:
- ✅ `backend/app.js` - Added payroll routes
- ✅ `backend/services/quickbooksService.js` - QB sync logic already there

### Frontend

**New Files**:
- ✅ `frontend/app/(seller)/seller/payroll/page.tsx` - Payroll dashboard

**Modified Files**:
- ✅ `frontend/app/(seller)/seller/manage-staff/page.tsx` - Added Payroll Management card

---

## 🔍 Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/payroll/staff-rates` | GET | List all staff rates |
| `/api/payroll/staff-rates` | POST | Update staff rate |
| `/api/payroll/generate` | POST | Generate payroll for period |
| `/api/payroll/approve` | POST | Approve payroll |
| `/api/payroll/runs` | GET | List payroll runs |
| `/api/payroll/runs/:id` | GET | Get payroll details |
| `/api/integrations/quickbooks/payroll/sync` | POST | Sync to QB |

All endpoints require: `Authorization: Bearer {clerk_token}`

---

## 🔒 Security

- ✅ All QB tokens encrypted (AES-256-GCM)
- ✅ OAuth CSRF protected with HMAC-signed state
- ✅ Token auto-refresh for expired sessions
- ✅ Clerk authentication required
- ✅ All data validated before processing

---

## 🚨 Troubleshooting

### "OAuth state expired"
**Solution**: Click "Connect" again (states expire after 10 minutes)

### "QuickBooks not connected"
**Solution**: Go to `/seller/manage-staff` and click "Connect QuickBooks"

### Payroll calculation wrong
**Solution**:
1. Check staff hourly rate: `GET /api/payroll/staff-rates`
2. Check attendance: `GET /api/attendance/staff/:staffId/monthly`
3. Verify rates in database

### QB sync failed
**Solution**:
1. Check QB account IDs in `.env`:
   - `INTUIT_PAYROLL_EXPENSE_ACCOUNT_ID`
   - `INTUIT_PAYROLL_WAGES_PAYABLE_ACCOUNT_ID`
2. Check token expiry: System auto-refreshes
3. Verify QB company is connected

---

## 📞 Test It Now

### 1. Set Staff Rate
```bash
curl -X POST http://localhost:5000/api/payroll/staff-rates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "hourly_rate_cents": 1500,
    "deduction_percent": 10
  }'
```

### 2. Generate Payroll
```bash
curl -X POST http://localhost:5000/api/payroll/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "period_start": "2026-05-01",
    "period_end": "2026-05-31"
  }'
```

### 3. Approve Payroll
```bash
curl -X POST http://localhost:5000/api/payroll/approve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payroll_run_id": "PAYROLL_ID_FROM_STEP_2"
  }'
```

### 4. Sync to QB
```bash
curl -X POST http://localhost:5000/api/integrations/quickbooks/payroll/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payrollRunId": "PAYROLL_ID_FROM_STEP_2"
  }'
```

---

## ✨ What's Included

✅ Complete payroll engine
✅ QuickBooks integration
✅ Staff rate management
✅ Attendance tracking
✅ OT calculation
✅ Multi-deduction support
✅ QB journal entry creation
✅ Token auto-refresh
✅ Frontend dashboard
✅ Full documentation

---

## 🎉 Ready to Use!

Your complete payroll system is ready. No additional setup needed beyond QB OAuth connection credentials in `.env`

**Start here**: `/seller/manage-staff` → Click "Manage Payroll" button
