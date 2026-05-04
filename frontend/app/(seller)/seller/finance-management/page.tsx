"use client"

import { useAuth } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  getClerkErrorMessage,
  syncWhatnotEarlyPayoutBalance,
  waitForSessionToken,
  type WhatnotEarlyPayoutMoney,
} from "@/lib/auth"

const PAGE_SIZE = 5

type PayoutRow = {
  id: string
  amount: number
  destination: string
  initiated: string
  arrival: string
  status: string
}

function buildStaticPayouts(): PayoutRow[] {
  const rows: PayoutRow[] = []
  const base = new Date(Date.UTC(2025, 5, 1))
  for (let i = 0; i < 23; i++) {
    const initiated = new Date(base)
    initiated.setUTCDate(initiated.getUTCDate() + i * 3)
    const arrival = new Date(initiated)
    arrival.setUTCDate(arrival.getUTCDate() + 2)
    rows.push({
      id: String(i + 1),
      amount: Math.round((48.2 + i * 11.35 + (i % 7) * 15) * 100) / 100,
      destination: "Bank account ····4521",
      initiated: initiated.toISOString().slice(0, 10),
      arrival: arrival.toISOString().slice(0, 10),
      status: "Paid",
    })
  }
  return rows
}

const STATIC_PAYOUTS = buildStaticPayouts()

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
  }).format(amount)
}

/** Whatnot `Money.amount` uses minor units (e.g. cents) for USD, same as listing prices in this app. */
function moneyMinorToMajor(money: WhatnotEarlyPayoutMoney | null | undefined): number | null {
  if (!money || typeof money.amount !== "number" || !Number.isFinite(money.amount)) {
    return null
  }
  return money.amount / 100
}

function formatBalanceDisplay(money: WhatnotEarlyPayoutMoney | null | undefined) {
  const major = moneyMinorToMajor(money)
  if (major == null) {
    return "—"
  }
  const code =
    typeof money?.currency === "string" && money.currency.trim() ? money.currency.trim() : "USD"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
  }).format(major)
}

export default function FinanceManagementPage() {
  const { getToken, isLoaded } = useAuth()
  const [page, setPage] = useState(0)
  const [isBalanceLoading, setIsBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState("")
  const [accountBalanceDisplay, setAccountBalanceDisplay] = useState("—")
  const [availablePayoutDisplay, setAvailablePayoutDisplay] = useState("—")
  const [processingDisplay, setProcessingDisplay] = useState("—")

  useEffect(() => {
    let cancelled = false

    async function loadEarlyPayoutBalance() {
      if (!isLoaded) return
      try {
        setIsBalanceLoading(true)
        setBalanceError("")
        const token = await waitForSessionToken(getToken)
        const result = await syncWhatnotEarlyPayoutBalance(token)
        const balances = result?.responsePayload?.data?.me?.balances
        if (!cancelled) {
          setAccountBalanceDisplay(formatBalanceDisplay(balances?.totalSalesBalance))
          setAvailablePayoutDisplay(formatBalanceDisplay(balances?.completedSalesBalance))
          setProcessingDisplay(formatBalanceDisplay(balances?.processingSalesBalance))
        }
      } catch (error) {
        if (!cancelled) {
          setBalanceError(getClerkErrorMessage(error))
          setAccountBalanceDisplay("—")
          setAvailablePayoutDisplay("—")
          setProcessingDisplay("—")
        }
      } finally {
        if (!cancelled) {
          setIsBalanceLoading(false)
        }
      }
    }

    void loadEarlyPayoutBalance()
    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  const total = STATIC_PAYOUTS.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageIndex = Math.min(Math.max(0, page), totalPages - 1)
  const sliceStart = pageIndex * PAGE_SIZE
  const rows = STATIC_PAYOUTS.slice(sliceStart, sliceStart + PAGE_SIZE)

  const rangeFrom = total === 0 ? 0 : sliceStart + 1
  const rangeTo = total === 0 ? 0 : Math.min(sliceStart + PAGE_SIZE, total)
  const rangeLabel = total === 0 ? "0 of 0" : `${rangeFrom}–${rangeTo} of ${total}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Finance Management</h1>
        <p className="text-sm text-muted-foreground">
          Balance cards load from Whatnot (GetEarlyPayoutBalanceData) via the connector extension. Payout history
          below is sample data.
        </p>
      </div>

      {balanceError ? <p className="text-sm text-destructive">{balanceError}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Account balance</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-[2.5rem] items-center text-2xl font-semibold tabular-nums">
            {isBalanceLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : accountBalanceDisplay}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Available for payout</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-[2.5rem] items-center text-2xl font-semibold tabular-nums">
            {isBalanceLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : availablePayoutDisplay}
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Processing</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-[2.5rem] items-center text-2xl font-semibold tabular-nums">
            {isBalanceLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : processingDisplay}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-6 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Destination</th>
                <th className="px-3 py-2 font-medium">Date initiated</th>
                <th className="px-3 py-2 font-medium">Arrival date</th>
                <th className="px-6 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    No payouts to show.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-6 py-3 font-medium tabular-nums">{formatUsd(row.amount)}</td>
                    <td className="px-3 py-3">{row.destination}</td>
                    <td className="px-3 py-3">{dateFmt.format(new Date(row.initiated))}</td>
                    <td className="px-3 py-3">{dateFmt.format(new Date(row.arrival))}</td>
                    <td className="px-6 py-3">
                      <StatusBadge variant="success">{row.status}</StatusBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{rangeLabel}</span>
            {total > 0 ? (
              <span className="text-muted-foreground">
                {" "}
                · Page {pageIndex + 1} of {totalPages}
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={pageIndex <= 0}
              onClick={() => setPage(pageIndex - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => setPage(pageIndex + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
