#!/bin/bash
#
# CSS Signage Agent - Ensure 1920x1080 @ 60Hz display resolution
# Runs before the agent starts to guarantee correct display configuration.
#

# ── Step 1: Ensure /boot/firmware/config.txt has HDMI 1080p settings ──────────
CONFIG_TXT="/boot/firmware/config.txt"
if [ -f "$CONFIG_TXT" ]; then
    if grep -q "hdmi_group=" "$CONFIG_TXT"; then
        echo "[ensure-resolution] config.txt already has HDMI settings, skipping."
    else
        cat >> "$CONFIG_TXT" <<'HDMI_EOF'

# CSS Signage: force 1920x1080 @ 60Hz
hdmi_force_hotplug=1
hdmi_group=2
hdmi_mode=82
disable_overscan=1
framebuffer_width=1920
framebuffer_height=1080
HDMI_EOF
        echo "[ensure-resolution] Appended HDMI 1920x1080@60 settings to $CONFIG_TXT — reboot required."
    fi
else
    echo "[ensure-resolution] WARNING: $CONFIG_TXT not found — cannot write boot config."
fi

# ── Step 2: Try to set resolution live via xrandr (best-effort) ───────────────
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
    echo "[ensure-resolution] WARNING: Could not set resolution via xrandr."
    echo "[ensure-resolution] config.txt updated — reboot the Pi to apply 1920x1080."
    DISPLAY=:0 xrandr 2>/dev/null || true
fi
