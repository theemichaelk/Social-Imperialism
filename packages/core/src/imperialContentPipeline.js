/**
 * Imperialism Center — Pipeline A (18-step content) & Pipeline B (8-step strategy).
 * THEE_MICHAEL v3.0-Aethelgard fabrication matrix.
 */

const PIPELINE_A_STEPS = [
  { id: 'serp-analysis', label: 'SEO SERP Analysis', order: 1 },
  { id: 'article-outline', label: 'Article Outline', order: 2 },
  { id: 'entity-extraction', label: 'Entity Extraction', order: 3 },
  { id: 'entity-outline', label: 'Entity-Enhanced Outline', order: 4 },
  { id: 'section-1', label: 'Write Section 1', order: 5 },
  { id: 'section-2', label: 'Write Section 2', order: 6 },
  { id: 'meta-title', label: 'Meta Title', order: 7 },
  { id: 'blog-title', label: 'Blog Title', order: 8 },
  { id: 'meta-description', label: 'Meta Description', order: 9 },
  { id: 'key-takeaways', label: 'Key Takeaways', order: 10 },
  { id: 'recap', label: 'Recap Section', order: 11 },
  { id: 'engagement-blocks', label: 'Mid-Article Engagement Blocks', order: 12 },
  { id: 'youtube-embed', label: 'YouTube iFrame Embed Mapping', order: 13 },
  { id: 'infographic-markup', label: 'Visual Native Infographic Markup', order: 14 },
  { id: 'featured-image', label: 'Featured Image Prompts', order: 15 },
  { id: 'authority-links', label: 'Authority Link Enrichment', order: 16 },
  { id: 'breakpoint-images', label: 'Dynamic Breakpoint Image Placement', order: 17 },
  { id: 'faq-schema', label: 'Final Proofread & FAQ Schema Assembly', order: 18 },
];

const PIPELINE_B_STEPS = [
  { id: 'intent-mapping', label: 'Intent Mapping', order: 1 },
  { id: 'topic-clusters', label: 'Topic Cluster Mapping', order: 2 },
  { id: 'content-draft', label: 'Content Drafting', order: 3 },
  { id: 'humanize-tldr', label: 'Humanization & TLDR Generation', order: 4 },
  { id: 'faq-schema-gen', label: 'FAQ & Schema Generation', order: 5 },
  { id: 'result-validation', label: 'Result Validation', order: 6 },
  { id: 'semantic-qc', label: 'Semantic Coverage Quality Control', order: 7 },
  { id: 'publish-monitor', label: 'Publish & Remote Performance Monitoring', order: 8 },
];

function buildStepPrompt(step, ctx) {
  const brand = ctx.brandName || 'the brand';
  const topic = ctx.topic || ctx.keyword || 'the target topic';
  const prior = ctx.priorOutput ? `\nPrior output:\n${ctx.priorOutput.slice(0, 4000)}` : '';
  return `You are THEE_MICHAEL content engine for ${brand}.
Pipeline step: ${step.label}
Topic/keyword: ${topic}
${prior}
Deliver only the output for this step — no meta commentary.`;
}

async function runPipeline(pipelineId, ctx, generateAI) {
  const steps = pipelineId === 'strategy' ? PIPELINE_B_STEPS : PIPELINE_A_STEPS;
  const outputs = {};
  let priorOutput = '';

  for (const step of steps) {
    const prompt = buildStepPrompt(step, { ...ctx, priorOutput });
    const text = await generateAI(prompt);
    outputs[step.id] = text;
    priorOutput = text;
  }

  return {
    success: true,
    pipelineId: pipelineId === 'strategy' ? 'pipeline-b' : 'pipeline-a',
    stepCount: steps.length,
    outputs,
    assembled: priorOutput,
  };
}

function registerImperialPipelineHandlers({ ipcMain, generateAI }) {
  ipcMain.handle('get-imperial-pipeline-config', () => ({
    pipelineA: { id: 'content', label: 'Content Engine (18-Step)', steps: PIPELINE_A_STEPS },
    pipelineB: { id: 'strategy', label: 'Strategy Engine (8-Step)', steps: PIPELINE_B_STEPS },
  }));

  ipcMain.handle('run-imperial-pipeline', async (event, payload = {}) => {
    try {
      const pipelineId = payload.pipeline === 'strategy' || payload.pipelineId === 'strategy'
        ? 'strategy'
        : 'content';
      return await runPipeline(pipelineId, payload, generateAI);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = {
  PIPELINE_A_STEPS,
  PIPELINE_B_STEPS,
  registerImperialPipelineHandlers,
  runPipeline,
};