"use client"

import { useAuth } from "@clerk/nextjs"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, MessageSquare, RefreshCw, SendHorizonal } from "lucide-react"
import { io, type Socket } from "socket.io-client"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AuthApiError, waitForSessionToken } from "@/lib/auth"
import {
  listChatThreads,
  openChatThread,
  type ChatMessage,
  type ChatThread,
} from "@/lib/team-chat"

const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

interface TeamChatPageClientProps {
  dashboardRole: "streamer" | "moderator"
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return ""
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return date.toLocaleString()
}

export function TeamChatPageClient({ dashboardRole }: TeamChatPageClientProps) {
  const { getToken, isLoaded } = useAuth()
  const searchParams = useSearchParams()
  const socketRef = useRef<Socket | null>(null)
  const activeThreadRef = useRef<string | null>(null)

  const [threads, setThreads] = useState<ChatThread[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [composer, setComposer] = useState("")
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  )

  function joinThread(socket: Socket, threadId: string) {
    setIsLoadingMessages(true)
    socket.emit(
      "chat:join",
      { threadId, limit: 100 },
      (response: { ok?: boolean; error?: string; messages?: ChatMessage[] }) => {
        setIsLoadingMessages(false)

        if (!response || !response.ok) {
          setErrorMessage(response && response.error ? response.error : "Unable to join chat thread.")
          return
        }

        setErrorMessage(null)
        setMessages(Array.isArray(response.messages) ? response.messages : [])
      },
    )
  }

  function applyIncomingMessage(nextMessage: ChatMessage) {
    setMessages((previous) => {
      const exists = previous.some((item) => item.id === nextMessage.id)

      if (exists) {
        return previous
      }

      return [...previous, nextMessage]
    })

    setThreads((previous) => {
      const next = previous.map((thread) => {
        if (thread.id !== nextMessage.threadId) {
          return thread
        }

        const isOwnMessage = String(thread.peer.userId) !== String(nextMessage.senderUserId)
        const nextUnreadCount = selectedThreadId === thread.id || isOwnMessage
          ? 0
          : Math.max(1, thread.unreadCount + 1)

        return {
          ...thread,
          lastMessage: {
            body: nextMessage.body,
            at: nextMessage.createdAt,
            senderUserId: nextMessage.senderUserId,
          },
          unreadCount: nextUnreadCount,
          updatedAt: nextMessage.createdAt,
        }
      })

      next.sort((a, b) => {
        const aTime = a.lastMessage.at ? new Date(a.lastMessage.at).getTime() : 0
        const bTime = b.lastMessage.at ? new Date(b.lastMessage.at).getTime() : 0
        return bTime - aTime
      })

      return next
    })
  }

  useEffect(() => {
    let cancelled = false

    async function loadThreads() {
      if (!isLoaded) {
        return
      }

      try {
        setIsLoadingThreads(true)
        setErrorMessage(null)

        const token = await waitForSessionToken(getToken)
        const peerUserId = searchParams.get("peer")

        if (peerUserId) {
          await openChatThread(token, peerUserId)
        }

        const result = await listChatThreads(token)

        if (!cancelled) {
          setThreads(result.threads)

          if (selectedThreadId && result.threads.some((thread) => thread.id === selectedThreadId)) {
            return
          }

          const peerThread = peerUserId
            ? result.threads.find((thread) => thread.peer.userId === peerUserId)
            : null

          setSelectedThreadId(peerThread ? peerThread.id : result.threads[0]?.id || null)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof AuthApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load chat threads."
          setErrorMessage(message)
          setThreads([])
        }
      } finally {
        if (!cancelled) {
          setIsLoadingThreads(false)
        }
      }
    }

    void loadThreads()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, searchParams, selectedThreadId])

  useEffect(() => {
    let cancelled = false

    async function connectSocket() {
      if (!isLoaded) {
        return
      }

      try {
        const token = await waitForSessionToken(getToken)
        const socket = io(SOCKET_BASE_URL, {
          transports: ["websocket"],
          auth: { token },
        })

        socketRef.current = socket

        socket.on("connect_error", (error) => {
          setErrorMessage(error instanceof Error ? error.message : "Unable to connect live chat.")
        })

        socket.on("chat:message", (payload) => {
          if (!payload || !payload.message) {
            return
          }

          const nextMessage = payload.message as ChatMessage

          if (activeThreadRef.current !== nextMessage.threadId) {
            applyIncomingMessage(nextMessage)
            return
          }

          applyIncomingMessage(nextMessage)
        })

        const activeThreadId = activeThreadRef.current
        if (activeThreadId) {
          joinThread(socket, activeThreadId)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to connect live chat."
          setErrorMessage(message)
        }
      }
    }

    void connectSocket()

    return () => {
      cancelled = true
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [getToken, isLoaded])

  useEffect(() => {
    activeThreadRef.current = selectedThreadId

    if (!selectedThreadId) {
      setMessages([])
      return
    }

    const socket = socketRef.current

    if (!socket) {
      return
    }

    joinThread(socket, selectedThreadId)

    return () => {
      if (socketRef.current && selectedThreadId) {
        socketRef.current.emit("chat:leave", { threadId: selectedThreadId })
      }
    }
  }, [selectedThreadId])

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault()

    const socket = socketRef.current

    if (!socket || !selectedThreadId || !composer.trim()) {
      return
    }

    try {
      setIsSending(true)
      const messageBody = composer.trim()

      await new Promise<void>((resolve, reject) => {
        socket.emit(
          "chat:send",
          { threadId: selectedThreadId, body: messageBody },
          (response: { ok?: boolean; error?: string; message?: ChatMessage }) => {
            if (!response || !response.ok || !response.message) {
              reject(new Error(response && response.error ? response.error : "Unable to send message."))
              return
            }

            setComposer("")
            applyIncomingMessage(response.message)
            resolve()
          },
        )
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send message."
      setErrorMessage(message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={dashboardRole === "streamer" ? "Chat Collaboration" : "Internal Team Chat"}
        description="1-to-1 chat between streamers and moderators for stream guidance and pre-show instructions."
      >
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </PageHeader>

      {errorMessage ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingThreads ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading chats
              </div>
            ) : threads.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No chats yet. Start from the Message button in bookings or hired moderators.
              </div>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${selectedThreadId === thread.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{thread.peer.name}</p>
                    {thread.unreadCount > 0 ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{thread.unreadCount}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{thread.lastMessage.body || "No messages yet"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatTime(thread.lastMessage.at)}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              {selectedThread ? selectedThread.peer.name : "Select a conversation"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedThreadId ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Select a conversation from the left panel.
              </div>
            ) : isLoadingMessages ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading messages
              </div>
            ) : (
              <>
                <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages yet. Send the first instruction.</p>
                  ) : (
                    messages.map((message) => {
                      const isMine = selectedThread && String(message.senderUserId) !== String(selectedThread.peer.userId)

                      return (
                        <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[78%] rounded-lg px-3 py-2 text-sm ${isMine ? "bg-primary text-primary-foreground" : "bg-background border border-border/60"}`}>
                            <p className="whitespace-pre-wrap">{message.body}</p>
                            <p className={`mt-1 text-[11px] ${isMine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              {formatTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    placeholder="Write stream guidance, product details, or pre-show notes..."
                    maxLength={2000}
                  />
                  <Button type="submit" disabled={isSending || !composer.trim()} className="gap-2">
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                    Send
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {dashboardRole === "streamer" ? (
        <p className="text-xs text-muted-foreground">
          Need a moderator first? Go to <Link href="/seller/moderators" className="underline">Find Moderators</Link> and hire one to unlock chat.
        </p>
      ) : null}
    </div>
  )
}
