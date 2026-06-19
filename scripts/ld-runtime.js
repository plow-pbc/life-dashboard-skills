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

module.exports = {
  readTrimmed,
  minuteInTz,
  postKiosk,
  LD_CONFIG_PATH,
  DASH_URL_PATH,
  DASH_TOKEN_PATH,
};
