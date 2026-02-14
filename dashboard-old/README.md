# CSS Dashboard

Windows desktop application for managing Raspberry Pi digital signage displays.

## Features

- **Multi-Pi Management**: Control multiple Raspberry Pis from one dashboard
- **Real-time Monitoring**: View CPU, memory, temperature, and uptime stats
- **Remote Control**: Change URLs, restart browsers, reboot Pis
- **Live Screenshots**: See exactly what's displayed on each Pi
- **Room Organization**: Group Pis by location/room
- **Auto-refresh**: Dashboard updates Pi status every 30 seconds
- **Offline Detection**: Visual indicators for offline Pis

## Installation

### Prerequisites

- Windows 10 or later
- Node.js 18+ and npm

### Setup

1. Clone the repository:
   ```bash
   cd dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm start
   ```

4. Build installer (MSI):
   ```bash
   npm run build
   ```

## Usage

### Adding a Pi

1. Click "Add Pi" button
2. Enter the Pi's IP address (e.g., `192.168.1.100`)
3. Optionally give it a name and assign to a room
4. Click "Add Pi" - the dashboard will test the connection first

### Managing Pis

Each Pi card shows:
- **Status**: Online/offline indicator
- **Stats**: CPU, memory, temperature, uptime
- **Current URL**: What's being displayed
- **Actions**:
  - Change URL
  - View screenshot
  - Restart browser
  - Reboot Pi
  - Remove from dashboard

### Filtering

Use the "Filter by Room" dropdown to view Pis from a specific room.

## Development

### Project Structure

```
dashboard/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC security layer
│   ├── database/
│   │   ├── db.js            # SQLite wrapper
│   │   └── schema.sql       # Database schema
│   ├── services/
│   │   └── apiService.js    # Pi API client
│   └── renderer/
│       ├── index.html       # Main HTML
│       ├── App.js           # React app
│       └── styles.css       # Styles
├── package.json
└── README.md
```

### Tech Stack

- **Electron**: Desktop app framework
- **React**: UI components
- **SQLite**: Local database (better-sqlite3)
- **Axios**: HTTP client for Pi APIs

### API Endpoints

The dashboard communicates with Raspberry Pis via REST API:

- `GET /api/status` - Get Pi status
- `POST /api/display/url` - Change displayed URL
- `POST /api/browser/restart` - Restart browser
- `POST /api/system/reboot` - Reboot Pi
- `GET /api/display/screenshot` - Get screenshot
- `POST /api/display/rotate` - Rotate screen
- `POST /api/network/ip` - Configure network
- `GET/POST /api/settings/autoupdate` - Auto-update settings
- `GET/POST /api/settings/reboot` - Daily reboot settings

## Building

### Windows Installer (MSI)

```bash
npm run build:msi
```

This creates an MSI installer in `dist/` that can be distributed to users.

## Troubleshooting

### Cannot connect to Pi

- Verify the Pi is on the same network
- Check the IP address is correct
- Ensure CSS agent is running on Pi: `sudo systemctl status css-agent`
- Test with curl: `curl http://<pi-ip>:5000/api/health`

### Pi shows offline

- Pi may be rebooting or powered off
- Network connection issue
- CSS agent service crashed - check Pi logs

### Database issues

Database is stored at: `%APPDATA%/css-dashboard/css-dashboard.db`

To reset:
1. Close dashboard
2. Delete database file
3. Restart dashboard (database will be recreated)

## License

MIT
