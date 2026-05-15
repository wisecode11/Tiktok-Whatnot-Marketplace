'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@clerk/nextjs';
import { getClerkErrorMessage, waitForSessionToken } from '@/lib/auth';
import { Download, Loader2, CreditCard } from 'lucide-react';
import { PayStaffModal } from '@/components/payroll/pay-staff-modal';

type StaffRate = {
  user_id: string;
  name: string;
  email?: string;
  hourly_rate_cents: number;
  hourly_rate: string;
  deduction_fixed_cents: number;
  deduction_percent: number;
};

type RateDraft = {
  hourly_rate: string;
  deduction_percent: string;
  deduction_fixed: string;
};

type PayrollRow = {
  user_id: string;
  name: string;
  email: string | null;
  hours_worked: string;
  regular_hours: string;
  overtime_hours: string;
  hourly_rate: string;
  gross_pay: string;
  deductions: string;
  net_pay: string;
  can_download: boolean;
  already_downloaded: boolean;
  qb_journal_entry_id: string | null;
  payroll_run_id: string | null;
  staff_stripe_ready: boolean;
  staff_stripe_message: string | null;
  payment_status: string | null;
  payment_paid_at: string | null;
  stripe_hosted_invoice_url: string | null;
  can_pay_now: boolean;
};

function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
}

async function readApiError(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null);
    if (data?.error) return data.error;
  }
  const text = await response.text().catch(() => '');
  return text || fallbackMessage;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: isoDate(first), end: isoDate(last) };
}

