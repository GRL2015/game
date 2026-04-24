# Precision Art Studio

Precision Art Studio is a small full-stack web app for AI-assisted image generation and editing.

It includes:

- text-to-image generation
- targeted image editing with a drag-to-select region
- add-to-image / outpainting by expanding the canvas
- style transfer / restyling
- custom dimensions for generation
- local tone controls for saturation and warmth
- render history and download support

## Stack

- Node.js
- Express
- Sharp
- plain HTML, CSS, and JavaScript

## How it works

The frontend is a single-page studio in `public/index.html`.

The backend in `server.js` exposes:

- `GET /api/status` - basic health and API-key status
- `POST /api/generate` - prompt-to-image generation
- `POST /api/edit` - edit, restyle, and outpaint flows
- `POST /api/tone` - local PNG tone adjustment for warmth and saturation

For model-backed image generation and edits, the server expects an OpenAI API key and uses the image API through a secure backend proxy so the key is never exposed in the browser.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Add your API key to `.env`:

   ```bash
   OPENAI_API_KEY=your_key_here
   ```

   Optional:

   ```bash
   OPENAI_IMAGE_MODEL=gpt-image-2
   PORT=3000
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open:

   ```text
   http://localhost:3000
   ```

## Development

Run with file watching:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## Deploy

### Render

This repo now includes a `render.yaml` Blueprint and a production `Dockerfile`.

Steps:

1. Push the repo to GitHub.
2. In Render, create a new Blueprint using this repository.
3. When prompted, set:
   - `OPENAI_API_KEY`
4. Deploy.

Render will:

- build from `Dockerfile`
- start the app with `npm start`
- use `GET /health` for health checks

### Docker

Build:

```bash
docker build -t precision-art-studio .
```

Run:

```bash
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e OPENAI_API_KEY=your_key_here \
  precision-art-studio
```

Then open:

```text
http://localhost:3000
```

## Usage notes

### Generate

- Enter a prompt
- Choose a style preset and quality
- Use either automatic sizing or a custom width and height

### Edit part of an image

- Upload a source image
- Switch to **Edit**
- Drag a box over the visible image area
- Describe exactly what should change

### Add to an image

- Upload a source image
- Switch to **Add to image**
- Increase the expansion values on the sides you want to extend
- Describe what should fill the new space

### Change style

- Upload a source image
- Switch to **Style transfer**
- Pick a style preset and optionally add style notes

### Warmth and saturation

The tone controls work locally through Sharp and produce a new PNG without requiring a model call. This is useful for quick finishing adjustments after generation or editing.

## Size rules

Flexible sizes are validated with the following constraints:

- minimum edge: 256px
- both dimensions must be multiples of 16
- maximum edge: 3840px
- maximum aspect ratio: 3:1
- total pixels must stay within the configured supported range

Generated images can use flexible dimensions. Edit and restyle flows stay anchored to the source image dimensions, while outpainting expands the image and keeps the result aligned to the expanded canvas.

## Project structure

```text
.
├── lib/
│   └── image-utils.js
├── public/
│   └── index.html
├── test/
│   ├── image-utils.test.js
│   └── server.test.js
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

## Notes

- The app works without an API key for local tone adjustment and interface testing, but generation and model-backed editing require `OPENAI_API_KEY`.
- The browser UI is intentionally framework-free to keep the project easy to inspect and deploy.
- A lightweight `GET /health` endpoint is included for production health checks.
