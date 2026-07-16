export type FeedPost = {
  platform?: string;
  content?: string;
  text?: string;
  url?: string;
  author?: string;
  matchedKeyword?: string;
  createdAt?: string | number;
  externalId?: string;
  id?: string;
  stats?: { likes?: number; comments?: number; shares?: number; views?: number };
};

export type DashboardStats = {
  totalPosts?: number;
  aiDrafts?: number;
  totalEngagement?: number;
  activeKeywords?: number;
  linkedAccounts?: number;
  scheduled?: number;
  workerStatus?: string;
  autoRulesEnabled?: boolean;
  leadsGenerated?: number;
};

export type AiReply = {
  id?: string;
  replyContent?: string;
  content?: string;
  status?: string;
  platform?: string;
  originalPost?: string;
  author?: string;
  url?: string;
  matchedKeyword?: string;
  createdAt?: string;
};

export type LinkedAccount = {
  id?: string;
  accountId?: string;
  platform?: string;
  name?: string;
  username?: string;
};

export type BillingPlan = {
  plan?: string;
  planName?: string;
  status?: string;
  priceLabel?: string;
  billingEmail?: string;
};
