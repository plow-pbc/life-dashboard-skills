"use strict";

// Shared runtime helpers for the JS scheduled producers (ld-calendar-nudge,
// ld-sports, ld-weather, …). These three blocks were byte-identical across
// every producer's run.js (the `NOTE (rule-of-3)` markers tracked the drift
// risk); they live here so a fix lands once and rides the `ld-shared` bundle to
// the runtime, where producers `require("../../ld-shared/scripts/ld-runtime.js")`.
//
// Producer-specific logic (per-skill `log` prefix, gate windows, the
// fetch<Source> calls) stays in each run.js — only the genuinely-shared seams
// are here.

// Read a config/secret file and trim trailing whitespace. The /config/secrets
// and /config/gateway mounts are the canonical file-first source.
async function readTrimmed(readFile, path) {
  return (await readFile(path, "utf8")).trim();
}

// Wall-clock minute (0-59) in `tz`. Used by the self-gates; computed in the
// family timezone so a producer's cadence is correct even on a UTC gateway. A
// valid tz always yields a `minute` part (an invalid tz throws at construction),
// so we read it directly — no gateway-local fallback that would silently move
// the gate off the family timezone.
function minuteInTz(now, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    minute: "2-digit",
  }).formatToParts(now);
  return parseInt(parts.find((p) => p.type === "minute").value, 10);
}

// POST a rendered tile to the kiosk. `cardFields` carries the per-producer
// wire fields (card slot + tile type, plus an optional title) — `text` is
// merged in here so every producer shares the URL guard, auth header,
// redirect handling, and status check.
async function postKiosk(fetchImpl, dashUrl, dashToken, text, cardFields) {
  // The Pi backend rides the household LAN/tailnet, not the public internet —
  // http:// is an accepted trade-off for that trust zone.
  if (!dashUrl.startsWith("http://") && !dashUrl.startsWith("https://")) {
    throw new Error("kiosk POST: dashboard URL must be http(s)://");
  }
  const resp = await fetchImpl(dashUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${dashToken}`, "Content-Type": "application/json" },
    redirect: "error", // never forward the bearer to a 3xx target
    body: JSON.stringify({ ...cardFields, text }),
  });
  if (!resp.ok) throw new Error(`kiosk POST ${resp.status}`);
}

// Shared /config mount paths every producer reads (producer-specific paths,
// e.g. calendar's plow-api-url/token, stay local to that producer).
const LD_CONFIG_PATH = "/config/runtime/ld/config.json";
const DASH_URL_PATH = "/config/secrets/dashboard-endpoint-url";
const DASH_TOKEN_PATH = "/config/secrets/dashboard-token";

// Build a producer's stderr logger. Every scheduled producer logged with the
// identical `[<slug>] message {json}` shape, differing only by the prefix — this
// factory collapses those copies. `fields` is always a small plain object, so
// JSON.stringify is not guarded (fail-fast on a non-serializable payload).
function makeLog(slug) {
  return (message, fields) =>
    console.error(`[${slug}] ${message}${fields ? " " + JSON.stringify(fields) : ""}`);
}

// Read + validate the shared ld-config: the file (or `opts.config` for tests)
// plus the required `family.timezone` every producer self-gates on. Producers
// read their own sections (weather.*, sports.*, calendar.*) off the returned
// config; only the load + the universal timezone check are shared here.
async function loadLdConfig(readFile, opts = {}) {
  const config = opts.config ?? JSON.parse(await readFile(LD_CONFIG_PATH, "utf8"));
  const timezone = config?.family?.timezone;
  // Validate by constructing Intl.DateTimeFormat — the authoritative check. It
  // rejects missing/blank AND any non-IANA value (a typo'd tz), so minuteInTz
  // (every producer's self-gate) can never crash on it downstream. A non-string
  // is caught explicitly first, because Intl treats an undefined timeZone as the
  // system default (it would NOT throw).
  try {
    if (typeof timezone !== "string") throw new Error("not a string");
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error("family.timezone missing or not a valid IANA timezone in /config/runtime/ld/config.json");
  }
  return { config, timezone };
}

// Post a card to the kiosk BEST-EFFORT: read the dashboard secrets (from `opts`
// in tests, else the /config mount), POST via postKiosk, and on any *kiosk POST*
// failure (offline Pi, non-200, misconfigured URL) log `kiosk_post_failed` and
// return false instead of throwing. The household screen is a Pi that is often
// offline (unplugged / off-network while traveling) and must never crash a
// scheduled producer; a producer with a second surface (calendar-nudge →
// iMessage) also relies on this not aborting the run. Returns true on a
// successful post. The secret reads are deliberately OUTSIDE the guard: a
// missing/unreadable local /config secret is a genuine install error and fails
// loud (fail-fast), unlike a transient offline Pi.
async function postKioskCard(fetchImpl, readFile, text, cardFields, log, opts = {}) {
  const dashUrl = opts.dashUrl ?? (await readTrimmed(readFile, DASH_URL_PATH));
  const dashToken = opts.dashToken ?? (await readTrimmed(readFile, DASH_TOKEN_PATH));
  try {
    await postKiosk(fetchImpl, dashUrl, dashToken, text, cardFields);
    return true;
  } catch (err) {
    log("kiosk_post_failed", { error: String((err && err.message) || err) });
    return false;
  }
}

module.exports = {
  readTrimmed,
  minuteInTz,
  postKiosk,
  makeLog,
  loadLdConfig,
  postKioskCard,
  LD_CONFIG_PATH,
  DASH_URL_PATH,
  DASH_TOKEN_PATH,
};
