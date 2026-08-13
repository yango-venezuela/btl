(() => {
  if (typeof window === "undefined") return;
  // Disabled on purpose: influencer persistence is now handled only by activation-status-sync.js.
  // Keeping this file as a no-op prevents older injected script tags from running a second,
  // competing sync loop that could resurrect deleted influencer rows from stale local copies.
  window.__yangoAuthoritativeInfluencerSyncV1 = true;
  window.__yangoAuthoritativeInfluencerSyncV2 = true;
  window.__yangoAuthoritativeInfluencerSyncV3 = true;
  window.__yangoAuthoritativeInfluencerSyncDisabled = true;
})();
