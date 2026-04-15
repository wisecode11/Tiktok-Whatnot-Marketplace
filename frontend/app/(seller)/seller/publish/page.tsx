"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { AlertCircle, CheckCircle2, RefreshCw, UploadCloud } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  AuthApiError,
  createTikTokPhotoPost,
  createTikTokVideoPost,
  getClerkErrorMessage,
  getTikTokCreatorInfo,
  getTikTokPostStatus,
  waitForSessionToken,
  type TikTokCreatorInfoResponse,
  type TikTokPostStatusResponse,
  type TikTokPublishResponse,
} from "@/lib/auth"

type MediaType = "VIDEO" | "PHOTO"

function getStatusVariant(status: string | null | undefined) {
  if (!status) {
    return "default" as const
  }

  if (status === "PUBLISH_COMPLETE") {
    return "success" as const
  }

  if (status === "FAILED") {
    return "danger" as const
  }

  if (status.startsWith("PROCESSING") || status === "INIT_ACCEPTED") {
    return "pending" as const
  }

  return "info" as const
}

export default function SellerPublishPage() {
  const { getToken, isLoaded } = useAuth()
  const [isLoadingCreatorInfo, setIsLoadingCreatorInfo] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false)
  const [mediaType, setMediaType] = useState<MediaType>("VIDEO")
  const [creatorInfo, setCreatorInfo] = useState<TikTokCreatorInfoResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [latestPublish, setLatestPublish] = useState<TikTokPublishResponse | null>(null)
  const [latestStatus, setLatestStatus] = useState<TikTokPostStatusResponse | null>(null)
  const [privacyLevel, setPrivacyLevel] = useState("")
  const [videoForm, setVideoForm] = useState({
    title: "",
    videoUrl: "",
    videoDurationSec: "",
    videoCoverTimestampMs: "",
    allowDuet: false,
    allowComment: false,
    allowStitch: false,
    discloseCommercialContent: false,
    brandContentToggle: false,
    brandOrganicToggle: false,
    isAigc: false,
  })
  const [photoForm, setPhotoForm] = useState({
    title: "",
    description: "",
    photoImages: "",
    photoCoverIndex: "0",
    allowComment: false,
    autoAddMusic: true,
    discloseCommercialContent: false,
    brandContentToggle: false,
    brandOrganicToggle: false,
  })
  const [consentChecked, setConsentChecked] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCreatorInfo() {
      if (!isLoaded) {
        return
      }

      try {
        setIsLoadingCreatorInfo(true)
        setErrorMessage(null)

        const token = await waitForSessionToken(getToken)
        const result = await getTikTokCreatorInfo(token)

        if (cancelled) {
          return
        }

        setCreatorInfo(result)
        setPrivacyLevel((current) => {
          if (!current) {
            return ""
          }

          return result.creator.privacyLevelOptions.includes(current) ? current : ""
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setCreatorInfo(null)
        setErrorMessage(getClerkErrorMessage(error))
      } finally {
        if (!cancelled) {
          setIsLoadingCreatorInfo(false)
        }
      }
    }

    void loadCreatorInfo()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  async function refreshLatestStatus(publishId?: string) {
    const resolvedPublishId = publishId || latestPublish?.publishId

    if (!resolvedPublishId) {
      return
    }

    try {
      setIsRefreshingStatus(true)
      setErrorMessage(null)

      const token = await waitForSessionToken(getToken)
      const result = await getTikTokPostStatus(token, resolvedPublishId)
      setLatestStatus(result)
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsRefreshingStatus(false)
    }
  }

  const isUnauditedClient = Boolean(creatorInfo && !creatorInfo.account.isAudited)
  const commercialEnabled = mediaType === "VIDEO" ? videoForm.discloseCommercialContent : photoForm.discloseCommercialContent
  const brandContentToggle = mediaType === "VIDEO" ? videoForm.brandContentToggle : photoForm.brandContentToggle
  const brandOrganicToggle = mediaType === "VIDEO" ? videoForm.brandOrganicToggle : photoForm.brandOrganicToggle
  const activePhotoUrls = useMemo(
    () =>
      photoForm.photoImages
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean),
    [photoForm.photoImages],
  )

  const consentText =
    commercialEnabled && brandContentToggle
      ? "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation"
      : "By posting, you agree to TikTok's Music Usage Confirmation"

  const validationMessage = useMemo(() => {
    if (!creatorInfo?.connected) {
      return "Connect TikTok with posting scopes before submitting."
    }

    if (creatorInfo.creator.canPost === false) {
      return creatorInfo.creator.cannotPostReason || "TikTok says this creator cannot post right now. Please try later."
    }

    if (!privacyLevel) {
      return "Select a privacy level before posting."
    }

    if (isUnauditedClient && privacyLevel !== "SELF_ONLY") {
      return "This app is unaudited on TikTok. You must use SELF_ONLY privacy."
    }

    if (commercialEnabled && !brandContentToggle && !brandOrganicToggle) {
      return "Commercial content is enabled, so select Your brand, Branded content, or both."
    }

    if (brandContentToggle && privacyLevel === "SELF_ONLY") {
      return "Branded content cannot be posted with SELF_ONLY privacy."
    }

    if (!consentChecked) {
      return "Accept the posting declaration before submitting."
    }

    if (mediaType === "VIDEO") {
      if (!videoForm.videoUrl.trim()) {
        return "Video URL is required."
      }

      if (!videoForm.videoUrl.trim().startsWith("https://")) {
        return "Video URL must use https://"
      }

      const parsedDuration = Number(videoForm.videoDurationSec)

      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        return "Video duration in seconds is required."
      }

      if (
        creatorInfo.creator.maxVideoPostDurationSec != null &&
        parsedDuration > creatorInfo.creator.maxVideoPostDurationSec
      ) {
        return `Video exceeds max duration (${creatorInfo.creator.maxVideoPostDurationSec}s).`
      }

      return null
    }

    if (!activePhotoUrls.length) {
      return "Add at least one photo URL."
    }

    if (activePhotoUrls.length > 35) {
      return "TikTok supports up to 35 photos."
    }

    if (activePhotoUrls.some((url) => !url.startsWith("https://"))) {
      return "All photo URLs must use https://"
    }

    if (activePhotoUrls.some((url) => !/\.(jpe?g|webp)(\?|#|$)/i.test(url))) {
      return "For TikTok photo posts, use JPEG/JPG/WEBP image URLs (PNG is commonly rejected with file_format_check_failed)."
    }

    return null
  }, [
    activePhotoUrls,
    brandContentToggle,
    brandOrganicToggle,
    commercialEnabled,
    consentChecked,
    creatorInfo,
    isUnauditedClient,
    mediaType,
    privacyLevel,
    videoForm.videoDurationSec,
    videoForm.videoUrl,
  ])

  async function handleSubmit() {
    if (validationMessage) {
      setErrorMessage(validationMessage)
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      setLatestStatus(null)

      const token = await waitForSessionToken(getToken)
      let result: TikTokPublishResponse

      if (mediaType === "VIDEO") {
        result = await createTikTokVideoPost(token, {
          title: videoForm.title || undefined,
          privacyLevel,
          videoUrl: videoForm.videoUrl,
          videoDurationSec: videoForm.videoDurationSec ? Number(videoForm.videoDurationSec) : undefined,
          videoCoverTimestampMs: videoForm.videoCoverTimestampMs ? Number(videoForm.videoCoverTimestampMs) : undefined,
          disableDuet: !videoForm.allowDuet,
          disableComment: !videoForm.allowComment,
          disableStitch: !videoForm.allowStitch,
          brandContentToggle: videoForm.discloseCommercialContent ? videoForm.brandContentToggle : false,
          brandOrganicToggle: videoForm.discloseCommercialContent ? videoForm.brandOrganicToggle : false,
          isAigc: videoForm.isAigc,
        })
      } else {
        result = await createTikTokPhotoPost(token, {
          title: photoForm.title || undefined,
          description: photoForm.description || undefined,
          privacyLevel,
          photoImages: activePhotoUrls,
          photoCoverIndex: photoForm.photoCoverIndex ? Number(photoForm.photoCoverIndex) : 0,
          disableComment: !photoForm.allowComment,
          autoAddMusic: photoForm.autoAddMusic,
          brandContentToggle: photoForm.discloseCommercialContent ? photoForm.brandContentToggle : false,
          brandOrganicToggle: photoForm.discloseCommercialContent ? photoForm.brandOrganicToggle : false,
        })
      }

      setLatestPublish(result)
      setSuccessMessage(`TikTok accepted the ${mediaType.toLowerCase()} post request. Publish ID: ${result.publishId}`)
      await refreshLatestStatus(result.publishId)
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = Boolean(creatorInfo && !validationMessage && !isLoadingCreatorInfo)
  const currentStatus = latestStatus?.status.status || latestPublish?.post.status || null

  return (
    <div className="space-y-6">
      <PageHeader
        title="TikTok Publisher"
        description="Direct-post videos and photo sets to TikTok using verified HTTPS media URLs from your platform."
      >
        <Button asChild variant="outline">
          <Link href="/launch-pad?role=streamer&autoconnect=tiktok">Reconnect TikTok</Link>
        </Button>
      </PageHeader>

      {errorMessage ? (
        <Alert className="border-rose-500/30 bg-rose-500/10 text-rose-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>TikTok publishing is unavailable</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Publish request created</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {validationMessage ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action required before publishing</AlertTitle>
          <AlertDescription>{validationMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isUnauditedClient ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unaudited TikTok app restrictions</AlertTitle>
          <AlertDescription>
            Direct Post is currently restricted to SELF_ONLY privacy. The creator account must also be private at posting time.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Compose Post</CardTitle>
            <CardDescription>
              This flow uses TikTok direct posting. Media URLs must already be hosted on a TikTok-verified HTTPS domain or URL prefix.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="media-type">Media type</Label>
                <Select value={mediaType} onValueChange={(value) => setMediaType(value as MediaType)}>
                  <SelectTrigger id="media-type" className="w-full">
                    <SelectValue placeholder="Choose media type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="PHOTO">Photo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="privacy-level">Privacy</Label>
                <Select value={privacyLevel} onValueChange={setPrivacyLevel} disabled={!creatorInfo?.creator.privacyLevelOptions.length}>
                  <SelectTrigger id="privacy-level" className="w-full">
                    <SelectValue placeholder="Choose privacy" />
                  </SelectTrigger>
                  <SelectContent>
                    {creatorInfo?.creator.privacyLevelOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        disabled={
                          (isUnauditedClient && option !== "SELF_ONLY") ||
                          (brandContentToggle && option === "SELF_ONLY")
                        }
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mediaType === "VIDEO" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="video-title">Caption</Label>
                  <Textarea
                    id="video-title"
                    value={videoForm.title}
                    onChange={(event) => setVideoForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Write the TikTok caption for this video"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video-url">Video URL</Label>
                  <Input
                    id="video-url"
                    value={videoForm.videoUrl}
                    onChange={(event) => setVideoForm((current) => ({ ...current, videoUrl: event.target.value }))}
                    placeholder="https://cdn.yourdomain.com/campaigns/video.mp4"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="video-duration">Video duration in seconds</Label>
                    <Input
                      id="video-duration"
                      type="number"
                      min="0"
                      value={videoForm.videoDurationSec}
                      onChange={(event) => setVideoForm((current) => ({ ...current, videoDurationSec: event.target.value }))}
                      placeholder="45"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video-cover-ms">Cover timestamp in ms</Label>
                    <Input
                      id="video-cover-ms"
                      type="number"
                      min="0"
                      value={videoForm.videoCoverTimestampMs}
                      onChange={(event) => setVideoForm((current) => ({ ...current, videoCoverTimestampMs: event.target.value }))}
                      placeholder="1000"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="video-comments">Allow comments</Label>
                    <Switch
                      id="video-comments"
                      checked={videoForm.allowComment}
                      disabled={Boolean(creatorInfo?.creator.commentDisabled)}
                      onCheckedChange={(checked) => setVideoForm((current) => ({ ...current, allowComment: Boolean(checked) }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="video-duet">Allow duet</Label>
                    <Switch
                      id="video-duet"
                      checked={videoForm.allowDuet}
                      disabled={Boolean(creatorInfo?.creator.duetDisabled)}
                      onCheckedChange={(checked) => setVideoForm((current) => ({ ...current, allowDuet: Boolean(checked) }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="video-stitch">Allow stitch</Label>
                    <Switch
                      id="video-stitch"
                      checked={videoForm.allowStitch}
                      disabled={Boolean(creatorInfo?.creator.stitchDisabled)}
                      onCheckedChange={(checked) => setVideoForm((current) => ({ ...current, allowStitch: Boolean(checked) }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="video-aigc">AI generated content</Label>
                    <Switch
                      id="video-aigc"
                      checked={videoForm.isAigc}
                      onCheckedChange={(checked) => setVideoForm((current) => ({ ...current, isAigc: Boolean(checked) }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                    <Label htmlFor="video-commercial">Commercial content disclosure</Label>
                    <Switch
                      id="video-commercial"
                      checked={videoForm.discloseCommercialContent}
                      onCheckedChange={(checked) =>
                        setVideoForm((current) => ({
                          ...current,
                          discloseCommercialContent: Boolean(checked),
                          brandContentToggle: Boolean(checked) ? current.brandContentToggle : false,
                          brandOrganicToggle: Boolean(checked) ? current.brandOrganicToggle : false,
                        }))
                      }
                    />
                  </div>

                  {videoForm.discloseCommercialContent ? (
                    <>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="video-brand-organic">Your brand</Label>
                        <Switch
                          id="video-brand-organic"
                          checked={videoForm.brandOrganicToggle}
                          onCheckedChange={(checked) =>
                            setVideoForm((current) => ({ ...current, brandOrganicToggle: Boolean(checked) }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="video-brand-content">Branded content</Label>
                        <Switch
                          id="video-brand-content"
                          checked={videoForm.brandContentToggle}
                          onCheckedChange={(checked) => {
                            const next = Boolean(checked)
                            setVideoForm((current) => ({ ...current, brandContentToggle: next }))
                            if (next && privacyLevel === "SELF_ONLY") {
                              const nextPrivacy =
                                creatorInfo?.creator.privacyLevelOptions.find((option) => option !== "SELF_ONLY") || ""
                              setPrivacyLevel(nextPrivacy)
                            }
                          }}
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="rounded-lg border p-3 md:col-span-2">
                    <p className="text-sm text-muted-foreground">
                      Do not add logos, watermarks, links, or promotional overlays in image/video content.
                    </p>
                  </div>
                </div>

                {videoForm.videoUrl.trim() ? (
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="mb-2 font-medium">Preview</p>
                    <a className="text-primary underline" href={videoForm.videoUrl.trim()} target="_blank" rel="noreferrer">
                      {videoForm.videoUrl.trim()}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="photo-title">Title</Label>
                  <Input
                    id="photo-title"
                    value={photoForm.title}
                    onChange={(event) => setPhotoForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Spring drop"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo-description">Description</Label>
                  <Textarea
                    id="photo-description"
                    value={photoForm.description}
                    onChange={(event) => setPhotoForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Describe the photo set and hashtags"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo-images">Photo URLs</Label>
                  <Textarea
                    id="photo-images"
                    value={photoForm.photoImages}
                    onChange={(event) => setPhotoForm((current) => ({ ...current, photoImages: event.target.value }))}
                    placeholder={"https://cdn.yourdomain.com/posts/look-01.webp\nhttps://cdn.yourdomain.com/posts/look-02.webp"}
                    className="min-h-28"
                  />
                  <p className="text-sm text-muted-foreground">Use one HTTPS image URL per line. TikTok supports up to 35 photos.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="photo-cover-index">Cover image index</Label>
                    <Input
                      id="photo-cover-index"
                      type="number"
                      min="0"
                      value={photoForm.photoCoverIndex}
                      onChange={(event) => setPhotoForm((current) => ({ ...current, photoCoverIndex: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="photo-comments">Allow comments</Label>
                    <Switch
                      id="photo-comments"
                      checked={photoForm.allowComment}
                      disabled={Boolean(creatorInfo?.creator.commentDisabled)}
                      onCheckedChange={(checked) => setPhotoForm((current) => ({ ...current, allowComment: Boolean(checked) }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="photo-music">Auto add music</Label>
                    <Switch
                      id="photo-music"
                      checked={photoForm.autoAddMusic}
                      onCheckedChange={(checked) => setPhotoForm((current) => ({ ...current, autoAddMusic: Boolean(checked) }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                    <Label htmlFor="photo-commercial">Commercial content disclosure</Label>
                    <Switch
                      id="photo-commercial"
                      checked={photoForm.discloseCommercialContent}
                      onCheckedChange={(checked) =>
                        setPhotoForm((current) => ({
                          ...current,
                          discloseCommercialContent: Boolean(checked),
                          brandContentToggle: Boolean(checked) ? current.brandContentToggle : false,
                          brandOrganicToggle: Boolean(checked) ? current.brandOrganicToggle : false,
                        }))
                      }
                    />
                  </div>

                  {photoForm.discloseCommercialContent ? (
                    <>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="photo-brand-organic">Your brand</Label>
                        <Switch
                          id="photo-brand-organic"
                          checked={photoForm.brandOrganicToggle}
                          onCheckedChange={(checked) =>
                            setPhotoForm((current) => ({ ...current, brandOrganicToggle: Boolean(checked) }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="photo-brand-content">Branded content</Label>
                        <Switch
                          id="photo-brand-content"
                          checked={photoForm.brandContentToggle}
                          onCheckedChange={(checked) => {
                            const next = Boolean(checked)
                            setPhotoForm((current) => ({ ...current, brandContentToggle: next }))
                            if (next && privacyLevel === "SELF_ONLY") {
                              const nextPrivacy =
                                creatorInfo?.creator.privacyLevelOptions.find((option) => option !== "SELF_ONLY") || ""
                              setPrivacyLevel(nextPrivacy)
                            }
                          }}
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="rounded-lg border p-3 md:col-span-2">
                    <p className="text-sm text-muted-foreground">
                      Do not add logos, watermarks, links, or promotional overlays in image/video content.
                    </p>
                  </div>
                </div>

                {activePhotoUrls.length ? (
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="mb-2 font-medium">Preview</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {activePhotoUrls.slice(0, 6).map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt="To-be-posted TikTok media"
                          className="h-28 w-full rounded-md border object-cover"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border p-3">
              <input
                id="posting-consent"
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => setConsentChecked(event.target.checked)}
                className="mt-0.5"
              />
              <Label htmlFor="posting-consent" className="text-sm leading-relaxed">
                {consentText}
              </Label>
            </div>

            <Button onClick={() => void handleSubmit()} disabled={!canSubmit || isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Submitting to TikTok..." : `Post ${mediaType.toLowerCase()} to TikTok`}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected Creator</CardTitle>
              <CardDescription>TikTok requires creator info to drive privacy and interaction settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {isLoadingCreatorInfo ? (
                <p className="text-muted-foreground">Loading TikTok creator info...</p>
              ) : creatorInfo ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Username</span>
                    <span className="font-medium">@{creatorInfo.creator.username || creatorInfo.account.username || "unknown"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Nickname</span>
                    <span className="font-medium">{creatorInfo.creator.nickname || "Unavailable"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Granted scopes</span>
                    <span className="max-w-[14rem] text-right font-medium break-words">{creatorInfo.account.scopes || "Unavailable"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Max video duration</span>
                    <span className="font-medium">{creatorInfo.creator.maxVideoPostDurationSec != null ? `${creatorInfo.creator.maxVideoPostDurationSec}s` : "Unavailable"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">TikTok app audit</span>
                    <span className="font-medium">{creatorInfo.account.isAudited ? "Audited" : "Unaudited"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Posting availability</span>
                    <span className="max-w-[14rem] text-right font-medium break-words">
                      {creatorInfo.creator.canPost ? "Allowed" : creatorInfo.creator.cannotPostReason || "Blocked temporarily"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-muted-foreground">Privacy options</p>
                    <div className="flex flex-wrap gap-2">
                      {creatorInfo.creator.privacyLevelOptions.map((option) => (
                        <StatusBadge key={option} variant="info">{option}</StatusBadge>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Connect TikTok with the posting scopes to load creator info.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publish Status</CardTitle>
              <CardDescription>Poll TikTok for the async result after the post request is accepted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {latestPublish ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Publish ID</span>
                    <span className="max-w-[14rem] break-all font-medium">{latestPublish.publishId}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Current status</span>
                    <StatusBadge variant={getStatusVariant(currentStatus)}>{currentStatus || "Unknown"}</StatusBadge>
                  </div>
                  {latestStatus?.status.failReason ? (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-rose-200">
                      Failure reason: {latestStatus.status.failReason}
                    </div>
                  ) : null}
                  <Button variant="outline" onClick={() => void refreshLatestStatus()} disabled={isRefreshingStatus}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {isRefreshingStatus ? "Refreshing..." : "Refresh status"}
                  </Button>
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-muted-foreground">
                  Submit a TikTok post to see the publish status here.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
              <CardDescription>Current implementation assumptions for direct posting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <UploadCloud className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Media must already exist at public HTTPS URLs owned by a TikTok-verified domain or URL prefix.</p>
              </div>
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>If your TikTok token was created before `video.publish` was enabled, reconnect TikTok so the new scope is granted.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
