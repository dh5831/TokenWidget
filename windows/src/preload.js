const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  onState: (fn) => ipcRenderer.on('state', (_e, state) => fn(state)),
  go: (delta) => ipcRenderer.send('go', delta),
  setPage: (page) => ipcRenderer.send('set-page', page),
  toggleCompact: () => ipcRenderer.send('toggle-compact'),
  menu: () => ipcRenderer.send('menu'),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: () => ipcRenderer.send('drag-move'),
  dragEnd: () => ipcRenderer.send('drag-end'),
});
