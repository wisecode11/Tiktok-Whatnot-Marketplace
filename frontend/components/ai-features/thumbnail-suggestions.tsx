"use client"

import { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Copy, Download, ImageIcon, Loader2, RefreshCw } from "lucide-react"
import { aiApi } from "@/lib/ai"
import { waitForSessionToken } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

interface ThumbnailSuggestion {
  title: string
  visualElements: string[]
  colorScheme: string
  textOverlay: string
  why: string
}

interface SuggestionWithImage extends ThumbnailSuggestion {
  imageUrl?: string | null
  imageLoading?: boolean
  imageError?: boolean
}

export function ThumbnailSuggestionsComponent() {
  const { getToken } = useAuth()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [suggestions, setSuggestions] = useState<SuggestionWithImage[]>([])
  const [selectedDesignIndex, setSelectedDesignIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const buildDesignBrief = (suggestion: SuggestionWithImage) => {
    return [
      `Title: ${suggestion.title}`,
      `Visual Elements: ${suggestion.visualElements.join(", ")}`,
      `Color Scheme: ${suggestion.colorScheme}`,
      `Text Overlay: ${suggestion.textOverlay}`,
      suggestion.imageUrl ? `Generated Image: ${suggestion.imageUrl}` : null,
      `Why This Works: ${suggestion.why}`,
    ]
      .filter(Boolean)
      .join("\n")
  }

  const handleUseDesign = async (suggestion: SuggestionWithImage, index: number) => {
    setSelectedDesignIndex(index)
    try {
      await navigator.clipboard.writeText(buildDesignBrief(suggestion))
      toast({ title: "Design selected", description: "Design brief copied to clipboard." })
    } catch {
      toast({ title: "Design selected", description: "Design has been selected." })
    }
  }

  const handleDownloadImage = async (imageUrl: string, suggestionTitle: string) => {
    const safeName = suggestionTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "thumbnail"

    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `${safeName}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
      toast({ title: "Downloaded", description: "Thumbnail image downloaded successfully." })
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer")
      toast({
        title: "Opened image",
        description: "Direct download blocked by browser. Image opened in a new tab.",
      })
    }
  }

  const fetchImageForCard = async (index: number, suggestion: ThumbnailSuggestion) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, imageLoading: true, imageError: false } : s)),
    )

    try {
      const token = await waitForSessionToken(getToken)
      const imageUrl = await aiApi.generateThumbnailImage(
        token,
        suggestion as Record<string, unknown>,
        title,
        description,
        category,
      )
      setSuggestions((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, imageUrl, imageLoading: false, imageError: !imageUrl } : s,
        ),
      )
    } catch {
      setSuggestions((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, imageLoading: false, imageError: true } : s,
        ),
      )
    }
  }

  const handleGenerateThumbnails = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a product title",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setSuggestions([])
    setSelectedDesignIndex(null)

    try {
      const token = await waitForSessionToken(getToken)
      const generatedSuggestions = await aiApi.generateThumbnails(
        token,
        title,
        description,
        category,
      )

      const withState: SuggestionWithImage[] = generatedSuggestions.slice(0, 1).map((s) => ({
        ...s,
        imageUrl: null,
        imageLoading: false,
        imageError: false,
      }))

      setSuggestions(withState)
      toast({ title: "Success", description: "Thumbnail suggestions generated!" })

      // Automatically kick off image generation for each card one by one
      for (let i = 0; i < withState.length; i++) {
        fetchImageForCard(i, withState[i])
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate thumbnail suggestions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Thumbnail Suggestions</h1>
        <p className="text-gray-600 mt-2">
          AI recommends thumbnails based on your product title and description, and generates a real image for each concept.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Thumbnail Concepts</CardTitle>
          <CardDescription>
            Provide product details to get AI-powered thumbnail design suggestions with generated images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Product Title *</label>
            <Input
              placeholder="Enter the product title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Product Description (Optional)</label>
            <Textarea
              placeholder="Provide the product description for better thumbnail suggestions"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Product Category (Optional)</label>
            <Input
              placeholder="e.g., Electronics, Fashion, Accessories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleGenerateThumbnails}
            disabled={loading || !title.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating suggestions...
              </>
            ) : (
              "Generate Suggestions"
            )}
          </Button>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Recommended Thumbnails</h2>
          {suggestions.map((suggestion, index) => (
            <Card
              key={index}
              className={selectedDesignIndex === index ? "border-primary ring-1 ring-primary/30" : ""}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedDesignIndex === index && <Badge>Selected</Badge>}
                    <Badge variant="outline">Design {index + 1}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Generated Image */}
                <div className="rounded-lg border bg-muted/20 p-2">
                  {suggestion.imageLoading ? (
                    <div className="min-h-[280px] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Generating image...</span>
                    </div>
                  ) : suggestion.imageUrl ? (
                    <div className="space-y-3">
                      <div className="flex justify-center">
                        <img
                          src={suggestion.imageUrl}
                          alt={`${suggestion.title} generated thumbnail`}
                          className="w-full max-w-[420px] h-auto max-h-[460px] object-contain rounded"
                          loading="lazy"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleDownloadImage(suggestion.imageUrl as string, suggestion.title)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Image
                      </Button>
                    </div>
                  ) : suggestion.imageError ? (
                    <div className="min-h-[280px] flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span>Image generation failed</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchImageForCard(index, suggestion)}
                      >
                        Retry Image
                      </Button>
                    </div>
                  ) : (
                    <div className="min-h-[280px] flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchImageForCard(index, suggestion)}
                      >
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Generate Image
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Visual Elements</h4>
                    <div className="flex flex-wrap gap-2">
                      {suggestion.visualElements.map((element, i) => (
                        <Badge key={i} variant="secondary">
                          {element}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Color Scheme</h4>
                    <p className="text-sm text-gray-600">{suggestion.colorScheme}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Text Overlay</h4>
                  <div className="bg-gray-50 p-3 rounded border text-sm">
                    {suggestion.textOverlay}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Why This Works</h4>
                  <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                    {suggestion.why}
                  </p>
                </div>

                <Button
                  className="w-full"
                  variant={selectedDesignIndex === index ? "secondary" : "default"}
                  onClick={() => handleUseDesign(suggestion, index)}
                >
                  {selectedDesignIndex === index ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Selected
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Use This Design
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGenerateThumbnails}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Generate More Suggestions
          </Button>
        </div>
      )}
    </div>
  )
}
