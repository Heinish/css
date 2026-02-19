# 🖥️ CSS — Cheap Signage Solutions

A complete **Raspberry Pi digital signage system** with a Windows management dashboard. Control all your displays from one place — change URLs, upload images, monitor health, and push updates without touching a single Pi.

---

## 🧩 How It Works

```
Windows Dashboard  ──HTTP──►  Pi Agent (Flask API)  ──►  Chromium (FullPageOS)
```

Each Raspberry Pi runs a small Flask API that the dashboard talks to over your local network. The dashboard stores all your Pi info locally — no cloud, no accounts.

---

## ✨ Dashboard Features

| Feature | Description |
|---------|-------------|
| 🖥️ **Multi-Pi management** | Manage all your Pis from one window |
| 📊 **Live monitoring** | CPU, memory, temperature, uptime per Pi |
| 🔗 **Change URL** | Update what's displayed on any Pi instantly |
| 🖼️ **Upload image** | Send an image directly to a Pi's display |
| 📸 **Screenshot preview** | See exactly what each Pi is showing |
| 🗂️ **Slideshow/playlist** | Upload up to 20 images for a rotating slideshow |
| 🏢 **Room management** | Organise Pis into rooms, filter by room |
| 📋 **Saved URLs** | Save frequently used URLs for quick access |
| 🔄 **Restart browser** | Restart Chromium on any Pi or all at once |
| ⚡ **Reboot Pi** | Remotely reboot any Pi |
| ⚙️ **Auto-update** | Schedule automatic updates from GitHub |
| 🌙 **Daily reboot** | Schedule a nightly reboot for stability |
| 📺 **Screen rotation** | Rotate display 0°/90°/180°/270° |
| 🌐 **Network config** | Switch between DHCP and static IP |
| ⬆️ **Dashboard auto-update** | Dashboard updates itself when a new version is released |

---

## 🍓 Pi Agent Features

- Full-screen Chromium kiosk via **FullPageOS**
- REST API on port 5000 for remote control
- Screenshot capture (scrot / fbgrab)
- Image upload and display
- Screen rotation with persistence across reboots
- Slideshow mode with fade transitions
- Network fallback: show slideshow when internet is down
- Network configuration (static IP / DHCP)
- Auto-updates from GitHub with self-restart
- Chromium translate popup disabled automatically

---

## 📋 Requirements

**Hardware:**
- Raspberry Pi 4 or Pi 5
- MicroSD card (16 GB minimum)
- Display with HDMI input
- Network connection (Ethernet or WiFi)

