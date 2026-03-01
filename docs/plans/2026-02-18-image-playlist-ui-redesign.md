# Image Playlist + UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-Pi image slideshow playlist with configurable fade/display time and network fallback, plus a full UI redesign with compact hover-expand Pi cards.

**Architecture:** The Pi serves a self-contained `/slideshow` HTML page that fetches its own config from the Flask API and cycles images. The dashboard adds a "Picture Playlist" tab in PiSettingsDialog. UI redesign converts Pi cards to compact rows that expand to full detail on hover.

**Tech Stack:** Python/Flask (pi-agent), React/Electron (dashboard), CSS transitions for card expand, CSS crossfade for slideshow.

**Branches:**
- `feature/image-playlist` — Tasks 1–6 (playlist feature, pi-agent + dashboard IPC + UI tab)
- `feature/ui-redesign` — Tasks 7–8 (compact hover-expand cards, CSS cleanup)

---

## Task 1: Pi — Playlist storage structure + slideshow HTML endpoint

**Files:**
- Modify: `pi-agent/server.py`

Adds the `/slideshow` route that serves a self-contained HTML page.
The page fetches `/api/display/playlist` to get the image list and settings,
then cycles through images with CSS opacity crossfades.

**Step 1: Add playlist directory constant + helper in server.py**

After the existing `UPLOAD_FOLDER` line (~line 22), add:

```python
PLAYLIST_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads', 'playlist')
MAX_PLAYLIST_IMAGES = 20
```

**Step 2: Add `get_playlist_config()` helper**

Add after `save_config()` (~line 54):

```python
def get_playlist_config():
    """Return playlist section of config with defaults"""
    config = load_config()
    return {
        'images': config.get('playlist_images', []),
        'display_time': config.get('playlist_display_time', 5),
        'fade_time': config.get('playlist_fade_time', 1),
        'fallback_enabled': config.get('playlist_fallback_enabled', False)
    }

def save_playlist_config(playlist):
    """Merge playlist settings back into main config"""
    config = load_config()
    config['playlist_images'] = playlist.get('images', [])
    config['playlist_display_time'] = playlist.get('display_time', 5)
    config['playlist_fade_time'] = playlist.get('fade_time', 1)
    config['playlist_fallback_enabled'] = playlist.get('fallback_enabled', False)
    save_config(config)
```

**Step 3: Add `/slideshow` route**

Add before the `if __name__ == '__main__':` block:

```python
@app.route('/slideshow', methods=['GET'])
def slideshow():
    """Serve a self-contained image playlist slideshow page"""
    playlist = get_playlist_config()
    images = playlist['images']
    display_time = playlist['display_time']
    fade_time = playlist['fade_time']

    if not images:
        return '''<!DOCTYPE html><html><body style="background:#000;color:#fff;display:flex;
align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:24px;">
<p>No images in playlist</p></body></html>''', 200, {'Content-Type': 'text/html'}

    slides_html = '\n'.join(
        f'<div class="slide" id="slide{i}"><img src="/static/uploads/playlist/{img}" alt=""></div>'
        for i, img in enumerate(images)
    )

    return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="google" content="notranslate">
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ background: #000; width: 100vw; height: 100vh; overflow: hidden; position: relative; }}
.slide {{
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    opacity: 0;
    transition: opacity {fade_time}s ease-in-out;
}}
.slide.active {{ opacity: 1; }}
img {{ max-width: 100vw; max-height: 100vh; object-fit: contain; }}
</style>
</head>
<body>
{slides_html}
<script>
var slides = document.querySelectorAll('.slide');
var current = 0;
var total = slides.length;
var displayMs = {display_time * 1000};
var fadeMs = {fade_time * 1000};
function showSlide(n) {{
    slides.forEach(function(s) {{ s.classList.remove('active'); }});
    slides[n].classList.add('active');
}}
function next() {{
    current = (current + 1) % total;
    showSlide(current);
}}
showSlide(0);
setInterval(next, displayMs + fadeMs);
</script>
</body>
</html>''', 200, {{'Content-Type': 'text/html'}}
```

**Step 4: Commit**

```bash
cd /opt/css  # or working directory
git add pi-agent/server.py
git commit -m "feat: add slideshow route and playlist config helpers"
```

---

## Task 2: Pi — Playlist CRUD API endpoints

**Files:**
- Modify: `pi-agent/server.py`

**Step 1: Add GET/POST `/api/display/playlist` (settings)**

