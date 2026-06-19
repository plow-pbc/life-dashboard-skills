# Review priority

**Stage:** A shared product library (the `ld-shared` contract layer pulled into
both life-dashboard seeds). Pre-PMF, one operator per household, not at scale.

**Cultural emphasis:** SIMPLIFY at all costs — subtractive remedies (delete,
collapse, inline) outrank additive ones at every severity. The executable code
(`scripts/post_to_kiosk.py`, with a load-bearing security posture — no-redirect,
redaction, fixed non-argv secret sources, fail-loud — and `scripts/ld_config_gate.py`,
the fail-closed ld-config structural gate) is small and reference-grade; the
reference docs are contracts the two seeds and the viewer must agree on.

**Repo-specific contrast pairs (beyond the universal set in `standards.md`):**

| DON'T (suppress / flag-as-shape) | DO (real finding) |
|---|---|
| Flag the helper for missing abstractions, scale-hardening, extra flags, or defensive edge cases — it's a single-operator reference impl. | Flag a change that breaks EITHER consuming transport: Plow (file secrets + stdin) or Hermes (env secrets + MESSAGE_FILE). Both must keep working from this one file. |
| Suggest a per-platform mode flag or branch the file-first/env-fallback + stdin/MESSAGE_FILE seams already subsume. | Flag a regression in the POST security posture: a followed redirect (bearer forwarding), an un-redacted `--dry-run` body, a secret read from argv, or a non-fail-loud missing input. |
| Treat reference-doc edits (kiosk-protocol, config.example) as low-value churn. | Flag **producer↔viewer drift**: a tile markup/class/grid or wire-body change in `kiosk-protocol.md` that the viewer's theme tokens can't render, or a card-map change that desyncs from the viewer slots. |
| — | Flag any **literal secret** in a doc, or a probe that surfaces secret values (`env`/`printenv`, `cat` of a credential file). |
