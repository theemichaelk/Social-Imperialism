/**
 * Signup + nurture email sequences for new subscribers.
 * Schedules via Prisma Job table; sends through desktop emailService.
 */
const path = require('path');
const { prisma } = require('@si/db');
const emailService = require(path.join(__dirname, '../../../desktop/services/emailService'));
const { resolveKeys } = require(path.join(__dirname, '../../../desktop/services/keys'));

const JOB_TYPE = 'onboarding_email';
const SEQUENCE_KEY = 'onboardingEmailSequence';

function webBase() {
  return (process.env.WEB_URL || 'https://www.socialimperialism.com').replace(/\/$/, '');
}

function renderVars(vars) {
  return {
    userName: vars.userName || 'there',
    email: vars.email || '',
    planName: vars.planName || 'Social Imperialism',
    webUrl: webBase(),
    loginUrl: `${webBase()}/login`,
    setupUrl: `${webBase()}/setup-account`,
    dashboardUrl: `${webBase()}/dashboard`,
    onboardingUrl: `${webBase()}/onboarding`,
    accountHubUrl: `${webBase()}/account-hub`,
    keywordsUrl: `${webBase()}/keywords`,
    browseUrl: `${webBase()}/browse-posts`,
    historyUrl: `${webBase()}/history`,
    contentHubUrl: `${webBase()}/content-hub`,
    calendarUrl: `${webBase()}/calendar`,
    rulesUrl: `${webBase()}/rules`,
    designStudioUrl: `${webBase()}/design-studio`,
    redditAiUrl: `${webBase()}/reddit-ai`,
    supportUrl: `${webBase()}/support`,
    desktopUrl: 'https://www.socialimperialism.com',
    year: String(new Date().getFullYear()),
  };
}