```python
@app.route('/api/display/playlist', methods=['GET', 'POST'])
def playlist_settings():
    """Get or update playlist settings (display_time, fade_time, fallback_enabled)"""
    if request.method == 'GET':
        return jsonify(get_playlist_config())

    data = request.json or {}
    playlist = get_playlist_config()
    if 'display_time' in data:
        playlist['display_time'] = max(1, int(data['display_time']))
    if 'fade_time' in data:
        playlist['fade_time'] = max(0, float(data['fade_time']))
    if 'fallback_enabled' in data:
        playlist['fallback_enabled'] = bool(data['fallback_enabled'])
    save_playlist_config(playlist)
    return jsonify({'success': True, 'playlist': playlist})
```

**Step 2: Add POST `/api/display/playlist/images` (upload single image)**

```python
@app.route('/api/display/playlist/images', methods=['POST'])
def upload_playlist_image():
    """Upload one image to the playlist (max 20)"""
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'No image file provided'}), 400

    file = request.files['image']
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({'success': False, 'error': f'Invalid file type'}), 400

    playlist = get_playlist_config()
    if len(playlist['images']) >= MAX_PLAYLIST_IMAGES:
        return jsonify({'success': False, 'error': f'Maximum {MAX_PLAYLIST_IMAGES} images reached'}), 400

    os.makedirs(PLAYLIST_FOLDER, exist_ok=True)

    # Find next available index
    index = len(playlist['images'])
    filename = f'playlist-{index}.{ext}'
    filepath = os.path.join(PLAYLIST_FOLDER, filename)
    file.save(filepath)

    playlist['images'].append(filename)
    save_playlist_config(playlist)

    return jsonify({'success': True, 'index': index, 'filename': filename, 'total': len(playlist['images'])})
```

**Step 3: Add DELETE `/api/display/playlist/images/<int:index>`**

```python
@app.route('/api/display/playlist/images/<int:index>', methods=['DELETE'])
def delete_playlist_image(index):
    """Remove one image from the playlist by index"""
    playlist = get_playlist_config()
    if index < 0 or index >= len(playlist['images']):
        return jsonify({'success': False, 'error': 'Invalid index'}), 400

    filename = playlist['images'][index]
    filepath = os.path.join(PLAYLIST_FOLDER, filename)
    try:
        if os.path.exists(filepath):
            os.unlink(filepath)
    except Exception as e:
        print(f'Warning: could not delete file {filepath}: {e}')

    playlist['images'].pop(index)
    save_playlist_config(playlist)
    return jsonify({'success': True, 'total': len(playlist['images'])})
```

**Step 4: Add DELETE `/api/display/playlist` (clear all)**

```python
@app.route('/api/display/playlist', methods=['DELETE'])
def clear_playlist():
    """Remove all images from the playlist"""
    playlist = get_playlist_config()
    for filename in playlist['images']:
        filepath = os.path.join(PLAYLIST_FOLDER, filename)
        try:
            if os.path.exists(filepath):
                os.unlink(filepath)
        except:
            pass
    playlist['images'] = []
    save_playlist_config(playlist)
    return jsonify({'success': True})
```

**Step 5: Add POST `/api/display/playlist/activate`**

```python
@app.route('/api/display/playlist/activate', methods=['POST'])
def activate_playlist():
    """Switch display to the slideshow page"""
    playlist_url = 'http://localhost:5000/slideshow'
    config = load_config()
    config['display_url'] = playlist_url
    save_config(config)
    try:
        update_display_url(playlist_url)
        return jsonify({'success': True, 'message': 'Slideshow activated'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
```

**Step 6: Commit**

```bash
git add pi-agent/server.py
git commit -m "feat: add playlist CRUD API endpoints and activate endpoint"
```

---

## Task 3: Pi — Network fallback uses playlist when enabled

**Files:**
- Modify: `pi-agent/server.py` — `start_network_monitor()` function (~line 873)

The current monitor always shows `/offline` when the network goes down.
We need to show `/slideshow` instead when `playlist_fallback_enabled` is `true`
AND the playlist has at least one image.

**Step 1: Update the "network just went down" block in `_monitor()`**

Replace the `if not online and not offline_shown:` block:

