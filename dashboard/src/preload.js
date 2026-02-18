const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // App-level operations
  getLatestVersion: () => ipcRenderer.invoke('app:getLatestVersion'),

  // Pi HTTP operations (via main process to bypass CSP)
  getPiStatus: (ip) => ipcRenderer.invoke('pi:getStatus', ip),
  updatePiConfig: (ip, config) => ipcRenderer.invoke('pi:updateConfig', ip, config),
  changePiUrl: (ip, url) => ipcRenderer.invoke('pi:changeUrl', ip, url),
  restartPiBrowser: (ip) => ipcRenderer.invoke('pi:restartBrowser', ip),
  rebootPi: (ip) => ipcRenderer.invoke('pi:reboot', ip),
  getScreenshot: (ip) => ipcRenderer.invoke('pi:getScreenshot', ip),
  rotateScreen: (ip, rotation) => ipcRenderer.invoke('pi:rotateScreen', ip, rotation),
  changeNetwork: (ip, config) => ipcRenderer.invoke('pi:changeNetwork', ip, config),

  // System settings operations
  getAutoUpdateSettings: (ip) => ipcRenderer.invoke('pi:getAutoUpdateSettings', ip),
  setAutoUpdateSettings: (ip, enabled) => ipcRenderer.invoke('pi:setAutoUpdateSettings', ip, enabled),
  getRebootSettings: (ip) => ipcRenderer.invoke('pi:getRebootSettings', ip),
  setRebootSettings: (ip, enabled) => ipcRenderer.invoke('pi:setRebootSettings', ip, enabled),
  updatePiNow: (ip) => ipcRenderer.invoke('pi:updateNow', ip),

  // Pi database operations
  getAllPis: () => ipcRenderer.invoke('db:getAllPis'),
  addPi: (pi) => ipcRenderer.invoke('db:addPi', pi),
  updatePi: (id, updates) => ipcRenderer.invoke('db:updatePi', id, updates),
  removePi: (id) => ipcRenderer.invoke('db:removePi', id),

  // Room operations
  getAllRooms: () => ipcRenderer.invoke('db:getAllRooms'),
  addRoom: (name) => ipcRenderer.invoke('db:addRoom', name),
  removeRoom: (id) => ipcRenderer.invoke('db:removeRoom', id),
  assignPiToRoom: (piId, roomId) => ipcRenderer.invoke('db:assignPiToRoom', piId, roomId),

  // Image upload operations
  openImageDialog: () => ipcRenderer.invoke('dialog:openImageFile'),
  uploadImage: (ip, imageBase64, filename) => ipcRenderer.invoke('pi:uploadImage', ip, imageBase64, filename),
  deleteImage: (ip) => ipcRenderer.invoke('pi:deleteImage', ip),

  // URL operations
  getAllUrls: () => ipcRenderer.invoke('db:getAllUrls'),
  addUrl: (url, name) => ipcRenderer.invoke('db:addUrl', url, name),
  removeUrl: (id) => ipcRenderer.invoke('db:removeUrl', id),

  // Playlist operations
  getPlaylist: (ip) => ipcRenderer.invoke('pi:getPlaylist', ip),
  getPlaylistThumbnail: (ip, filename) => ipcRenderer.invoke('pi:getPlaylistThumbnail', ip, filename),
  uploadPlaylistImage: (ip, imageBase64, filename) => ipcRenderer.invoke('pi:uploadPlaylistImage', ip, imageBase64, filename),
  deletePlaylistImage: (ip, index) => ipcRenderer.invoke('pi:deletePlaylistImage', ip, index),
  clearPlaylist: (ip) => ipcRenderer.invoke('pi:clearPlaylist', ip),
  setPlaylistSettings: (ip, settings) => ipcRenderer.invoke('pi:setPlaylistSettings', ip, settings),
  activatePlaylist: (ip) => ipcRenderer.invoke('pi:activatePlaylist', ip),
  openMultipleImagesDialog: () => ipcRenderer.invoke('dialog:openMultipleImageFiles')
});
