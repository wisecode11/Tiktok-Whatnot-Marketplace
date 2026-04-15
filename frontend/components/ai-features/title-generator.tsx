"use client"

import { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Copy, RefreshCw } from "lucide-react"
import { aiApi } from "@/lib/ai"
import { waitForSessionToken } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

export function TitleGeneratorComponent() {
  const { getToken } = useAuth()
  const [productName, setProductName] = useState("")
  const [titles, setTitles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const { toast } = useToast()

  const handleGenerateTitles = async () => {
    if (!productName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a product name",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const token = await waitForSessionToken(getToken)
      const generatedTitles = await aiApi.generateTitle(token, productName)
      setTitles(generatedTitles)
      toast({
        title: "Success",
        description: "Titles generated successfully!",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate titles. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyTitle = (title: string, index: number) => {
    navigator.clipboard.writeText(title)
    setCopiedIndex(index)
    toast({
      title: "Copied",
      description: "Title copied to clipboard!",
    })
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleRegenerateTitle = async () => {
    await handleGenerateTitles()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Title Generator</h1>
        <p className="text-gray-600 mt-2">
          Enter your product name and let AI generate optimized titles tailored for maximum engagement on TikTok and Whatnot.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Product Titles</CardTitle>
          <CardDescription>
            Enter your product name to generate engaging, conversion-focused titles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter product name (e.g., 'Premium Wireless Headphones')"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              disabled={loading}
              onKeyPress={(e) => e.key === "Enter" && handleGenerateTitles()}
            />
            <Button
              onClick={handleGenerateTitles}
              disabled={loading || !productName.trim()}
              className="whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Titles"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {titles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Titles</CardTitle>
            <CardDescription>
              Click the copy button to use any of these titles for your product
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {titles.map((title, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
                >
                  <p className="font-medium text-sm flex-1">{title}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyTitle(title, index)}
                    className={
                      copiedIndex === index
                        ? "text-green-600"
                        : "text-gray-500 hover:text-gray-900"
                    }
                  >
                    <Copy className="w-4 h-4" />
                    {copiedIndex === index && <span className="ml-2 text-xs">Copied!</span>}
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={handleRegenerateTitle}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate Titles
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
