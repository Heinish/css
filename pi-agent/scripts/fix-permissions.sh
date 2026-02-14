#!/bin/bash
#
# Fix permissions for CSS agent to run properly
#

echo "Fixing CSS Agent permissions..."

# Make sure config file is writable
sudo chmod 666 /etc/css/config.json
sudo chmod 666 /boot/firmware/fullpageos.txt

# Update service to run as root
sudo sed -i 's/^User=.*$/# User removed - running as root/' /etc/systemd/system/css-agent.service

# Reload and restart service
sudo systemctl daemon-reload
sudo systemctl restart css-agent

echo "✅ Permissions fixed! The CSS agent now runs as root and can modify system files."
echo ""
echo "To verify it's working:"
echo "  sudo systemctl status css-agent"
