/**
 * In-process domain event bus — lets features react to each other's lifecycle events.
 */
const listeners = new Map();

function on(eventType, fn) {
  if (!listeners.has(eventType)) listeners.set(eventType, new Set());
  listeners.get(eventType).add(fn);
  return () => listeners.get(eventType)?.delete(fn);
}

function emit(eventType, payload) {
  const handlers = listeners.get(eventType);
  if (handlers) {
    for (const fn of handlers) {
      try { fn(payload); } catch (e) { console.warn(`[eventBus] ${eventType}:`, e.message); }
    }
  }
  const wild = listeners.get('*');
  if (wild) {
    for (const fn of wild) {
      try { fn({ type: eventType, ...payload }); } catch (e) { console.warn('[eventBus] *:', e.message); }
    }
  }
}

function clear() {
  listeners.clear();
}

module.exports = { on, emit, clear };