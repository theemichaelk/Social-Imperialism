function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultHumanSettings() {
  return {
    humanDelayMin: 30,
    humanDelayMax: 120,
    humanizeContent: true,
    typingPauseMs: 800,
  };
}

async function waitBeforeAction(settings = {}) {
  const merged = { ...defaultHumanSettings(), ...settings };
  const minMs = Math.max(0, (merged.humanDelayMin || 30) * 1000);
  const maxMs = Math.max(minMs, (merged.humanDelayMax || 120) * 1000);
  const delay = randomBetween(minMs, maxMs);
  await sleep(delay);
  if (merged.typingPauseMs) {
    await sleep(randomBetween(200, merged.typingPauseMs));
  }
  return delay;
}

function humanizeContent(text, settings = {}) {
  const merged = { ...defaultHumanSettings(), ...settings };
  if (merged.humanizeContent === false || !text) return text;

  let out = text.trim().replace(/\s+/g, ' ');

  const tweaks = [
    () => out,
    () => out.replace(/\.{3}$/, '…'),
    () => (out.endsWith('.') ? out.slice(0, -1) : out),
    () => (Math.random() > 0.85 && out.length < 240 ? `${out} 🙂` : out),
    () => (Math.random() > 0.9 ? out.replace(/!$/, '.') : out),
  ];

  return tweaks[randomBetween(0, tweaks.length - 1)]();
}

function spacingForFrequency(frequency) {
  switch (frequency) {
    case 'realtime':
    case '5m':
      return { humanDelayMin: 45, humanDelayMax: 180 };
    case '15m':
    case '10m':
    case 'hourly':
      return { humanDelayMin: 60, humanDelayMax: 300 };
    case 'daily':
      return { humanDelayMin: 120, humanDelayMax: 600 };
    default:
      return defaultHumanSettings();
  }
}

module.exports = {
  randomBetween,
  sleep,
  defaultHumanSettings,
  waitBeforeAction,
  humanizeContent,
  spacingForFrequency,
};