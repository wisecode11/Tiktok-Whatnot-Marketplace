"use client"

import { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Copy, RefreshCw, Download } from "lucide-react"
import { aiApi } from "@/lib/ai"
import { waitForSessionToken } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

export function ScriptBuilderComponent() {
  const { getToken } = useAuth()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [language, setLanguage] = useState("English")
  const [audience, setAudience] = useState("general")
  const [duration, setDuration] = useState("15 minutes")
  const [script, setScript] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleGenerateScript = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a product title",
        variant: "destructive",
      })
      return
    }

    if (!description.trim()) {
      toast({
        title: "Error",
        description: "Please enter a product description",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const token = await waitForSessionToken(getToken)
      const generatedScript = await aiApi.generateScript(
        token,
        title,
        description,
        audience,
        duration,
        language,
      )
      setScript(generatedScript)
      toast({
        title: "Success",
        description: "Script generated successfully!",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate script. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyScript = () => {
    navigator.clipboard.writeText(script)
    toast({
      title: "Copied",
      description: "Script copied to clipboard!",
    })
  }

  const handleDownloadScript = () => {
    const element = document.createElement("a")
    const file = new Blob([script], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = `script-${new Date().getTime()}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    toast({
      title: "Downloaded",
      description: "Script downloaded successfully!",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Script Builder</h1>
        <p className="text-gray-600 mt-2">
          Generate a complete live stream selling script based on your product. Follow it on-screen during your live show for maximum impact and sales.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Live Stream Script</CardTitle>
          <CardDescription>
            Provide product details and stream settings to generate a selling script
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
            <label className="block text-sm font-medium mb-2">Product Description *</label>
            <Textarea
              placeholder="Enter the complete product description with key features and benefits"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Script Language</label>
            <Input
              placeholder="English"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Default is English. Enter any language name (for example: Urdu, Arabic, Spanish).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Target Audience</label>
              <Select value={audience} onValueChange={setAudience} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Audience</SelectItem>
                  <SelectItem value="young-professionals">Young Professionals (18-35)</SelectItem>
                  <SelectItem value="families">Families</SelectItem>
                  <SelectItem value="tech-enthusiasts">Tech Enthusiasts</SelectItem>
                  <SelectItem value="fashion-conscious">Fashion Conscious</SelectItem>
                  <SelectItem value="luxury-buyers">Luxury Buyers</SelectItem>
                  <SelectItem value="budget-conscious">Budget Conscious</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Stream Duration</label>
              <Select value={duration} onValueChange={setDuration} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5 minutes">5 Minutes</SelectItem>
                  <SelectItem value="10 minutes">10 Minutes</SelectItem>
                  <SelectItem value="15 minutes">15 Minutes</SelectItem>
                  <SelectItem value="20 minutes">20 Minutes</SelectItem>
                  <SelectItem value="30 minutes">30 Minutes</SelectItem>
                  <SelectItem value="45 minutes">45 Minutes</SelectItem>
                  <SelectItem value="60 minutes">60 Minutes (1 Hour)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerateScript}
            disabled={loading || !title.trim() || !description.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Script"
            )}
          </Button>
        </CardContent>
      </Card>

      {script && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Live Stream Script</CardTitle>
                <CardDescription>
                  Ready to follow during your live show
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyScript}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadScript}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-6 rounded-lg border max-h-96 overflow-y-auto">
              <p className="whitespace-pre-wrap text-sm font-mono leading-6">{script}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGenerateScript}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate Script
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
