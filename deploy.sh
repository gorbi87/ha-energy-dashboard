#!/bin/bash
# Deployt alle Dashboard-Dateien auf Home Assistant
# config.js wird NICHT überschrieben (enthält Token)

HA_HOST="192.168.50.250"
HA_PATH="/config/www/energy-dashboard"
SSH_KEY="$HOME/.ssh/homeassistant_key"

FILES="app.js index.html styles.css panel.js"

echo "Deploying to $HA_HOST..."
for f in $FILES; do
  scp -i "$SSH_KEY" "$f" "root@$HA_HOST:$HA_PATH/$f" && echo "  ✓ $f"
done
echo "Done."
