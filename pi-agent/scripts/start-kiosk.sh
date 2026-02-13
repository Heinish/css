#!/bin/bash
#
# CSS Signage - Kiosk Startup Script
# Launches Chromium browser in kiosk mode with the configured URL
#

CONFIG_FILE="/etc/css/config.json"
DEFAULT_URL="file:///opt/css-agent/static/waiting.html"

# Read URL from configuration file
if [ -f "$CONFIG_FILE" ]; then
    URL=$(jq -r '.display_url // "'"$DEFAULT_URL"'"' "$CONFIG_FILE")
else
    URL="$DEFAULT_URL"
fi

echo "CSS Kiosk starting with URL: $URL"

# Disable screen blanking and power management
# Check if we're running on X11 or Wayland
if [ -n "$DISPLAY" ] && command -v xset >/dev/null 2>&1; then
    # X11 - use xset
    xset s off
    xset -dpms
    xset s noblank
fi

# For Wayland (Raspberry Pi 5), screen blanking is controlled by wlr-randr or compositor settings
# The Wayland compositor should respect DPMS settings from the desktop environment

# Remove any crash flags from previous sessions
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/Default/Preferences 2>/dev/null
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences 2>/dev/null

# Clear Chromium cache to prevent stale content
echo "Clearing Chromium cache..."
rm -rf ~/.config/chromium/Default/Cache/* 2>/dev/null
rm -rf ~/.config/chromium/Default/Code\ Cache/* 2>/dev/null
rm -rf ~/.cache/chromium/* 2>/dev/null

# Launch Chromium in kiosk mode
# Detect if running Wayland (Raspberry Pi 5) or X11 (Raspberry Pi 4 and older)
OZONE_FLAGS=""
if [ -n "$WAYLAND_DISPLAY" ]; then
    echo "Detected Wayland - Using Wayland backend"
    OZONE_FLAGS="--enable-features=UseOzonePlatform --ozone-platform=wayland"
fi

chromium "$URL" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  $OZONE_FLAGS \
  --enable-features=OverlayScrollbar \
  --disable-session-crashed-bubble \
  --disable-component-update \
  --check-for-update-interval=31536000 \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-sync \
  --disable-background-networking \
  --disable-backgrounding-occluded-windows \
  --no-default-browser-check \
  --autoplay-policy=no-user-gesture-required \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disk-cache-size=1 \
  --media-cache-size=1 \
  --disable-application-cache \
  --disable-offline-load-stale-cache \
  --disable-gpu-shader-disk-cache \
  --log-level=3 \
  --silent-launch \
  --disable-logging \
  --disable-dev-shm-usage
