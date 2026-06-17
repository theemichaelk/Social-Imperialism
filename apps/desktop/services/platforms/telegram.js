const axios = require('axios');

function botApi(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function getProfile(botToken) {
  if (!botToken) return null;
  try {
    const res = await axios.get(botApi(botToken, 'getMe'));
    const d = res.data?.result || {};
    return {
      followers: 'N/A',
      likes: 'N/A',
      bestTime: 'Varies by channel audience',
      topTrendingNiche: 'Telegram channels in your niche',
      growthVelocity: `@${d.username || 'bot'}`,
      suggestedGroups: ['Telegram channels & groups'],
      raw: d,
    };
  } catch (e) {
    console.error('Telegram getMe error:', e.message);
    return null;
  }
}

async function discoverChat(botToken, chatId) {
  if (!botToken || !chatId) return null;
  try {
    const res = await axios.get(botApi(botToken, 'getChat'), { params: { chat_id: chatId } });
    const c = res.data?.result;
    if (!c) return null;
    return {
      platform: 'Telegram',
      handle: c.title || c.username || String(chatId),
      type: c.type === 'channel' ? 'Channel' : 'Group',
      id: String(c.id),
      chatId: String(c.id),
    };
  } catch (e) {
    console.error('Telegram getChat error:', e.message);
    return null;
  }
}

async function discoverAccounts(botToken, chatIdOrUsername, loginEmail) {
  const accounts = [];
  if (!botToken) return accounts;

  const profile = await getProfile(botToken);
  if (profile?.raw) {
    accounts.push({
      platform: 'Telegram',
      handle: `@${profile.raw.username || 'bot'}`,
      type: 'Bot',
      id: String(profile.raw.id),
      loginEmail,
    });
  }

  const chatRef = chatIdOrUsername || loginEmail;
  if (chatRef) {
    let chatId = chatRef;
    if (chatRef.startsWith('@')) chatId = chatRef;
    else if (!/^-?\d+$/.test(chatRef)) chatId = `@${chatRef.replace(/^@/, '')}`;
    const chat = await discoverChat(botToken, chatId);
    if (chat) accounts.push({ ...chat, loginEmail });
  }

  if (accounts.length) return accounts;
  return [{ platform: 'Telegram', handle: 'Telegram Bot', type: 'Bot', id: `tg_${Date.now()}`, loginEmail }];
}

async function publish(postData, botToken, chatId) {
  if (!botToken) throw new Error('Telegram bot token required');
  const target = chatId || postData.chatId;
  if (!target) throw new Error('Telegram chat/channel ID required');

  const res = await axios.post(botApi(botToken, 'sendMessage'), {
    chat_id: target,
    text: postData.content,
  });
  return res.data;
}

module.exports = { getProfile, discoverAccounts, discoverChat, publish };