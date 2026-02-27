#!/bin/bash
#
# CSS Signage Agent - Ensure 1920x1080 @ 60Hz display resolution
# Runs before the agent starts to guarantee correct display configuration.
#

echo "[ensure-resolution] Waiting 5 seconds for display to be ready..."
sleep 5

CURRENT=$(DISPLAY=:0 xrandr 2>/dev/null | grep '\*' | awk '{print $1}')
echo "[ensure-resolution] Current resolution: ${CURRENT:-unknown}"

if [ "$CURRENT" = "1920x1080" ]; then
    echo "[ensure-resolution] Resolution is already 1920x1080, no change needed."
    exit 0
fi

echo "[ensure-resolution] Resolution is not 1920x1080 — attempting to set it..."

# Try HDMI-1 first (most common on Pi 4/5)
if DISPLAY=:0 xrandr --output HDMI-1 --mode 1920x1080 --rate 60 2>/dev/null; then
    echo "[ensure-resolution] Set 1920x1080@60 on HDMI-1."
# Fallback: HDMI-A-1 (used on some Pi configurations)
elif DISPLAY=:0 xrandr --output HDMI-A-1 --mode 1920x1080 --rate 60 2>/dev/null; then
    echo "[ensure-resolution] Set 1920x1080@60 on HDMI-A-1."
else
    echo "[ensure-resolution] WARNING: Could not set resolution on HDMI-1 or HDMI-A-1."
    echo "[ensure-resolution] Available outputs:"
    DISPLAY=:0 xrandr 2>/dev/null || true
    # Non-fatal: config.txt boot settings are the primary resolution enforcement.
fi
