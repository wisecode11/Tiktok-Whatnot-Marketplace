"use client"

import { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Copy, RefreshCw } from "lucide-react"
import { aiApi } from "@/lib/ai"
import { waitForSessionToken } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

export function DescriptionGeneratorComponent() {
  const { getToken } = useAuth()
  const [title, setTitle] = useState("")
  const [productDetails, setProductDetails] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleGenerateDescription = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a product title",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const token = await waitForSessionToken(getToken)
      const generatedDescription = await aiApi.generateDescription(token, title, productDetails)
      setDescription(generatedDescription)
      toast({
        title: "Success",
        description: "Description generated successfully!",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate description. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyDescription = () => {
    navigator.clipboard.writeText(description)
    toast({
      title: "Copied",
      description: "Description copied to clipboard!",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Description Generator</h1>
        <p className="text-gray-600 mt-2">
          Auto-create detailed product descriptions from your title. Review and edit before publishing to your live stream.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Product Description</CardTitle>
          <CardDescription>
            Provide the product title and optional details to generate a compelling description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Product Title *</label>
            <Input
              placeholder="Enter the product title (e.g., '✨ Premium Wireless Headphones - Limited Edition')"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Additional Details (Optional)</label>
            <Textarea
              placeholder="Add any additional details about the product (e.g., color, materials, special features, pricing, etc.)"
              value={productDetails}
              onChange={(e) => setProductDetails(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          <Button
            onClick={handleGenerateDescription}
            disabled={loading || !title.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Description"
            )}
          </Button>
        </CardContent>
      </Card>

      {description && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Description</CardTitle>
                <CardDescription>
                  Review and edit as needed before publishing
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyDescription}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="whitespace-pre-wrap text-sm">{description}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGenerateDescription}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate Description
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
