/**
 * Phase 1: Required entity fields per platform/ecosystem.
 * Discovery must populate entityData with these keys before verification.
 */
const PLATFORM_DISCOVERY_SCHEMA = {
  Facebook: {
    nodeTypes: ['Page', 'Group', 'Profile'],
    requiredFields: {
      Page: ['page_id', 'page_name', 'category', 'access_token'],
      Group: ['group_id', 'member_count', 'posting_privacy'],
      Profile: ['user_id', 'name'],
    },
  },
  Instagram: {
    nodeTypes: ['Profile', 'Business'],
    requiredFields: {
      Profile: ['page_id', 'page_name', 'category'],
      Business: ['page_id', 'page_name', 'access_token'],
    },
  },
  WhatsApp: {
    nodeTypes: ['Business'],
    requiredFields: {
      Business: ['phone_number_id', 'waba_id', 'template_ids', 'group_chat_jids'],
    },
  },
  Threads: {
    nodeTypes: ['Profile'],
    requiredFields: {
      Profile: ['pk_id', 'follower_count', 'username'],
    },
  },
  YouTube: {
    nodeTypes: ['Channel', 'Brand'],
    requiredFields: {
      Channel: ['channel_id', 'title', 'handle', 'uploads_playlist_id'],
      Brand: ['channel_id', 'title', 'handle', 'uploads_playlist_id'],
    },
  },
  TikTok: {
    nodeTypes: ['Creator', 'Business'],
    requiredFields: {
      Creator: ['creator_id', 'account_type', 'webhook_states'],
      Business: ['creator_id', 'account_type', 'webhook_states'],
    },
  },
  Snapchat: {
    nodeTypes: ['Publisher', 'AdAccount'],
    requiredFields: {
      Publisher: ['publisher_id', 'public_profile_ids', 'billing_permissions'],
      AdAccount: ['publisher_id', 'public_profile_ids'],
    },
  },
  Twitter: {
    nodeTypes: ['Profile', 'Community'],
    requiredFields: {
      Profile: ['user_id', 'username'],
      Community: ['community_id', 'name'],
    },
  },
  LinkedIn: {
    nodeTypes: ['Person', 'Organization'],
    requiredFields: {
      Person: ['person_urn'],
      Organization: ['organization_urn', 'admin_role'],
    },
  },
  Reddit: {
    nodeTypes: ['User', 'Subreddit'],
    requiredFields: {
      User: ['reddit_id', 'username'],
      Subreddit: ['subreddit_id', 'name', 'user_flair_rules'],
    },
  },
  Quora: {
    nodeTypes: ['Profile', 'Space'],
    requiredFields: {
      Profile: ['profile_slug'],
      Space: ['space_slug', 'content_distribution_weight'],
    },
  },
  Discord: {
    nodeTypes: ['Guild', 'Channel'],
    requiredFields: {
      Guild: ['guild_id', 'name'],
      Channel: ['channel_id', 'guild_id', 'send_messages'],
    },
  },
  Pinterest: {
    nodeTypes: ['Profile', 'Board', 'Section'],
    requiredFields: {
      Profile: ['user_id'],
      Board: ['board_id', 'category', 'sections'],
      Section: ['section_id', 'board_id'],
    },
  },
  Twitch: {
    nodeTypes: ['Broadcaster'],
    requiredFields: {
      Broadcaster: ['broadcaster_id', 'login', 'stream_config'],
    },
  },
  Telegram: {
    nodeTypes: ['Bot', 'Channel', 'Group'],
    requiredFields: {
      Bot: ['bot_id', 'username'],
      Channel: ['chat_id', 'admin_rights_mask'],
      Group: ['chat_id', 'admin_rights_mask'],
    },
  },
};

const ALL_PLATFORMS = Object.keys(PLATFORM_DISCOVERY_SCHEMA);

function normalizePlatform(name) {
  const n = String(name || '').trim();
  if (n === 'X' || n.includes('Twitter')) return 'Twitter';
  return n.replace(/ Communities| Groups| Fanpages?/gi, '').trim() || n;
}

function getSchema(platform) {
  return PLATFORM_DISCOVERY_SCHEMA[normalizePlatform(platform)] || null;
}

