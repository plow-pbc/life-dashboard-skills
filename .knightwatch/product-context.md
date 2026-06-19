# Product context

This is the **shared contract layer** for the life-dashboard `ld-*` producers —
a small product library, NOT a SEED. It is pulled into both
`seed-life-dashboard-agent` (Plow) and `seed-life-dashboard-hermes-agent`
(Hermes) as `ld-shared` at install time, so a fix here reaches both platforms.
(Operating point + review emphasis: see `review-priority.md`.)

**What this repo owns:**

- `scripts/post_to_kiosk.py` — the ONE kiosk-POST helper every producer wrapper
  calls, serving both platforms (file-or-env secrets, stdin-or-MESSAGE_FILE
  message). Its security posture is load-bearing: no-redirect opener (no bearer
  forwarding on a 30x), body redaction on `--dry-run`, fixed non-argv secret
  sources, fail-loud on any missing input.
- `scripts/test_post_to_kiosk.py` — behavior tests for both transports.
- `scripts/ld_config_gate.py` — the ONE structural gate defining a valid
  ld-config; both seeds gate install + verify on it (the Pi needs no jq).
- `scripts/test_ld_config_gate.py` — its jq-equivalence tests.
- `references/kiosk-protocol.md` — the producer↔viewer wire/tile contract.
- `references/config.example.json`, `references/connectors.md` — shared templates.
