#!/bin/bash
#
# CSS Signage - Log Rotation Setup
# Limits systemd journal and Chromium logs to prevent SD card filling
#

set -e

echo "Setting up log rotation and limits..."

# 1. Configure systemd journal limits
echo "Configuring systemd journal limits..."
mkdir -p /etc/systemd/journald.conf.d/
cat > /etc/systemd/journald.conf.d/css-limits.conf <<EOF
[Journal]
# Limit journal size to 100MB
SystemMaxUse=100M
# Keep only 1 week of logs
MaxRetentionSec=1week
# Limit individual log files to 10MB
SystemMaxFileSize=10M
EOF

# Restart journald to apply changes
systemctl restart systemd-journald

# 2. Clean up old journal logs now
echo "Cleaning old journal logs..."
journalctl --vacuum-size=100M
journalctl --vacuum-time=1week

# 3. Configure Chromium to disable verbose logging
echo "Chromium logging will be minimized via kiosk script flags"

# 4. Clean Chromium logs directory
echo "Cleaning Chromium logs..."
rm -rf ~/.config/chromium/*/LOG* 2>/dev/null || true
rm -rf ~/.config/chromium/*/chrome_debug.log* 2>/dev/null || true

# 5. Add daily cleanup cron job
echo "Adding daily log cleanup cron job..."
cat > /etc/cron.daily/css-log-cleanup <<'EOF'
#!/bin/bash
# CSS Daily log cleanup

# Clean journalctl
journalctl --vacuum-time=1week --vacuum-size=100M

# Clean Chromium logs
find /home/*/\.config/chromium -name "LOG*" -delete 2>/dev/null || true
find /home/*/\.config/chromium -name "chrome_debug.log*" -delete 2>/dev/null || true

# Clean temp files
find /tmp -name "*.log" -mtime +1 -delete 2>/dev/null || true

exit 0
EOF

chmod +x /etc/cron.daily/css-log-cleanup

echo ""
echo "Log rotation configured!"
echo "- Journal limited to 100MB / 1 week"
echo "- Daily cleanup cron job installed"
echo "- Old logs cleaned"
