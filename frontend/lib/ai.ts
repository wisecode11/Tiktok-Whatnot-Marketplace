const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

interface AiApiErrorPayload {
  error?: string
}

async function postAi<T>(
  path: string,
  token: string,
  body: Record<string, unknown>,
  timeoutMs: number | null = 200000,
): Promise<T> {
  const controller = new AbortController()
  const timeoutId =
    timeoutMs != null && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: timeoutId ? controller.signal : undefined,
    })

    const payload = (await response.json().catch(() => ({}))) as AiApiErrorPayload & T

    if (!response.ok) {
      throw new Error(payload.error || "AI request failed")
    }

    return payload
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.")
    }

    throw error
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export const aiApi = {
  async generateTitle(token: string, productName: string): Promise<string[]> {
    const data = await postAi<{ titles: string[] }>("/ai/generate-title", token, {
      productName,
    })
    return data.titles
  },

  async generateDescription(
    token: string,
    title: string,
    productDetails?: string,
  ): Promise<string> {
    const data = await postAi<{ description: string }>("/ai/generate-description", token, {
      title,
      productDetails,
    })
    return data.description
  },

  async generateThumbnails(
    token: string,
    title: string,
    description?: string,
    productCategory?: string,
  ): Promise<any[]> {
    const data = await postAi<{ suggestions: any[] }>("/ai/generate-thumbnails", token, {
      title,
      description,
      productCategory,
    })
    return data.suggestions
  },

  async generateThumbnailImage(
    token: string,
    suggestion: Record<string, unknown>,
    title: string,
    description?: string,
    productCategory?: string,
  ): Promise<string | null> {
    const data = await postAi<{ imageUrl: string | null }>(
      "/ai/generate-thumbnail-image",
      token,
      {
        suggestion,
        title,
        description,
        productCategory,
      },
      null,
    )
    return data.imageUrl ?? null
  },

  async generateInventoryThumbnail(
    token: string,
    title: string,
    description?: string,
    productCategory?: string,
  ): Promise<{ imageUrl: string; suggestion?: Record<string, unknown> }> {
    const data = await postAi<{ imageUrl: string; suggestion?: Record<string, unknown> }>(
      "/ai/generate-inventory-thumbnail",
      token,
      { title, description, productCategory },
      null,
    )
    return { imageUrl: data.imageUrl, suggestion: data.suggestion }
  },

  async generateInventoryListing(
    token: string,
    category: string,
    userTitle?: string,
  ): Promise<{ title: string; description: string }> {
    const data = await postAi<{ title: string; description: string }>(
      "/ai/generate-inventory-listing",
      token,
      { category, userTitle: userTitle?.trim() || undefined },
      45000,
    )
    return { title: data.title, description: data.description }
  },

  async generateScript(
    token: string,
    title: string,
    description: string,
    audience?: string,
    duration?: string,
    language?: string,
  ): Promise<string> {
    const data = await postAi<{ script: string }>(
      "/ai/generate-script",
      token,
      {
        title,
        description,
        audience,
        duration,
        language,
      },
      90000,
    )
    return data.script
  },
}
