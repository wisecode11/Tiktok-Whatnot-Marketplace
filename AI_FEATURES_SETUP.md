# AI Features Setup Guide

## Overview

This comprehensive AI Features module adds powerful content creation capabilities to the moderator/streamer dashboard:

1. **Title Generator** - Generates 5 optimized product titles for TikTok/Whatnot
2. **Description Generator** - Auto-creates detailed product descriptions  
3. **Thumbnail Suggestions** - Recommends 5 thumbnail design concepts
4. **Script Builder** - Generates complete live stream selling scripts

## Prerequisites

- Node.js 16+ (backend)
- OpenAI API key (get from https://platform.openai.com/api-keys)
- Existing marketplace project setup

## Backend Setup

### 1. Install Dependencies

Navigate to the backend directory and install the new OpenAI package:

```bash
cd backend
npm install
```

The `openai` package has already been added to package.json.

### 2. Configure Environment Variables

Add the following to your `.env` file in the backend directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

**Security Note:** Never commit your `.env` file to git. It's already in `.gitignore`.

### 3. Verify Backend Routes

The AI routes have been automatically registered in `app.js`. The API endpoints are:

- `POST /api/ai/generate-title` - Generate product titles
- `POST /api/ai/generate-description` - Generate product description
- `POST /api/ai/generate-thumbnails` - Generate thumbnail suggestions
- `POST /api/ai/generate-script` - Generate live stream script

All routes require authentication via Clerk.

## Frontend Setup

### 1. Configure API URL (if needed)

The frontend defaults to `http://localhost:5000/api`. If your backend URL is different, update the `API_BASE_URL` in:

```
frontend/lib/ai.ts
```

Or set the environment variable:

```env
NEXT_PUBLIC_API_URL=http://your-backend-url/api
```

### 2. Navigation Integration

The sidebar has been automatically updated with:
- **AI Hub** - Main AI features dashboard
- **Title Generator** - Access title generation tool
- **Description Generator** - Access description generation tool
- **Thumbnail Suggestions** - Access thumbnail design suggestions
- **Script Builder** - Access script generation tool

## File Structure

```
backend/
├── services/aiService.js          # AI generation logic
├── controllers/aiController.js    # Request handlers
├── routes/aiRoutes.js             # API route definitions

frontend/
├── lib/ai.ts                      # API client utility
├── components/ai-features/
│   ├── ai-features-hub.tsx        # Main hub component
│   ├── title-generator.tsx        # Title generation UI
│   ├── description-generator.tsx  # Description generation UI
│   ├── thumbnail-suggestions.tsx  # Thumbnail suggestion UI
│   └── script-builder.tsx         # Script generation UI
├── app/(moderator)/moderator/ai-features/
│   ├── page.tsx                   # AI Hub page
│   ├── title-generator/page.tsx   
│   ├── description-generator/page.tsx
│   ├── thumbnails/page.tsx
│   └── script-builder/page.tsx
```

## API Endpoint Details

### 1. Generate Title

**URL:** `POST /api/ai/generate-title`

**Request Body:**
```json
{
  "productName": "Premium Wireless Headphones"
}
```

**Response:**
```json
{
  "success": true,
  "titles": [
    "✨ Premium Wireless Headphones - Amazing Sound Quality",
    "🎵 Limited Edition Wireless Headphones - 50% Off Today",
    "🔊 Best Wireless Headphones - Crystal Clear Audio",
    "💎 Exclusive Wireless Headphones - Top Seller",
    "⚡ Lightning Fast Wireless Headphones - Must Have"
  ],
  "generatedAt": "2024-04-14T10:30:00.000Z"
}
```

### 2. Generate Description

**URL:** `POST /api/ai/generate-description`

**Request Body:**
```json
{
  "title": "✨ Premium Wireless Headphones",
  "productDetails": "Noise cancelling, 40-hour battery, premium materials"
}
```

**Response:**
```json
{
  "success": true,
  "description": "Experience premium sound with our latest wireless headphones...",
  "generatedAt": "2024-04-14T10:30:00.000Z"
}
```

### 3. Generate Thumbnails

**URL:** `POST /api/ai/generate-thumbnails`

**Request Body:**
```json
{
  "title": "Premium Wireless Headphones",
  "description": "High quality noise cancelling headphones",
  "productCategory": "Electronics"
}
```

**Response:**
```json
{
  "success": true,
  "suggestions": [
    {
      "title": "Bold Product Shot",
      "visualElements": ["Product close-up", "Vibrant background"],
      "colorScheme": "Blue and white with gold accents",
      "textOverlay": "BEST DEAL TODAY",
      "why": "Creates urgency and highlights the premium nature..."
    }
  ],
  "generatedAt": "2024-04-14T10:30:00.000Z"
}
```

### 4. Generate Script

**URL:** `POST /api/ai/generate-script`

**Request Body:**
```json
{
  "title": "Premium Wireless Headphones",
  "description": "High quality noise cancelling headphones with 40 hour battery",
  "audience": "tech-enthusiasts",
  "duration": "15 minutes"
}
```

**Response:**
```json
{
  "success": true,
  "script": "OPENING:\n\"Hey everyone!...\"\nPRODUCT INTRO:\n\"Today I'm showcasing...\"",
  "generatedAt": "2024-04-14T10:30:00.000Z"
}
```

## Running the Application

### Backend

```bash
cd backend
npm install
npm run dev
```

The server will start on http://localhost:5000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on http://localhost:3000

## Testing the Features

1. **Navigate to AI Features Hub:**
   - From moderator dashboard, click "AI Hub" in the sidebar

2. **Try Title Generator:**
   - Enter a product name
   - Click "Generate Titles"
   - Copy any generated title to clipboard

3. **Try Description Generator:**
   - Enter a title from above
   - Optionally add product details
   - Click "Generate Description"

4. **Try Thumbnail Suggestions:**
   - Enter product title and description
   - Optionally select a product category
   - View 5 design concept suggestions

5. **Try Script Builder:**
   - Enter title and description
   - Select target audience and stream duration
   - Generate script for your live stream

## Rate Limiting & Costs

**Important:** Be aware that OpenAI API calls incur costs:

- **gpt-4o model** costs approximately $0.03 per 1K input tokens and $0.06 per 1K output tokens
- Each feature call uses 1 API request
- For production, consider implementing rate limiting

To implement rate limiting, you can use packages like `express-rate-limit`:

```bash
npm install express-rate-limit
```

Then add to your routes to prevent abuse.

## Error Handling

If you encounter errors:

1. **401 Unauthorized:** Check that Clerk authentication is properly configured
2. **500 Internal Server Error:** Verify `OPENAI_API_KEY` is set correctly in `.env`
3. **Network errors:** Ensure backend and frontend are running and connected
4. **Rate limit errors:** You've hit OpenAI's rate limits - wait before making more requests

## Troubleshooting

### Frontend errors

1. **"NEXT_PUBLIC_API_URL not set"** - The frontend can't find the backend
   - Ensure backend is running on http://localhost:5000
   - Or set `NEXT_PUBLIC_API_URL` environment variable

2. **Components not rendering** - Check that all UI components are available
   - Ensure `@shadcn/ui` components are installed in frontend

### Backend errors

1. **OpenAI API errors** - Check your API key and account balance
2. **Mongoose connection errors** - Ensure MongoDB is running
3. **Port already in use** - Change `PORT` environment variable

## Features Workflow Example

### Typical User Journey:

1. **User opens AI Hub** - Sees all available AI tools
2. **User clicks "Title Generator"** - Navigates to title generation page
3. **User enters product name** - E.g., "Smart Watch"
4. **AI generates 5 titles** - User selects the best one
5. **User navigates to Description Generator** - Uses the generated title
6. **AI generates description** - Based on the title
7. **User goes to Thumbnail Suggestions** - For design inspiration  
8. **User goes to Script Builder** - Generates selling script for the live stream
9. **User goes live** - Uses title, description, thumbnail design, and script from AI

## Next Steps

1. Set up OpenAI API key in `.env`
2. Start backend: `npm run dev` in backend folder
3. Start frontend: `npm run dev` in frontend folder
4. Navigate to moderator dashboard
5. Click "AI Hub" in the sidebar
6. Start generating content!

## Support

For issues with:
- **OpenAI API:** https://platform.openai.com/docs
- **Clerk Authentication:** https://clerk.com/docs
- **Next.js:** https://nextjs.org/docs

## Security Considerations

1. Keep `OPENAI_API_KEY` secret - never share or commit to git
2. Implement rate limiting for production
3. Add request validation on backend
4. Monitor API usage and costs
5. Consider implementing user quotas for enterprise systems

---

**Version:** 1.0.0  
**Last Updated:** April 14, 2026
