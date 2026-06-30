/**
 * Verification state machine for Social Imperialism verified infrastructure nodes.
 *
 * DISCOVERED → PENDING_VERIFICATION → TIER1_PASSED → TIER2_PASSED → VERIFIED
 * Any tier fail → REPAIR_LOOP (strike 1–3) → AWAITING_ACTION (strike 3 exhausted)
 * Continuous mode re-queues from AWAITING_ACTION / REPAIR_LOOP every 15 min
 */
const STATES = {
  DISCOVERED: 'DISCOVERED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  TIER1_PASSED: 'TIER1_PASSED',
  TIER2_PASSED: 'TIER2_PASSED',
  VERIFIED: 'VERIFIED',
  REPAIR_LOOP: 'REPAIR_LOOP',
  AWAITING_ACTION: 'AWAITING_ACTION',
  FROZEN: 'FROZEN',
};

const TIER_STATE_MAP = {
  1: STATES.TIER1_PASSED,
  2: STATES.TIER2_PASSED,
  3: STATES.VERIFIED,
};

function canBindToCampaign(node) {
  return node.verificationState === STATES.VERIFIED
    && node.lastTestSuccessAt
    && node.lastTierPassed >= 3;
}

function tierForState(state) {
  if (state === STATES.TIER1_PASSED) return 1;
  if (state === STATES.TIER2_PASSED) return 2;
  if (state === STATES.VERIFIED) return 3;
  return 0;
}

function nextTier(currentState) {
  const passed = tierForState(currentState);
  if (passed >= 3) return null;
  return passed + 1;
}

function stateAfterTierSuccess(tier) {
  return TIER_STATE_MAP[tier] || STATES.PENDING_VERIFICATION;
}

function stateAfterTierFailure(previousState, strikeCount) {
  if (strikeCount >= 3) return STATES.AWAITING_ACTION;
  return STATES.REPAIR_LOOP;
}

module.exports = {
  STATES,
  TIER_STATE_MAP,
  canBindToCampaign,
  tierForState,
  nextTier,
  stateAfterTierSuccess,
  stateAfterTierFailure,
};