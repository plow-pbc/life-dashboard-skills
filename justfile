# Test runner for life-dashboard-skills — the shared ld- contract layer.
#
# This repo owns the shared executable helpers (the Python kiosk-POST helper and
# the JS scheduled-producer runtime) plus reference contracts (the kiosk
# wire/tile protocol, the ld-config template). `just test` runs the Python
# helper's tests on BOTH transports the two consuming seeds use (file secrets +
# stdin, and env secrets + MESSAGE_FILE), plus the shared JS runtime's tests.

test:
    python3 scripts/test_post_to_kiosk.py
    node --test scripts/test_ld-runtime.js
