# Product context

This is the **shared contract layer** for the life-dashboard `ld-*` producers —
a small product library, NOT a SEED. It is pulled into both
`seed-life-dashboard-agent` (Plow) and `seed-life-dashboard-hermes-agent`
(Hermes) as `ld-shared` at install time. A fix here reaches both platforms.

Operating point (org default):

- **Stage:** pre-PMF, early. Iteration speed > hardening for scale.
- **Userbase:** fewer than 10 households, often a single operator. Abstractions,
  flags, and defensive edge-case handling sized for thousands of users are
  over-engineering here, not robustness.

**What this repo owns:**

- `scripts/post_to_kiosk.py` — the ONE kiosk-POST helper every producer wrapper
  calls, serving both platforms (file-or-env secrets, stdin-or-MESSAGE_FILE
  message). Its security posture is load-bearing: no-redirect opener (no bearer
  forwarding on a 30x), body redaction on `--dry-run`, fixed non-argv secret
  sources, fail-loud on any missing input. Review changes here for that posture.
- `scripts/test_post_to_kiosk.py` — behavior tests for both transports.
- `references/kiosk-protocol.md` — the producer↔viewer wire/tile contract.
- `references/config.example.json`, `references/connectors.md` — shared templates.

**Review emphasis:** because this is consumed by two seeds, a change here that
breaks one platform's transport is the highest-severity bug class. The helper
must keep serving BOTH (Plow: file secrets + stdin; Hermes: env secrets +
MESSAGE_FILE). Prefer subtractive remedies; don't add per-platform branches the
file-first/env-fallback and stdin/MESSAGE_FILE seams already subsume.
