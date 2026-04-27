"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type SimulatedFetchState<T> = {
  data: T | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  lastUpdated: Date | null
}

type Options = {
  /** Initial simulated network delay (ms) */
  minDelay?: number
  /** If set, re-runs fetch on this interval (ms) */
  pollInterval?: number
  /** Delay on each poll refresh */
  refreshDelay?: number
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Mimics async backend fetches: initial load + optional polling refresh,
 * while the underlying source can be static (or derived) data.
 */
export function useSimulatedFetch<T>(
  fetchKey: string,
  loader: () => T | Promise<T>,
  options: Options = {},
): SimulatedFetchState<T> & { refetch: () => Promise<void> } {
  const { minDelay = 450, pollInterval, refreshDelay = 320 } = options
  const [state, setState] = useState<SimulatedFetchState<T>>({
    data: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  })

  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const hasLoadedRef = useRef(false)

  const run = useCallback(
    async (mode: "initial" | "poll") => {
      try {
        if (mode === "initial") {
          setState((previous) => ({
            ...previous,
            isLoading: true,
            error: null,
          }))
          await delay(minDelay)
          const data = await Promise.resolve(loaderRef.current())
          hasLoadedRef.current = true
          setState({
            data,
            isLoading: false,
            isRefreshing: false,
            error: null,
            lastUpdated: new Date(),
          })
          return
        }

        setState((previous) => ({
          ...previous,
          isRefreshing: true,
          error: null,
        }))
        await delay(refreshDelay)
        const data = await Promise.resolve(loaderRef.current())
        hasLoadedRef.current = true
        setState((previous) => ({
          ...previous,
          data,
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastUpdated: new Date(),
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load data."
        setState((previous) => ({
          ...previous,
          isLoading: false,
          isRefreshing: false,
          error: message,
        }))
      }
    },
    [minDelay, refreshDelay],
  )

  useEffect(() => {
    let cancelled = false

    async function initial() {
      if (cancelled) {
        return
      }
      hasLoadedRef.current = false
      await run("initial")
    }

    void initial()

    return () => {
      cancelled = true
    }
  }, [fetchKey, run])

  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) {
      return undefined
    }

    const id = window.setInterval(() => {
      void run("poll")
    }, pollInterval)

    return () => window.clearInterval(id)
  }, [pollInterval, run])

  const refetch = useCallback(async () => {
    await run(hasLoadedRef.current ? "poll" : "initial")
  }, [run])

  return { ...state, refetch }
}
