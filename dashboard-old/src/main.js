const electron = require('electron');
console.log('Electron:', electron);
console.log('Electron app:', electron.app);

const { app, BrowserWindow, ipcMain } = electron;
const path = require('path');
const Database = require('./database/db');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
    title: 'CSS Dashboard - Raspberry Pi Signage Management'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize database
function initDatabase() {
  const userDataPath = app.getPath('userData');
  db = new Database(path.join(userDataPath, 'css-dashboard.db'));
  console.log('Database initialized at:', path.join(userDataPath, 'css-dashboard.db'));
}

// IPC Handlers for database operations
function setupIpcHandlers() {
  // Pi operations
  ipcMain.handle('db:getAllPis', async () => {
    return db.getAllPis();
  });

  ipcMain.handle('db:addPi', async (event, pi) => {
    return db.addPi(pi);
  });

  ipcMain.handle('db:updatePi', async (event, id, updates) => {
    return db.updatePi(id, updates);
  });

  ipcMain.handle('db:removePi', async (event, id) => {
    return db.removePi(id);
  });

  // Room operations
  ipcMain.handle('db:getAllRooms', async () => {
    return db.getAllRooms();
  });

  ipcMain.handle('db:addRoom', async (event, name) => {
    return db.addRoom(name);
  });

  ipcMain.handle('db:removeRoom', async (event, id) => {
    return db.removeRoom(id);
  });

  ipcMain.handle('db:assignPiToRoom', async (event, piId, roomId) => {
    return db.assignPiToRoom(piId, roomId);
  });
}

// App lifecycle
app.whenReady().then(() => {
  initDatabase();
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (db) {
    db.close();
  }
});
