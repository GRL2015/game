require("dotenv").config();

const path = require("node:path");

const express = require("express");
const sharp = require("sharp");

const {
  buildCreativePrompt,
  normalizeMode,
  normalizeQuality,
  normalizeSizeInput,
} = require("./lib/image-utils");

const app = express();

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const OUTPUT_FORMAT = "png";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

app.use(express.json({ limit: "35mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", (_request, response) => {
  response.json({
    ok: true,
    hasApiKey: Boolean(OPENAI_API_KEY),
    defaultModel: DEFAULT_MODEL,
  });
});

app.get("/health", (_request, response) => {
  response.status(200).json({
    ok: true,
  });
});

app.post("/api/generate", async (request, response) => {
  try {
    ensureApiKey();

    const prompt = buildCreativePrompt({
      prompt: request.body.prompt,
      stylePreset: request.body.stylePreset,
      styleNotes: request.body.styleNotes,
      strictMode: request.body.strictMode !== false,
      mode: "generate",
    });

    const quality = normalizeQuality(request.body.quality);
    const size = normalizeSizeInput({
      size: request.body.size,
      width: request.body.width,
      height: request.body.height,
      allowAuto: true,
      fallback: "1024x1024",
    });

    const payload = await createImageGeneration({
      prompt,
      quality,
      size,
    });

    response.json({
      ok: true,
      imageDataUrl: toDataUrl(payload.base64),
      resolvedPrompt: prompt,
      model: payload.model,
      size: payload.size,
      quality,
    });
  } catch (error) {
    handleError(response, error);
  }
});

app.post("/api/edit", async (request, response) => {
  try {
    ensureApiKey();

    const mode = normalizeMode(request.body.mode || "edit");
    const quality = normalizeQuality(request.body.quality);
    const source = await normalizeSourceImage(
      decodeImageDataUrl(request.body.imageDataUrl),
    );

    let imageBuffer = source.buffer;
    let maskBuffer = null;
    let outputSize = request.body.size || `${source.width}x${source.height}`;

    if (mode === "expand") {
      const expansion = normalizeExpansion(request.body.expansion);
      const expanded = await expandImageForOutpaint(source.buffer, expansion);
      imageBuffer = expanded.buffer;
      maskBuffer = expanded.maskBuffer;
      outputSize = `${expanded.width}x${expanded.height}`;
    } else if (request.body.selection) {
      const selection = normalizeSelection(request.body.selection);
      maskBuffer = await buildSelectionMask({
        width: source.width,
        height: source.height,
        selection,
      });
    }

    const prompt = buildCreativePrompt({
      prompt: request.body.prompt,
      stylePreset: request.body.stylePreset,
      styleNotes: request.body.styleNotes,
      strictMode: request.body.strictMode !== false,
      mode,
    });

    const size = normalizeSizeInput({
      size: outputSize,
      allowAuto: true,
      fallback: `${source.width}x${source.height}`,
    });

    const payload = await createImageEdit({
      prompt,
      quality,
      size,
      imageBuffer,
      maskBuffer,
    });

    response.json({
      ok: true,
      imageDataUrl: toDataUrl(payload.base64),
      resolvedPrompt: prompt,
      model: payload.model,
      size,
      quality,
    });
  } catch (error) {
    handleError(response, error);
  }
});

app.post("/api/tone", async (request, response) => {
  try {
    const source = await normalizeSourceImage(
      decodeImageDataUrl(request.body.imageDataUrl),
    );
    const saturation = normalizeToneValue(request.body.saturation, {
      label: "Saturation",
      min: 0,
      max: 200,
      fallback: 100,
    });
    const warmth = normalizeToneValue(request.body.warmth, {
      label: "Warmth",
      min: -100,
      max: 100,
      fallback: 0,
    });
    const adjusted = await applyToneAdjustments(source.buffer, {
      saturation,
      warmth,
    });

    response.json({
      ok: true,
      imageDataUrl: `data:image/png;base64,${adjusted.toString("base64")}`,
      size: `${source.width}x${source.height}`,
      saturation,
      warmth,
    });
  } catch (error) {
    handleError(response, error);
  }
});

app.use((request, response, next) => {
  if (request.path.startsWith("/api/")) {
    next();
    return;
  }

  response.sendFile(path.join(__dirname, "public", "index.html"));
});

function startServer(port = PORT) {
  const server = app.listen(port, () => {
    console.log(`Precision Art Studio listening on http://localhost:${port}`);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  return server;
}

if (require.main === module) {
  startServer();
}

function ensureApiKey() {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured. Add it to your environment or .env file.");
  }
}

function handleError(response, error) {
  const message = error instanceof Error ? error.message : "Unknown server error.";
  const statusCode = /not configured|must|invalid|required|small|large|empty|between|supported/i.test(message)
    ? 400
    : 500;

  response.status(statusCode).json({
    ok: false,
    error: message,
  });
}

function toDataUrl(base64Payload) {
  return `data:image/${OUTPUT_FORMAT};base64,${base64Payload}`;
}

function decodeImageDataUrl(dataUrl) {
  if (typeof dataUrl !== "string" || dataUrl.length === 0) {
    throw new Error("An input image is required.");
  }

  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Image upload must use a valid data URL.");
  }

  const mimeType = match[1].toLowerCase();
  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
    throw new Error("Only PNG, JPEG, and WebP images are supported.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Uploaded image is empty or exceeds the 25MB limit.");
  }

  return buffer;
}

async function normalizeSourceImage(buffer) {
  const image = sharp(buffer, { failOn: "warning" }).rotate().ensureAlpha();
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read the uploaded image dimensions.");
  }

  return {
    buffer: await image.png().toBuffer(),
    width: metadata.width,
    height: metadata.height,
  };
}

