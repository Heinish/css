#!/bin/bash
#
# CSS Signage - Log Rotation Setup
# Aggressively limits all logging to prevent SD card filling
#

set -e

echo "Setting up aggressive log limits..."

# ===== 1. SYSTEMD JOURNAL LIMITS =====
echo "Configuring systemd journal limits..."
mkdir -p /etc/systemd/journald.conf.d/
cat > /etc/systemd/journald.conf.d/css-limits.conf <<EOF
[Journal]
# Limit journal size to 50MB total
SystemMaxUse=50M
RuntimeMaxUse=50M
# Keep only 3 days of logs
MaxRetentionSec=3days
# Limit individual log files to 5MB
SystemMaxFileSize=5M
# Compress logs
Compress=yes
# Don't forward to syslog (avoid double-logging)
ForwardToSyslog=no
EOF

systemctl restart systemd-journald

echo "Cleaning old journal logs..."
journalctl --vacuum-size=50M
journalctl --vacuum-time=3d

# ===== 2. RSYSLOG RATE LIMITING =====
if [ -d /etc/rsyslog.d ]; then
    echo "Configuring rsyslog rate limiting..."
    cat > /etc/rsyslog.d/10-css-ratelimit.conf <<'EOF'
# CSS Signage - Rate limit rsyslog to prevent disk filling
# Allow max 200 messages per 60 seconds, then drop
$imjournalRatelimitInterval 60
$imjournalRatelimitBurst 200

# Also rate limit the syslog input
module(load="imuxsock"
       SysSock.RateLimit.Interval="60"
       SysSock.RateLimit.Burst="200"
       SysSock.RateLimit.Severity="4")
EOF
    systemctl restart rsyslog 2>/dev/null || true
else
    echo "rsyslog not found, skipping rate limiting..."
fi

# ===== 3. AGGRESSIVE LOGROTATE FOR SYSLOG FILES =====
echo "Configuring aggressive logrotate..."
cat > /etc/logrotate.d/css-aggressive <<'EOF'
# CSS Signage - Aggressive rotation for all system logs
/var/log/syslog
/var/log/daemon.log
/var/log/kern.log
/var/log/messages
/var/log/auth.log
/var/log/user.log
/var/log/debug
{
    rotate 2
    daily
    maxsize 10M
    missingok
    notifempty
    compress
    delaycompress
    postrotate
        /usr/lib/rsyslog/rsyslog-rotate 2>/dev/null || true
    endscript
}

/var/log/Xorg.*.log
/var/log/lightdm/*.log
/var/log/chromium/*.log
{
    rotate 1
    daily
    maxsize 5M
    missingok
    notifempty
    compress
}
EOF

# ===== 4. SUPPRESS XORG VERBOSE LOGGING =====
# Xorg.0.log is the #1 disk filler (24GB+ observed)
echo "Suppressing Xorg verbose logging..."
mkdir -p /etc/X11/xorg.conf.d/
cat > /etc/X11/xorg.conf.d/10-css-nolog.conf <<'EOF'
Section "ServerFlags"
    Option "Log" "flush"
EndSection

Section "ServerLayout"
    Identifier "Layout0"
    Option "AllowEmptyInput" "yes"
EndSection
EOF

# Redirect Xorg log to /dev/null via wrapper if possible
if [ -f /etc/lightdm/lightdm.conf ]; then
    # Add xserver-command with -logfile /dev/null if not already set
    if ! grep -q 'xserver-command.*logfile' /etc/lightdm/lightdm.conf 2>/dev/null; then
        sed -i '/^\[Seat:\*\]/a xserver-command=X -logfile /dev/null' /etc/lightdm/lightdm.conf 2>/dev/null || true
    fi
fi

# ===== 5. CLEAN CHROMIUM LOGS =====
echo "Cleaning Chromium logs..."
find / -path "*/chromium/*/LOG*" -delete 2>/dev/null || true
find / -path "*/chromium/*/chrome_debug.log*" -delete 2>/dev/null || true

# ===== 6. TRUNCATE ALL OVERSIZED LOGS NOW =====
echo "Truncating oversized logs..."
for logfile in /var/log/syslog /var/log/daemon.log /var/log/kern.log /var/log/messages /var/log/auth.log /var/log/user.log /var/log/debug /var/log/Xorg.0.log; do
    if [ -f "$logfile" ]; then
        truncate -s 0 "$logfile" 2>/dev/null || true
    fi
done
# Delete all rotated/compressed logs
find /var/log -name "*.gz" -delete 2>/dev/null || true
find /var/log -name "*.1" -delete 2>/dev/null || true
find /var/log -name "*.old" -delete 2>/dev/null || true
find /var/log -name "*.2" -delete 2>/dev/null || true
find /var/log -name "*.3" -delete 2>/dev/null || true
rm -f /var/log/Xorg.0.log.old 2>/dev/null || true

# ===== 7. HOURLY CLEANUP CRON =====
echo "Adding hourly log cleanup cron job..."
cat > /etc/cron.hourly/css-log-cleanup <<'SCRIPT'
#!/bin/bash
# CSS Hourly log cleanup - prevent disk filling

# Vacuum journal
journalctl --vacuum-size=50M --vacuum-time=3d 2>/dev/null

# Truncate any log file over 10MB (especially Xorg.0.log)
find /var/log -type f -size +10M -exec truncate -s 0 {} \; 2>/dev/null

# Delete old rotated logs
find /var/log -name "*.gz" -delete 2>/dev/null
find /var/log -name "*.old" -delete 2>/dev/null

# Clean Chromium logs
find / -path "*/chromium/*/LOG*" -delete 2>/dev/null || true

# Clean APT cache
apt-get clean 2>/dev/null

SCRIPT

chmod +x /etc/cron.hourly/css-log-cleanup

# Also keep the daily one for good measure
cat > /etc/cron.daily/css-log-cleanup <<'SCRIPT'
#!/bin/bash
# CSS Daily log cleanup

journalctl --vacuum-size=50M --vacuum-time=3d 2>/dev/null
find /var/log -name "*.gz" -delete 2>/dev/null
find /var/log -name "*.1" -delete 2>/dev/null
find /var/log -name "*.old" -delete 2>/dev/null
find /tmp -name "*.log" -mtime +1 -delete 2>/dev/null
apt-get clean 2>/dev/null
SCRIPT

chmod +x /etc/cron.daily/css-log-cleanup

echo ""
echo "Aggressive log limits configured!"
echo "- Journal limited to 50MB / 3 days"
echo "- Rsyslog rate limited (200 msg/min)"
echo "- Logrotate: max 10MB per file, 2 rotations"
echo "- Hourly + daily cleanup cron jobs installed"
echo "- All current oversized logs truncated"
