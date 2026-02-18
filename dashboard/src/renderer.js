/**
 * CSS Dashboard - Main Renderer
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './renderer/styles.css';

const h = React.createElement;

// ===== Helper Functions =====
function formatUptime(seconds) {
  if (!seconds) return 'N/A';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// ===== API Service (using IPC to main process) =====
const ApiService = {
  async getPiStatus(ip) {
    return window.api.getPiStatus(ip);
  },

  async changeUrl(ip, url) {
    return window.api.changePiUrl(ip, url);
  },

  async restartBrowser(ip) {
    return window.api.restartPiBrowser(ip);
  },

  async rebootPi(ip) {
    return window.api.rebootPi(ip);
  }
};

// ===== Main App Component =====
function App() {
  const [pis, setPis] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [latestVersion, setLatestVersion] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [showRoomManager, setShowRoomManager] = useState(false);
  const [showUrlManager, setShowUrlManager] = useState(false);
  const [restartingAll, setRestartingAll] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(refreshPiStatus, 60000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled]);

  async function loadData() {
    try {
      const [pisData, roomsData, urlsData] = await Promise.all([
        window.api.getAllPis(),
        window.api.getAllRooms(),
        window.api.getAllUrls()
      ]);
      setPis(pisData || []);
      setRooms(roomsData || []);
      setUrls(urlsData || []);
      setLoading(false);
      refreshPiStatus();
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
    // Fetch latest version from GitHub (non-blocking)
    window.api.getLatestVersion().then(result => {
      if (result.success) setLatestVersion(result.version);
    });
  }

  async function refreshPiStatus(force) {
    // Skip auto-refresh when a modal/dialog is open to avoid losing input focus
    if (!force && modalOpen) return;
    setRefreshing(true);
    // Reload from database to get latest Pis
    const currentPis = await window.api.getAllPis();
    const updatedPis = await Promise.all(
      currentPis.map(async (pi) => {
        const result = await ApiService.getPiStatus(pi.ip_address);
        if (result.success) {
          await window.api.updatePi(pi.id, { last_seen: new Date().toISOString() });
          return { ...pi, ...result.data, online: true };
        } else {
          return { ...pi, online: false, error: result.error };
        }
      })
    );
    setPis(updatedPis);
    setRefreshing(false);
  }

  async function handleAddPi(piData) {
    try {
      const newPi = await window.api.addPi(piData);
      setPis([...pis, newPi]);
      setShowAddDialog(false);
      setModalOpen(false);
      setTimeout(() => refreshPiStatus(), 100);
    } catch (error) {
      alert('Failed to add Pi: ' + error.message);
    }
  }

  async function handleRemovePi(id) {
    if (!confirm('Remove this Pi from the dashboard?')) return;
    try {
      await window.api.removePi(id);
      setPis(pis.filter(p => p.id !== id));
    } catch (error) {
      alert('Failed to remove Pi: ' + error.message);
    }
  }

  async function handleAddRoom(name) {
    try {
      const newRoom = await window.api.addRoom(name);
      setRooms([...rooms, newRoom]);
      return true;
    } catch (error) {
      alert('❌ Failed to add room: ' + error.message);
      return false;
    }
  }

  async function handleRemoveRoom(id) {
    if (!confirm('🗑️ Delete this room? Pis will be unassigned.')) return;
    try {
      await window.api.removeRoom(id);
      setRooms(rooms.filter(r => r.id !== id));
      // Refresh Pis to update room_name
      await loadData();
    } catch (error) {
      alert('❌ Failed to remove room: ' + error.message);
    }
  }

  async function handleAddUrl(url, name) {
    try {
      const newUrl = await window.api.addUrl(url, name);
      setUrls([...urls, newUrl]);
      return true;
    } catch (error) {
      alert('❌ Failed to add URL: ' + error.message);
      return false;
    }
  }

  async function handleRemoveUrl(id) {
    if (!confirm('🗑️ Delete this saved URL?')) return;
    try {
      await window.api.removeUrl(id);
      setUrls(urls.filter(u => u.id !== id));
    } catch (error) {
      alert('❌ Failed to remove URL: ' + error.message);
    }
  }

  async function handleRestartAllBrowsers() {
    const onlinePis = pis.filter(pi => pi.online);

    if (onlinePis.length === 0) {
      alert('⚠️ No online Pis to restart');
      return;
    }

    if (!confirm(`🔄 Restart browsers on ${onlinePis.length} online Pi${onlinePis.length !== 1 ? 's' : ''}?`)) return;

    setRestartingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const pi of onlinePis) {
      try {
        const result = await ApiService.restartBrowser(pi.ip_address);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }

    setRestartingAll(false);

    if (failCount === 0) {
      alert(`✅ Successfully restarted ${successCount} browser${successCount !== 1 ? 's' : ''}!`);
    } else {
      alert(`⚠️ Restarted ${successCount} browser${successCount !== 1 ? 's' : ''}, ${failCount} failed`);
    }
  }

  if (loading) {
    return h('div', { className: 'loading' },
      h('div', { className: 'spinner' }),
      h('span', null, '⏳ Loading dashboard...')
    );
  }

  return h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    // Header
    h('div', { className: 'header' },
      h('h1', null, '🖥️ CSS Dashboard'),
      h('div', { className: 'subtitle' }, `Managing ${pis.length} Raspberry Pi${pis.length !== 1 ? 's' : ''}`)
    ),

    // Main Content
    h('div', { className: 'main-content' },
      h('div', { className: 'toolbar' },
        h('div', { className: 'toolbar-left' },
          h('button', { className: 'btn btn-primary', onClick: () => { setShowAddDialog(true); setModalOpen(true); } }, '➕ Add Pi'),
          h('button', { className: 'btn btn-secondary', onClick: () => { setShowRoomManager(true); setModalOpen(true); } }, '🏢 Manage Rooms'),
          h('button', { className: 'btn btn-secondary', onClick: () => { setShowUrlManager(true); setModalOpen(true); } }, '🔗 Manage URLs'),
          h('button', {
            className: 'btn btn-secondary',
            onClick: handleRestartAllBrowsers,
            disabled: restartingAll || pis.filter(p => p.online).length === 0
          }, restartingAll ? '⏳ Restarting All...' : '🔄 Restart All Browsers'),
          h('button', {
            className: 'btn btn-secondary',
            onClick: () => refreshPiStatus(true),
            disabled: refreshing
          }, refreshing ? '⏳ Refreshing...' : '🔄 Refresh'),
          h('div', { className: 'toggle-row', style: { padding: '0', margin: '0 4px' } },
            h(ToggleSwitch, { checked: autoRefreshEnabled, onChange: setAutoRefreshEnabled }),
            h('span', { style: { fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' } }, 'Auto-Refresh')
          )
        ),
        h('div', { className: 'toolbar-right' },
          h('label', null, '🏢 Filter:'),
          h('select', {
            value: selectedRoom,
            onChange: (e) => setSelectedRoom(e.target.value)
          },
            h('option', { value: '' }, 'All Rooms'),
            rooms.map(room => h('option', { value: room.id, key: room.id }, room.name))
          )
        )
      ),

      // Pi Grid
      h('div', { className: 'pi-grid' },
        (() => {
          const filteredPis = selectedRoom
            ? pis.filter(pi => pi.room_id === parseInt(selectedRoom))
            : pis;

          return filteredPis.length === 0
            ? h('div', { className: 'empty-state' },
                h('p', null, selectedRoom
                  ? '🏢 No Pis in this room.'
                  : '🎯 No Pis added yet. Click "➕ Add Pi" to get started!')
              )
            : filteredPis.map(pi => h(PiCard, {
                key: pi.id,
                pi,
                rooms,
                urls,
                latestVersion,
                onRemove: () => handleRemovePi(pi.id),
                onUpdate: loadData,
                setModalOpen
              }));
        })()
      )
    ),

    // Add Pi Dialog
    showAddDialog && h(AddPiDialog, {
      onAdd: handleAddPi,
      onCancel: () => { setShowAddDialog(false); setModalOpen(false); }
    }),

    // Room Manager Dialog
    showRoomManager && h(RoomManagerDialog, {
      rooms,
      onClose: () => { setShowRoomManager(false); setModalOpen(false); },
      onAddRoom: handleAddRoom,
      onRemoveRoom: handleRemoveRoom
    }),

    // URL Manager Dialog
    showUrlManager && h(UrlManagerDialog, {
      urls,
      onClose: () => { setShowUrlManager(false); setModalOpen(false); },
      onAddUrl: handleAddUrl,
      onRemoveUrl: handleRemoveUrl
    })
  );
}

// ===== Pi Card Component =====
function getUpdateType(current, latest) {
  if (!current || current === 'unknown') return 'no-version'; // Pi has no version info
  if (!latest) return 'no-check';                             // GitHub fetch failed, can't compare
  if (current === latest) return null;                        // Up to date
  const [cMaj, cMin] = current.split('.').map(Number);
  const [lMaj, lMin] = latest.split('.').map(Number);
  if (lMaj > cMaj) return 'major';
  if (lMin > cMin) return 'minor';
  return 'patch';
}

// ===== Toggle Switch Component =====
function ToggleSwitch({ checked, onChange, disabled }) {
  return h('div', {
    className: `toggle-switch ${checked ? 'on' : 'off'}${disabled ? ' disabled' : ''}`,
    onClick: !disabled ? () => onChange(!checked) : undefined,
    role: 'switch',
    'aria-checked': checked
  },
    h('span', { className: 'toggle-label-on' }, 'ON'),
    h('span', { className: 'toggle-label-off' }, 'OFF'),
    h('span', { className: 'toggle-knob' })
  );
}

function PiCard({ pi, rooms, urls, latestVersion, onRemove, onUpdate, setModalOpen }) {
  const [expanded, setExpanded] = useState(false);
  const [changing, setChanging] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedUrlId, setSelectedUrlId] = useState('custom');
  const [restarting, setRestarting] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [updatingAgent, setUpdatingAgent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh screenshot
  useEffect(() => {
    if (!autoRefresh || !showPreview) return;
    const interval = setInterval(async () => {
      const result = await window.api.getScreenshot(pi.ip_address);
      if (result.success) setScreenshot(result.data);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, showPreview, pi.ip_address]);

  async function handlePreview() {
    setLoadingPreview(true);
    const result = await window.api.getScreenshot(pi.ip_address);
    if (result.success) {
      setScreenshot(result.data);
      setShowPreview(true);
    } else {
      alert('Failed to get screenshot: ' + result.error);
    }
    setLoadingPreview(false);
  }

  async function refreshScreenshot() {
    setLoadingPreview(true);
    const result = await window.api.getScreenshot(pi.ip_address);
    if (result.success) setScreenshot(result.data);
    setLoadingPreview(false);
  }

  async function handleChangeUrl() {
    setNewUrl(pi.current_url || 'https://');
    setShowUrlDialog(true);
    setModalOpen(true);
  }

  async function submitUrlChange() {
    if (!newUrl) return;
    setShowUrlDialog(false);
    setModalOpen(false);
    setChanging(true);

    const result = await ApiService.changeUrl(pi.ip_address, newUrl);

    if (result.success) {
      alert('✅ URL changed successfully!');
      // Refresh to show new URL
      setTimeout(() => window.location.reload(), 500);
    } else {
      alert('❌ Failed to change URL: ' + result.error);
    }

    setChanging(false);
  }

  async function handleRestartBrowser() {
    setRestarting(true);
    const result = await ApiService.restartBrowser(pi.ip_address);

    if (result.success) {
      alert('🔄 Browser restarted successfully!');
    } else {
      alert('❌ Failed to restart browser: ' + result.error);
    }

    setRestarting(false);
  }

  async function handleUploadImage() {
    const fileResult = await window.api.openImageDialog();
    if (fileResult.canceled) return;

    if (fileResult.size > 20 * 1024 * 1024) {
      alert('Image file is too large. Maximum size is 20 MB.');
      return;
    }

    setUploading(true);
    const result = await window.api.uploadImage(pi.ip_address, fileResult.imageBase64, fileResult.filename);
    setUploading(false);

    if (result.success) {
      alert('✅ Image uploaded and now displaying on the Pi!');
    } else {
      alert('❌ Failed to upload image: ' + result.error);
    }
  }

  async function handleReboot() {
    if (!confirm('⚡ Reboot this Pi? It will be offline for ~30 seconds.')) return;

    setRebooting(true);
    const result = await ApiService.rebootPi(pi.ip_address);

    if (result.success) {
      alert('⚡ Pi is rebooting! It will be back online in ~30 seconds.');
    } else {
      alert('❌ Failed to reboot Pi: ' + result.error);
    }

    setRebooting(false);
  }

  async function handleUpdateAgent(updateType) {
    const typeLabels = { major: 'Major update', minor: 'New features', patch: 'Bug fix', 'no-version': 'Update' };
    const label = typeLabels[updateType] || 'Update';
    if (!confirm(`${label}: v${pi.version || '?'} → v${latestVersion}\n\nUpdate ${pi.name} now?`)) return;
    setUpdatingAgent(true);
    const result = await window.api.updatePiNow(pi.ip_address);
    setUpdatingAgent(false);
    if (result.success) {
      alert(`✅ ${pi.name} updated! The agent is restarting.`);
      setTimeout(onUpdate, 4000);
    } else {
      alert('❌ Update failed: ' + result.error);
    }
  }

  return h('div', null,
    h('div', { className: `pi-card ${expanded ? 'expanded' : ''} ${pi.online ? 'online' : 'offline'}` },

      // HEADER — always visible, click to expand/collapse
      h('div', {
        className: 'pi-card-header',
        onClick: () => setExpanded(!expanded)
      },
        h('div', { className: `status-dot ${pi.online ? 'online' : 'offline'}` }),
        h('div', { className: 'pi-card-header-info' },
          h('h3', null, pi.name),
          h('div', { className: 'pi-ip' }, pi.ip_address),
          pi.room_name && h('div', { className: 'pi-room' }, '📍 ' + pi.room_name)
        ),
        pi.online && (() => {
          const updateType = getUpdateType(pi.version, latestVersion);
          const versionLabel = pi.version || 'unknown';
          if (updateType === null) {
            return h('div', { className: 'pi-version up-to-date' }, `v${versionLabel} ✓`);
          }
          if (updateType === 'no-check') {
            return h('div', { className: 'pi-version up-to-date' }, `v${versionLabel}`);
          }
          const labels = {
            'no-version': { text: 'Update recommended', className: 'pi-version update-minor' },
            major: { text: 'Major update', className: 'pi-version update-major' },
            minor: { text: 'New features', className: 'pi-version update-minor' },
            patch: { text: 'Bug fix', className: 'pi-version update-patch' },
          };
          const { text, className } = labels[updateType];
          return h('button', {
            className: `${className} pi-version-btn`,
            onClick: (e) => { e.stopPropagation(); handleUpdateAgent(updateType); },
            disabled: updatingAgent || !pi.online,
            title: 'Click to update this Pi'
          },
            updatingAgent
              ? h('span', null, 'Updating...')
              : h('span', null,
                  updateType !== 'no-version' && h('span', null, `v${versionLabel} → v${latestVersion}  `),
                  h('span', { className: 'version-type-badge' }, text)
                )
          );
        })()
      ),

      // BODY — collapsible, shown when expanded
      h('div', { className: `pi-card-body ${expanded ? 'expanded' : ''}` },
        h('div', { className: 'pi-card-body-inner' },

          // Stats
          pi.online && h('div', { className: 'pi-stats' },
            h('div', { className: 'stat' },
              h('span', { className: 'stat-label' }, '💻 CPU:'),
              h('span', { className: 'stat-value' }, `${pi.cpu_percent || 0}%`)
            ),
            h('div', { className: 'stat' },
              h('span', { className: 'stat-label' }, '💾 Memory:'),
              h('span', { className: 'stat-value' }, `${pi.memory_percent || 0}%`)
            ),
            h('div', { className: 'stat' },
              h('span', { className: 'stat-label' }, '⏱️ Uptime:'),
              h('span', { className: 'stat-value' }, formatUptime(pi.uptime))
            ),
            pi.temperature && h('div', { className: 'stat' },
              h('span', { className: 'stat-label' }, '🌡️ Temp:'),
              h('span', { className: 'stat-value' }, `${pi.temperature}°C`)
            )
          ),

          // Current URL
          pi.online && pi.current_url && h('div', { className: 'pi-url' },
            h('strong', null, '🌐 URL: '),
            h('span', null, pi.current_url.substring(0, 50) + (pi.current_url.length > 50 ? '...' : ''))
          ),

          // Actions
          h('div', { className: 'pi-actions' },
            h('button', {
              className: 'btn btn-sm',
              onClick: handleChangeUrl,
              disabled: !pi.online || changing
            }, changing ? '⏳ Changing...' : '🔗 Change URL'),
            h('button', {
              className: 'btn btn-sm',
              onClick: handleUploadImage,
              disabled: !pi.online || uploading
            }, uploading ? '⏳ Uploading...' : '🖼️ Upload Image'),
            h('button', {
              className: 'btn btn-sm',
              onClick: handleRestartBrowser,
              disabled: !pi.online || restarting
            }, restarting ? '⏳ Restarting...' : '🔄 Restart'),
            h('button', {
              className: 'btn btn-sm btn-warning',
              onClick: handleReboot,
              disabled: !pi.online || rebooting
            }, rebooting ? '⏳ Rebooting...' : '⚡ Reboot'),
            h('button', {
              className: 'btn btn-sm',
              onClick: handlePreview,
              disabled: !pi.online || loadingPreview
            }, loadingPreview ? '⏳ Loading...' : '📸 Preview'),
            h('button', {
              className: 'btn btn-sm btn-secondary',
              onClick: () => { setShowSettings(true); setModalOpen(true); }
            }, '⚙️ Settings'),
            h('button', {
              className: 'btn btn-sm btn-danger',
              onClick: onRemove
            }, '🗑️ Remove')
          )
        )
      )
    ),

    // Screenshot Preview Modal
    showPreview && h('div', { className: 'modal', onClick: () => { setShowPreview(false); setAutoRefresh(false); } },
      h('div', { className: 'modal-content large', onClick: (e) => e.stopPropagation() },
        h('h2', null, '📸 Preview - ' + pi.name),
        screenshot && h('img', {
          src: `data:image/png;base64,${screenshot}`,
          style: { width: '100%', borderRadius: '8px', marginTop: '10px' },
          alt: 'Pi Screenshot'
        }),
        h('div', { className: 'form-actions', style: { marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' } },
          h('button', {
            className: 'btn btn-primary',
            onClick: refreshScreenshot,
            disabled: loadingPreview
          }, loadingPreview ? '⏳ Refreshing...' : '🔄 Refresh'),
          h('div', { className: 'toggle-row', style: { padding: '0', flex: '1' } },
            h(ToggleSwitch, { checked: autoRefresh, onChange: setAutoRefresh }),
            h('span', null, 'Auto-Refresh (5s)')
          ),
          h('button', { className: 'btn btn-secondary', onClick: () => { setShowPreview(false); setAutoRefresh(false); } }, 'Close')
        )
      )
    ),

    // URL Change Dialog
    showUrlDialog && h('div', { className: 'modal', onClick: () => { setShowUrlDialog(false); setModalOpen(false); } },
      h('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
        h('h2', null, '🔗 Change URL'),
        urls && urls.length > 0 && h('div', { className: 'form-group' },
          h('label', null, '📋 Choose from saved URLs:'),
          h('select', {
            value: selectedUrlId,
            onChange: (e) => {
              setSelectedUrlId(e.target.value);
              if (e.target.value !== 'custom') {
                const selectedUrl = urls.find(u => u.id === parseInt(e.target.value));
                if (selectedUrl) setNewUrl(selectedUrl.url);
              } else {
                setNewUrl('');
              }
            }
          },
            h('option', { value: 'custom' }, 'Custom URL...'),
            urls.map(url => h('option', { value: url.id, key: url.id }, url.name))
          )
        ),
        h('div', { className: 'form-group' },
          h('label', null, 'URL:'),
          h('input', {
            type: 'text',
            value: newUrl,
            onChange: (e) => {
              setNewUrl(e.target.value);
              setSelectedUrlId('custom');
            },
            placeholder: 'https://example.com',
            autoFocus: true
          })
        ),
        h('div', { className: 'form-actions' },
          h('button', { type: 'button', className: 'btn btn-secondary', onClick: () => { setShowUrlDialog(false); setModalOpen(false); } }, 'Cancel'),
          h('button', { type: 'button', className: 'btn btn-primary', onClick: submitUrlChange }, 'Change URL')
        )
      )
    ),

    // Settings Dialog
    showSettings && h(PiSettingsDialog, {
      pi,
      rooms,
      onClose: () => { setShowSettings(false); setModalOpen(false); },
      onUpdate
    })
  );
}

// ===== Add Pi Dialog =====
function AddPiDialog({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!ip) return alert('IP address required!');

    onAdd({
      name: name || `Pi-${ip}`,
      ip_address: ip,
      room_id: null
    });
  }

  return h('div', { className: 'modal', onClick: onCancel },
    h('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
      h('h2', null, '➕ Add New Pi'),
      h('form', { onSubmit: handleSubmit },
        h('div', { className: 'form-group' },
          h('label', null, 'Pi Name:'),
          h('input', {
            type: 'text',
            value: name,
            onChange: (e) => setName(e.target.value),
            placeholder: 'e.g., Office Pi'
          })
        ),
        h('div', { className: 'form-group' },
          h('label', null, 'IP Address: *'),
          h('input', {
            type: 'text',
            value: ip,
            onChange: (e) => setIp(e.target.value),
            placeholder: 'e.g., 192.168.10.105',
            required: true
          })
        ),
        h('div', { className: 'form-actions' },
          h('button', { type: 'button', className: 'btn btn-secondary', onClick: onCancel }, 'Cancel'),
          h('button', { type: 'submit', className: 'btn btn-primary' }, 'Add Pi')
        )
      )
    )
  );
}

// ===== Room Manager Dialog =====
function RoomManagerDialog({ rooms, onClose, onAddRoom, onRemoveRoom }) {
  const [newRoomName, setNewRoomName] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const success = await onAddRoom(newRoomName.trim());
    if (success) {
      setNewRoomName('');
    }
  }

  return h('div', { className: 'modal', onClick: onClose },
    h('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
      h('h2', null, '🏢 Manage Rooms'),

      // List existing rooms
      rooms.length > 0 && h('div', { className: 'room-list' },
        h('h3', null, 'Existing Rooms:'),
        rooms.map(room =>
          h('div', { key: room.id, className: 'room-item' },
            h('span', null, room.name),
            h('button', {
              className: 'btn btn-sm btn-danger',
              onClick: () => onRemoveRoom(room.id)
            }, '🗑️ Delete')
          )
        )
      ),

      // Add new room
      h('form', { onSubmit: handleSubmit },
        h('div', { className: 'form-group' },
          h('label', null, '➕ Add New Room:'),
          h('input', {
            type: 'text',
            value: newRoomName,
            onChange: (e) => setNewRoomName(e.target.value),
            placeholder: 'e.g., Conference Room A',
            autoFocus: true
          })
        ),
        h('div', { className: 'form-actions' },
          h('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose }, 'Close'),
          h('button', { type: 'submit', className: 'btn btn-primary', disabled: !newRoomName.trim() }, '➕ Add Room')
        )
      )
    )
  );
}

// ===== URL Manager Dialog =====
function UrlManagerDialog({ urls, onClose, onAddUrl, onRemoveUrl }) {
  const [newUrlAddress, setNewUrlAddress] = useState('');
  const [newUrlName, setNewUrlName] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newUrlAddress.trim() || !newUrlName.trim()) return;

    const success = await onAddUrl(newUrlAddress.trim(), newUrlName.trim());
    if (success) {
      setNewUrlAddress('');
      setNewUrlName('');
    }
  }

  return h('div', { className: 'modal', onClick: onClose },
    h('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
      h('h2', null, '🔗 Manage Saved URLs'),

      // List existing URLs
      urls && urls.length > 0 && h('div', { className: 'room-list' },
        h('h3', null, 'Saved URLs:'),
        urls.map(url =>
          h('div', { key: url.id, className: 'room-item' },
            h('div', { style: { flex: 1 } },
              h('strong', null, url.name),
              h('br'),
              h('small', { style: { color: 'var(--text-secondary)', wordBreak: 'break-all' } }, url.url)
            ),
            h('button', {
              className: 'btn btn-sm btn-danger',
              onClick: () => onRemoveUrl(url.id)
            }, '🗑️ Delete')
          )
        )
      ),

      // Add new URL
      h('form', { onSubmit: handleSubmit },
        h('div', { className: 'form-group' },
          h('label', null, '📛 Name:'),
          h('input', {
            type: 'text',
            value: newUrlName,
            onChange: (e) => setNewUrlName(e.target.value),
            placeholder: 'e.g., Google Slides Dashboard',
            autoFocus: true
          })
        ),
        h('div', { className: 'form-group' },
          h('label', null, '🔗 URL:'),
          h('input', {
            type: 'text',
            value: newUrlAddress,
            onChange: (e) => setNewUrlAddress(e.target.value),
            placeholder: 'https://example.com'
          })
        ),
        h('div', { className: 'form-actions' },
          h('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose }, 'Close'),
          h('button', {
            type: 'submit',
            className: 'btn btn-primary',
            disabled: !newUrlName.trim() || !newUrlAddress.trim()
          }, '➕ Add URL')
        )
      )
    )
  );
}

// ===== Pi Settings Dialog =====
function PiSettingsDialog({ pi, rooms, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('general');
  const [piName, setPiName] = useState(pi.name);
  const [piRoom, setPiRoom] = useState(pi.room_id || '');
  const [rotation, setRotation] = useState('0');
  const [showPreview, setShowPreview] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // System settings state
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(null);
  const [rebootEnabled, setRebootEnabled] = useState(null);
  const [autoUpdateSchedule, setAutoUpdateSchedule] = useState('');
  const [rebootSchedule, setRebootSchedule] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Network settings state
  const [networkMode, setNetworkMode] = useState('dhcp'); // 'dhcp' or 'static'
  const [staticIp, setStaticIp] = useState('');
  const [netmask, setNetmask] = useState('255.255.255.0');
  const [gateway, setGateway] = useState('');
  const [dns, setDns] = useState('8.8.8.8');
  const [applyingNetwork, setApplyingNetwork] = useState(false);

  // Playlist state
  const [playlistLoaded, setPlaylistLoaded] = useState(false);
  const [playlistImages, setPlaylistImages] = useState([]);
  const [playlistThumbs, setPlaylistThumbs] = useState({});
  const [playlistDisplayTime, setPlaylistDisplayTime] = useState(5);
  const [playlistFadeTime, setPlaylistFadeTime] = useState(1);
  const [playlistFallback, setPlaylistFallback] = useState(false);
  const [uploadingPlaylist, setUploadingPlaylist] = useState(false);
  const [savingPlaylist, setSavingPlaylist] = useState(false);

  // Load system settings when System tab is opened
  async function loadSystemSettings() {
    setLoadingSettings(true);
    try {
      const [autoUpdateResult, rebootResult] = await Promise.all([
        window.api.getAutoUpdateSettings(pi.ip_address),
        window.api.getRebootSettings(pi.ip_address)
      ]);

      if (autoUpdateResult.success) {
        setAutoUpdateEnabled(autoUpdateResult.data.enabled);
        setAutoUpdateSchedule(autoUpdateResult.data.schedule || 'Not configured');
      }

      if (rebootResult.success) {
        setRebootEnabled(rebootResult.data.enabled);
        setRebootSchedule(rebootResult.data.schedule || 'Not configured');
      }
    } catch (error) {
      console.error('Failed to load system settings:', error);
    }
    setLoadingSettings(false);
  }

  async function loadPlaylist() {
    const result = await window.api.getPlaylist(pi.ip_address);
    if (result.success) {
      const pl = result.data;
      const images = pl.images || [];
      setPlaylistImages(images);
      setPlaylistDisplayTime(pl.display_time || 5);
      setPlaylistFadeTime(pl.fade_time || 1);
      setPlaylistFallback(pl.fallback_enabled || false);

      // Load thumbnails via IPC (direct HTTP img src doesn't work in Electron renderer)
      const thumbEntries = await Promise.all(
        images.map(async (filename) => {
          const r = await window.api.getPlaylistThumbnail(pi.ip_address, filename);
          const dataUrl = r.success ? `data:${r.mimeType};base64,${r.data}` : null;
          return [filename, dataUrl];
        })
      );
      setPlaylistThumbs(Object.fromEntries(thumbEntries));
    }
    setPlaylistLoaded(true);
  }

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

  async function handleDeletePlaylistImage(index) {
    if (!confirm('Remove this image from the playlist?')) return;
    const result = await window.api.deletePlaylistImage(pi.ip_address, index);
    if (result.success) loadPlaylist();
    else alert('Failed to delete image: ' + result.error);
  }

  async function handleClearPlaylist() {
    if (!confirm('Clear all images from the playlist?')) return;
    const result = await window.api.clearPlaylist(pi.ip_address);
    if (result.success) { setPlaylistImages([]); alert('Playlist cleared.'); }
    else alert('Failed to clear playlist: ' + result.error);
  }

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

  async function handleActivatePlaylist() {
    if (playlistImages.length === 0) { alert('Add at least one image first!'); return; }
    const result = await window.api.activatePlaylist(pi.ip_address);
    if (result.success) alert('Slideshow is now displaying on the Pi!');
    else alert('Failed to activate playlist: ' + result.error);
  }

  async function handlePreview() {
    setLoadingPreview(true);
    const result = await window.api.getScreenshot(pi.ip_address);
    if (result.success) {
      setScreenshot(result.data);
      setShowPreview(true);
    } else {
      alert('❌ Failed to get screenshot: ' + result.error);
    }
    setLoadingPreview(false);
  }

  async function handleRotate() {
    const result = await window.api.rotateScreen(pi.ip_address, parseInt(rotation));
    if (result.success) {
      alert('✅ Screen rotated successfully! Reboot required to apply.');
    } else {
      alert('❌ Failed to rotate screen: ' + result.error);
    }
  }

  async function handleNetworkConfig() {
    if (networkMode === 'static') {
      // Validate static IP configuration
      if (!staticIp || !netmask || !gateway) {
        alert('❌ Please fill in all required fields (IP, Netmask, Gateway)');
        return;
      }

      // Basic IP validation
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(staticIp) || !ipRegex.test(netmask) || !ipRegex.test(gateway)) {
        alert('❌ Invalid IP address format');
        return;
      }

      if (!confirm('⚠️ Change network settings?\n\nThe Pi will reboot and you must reconnect using the new IP address: ' + staticIp)) {
        return;
      }
    } else {
      if (!confirm('⚠️ Switch to DHCP?\n\nThe Pi will reboot and obtain an IP address automatically. You may need to find the new IP address.')) {
        return;
      }
    }

    setApplyingNetwork(true);
    const config = networkMode === 'static'
      ? { mode: 'static', ip: staticIp, netmask, gateway, dns }
      : { mode: 'dhcp' };

    const result = await window.api.changeNetwork(pi.ip_address, config);
    setApplyingNetwork(false);

    if (result.success) {
      alert('✅ Network configuration applied! Pi is rebooting...\n\n' +
            (networkMode === 'static'
              ? 'Reconnect using new IP: ' + staticIp
              : 'Pi will obtain IP via DHCP. Check your router for the new IP.'));
      onClose();
    } else {
      alert('❌ Failed to change network settings: ' + result.error);
    }
  }

  async function handleSaveGeneral() {
    try {
      // Update room if changed
      if (piRoom !== (pi.room_id || '')) {
        await window.api.assignPiToRoom(pi.id, piRoom ? parseInt(piRoom) : null);
      }

      // Update name in both local database AND Pi's config
      const dbUpdates = { name: piName };
      const piConfigUpdates = { name: piName };

      // Save to Pi's config first
      const result = await window.api.updatePiConfig(pi.ip_address, piConfigUpdates);
      if (!result.success) {
        alert('❌ Failed to update Pi config: ' + result.error);
        return;
      }

      // Then update local database
      await window.api.updatePi(pi.id, dbUpdates);

      alert('✅ Settings saved!');
      onUpdate();
      onClose();
    } catch (error) {
      alert('❌ Failed to save: ' + error.message);
    }
  }

  async function handleToggleAutoUpdate() {
    const newState = !autoUpdateEnabled;
    const result = await window.api.setAutoUpdateSettings(pi.ip_address, newState);
    if (result.success) {
      setAutoUpdateEnabled(newState);
      alert(newState ? '✅ Auto-updates enabled!' : '❌ Auto-updates disabled!');
    } else {
      alert('❌ Failed to change auto-update settings: ' + result.error);
    }
  }

  async function handleToggleDailyReboot() {
    const newState = !rebootEnabled;
    const result = await window.api.setRebootSettings(pi.ip_address, newState);
    if (result.success) {
      setRebootEnabled(newState);
      alert(newState ? '✅ Daily reboot enabled!' : '❌ Daily reboot disabled!');
    } else {
      alert('❌ Failed to change reboot settings: ' + result.error);
    }
  }

  async function handleUpdateNow() {
    if (!confirm('🔄 Update this Pi now? This will pull the latest code from GitHub and restart the agent service.')) return;

    setUpdating(true);
    const result = await window.api.updatePiNow(pi.ip_address);

    if (result.success) {
      alert('✅ Update successful! ' + (result.data.output || 'Pi agent restarted.'));
    } else {
      alert('❌ Update failed: ' + result.error);
    }

    setUpdating(false);
  }

  return h('div', null,
    h('div', { className: 'modal', onClick: onClose },
      h('div', { className: 'modal-content large', onClick: (e) => e.stopPropagation() },
        h('h2', null, `⚙️ Settings - ${pi.name}`),

        // Tab navigation
        h('div', { className: 'tabs' },
          h('button', {
            className: activeTab === 'general' ? 'tab active' : 'tab',
            onClick: () => setActiveTab('general')
          }, '📋 General'),
          h('button', {
            className: activeTab === 'display' ? 'tab active' : 'tab',
            onClick: () => setActiveTab('display')
          }, '📺 Display'),
          h('button', {
            className: activeTab === 'network' ? 'tab active' : 'tab',
            onClick: () => setActiveTab('network')
          }, '🌐 Network'),
          h('button', {
            className: activeTab === 'system' ? 'tab active' : 'tab',
            onClick: () => {
              setActiveTab('system');
              if (autoUpdateEnabled === null) loadSystemSettings();
            }
          }, '⚙️ System'),
          h('button', {
            className: activeTab === 'playlist' ? 'tab active' : 'tab',
            onClick: () => {
              setActiveTab('playlist');
              if (!playlistLoaded) loadPlaylist();
            }
          }, '🖼️ Playlist')
        ),

        // General tab
        activeTab === 'general' && h('div', { className: 'tab-content' },
          h('div', { className: 'form-group' },
            h('label', null, '✏️ Pi Name:'),
            h('input', {
              type: 'text',
              value: piName,
              onChange: (e) => setPiName(e.target.value),
              placeholder: 'e.g., Office Display'
            })
          ),
          h('div', { className: 'form-group' },
            h('label', null, '🏢 Room:'),
            h('select', {
              value: piRoom,
              onChange: (e) => setPiRoom(e.target.value)
            },
              h('option', { value: '' }, 'No Room'),
              rooms.map(room => h('option', { value: room.id, key: room.id }, room.name))
            )
          ),
          h('div', { className: 'form-actions' },
            h('button', { className: 'btn btn-secondary', onClick: onClose }, 'Cancel'),
            h('button', { className: 'btn btn-primary', onClick: handleSaveGeneral }, '💾 Save')
          )
        ),

        // Display tab
        activeTab === 'display' && h('div', { className: 'tab-content' },
          h('div', { className: 'form-group' },
            h('h3', null, '📸 Screenshot Preview'),
            h('p', null, 'Capture what\'s currently displayed on the Pi\'s HDMI output'),
            h('button', {
              className: 'btn btn-primary',
              onClick: handlePreview,
              disabled: !pi.online || loadingPreview
            }, loadingPreview ? '⏳ Loading...' : '📸 Show Preview')
          ),
          h('div', { className: 'form-group' },
            h('h3', null, '🔄 Screen Rotation'),
            h('p', null, 'Rotate the display orientation (requires reboot to apply)'),
            h('select', {
              value: rotation,
              onChange: (e) => setRotation(e.target.value),
              disabled: !pi.online
            },
              h('option', { value: '0' }, '0° (Normal)'),
              h('option', { value: '90' }, '90° (Clockwise)'),
              h('option', { value: '180' }, '180° (Upside Down)'),
              h('option', { value: '270' }, '270° (Counter-Clockwise)')
            ),
            h('button', {
              className: 'btn btn-primary',
              onClick: handleRotate,
              disabled: !pi.online,
              style: { marginTop: '10px' }
            }, '✅ Apply Rotation')
          ),
          h('div', { className: 'form-actions' },
            h('button', { className: 'btn btn-secondary', onClick: onClose }, 'Close')
          )
        ),

        // Network tab
        activeTab === 'network' && h('div', { className: 'tab-content' },
          h('div', { className: 'alert alert-warning' },
            '⚠️ Warning: Changing network settings will reboot the Pi and require reconnecting using the new IP address.'
          ),

          // Current IP (read-only)
          h('div', { className: 'form-group' },
            h('label', null, '🌐 Current IP Address:'),
            h('input', { type: 'text', value: pi.ip_address, disabled: true })
          ),

          // Network Mode Selection
          h('div', { className: 'form-group' },
            h('label', null, '🔧 Network Mode:'),
            h('select', {
              value: networkMode,
              onChange: (e) => setNetworkMode(e.target.value),
              disabled: !pi.online
            },
              h('option', { value: 'dhcp' }, 'DHCP (Automatic)'),
              h('option', { value: 'static' }, 'Static IP (Manual)')
            )
          ),

          // Static IP Configuration (only shown when static mode selected)
          networkMode === 'static' && h('div', null,
            h('div', { className: 'form-group' },
              h('label', null, '📍 Static IP Address:'),
              h('input', {
                type: 'text',
                value: staticIp,
                onChange: (e) => setStaticIp(e.target.value),
                placeholder: 'e.g., 192.168.1.100',
                disabled: !pi.online
              })
            ),
            h('div', { className: 'form-group' },
              h('label', null, '🔢 Netmask:'),
              h('input', {
                type: 'text',
                value: netmask,
                onChange: (e) => setNetmask(e.target.value),
                placeholder: 'e.g., 255.255.255.0',
                disabled: !pi.online
              })
            ),
            h('div', { className: 'form-group' },
              h('label', null, '🚪 Gateway:'),
              h('input', {
                type: 'text',
                value: gateway,
                onChange: (e) => setGateway(e.target.value),
                placeholder: 'e.g., 192.168.1.1',
                disabled: !pi.online
              })
            ),
            h('div', { className: 'form-group' },
              h('label', null, '🌍 DNS Server:'),
              h('input', {
                type: 'text',
                value: dns,
                onChange: (e) => setDns(e.target.value),
                placeholder: 'e.g., 8.8.8.8',
                disabled: !pi.online
              })
            )
          ),

          // Apply button
          h('div', { className: 'form-actions' },
            h('button', {
              className: 'btn btn-primary',
              onClick: handleNetworkConfig,
              disabled: !pi.online || applyingNetwork
            }, applyingNetwork ? '⏳ Applying...' : '✅ Apply Network Settings'),
            h('button', { className: 'btn btn-secondary', onClick: onClose }, 'Close')
          )
        ),

        // System tab
        activeTab === 'system' && h('div', { className: 'tab-content' },
          loadingSettings ? h('div', null, '⏳ Loading settings...') : h('div', null,
            // Auto-Update Section
            h('div', { className: 'form-group' },
              h('h3', null, '🔄 Auto-Update'),
              h('p', null, 'Automatically pull latest code from GitHub repository'),
              h('div', { className: 'toggle-row' },
                h(ToggleSwitch, { checked: !!autoUpdateEnabled, onChange: () => handleToggleAutoUpdate(), disabled: !pi.online }),
                h('div', null,
                  h('strong', null, 'Auto-Update'),
                  h('p', null, `Schedule: ${autoUpdateSchedule}`)
                )
              )
            ),

            // Daily Reboot Section
            h('div', { className: 'form-group' },
              h('h3', null, '⚡ Daily Reboot'),
              h('p', null, 'Automatically reboot Pi daily to maintain stability'),
              h('div', { className: 'toggle-row' },
                h(ToggleSwitch, { checked: !!rebootEnabled, onChange: () => handleToggleDailyReboot(), disabled: !pi.online }),
                h('div', null,
                  h('strong', null, 'Daily Reboot'),
                  h('p', null, `Schedule: ${rebootSchedule}`)
                )
              )
            ),

            // Update Now Section
            h('div', { className: 'form-group' },
              h('h3', null, '🚀 Manual Update'),
              h('p', null, 'Pull latest code from GitHub and restart agent service immediately'),
              h('button', {
                className: 'btn btn-primary',
                onClick: handleUpdateNow,
                disabled: !pi.online || updating
              }, updating ? '⏳ Updating...' : '🚀 Update Now')
            ),

            h('div', { className: 'alert alert-info', style: { marginTop: '20px' } },
              '💡 Tip: Auto-updates run at the scheduled time. Use "Update Now" for immediate updates.'
            ),

            h('div', { className: 'form-actions' },
              h('button', { className: 'btn btn-secondary', onClick: onClose }, 'Close')
            )
          )
        ),

        // Playlist tab
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
                        h('div', { key: i, className: 'playlist-item', title: filename },
                          h('img', {
                            className: 'playlist-thumb',
                            src: playlistThumbs[filename] || '',
                            alt: filename
                          }),
                          h('div', { className: 'playlist-index' }, i + 1),
                          h('button', {
                            className: 'btn btn-danger btn-sm playlist-delete',
                            onClick: () => handleDeletePlaylistImage(i),
                            disabled: !pi.online,
                            title: `Remove ${filename}`
                          }, '✕')
                        )
                      )
                    )
              ),

              // Timing settings
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
                h('div', { className: 'toggle-row' },
                  h(ToggleSwitch, { checked: playlistFallback, onChange: (v) => setPlaylistFallback(v) }),
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
      )
    ),

    // Screenshot preview modal
    showPreview && h('div', { className: 'modal', onClick: () => setShowPreview(false) },
      h('div', { className: 'modal-content large', onClick: (e) => e.stopPropagation() },
        h('h2', null, '📸 Live Preview - ' + pi.name),
        h('img', {
          src: `data:image/png;base64,${screenshot}`,
          style: { width: '100%', borderRadius: '8px', marginTop: '15px' },
          alt: 'Pi Screenshot'
        }),
        h('div', { className: 'form-actions' },
          h('button', { className: 'btn btn-secondary', onClick: () => setShowPreview(false) }, 'Close')
        )
      )
    )
  );
}

// ===== Render App =====
window.addEventListener('DOMContentLoaded', () => {
  console.log('CSS Dashboard starting...');
  const root = document.getElementById('root');
  if (root) {
    const reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(h(App));
    console.log('Dashboard rendered!');
  }
});
