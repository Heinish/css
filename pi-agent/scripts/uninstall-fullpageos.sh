#!/bin/bash
#
# CSS Signage Agent - FullPageOS Uninstall Script
# Removes all CSS components and restores default FullPageOS
#

set -e  # Exit on error

echo "=========================================="
echo "CSS Signage - FullPageOS Uninstall"
echo "=========================================="
echo ""
echo "This will remove:"
echo "  - CSS API service and auto-update timer"
echo "  - /opt/css and /opt/css-agent"
echo "  - /etc/css configuration"
echo "  - Chromium custom flags and preferences"
echo "  - Log rotation configuration"
echo ""
echo "This will NOT remove:"
echo "  - System packages (python3-pip, git, scrot, etc.)"
echo "  - Python packages (flask, psutil)"
echo "  - FullPageOS itself"
echo ""
read -p "Are you sure you want to uninstall CSS Signage? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER="${SUDO_USER:-$USER}"
echo "Detected user: $ACTUAL_USER"
echo ""

echo "Step 1: Stopping and disabling services..."
if systemctl is-active --quiet css-agent.service; then
    systemctl stop css-agent.service
    echo "  Stopped css-agent.service"
fi
if systemctl is-enabled --quiet css-agent.service 2>/dev/null; then
    systemctl disable css-agent.service
    echo "  Disabled css-agent.service"
fi

if systemctl is-active --quiet css-auto-update.timer; then
    systemctl stop css-auto-update.timer
    echo "  Stopped css-auto-update.timer"
fi
if systemctl is-enabled --quiet css-auto-update.timer 2>/dev/null; then
    systemctl disable css-auto-update.timer
    echo "  Disabled css-auto-update.timer"
fi

if systemctl is-active --quiet css-daily-reboot.timer; then
    systemctl stop css-daily-reboot.timer
    echo "  Stopped css-daily-reboot.timer"
fi
if systemctl is-enabled --quiet css-daily-reboot.timer 2>/dev/null; then
    systemctl disable css-daily-reboot.timer
    echo "  Disabled css-daily-reboot.timer"
fi

echo ""
echo "Step 2: Removing systemd service files..."
rm -f /etc/systemd/system/css-agent.service
rm -f /etc/systemd/system/css-auto-update.timer
rm -f /etc/systemd/system/css-auto-update.service
rm -f /etc/systemd/system/css-daily-reboot.timer
rm -f /etc/systemd/system/css-daily-reboot.service
systemctl daemon-reload
echo "  Removed systemd service files"

echo ""
echo "Step 3: Removing CSS agent files..."
rm -rf /opt/css
rm -f /opt/css-agent
echo "  Removed /opt/css and /opt/css-agent"

echo ""
echo "Step 4: Removing CSS configuration..."
rm -rf /etc/css
echo "  Removed /etc/css"

echo ""
echo "Step 5: Removing Chromium custom configuration..."
# Remove Chromium flags config
if [ -f /boot/firmware/fullpageos-config.txt ]; then
    rm -f /boot/firmware/fullpageos-config.txt
    echo "  Removed /boot/firmware/fullpageos-config.txt"
fi

# Remove Chromium preferences (only the translate settings we added)
if [ -f /home/$ACTUAL_USER/.config/chromium/Default/Preferences ]; then
    # Just notify, don't delete - user might have other settings
    echo "  Note: Chromium Preferences left intact at /home/$ACTUAL_USER/.config/chromium/Default/Preferences"
    echo "        (You may have other custom settings there)"
fi

# Remove chromium-flags.conf if it exists
if [ -f /home/$ACTUAL_USER/.config/chromium-flags.conf ]; then
    rm -f /home/$ACTUAL_USER/.config/chromium-flags.conf
    echo "  Removed chromium-flags.conf"
fi

# Remove rotation desktop file
if [ -f /home/$ACTUAL_USER/.config/autostart/css-rotation.desktop ]; then
    rm -f /home/$ACTUAL_USER/.config/autostart/css-rotation.desktop
    echo "  Removed rotation autostart desktop file"
fi

echo ""
echo "Step 6: Removing log rotation configuration..."
if [ -f /etc/logrotate.d/css-agent ]; then
    rm -f /etc/logrotate.d/css-agent
    echo "  Removed /etc/logrotate.d/css-agent"
fi

echo ""
echo "Step 7: Restoring FullPageOS default URL..."
if [ -f /boot/firmware/fullpageos.txt.backup ]; then
    cp /boot/firmware/fullpageos.txt.backup /boot/firmware/fullpageos.txt
    echo "  Restored FullPageOS configuration from backup"
elif [ -f /boot/firmware/fullpageos.txt ]; then
    # Set to default FullPageOS URL
    echo "http://www.raspberrypi.org" > /boot/firmware/fullpageos.txt
    echo "  Reset FullPageOS to default URL"
fi

echo ""
echo "=========================================="
echo "Uninstall Complete!"
echo "=========================================="
echo ""
echo "CSS Signage has been completely removed."
echo ""
echo "To apply changes:"
echo "  sudo reboot"
echo ""
echo "Or restart Chromium:"
echo "  sudo pkill chromium"
echo ""
