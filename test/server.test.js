const test = require("node:test");
const assert = require("node:assert/strict");

const sharp = require("sharp");

const {
  applyToneAdjustments,
  buildSelectionMask,
  decodeImageDataUrl,
  expandImageForOutpaint,
  normalizeSelection,
  normalizeToneValue,
  startServer,
} = require("../server");

test("decodeImageDataUrl accepts PNG data URLs", async () => {
  const png = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

  const decoded = decodeImageDataUrl(dataUrl);

  assert.equal(Buffer.compare(decoded, png), 0);
});

test("normalizeSelection clamps width and height inside bounds", () => {
  const selection = normalizeSelection({
    x: 0.7,
    y: 0.8,
    width: 0.7,
    height: 0.5,
  });

  assert.equal(selection.x, 0.7);
  assert.equal(selection.y, 0.8);
  assert.ok(Math.abs(selection.width - 0.3) < Number.EPSILON);
  assert.ok(Math.abs(selection.height - 0.2) < Number.EPSILON);
});

test("buildSelectionMask makes selected region transparent", async () => {
  const buffer = await buildSelectionMask({
    width: 10,
    height: 10,
    selection: {
      x: 0.2,
      y: 0.2,
      width: 0.4,
      height: 0.4,
    },
  });

  const pixels = await sharp(buffer).raw().toBuffer();
  const insideAlpha = pixels[(3 * 10 + 3) * 4 + 3];
  const outsideAlpha = pixels[(0 * 10 + 0) * 4 + 3];

  assert.equal(insideAlpha, 0);
  assert.equal(outsideAlpha, 255);
});

test("expandImageForOutpaint grows canvas and returns same-size mask", async () => {
  const source = await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 4,
      background: { r: 10, g: 20, b: 30, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const expanded = await expandImageForOutpaint(source, {
    top: 16,
    right: 32,
    bottom: 16,
    left: 32,
  });

  const expandedMeta = await sharp(expanded.buffer).metadata();
  const maskMeta = await sharp(expanded.maskBuffer).metadata();

  assert.equal(expandedMeta.width, 96);
  assert.equal(expandedMeta.height, 56);
  assert.equal(maskMeta.width, 96);
  assert.equal(maskMeta.height, 56);
});

test("applyToneAdjustments preserves dimensions", async () => {
  const source = await sharp({
    create: {
      width: 20,
      height: 20,
      channels: 4,
      background: { r: 100, g: 120, b: 140, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const adjusted = await applyToneAdjustments(source, {
    saturation: 150,
    warmth: 45,
  });

  const meta = await sharp(adjusted).metadata();
  assert.equal(meta.width, 20);
  assert.equal(meta.height, 20);
});

test("normalizeToneValue enforces bounds", () => {
  assert.equal(
    normalizeToneValue("150", {
      label: "Saturation",
      min: 0,
      max: 200,
      fallback: 100,
    }),
    150,
  );

  assert.throws(
    () =>
      normalizeToneValue(300, {
        label: "Warmth",
        min: -100,
        max: 100,
        fallback: 0,
      }),
    /between -100 and 100/,
  );
});

test("status route responds without an API key", async () => {
  const server = startServer(0);

  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/status`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(typeof payload.hasApiKey, "boolean");
    assert.equal(typeof payload.defaultModel, "string");
  } finally {
    await closeServer(server);
  }
});

function once(emitter, eventName) {
  return new Promise((resolve, reject) => {
    emitter.once(eventName, resolve);
    emitter.once("error", reject);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
