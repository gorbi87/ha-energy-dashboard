#!/bin/bash
# Pusht Änderungen nach GitHub.
# HA danach über HACS oder 'Update from GitHub' aktualisieren.

set -e
cd "$(dirname "$0")"

git add app.js index.html styles.css panel.js config.example.js hacs.json README.md QUICKSTART.md DEBUG.md preview.html
git diff --cached --stat
git commit -m "${1:-Update dashboard}" && git push
echo "Pushed. HA jetzt über HACS updaten oder: ssh HA 'cd /config/www/energy-dashboard && git pull'"
