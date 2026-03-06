# FloorPlanAI

Convert natural language house descriptions into conceptual architectural floor plans — instantly.

Built with React + Vite + Vercel Serverless Functions + Claude API.

---

## Features

- 📝 Natural language input → floor plan layout
- 🏠 Canvas-rendered architectural plan with room labels, dimensions, doors & windows
- 📐 Room schedule with square footage breakdown
- ↓ Export as PNG or JSON
- 🔒 API key kept secret via Vercel serverless function

---

## Project Structure

```
floorplanai/
├── api/
│   └── generate.js        # Vercel serverless function (keeps API key secret)
├── src/
│   ├── main.jsx           # React entry point
│   ├── App.jsx            # Main UI component
│   └── FloorPlanCanvas.jsx # Canvas renderer
├── index.html
├── vite.config.js
├── vercel.json
├── package.json
└── .env.example
```

---

## Quick Deploy to Vercel (recommended)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: FloorPlanAI"
git remote add origin https://github.com/YOUR_USERNAME/floorplanai.git
git push -u origin main
```

### 2. Import into Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework: **Vite** (auto-detected)
4. Add Environment Variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (your key from [console.anthropic.com](https://console.anthropic.com))
5. Click **Deploy** ✅

That's it. Vercel auto-detects the `api/` folder and deploys `generate.js` as a serverless edge function.

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# Install Vercel CLI for local API simulation
npm install -g vercel

# Run locally (simulates Vercel edge functions)
vercel dev
```

The app will be available at `http://localhost:3000`

> **Note:** `vercel dev` is needed to run the `/api/generate` serverless function locally. Plain `npm run dev` will run the frontend but API calls will fail without the Vercel CLI proxy.

---

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key. Set in Vercel dashboard under Settings → Environment Variables. Never commit this. |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Rendering | HTML5 Canvas |
| Backend | Vercel Edge Functions (Node.js) |
| AI | Claude claude-sonnet-4-20250514 via Anthropic API |
| Deploy | Vercel |

---

## Extending

- **Drag-to-edit rooms**: Add React state for selected room + mouse event handlers on canvas
- **Multi-floor**: Extend JSON schema with a `floor` field per room + tab UI to switch levels
- **CAD export**: Convert room coordinates to DXF format using the `dxf-writer` npm package
- **Regenerate**: Add a "Regenerate" button that sends the same prompt again
- **Style themes**: Add a selector for architectural styles (modern, craftsman, colonial) injected into the system prompt

---

## License

MIT
