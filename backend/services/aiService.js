const OpenAI = require("openai");

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw createHttpError(
      500,
      "OpenAI integration is not configured. Add OPENAI_API_KEY in backend .env.",
    );
  }

  return new OpenAI({ apiKey });
}

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function isAbortLikeError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = typeof error.name === "string" ? error.name : "";
  const message = typeof error.message === "string" ? error.message : "";

  return (
    name === "AbortError" ||
    name === "APIUserAbortError" ||
    /aborted|abort/i.test(message)
  );
}

function parseJsonArray(content) {
  if (typeof content !== "string") {
    throw new Error("Model response is not text");
  }

  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced && fenced[1]) {
      return JSON.parse(fenced[1]);
    }

    const firstBracket = trimmed.indexOf("[");
    const lastBracket = trimmed.lastIndexOf("]");

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const sliced = trimmed.slice(firstBracket, lastBracket + 1);
      return JSON.parse(sliced);
    }

    throw new Error("Unable to parse JSON array from model response");
  }
}

function sanitizeSuggestion(rawSuggestion = {}) {
  return {
    title: typeof rawSuggestion.title === "string" ? rawSuggestion.title : "Recommended Design",
    visualElements: Array.isArray(rawSuggestion.visualElements)
      ? rawSuggestion.visualElements.filter((item) => typeof item === "string").slice(0, 8)
      : [],
    colorScheme:
      typeof rawSuggestion.colorScheme === "string"
        ? rawSuggestion.colorScheme
        : "high contrast colors",
    textOverlay:
      typeof rawSuggestion.textOverlay === "string"
        ? rawSuggestion.textOverlay
        : "Live Deal",
    why: typeof rawSuggestion.why === "string" ? rawSuggestion.why : "Optimized for click-through rate.",
  };
}

function detectLanguageFromText(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const normalized = text.toLowerCase();
  const languageMap = [
    { pattern: /\benglish\b|\bin english\b/, value: "English" },
    { pattern: /\burdu\b|\bin urdu\b/, value: "Urdu" },
    { pattern: /\bhindi\b|\bin hindi\b/, value: "Hindi" },
    { pattern: /\barabic\b|\bin arabic\b/, value: "Arabic" },
    { pattern: /\bspanish\b|\bin spanish\b/, value: "Spanish" },
    { pattern: /\bfrench\b|\bin french\b/, value: "French" },
    { pattern: /\bgerman\b|\bin german\b/, value: "German" },
    { pattern: /\bturkish\b|\bin turkish\b/, value: "Turkish" },
  ];

  const match = languageMap.find((item) => item.pattern.test(normalized));
  return match ? match.value : null;
}

function resolveScriptLanguage({ title, description, audience, languageHint }) {
  const explicitHint =
    typeof languageHint === "string" && languageHint.trim() ? languageHint.trim() : null;

  if (explicitHint) {
    return explicitHint;
  }

  const combinedText = [title, description, audience].filter(Boolean).join(" ");
  return detectLanguageFromText(combinedText) || "English";
}

function buildFallbackScript({ title, description, audience, duration }) {
  const cleanTitle = (title || "This product").trim();
  const cleanAudience = (audience || "general audience").replace(/[-_]/g, " ");
  const cleanDuration = duration || "15 minutes";
  const shortDescription = (description || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);

  return `OPENING
Welcome back to the live session. Today we are featuring ${cleanTitle}. If you are part of the ${cleanAudience}, this product could be an excellent fit for your needs.

PRODUCT INTRO
Quick overview: ${shortDescription || "Premium quality product designed for value, style, and performance."}

FEATURES & BENEFITS
- High quality and reliable daily use
- Great value compared to alternatives
- Easy to use and gift-friendly
- Suitable for buyers looking for quality with confidence

OBJECTION HANDLING
If you are wondering whether this is worth it, the answer is yes because it offers a strong combination of quality, presentation, and reliable performance.
If you are wondering whether this is right for you, it is a strong choice for buyers who want dependable results without overpaying.

URGENCY & CTA
This is a limited-stock live offer. During this ${cleanDuration} stream, you can get the best deal. Early buyers will get priority dispatch.

CLOSING
Place your order now at checkout. If you want, I can quickly recap the key points before we close this segment.`;
}

