const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

interface AiApiErrorPayload {
  error?: string
}

async function postAi<T>(
  path: string,
  token: string,
  body: Record<string, unknown>,
  timeoutMs = 90000,
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
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
    clearTimeout(timeoutId)
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
    const data = await postAi<{ imageUrl: string | null }>("/ai/generate-thumbnail-image", token, {
      suggestion,
      title,
      description,
      productCategory,
    })
    return data.imageUrl ?? null
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
