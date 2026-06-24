const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runCommand: (command) => ipcRenderer.invoke('run-command', command),
  runPowerShell: (command) => ipcRenderer.invoke('run-powershell', command),
  downloadFile: (url, dest) => ipcRenderer.invoke('download-file', url, dest),
  checkLatestWSL: () => ipcRenderer.invoke('check-latest-wsl'),
  checkLatestPiImage: () => ipcRenderer.invoke('check-latest-pi-image'),
  getTempPath: () => ipcRenderer.invoke('get-temp-path'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  onCommandOutput: (callback) => {
    ipcRenderer.on('command-output', (_event, data) => callback(data));
  },
  onCommandComplete: (callback) => {
    ipcRenderer.on('command-complete', (_event, data) => callback(data));
  },
});
