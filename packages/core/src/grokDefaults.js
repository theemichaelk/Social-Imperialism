/**
 * Canonical Grok Engine defaults — used by desktop seed, brain docs, and web parity.
 * Credentials stored locally in grokEngineSettings (node-localstorage); not committed.
 */
const GROK_DEFAULTS = {
  platform: 'grok',
  url: 'https://grok.com/',
  imagineUrl: 'https://grok.com/imagine',
  email: '',
  password: '',
  autoLogin: true,
  browserId: 'edge',
  launchMode: 'app_profile',
  profileKey: 'grok',
  assetsSubdir: 'grok-assets',
};

const GROK_IPC_CHANNELS = [
  'grok-ping',
  'get-grok-settings',
  'save-grok-settings',
  'grok-connect',
  'grok-get-status',
  'grok-ask-text',
  'grok-imagine',
  'grok-generate-video',
  'grok-generate-infographic',
  'grok-close-browser',
  'grok-build-prompt-preview',
];

const GROK_FEATURES = [
  { id: 'grok-text', label: 'Grok Text (new chat)', channel: 'grok-ask-text', pages: ['content-hub', 'design-studio', 'brand'] },
  { id: 'grok-imagine', label: 'Grok Imagine (image gen)', channel: 'grok-imagine', pages: ['content-hub', 'design-studio', 'thumbnail-studio'] },
  { id: 'grok-video', label: 'Grok Video + Extend', channel: 'grok-generate-video', pages: ['content-hub'] },
  { id: 'grok-infographic', label: 'Grok Infographic', channel: 'grok-generate-infographic', pages: ['content-hub'] },
];

module.exports = { GROK_DEFAULTS, GROK_IPC_CHANNELS, GROK_FEATURES };