# 📋 PAYROLL & QUICKBOOKS - QUICK REFERENCE CARD

## 🚀 START HERE

### Option 1: Use the Dashboard
```
1. Go to: http://localhost:3000/seller/manage-staff
2. Scroll down to: "Payroll Management" card
3. Click: [Manage Payroll] button
4. You're in the payroll dashboard!
```

### Option 2: Direct URL
```
Navigate to: http://localhost:3000/seller/payroll
```

---

## 5-MINUTE PAYROLL WORKFLOW

### Minute 1-2: Set Staff Rate
```
In Payroll Dashboard:
  1. Click tab: "Staff Rates"
  2. You'll see all staff hourly rates
  3. Note the rates (e.g., Ahmed $15/hr)
```

### Minute 2-3: Generate Payroll
```
In Payroll Dashboard:
  1. Click tab: "Generate Payroll"
  2. Set dates: May 1 - May 31
  3. Click: [Generate Payroll]
  4. Wait 1-2 seconds
  5. See payroll generated with all calculations
```

### Minute 3-4: Review
```
In Payroll Dashboard:
  1. Click tab: "Details"
  2. See summary cards (Gross, Deductions, Net)
  3. See staff table with breakdown
  4. Verify amounts are correct
```

### Minute 4-5: Approve & Sync
```
In Payroll Dashboard:
  1. Click tab: "Payroll Runs"
  2. Find your payroll run
  3. Click: [Approve] → [Sync to QB]
  4. Done! QB updated automatically
```

---

## 🎯 WHAT EACH TAB DOES

| Tab | Purpose | Action |
|-----|---------|--------|
| **Staff Rates** | View/manage hourly rates | View only (rates set via API) |
| **Generate Payroll** | Create new payroll | Pick dates → Generate |
| **Payroll Runs** | List all payroll | Review → Approve → Sync to QB |
| **Details** | View breakdown | See per-staff calculations |

---

## 💰 PAYROLL CALCULATION (Automatic)

**What happens when you click [Generate Payroll]:**

```
For each staff member:
  1. Get hours from attendance
  2. Get hourly rate from database
  3. Calculate:
     • Regular: 160 hours max/month
     • Overtime: anything over 160
     • Gross: (regular × rate) + (OT × rate × 1.5)
     • Deductions: Gross × deduction%
     • Net: Gross - Deductions
  4. Sum all staff for totals
```

**Example Ahmed (180 hours, $15/hr, 10% tax):**
```
Regular: 160 × $15 = $2,400
OT: 20 × $15 × 1.5 = $450
Gross: $2,850
Tax: $285
Net: $2,565
```

---

## ✅ QUICKBOOKS SYNC

**What happens when you click [Sync to QB]:**

```
Backend automatically:
  1. Gets QB connection
  2. Creates Journal Entry:
     DEBIT Payroll Exp   $X
     CREDIT Wages Pay    $X
  3. Syncs to QB
  4. Updates status: ✓ Synced
```

**QB automatically updates:**
- Payroll Expense account
- Wages Payable account
- Tax Withholding account
- Financial statements (real-time)

---

## 🔧 API QUICK REFERENCE

### If Using API Instead of Dashboard:

```bash
# 1. Set staff rate
POST /api/payroll/staff-rates
{
  "user_id": "staff123",
  "hourly_rate_cents": 1500,
  "deduction_percent": 10
}

# 2. Generate payroll
POST /api/payroll/generate
{
  "period_start": "2026-05-01",
  "period_end": "2026-05-31"
}

# 3. Approve payroll
POST /api/payroll/approve
{
  "payroll_run_id": "run-123"
}

# 4. Sync to QB
POST /api/integrations/quickbooks/payroll/sync
{
  "payrollRunId": "run-123"
}
```

---

## 📊 EXPECTED RESULTS

### After Generate:
```
✓ PayrollRun created in database
✓ Status: "draft"
✓ All staff calculations complete
✓ Ready to review/approve
```

### After Approve:
```
✓ Status changes to "finalized"
✓ Can no longer edit
✓ Ready for QB sync
```

### After QB Sync:
```
✓ Journal Entry created in QB
✓ Accounting updated in QB
✓ Status: "✓ Synced"
✓ QB journal_entry_id stored
```

---

## 🐛 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Staff rates not showing | Wait 2s, refresh page |
| Generate fails | Check date range is valid |
| Numbers look wrong | Check staff hourly rates |
| QB sync fails | Verify QB is connected |
| Token expired | System auto-refreshes |

---

## 📈 WORKFLOW DIAGRAM

```
Staff Clock In/Out
        ↓
[Generate] Generate Payroll
        ↓
Dashboard: See all calculations
        ↓
[Approve] Approve Payroll
        ↓
[Sync QB] Send to QuickBooks
        ↓
QB: Accounting Updated ✓
```

---

## 🎯 STATUS MEANINGS

| Status | Meaning |
|--------|---------|
| **draft** | Generated, not yet approved |
| **finalized** | Approved, ready for QB |
| **✓ Synced** | Sent to QB successfully |

---

## 💡 TIPS & TRICKS

```
✓ Generate payroll every month-end
✓ Review numbers before approving
✓ QB sync is one-click after approve
✓ Multiple staff sync at once
✓ History saved forever
✓ Can generate past periods anytime
✓ Rates changed = next payroll uses new rates
```

---

## 📞 QUICK HELP

**Q: How do I change a staff member's hourly rate?**
A: Set it via API or wait for future UI update

**Q: Can I edit payroll after approving?**
A: No, generate a new one if changes needed

**Q: Does QB sync automatically?**
A: No, you click [Sync to QB] - one click

**Q: What if QB isn't connected?**
A: Get "Connection Error" - connect first

**Q: Can I sync same payroll twice?**
A: Yes, but shouldn't - creates duplicate entries

**Q: How do I view past payroll?**
A: Go to "Payroll Runs" tab - shows history

---

## 🎊 YOU'RE READY!

All set to use the payroll system. Bookmark this reference card.

**Next Step**: Go to `/seller/manage-staff` → "Manage Payroll" button

---

*Last Updated: May 14, 2026*