function buildThumbnailImagePrompt({ suggestion, title, description, productCategory }) {
  const visualElements = suggestion.visualElements.join(", ");
  const details = [
    `Create a high-converting e-commerce livestream thumbnail image for this product: ${title}.`,
    description ? `Product context: ${description}` : null,
    productCategory ? `Category: ${productCategory}` : null,
    `Design concept title: ${suggestion.title}`,
    visualElements ? `Visual elements: ${visualElements}` : null,
    `Color scheme: ${suggestion.colorScheme}`,
    `Text overlay to include exactly: ${suggestion.textOverlay}`,
    "Style: professional, sharp, clean, premium product focus, social media thumbnail composition.",
    "No watermarks, no logos, no brand trademarks, no gibberish text.",
    "Output should look like a clickable streamer product thumbnail.",
  ].filter(Boolean);

  return details.join(" ");
}

async function generateThumbnailImage(client, context) {
  const prompt = buildThumbnailImagePrompt(context);

  const runImageGeneration = async (model, extraOptions = {}) => {
    const imageResponse = await client.images.generate({
      model,
      prompt,
      size: "1024x1024",
      ...extraOptions,
    });

    const firstImage = imageResponse?.data?.[0];
    if (!firstImage) {
      return null;
    }

    if (firstImage.b64_json) {
      return `data:image/png;base64,${firstImage.b64_json}`;
    }

    if (firstImage.url) {
      return firstImage.url;
    }

    return null;
  };

  try {
    return await runImageGeneration("gpt-image-1");
  } catch (error) {
    console.error("Error generating thumbnail image with gpt-image-1:", error.message || error);
  }

  try {
    return await runImageGeneration("dall-e-3", {
      quality: "standard",
      style: "vivid",
      response_format: "url",
    });
  } catch (error) {
    console.error("Error generating thumbnail image with dall-e-3:", error.message || error);
  }

  return null;
}

async function generateTitle(productName) {
  if (!productName || typeof productName !== "string") {
    throw createHttpError(400, "Product name is required");
  }

  const productNameTrimmed = productName.trim();
  if (!productNameTrimmed) {
    throw createHttpError(400, "Product name cannot be empty");
  }

  try {
    const client = getOpenAIClient();
    const prompt = `You are an expert e-commerce content creator specializing in TikTok and Whatnot live streams. Generate 5 optimized, engaging product titles for selling "${productNameTrimmed}" on TikTok/Whatnot platforms.

Requirements for each title:
- 50-80 characters max
- Include power words (Amazing, Exclusive, Limited, Trending)
- Create urgency or FOMO
- Highlight key benefits
- Use emojis sparingly (1-2 max per title)
- Make them scroll-stopping and conversion-focused

Format your response as a JSON array like:
["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]

Only return the JSON array, no other text.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || "";
    const titles = parseJsonArray(content);

    if (!Array.isArray(titles) || titles.length === 0) {
      throw new Error("Invalid response format");
    }

    return titles.slice(0, 5);
  } catch (error) {
    console.error("Error generating titles:", error);
    throw createHttpError(
      500,
      "Failed to generate titles",
      error.message,
    );
  }
}

async function generateDescription(title, productDetails = "") {
  if (!title || typeof title !== "string") {
    throw createHttpError(400, "Product title is required");
  }

  const titleTrimmed = title.trim();
  if (!titleTrimmed) {
    throw createHttpError(400, "Product title cannot be empty");
  }

  try {
    const client = getOpenAIClient();
    const prompt = `You are an expert e-commerce copywriter specializing in live stream selling on TikTok and Whatnot. Generate a compelling, detailed product description for a live stream based on the title.

Product Title: "${titleTrimmed}"
${productDetails ? `Additional Details: ${productDetails}` : ""}

Create a description that:
- Is 150-250 words
- Highlights key features and benefits
- Creates excitement and urgency
- Includes a call-to-action
- Uses language that resonates with live stream shoppers
- Mentions limited quantities or exclusivity where appropriate
- Focuses on value proposition

Format as plain text, no JSON.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const description = (response.choices[0]?.message?.content || "").trim();

    if (!description) {
      throw new Error("Empty description generated");
    }

    return description;
  } catch (error) {
    console.error("Error generating description:", error);
    throw createHttpError(
      500,
      "Failed to generate description",
      error.message,
    );
  }
}

