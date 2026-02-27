#!/bin/bash
#
# CSS Signage Agent - Ensure 1920x1080 @ 60Hz display resolution
# Runs before the agent starts to guarantee correct display configuration.
#
# - KMS systems (vc4-kms-v3d): uses video= kernel param in cmdline.txt
# - Legacy systems:             uses hdmi_group/hdmi_mode in config.txt
#

CONFIG_TXT="/boot/firmware/config.txt"
CMDLINE_TXT="/boot/firmware/cmdline.txt"

# ── Step 1: Write boot-time resolution config ──────────────────────────────────
if grep -q "vc4-kms-v3d" "$CONFIG_TXT" 2>/dev/null; then
    # Modern KMS driver — hdmi_group/hdmi_mode are ignored, use video= in cmdline.txt
    echo "[ensure-resolution] KMS driver detected — using cmdline.txt."
    if [ ! -f "$CMDLINE_TXT" ]; then
        echo "[ensure-resolution] WARNING: $CMDLINE_TXT not found."
    elif grep -q "video=HDMI-A-1:1920x1080" "$CMDLINE_TXT"; then
        echo "[ensure-resolution] cmdline.txt already has 1920x1080 — skipping."
    else
        # cmdline.txt is a single line; append the video= parameter to it
        sed -i 's/$/ video=HDMI-A-1:1920x1080@60/' "$CMDLINE_TXT"
        echo "[ensure-resolution] Added video=HDMI-A-1:1920x1080@60 to cmdline.txt — reboot required."
    fi
else
    # Legacy firmware driver — use hdmi_group/hdmi_mode in config.txt
    echo "[ensure-resolution] Legacy driver — using config.txt."
    if [ ! -f "$CONFIG_TXT" ]; then
        echo "[ensure-resolution] WARNING: $CONFIG_TXT not found."
    elif grep -q "hdmi_group=" "$CONFIG_TXT"; then
        echo "[ensure-resolution] config.txt already has HDMI settings — skipping."
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
        echo "[ensure-resolution] Appended HDMI 1920x1080@60 to config.txt — reboot required."
    fi
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

echo "[ensure-resolution] Attempting live xrandr fix..."

if DISPLAY=:0 xrandr --output HDMI-A-1 --mode 1920x1080 --rate 60 2>/dev/null; then
    echo "[ensure-resolution] Set 1920x1080@60 on HDMI-A-1."
elif DISPLAY=:0 xrandr --output HDMI-1 --mode 1920x1080 --rate 60 2>/dev/null; then
    echo "[ensure-resolution] Set 1920x1080@60 on HDMI-1."
else
    echo "[ensure-resolution] xrandr failed (expected if X auth unavailable)."
    echo "[ensure-resolution] Boot config updated — reboot to apply 1920x1080."
    DISPLAY=:0 xrandr 2>/dev/null || true
fi
