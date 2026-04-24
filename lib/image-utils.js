const SIZE_LIMITS = {
  maxEdge: 3840,
  minPixels: 655360,
  maxPixels: 8294400,
  maxAspectRatio: 3,
};

const STYLE_PRESETS = {
  none: "",
  photoreal: "Photorealistic image with natural lighting, convincing textures, and realistic materials.",
  anime: "Anime illustration with clean line work, expressive shapes, and polished cel shading.",
  watercolor: "Watercolor painting with soft pigment blooms, paper texture, and hand-painted edges.",
  editorial: "Premium editorial art direction with polished styling and magazine-grade composition.",
  lineart: "Crisp line art with clean outlines and restrained shading.",
  cyberpunk: "Cyberpunk mood with neon lighting, reflective surfaces, and dense futuristic atmosphere.",
  comic: "Graphic comic-book rendering with bold inks, dynamic contrast, and halftone energy.",
  minimal: "Minimalist graphic aesthetic with clean geometry, simple forms, and restrained color.",
  render3d: "High-end 3D render with cinematic lighting, detailed materials, and depth-rich composition.",
};

const QUALITY_OPTIONS = new Set(["auto", "low", "medium", "high"]);
const MODE_OPTIONS = new Set(["generate", "edit", "restyle", "expand"]);

function assertNonEmptyText(value, label) {
  if (typeof value !== "string" || value.trim().length < 3) {
    throw new Error(`${label} must be at least 3 characters long.`);
  }

  return value.trim();
}

function normalizeQuality(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "medium";

  if (!QUALITY_OPTIONS.has(normalized)) {
    throw new Error("Quality must be one of auto, low, medium, or high.");
  }

  return normalized;
}

function normalizeMode(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "generate";

  if (!MODE_OPTIONS.has(normalized)) {
    throw new Error("Mode must be one of generate, edit, restyle, or expand.");
  }

  return normalized;
}

function parseSizeString(value) {
  if (typeof value !== "string") {
    throw new Error("Size must be a string.");
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "auto") {
    return { width: null, height: null, label: "auto" };
  }

  const match = /^(\d{2,5})x(\d{2,5})$/.exec(normalized);

  if (!match) {
    throw new Error("Size must use the WIDTHxHEIGHT format or auto.");
  }

  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
    label: normalized,
  };
}

function validateFlexibleSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error("Image width and height must be integers.");
  }

  if (width < 256 || height < 256) {
    throw new Error("Image dimensions must be at least 256 pixels.");
  }

  if (width % 16 !== 0 || height % 16 !== 0) {
    throw new Error("Image dimensions must be multiples of 16.");
  }

  if (Math.max(width, height) > SIZE_LIMITS.maxEdge) {
    throw new Error(`Image dimensions cannot exceed ${SIZE_LIMITS.maxEdge}px on either edge.`);
  }

  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > SIZE_LIMITS.maxAspectRatio) {
    throw new Error(`Image aspect ratio cannot exceed ${SIZE_LIMITS.maxAspectRatio}:1.`);
  }

  const pixels = width * height;
  if (pixels < SIZE_LIMITS.minPixels || pixels > SIZE_LIMITS.maxPixels) {
    throw new Error(
      `Image area must stay between ${SIZE_LIMITS.minPixels.toLocaleString()} and ${SIZE_LIMITS.maxPixels.toLocaleString()} pixels.`,
    );
  }

  return `${width}x${height}`;
}

function normalizeSizeInput({ size, width, height, allowAuto = true, fallback = "1024x1024" } = {}) {
  if (typeof size === "string" && size.trim() !== "") {
    const parsed = parseSizeString(size);

    if (parsed.label === "auto") {
      if (!allowAuto) {
        throw new Error("Automatic sizing is not supported for this action.");
      }

      return "auto";
    }

    return validateFlexibleSize(parsed.width, parsed.height);
  }

  if (width == null && height == null) {
    return fallback;
  }

  if (!Number.isFinite(Number(width)) || !Number.isFinite(Number(height))) {
    throw new Error("Width and height must both be provided.");
  }

  return validateFlexibleSize(Number(width), Number(height));
}

function getStyleInstruction(stylePreset, styleNotes = "") {
  const presetInstruction = STYLE_PRESETS[stylePreset] || "";
  const noteInstruction = typeof styleNotes === "string" ? styleNotes.trim() : "";

  return [presetInstruction, noteInstruction].filter(Boolean).join(" ");
}

function buildCreativePrompt({ prompt, stylePreset = "none", styleNotes = "", strictMode = true, mode = "generate" }) {
  const modeInstruction = normalizeMode(mode);
  const userPrompt = assertNonEmptyText(prompt, "Prompt");
  const styleInstruction = getStyleInstruction(stylePreset, styleNotes);
  const sections = [];

  if (strictMode) {
    sections.push(
      "Follow the user's instructions literally. Preserve every explicit request about subject matter, count, colors, text, framing, lighting, camera angle, and overall intent. Do not add unrelated elements.",
    );
  }

  if (modeInstruction === "generate") {
    sections.push("Create one finished image from scratch.");
  } else if (modeInstruction === "edit") {
    sections.push(
      "Edit only the requested parts of the image. Preserve unmentioned people, objects, composition, perspective, and lighting as much as possible.",
    );
  } else if (modeInstruction === "restyle") {
    sections.push(
      "Preserve the composition, layout, and identity of the input image while changing the rendering style as requested.",
    );
  } else if (modeInstruction === "expand") {
    sections.push(
      "Extend the image seamlessly beyond its current borders while keeping the existing content intact and visually continuous.",
    );
  }

  if (styleInstruction) {
    sections.push(`Stylistic direction: ${styleInstruction}`);
  }

  sections.push(`User request: ${userPrompt}`);
  return sections.join("\n\n");
}

module.exports = {
  MODE_OPTIONS,
  QUALITY_OPTIONS,
  SIZE_LIMITS,
  STYLE_PRESETS,
  assertNonEmptyText,
  buildCreativePrompt,
  getStyleInstruction,
  normalizeMode,
  normalizeQuality,
  normalizeSizeInput,
  parseSizeString,
  validateFlexibleSize,
};