function normalizeSelection(selection) {
  const normalized = {
    x: Number(selection?.x),
    y: Number(selection?.y),
    width: Number(selection?.width),
    height: Number(selection?.height),
  };

  for (const [key, value] of Object.entries(normalized)) {
    if (!Number.isFinite(value)) {
      throw new Error(`Selection ${key} must be a number.`);
    }
  }

  if (
    normalized.width <= 0 ||
    normalized.height <= 0 ||
    normalized.x < 0 ||
    normalized.y < 0 ||
    normalized.x > 1 ||
    normalized.y > 1
  ) {
    throw new Error("Selection values must be normalized between 0 and 1.");
  }

  normalized.width = Math.min(normalized.width, 1 - normalized.x);
  normalized.height = Math.min(normalized.height, 1 - normalized.y);

  if (normalized.width < 0.01 || normalized.height < 0.01) {
    throw new Error("Selection area is too small. Drag a larger rectangle.");
  }

  return normalized;
}

function normalizeToneValue(value, { label, min, max, fallback }) {
  const numeric = value == null || value === "" ? fallback : Number(value);

  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }

  return numeric;
}

function buildSelectionMask({ width, height, selection }) {
  const mask = Buffer.alloc(width * height * 4, 255);
  const left = Math.max(0, Math.floor(selection.x * width));
  const top = Math.max(0, Math.floor(selection.y * height));
  const right = Math.min(width, Math.ceil((selection.x + selection.width) * width));
  const bottom = Math.min(height, Math.ceil((selection.y + selection.height) * height));

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * width + x) * 4;
      mask[index] = 255;
      mask[index + 1] = 255;
      mask[index + 2] = 255;
      mask[index + 3] = 0;
    }
  }

  return sharp(mask, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function normalizeExpansion(expansion) {
  const values = {
    top: Number.parseInt(expansion?.top ?? 0, 10),
    right: Number.parseInt(expansion?.right ?? 0, 10),
    bottom: Number.parseInt(expansion?.bottom ?? 0, 10),
    left: Number.parseInt(expansion?.left ?? 0, 10),
  };

  for (const [key, value] of Object.entries(values)) {
    if (!Number.isInteger(value) || value < 0 || value > 2048) {
      throw new Error(`Expansion ${key} must be an integer between 0 and 2048.`);
    }
  }

  if (values.top + values.right + values.bottom + values.left === 0) {
    throw new Error("Add at least one expansion amount to extend the image.");
  }

  return values;
}

async function expandImageForOutpaint(sourceBuffer, expansion) {
  const source = sharp(sourceBuffer);
  const metadata = await source.metadata();
  const width = (metadata.width || 0) + expansion.left + expansion.right;
  const height = (metadata.height || 0) + expansion.top + expansion.bottom;

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read source image size for expansion.");
  }

  if (width > 3840 || height > 3840) {
    throw new Error("Expanded image exceeds the 3840px edge limit. Reduce the expansion values.");
  }

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: sourceBuffer,
        left: expansion.left,
        top: expansion.top,
      },
    ])
    .png()
    .toBuffer();

  const mask = Buffer.alloc(width * height * 4, 255);

  for (let y = expansion.top; y < expansion.top + metadata.height; y += 1) {
    for (let x = expansion.left; x < expansion.left + metadata.width; x += 1) {
      const index = (y * width + x) * 4;
      mask[index] = 255;
      mask[index + 1] = 255;
      mask[index + 2] = 255;
      mask[index + 3] = 255;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isOriginalContent =
        x >= expansion.left &&
        x < expansion.left + metadata.width &&
        y >= expansion.top &&
        y < expansion.top + metadata.height;

      if (!isOriginalContent) {
        const index = (y * width + x) * 4;
        mask[index] = 255;
        mask[index + 1] = 255;
        mask[index + 2] = 255;
        mask[index + 3] = 0;
      }
    }
  }

  const maskBuffer = await sharp(mask, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  return {
    buffer,
    maskBuffer,
    width,
    height,
  };
}

