const twitter = require('./platforms/twitter');
const linkedin = require('./platforms/linkedin');
const meta = require('./platforms/meta');
const reddit = require('./platforms/reddit');
const tiktok = require('./platforms/tiktok');
const discord = require('./platforms/discord');
const pinterest = require('./platforms/pinterest');
const telegram = require('./platforms/telegram');
const whatsapp = require('./platforms/whatsapp');
const youtube = require('./platforms/youtube');
const quora = require('./platforms/quora');
const { parseTokens } = require('./intelligenceProfile');
const { waitBeforeAction, humanizeContent } = require('./humanBehavior');
const { findAccountById } = require('./accountAutomation');

async function publishPost(postData, keys, linkedAccounts, options = {}) {
  const humanLike = options.humanLike !== false && postData.humanLike !== false;
  const account = findAccountById(linkedAccounts, postData.accountId)
    || linkedAccounts.find((a) => a.platform === postData.platform);
  const tokens = account ? parseTokens(account) : null;
  const accessToken = tokens?.access_token;

  if (humanLike && account?.settings) {
    await waitBeforeAction(account.settings);
  }

  const content = humanLike && postData.content
    ? humanizeContent(postData.content, account?.settings)
    : postData.content;

  const payload = { ...postData, content };
  const platform = postData.platform || account?.platform;

  switch (platform) {
    case 'Twitter':
    case 'X':
    case 'Twitter / X':
      return twitter.publish(payload, keys, accessToken);

    case 'LinkedIn':
    case 'LinkedIn Page':
      return linkedin.publish({
        ...payload,
        accountType: account?.type,
        pageId: account?.type === 'Page' ? account.id : null,
        orgUrn: account?.orgUrn,
      }, accessToken || keys.linkedinAccessToken);

    case 'Facebook':
    case 'Facebook Page':
    case 'Facebook Group':
    case 'Instagram':
    case 'Facebook Fanpage':
      return meta.publish(
        payload,
        accessToken || keys.metaAccess,
        account?.type === 'Page' || account?.type === 'Group' ? account.id : null,
        account?.type || postData.targetType
      );

    case 'Reddit': {
      const subreddit = payload.subreddit
        || account?.subreddit
        || (account?.type === 'Subreddit' ? account.id : null);
      return reddit.publish({ ...payload, subreddit }, keys, accessToken);
    }

    case 'Discord':
      return discord.publishToGuild(payload, keys.discordBotToken, payload.channelId || account?.channelId);

    case 'TikTok':
      return tiktok.publish(payload, accessToken);

    case 'Pinterest':
      throw new Error('Pinterest pin publishing requires board selection — use Content Hub scheduled post.');

    case 'Telegram':
      return telegram.publish(payload, accessToken || keys.telegramBotToken, payload.chatId || account?.chatId || account?.id);

    case 'WhatsApp':
      return whatsapp.publish(
        payload,
        accessToken || keys.whatsappAccessToken || keys.metaAccess,
        account?.phoneNumberId || tokens?.phone_number_id || keys.whatsappPhoneNumberId
      );

    case 'YouTube':
    case 'YouTube Channel':
      return youtube.publish(
        payload,
        accessToken,
        account?.id && !String(account.id).startsWith('yt_') ? account.id : null,
      );

    case 'Quora':
      return quora.publish(payload, tokens, account);

    default:
      throw new Error(`Publishing to ${platform || 'unknown'} is not supported. Link the account and configure API keys in Settings.`);
  }
}

module.exports = { publishPost };