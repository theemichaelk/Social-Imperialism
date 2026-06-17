/**
 * Single renderer-side IPC accessor — use on every page that calls ipcRenderer.invoke.
 */
let cached = null;

function getIpcRenderer() {
  if (cached?.invoke) return cached;
  if (typeof window !== 'undefined' && window.__siIpcRenderer?.invoke) {
    cached = window.__siIpcRenderer;
    return cached;
  }
  if (typeof window !== 'undefined' && window.ipcRenderer?.invoke) {
    cached = window.ipcRenderer;
    window.__siIpcRenderer = cached;
    return cached;
  }
  try {
    const electron = require('electron');
    if (electron?.ipcRenderer?.invoke) {
      cached = electron.ipcRenderer;
      if (typeof window !== 'undefined') {
        window.__siIpcRenderer = cached;
        window.ipcRenderer = cached;
      }
      return cached;
    }
  } catch (e) {
    /* not in electron renderer */
  }
  return null;
}

async function invokeIpc(channel, payload) {
  const ipc = getIpcRenderer();
  if (!ipc) throw new Error('Run this app with npm start (Electron required).');
  return ipc.invoke(channel, payload);
}

module.exports = { getIpcRenderer, invokeIpc };