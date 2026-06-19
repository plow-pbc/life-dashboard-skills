# life-dashboard-skills

The shared **contract layer** for the life-dashboard producer skills (`ld-*`).

The life-dashboard product runs on two platforms, each installed by its own
SEED:

- **Plow agent seed** — [`seed-life-dashboard-agent`](https://github.com/plow-pbc/seed-life-dashboard-agent) (macOS, plowd marketplace).
- **Hermes agent seed** — [`seed-life-dashboard-hermes-agent`](https://github.com/plow-pbc/seed-life-dashboard-hermes-agent) (Docker Hermes scaffold).

The seven `ld-*` producers are implemented **differently on each platform** —
genuinely, not by drift: a container can't read the Mac's Messages DB (iMessage
triage vs Slack triage), Plow has a deterministic JS scheduled-runner while
Hermes runs LLM cron jobs, and the secret/sandbox models differ (file + stdin
vs env + handoff file). Those producer bodies rightly live in each seed.

What is genuinely **common** — and must stay in lockstep with each other and
with the kiosk viewer — lives here, so a fix lands once:

| Path | What | Why it's shared |
|---|---|---|
| `scripts/post_to_kiosk.py` | The POST helper every producer wrapper calls | One no-redirect, redacting, fail-loud POST core; serves both transports (file-or-env secrets, stdin-or-MESSAGE_FILE message) |
| `scripts/test_post_to_kiosk.py` | Its tests (both transports) | The helper's owner tests it |
| `scripts/ld-runtime.js` | Shared JS runtime helpers (`minuteInTz`, `readTrimmed`, `postKiosk`) for the Plow seed's deterministic scheduled runners | The byte-identical self-gate / trimmed-read / kiosk-POST blocks every JS producer had — one fail-loud, no-redirect POST core, `postKiosk` parameterized by per-producer card fields |
| `scripts/test_ld-runtime.js` | Its tests (Node) | The helper's owner tests it |
| `references/kiosk-protocol.md` | The kiosk wire body, card map, char budget, and the self-contained weather/sports tile HTML | The producer↔viewer contract — the most drift-dangerous artifact |
| `references/config.example.json` | The canonical ld-config template | One config shape across producers + platforms |
| `references/connectors.md` | The plow-connectors data door (connector-based platforms) | One door doc |

## How the seeds consume this

Each seed pulls this repo into its bundle set as `ld-shared` at install time
(and at test time) — it is **not** vendored into the seed's git (the seed
gitignores `ref/team-skills/ld-shared/`). A `ld-*` producer's Python wrapper
imports `post_to_kiosk` from the sibling `ld-shared/scripts/`, and the Plow
seed's JS scheduled runners `require("../../ld-shared/scripts/ld-runtime.js")` —
both resolve against the pulled copy unchanged (`ld-shared` ships as a sibling
skill dir). A fix here reaches both seeds on their next install.

## Test

    just test    # scripts/test_post_to_kiosk.py (both transports) + node --test scripts/test_ld-runtime.js
