const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Pi operations
  getAllPis: () => ipcRenderer.invoke('db:getAllPis'),
  addPi: (pi) => ipcRenderer.invoke('db:addPi', pi),
  updatePi: (id, updates) => ipcRenderer.invoke('db:updatePi', id, updates),
  removePi: (id) => ipcRenderer.invoke('db:removePi', id),

  // Room operations
  getAllRooms: () => ipcRenderer.invoke('db:getAllRooms'),
  addRoom: (name) => ipcRenderer.invoke('db:addRoom', name),
  removeRoom: (id) => ipcRenderer.invoke('db:removeRoom', id),
  assignPiToRoom: (piId, roomId) => ipcRenderer.invoke('db:assignPiToRoom', piId, roomId)
});
