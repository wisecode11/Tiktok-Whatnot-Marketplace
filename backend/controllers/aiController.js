const {
  generateTitle,
  generateDescription,
  generateThumbnailSuggestions,
  generateSingleThumbnailImage,
  generateScript,
} = require("../services/aiService");

async function generateTitleHandler(req, res, next) {
  try {
    const { productName } = req.body;
    const userId = req.auth.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!productName) {
      return res.status(400).json({ error: "Product name is required" });
    }

    const titles = await generateTitle(productName);

    res.json({
      success: true,
      titles,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

async function generateDescriptionHandler(req, res, next) {
  try {
    const { title, productDetails } = req.body;
    const userId = req.auth.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!title) {
      return res.status(400).json({ error: "Product title is required" });
    }

    const description = await generateDescription(title, productDetails || "");

    res.json({
      success: true,
      description,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

async function generateThumbnailSuggestionsHandler(req, res, next) {
  try {
    const { title, description, productCategory } = req.body;
    const userId = req.auth.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!title) {
      return res.status(400).json({ error: "Product title is required" });
    }

    const suggestions = await generateThumbnailSuggestions(
      title,
      description || "",
      productCategory || "",
    );

    res.json({
      success: true,
      suggestions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

async function generateScriptHandler(req, res, next) {
  try {
    const { title, description, audience, duration, language } = req.body;
    const userId = req.auth.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!title) {
      return res.status(400).json({ error: "Product title is required" });
    }

    if (!description) {
      return res.status(400).json({ error: "Product description is required" });
    }

    const script = await generateScript(
      title,
      description,
      audience || "general",
      duration || "15 minutes",
      language || "",
    );

    res.json({
      success: true,
      script,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

async function generateThumbnailImageHandler(req, res, next) {
  try {
    const { suggestion, title, description, productCategory } = req.body;
    const userId = req.auth.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!suggestion || !title) {
      return res.status(400).json({ error: "suggestion and title are required" });
    }

    const imageUrl = await generateSingleThumbnailImage(
      suggestion,
      title,
      description || "",
      productCategory || "",
    );

    res.json({
      success: true,
      imageUrl,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateTitleHandler,
  generateDescriptionHandler,
  generateThumbnailSuggestionsHandler,
  generateThumbnailImageHandler,
  generateScriptHandler,
};
