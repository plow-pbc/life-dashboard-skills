# Data access on connector-based platforms — the plow-connectors door

This applies to producers running on a platform WITHOUT native Plow data tools
(e.g. the Hermes agent seed). On the Plow agent seed, producers read external
data through Plow's own tools instead and ignore this door.

All ld- producers on a connector-based platform read external data through ONE
helper installed by seed-hermes-plow's install_connectors.sh:

    python3 /opt/data/skills/plow-connectors/plow_connector.py <connector> <action> '<json>'

- `<connector>` is `gmail` or `slack`. Google Calendar actions live under the
  `gmail` connector (`calendar.events.list`, `calendar.list`,
  `calendar.freebusy`).
- `status` is the only GET; every other action takes a JSON body.
- **The JSON body is one shell argument wrapped in single quotes, so it MUST be
  single-quote-free.** The actions producers use carry single-quote-free values
  (Gmail search queries, ISO calendar bounds, calendar IDs). If a value could
  contain an apostrophe (e.g. free text, a calendar named `Mom's`), do NOT
  interpolate it into the `'…'` argument — a literal `'` ends the quote and the
  rest reparses as shell. Build the JSON so such a value can't appear in the
  argv string (omit it, or escape it as `'`), never by hand-quoting.
- It authenticates with the gateway's existing bearer (PLOW_CONNECTOR_TOKEN
  else PLOW_CHAT_TOKEN) — there is nothing to log in to.
- A connector reporting `connected:false` is not linked; the producer SHOULD
  skip that source for this run (do not fail the whole card).

Producers on a connector-based platform MUST NOT assume iMessage access — a
container cannot read the Mac's Messages DB. The triage alert's human-message
source there is Gmail + Slack.
