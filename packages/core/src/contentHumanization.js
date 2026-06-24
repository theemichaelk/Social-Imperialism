/**
 * Content Humanization — Wordtune-style multi-step workflow for authentic, detection-resistant copy.
 * Used by Content Studio after initial AI draft generation.
 */

const HUMANIZATION_LEVELS = {
  off: { id: 'off', label: 'Off', stepIds: [] },
  light: {
    id: 'light',
    label: 'Light',
    stepIds: ['contextual', 'tone', 'proofread', 'anti-ai'],
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    stepIds: ['contextual', 'tone', 'proofread', 'continue', 'clarify', 'native', 'synonyms', 'anti-ai'],
  },
  maximum: {
    id: 'maximum',
    label: 'Maximum (human-native)',
    stepIds: [
      'contextual', 'tone', 'proofread', 'continue', 'facts', 'elaborate', 'clarify',
      'emphasis', 'conclusion', 'native', 'synonyms', 'paraphrase', 'expand-shorten',
      'sentence-flow', 'anti-ai', 'final-authentic',
    ],
  },
};

/** Full step catalog — do not omit steps at maximum level */
const HUMANIZATION_STEPS = [
  {
    id: 'contextual',
    label: 'Contextual rewrite',
    instruction: 'Rewrite the text so it perfectly matches the brand voice, subject matter, and audience intent. Use context-based suggestions — not keyword stuffing. Keep facts and meaning; change only how it is said.',
  },
  {
    id: 'tone',
    label: 'Tone calibration',
    instruction: 'Adjust tone to match the target (formal or casual as appropriate). Messaging must stay on point. Switch voice in one coherent pass — do not sound like a template.',
  },
  {
    id: 'proofread',
    label: 'Proofread',
    instruction: 'Fix spelling, grammar, punctuation, and awkward phrasing. Every sentence should read cleanly before publish.',
  },
  {
    id: 'continue',
    label: 'Continue & complete',
    instruction: 'If the draft ends abruptly, continue naturally where it left off. Add only what is needed — no filler. Avoid writer\'s-block phrasing ("In this post we will…").',
  },
  {
    id: 'facts',
    label: 'Credibility check',
    instruction: 'Remove invented statistics, fake quotes, or unverifiable claims. Keep only credible, general statements unless specific facts were in the source. Do not hallucinate sources.',
  },
  {
    id: 'elaborate',
    label: 'Elaborate with depth',
    instruction: 'Where a point is thin, add one concrete detail, example, or angle — still concise for social. Optional alternate viewpoint only if it strengthens the post.',
  },
  {
    id: 'clarify',
    label: 'Explain & clarify',
    instruction: 'Remove ambiguity. Improve flow between ideas. Make each sentence easy to understand on first read.',
  },
  {
    id: 'emphasis',
    label: 'Strengthen key points',
    instruction: 'Emphasize the main takeaway without hype or clichés. One clear hook, one clear CTA if appropriate.',
  },
  {
    id: 'conclusion',
    label: 'Natural conclusion',
    instruction: 'If the piece needs closure, add a brief, human sign-off or summary line — not "In conclusion" boilerplate.',
  },
  {
    id: 'native',
    label: 'Native English polish',
    instruction: 'Sound like a fluent native English speaker. Fix translated or stiff constructions. Natural contractions where appropriate for the tone.',
  },
  {
    id: 'synonyms',
    label: 'Vocabulary variety',
    instruction: 'Replace repeated words with context-appropriate synonyms. Do not use a thesaurus randomly — keep meaning precise.',
  },
  {
    id: 'paraphrase',
    label: 'Paraphrase & humanize',
    instruction: 'Rephrase so the content is original, context-based, and free of plagiarism patterns. Unique sentence structures; no AI-generic phrasing.',
  },
  {
    id: 'expand-shorten',
    label: 'Length & structure',
    instruction: 'Balance length for the platform: trim wordiness OR expand if too thin. Vary sentence length for rhythm and scannability.',
  },
  {
    id: 'sentence-flow',
    label: 'Sentence flow',
    instruction: 'Ensure paragraphs have logical structure. No overlapping ideas, clipped endings, or run-on social copy.',
  },
  {
    id: 'anti-ai',
    label: 'Anti-AI-detection pass',
    instruction: 'Remove tells: "Moreover", "Furthermore", "In today\'s digital landscape", "delve", "game-changer", "unlock", "leverage" (unless brand uses them), em-dash spam, numbered list overload, and robotic transitions. Write like a real person posting on social.',
  },
  {
    id: 'final-authentic',
    label: 'Final authenticity',
    instruction: 'Last pass: readable, intelligent, 100% human-written feel. Must pass AI content detection as human. Return ONLY the final post text — no meta commentary.',
  },
];

function getStepsForLevel(levelId) {
  const level = HUMANIZATION_LEVELS[levelId] || HUMANIZATION_LEVELS.standard;
  if (!level.stepIds.length) return [];
  return level.stepIds
    .map((id) => HUMANIZATION_STEPS.find((s) => s.id === id))
    .filter(Boolean);
}

function buildStepPrompt(step, content, meta = {}) {
  const tone = meta.tone || 'professional';
  const template = meta.templateLabel ? `Template style: ${meta.templateLabel}.` : '';
  const platform = meta.platform ? `Platform: ${meta.platform}.` : '';
  return `${step.instruction}

${template} ${platform} Target tone: ${tone}.

DRAFT TO TRANSFORM:
---
${content}
---

Return only the rewritten post text.`;
}

async function applyContentHumanization(deps, content, options = {}) {
  const { generateAIWithModel } = deps;
  if (!generateAIWithModel || !content?.trim()) return content;

  const levelId = options.humanizationLevel || options.level || 'standard';
  if (levelId === 'off') return content;

  const steps = getStepsForLevel(levelId);
  const model = options.humanizationModel || options.model || 'gemini';
  let current = content;

  for (const step of steps) {
    const prompt = buildStepPrompt(step, current, {
      tone: options.tone,
      templateLabel: options.templateLabel,
      platform: options.platform,
    });
    try {
      const rewritten = await generateAIWithModel(prompt, model);
      if (rewritten && String(rewritten).trim().length > 20) {
        current = String(rewritten).trim();
      }
    } catch (e) {
      console.warn(`[humanization] step ${step.id} failed:`, e.message);
    }
  }

  return current;
}

module.exports = {
  HUMANIZATION_LEVELS,
  HUMANIZATION_STEPS,
  getStepsForLevel,
  buildStepPrompt,
  applyContentHumanization,
};