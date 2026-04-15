"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TitleGeneratorComponent } from "@/components/ai-features/title-generator"
import { DescriptionGeneratorComponent } from "@/components/ai-features/description-generator"
import { ThumbnailSuggestionsComponent } from "@/components/ai-features/thumbnail-suggestions"
import { ScriptBuilderComponent } from "@/components/ai-features/script-builder"

export function AIFeaturesHubComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">AI Features</h1>
        <p className="text-gray-600 mt-2 text-lg">
          Single workspace for all AI tools: title, description, thumbnail suggestions, and script builder.
        </p>
      </div>

      <Tabs defaultValue="title" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="title">Title Generator</TabsTrigger>
          <TabsTrigger value="description">Description Generator</TabsTrigger>
          <TabsTrigger value="thumbnail">Thumbnail Suggestions</TabsTrigger>
          <TabsTrigger value="script">Script Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="title" className="mt-4">
          <TitleGeneratorComponent />
        </TabsContent>

        <TabsContent value="description" className="mt-4">
          <DescriptionGeneratorComponent />
        </TabsContent>

        <TabsContent value="thumbnail" className="mt-4">
          <ThumbnailSuggestionsComponent />
        </TabsContent>

        <TabsContent value="script" className="mt-4">
          <ScriptBuilderComponent />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Recommended Flow</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          Generate title first, then description, then thumbnail concept, and finally your live selling script.
        </CardContent>
      </Card>
    </div>
  )
}
