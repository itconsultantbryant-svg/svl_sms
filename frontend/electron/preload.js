const { contextBridge, ipcRenderer } = require('electron');

const api = {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path')
};

contextBridge.exposeInMainWorld('api', api);
