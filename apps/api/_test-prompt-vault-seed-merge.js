/**
 * Local unit test — Prompt Vault seed merge (no API).
 */
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const {
  ensureSeeded,
  ALL_SEED_PROMPTS,
  DEFAULT_SEED,
  VIDEO_PROMPT_GALLERY_SEED,
} = require(path.join(ROOT, 'packages/core/src/promptVault.js'));
const { extractGalleryBrief } = require(path.join(ROOT, 'packages/core/src/promptVaultVideoGallery.js'));

function makeStore(seed = {}) {
  const data = { activeCampaignId: 'test-campaign', ...seed };
  return {
    getItem(k) { return data[k] ?? null; },
    setItem(k, v) { data[k] = v; },
    _data: data,
  };
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    failed += 1;
  } else {
    console.log(`✓ ${msg}`);
  }
}

const storeEmpty = makeStore();
const emptyItems = ensureSeeded(storeEmpty);
assert(emptyItems.length === 44, `empty vault seeds 44 prompts (got ${emptyItems.length})`);
assert(
  emptyItems.filter((i) => i.feature === 'video-studio').length === 36,
  '36 video-studio gallery prompts on fresh vault',
);

const storePartial = makeStore({
  'promptVault_test-campaign': JSON.stringify([
    { id: 'pv_seed_linkedin_post', title: 'Custom', body: 'x', feature: 'content-hub' },
    { id: 'user_custom', title: 'User', body: 'y', feature: 'general' },
  ]),
});
const merged = ensureSeeded(storePartial);
assert(merged.length === 45, `partial vault merges seeds without dropping user (got ${merged.length})`);
assert(merged.some((i) => i.id === 'user_custom'), 'user template preserved');
assert(merged.some((i) => i.id === 'pv_skill_video_zero_sky_blue_data'), 'gallery seed merged into existing vault');

assert(DEFAULT_SEED.length === 8, 'DEFAULT_SEED has 8 general templates');
assert(VIDEO_PROMPT_GALLERY_SEED.length === 36, 'VIDEO_PROMPT_GALLERY_SEED has 36 gallery templates');
assert(ALL_SEED_PROMPTS.length === 44, 'ALL_SEED_PROMPTS combines 8 + 36');

const sample = VIDEO_PROMPT_GALLERY_SEED.find((i) => i.id === 'pv_skill_video_zero_sky_blue_data');
const brief = extractGalleryBrief(sample.body);
assert(
  brief.startsWith('Make a 45-second animated explainer about why the sky is blue'),
  'extractGalleryBrief strips gallery header/footer',
);
assert(
  sample.body.includes('Estimated time: 5-10 minutes | Cost: $0'),
  'gallery header uses Estimated time / Cost format',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.galleryTier === 'Broadcast Quality'),
  'Broadcast Quality tier present in gallery seeds',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.galleryTier === 'For Specific Audiences'),
  'For Specific Audiences tier present in gallery seeds',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.id === 'pv_skill_video_tips_better_results'),
  'Tips for better results guide seeded',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.id === 'pv_skill_video_arch_how_it_works'),
  'How OpenMontage works flow seeded',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.galleryTier === 'Supported Providers'),
  'Supported Providers tier seeded',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.id === 'pv_skill_video_style_playbooks'),
  'Style System playbooks seeded',
);
const styleSeed = VIDEO_PROMPT_GALLERY_SEED.find((i) => i.id === 'pv_skill_video_style_playbooks');
assert(
  styleSeed?.body?.includes('Clean Professional — Corporate, educational, SaaS'),
  'Style playbooks use em-dash rows (no merged columns)',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.id === 'pv_skill_video_platform_output_profiles'),
  'Platform output profiles reference seeded',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.id === 'pv_skill_video_production_governance'),
  'Production governance reference seeded',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.id === 'pv_skill_video_agent_compatibility'),
  'Agent compatibility reference seeded',
);
assert(
  VIDEO_PROMPT_GALLERY_SEED.some((i) => i.id === 'pv_skill_video_contributing'),
  'Contributing reference seeded',
);
const storeRev = makeStore({
  'promptVault_test-campaign': JSON.stringify([
    {
      id: 'pv_skill_video_style_playbooks',
      title: 'old',
      body: 'old body with PLATFORM OUTPUT PROFILES merged',
      feature: 'video-studio',
      seedRevision: 2,
    },
  ]),
});
const upgraded = ensureSeeded(storeRev);
const styleItem = upgraded.find((i) => i.id === 'pv_skill_video_style_playbooks');
assert(styleItem?.seedRevision === 3, 'ensureSeeded upgrades gallery seed when seedRevision increases');
assert(
  styleItem?.body?.includes('Clean Professional — Corporate, educational, SaaS'),
  'upgraded style seed has readable playbook rows',
);
assert(
  !styleItem?.body?.includes('PLATFORM OUTPUT PROFILES'),
  'upgraded style seed no longer bundles platform profiles',
);

console.log(failed ? `\nFAILED: ${failed} assertion(s)\n` : '\nAll prompt vault seed merge checks passed.\n');
process.exit(failed > 0 ? 1 : 0);