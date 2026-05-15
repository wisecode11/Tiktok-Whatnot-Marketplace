import { AuthApiError } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export type CreatePayrollPaymentIntentResponse = {
  success: boolean
  clientSecret: string
  paymentIntentId: string
  invoiceId?: string | null
  hostedInvoiceUrl?: string | null
  invoicePdfUrl?: string | null
  payrollRunId: string
  amountCents: number
  currency: string
  staffUserId: string
  staffName: string
  netPay: string
  grossPay: string
  deductions: string
  periodStart: string
  periodEnd: string
}

export type ConfirmPayrollPaymentResponse = {
  success: boolean
  alreadyPaid?: boolean
  payrollRunId: string
  paymentStatus: string
  paidAt?: string
  amountCents?: number
  invoiceId?: string | null
  hostedInvoiceUrl?: string | null
  invoicePdfUrl?: string | null
}

async function request<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    let message = "Request failed"
    try {
      const data = await response.json()
      message = data.error || message
    } catch {
      // ignore
    }
    throw new AuthApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

export async function createPayrollPaymentIntent(
  token: string,
  staffUserId: string,
  periodStart: string,
  periodEnd: string,
) {
  return request<CreatePayrollPaymentIntentResponse>(
    `/api/payroll/staff/${encodeURIComponent(staffUserId)}/pay/create-intent`,
    token,
    {
      method: "POST",
      body: { period_start: periodStart, period_end: periodEnd },
    },
  )
}

export async function confirmPayrollPayment(token: string, payrollRunId: string) {
  return request<ConfirmPayrollPaymentResponse>("/api/payroll/staff/pay/confirm", token, {
    method: "POST",
    body: { payroll_run_id: payrollRunId },
  })
}