function buildSequenceSteps() {
  const base = renderVars({});
  return [
    {
      id: 'welcome_checkout',
      delayHours: 0,
      trigger: 'checkout_complete',
      subject: 'Welcome to {{planName}} — let’s get you live in 5 minutes',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;line-height:1.6;">
<h1 style="color:#0284c7;">You’re in, {{userName}} 🎯</h1>
<p>Your <strong>{{planName}}</strong> plan is active. Social Imperialism will monitor keywords, draft AI replies, and publish content across <strong>14+ platforms</strong> — while you focus on growth.</p>
<p><strong>Your first move:</strong> create your password (takes 30 seconds).</p>
<p><a href="{{setupUrl}}?email={{email}}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Set up password →</a></p>
<p style="font-size:0.9rem;color:#64748b;">Already set up? <a href="{{loginUrl}}">Sign in</a> · Desktop app available after login</p>
<p style="color:#64748b;font-size:0.85rem;">— Social Imperialism Growth Team</p>
</div>`,
    },
    {
      id: 'password_ready',
      delayHours: 0,
      trigger: 'password_setup_complete',
      subject: 'Password set — now teach the AI your brand voice',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;line-height:1.6;">
<h1 style="color:#0284c7;">Great start, {{userName}}</h1>
<p>Your account is secure. Next, spend <strong>5 minutes</strong> in the Setup Wizard: brand name, website, tone, and audience. This is what makes every AI reply sound like <em>you</em> — not a robot.</p>
<p><a href="{{onboardingUrl}}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Open Setup Wizard →</a></p>
<p style="font-size:0.9rem;color:#64748b;">Pro tip: paste 2–3 example replies you’ve written before — the AI learns your style faster.</p>
</div>`,
    },
    {
      id: 'day1_connect_accounts',
      delayHours: 24,
      trigger: 'sequence',
      subject: 'Day 1 — Connect one account (unlock everything)',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;line-height:1.6;">
<h2 style="color:#0284c7;">Hi {{userName}} — one connection unlocks the engine</h2>
<p>Link <strong>one</strong> platform today in Account Hub (X, LinkedIn, Meta, YouTube, TikTok, and 9 more). Secure OAuth — we never store your password.</p>
<p><a href="{{accountHubUrl}}" style="color:#0284c7;font-weight:600;">Connect in Account Hub →</a></p>
<p style="font-size:0.9rem;color:#64748b;">Pick the platform where your buyers already hang out. You can add the rest later.</p>
</div>`,
    },
    {
      id: 'day2_keywords',
      delayHours: 48,
      trigger: 'sequence',
      subject: 'Day 2: Keywords that find your ideal conversations',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;">
<h2 style="color:#0284c7;">Let AI suggest your keywords</h2>
<p>{{userName}}, open Keywords and click <strong>AI Suggest</strong> — we analyze your brand and propose high-intent terms. Add affiliate, Q&A, or client tags per keyword.</p>
<p><a href="{{keywordsUrl}}">Set up Keywords →</a></p>
</div>`,
    },
    {
      id: 'day3_browse_posts',
      delayHours: 72,
      trigger: 'sequence',
      subject: 'Day 3: Browse posts — your discovery command center',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;">
<h2 style="color:#0284c7;">Find conversations worth joining</h2>
<p>Browse Posts filters live matches across platforms. Save fetch profiles, preview AI replies, and engage without leaving the dashboard.</p>
<p><a href="{{browseUrl}}">Open Browse Posts →</a></p>
</div>`,
    },
    {
      id: 'day5_ai_replies',
      delayHours: 120,
      trigger: 'sequence',
      subject: 'Day 5: AI Replies that mention your brand naturally',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;">
<h2 style="color:#0284c7;">Draft → approve → publish</h2>
<p>Your AI Reply Engine uses brand tone and custom prompts. Review drafts in AI Replies, then publish or enable auto-mode.</p>
<p><a href="{{historyUrl}}">Open AI Replies →</a></p>
</div>`,
    },
    {
      id: 'day7_content_hub',
      delayHours: 168,
      trigger: 'sequence',
      subject: 'Day 7: Create & schedule content from one hub',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;">
<h2 style="color:#0284c7;">Content Hub + Calendar</h2>
<p>Write posts, attach media, generate images with AI, and schedule across accounts. Calendar shows everything queued.</p>
<p><a href="{{contentHubUrl}}">Open Content Hub →</a> · <a href="{{calendarUrl}}">Calendar</a></p>
</div>`,
    },
    {
      id: 'day10_auto_rules',
      delayHours: 240,
      trigger: 'sequence',
      subject: 'Day 10: Put growth on autopilot with Auto-Rules',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;">
<h2 style="color:#0284c7;">Be first to reply</h2>
<p>Auto-Rules watch keywords and accounts, run on a schedule, and respect rate limits. Enable <strong>Be First to Reply</strong> for real-time wins.</p>
<p><a href="{{rulesUrl}}">Configure Auto-Rules →</a></p>
</div>`,
    },
    {
      id: 'day14_design_grok',
      delayHours: 336,
      trigger: 'sequence',
      subject: 'Day 14: Visuals with Design Studio & Grok Engine',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;">
<h2 style="color:#0284c7;">Images, video, infographics</h2>
<p>Design Studio and Grok Engine create on-brand visuals without leaving the app. Use them in Content Hub for higher engagement.</p>
<p><a href="{{designStudioUrl}}">Open Design Studio →</a></p>
</div>`,
    },
    {
      id: 'day18_growth_lab',
      delayHours: 432,
      trigger: 'sequence',
      subject: 'Day 18: Growth Lab — Reddit & Quora traffic ops',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;">
<h2 style="color:#0284c7;">Answer questions that drive traffic</h2>
<p>Growth Lab and Quora Ops discover unanswered questions, draft answers, and track opportunities.</p>
<p><a href="{{redditAiUrl}}">Open Growth Lab →</a></p>
</div>`,
    },
    {
      id: 'day21_agency_tips',
      delayHours: 504,
      trigger: 'sequence',
      subject: 'Day 21: Manage multiple brands like an agency',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;">
<h2 style="color:#0284c7;">Multi-campaign switching</h2>
<p>Run separate brand profiles, keywords, and accounts per client. Switch campaigns from Settings or the sidebar campaign picker.</p>
<p><a href="{{dashboardUrl}}">Open Dashboard →</a></p>
</div>`,
    },
    {
      id: 'day30_power_user',
      delayHours: 720,
      trigger: 'sequence',
      subject: 'Day 30 — You’re a power user. Here’s how to scale',
      html: `<div style="font-family:Segoe UI,sans-serif;color:#0f172a;max-width:600px;line-height:1.6;">
<h2 style="color:#0284c7;">{{userName}}, you’ve built a real growth machine</h2>
<p>Thirty days in — here’s what top performers have running:</p>
<ul style="padding-left:1.2rem;">
<li><strong>Brand brain</strong> — tone + guidelines locked in</li>
<li><strong>Keyword radar</strong> — high-intent terms monitored daily</li>
<li><strong>AI replies</strong> — drafting while you sleep</li>
<li><strong>Content calendar</strong> — a week ahead, minimum</li>
<li><strong>Auto-Rules</strong> — first-to-reply on your best keywords</li>
</ul>
<p>Stuck on anything? <a href="{{supportUrl}}" style="color:#0284c7;">Live Support</a> is built into the app — real answers, not a chatbot script.</p>
<p style="color:#64748b;font-size:0.9rem;">Thank you for building with Social Imperialism. Now go dominate your niche.</p>
</div>`,
    },
  ].map((step) => ({
    ...step,
    subject: emailService.renderTemplate(step.subject, base),
  }));
}

function parseOrgSequence(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function getOrgSequenceState(organizationId) {
  const row = await prisma.orgSetting.findUnique({
    where: { organizationId_key: { organizationId, key: SEQUENCE_KEY } },
  });
  return parseOrgSequence(row?.value) || { enrolled: false, sentStepIds: [], enrolledAt: null };
}

async function saveOrgSequenceState(organizationId, state) {
  await prisma.orgSetting.upsert({
    where: { organizationId_key: { organizationId, key: SEQUENCE_KEY } },
    update: { value: JSON.stringify(state) },
    create: { organizationId, key: SEQUENCE_KEY, value: JSON.stringify(state) },
  });
}

function scheduleDate(hoursFromNow) {
  const date = new Date();
  date.setTime(date.getTime() + hoursFromNow * 60 * 60 * 1000);
  return date;
}

async function enqueueStepJob({ organizationId, projectId, stepId, email, userName, planName, runAt }) {
  const existing = await prisma.job.findFirst({
    where: {
      type: JOB_TYPE,
      status: 'pending',
      payload: { contains: `"stepId":"${stepId}"` },
    },
  });
  if (existing) return existing;

  return prisma.job.create({
    data: {
      type: JOB_TYPE,
      projectId: projectId || null,
      status: 'pending',
      runAt: runAt || new Date(),
      payload: JSON.stringify({
        stepId,
        email,
        userName,
        planName,
        organizationId,
      }),
    },
  });
}

async function enrollOnCheckout({ userId, organizationId, email, planName }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { skipped: true, reason: 'user_not_found' };

  const project = await prisma.project.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  const state = await getOrgSequenceState(organizationId);
  if (state.enrolled) {
    return { skipped: true, reason: 'already_enrolled' };
  }

  const steps = buildSequenceSteps();
  const checkoutStep = steps.find((s) => s.id === 'welcome_checkout');
  const sequenceSteps = steps.filter((s) => s.trigger === 'sequence');

  const jobs = [];
  if (checkoutStep) {
    jobs.push(await enqueueStepJob({
      organizationId,
      projectId: project?.id,
      stepId: checkoutStep.id,
      email,
      userName: user.name || email.split('@')[0],
      planName: planName || 'Social Imperialism',
      runAt: new Date(),
    }));
  }

  for (const step of sequenceSteps) {
    jobs.push(await enqueueStepJob({
      organizationId,
      projectId: project?.id,
      stepId: step.id,
      email,
      userName: user.name || email.split('@')[0],
      planName: planName || 'Social Imperialism',
      runAt: scheduleDate(step.delayHours),
    }));
  }

  await saveOrgSequenceState(organizationId, {
    enrolled: true,
    enrolledAt: new Date().toISOString(),
    email,
    userId,
    sentStepIds: [],
    pendingCount: jobs.length,
  });

  return { success: true, jobsScheduled: jobs.length };
}

async function enrollOnPasswordSetup({ userId, organizationId, email, planName }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { skipped: true, reason: 'user_not_found' };

  const project = await prisma.project.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  });

  const step = buildSequenceSteps().find((s) => s.id === 'password_ready');
  if (!step) return { skipped: true, reason: 'step_not_found' };

  await enqueueStepJob({
    organizationId,
    projectId: project?.id,
    stepId: step.id,
    email,
    userName: user.name || email.split('@')[0],
    planName: planName || 'Social Imperialism',
    runAt: new Date(),
  });

  return { success: true, stepId: step.id };
}

async function deliverJob(job) {
  let payload = {};
  try {
    payload = job.payload ? JSON.parse(job.payload) : {};
  } catch (e) {
    throw new Error('Invalid job payload');
  }

  const step = buildSequenceSteps().find((s) => s.id === payload.stepId);
  if (!step) throw new Error(`Unknown sequence step: ${payload.stepId}`);

  const vars = renderVars({
    userName: payload.userName || 'there',
    email: payload.email,
    planName: payload.planName || 'Social Imperialism',
  });

  const subject = emailService.renderTemplate(step.subject, vars);
  const html = emailService.renderTemplate(step.html, vars);

  const keys = resolveKeys({});
  const sent = await emailService.sendEmail(keys, {
    to: payload.email,
    subject,
    html,
    shortenLinks: true,
  });

  if (payload.organizationId) {
    const state = await getOrgSequenceState(payload.organizationId);
    const sentStepIds = Array.isArray(state.sentStepIds) ? state.sentStepIds : [];
    if (!sentStepIds.includes(payload.stepId)) {
      sentStepIds.push(payload.stepId);
    }
    await saveOrgSequenceState(payload.organizationId, {
      ...state,
      sentStepIds,
      lastSentAt: new Date().toISOString(),
    });
  }

  return { ...sent, stepId: payload.stepId, to: payload.email };
}

async function processDueJobs() {
  const due = await prisma.job.findMany({
    where: {
      type: JOB_TYPE,
      status: 'pending',
      runAt: { lte: new Date() },
    },
    orderBy: { runAt: 'asc' },
    take: parseInt(process.env.ONBOARDING_EMAIL_BATCH || '10', 10),
  });

  const results = [];
  for (const job of due) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'running', updatedAt: new Date() },
    });
    try {
      const result = await deliverJob(job);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'completed', result: JSON.stringify(result), updatedAt: new Date() },
      });
      results.push({ jobId: job.id, ok: true, stepId: result.stepId });
    } catch (e) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'failed', result: JSON.stringify({ error: e.message }), updatedAt: new Date() },
      });
      results.push({ jobId: job.id, ok: false, error: e.message });
      console.warn(`[onboardingEmail] job ${job.id}:`, e.message);
    }
  }
  return results;
}

module.exports = {
  JOB_TYPE,
  buildSequenceSteps,
  enrollOnCheckout,
  enrollOnPasswordSetup,
  processDueJobs,
  deliverJob,
};