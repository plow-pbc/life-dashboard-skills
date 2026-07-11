"use strict";

// Tests for ld-runtime.js — the shared JS helpers every scheduled producer
// pulls as ld-shared. Behavior the producers depend on: minute-in-tz for the
// self-gate, trimmed file reads, and the kiosk POST wire contract (URL guard,
// bearer header, redirect:error, status check, merged card fields + text).

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  readTrimmed,
  minuteInTz,
  postKiosk,
  makeLog,
  loadLdConfig,
  postKioskCard,
  LD_CONFIG_PATH,
  DASH_URL_PATH,
  DASH_TOKEN_PATH,
} = require("./ld-runtime.js");

test("readTrimmed strips trailing whitespace from the file body", async () => {
  const fakeRead = async (path, enc) => {
    assert.equal(path, "/x");
    assert.equal(enc, "utf8");
    return "  tok-value\n\n";
  };
  assert.equal(await readTrimmed(fakeRead, "/x"), "tok-value");
});

test("minuteInTz returns the wall-clock minute in the given timezone", () => {
  // 2026-01-01T12:34:00Z → minute 34 regardless of tz offset.
  const now = new Date("2026-01-01T12:34:00Z");
  assert.equal(minuteInTz(now, "America/Los_Angeles"), 34);
  assert.equal(minuteInTz(now, "UTC"), 34);
});

test("postKiosk merges cardFields (incl. extras like title) + text and sends the bearer", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200 };
  };
  await postKiosk(fetchImpl, "http://kiosk.lan", "tok", "hi there", { card: "5", type: "sports", title: "" });

  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, "http://kiosk.lan");
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, "Bearer tok");
  assert.equal(init.redirect, "error"); // never forward the bearer to a 3xx
  const body = JSON.parse(init.body);
  // Every cardField (card/type and any extra like title) is merged with text.
  assert.deepEqual(body, { card: "5", type: "sports", title: "", text: "hi there" });
});

test("postKiosk rejects a non-http(s) dashboard URL", async () => {
  const fetchImpl = async () => assert.fail("must not POST to a bad-scheme URL");
  await assert.rejects(
    () => postKiosk(fetchImpl, "file:///etc/passwd", "t", "x", { card: "1", type: "alert" }),
    /must be http\(s\)/,
  );
});

test("postKiosk throws on a non-ok response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => postKiosk(fetchImpl, "http://k", "t", "x", { card: "3", type: "weather" }),
    /kiosk POST 503/,
  );
});

test("shared config-mount path constants", () => {
  assert.equal(LD_CONFIG_PATH, "/config/runtime/ld/config.json");
  assert.equal(DASH_URL_PATH, "/config/secrets/dashboard-endpoint-url");
  assert.equal(DASH_TOKEN_PATH, "/config/secrets/dashboard-token");
});

test("makeLog prefixes with the producer slug and serializes fields", () => {
  const lines = [];
  const orig = console.error;
  console.error = (s) => lines.push(s);
  try {
    const log = makeLog("ld-weather");
    log("weather_posted");
    log("kiosk_post_failed", { error: "boom" });
  } finally {
    console.error = orig;
  }
  assert.equal(lines[0], "[ld-weather] weather_posted");
  assert.equal(lines[1], '[ld-weather] kiosk_post_failed {"error":"boom"}');
});

test("loadLdConfig returns config + timezone from opts.config (no file read)", async () => {
  const { config, timezone } = await loadLdConfig(
    async () => assert.fail("must not read a file when opts.config is given"),
    { config: { family: { timezone: "America/Los_Angeles" }, weather: { lat: 1 } } },
  );
  assert.equal(timezone, "America/Los_Angeles");
  assert.equal(config.weather.lat, 1);
});

test("loadLdConfig reads + parses the mounted config file when opts.config is absent", async () => {
  const { timezone } = await loadLdConfig(async (path, enc) => {
    assert.equal(path, LD_CONFIG_PATH);
    assert.equal(enc, "utf8");
    return JSON.stringify({ family: { timezone: "UTC" } });
  });
  assert.equal(timezone, "UTC");
});

test("loadLdConfig throws when family.timezone is missing/blank", async () => {
  // loadLdConfig validates via Intl.DateTimeFormat, so it rejects missing, blank,
  // whitespace-only, AND a non-IANA value (a typo'd tz that would otherwise crash
  // minuteInTz downstream).
  for (const bad of [
    {},
    { family: {} },
    { family: { timezone: "" } },
    { family: { timezone: "   " } },
    { family: { timezone: "Not/AZone" } },
    { family: { timezone: 5 } },
  ]) {
    await assert.rejects(() => loadLdConfig(async () => "", { config: bad }), /family\.timezone/);
  }
});

test("postKioskCard posts the card best-effort and returns true on success", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
  const logs = [];
  const ok = await postKioskCard(
    fetchImpl, async () => assert.fail("secrets come from opts here"),
    "hello", { card: "3", type: "weather" }, (m, f) => logs.push([m, f]),
    { dashUrl: "http://kiosk.lan", dashToken: "tok" },
  );
  assert.equal(ok, true);
  assert.equal(logs.length, 0);
  assert.equal(JSON.parse(calls[0].init.body).text, "hello");
});

// The load-bearing behavior: an offline Pi (fetch throws) or a 5xx must NOT
// throw — the producer keeps running (calendar-nudge still iMessages; weather/
// sports just log and exit clean instead of crashing the scheduled runner).
test("postKioskCard logs + returns false (never throws) when the kiosk fails", async () => {
  for (const outcome of [
    () => { throw new TypeError("fetch failed"); }, // offline Pi (UND_ERR_CONNECT_TIMEOUT)
    () => ({ ok: false, status: 503 }),             // Pi up but erroring
  ]) {
    const logs = [];
    const ok = await postKioskCard(
      outcome, async () => assert.fail("opts secrets"),
      "x", { card: "5", type: "sports" }, (m, f) => logs.push([m, f]),
      { dashUrl: "http://k", dashToken: "t" },
    );
    assert.equal(ok, false);
    assert.equal(logs[0][0], "kiosk_post_failed");
    assert.ok(logs[0][1].error);
  }
});

test("postKioskCard reads dashboard secrets from the /config mount when not in opts", async () => {
  const reads = [];
  const readFile = async (path) => {
    reads.push(path);
    return path.endsWith("dashboard-token") ? "tok\n" : "http://kiosk.lan\n";
  };
  const calls = [];
  const ok = await postKioskCard(
    async (url, init) => { calls.push({ url, init }); return { ok: true }; },
    readFile, "hi", { card: "1", type: "alert", title: "" }, () => {},
  );
  assert.equal(ok, true);
  assert.deepEqual(reads.sort(), [DASH_TOKEN_PATH, DASH_URL_PATH].sort());
  assert.equal(calls[0].url, "http://kiosk.lan");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok");
});
