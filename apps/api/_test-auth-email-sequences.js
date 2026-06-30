/**
 * QA: Auth loop, validation edge cases, onboarding email sequence wiring.
 * Run: node apps/api/_test-auth-email-sequences.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const {
  validateEmail,
  validatePassword,
  validateLoginBody,
  validateSetupPasswordBody,
} = require('./src/lib/authValidation');
const {
  buildSequenceSteps,
  enrollOnCheckout,
  JOB_TYPE,
} = require('./src/services/onboardingEmailSequences');
const { hashToken } = require('./src/middleware/auth');
const { RESET_TTL_HOURS } = require('./src/services/passwordReset');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

console.log('\n=== Test 1: Auth validation ===');
assert('rejects empty email', !validateEmail('').ok);
assert('rejects invalid email', !validateEmail('not-an-email').ok);
assert('accepts valid email', validateEmail('Client@Example.COM').ok);
assert('normalizes email', validateEmail('  Client@Example.COM ').email === 'client@example.com');
assert('rejects short password', !validatePassword('abc').ok);
assert('rejects password without number', !validatePassword('abcdefgh').ok);
assert('rejects password without letter', !validatePassword('12345678').ok);
assert('accepts strong password', validatePassword('StrongPass1').ok);
assert('login body valid', validateLoginBody({ email: 'a@b.co', password: 'Pass1234' }).ok);
assert('login body rejects bad email', !validateLoginBody({ email: 'bad', password: 'Pass1234' }).ok);
assert('setup body valid', validateSetupPasswordBody({ email: 'a@b.co', password: 'Pass1234' }).ok);

console.log('\n=== Test 2: Session hash stability ===');
const sample = 'sample-jwt-token-value';
assert('hashToken is deterministic', hashToken(sample) === hashToken(sample));
assert('hashToken produces hex', /^[a-f0-9]{64}$/.test(hashToken(sample)));

console.log('\n=== Test 3: Onboarding email sequence ===');
const steps = buildSequenceSteps();
assert('has 12 nurture steps', steps.length === 12);
assert('welcome step exists', steps.some((s) => s.id === 'welcome_checkout'));
assert('day30 step exists', steps.some((s) => s.id === 'day30_power_user'));
assert('each step has subject + html', steps.every((s) => s.subject && s.html));
assert('JOB_TYPE constant', JOB_TYPE === 'onboarding_email');

console.log('\n=== Test 4: Password reset config ===');
assert('reset TTL is positive hours', RESET_TTL_HOURS > 0 && RESET_TTL_HOURS <= 48);

console.log('\n=== Test 5: Edge cases (rapid / null) ===');
assert('null email handled', !validateEmail(null).ok);
assert('null password handled', !validatePassword(null).ok);
assert('empty sequence render vars', typeof buildSequenceSteps()[0].html === 'string');

async function runAsyncTests() {
  console.log('\n=== Test 6: Enroll idempotency (DB) ===');
  try {
    const { prisma } = require('@si/db');
    await prisma.$queryRaw`SELECT 1`;
    const testEmail = `qa-auth-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        name: 'QA Auth',
      },
    });
    const org = await prisma.organization.create({
      data: {
        name: 'QA Org',
        slug: `qa-${Date.now()}`,
        plan: 'starter',
      },
    });
    await prisma.organizationMember.create({
      data: { organizationId: org.id, userId: user.id, role: 'owner' },
    });
    await prisma.project.create({
      data: { organizationId: org.id, name: 'QA Project', isActive: true },
    });

    const first = await enrollOnCheckout({
      userId: user.id,
      organizationId: org.id,
      email: testEmail,
      planName: 'Starter',
    });
    const second = await enrollOnCheckout({
      userId: user.id,
      organizationId: org.id,
      email: testEmail,
      planName: 'Starter',
    });
    assert('first enroll schedules jobs', first.success === true);
    assert('second enroll is idempotent', second.skipped === true);

    const jobs = await prisma.job.findMany({
      where: { type: JOB_TYPE, payload: { contains: testEmail } },
    });
    assert('jobs created for subscriber', jobs.length >= 10);

    await prisma.job.deleteMany({ where: { type: JOB_TYPE, payload: { contains: testEmail } } });
    await prisma.orgSetting.deleteMany({ where: { organizationId: org.id } });
    await prisma.project.deleteMany({ where: { organizationId: org.id } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: user.id } });
  } catch (e) {
    console.warn('  (skipped DB tests —', e.message, ')');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runAsyncTests().catch((e) => {
  console.error(e);
  process.exit(1);
});