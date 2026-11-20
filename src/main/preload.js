// The only bridge between the window (renderer) and Node (main process).
// The renderer can call exactly these functions and nothing else.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('zaif', {
  load: () => ipcRenderer.invoke('zaif:load'),
  save: (data) => ipcRenderer.send('zaif:save', data),
  layout: (opts) => ipcRenderer.send('zaif:layout', opts),
  setOnTop: (on) => ipcRenderer.send('zaif:on-top', on),
  minimize: () => ipcRenderer.send('zaif:minimize'),
  quit: () => ipcRenderer.send('zaif:quit'),
  onInput: (fn) => ipcRenderer.on('zaif:input', (_event, counts) => fn(counts)),
  onWindow: (fn) => ipcRenderer.on('zaif:window', (_event, win) => fn(win)),
  onKeySource: (fn) => ipcRenderer.on('zaif:key-source', (_event, source) => fn(source)),
})
