const axios = require('axios');

const GRAPH = 'https://graph.facebook.com/v19.0';

async function getProfile(accessToken, phoneNumberId) {
  if (!accessToken || !phoneNumberId) return null;
  try {
    const res = await axios.get(`${GRAPH}/${phoneNumberId}`, {
      params: { fields: 'display_phone_number,verified_name,quality_rating', access_token: accessToken },
    });
    const d = res.data || {};
    return {
      followers: d.display_phone_number || 'Business',
      likes: d.quality_rating || 'N/A',
      bestTime: 'Business hours for your region',
      topTrendingNiche: 'WhatsApp Business messaging',
      growthVelocity: d.verified_name || 'Connected',
      suggestedGroups: ['WhatsApp broadcast lists'],
      raw: d,
    };
  } catch (e) {
    console.error('WhatsApp profile error:', e.message);
    return null;
  }
}

async function discoverAccounts(accessToken, phoneNumberId, loginEmail) {
  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp requires Business Access Token and Phone Number ID.');
  }

  const profile = await getProfile(accessToken, phoneNumberId);
  const name = profile?.raw?.verified_name || profile?.raw?.display_phone_number || loginEmail || 'WhatsApp Business';

  return [{
    platform: 'WhatsApp',
    handle: name,
    type: 'Business',
    id: phoneNumberId,
    phoneNumberId,
    loginEmail,
    accessToken,
  }];
}

async function publish(postData, accessToken, phoneNumberId) {
  if (!accessToken || !phoneNumberId) throw new Error('WhatsApp credentials required');
  const to = postData.recipientPhone || postData.to;
  if (!to) throw new Error('WhatsApp recipient phone number required (E.164 format, e.g. 15551234567)');

  const res = await axios.post(
    `${GRAPH}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: postData.content },
    },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

module.exports = { getProfile, discoverAccounts, publish };