export default function PayrollManagement() {
  const { getToken } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('payroll');

  const [staffRates, setStaffRates] = useState<StaffRate[]>([]);
  const [rateDrafts, setRateDrafts] = useState<Record<string, RateDraft>>({});
  const [savingStaffId, setSavingStaffId] = useState<string>('');

  const initialPeriod = useMemo(() => defaultPeriod(), []);
  const [periodStart, setPeriodStart] = useState<string>(initialPeriod.start);
  const [periodEnd, setPeriodEnd] = useState<string>(initialPeriod.end);

  const [previewRows, setPreviewRows] = useState<PayrollRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [downloadingUserId, setDownloadingUserId] = useState<string>('');
  const [payModalStaff, setPayModalStaff] = useState<{
    userId: string;
    name: string;
    netPay: string;
    grossPay: string;
    deductions: string;
  } | null>(null);

  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const loadStaffRates = useCallback(async () => {
    try {
      const token = await waitForSessionToken(getToken);
      const response = await fetch(`${getBackendBaseUrl()}/api/payroll/staff-rates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to load staff rates'));
      }
      const data = await response.json();
      const list: StaffRate[] = data.staff || [];
      setStaffRates(list);

      const drafts: Record<string, RateDraft> = {};
      list.forEach((staff) => {
        drafts[staff.user_id] = {
          hourly_rate: String(staff.hourly_rate || '15.00'),
          deduction_percent: String(staff.deduction_percent ?? 0),
          deduction_fixed: String(
            typeof staff.deduction_fixed_cents === 'number'
              ? (staff.deduction_fixed_cents / 100).toFixed(2)
              : '0.00',
          ),
        };
      });
      setRateDrafts(drafts);
    } catch (err) {
      setError(getClerkErrorMessage(err));
    }
  }, [getToken]);

  const loadPreview = useCallback(async () => {
    if (!periodStart || !periodEnd) return;
    try {
      setPreviewLoading(true);
      setError('');
      const token = await waitForSessionToken(getToken);
      const url = new URL(`${getBackendBaseUrl()}/api/payroll/preview`);
      url.searchParams.set('period_start', periodStart);
      url.searchParams.set('period_end', periodEnd);
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to load payroll preview'));
      }
      const data = await response.json();
      setPreviewRows(data.staff || []);
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  }, [getToken, periodStart, periodEnd]);

  useEffect(() => {
    void loadStaffRates();
  }, [loadStaffRates]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  function handleRateDraftChange(staffId: string, field: keyof RateDraft, value: string) {
    setRateDrafts((prev) => ({
      ...prev,
      [staffId]: {
        ...(prev[staffId] || { hourly_rate: '', deduction_percent: '', deduction_fixed: '' }),
        [field]: value,
      },
    }));
  }

  async function handleSaveStaffRate(staffId: string) {
    const draft = rateDrafts[staffId];
    if (!draft) return;
    const hourlyRate = Number(draft.hourly_rate);
    const deductionPercent = Number(draft.deduction_percent || 0);
    const deductionFixed = Number(draft.deduction_fixed || 0);

    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      setError('Hourly rate must be greater than 0');
      return;
    }
    if (hourlyRate > 1000) {
      setError('Hourly rate looks too high (max $1,000/hr).');
      return;
    }
    if (!Number.isFinite(deductionPercent) || deductionPercent < 0 || deductionPercent > 100) {
      setError('Deduction % must be between 0 and 100');
      return;
    }
    if (!Number.isFinite(deductionFixed) || deductionFixed < 0) {
      setError('Fixed deduction must be 0 or greater');
      return;
    }

    try {
      setSavingStaffId(staffId);
      setError('');
      setSuccess('');
      const token = await waitForSessionToken(getToken);
      const response = await fetch(`${getBackendBaseUrl()}/api/payroll/staff-rates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: staffId,
          hourly_rate_cents: Math.round(hourlyRate * 100),
          deduction_percent: deductionPercent,
          deduction_fixed_cents: Math.round(deductionFixed * 100),
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to save staff rate'));
      }
      setSuccess('Staff compensation updated successfully');
      await loadStaffRates();
      await loadPreview();
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setSavingStaffId('');
    }
  }

  async function handleDownloadPayroll(userId: string, staffName: string) {
    try {
      setDownloadingUserId(userId);
      setError('');
      setSuccess('');
      const token = await waitForSessionToken(getToken);
      const response = await fetch(
        `${getBackendBaseUrl()}/api/payroll/staff/${encodeURIComponent(userId)}/issue-and-download`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to download payroll'));
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      const filename = match
        ? decodeURIComponent(match[1])
        : `payslip-${staffName.replace(/\s+/g, '_')}-${periodStart}-to-${periodEnd}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const qbWarningRaw = response.headers.get('x-qb-sync-warning');
      const qbWarning = qbWarningRaw ? decodeURIComponent(qbWarningRaw) : '';
      if (qbWarning) {
        setSuccess(
          `Payslip downloaded for ${staffName}. QuickBooks sync skipped: ${qbWarning}`,
        );
      } else {
        setSuccess(`Payslip downloaded for ${staffName} and posted to QuickBooks.`);
      }
      await loadPreview();
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setDownloadingUserId('');
    }
  }

  const periodTotals = useMemo(() => {
    return previewRows.reduce(
      (acc, r) => {
        acc.gross += Number(r.gross_pay) || 0;
        acc.deductions += Number(r.deductions) || 0;
        acc.net += Number(r.net_pay) || 0;
        acc.hours += Number(r.hours_worked) || 0;
        return acc;
      },
      { gross: 0, deductions: 0, net: 0, hours: 0 },
    );
  }, [previewRows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payroll Management</h1>
        <p className="text-gray-600 mt-2">
          Set hourly rates, issue payroll, and download local payslips.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="rates">Staff Rates</TabsTrigger>
        </TabsList>

        {/* PAYROLL TAB — period selector + per-staff download */}
        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle>Staff Payroll</CardTitle>
              <CardDescription>
                Pick a period, see attendance-based pay, and click <strong>Issue + Download Payslip</strong> to post
                the journal entry to QuickBooks and download the payslip.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium mb-2">Period Start</label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Period End</label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
                <div>
                  <Button onClick={() => void loadPreview()} disabled={previewLoading} className="w-full">
                    {previewLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-blue-50">
                  <CardContent className="pt-6">
                    <p className="text-xs text-gray-600">Total Hours</p>
                    <p className="text-xl font-bold">{periodTotals.hours.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="pt-6">
                    <p className="text-xs text-gray-600">Total Gross</p>
                    <p className="text-xl font-bold">${periodTotals.gross.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50">
                  <CardContent className="pt-6">
                    <p className="text-xs text-gray-600">Total Deductions</p>
                    <p className="text-xl font-bold">${periodTotals.deductions.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-6">
                    <p className="text-xs text-gray-600">Total Net</p>
                    <p className="text-xl font-bold">${periodTotals.net.toFixed(2)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => {
                      const isDownloading = downloadingUserId === row.user_id;
                      const issueButtonLabel = 'Download Payslip';
                      return (
                        <TableRow key={row.user_id}>
                          <TableCell className="font-medium">
                            <div>{row.name}</div>
                            {row.email && row.email !== row.name ? (
                              <div className="text-xs text-muted-foreground">{row.email}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">{row.hours_worked}</TableCell>
                          <TableCell className="text-right">${row.hourly_rate}</TableCell>
                          <TableCell className="text-right">${row.gross_pay}</TableCell>
                          <TableCell className="text-right">${row.deductions}</TableCell>
                          <TableCell className="text-right font-semibold">${row.net_pay}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {row.payment_status === 'paid' ? (
                                <Badge className="w-fit bg-emerald-600">Paid</Badge>
                              ) : null}
                              {row.already_downloaded ? (
                                <Badge variant="default" className="w-fit bg-green-600">QB Synced</Badge>
                              ) : row.can_download ? (
                                <Badge variant="secondary" className="w-fit">Ready</Badge>
                              ) : (
                                <Badge variant="outline" className="w-fit text-muted-foreground">
                                  No shifts
                                </Badge>
                              )}
                              {!row.staff_stripe_ready && row.can_download && row.payment_status !== 'paid' ? (
                                <span className="text-xs text-amber-600" title={row.staff_stripe_message || undefined}>
                                  Stripe not ready
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {row.can_pay_now ? (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="gap-1"
                                  onClick={() =>
                                    setPayModalStaff({
                                      userId: row.user_id,
                                      name: row.name,
                                      netPay: row.net_pay,
                                      grossPay: row.gross_pay,
                                      deductions: row.deductions,
                                    })
                                  }
                                >
                                  <CreditCard className="h-3 w-3" />
                                  Pay Now
                                </Button>
                              ) : null}
                              {row.payment_status === 'paid' && row.stripe_hosted_invoice_url ? (
                                <Button size="sm" variant="outline" className="gap-1" asChild>
                                  <a
                                    href={row.stripe_hosted_invoice_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    View Invoice
                                  </a>
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant={row.already_downloaded ? 'outline' : 'secondary'}
                                disabled={!row.can_download || isDownloading}
                                onClick={() => void handleDownloadPayroll(row.user_id, row.name)}
                              >
                                {isDownloading ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                    Working...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-3 w-3 mr-2" />
                                    {issueButtonLabel}
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {previewRows.length === 0 && !previewLoading && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No active staff in this workspace yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground">
                Pay is calculated from staff attendance. Overtime is applied per ISO week (default 40h/week at 1.5×).
                <strong> Pay Now</strong> charges your card and sends net pay to the staff member&apos;s connected Stripe
                account. <strong>Download Payslip</strong> posts a Journal Entry to QuickBooks (when connected) and
                generates a local payslip PDF.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STAFF RATES TAB */}
        <TabsContent value="rates">
          <Card>
            <CardHeader>
              <CardTitle>Staff Compensation Rates</CardTitle>
              <CardDescription>Configure hourly rate and deductions for each staff member.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Hourly Rate</TableHead>
                      <TableHead>Fixed Deduction</TableHead>
                      <TableHead>Deduction %</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffRates.map((staff) => {
                      const draft = rateDrafts[staff.user_id];
                      return (
                        <TableRow key={staff.user_id}>
                          <TableCell className="font-medium">
                            <div>{staff.name}</div>
                            {staff.email && staff.email !== staff.name ? (
                              <div className="text-xs text-muted-foreground">{staff.email}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="1000"
                              step="0.01"
                              value={draft?.hourly_rate || ''}
                              onChange={(e) =>
                                handleRateDraftChange(staff.user_id, 'hourly_rate', e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft?.deduction_fixed || ''}
                              onChange={(e) =>
                                handleRateDraftChange(staff.user_id, 'deduction_fixed', e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={draft?.deduction_percent || ''}
                              onChange={(e) =>
                                handleRateDraftChange(staff.user_id, 'deduction_percent', e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => void handleSaveStaffRate(staff.user_id)}
                              disabled={savingStaffId === staff.user_id}
                            >
                              {savingStaffId === staff.user_id ? 'Saving...' : 'Save'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {staffRates.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No staff in this workspace yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {payModalStaff ? (
        <PayStaffModal
          open={Boolean(payModalStaff)}
          onOpenChange={(open) => {
            if (!open) setPayModalStaff(null);
          }}
          staffUserId={payModalStaff.userId}
          staffName={payModalStaff.name}
          periodStart={periodStart}
          periodEnd={periodEnd}
          netPay={payModalStaff.netPay}
          grossPay={payModalStaff.grossPay}
          deductions={payModalStaff.deductions}
          onPaid={() => {
            setSuccess(`Payment sent to ${payModalStaff.name}.`);
            void loadPreview();
          }}
        />
      ) : null}
    </div>
  );
}
