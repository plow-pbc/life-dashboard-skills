# Test runner for life-dashboard-skills — the shared ld- contract layer.
#
# This repo owns one piece of executable code (the shared kiosk-POST helper)
# plus reference contracts (the kiosk wire/tile protocol, the ld-config
# template). `just test` runs the helper's tests on BOTH transports the two
# consuming seeds use (file secrets + stdin, and env secrets + MESSAGE_FILE).

test:
    python3 scripts/test_post_to_kiosk.py
