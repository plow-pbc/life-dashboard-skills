# Test runner for life-dashboard-skills — the shared ld- contract layer.
#
# This repo owns the shared executable code — the kiosk-POST helper and the
# ld-config structural gate (the single definition of a valid ld-config, byte-
# equivalent to the jq filter the seeds used to carry) — plus reference contracts
# (the kiosk wire/tile protocol, the ld-config template). `just test` runs the
# helper's tests on BOTH transports the two consuming seeds use (file secrets +
# stdin, and env secrets + MESSAGE_FILE) and the gate's jq-equivalence proof.

test:
    python3 scripts/test_post_to_kiosk.py
    python3 scripts/test_ld_config_gate.py