async function generateThumbnailSuggestions(title, description, productCategory = "") {
  if (!title || typeof title !== "string") {
    throw createHttpError(400, "Product title is required");
  }

  const titleTrimmed = title.trim();
  if (!titleTrimmed) {
    throw createHttpError(400, "Product title cannot be empty");
  }

  try {
    const client = getOpenAIClient();
    const prompt = `You are a professional thumbnail designer for TikTok and Whatnot live streams. Based on the product information, suggest only 1 best thumbnail concept that will maximize clicks and engagement.

Product Title: "${titleTrimmed}"
${description ? `Description: ${description}` : ""}
${productCategory ? `Category: ${productCategory}` : ""}

For each thumbnail suggestion, provide:
1. A descriptive title
2. Visual elements to include
3. Color scheme recommendation
4. Text overlay suggestion
5. Why this design works for this product

Format your response as a JSON array of objects like:
[
  {
    "title": "Thumbnail Title",
    "visualElements": ["element1", "element2"],
    "colorScheme": "description",
    "textOverlay": "suggested text",
    "why": "explanation"
  }
]

Only return the JSON array, no other text.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "";
    const suggestions = parseJsonArray(content);

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error("Invalid response format");
    }

    const normalizedSuggestions = suggestions.slice(0, 1).map(sanitizeSuggestion);

    return normalizedSuggestions;
  } catch (error) {
    console.error("Error generating thumbnail suggestions:", error);
    throw createHttpError(
      500,
      "Failed to generate thumbnail suggestions",
      error.message,
    );
  }
}

async function generateScript(
  title,
  description,
  audience = "general",
  duration = "15 minutes",
  languageHint = "",
) {
  if (!title || typeof title !== "string") {
    throw createHttpError(400, "Product title is required");
  }

  if (!description || typeof description !== "string") {
    throw createHttpError(400, "Product description is required");
  }

  const titleTrimmed = title.trim();
  const descriptionTrimmed = description.trim();

  if (!titleTrimmed) {
    throw createHttpError(400, "Product title cannot be empty");
  }

  if (!descriptionTrimmed) {
    throw createHttpError(400, "Product description cannot be empty");
  }

  const parsedDuration = Number.parseInt(String(duration), 10);
  const durationMinutes = Number.isFinite(parsedDuration) ? parsedDuration : 15;
  const targetWordCount = Math.max(220, Math.min(durationMinutes * 35, 900));
  const descriptionForPrompt = descriptionTrimmed.slice(0, 2000);
  const timeoutMs = 25000;
  const scriptLanguage = resolveScriptLanguage({
    title: titleTrimmed,
    description: descriptionForPrompt,
    audience,
    languageHint,
  });

  try {
    const client = getOpenAIClient();
    const prompt = `You are a professional live stream selling script writer for TikTok Shop and Whatnot. Create an engaging, conversational selling script.

Product Title: "${titleTrimmed}"
Product Description: "${descriptionForPrompt}"
Target Audience: ${audience}
Stream Duration: ${duration}
Script Language: ${scriptLanguage}
Target Script Length: around ${targetWordCount} words

Create a script that:
- Opens with a hook to grab attention (first 30 seconds)
- Introduces the product and explains why it's special
- Highlights key features and benefits
- Addresses common objections
- Creates urgency (limited stock, special price)
- Includes suggested call-outs or prompts for audience interaction
- Ends with a strong call-to-action

Structure the script with clear sections: OPENING, PRODUCT INTRO, FEATURES & BENEFITS, OBJECTION HANDLING, URGENCY & CTA, CLOSING.

Important language rule:
- If no language is explicitly requested, write the script fully in English.
- If a specific language is requested, write fully in that language.
- Do not mix languages unless user explicitly asks for mixed language.

Make it conversational, energetic, concise, and suitable for spoken delivery on a live stream.`;

    const response = await client.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 900,
      },
      {
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    const script = (response.choices[0]?.message?.content || "").trim();

    if (!script) {
      throw new Error("Empty script generated");
    }

    return script;
  } catch (error) {
    if (isAbortLikeError(error)) {
      console.warn("Script generation timed out. Returning fallback script.");
      return buildFallbackScript({
        title: titleTrimmed,
        description: descriptionForPrompt,
        audience,
        duration,
      });
    }

    console.error("Error generating script:", error);

    throw createHttpError(
      500,
      "Failed to generate script",
      error.message,
    );
  }
}

async function generateSingleThumbnailImage(suggestion, title, description, productCategory) {
  if (!suggestion || typeof suggestion !== "object") {
    throw createHttpError(400, "Suggestion object is required");
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    throw createHttpError(400, "Product title is required");
  }

  const client = getOpenAIClient();

  const imageUrl = await generateThumbnailImage(client, {
    suggestion: sanitizeSuggestion(suggestion),
    title: title.trim(),
    description: description || "",
    productCategory: productCategory || "",
  });

  return imageUrl;
}

module.exports = {
  generateTitle,
  generateDescription,
  generateThumbnailSuggestions,
  generateSingleThumbnailImage,
  generateScript,
};
