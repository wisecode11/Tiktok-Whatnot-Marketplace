// lib/booking-payment.ts
// Frontend API client for moderator booking payments.

import { AuthApiError } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

async function request<T>(
  path: string,
  {
    token,
    method = "POST",
    body,
  }: {
    token: string
    method?: string
    body?: Record<string, unknown>
  },
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new AuthApiError(
      (payload && (payload.error as string)) || "Request failed.",
      response.status,
      payload && payload.details,
    )
  }

  return payload as T
}

export interface CreateBookingIntentPayload {
  moderatorUserId: string
  /** Total amount in cents (e.g. 5000 = $50.00) */
  amountCents: number
  notes?: string
  scheduledStartAt?: string
  scheduledEndAt?: string
  workspaceId?: string
}

export interface CreateBookingIntentResponse {
  clientSecret: string
  bookingId: string
  paymentIntentId: string
  amountCents: number
  platformFeeCents: number
  moderatorPayoutCents: number
  currency: string
}

export interface BookingPaymentStatus {
  bookingId: string
  status: string
  paymentStatus: string
  amountCents: number
  platformFeeCents: number
  moderatorPayoutCents: number
  stripePaymentIntentId: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  notes: string | null
  createdAt: string | null
}

export interface HiredModeratorBooking {
  bookingId: string
  moderatorUserId: string | null
  moderatorName: string
  moderatorEmail: string | null
  moderatorPublicSlug: string | null
  paymentStatus: string
  bookingStatus: string
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  createdAt: string | null
}

export interface HiredModeratorsResponse {
  bookings: HiredModeratorBooking[]
}

export function createBookingPaymentIntent(
  token: string,
  payload: CreateBookingIntentPayload,
): Promise<CreateBookingIntentResponse> {
  return request<CreateBookingIntentResponse>("/api/booking-payments/create-intent", {
    token,
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  })
}

export function getBookingPaymentStatus(
  token: string,
  bookingId: string,
): Promise<BookingPaymentStatus> {
  return request<BookingPaymentStatus>(`/api/booking-payments/${encodeURIComponent(bookingId)}/status`, {
    token,
    method: "GET",
  })
}

export function listHiredModerators(token: string): Promise<HiredModeratorsResponse> {
  return request<HiredModeratorsResponse>("/api/booking-payments/hired-moderators", {
    token,
    method: "GET",
  })
}
