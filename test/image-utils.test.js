const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCreativePrompt,
  normalizeMode,
  normalizeQuality,
  normalizeSizeInput,
  validateFlexibleSize,
} = require("../lib/image-utils");

test("validateFlexibleSize accepts compliant dimensions", () => {
  assert.equal(validateFlexibleSize(1024, 1536), "1024x1536");
  assert.equal(validateFlexibleSize(3840, 2160), "3840x2160");
});

test("validateFlexibleSize rejects invalid dimensions", () => {
  assert.throws(() => validateFlexibleSize(1000, 1000), /multiples of 16/i);
  assert.throws(() => validateFlexibleSize(128, 1024), /at least 256/i);
  assert.throws(() => validateFlexibleSize(4096, 1024), /cannot exceed 3840px/i);
});

test("normalizeSizeInput prefers explicit size and supports auto", () => {
  assert.equal(
    normalizeSizeInput({ size: "1536x1024", allowAuto: true, fallback: "1024x1024" }),
    "1536x1024",
  );
  assert.equal(
    normalizeSizeInput({ size: "auto", allowAuto: true, fallback: "1024x1024" }),
    "auto",
  );
});

test("normalizeSizeInput falls back to numeric width and height", () => {
  assert.equal(
    normalizeSizeInput({ width: 2048, height: 1152, allowAuto: true, fallback: "1024x1024" }),
    "2048x1152",
  );
});

test("normalizeQuality and normalizeMode enforce supported values", () => {
  assert.equal(normalizeQuality("HIGH"), "high");
  assert.equal(normalizeMode("expand"), "expand");
  assert.throws(() => normalizeQuality("ultra"), /quality must be one of/i);
  assert.throws(() => normalizeMode("morph"), /mode must be one of/i);
});

test("buildCreativePrompt includes strict and mode-specific guidance", () => {
  const prompt = buildCreativePrompt({
    prompt: "Turn the cat into a bronze statue in a museum lobby.",
    stylePreset: "editorial",
    styleNotes: "Use dramatic rim lighting.",
    strictMode: true,
    mode: "edit",
  });

  assert.match(prompt, /follow the user's instructions literally/i);
  assert.match(prompt, /edit only the requested parts/i);
  assert.match(prompt, /premium editorial art direction/i);
  assert.match(prompt, /dramatic rim lighting/i);
  assert.match(prompt, /user request: turn the cat into a bronze statue/i);
});
