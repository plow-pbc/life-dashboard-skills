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
