"use client"

import { useAuth } from "@clerk/nextjs"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react"

import { MarketplacePlatformSwitch, type MarketplacePlatform } from "../../../../components/marketplace-platform-switch"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getTikTokFinancePayments,
  getTikTokFinanceStatementTransactions,
  getTikTokFinanceStatements,
  getTikTokFinanceUnsettledOrders,
  getTikTokFinanceWithdrawals,
  getClerkErrorMessage,
  syncWhatnotEarlyPayoutBalance,
  waitForSessionToken,
  type TikTokFinancePaymentItem,
  type TikTokFinancePaymentsResponse,
  type TikTokFinanceStatementItem,
  type TikTokFinanceStatementTransactionItem,
  type TikTokFinanceStatementTransactionsResponse,
  type TikTokFinanceStatementsResponse,
  type TikTokFinanceUnsettledOrderItem,
  type TikTokFinanceUnsettledOrdersResponse,
  type TikTokFinanceWithdrawalItem,
  type TikTokFinanceWithdrawalsResponse,
  type WhatnotEarlyPayoutMoney,
} from "@/lib/auth"

const PAGE_SIZE = 5
type FinancePlatform = "whatnot" | "tiktok"
type TikTokFinanceSection = "statements" | "payments" | "withdrawals" | "unsettledOrders"

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

