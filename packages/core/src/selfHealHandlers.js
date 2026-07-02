/**
 * THEE_MICHAEL Self-Heal IPC handlers — journal, audit status, daily recommendations.
 */
const {
  getJournal,
  getAuditLog,
  getLearningMemory,
  getDailyRecommendations,
  formatJournalForPrompt,
  appendAuditLog,
} = require('./selfHealJournal');

function registerSelfHealHandlers({ ipcMain, store, handlers = {} }) {
  const wrap = (channel, fn) => {
    const handler = async (...args) => fn(...args);
    handlers[channel] = handler;
    if (ipcMain?.handle) ipcMain.handle(channel, handler);
  };

  wrap('get-self-heal-status', async () => {
    const journal = getJournal(store);
    const audits = getAuditLog(store);
    const learning = getLearningMemory(store);
    const recommendations = getDailyRecommendations(store);
    return {
      success: true,
      journal: {
        total: journal.length,
        openErrors: journal.filter((j) => j.kind === 'error' && !j.resolved).length,
        recent: journal.slice(0, 10),
      },
      lastAudit: audits[0] || null,
      learning: learning.slice(0, 10),
      recommendations,
      promptAppend: formatJournalForPrompt(store),
    };
  });

  wrap('get-daily-recommendations', async () => {
    const recommendations = getDailyRecommendations(store);
    const lastAudit = getAuditLog(store)[0] || null;
    return { success: true, recommendations, lastAudit };
  });

  wrap('get-self-heal-journal', async () => ({
    success: true,
    journal: getJournal(store),
    learning: getLearningMemory(store),
  }));

  wrap('run-self-heal-audit-local', async () => {
    const entry = await appendAuditLog(store, {
      status: 'manual',
      checksRun: 0,
      checksPassed: 0,
      learnings: ['Manual audit requested from desktop — full audit runs on API scheduler daily.'],
      recommendations: getDailyRecommendations(store).items || [],
    });
    return { success: true, audit: entry, note: 'Full multi-check audit runs on API server daily scheduler.' };
  });

  console.log('[selfHealHandlers] Registered: get-self-heal-status, get-daily-recommendations, get-self-heal-journal, run-self-heal-audit-local');
}

module.exports = { registerSelfHealHandlers };