**Software:**
- [FullPageOS](https://github.com/guysoft/FullPageOS) flashed to the SD card
- Windows PC for the dashboard

---

## 🚀 Quick Start

### Step 1 — Install the Dashboard (Windows)

Download and run **[CSS-Dashboard-Setup.exe](https://github.com/Heinish/css/releases/latest)**.

No admin rights needed — it installs and launches automatically. Future updates are delivered automatically through the built-in updater.

---

### Step 2 — Flash the Pi

Flash **FullPageOS** to the SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/):

1. Click **"Choose OS"** → **"Use custom"** → select the FullPageOS `.img` file
2. Open settings (⚙️) and configure **WiFi** and **enable SSH**
3. Flash and boot the Pi

---

### Step 3 — Install the CSS Agent

SSH into the Pi and run one command:

```bash
curl -sSL https://raw.githubusercontent.com/Heinish/css/main/pi-agent/scripts/install-fullpageos.sh | sudo bash
```

This will:
- Install required packages (Python, scrot, etc.)
- Clone the CSS repo to `/opt/css`
- Set up the API service on port **5000**
- Disable Chromium's translate popup
- Configure log rotation

---

### Step 4 — Add the Pi to the Dashboard

Open the **CSS Dashboard** on your Windows PC, click **➕ Add Pi**, and enter the Pi's IP address. That's it!

> **Tip:** Find the Pi's IP with `hostname -I` in SSH, or check your router's device list.

---

## 🔄 Updating

### Dashboard (Windows)
The dashboard checks for updates automatically on startup. When an update is available, a banner appears — click **Download** then **Restart & Install**.

Or click **⬆️ Check for Updates** in the toolbar at any time.

### Pi Agent — from the dashboard
Go to the Pi card → expand → **⚙️ Settings** → **System** tab → **🚀 Update Now**

Or click the version badge on the Pi card if an update is available.

### Pi Agent — manually via SSH
```bash
cd /opt/css && sudo git -c safe.directory=/opt/css pull origin main && sudo systemctl restart css-agent
```

---

## 🌐 REST API

Base URL: `http://{pi-ip}:5000`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Status, stats, version |
| `/api/config` | GET/POST | Read or update config |
| `/api/display/url` | POST | Change displayed URL |
| `/api/display/screenshot` | GET | Capture screenshot |
| `/api/display/rotate` | POST | Rotate display (0/90/180/270) |
| `/api/display/image` | POST | Upload image to display |
| `/api/display/image` | DELETE | Remove uploaded image |
| `/api/display/playlist` | GET/POST | Playlist settings |
| `/api/display/playlist/images` | POST | Add image to playlist |
| `/api/display/playlist/activate` | POST | Start slideshow |
| `/api/browser/restart` | POST | Restart Chromium |
| `/api/system/reboot` | POST | Reboot the Pi |
| `/api/update` | POST | Pull latest from GitHub |
| `/api/network/ip` | POST | Configure network |
| `/api/settings/autoupdate` | GET/POST | Auto-update schedule |
| `/api/settings/reboot` | GET/POST | Daily reboot schedule |
| `/api/health` | GET | Health check |

---

## ⚙️ Services (on each Pi)

| Service | Description |
|---------|-------------|
| `css-agent.service` | Flask REST API — always running |
| `css-auto-update.timer` | Scheduled auto-update (off by default) |
| `css-daily-reboot.timer` | Daily reboot at 3:00 AM (off by default) |

FullPageOS manages Chromium separately as a kiosk browser.

**Useful commands:**
```bash
sudo systemctl status css-agent     # Check if agent is running
sudo journalctl -u css-agent -f     # Live logs
sudo systemctl restart css-agent    # Restart the agent
```

---

## 📁 Project Structure

```
css/
├── pi-agent/
│   ├── server.py                    # Flask REST API
│   ├── scripts/
│   │   ├── install-fullpageos.sh    # One-line installer
│   │   └── setup-log-rotation.sh
│   ├── static/
│   │   ├── waiting.html             # Shown before a URL is set
│   │   └── offline.html             # Shown when network is down
│   └── systemd/                     # Service and timer unit files
│
├── dashboard/
│   ├── src/
│   │   ├── main.js                  # Main process (IPC, HTTP, auto-updater)
│   │   ├── preload.js               # Secure IPC bridge
│   │   ├── renderer.js              # React UI
│   │   └── database/                # Local JSON database
│   └── package.json
│
├── VERSION                          # Current agent + dashboard version
└── README.md
```

---

## 🔧 Troubleshooting

**Agent not responding:**
```bash
sudo systemctl status css-agent
sudo journalctl -u css-agent -n 50
sudo systemctl restart css-agent
```

**Screenshot not working:**
```bash
sudo journalctl -u css-agent -n 20
```
The agent tries `scrot` first, then falls back to `fbgrab`.

**Find Pi's IP address:**
```bash
hostname -I
```

**Pi update button not working (old install):**
Run this once via SSH:
```bash
cd /opt/css && sudo git -c safe.directory=/opt/css pull origin main && sudo systemctl restart css-agent
```
After that the dashboard update button works for all future updates.

**Daily reboot stuck in loop (old install):**
```bash
sudo systemctl disable css-daily-reboot.timer
sudo systemctl stop css-daily-reboot.timer
cd /opt/css && sudo git -c safe.directory=/opt/css pull origin main && sudo systemctl restart css-agent
```

---

## 📄 License

MIT
