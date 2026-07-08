/** Fired when the user switches the active workspace campaign. */
export const SI_CAMPAIGN_CHANGED = 'si-campaign-changed';

export function dispatchCampaignChanged(campaignId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_CAMPAIGN_CHANGED, { detail: { campaignId } }));
}