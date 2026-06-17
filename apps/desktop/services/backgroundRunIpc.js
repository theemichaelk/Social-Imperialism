const backgroundRunScheduler = require('./backgroundRunScheduler');

function registerBackgroundRunHandlers({ ipcMain, store }) {
  const channels = [
    'get-background-run-settings',
    'save-background-run-settings',
    'add-background-run-slot',
    'delete-background-run-slot',
    'get-background-run-status',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  ipcMain.handle('get-background-run-settings', () => backgroundRunScheduler.getSettings(store));

  ipcMain.handle('save-background-run-settings', (event, settings) => {
    const merged = backgroundRunScheduler.saveSettings(store, settings || {});
    return { success: true, settings: merged };
  });

  ipcMain.handle('add-background-run-slot', (event, payload) => {
    try {
      const run = backgroundRunScheduler.addScheduledRun(store, payload || {});
      backgroundRunScheduler.appendRunLog(store, `Scheduled background run: ${run.label}`);
      return { success: true, run };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('delete-background-run-slot', (event, id) => {
    return backgroundRunScheduler.deleteScheduledRun(store, id);
  });

  ipcMain.handle('get-background-run-status', () => backgroundRunScheduler.getStatus(store));
}

module.exports = { registerBackgroundRunHandlers };