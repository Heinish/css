# CSS - Cheap Signage Solutions

A complete Raspberry Pi-based digital signage system with centralized management dashboard.

## Project Overview

CSS turns Raspberry Pi devices into dedicated signage displays managed from a Windows desktop app. Perfect for retail displays, information boards, conference rooms, and digital menu boards.

## Features

### Dashboard (Windows)
- Multi-Pi management from one interface
- Real-time monitoring (CPU, memory, uptime, temperature)
- Change display URLs or upload images directly
- Screenshot preview of what each Pi is displaying
- Screen rotation control
- Room organization and filtering
- Bulk browser restart
- Saved URL library
- Remote update and reboot controls
- Auto-update and daily reboot scheduling

### Pi Agent
- Full-screen Chromium browser via FullPageOS
- REST API for remote control
- Screenshot capture
- Image upload and display
- Screen rotation with persistence across reboots
- Network configuration (static IP / DHCP)
- Auto-updates from GitHub
- Chromium translate popup disabled automatically

## Requirements

### Hardware
- Raspberry Pi 4 or Pi 5
- MicroSD card (16GB minimum)
- Display with HDMI input
- Ethernet or WiFi connection

### Software
- [FullPageOS](https://github.com/guysoft/FullPageOS) flashed to SD card
- Windows PC for the dashboard

## Quick Start

### 1. Set up the Pi

Flash **FullPageOS** to the SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/):
- Choose "Use custom" and select the FullPageOS image
- Configure WiFi and enable SSH in the imager settings
- Flash and boot the Pi

### 2. Install CSS Agent

SSH into the Pi and run:

```bash
curl -sSL https://raw.githubusercontent.com/Heinish/css/main/pi-agent/scripts/install-fullpageos.sh | sudo bash
```

This installs the CSS agent on top of FullPageOS. It will:
- Install required packages (Python, scrot, fbgrab, etc.)
- Clone the CSS repo to `/opt/css`
- Set up the API service on port 5000
- Disable Chromium's translate popup
- Configure log rotation

### 3. Restart Chromium

After installation, restart Chromium when prompted (or reboot the Pi).

### 4. Add Pi to Dashboard

Open the CSS Dashboard on your Windows PC, click "Add Pi", and enter the Pi's IP address.

## Updating

### Update a Pi from the dashboard
Go to Settings > System > Update Now

### Update a Pi manually via SSH
```bash
cd /opt/css && sudo git pull && sudo systemctl restart css-agent
```

## Configuration

### Pi Configuration File
Location: `/etc/css/config.json`

```json
{
  "name": "Conference Room A",
  "room": "",
  "display_url": "https://your-signage-url.com",
  "api_port": 5000
}
```

## REST API

Base URL: `http://{pi-ip}:5000`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Get current status and stats |
| `/api/config` | GET/POST | Get or update configuration |
| `/api/display/url` | POST | Change displayed URL |
| `/api/display/screenshot` | GET | Capture screenshot |
| `/api/display/rotate` | POST | Rotate display (0, 90, 180, 270) |
| `/api/display/image` | POST | Upload image to display |
| `/api/display/image` | DELETE | Delete uploaded image |
| `/api/browser/restart` | POST | Restart Chromium |
| `/api/system/reboot` | POST | Reboot the Pi |
| `/api/update` | POST | Pull updates from GitHub |
| `/api/network/ip` | POST | Configure network (static/DHCP) |
| `/api/settings/autoupdate` | GET/POST | Auto-update settings |
| `/api/settings/reboot` | GET/POST | Daily reboot settings |
| `/api/health` | GET | Health check |

## Services

The installer creates these systemd units:

| Service | Description |
|---------|-------------|
| `css-agent.service` | Flask REST API server (always running) |
| `css-auto-update.timer` | Auto-update timer (disabled by default) |
| `css-daily-reboot.timer` | Daily reboot at 3:00 AM (disabled by default) |

FullPageOS handles the Chromium kiosk browser separately.

### Useful commands
```bash
# Check agent status
sudo systemctl status css-agent

# View logs
sudo journalctl -u css-agent -f

# Restart agent
sudo systemctl restart css-agent
```

## Project Structure

```
css/
├── pi-agent/                  # Raspberry Pi agent
│   ├── server.py              # Flask REST API
│   ├── take-screenshot.sh     # Screenshot helper
│   ├── scripts/
│   │   ├── install-fullpageos.sh  # Installation script
│   │   └── setup-log-rotation.sh  # Log rotation setup
│   ├── static/
│   │   ├── waiting.html       # Default waiting page
│   │   └── offline.html       # Offline page
│   └── systemd/               # Service and timer files
│
├── dashboard/                 # Electron desktop app (Windows)
│   ├── src/
│   │   ├── main.js            # Main process (IPC + HTTP)
│   │   ├── preload.js         # IPC bridge
│   │   ├── renderer.js        # React UI
│   │   └── database/          # SQLite local database
│   └── package.json
│
└── README.md
```

## Troubleshooting

### API not responding
```bash
sudo systemctl status css-agent
sudo journalctl -u css-agent -n 50
sudo systemctl restart css-agent
```

### Screenshot not working
Check the agent logs for which method is being used:
```bash
sudo journalctl -u css-agent -n 20
```
The agent tries scrot first, then falls back to fbgrab.

### Find Pi's IP address
```bash
hostname -I
```

### Pi stuck in reboot loop
If daily reboot was enabled with old timer files:
```bash
sudo systemctl disable css-daily-reboot.timer
sudo systemctl stop css-daily-reboot.timer
```
Then update via `cd /opt/css && sudo git pull && sudo systemctl restart css-agent`.

## License

TBD