function parseNumericString(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatAmountWithCurrency(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      currencyDisplay: "narrowSymbol",
    }).format(amount)
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`
  }
}

function formatUnixSeconds(seconds: unknown) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "—"
  }
  const value = new Date(seconds * 1000)
  return Number.isNaN(value.getTime()) ? "—" : dateFmt.format(value)
}

function formatUnixSecondsLoose(seconds: unknown) {
  if (typeof seconds === "number" && Number.isFinite(seconds)) {
    return formatUnixSeconds(seconds)
  }
  if (typeof seconds === "string" && seconds.trim()) {
    const parsed = Number(seconds.trim())
    return Number.isFinite(parsed) ? formatUnixSeconds(parsed) : "—"
  }
  return "—"
}

export default function FinanceManagementPage() {
  const { getToken, isLoaded } = useAuth()
  const [activePlatform, setActivePlatform] = useState<FinancePlatform>("whatnot")
  const [page, setPage] = useState(0)
  const [isBalanceLoading, setIsBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState("")
  const [accountBalanceDisplay, setAccountBalanceDisplay] = useState("—")
  const [availablePayoutDisplay, setAvailablePayoutDisplay] = useState("—")
  const [processingDisplay, setProcessingDisplay] = useState("—")
  const [isTikTokLoading, setIsTikTokLoading] = useState(false)
  const [tiktokError, setTiktokError] = useState("")
  const [activeTikTokSection, setActiveTikTokSection] = useState<TikTokFinanceSection>("statements")
  const [isStatementTransactionsDialogOpen, setIsStatementTransactionsDialogOpen] = useState(false)
  const [selectedStatementId, setSelectedStatementId] = useState("")
  const [isStatementTransactionsLoading, setIsStatementTransactionsLoading] = useState(false)
  const [statementTransactionsError, setStatementTransactionsError] = useState("")
  const [tiktokStatements, setTiktokStatements] = useState<TikTokFinanceStatementsResponse | null>(null)
  const [tiktokPayments, setTiktokPayments] = useState<TikTokFinancePaymentsResponse | null>(null)
  const [tiktokWithdrawals, setTiktokWithdrawals] = useState<TikTokFinanceWithdrawalsResponse | null>(null)
  const [tiktokStatementTransactions, setTiktokStatementTransactions] = useState<TikTokFinanceStatementTransactionsResponse | null>(null)
  const [tiktokUnsettledOrders, setTiktokUnsettledOrders] = useState<TikTokFinanceUnsettledOrdersResponse | null>(null)

  const loadWhatnotBalance = useCallback(async () => {
    if (!isLoaded) {
      return
    }

    try {
      setIsBalanceLoading(true)
      setBalanceError("")
      const token = await waitForSessionToken(getToken)
      const result = await syncWhatnotEarlyPayoutBalance(token)
      const balances = result?.responsePayload?.data?.me?.balances
      setAccountBalanceDisplay(formatBalanceDisplay(balances?.totalSalesBalance))
      setAvailablePayoutDisplay(formatBalanceDisplay(balances?.completedSalesBalance))
      setProcessingDisplay(formatBalanceDisplay(balances?.processingSalesBalance))
    } catch (error) {
      setBalanceError(getClerkErrorMessage(error))
      setAccountBalanceDisplay("—")
      setAvailablePayoutDisplay("—")
      setProcessingDisplay("—")
    } finally {
      setIsBalanceLoading(false)
    }
  }, [getToken, isLoaded])

  const loadTikTokFinance = useCallback(async () => {
    if (!isLoaded) {
      return
    }

    try {
      setIsTikTokLoading(true)
      setTiktokError("")
      const token = await waitForSessionToken(getToken)
      const statementsResult = await getTikTokFinanceStatements(token, {
        pageSize: 20,
        sortOrder: "DESC",
        sortField: "statement_time",
      })

      const [paymentsResult, withdrawalsResult, unsettledOrdersResult] = await Promise.all([
        getTikTokFinancePayments(token, {
          pageSize: 20,
          sortOrder: "DESC",
          sortField: "create_time",
        }),
        getTikTokFinanceWithdrawals(token, {
          pageSize: 20,
          types: ["WITHDRAW", "SETTLE"],
        }),
        getTikTokFinanceUnsettledOrders(token, {
          pageSize: 20,
          sortOrder: "ASC",
          sortField: "order_create_time",
        }),
      ])

      setTiktokStatements(statementsResult)
      setTiktokPayments(paymentsResult)
      setTiktokWithdrawals(withdrawalsResult)
      setTiktokUnsettledOrders(unsettledOrdersResult)
    } catch (error) {
      setTiktokError(getClerkErrorMessage(error))
      setTiktokStatements(null)
      setTiktokPayments(null)
      setTiktokWithdrawals(null)
      setTiktokStatementTransactions(null)
      setTiktokUnsettledOrders(null)
    } finally {
      setIsTikTokLoading(false)
    }
  }, [getToken, isLoaded])

  const openStatementTransactionsDialog = useCallback(async (statementId: string) => {
    const id = typeof statementId === "string" ? statementId.trim() : ""
    if (!id || !isLoaded) {
      return
    }

    setSelectedStatementId(id)
    setIsStatementTransactionsDialogOpen(true)
    setStatementTransactionsError("")

    try {
      setIsStatementTransactionsLoading(true)
      const token = await waitForSessionToken(getToken)
      const result = await getTikTokFinanceStatementTransactions(token, id, {
        pageSize: 20,
        sortOrder: "DESC",
        sortField: "order_create_time",
      })
      setTiktokStatementTransactions(result)
    } catch (error) {
      setStatementTransactionsError(getClerkErrorMessage(error))
      setTiktokStatementTransactions(null)
    } finally {
      setIsStatementTransactionsLoading(false)
    }
  }, [getToken, isLoaded])

  useEffect(() => {
    if (!isLoaded || activePlatform !== "tiktok") {
      return
    }
    if (tiktokStatements || tiktokPayments || tiktokWithdrawals) {
      return
    }
    void loadTikTokFinance()
  }, [activePlatform, isLoaded, loadTikTokFinance, tiktokPayments, tiktokStatements, tiktokWithdrawals])

  const tiktokStatementRows = useMemo(() => tiktokStatements?.statements || [], [tiktokStatements])
  const tiktokPaymentRows = useMemo(() => tiktokPayments?.payments || [], [tiktokPayments])
  const tiktokWithdrawalRows = useMemo(() => tiktokWithdrawals?.withdrawals || [], [tiktokWithdrawals])
  const tiktokStatementTransactionRows = useMemo(
    () => tiktokStatementTransactions?.transactions || [],
    [tiktokStatementTransactions],
  )
  const tiktokUnsettledOrderRows = useMemo(() => tiktokUnsettledOrders?.transactions || [], [tiktokUnsettledOrders])

  const tiktokStatementCurrency =
    tiktokStatementRows[0] && typeof tiktokStatementRows[0].currency === "string"
      ? tiktokStatementRows[0].currency
      : "USD"
  const tiktokPaymentCurrency =
    tiktokPaymentRows[0] && typeof tiktokPaymentRows[0].amount?.currency === "string"
      ? (tiktokPaymentRows[0].amount?.currency as string)
      : "USD"
  const tiktokWithdrawalCurrency =
    tiktokWithdrawalRows[0] && typeof tiktokWithdrawalRows[0].currency === "string"
      ? (tiktokWithdrawalRows[0].currency as string)
      : "USD"
  const tiktokUnsettledCurrency =
    tiktokUnsettledOrderRows[0] && typeof tiktokUnsettledOrderRows[0].currency === "string"
      ? (tiktokUnsettledOrderRows[0].currency as string)
      : "USD"

  const tiktokSettlementTotal = useMemo(() => {
    return tiktokStatementRows.reduce((sum, row) => sum + parseNumericString(row.settlement_amount), 0)
  }, [tiktokStatementRows])

  const tiktokPaidTotal = useMemo(() => {
    return tiktokPaymentRows.reduce((sum, row) => {
      const status = typeof row.status === "string" ? row.status.toUpperCase() : ""
      if (status && status !== "PAID") {
        return sum
      }
      return sum + parseNumericString(row.amount?.value)
    }, 0)
  }, [tiktokPaymentRows])

  const tiktokProcessingTotal = useMemo(() => {
    return tiktokWithdrawalRows.reduce((sum, row) => {
      const status = typeof row.status === "string" ? row.status.toUpperCase() : ""
      if (!(status.includes("PROCESS") || status.includes("PENDING") || status.includes("REVIEW"))) {
        return sum
      }
      return sum + parseNumericString(row.amount)
    }, 0)
  }, [tiktokWithdrawalRows])

  const tiktokUnsettledSettlementTotal = useMemo(() => {
    return parseNumericString(tiktokUnsettledOrders?.sumEstSettlementAmount)
  }, [tiktokUnsettledOrders?.sumEstSettlementAmount])

  const tiktokSectionCards = useMemo(() => {
    const paidStatements = tiktokStatementRows.filter((row) => (row.payment_status || "").toUpperCase() === "PAID").length
    const paidPayments = tiktokPaymentRows.filter((row) => (row.status || "").toUpperCase() === "PAID").length
    const processingWithdrawals = tiktokWithdrawalRows.filter((row) => {
      const status = (row.status || "").toUpperCase()
      return status.includes("PROCESS") || status.includes("PENDING") || status.includes("REVIEW")
    }).length

    return [
      {
        title: "Statements",
        primary: String(tiktokStatementRows.length),
        secondary: `${paidStatements} paid`,
        meta: tiktokStatements?.nextPageToken ? "More pages available" : "No next page token",
      },
      {
        title: "Payments",
        primary: String(tiktokPaymentRows.length),
        secondary: `${paidPayments} paid`,
        meta: tiktokPayments?.nextPageToken ? "More pages available" : "No next page token",
      },
      {
        title: "Withdrawals",
        primary: String(tiktokWithdrawalRows.length),
        secondary: `${processingWithdrawals} processing`,
        meta:
          typeof tiktokWithdrawals?.totalCount === "number"
            ? `${tiktokWithdrawals.totalCount} total reported`
            : "Total count unavailable",
      },
      {
        title: "Statement Transactions",
        primary: String(tiktokStatementTransactionRows.length),
        secondary: `Statement ${selectedStatementId || tiktokStatementTransactions?.id || "—"}`,
        meta:
          selectedStatementId || tiktokStatementTransactions
            ? tiktokStatementTransactions?.nextPageToken
              ? "More pages available"
              : "No next page token"
            : "Open from Statements action",
      },
      {
        title: "Unsettled Orders",
        primary: String(tiktokUnsettledOrderRows.length),
        secondary: `${tiktokUnsettledOrders?.totalCount ?? 0} total reported`,
        meta: tiktokUnsettledOrders?.nextPageToken ? "More pages available" : "No next page token",
      },
    ]
  }, [
    tiktokPaymentRows,
    tiktokPayments?.nextPageToken,
    tiktokStatementTransactionRows.length,
    selectedStatementId,
    tiktokStatementTransactions,
    tiktokStatementTransactions?.nextPageToken,
    tiktokStatementRows,
    tiktokStatements?.nextPageToken,
    tiktokUnsettledOrderRows.length,
    tiktokUnsettledOrders?.nextPageToken,
    tiktokUnsettledOrders?.totalCount,
    tiktokWithdrawalRows,
    tiktokWithdrawals?.totalCount,
  ])

  const currentPayouts = STATIC_PAYOUTS
  const total = currentPayouts.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageIndex = Math.min(Math.max(0, page), totalPages - 1)
  const sliceStart = pageIndex * PAGE_SIZE
  const rows = currentPayouts.slice(sliceStart, sliceStart + PAGE_SIZE)

  const rangeFrom = total === 0 ? 0 : sliceStart + 1
  const rangeTo = total === 0 ? 0 : Math.min(sliceStart + PAGE_SIZE, total)
  const rangeLabel = total === 0 ? "0 of 0" : `${rangeFrom}–${rangeTo} of ${total}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Finance Management</h1>
          <p className="text-sm text-muted-foreground">
            Switch between Whatnot and TikTok finance views. Card values and data sections change with the selected tab.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={activePlatform === "whatnot" ? isBalanceLoading : isTikTokLoading}
          onClick={() => {
            if (activePlatform === "whatnot") {
              void loadWhatnotBalance()
              return
            }
            void loadTikTokFinance()
          }}
        >
          <RefreshCw className={`h-4 w-4 ${activePlatform === "whatnot" ? (isBalanceLoading ? "animate-spin" : "") : (isTikTokLoading ? "animate-spin" : "")}`} />
          Refresh
        </Button>
      </div>

      <MarketplacePlatformSwitch
        value={activePlatform}
        onValueChange={(value: MarketplacePlatform) => {
          setActivePlatform(value as FinancePlatform)
          if (value === "tiktok") {
            setActiveTikTokSection("statements")
          }
          setPage(0)
        }}
        ariaLabel="Finance platform"
        whatnotLabel="Whatnot Finance"
        tiktokLabel="TikTok Finance"
        idPrefix="finance-platform"
      />

      {activePlatform === "whatnot" && balanceError ? <p className="text-sm text-destructive">{balanceError}</p> : null}
      {activePlatform === "tiktok" && tiktokError ? <p className="text-sm text-destructive">{tiktokError}</p> : null}

      {activePlatform === "whatnot" ? (
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Settled statements</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-[2.5rem] items-center text-2xl font-semibold tabular-nums">
              {isTikTokLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatAmountWithCurrency(tiktokSettlementTotal, tiktokStatementCurrency)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Paid payments</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-[2.5rem] items-center text-2xl font-semibold tabular-nums">
              {isTikTokLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatAmountWithCurrency(tiktokPaidTotal, tiktokPaymentCurrency)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Processing withdrawals</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-[2.5rem] items-center text-2xl font-semibold tabular-nums">
              {isTikTokLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatAmountWithCurrency(tiktokProcessingTotal, tiktokWithdrawalCurrency)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Unsettled est. settlement</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-[2.5rem] items-center text-2xl font-semibold tabular-nums">
              {isTikTokLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatAmountWithCurrency(tiktokUnsettledSettlementTotal, tiktokUnsettledCurrency)}
            </CardContent>
          </Card>
        </div>
      )}

      {activePlatform === "tiktok" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tiktokSectionCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-semibold tabular-nums">{card.primary}</p>
                <p className="text-sm text-muted-foreground">{card.secondary}</p>
                <p className="text-xs text-muted-foreground">{card.meta}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{activePlatform === "whatnot" ? "Whatnot payout history" : "TikTok finance sections"}</CardTitle>
        </CardHeader>
        {activePlatform === "whatnot" ? (
          <>
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
          </>
        ) : (
          <CardContent className="space-y-6">
            {(() => {
              const isMock = Boolean(
                tiktokStatements?.isMockData
                || tiktokPayments?.isMockData
                || tiktokWithdrawals?.isMockData
                || tiktokUnsettledOrders?.isMockData,
              )
              const note =
                tiktokStatements?.note
                || tiktokPayments?.note
                || tiktokWithdrawals?.note
                || tiktokUnsettledOrders?.note
              return isMock ? (
                <p className="text-sm text-muted-foreground">
                  {note || "Using TikTok finance mock data until live shop credentials are available."}
                </p>
              ) : null
            })()}

            <Tabs
              value={activeTikTokSection}
              onValueChange={(value) => setActiveTikTokSection(value as TikTokFinanceSection)}
              className="space-y-3"
            >
              <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-md border bg-muted/60 p-2">
                <TabsTrigger value="statements">Statements</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
                <TabsTrigger value="unsettledOrders">Unsettled Orders</TabsTrigger>
              </TabsList>

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">
                  {activeTikTokSection === "statements"
                    ? "Statements"
                    : activeTikTokSection === "payments"
                      ? "Payments"
                      : activeTikTokSection === "withdrawals"
                        ? "Withdrawals"
                      : "Unsettled Orders"}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {activeTikTokSection === "statements"
                    ? "/finance/202309/statements"
                    : activeTikTokSection === "payments"
                      ? "/finance/202309/payments"
                      : activeTikTokSection === "withdrawals"
                        ? "/finance/202309/withdrawals"
                      : "/finance/202507/orders/unsettled"}
                </span>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead>
                    {activeTikTokSection === "statements" ? (
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Statement ID</th>
                        <th className="px-3 py-2 font-medium">Statement time</th>
                        <th className="px-3 py-2 font-medium">Settlement</th>
                        <th className="px-3 py-2 font-medium">Revenue</th>
                        <th className="px-3 py-2 font-medium">Fee</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium text-right">Actions</th>
                      </tr>
                    ) : null}
                    {activeTikTokSection === "payments" ? (
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Payment ID</th>
                        <th className="px-3 py-2 font-medium">Create time</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Settlement</th>
                        <th className="px-3 py-2 font-medium">Reserve</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    ) : null}
                    {activeTikTokSection === "withdrawals" ? (
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Withdrawal ID</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Create time</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    ) : null}
                    {activeTikTokSection === "unsettledOrders" ? (
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Transaction ID</th>
                        <th className="px-3 py-2 font-medium">Order ID</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Estimated settlement</th>
                        <th className="px-3 py-2 font-medium">Est. settlement amount</th>
                        <th className="px-3 py-2 font-medium">Est. revenue</th>
                        <th className="px-3 py-2 font-medium">Est. fee / tax</th>
                        <th className="px-3 py-2 font-medium">Reason</th>
                      </tr>
                    ) : null}
                  </thead>

                  <tbody>
                    {activeTikTokSection === "statements" ? (
                      tiktokStatementRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No statements found.</td>
                        </tr>
                      ) : (
                        tiktokStatementRows.map((row: TikTokFinanceStatementItem) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                            <td className="px-3 py-2">{formatUnixSeconds(row.statement_time)}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.settlement_amount), row.currency || "USD")}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.revenue_amount), row.currency || "USD")}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.fee_amount), row.currency || "USD")}</td>
                            <td className="px-3 py-2"><StatusBadge variant="info">{row.payment_status || "—"}</StatusBadge></td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void openStatementTransactionsDialog(row.id)}
                              >
                                View transactions
                              </Button>
                            </td>
                          </tr>
                        ))
                      )
                    ) : null}

                    {activeTikTokSection === "payments" ? (
                      tiktokPaymentRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No payments found.</td>
                        </tr>
                      ) : (
                        tiktokPaymentRows.map((row: TikTokFinancePaymentItem) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                            <td className="px-3 py-2">{formatUnixSeconds(row.create_time)}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.amount?.value), row.amount?.currency || "USD")}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.settlement_amount?.value), row.settlement_amount?.currency || "USD")}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.reserve_amount?.value), row.reserve_amount?.currency || "USD")}</td>
                            <td className="px-3 py-2"><StatusBadge variant="info">{row.status || "—"}</StatusBadge></td>
                          </tr>
                        ))
                      )
                    ) : null}

                    {activeTikTokSection === "withdrawals" ? (
                      tiktokWithdrawalRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No withdrawals found.</td>
                        </tr>
                      ) : (
                        tiktokWithdrawalRows.map((row: TikTokFinanceWithdrawalItem) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                            <td className="px-3 py-2">{row.type || "—"}</td>
                            <td className="px-3 py-2">{formatUnixSeconds(row.create_time)}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.amount), row.currency || "USD")}</td>
                            <td className="px-3 py-2"><StatusBadge variant="warning">{row.status || "—"}</StatusBadge></td>
                          </tr>
                        ))
                      )
                    ) : null}

                    {activeTikTokSection === "unsettledOrders" ? (
                      tiktokUnsettledOrderRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No unsettled orders found.</td>
                        </tr>
                      ) : (
                        tiktokUnsettledOrderRows.map((row: TikTokFinanceUnsettledOrderItem) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                            <td className="px-3 py-2 font-mono text-xs">{row.order_id || "—"}</td>
                            <td className="px-3 py-2"><StatusBadge variant="warning">{row.status || "—"}</StatusBadge></td>
                            <td className="px-3 py-2">{formatUnixSecondsLoose(row.estimated_settlement)}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.est_settlement_amount), row.currency || "USD")}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.est_revenue_amount), row.currency || "USD")}</td>
                            <td className="px-3 py-2">{formatAmountWithCurrency(parseNumericString(row.est_fee_tax_amount), row.currency || "USD")}</td>
                            <td className="px-3 py-2">{row.unsettled_reason || "—"}</td>
                          </tr>
                        ))
                      )
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Tabs>

            <Dialog
              open={isStatementTransactionsDialogOpen}
              onOpenChange={(open) => {
                setIsStatementTransactionsDialogOpen(open)
                if (!open) {
                  setStatementTransactionsError("")
                }
              }}
            >
              <DialogContent className="h-auto max-h-[85vh] w-[95vw] max-w-[1100px] overflow-hidden p-0">
                <DialogHeader className="border-b px-6 py-4">
                  <DialogTitle>Statement Transactions</DialogTitle>
                  <p className="text-xs text-muted-foreground">Statement ID: {selectedStatementId || "—"}</p>
                </DialogHeader>

                <div className="max-h-[calc(85vh-88px)] space-y-3 overflow-auto px-6 py-4">
                  {statementTransactionsError ? (
                    <p className="text-sm text-destructive">{statementTransactionsError}</p>
                  ) : null}

                  <div className="overflow-x-auto rounded-md border mb-3">
                    <table className="min-w-[980px] text-sm my-3  `">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium whitespace-nowrap">Transaction ID</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">Type</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">Order ID</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">Order create time</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">Settlement</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">Revenue</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">Fee / Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isStatementTransactionsLoading ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading statement transactions...
                              </span>
                            </td>
                          </tr>
                        ) : tiktokStatementTransactionRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No statement transactions found.</td>
                          </tr>
                        ) : (
                          tiktokStatementTransactionRows.map((row: TikTokFinanceStatementTransactionItem) => (
                            <tr key={row.id} className="border-b last:border-b-0">
                              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{row.id}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{row.type || "—"}</td>
                              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{row.order_id || "—"}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{formatUnixSeconds(row.order_create_time)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{formatAmountWithCurrency(parseNumericString(row.settlement_amount), tiktokStatementTransactions?.currency || "USD")}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{formatAmountWithCurrency(parseNumericString(row.revenue_amount), tiktokStatementTransactions?.currency || "USD")}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{formatAmountWithCurrency(parseNumericString(row.fee_tax_amount), tiktokStatementTransactions?.currency || "USD")}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
