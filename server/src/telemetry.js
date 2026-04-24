function logEvent({ db, userId = null, eventName, properties = {}, payload, sessionId }) {
  const props = properties && Object.keys(properties).length ? properties : payload || {};
  const at = new Date().toISOString();
  if (db) {
    db.prepare(
      "INSERT INTO analytics_events (user_id, event_name, properties, session_id, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, eventName, JSON.stringify(props), sessionId || null, at);
  }
  // Stub logger; wire to PostHog/Amplitude/Mixpanel in production.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ at, userId, eventName, payload: props, sessionId: sessionId || null }));
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

function retentionSnapshot(rows) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let d1 = 0;
  let d7 = 0;
  let d30 = 0;
  for (const row of rows) {
    const last = Date.parse(row.last_login || row.updated_at || row.created_at || 0);
    const ageDays = Math.floor((now - last) / dayMs);
    if (ageDays <= 1) d1 += 1;
    if (ageDays <= 7) d7 += 1;
    if (ageDays <= 30) d30 += 1;
  }
  return { d1, d7, d30, population: rows.length };
}

function summarizeRetention(db) {
  const rows = db.prepare("SELECT created_at, updated_at, last_login FROM users").all();
  return retentionSnapshot(rows);
}

module.exports = {
  logEvent,
  variantForUser,
  retentionSnapshot,
  summarizeRetention,
};