async function applyToneAdjustments(sourceBuffer, { saturation, warmth }) {
  let pipeline = sharp(sourceBuffer, { failOn: "warning" }).ensureAlpha();

  if (saturation !== 100) {
    pipeline = pipeline.modulate({
      saturation: saturation / 100,
    });
  }

  if (warmth !== 0) {
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not read image dimensions for tone adjustment.");
    }

    const intensity = Math.abs(warmth) / 100;
    const overlayColor =
      warmth > 0
        ? {
            r: 255,
            g: 165,
            b: 74,
            alpha: 0.18 * intensity,
          }
        : {
            r: 70,
            g: 155,
            b: 255,
            alpha: 0.16 * intensity,
          };
    const overlay = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 4,
        background: overlayColor,
      },
    })
      .png()
      .toBuffer();

    pipeline = pipeline
      .composite([
        {
          input: overlay,
          blend: "soft-light",
        },
      ])
      .modulate({
        brightness: warmth > 0 ? 1 + intensity * 0.06 : 1 - intensity * 0.03,
      });
  }

  return pipeline.png().toBuffer();
}

async function createImageGeneration({ prompt, quality, size }) {
  const model = DEFAULT_MODEL;
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      quality,
      size,
      output_format: OUTPUT_FORMAT,
    }),
  });

  return parseOpenAiImageResponse(response, model, size);
}

async function createImageEdit({ prompt, quality, size, imageBuffer, maskBuffer }) {
  const model = DEFAULT_MODEL;
  const form = new FormData();

  form.set("model", model);
  form.set("prompt", prompt);
  form.set("quality", quality);
  form.set("size", size);
  form.set(
    "image",
    new File([imageBuffer], "source.png", {
      type: "image/png",
    }),
  );

  if (maskBuffer) {
    form.set(
      "mask",
      new File([maskBuffer], "mask.png", {
        type: "image/png",
      }),
    );
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
  });

  return parseOpenAiImageResponse(response, model, size);
}

async function parseOpenAiImageResponse(response, model, size) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Image request failed.");
  }

  const base64 = payload?.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error("The image API returned an empty image payload.");
  }

  return {
    base64,
    model,
    size,
  };
}

module.exports = {
  app,
  applyToneAdjustments,
  buildSelectionMask,
  decodeImageDataUrl,
  expandImageForOutpaint,
  normalizeExpansion,
  normalizeSelection,
  normalizeSourceImage,
  normalizeToneValue,
  startServer,
};
