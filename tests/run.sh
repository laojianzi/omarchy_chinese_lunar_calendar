#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
node tests/projection.test.js
node tests/presentation_settings.test.js
node tests/config_model.test.js
node tests/native_settings.test.js
python3 -m unittest tests/sync_test.py
python3 -m py_compile bin/calendar-subscription-sync
