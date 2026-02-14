const { useState, useEffect, createElement: h } = React;

// Import API service (will be available from Electron require)
const ApiService = require('../services/apiService');

// Main App Component
function App() {
    const [pis, setPis] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Load Pis and Rooms from database
    useEffect(() => {
        loadData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(refreshPiStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    async function loadData() {
        try {
            const [pisData, roomsData] = await Promise.all([
                window.api.getAllPis(),
                window.api.getAllRooms()
            ]);
            setPis(pisData || []);
            setRooms(roomsData || []);
            setLoading(false);

            // Fetch status for all Pis
            refreshPiStatus();
        } catch (error) {
            console.error('Failed to load data:', error);
            setLoading(false);
        }
    }

    async function refreshPiStatus() {
        setRefreshing(true);
        const updatedPis = await Promise.all(
            pis.map(async (pi) => {
                const result = await ApiService.getPiStatus(pi.ip_address);
                if (result.success) {
                    // Update last_seen in database
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
            refreshPiStatus();
        } catch (error) {
            alert('Failed to add Pi: ' + error.message);
        }
    }

    async function handleRemovePi(id) {
        if (!confirm('Are you sure you want to remove this Pi?')) return;
        try {
            await window.api.removePi(id);
            setPis(pis.filter(p => p.id !== id));
        } catch (error) {
            alert('Failed to remove Pi: ' + error.message);
        }
    }

    // Filter Pis by selected room
    const filteredPis = selectedRoom
        ? pis.filter(pi => pi.room_id === selectedRoom)
        : pis;

    if (loading) {
        return h('div', { className: 'loading' },
            h('div', { className: 'spinner' }),
            h('span', null, 'Loading CSS Dashboard...')
        );
    }

    return h('div', { id: 'root' },
        // Header
        h('div', { className: 'header' },
            h('h1', null, 'CSS Dashboard'),
            h('div', { className: 'subtitle' }, `Managing ${pis.length} Raspberry Pi${pis.length !== 1 ? 's' : ''}`)
        ),

        // Main Content
        h('div', { className: 'main-content' },
            h(Dashboard, {
                pis: filteredPis,
                rooms,
                selectedRoom,
                onSelectRoom: setSelectedRoom,
                onAddPi: () => setShowAddDialog(true),
                onRemovePi: handleRemovePi,
                onRefresh: refreshPiStatus,
                refreshing
            })
        ),

        // Add Pi Dialog
        showAddDialog && h(AddPiDialog, {
            onAdd: handleAddPi,
            onCancel: () => setShowAddDialog(false),
            rooms
        })
    );
}

// Dashboard Component
function Dashboard({ pis, rooms, selectedRoom, onSelectRoom, onAddPi, onRemovePi, onRefresh, refreshing }) {
    return h('div', { className: 'dashboard' },
        // Toolbar
        h('div', { className: 'toolbar' },
            h('div', { className: 'toolbar-left' },
                h('button', { className: 'btn btn-primary', onClick: onAddPi }, '+ Add Pi'),
                h('button', {
                    className: 'btn btn-secondary',
                    onClick: onRefresh,
                    disabled: refreshing
                }, refreshing ? 'Refreshing...' : '🔄 Refresh')
            ),
            h('div', { className: 'toolbar-right' },
                h('label', null, 'Filter by Room: '),
                h('select', {
                    value: selectedRoom || '',
                    onChange: (e) => onSelectRoom(e.target.value ? parseInt(e.target.value) : null)
                },
                    h('option', { value: '' }, 'All Rooms'),
                    rooms.map(room => h('option', { key: room.id, value: room.id }, room.name))
                )
            )
        ),

        // Pi Grid
        h('div', { className: 'pi-grid' },
            pis.length === 0
                ? h('div', { className: 'empty-state' },
                    h('p', null, 'No Pis found. Click "Add Pi" to get started.')
                )
                : pis.map(pi => h(PiCard, {
                    key: pi.id,
                    pi,
                    onRemove: () => onRemovePi(pi.id)
                }))
        )
    );
}

// Pi Card Component
function PiCard({ pi, onRemove }) {
    const [showScreenshot, setShowScreenshot] = useState(false);
    const [screenshot, setScreenshot] = useState(null);
    const [changing, setChanging] = useState(false);

    async function handleChangeUrl() {
        const url = prompt('Enter new URL:', pi.current_url || '');
        if (!url) return;

        setChanging(true);
        const result = await ApiService.changeUrl(pi.ip_address, url);
        setChanging(false);

        if (result.success) {
            alert('URL changed successfully! Browser is restarting...');
        } else {
            alert('Failed to change URL: ' + result.error);
        }
    }

    async function handleRestartBrowser() {
        if (!confirm('Restart browser on this Pi?')) return;
        const result = await ApiService.restartBrowser(pi.ip_address);
        if (result.success) {
            alert('Browser restarted successfully!');
        } else {
            alert('Failed to restart browser: ' + result.error);
        }
    }

    async function handleReboot() {
        if (!confirm('Reboot this Pi? It will be offline for ~60 seconds.')) return;
        const result = await ApiService.rebootPi(pi.ip_address);
        if (result.success) {
            alert('Pi is rebooting... It will be back online shortly.');
        } else {
            alert('Failed to reboot: ' + result.error);
        }
    }

    async function loadScreenshot() {
        setShowScreenshot(true);
        const result = await ApiService.getScreenshot(pi.ip_address);
        if (result.success) {
            const url = URL.createObjectURL(result.data);
            setScreenshot(url);
        } else {
            alert('Failed to capture screenshot: ' + result.error);
            setShowScreenshot(false);
        }
    }

    return h('div', { className: `pi-card ${pi.online ? 'online' : 'offline'}` },
        // Status indicator
        h('div', { className: 'pi-status' },
            h('div', { className: `status-dot ${pi.online ? 'online' : 'offline'}` }),
            h('span', null, pi.online ? 'Online' : 'Offline')
        ),

        // Pi info
        h('div', { className: 'pi-info' },
            h('h3', null, pi.name),
            h('div', { className: 'pi-ip' }, pi.ip_address),
            pi.room_name && h('div', { className: 'pi-room' }, '📍 ' + pi.room_name)
        ),

        // Stats (if online)
        pi.online && h('div', { className: 'pi-stats' },
            h('div', { className: 'stat' },
                h('span', { className: 'stat-label' }, 'CPU:'),
                h('span', { className: 'stat-value' }, `${pi.cpu_percent}%`)
            ),
            h('div', { className: 'stat' },
                h('span', { className: 'stat-label' }, 'Memory:'),
                h('span', { className: 'stat-value' }, `${pi.memory_percent}%`)
            ),
            pi.temperature && h('div', { className: 'stat' },
                h('span', { className: 'stat-label' }, 'Temp:'),
                h('span', { className: 'stat-value' }, `${pi.temperature}°C`)
            ),
            h('div', { className: 'stat' },
                h('span', { className: 'stat-label' }, 'Uptime:'),
                h('span', { className: 'stat-value' }, formatUptime(pi.uptime))
            )
        ),

        // Current URL
        pi.online && pi.current_url && h('div', { className: 'pi-url' },
            h('strong', null, 'URL: '),
            h('span', null, truncateUrl(pi.current_url))
        ),

        // Actions
        h('div', { className: 'pi-actions' },
            h('button', {
                className: 'btn btn-sm',
                onClick: handleChangeUrl,
                disabled: !pi.online || changing
            }, changing ? 'Changing...' : 'Change URL'),
            h('button', {
                className: 'btn btn-sm',
                onClick: loadScreenshot,
                disabled: !pi.online
            }, '📸 Screenshot'),
            h('button', {
                className: 'btn btn-sm',
                onClick: handleRestartBrowser,
                disabled: !pi.online
            }, '🔄 Restart Browser'),
            h('button', {
                className: 'btn btn-sm btn-warning',
                onClick: handleReboot,
                disabled: !pi.online
            }, '⚡ Reboot'),
            h('button', {
                className: 'btn btn-sm btn-danger',
                onClick: onRemove
            }, '🗑️ Remove')
        ),

        // Screenshot Modal
        showScreenshot && h('div', { className: 'modal', onClick: () => setShowScreenshot(false) },
            h('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
                h('h3', null, `Screenshot - ${pi.name}`),
                screenshot
                    ? h('img', { src: screenshot, alt: 'Pi Screenshot', style: { width: '100%', marginTop: '20px' } })
                    : h('div', { className: 'loading' }, h('div', { className: 'spinner' }), 'Loading screenshot...'),
                h('button', { className: 'btn', onClick: () => setShowScreenshot(false) }, 'Close')
            )
        )
    );
}

// Add Pi Dialog Component
function AddPiDialog({ onAdd, onCancel, rooms }) {
    const [name, setName] = useState('');
    const [ip, setIp] = useState('');
    const [roomId, setRoomId] = useState('');
    const [testing, setTesting] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();

        // Validate IP format
        if (!isValidIp(ip)) {
            alert('Invalid IP address format');
            return;
        }

        // Test connection first
        setTesting(true);
        const result = await ApiService.healthCheck(ip);
        setTesting(false);

        if (!result.success) {
            const proceed = confirm(
                `Cannot connect to Pi at ${ip}. Error: ${result.error}\n\nAdd anyway?`
            );
            if (!proceed) return;
        }

        onAdd({
            name: name || `Pi-${ip}`,
            ip_address: ip,
            room_id: roomId ? parseInt(roomId) : null
        });
    }

    return h('div', { className: 'modal' },
        h('div', { className: 'modal-content' },
            h('h2', null, 'Add New Pi'),
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
                        placeholder: 'e.g., 192.168.1.100',
                        required: true
                    })
                ),
                h('div', { className: 'form-group' },
                    h('label', null, 'Room (Optional):'),
                    h('select', {
                        value: roomId,
                        onChange: (e) => setRoomId(e.target.value)
                    },
                        h('option', { value: '' }, 'No Room'),
                        rooms.map(room => h('option', { key: room.id, value: room.id }, room.name))
                    )
                ),
                h('div', { className: 'form-actions' },
                    h('button', {
                        type: 'button',
                        className: 'btn btn-secondary',
                        onClick: onCancel
                    }, 'Cancel'),
                    h('button', {
                        type: 'submit',
                        className: 'btn btn-primary',
                        disabled: testing
                    }, testing ? 'Testing Connection...' : 'Add Pi')
                )
            )
        )
    );
}

// Utility Functions
function formatUptime(seconds) {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function truncateUrl(url, maxLength = 50) {
    if (!url) return '';
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
}

function isValidIp(ip) {
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!pattern.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every(part => {
        const num = parseInt(part);
        return num >= 0 && num <= 255;
    });
}

// Render App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
