function logEvent({ userId, eventName, payload }) {
  // Stub logger; wire to PostHog/Amplitude/Mixpanel in production.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      userId,
      eventName,
      payload,
    })
  );
}

function variantForUser(userId, testName) {
  // Deterministic assignment for A/B testing.
  const seed = `${testName}:${userId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? "A" : "B";
}

module.exports = {
  logEvent,
  variantForUser,
};