```python
if not online and not offline_shown:
    print("Network down - checking fallback mode")
    try:
        pl = get_playlist_config()
        if pl.get('fallback_enabled') and pl.get('images'):
            fallback_url = 'http://localhost:5000/slideshow'
            print("Network down - showing playlist slideshow")
        else:
            fallback_url = 'http://localhost:5000/offline'
            print("Network down - showing offline page")
        with open(FULLPAGEOS_CONFIG, 'w') as f:
            f.write(fallback_url + '\n')
        os.sync()
        restart_chromium()
        offline_shown = True
    except Exception as e:
        print(f"Failed to show fallback page: {e}")
```

**Step 2: Commit**

```bash
git add pi-agent/server.py
git commit -m "feat: use playlist as network fallback when enabled"
```

---

## Task 4: Dashboard — IPC handlers in main.js for playlist

**Files:**
- Modify: `dashboard/src/main.js`

**Step 1: Add axios helper functions** (after `deleteImage()` ~line 198)

```javascript
async function getPlaylist(ip) {
  try {
    const response = await axios.get(`http://${ip}:5000/api/display/playlist`, { timeout: 5000 });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function uploadPlaylistImage(ip, imageBuffer, filename) {
  try {
    const form = new FormData();
    form.append('image', imageBuffer, { filename });
    const response = await axios.post(`http://${ip}:5000/api/display/playlist/images`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxContentLength: 20 * 1024 * 1024
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deletePlaylistImage(ip, index) {
  try {
    const response = await axios.delete(`http://${ip}:5000/api/display/playlist/images/${index}`, { timeout: 5000 });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function clearPlaylist(ip) {
  try {
    const response = await axios.delete(`http://${ip}:5000/api/display/playlist`, { timeout: 5000 });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function setPlaylistSettings(ip, settings) {
  try {
    const response = await axios.post(`http://${ip}:5000/api/display/playlist`, settings, { timeout: 5000 });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function activatePlaylist(ip) {
  try {
    const response = await axios.post(`http://${ip}:5000/api/display/playlist/activate`, {}, { timeout: 5000 });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Step 2: Add a multi-image open dialog handler**

In `setupIpcHandlers()`, after the existing `dialog:openImageFile` handler:

```javascript
ipcMain.handle('dialog:openMultipleImageFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Images for Playlist',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const files = result.filePaths.map(filePath => ({
    filename: path.basename(filePath),
    imageBase64: fs.readFileSync(filePath).toString('base64'),
    size: fs.statSync(filePath).size
  }));
  return { canceled: false, files };
});
```

**Step 3: Register IPC handlers** (in `setupIpcHandlers()` after `pi:deleteImage`):

```javascript
ipcMain.handle('pi:getPlaylist', async (event, ip) => getPlaylist(ip));
ipcMain.handle('pi:uploadPlaylistImage', async (event, ip, imageBase64, filename) => {
  const buffer = Buffer.from(imageBase64, 'base64');
  return uploadPlaylistImage(ip, buffer, filename);
});
ipcMain.handle('pi:deletePlaylistImage', async (event, ip, index) => deletePlaylistImage(ip, index));
ipcMain.handle('pi:clearPlaylist', async (event, ip) => clearPlaylist(ip));
ipcMain.handle('pi:setPlaylistSettings', async (event, ip, settings) => setPlaylistSettings(ip, settings));
ipcMain.handle('pi:activatePlaylist', async (event, ip) => activatePlaylist(ip));
```

**Step 4: Commit**

```bash
git add dashboard/src/main.js
git commit -m "feat: add playlist IPC handlers in main process"
```

---

## Task 5: Dashboard — Expose playlist API in preload.js

**Files:**
- Modify: `dashboard/src/preload.js`

**Step 1: Add playlist methods to contextBridge** (after the URL operations block):

```javascript
// Playlist operations
getPlaylist: (ip) => ipcRenderer.invoke('pi:getPlaylist', ip),
uploadPlaylistImage: (ip, imageBase64, filename) => ipcRenderer.invoke('pi:uploadPlaylistImage', ip, imageBase64, filename),
deletePlaylistImage: (ip, index) => ipcRenderer.invoke('pi:deletePlaylistImage', ip, index),
clearPlaylist: (ip) => ipcRenderer.invoke('pi:clearPlaylist', ip),
setPlaylistSettings: (ip, settings) => ipcRenderer.invoke('pi:setPlaylistSettings', ip, settings),
activatePlaylist: (ip) => ipcRenderer.invoke('pi:activatePlaylist', ip),
openMultipleImagesDialog: () => ipcRenderer.invoke('dialog:openMultipleImageFiles'),
```

**Step 2: Commit**

```bash
git add dashboard/src/preload.js
git commit -m "feat: expose playlist API methods in preload bridge"
```

---

## Task 6: Dashboard — Picture Playlist tab in PiSettingsDialog

**Files:**
- Modify: `dashboard/src/renderer.js`

This is the largest UI task. Add a new "Picture Playlist" tab to `PiSettingsDialog`.

**Step 1: Add the tab button** in the tabs row (after the `⚙️ System` tab button, ~line 960):

```javascript
h('button', {
  className: activeTab === 'playlist' ? 'tab active' : 'tab',
  onClick: () => {
    setActiveTab('playlist');
    if (!playlistLoaded) loadPlaylist();
  }
}, '🖼️ Playlist')
```

**Step 2: Add playlist state variables** to `PiSettingsDialog` (after existing state variables ~line 780):

```javascript
const [playlistLoaded, setPlaylistLoaded] = useState(false);
const [playlistImages, setPlaylistImages] = useState([]);
const [playlistDisplayTime, setPlaylistDisplayTime] = useState(5);
const [playlistFadeTime, setPlaylistFadeTime] = useState(1);
const [playlistFallback, setPlaylistFallback] = useState(false);
const [uploadingPlaylist, setUploadingPlaylist] = useState(false);
const [savingPlaylist, setSavingPlaylist] = useState(false);
```

**Step 3: Add `loadPlaylist()` function** (after `loadSystemSettings()`):

```javascript
async function loadPlaylist() {
  const result = await window.api.getPlaylist(pi.ip_address);
  if (result.success) {
    const pl = result.data;
    setPlaylistImages(pl.images || []);
    setPlaylistDisplayTime(pl.display_time || 5);
    setPlaylistFadeTime(pl.fade_time || 1);
    setPlaylistFallback(pl.fallback_enabled || false);
  }
  setPlaylistLoaded(true);
}
```

**Step 4: Add `handleUploadPlaylistImages()` function**:

```javascript
async function handleUploadPlaylistImages() {
  const fileResult = await window.api.openMultipleImagesDialog();
  if (fileResult.canceled) return;

  const remaining = 20 - playlistImages.length;
  const toUpload = fileResult.files.slice(0, remaining);

  if (toUpload.length < fileResult.files.length) {
    alert(`Playlist is limited to 20 images. Only uploading ${toUpload.length} of ${fileResult.files.length} selected.`);
  }

  setUploadingPlaylist(true);
  let uploaded = 0;
  for (const file of toUpload) {
    if (file.size > 20 * 1024 * 1024) { alert(`${file.filename} is too large (max 20 MB)`); continue; }
    const result = await window.api.uploadPlaylistImage(pi.ip_address, file.imageBase64, file.filename);
    if (result.success) uploaded++;
    else alert(`Failed to upload ${file.filename}: ${result.error}`);
  }
  setUploadingPlaylist(false);
  if (uploaded > 0) {
    alert(`Uploaded ${uploaded} image${uploaded !== 1 ? 's' : ''} to playlist!`);
    loadPlaylist();
  }
}
```

**Step 5: Add `handleDeletePlaylistImage(index)` function**:

```javascript
async function handleDeletePlaylistImage(index) {
  if (!confirm('Remove this image from the playlist?')) return;
  const result = await window.api.deletePlaylistImage(pi.ip_address, index);
  if (result.success) loadPlaylist();
  else alert('Failed to delete image: ' + result.error);
}
```

**Step 6: Add `handleClearPlaylist()` function**:

```javascript
async function handleClearPlaylist() {
  if (!confirm('Clear all images from the playlist?')) return;
  const result = await window.api.clearPlaylist(pi.ip_address);
  if (result.success) { setPlaylistImages([]); alert('Playlist cleared.'); }
  else alert('Failed to clear playlist: ' + result.error);
}
```

**Step 7: Add `handleSavePlaylistSettings()` function**:

```javascript
async function handleSavePlaylistSettings() {
  setSavingPlaylist(true);
  const result = await window.api.setPlaylistSettings(pi.ip_address, {
    display_time: playlistDisplayTime,
    fade_time: playlistFadeTime,
    fallback_enabled: playlistFallback
  });
  setSavingPlaylist(false);
  if (result.success) alert('Playlist settings saved!');
  else alert('Failed to save settings: ' + result.error);
}
```

**Step 8: Add `handleActivatePlaylist()` function**:

```javascript
async function handleActivatePlaylist() {
  if (playlistImages.length === 0) { alert('Add at least one image first!'); return; }
  const result = await window.api.activatePlaylist(pi.ip_address);
  if (result.success) alert('Slideshow is now displaying on the Pi!');
  else alert('Failed to activate playlist: ' + result.error);
}
```

**Step 9: Add the playlist tab content** (after the `system` tab content block, before the closing of the modal-content div):

```javascript
activeTab === 'playlist' && h('div', { className: 'tab-content' },
  !playlistLoaded
    ? h('div', null, '⏳ Loading playlist...')
    : h('div', null,

      // Image list
      h('div', { className: 'form-group' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
          h('h3', null, `🖼️ Images (${playlistImages.length}/20)`),
          h('div', { style: { display: 'flex', gap: '8px' } },
            h('button', {
              className: 'btn btn-primary btn-sm',
              onClick: handleUploadPlaylistImages,
              disabled: !pi.online || uploadingPlaylist || playlistImages.length >= 20
            }, uploadingPlaylist ? '⏳ Uploading...' : '➕ Add Images'),
            playlistImages.length > 0 && h('button', {
              className: 'btn btn-danger btn-sm',
              onClick: handleClearPlaylist,
              disabled: !pi.online
            }, '🗑️ Clear All')
          )
        ),
        playlistImages.length === 0
          ? h('div', { className: 'alert alert-info' }, 'No images yet. Click "Add Images" to upload up to 20 photos.')
          : h('div', { className: 'playlist-grid' },
              playlistImages.map((filename, i) =>
                h('div', { key: i, className: 'playlist-item' },
                  h('div', { className: 'playlist-index' }, i + 1),
                  h('div', { className: 'playlist-name', title: filename }, filename),
                  h('button', {
                    className: 'btn btn-danger btn-sm',
                    onClick: () => handleDeletePlaylistImage(i),
                    disabled: !pi.online
                  }, '✕')
                )
              )
            )
      ),

      // Settings
      h('div', { className: 'form-group' },
        h('h3', null, '⚙️ Slideshow Settings'),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '12px' } },
          h('div', null,
            h('label', null, '⏱️ Display Time (seconds):'),
            h('input', {
              type: 'number', min: '1', max: '300',
              value: playlistDisplayTime,
              onChange: (e) => setPlaylistDisplayTime(parseInt(e.target.value) || 5)
            })
          ),
          h('div', null,
            h('label', null, '🌅 Fade Time (seconds):'),
            h('input', {
              type: 'number', min: '0', max: '10', step: '0.5',
              value: playlistFadeTime,
              onChange: (e) => setPlaylistFadeTime(parseFloat(e.target.value) || 1)
            })
          )
        )
      ),

      // Fallback toggle
      h('div', { className: 'form-group' },
        h('h3', null, '📡 Network Fallback'),
        h('p', { style: { color: 'var(--text-tertiary)', fontSize: '13px', marginBottom: '10px' } },
          'Show slideshow instead of the offline page when the network is down.'
        ),
        h('label', { style: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' } },
          h('input', {
            type: 'checkbox',
            checked: playlistFallback,
            onChange: (e) => setPlaylistFallback(e.target.checked),
            style: { width: '18px', height: '18px' }
          }),
          h('span', null, 'Use playlist as network fallback')
        )
      ),

      h('div', { className: 'form-actions' },
        h('button', {
          className: 'btn btn-secondary',
          onClick: handleActivatePlaylist,
          disabled: !pi.online || playlistImages.length === 0
        }, '▶️ Show Slideshow Now'),
        h('button', {
          className: 'btn btn-primary',
          onClick: handleSavePlaylistSettings,
          disabled: !pi.online || savingPlaylist
        }, savingPlaylist ? '⏳ Saving...' : '💾 Save Settings'),
        h('button', { className: 'btn btn-secondary', onClick: onClose }, 'Close')
      )
    )
)
```

**Step 10: Commit**

```bash
git add dashboard/src/renderer.js
git commit -m "feat: add Picture Playlist tab to Pi settings dialog"
```

---

## Task 7: Dashboard — CSS for playlist grid

**Files:**
- Modify: `dashboard/src/renderer/styles.css`

Add these styles at the bottom of the file:

```css
/* Picture Playlist */
.playlist-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--gray-100);
  border-radius: 8px;
  transition: background 0.2s;
}

.playlist-item:hover {
  background: var(--gray-200);
}

.playlist-index {
  min-width: 24px;
  height: 24px;
  background: var(--primary-color);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.playlist-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**Step: Commit**

```bash
git add dashboard/src/renderer/styles.css
git commit -m "feat: add playlist grid styles"
```

---

## Task 8: Dashboard — UI Redesign (compact cards + hover expand)

**Files:**
- Modify: `dashboard/src/renderer.js` — `PiCard` component
- Modify: `dashboard/src/renderer/styles.css`

**Goal:** Pi cards are compact by default (~90px). On hover they expand smoothly to show stats, URL, and action buttons. Toolbar is tidied up.

### 8a — Update PiCard component

**Step 1: Add `expanded` state** at the top of the `PiCard` function:

```javascript
const [expanded, setExpanded] = useState(false);
```

**Step 2: Restructure the card JSX**

Replace the card's outermost `h('div', { className: \`pi-card ${...}\` }, ...)` section with:

```javascript
h('div', {
  className: `pi-card ${pi.online ? 'online' : 'offline'} ${expanded ? 'expanded' : ''}`,
  onMouseEnter: () => setExpanded(true),
  onMouseLeave: () => setExpanded(false)
},
  // Always-visible compact header
  h('div', { className: 'pi-card-header' },
    h('div', { className: 'pi-card-header-left' },
      h('div', { className: `status-dot ${pi.online ? 'online' : 'offline'}` }),
      h('div', { className: 'pi-card-title' },
        h('span', { className: 'pi-name' }, pi.name),
        h('span', { className: 'pi-ip-compact' }, pi.ip_address)
      ),
      pi.room_name && h('div', { className: 'pi-room' }, pi.room_name)
    ),
    h('div', { className: 'pi-card-header-right' },
      h('span', { className: 'pi-expand-hint' }, expanded ? '▲' : '▼')
    )
  ),

  // Expandable detail section
  h('div', { className: 'pi-card-details' },
    pi.online && h('div', { className: 'pi-stats' },
      h('div', { className: 'stat' },
        h('span', { className: 'stat-label' }, 'CPU:'),
        h('span', { className: 'stat-value' }, `${pi.cpu_percent || 0}%`)
      ),
      h('div', { className: 'stat' },
        h('span', { className: 'stat-label' }, 'Memory:'),
        h('span', { className: 'stat-value' }, `${pi.memory_percent || 0}%`)
      ),
      h('div', { className: 'stat' },
        h('span', { className: 'stat-label' }, 'Uptime:'),
        h('span', { className: 'stat-value' }, formatUptime(pi.uptime))
      ),
      pi.temperature && h('div', { className: 'stat' },
        h('span', { className: 'stat-label' }, 'Temp:'),
        h('span', { className: 'stat-value' }, `${pi.temperature}°C`)
      )
    ),
    pi.online && pi.current_url && h('div', { className: 'pi-url' },
      h('strong', null, 'URL: '),
      h('span', null, pi.current_url.substring(0, 50) + (pi.current_url.length > 50 ? '...' : ''))
    ),
    h('div', { className: 'pi-actions' },
      h('button', { className: 'btn btn-sm btn-primary', onClick: handleChangeUrl, disabled: !pi.online || changing },
        changing ? '⏳...' : '🔗 URL'),
      h('button', { className: 'btn btn-sm btn-secondary', onClick: handleUploadImage, disabled: !pi.online || uploading },
        uploading ? '⏳...' : '🖼️ Image'),
      h('button', { className: 'btn btn-sm btn-secondary', onClick: handleRestartBrowser, disabled: !pi.online || restarting },
        restarting ? '⏳...' : '🔄 Restart'),
      h('button', { className: 'btn btn-sm btn-warning', onClick: handleReboot, disabled: !pi.online || rebooting },
        rebooting ? '⏳...' : '⚡ Reboot'),
      h('button', { className: 'btn btn-sm', onClick: handlePreview, disabled: !pi.online || loadingPreview },
        loadingPreview ? '⏳...' : '📸 Preview'),
      h('button', { className: 'btn btn-sm btn-secondary', onClick: () => { setShowSettings(true); setModalOpen(true); } }, '⚙️ Settings'),
      h('button', { className: 'btn btn-sm btn-danger', onClick: onRemove }, '🗑️')
    )
  )
)
```

**Step 3: Commit renderer.js change**

```bash
git add dashboard/src/renderer.js
git commit -m "feat: refactor PiCard to compact header with hover-expand details"
```

### 8b — Update CSS for new card structure

**Step 1: Replace `.pi-card` styles** in `styles.css`:

Replace the existing `.pi-card`, `.pi-card::before`, `.pi-card:hover`, `.pi-card.online`, etc. and `.pi-actions` blocks with:

```css
/* Pi Card - compact + hover-expand */
.pi-card {
  background: var(--bg-card);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 8px var(--shadow-color);
  transition: box-shadow 0.25s ease, transform 0.25s ease;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.pi-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 100%;
  background: var(--gray-300);
  transition: background 0.3s;
}

.pi-card.online::before {
  background: linear-gradient(180deg, #10b981, #06b6d4);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
}

.pi-card.offline::before {
  background: linear-gradient(180deg, #ef4444, #dc2626);
}

.pi-card.offline { opacity: 0.8; }

.pi-card:hover, .pi-card.expanded {
  box-shadow: 0 8px 28px rgba(168, 85, 247, 0.18);
  transform: translateY(-2px);
}

.pi-card.online { border-color: rgba(16, 185, 129, 0.25); }
.pi-card.offline { border-color: rgba(239, 68, 68, 0.2); }

/* Compact header - always visible */
.pi-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 14px 22px;
  gap: 10px;
  min-height: 62px;
}

.pi-card-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.pi-card-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pi-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pi-ip-compact {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: monospace;
}

.pi-card-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pi-expand-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  transition: opacity 0.2s;
  opacity: 0.6;
}

/* Expandable details section */
.pi-card-details {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
  padding: 0 18px 0 22px;
}

.pi-card.expanded .pi-card-details,
.pi-card:hover .pi-card-details {
  max-height: 400px;
  padding: 0 18px 16px 22px;
}

/* Pi Actions - tighter in expand panel */
.pi-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.pi-actions .btn {
  flex: 0 1 auto;
  min-width: 0;
}
```

**Step 2: Also remove the old `.pi-ip` style** (replaced by `.pi-ip-compact`):

Delete/replace the `.pi-ip` block:
```css
/* old: font-family: Comic Sans - replaced by .pi-ip-compact */
.pi-ip-compact {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-tertiary);
}
```

**Step 3: Clean up header padding** - reduce the big header:

```css
.header {
  /* reduce from 50px to 28px padding */
  padding: 28px 0;
}
.header h1 {
  font-size: 36px;  /* was 52px */
}
```

**Step 4: Tighten the toolbar**:

```css
.toolbar {
  padding: 14px 20px;  /* was 24px 30px */
  margin-bottom: 20px; /* was 30px */
  border-radius: 12px;
}
```

**Step 5: Commit CSS**

```bash
git add dashboard/src/renderer/styles.css
git commit -m "feat: compact hover-expand card styles and tighter header/toolbar"
```

---

## Task 9: Build and release

**Step 1: Push the feature branch**

```bash
git push -u origin feature/image-playlist-ui-redesign
```

**Step 2: Test locally** (run in dev mode)

```bash
cd dashboard
npm start
```

Verify:
- Pi cards are compact, expand on hover
- Settings modal has 🖼️ Playlist tab
- Uploading images works (requires Pi connection)
- Display time / fade time inputs update correctly
- Fallback checkbox saves and loads

**Step 3: Build installer**

```bash
ELECTRON_MIRROR="" npm run make
```

**Step 4: Push to GitHub and update release**

```bash
"/c/Program Files/GitHub CLI/gh.exe" release delete v1.0.0 --repo Heinish/css --yes
"/c/Program Files/GitHub CLI/gh.exe" release create v1.0.0 \
  --repo Heinish/css \
  --title "CSS Dashboard v1.0.0" \
  --notes "Image playlist, UI redesign, focus fix" \
  "dashboard/out/make/squirrel.windows/x64/CSS-Dashboard-Setup.exe"
```

---

## Final Check

- [ ] Pi can serve `/slideshow` with uploaded images
- [ ] Network monitor uses slideshow when fallback is enabled
- [ ] Dashboard playlist tab: upload, delete, clear, settings, activate
- [ ] Cards are compact by default, expand on hover
- [ ] Header and toolbar are cleaner/smaller
- [ ] Focus fix is in the branch (already committed from main)
- [ ] Installer built and released