function validateEntityData(platform, nodeType, entityData) {
  const schema = getSchema(platform);
  if (!schema) return { ok: false, error: `No discovery schema for ${platform}` };
  const required = schema.requiredFields[nodeType];
  if (!required) return { ok: false, error: `Unknown node type ${nodeType} for ${platform}` };
  const data = typeof entityData === 'string' ? JSON.parse(entityData) : (entityData || {});
  const missing = required.filter((k) => data[k] == null || data[k] === '');
  if (missing.length) {
    return { ok: false, error: `Missing fields: ${missing.join(', ')}`, missing, populated: data };
  }
  return { ok: true, entityData: data, requiredCount: required.length };
}

/**
 * Map linked account / group object from accountAutomation into verified node rows.
 */
function mapAccountToNodes(account, projectId, parentNodeId = null) {
  const platform = normalizePlatform(account.platform);
  const nodes = [];
  const base = {
    projectId,
    socialAccountId: account.id,
    connectionId: account.connectionId || null,
    parentNodeId,
    platform,
    depth: parentNodeId ? 1 : 0,
  };

  const rootType = account.type || account.accountType || 'Profile';
  nodes.push({
    ...base,
    nodeType: rootType,
    externalId: String(account.externalId || account.id || account.handle || `${platform}_${Date.now()}`),
    displayName: account.name || account.handle || platform,
    entityData: extractEntityData(platform, rootType, account),
    privacyState: account.privacy || account.posting_privacy || null,
    memberCount: account.member_count || account.memberCount || null,
  });

  for (const g of account.groups || []) {
    const gType = g.type || 'Group';
    nodes.push({
      ...base,
      parentNodeId: null,
      nodeType: gType,
      externalId: String(g.id || g.group_id || g.channel_id || g.subreddit_id || `${gType}_${g.name}`),
      displayName: g.name || g.title || gType,
      depth: 1,
      entityData: extractEntityData(platform, gType, g),
      privacyState: g.posting_privacy || g.privacy || null,
      memberCount: g.member_count || g.memberCount || null,
    });
  }

  return nodes;
}

function extractEntityData(platform, nodeType, raw) {
  const p = normalizePlatform(platform);
  const pick = (...keys) => {
    const out = {};
    for (const k of keys) {
      if (raw[k] != null) out[k] = raw[k];
    }
    return out;
  };

  switch (p) {
    case 'Facebook':
      if (nodeType === 'Group') return pick('group_id', 'member_count', 'posting_privacy', 'id', 'name');
      return pick('page_id', 'page_name', 'category', 'access_token', 'id', 'name');
    case 'Instagram':
      return pick('page_id', 'page_name', 'category', 'access_token', 'id', 'username');
    case 'WhatsApp':
      return pick('phone_number_id', 'waba_id', 'template_ids', 'group_chat_jids');
    case 'Threads':
      return pick('pk_id', 'follower_count', 'username', 'id');
    case 'YouTube':
      return pick('channel_id', 'title', 'handle', 'uploads_playlist_id', 'id');
    case 'TikTok':
      return pick('creator_id', 'account_type', 'webhook_states', 'open_id');
    case 'Snapchat':
      return pick('publisher_id', 'public_profile_ids', 'billing_permissions');
    case 'Twitter':
      return pick('user_id', 'username', 'community_id', 'id');
    case 'LinkedIn':
      return pick('person_urn', 'organization_urn', 'admin_role', 'id');
    case 'Reddit':
      return pick('subreddit_id', 'user_flair_rules', 'reddit_id', 'username', 'name');
    case 'Quora':
      return pick('space_slug', 'profile_slug', 'content_distribution_weight');
    case 'Discord':
      return pick('guild_id', 'channel_id', 'send_messages', 'id', 'name');
    case 'Pinterest':
      return pick('board_id', 'category', 'sections', 'section_id', 'user_id');
    case 'Twitch':
      return pick('broadcaster_id', 'login', 'stream_config', 'id');
    case 'Telegram':
      return pick('chat_id', 'bot_id', 'admin_rights_mask', 'username');
    default:
      return { ...raw };
  }
}

module.exports = {
  PLATFORM_DISCOVERY_SCHEMA,
  ALL_PLATFORMS,
  normalizePlatform,
  getSchema,
  validateEntityData,
  mapAccountToNodes,
  extractEntityData,
};