/**
 * THEE_MICHAEL Security Control — static landing edge (socialimperialism.com)
 * Client-side probe scan, local containment, no secrets exposed.
 */
(function sovereignLandingShield() {
  var DOMAIN = 'socialimperialism.com';
  var BANNER = '🛡️ THEE_MICHAEL SECURITY REVIEW REQUIRED // SOCIALIMPERIALISM.COM PROTECTION ENFORCED';
  var PATTERNS = [
    /<script/i, /javascript:/i, /onerror\s*=/i, /union\s+select/i, /\.\.\//,
  ];

  function scan(text) {
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i].test(text)) return true;
    }
    return false;
  }

  var surface = (location.search || '') + (location.hash || '');
  if (!scan(surface)) return;

  try {
    sessionStorage.setItem('sov_landing_contained', JSON.stringify({
      at: new Date().toISOString(),
      domain: DOMAIN,
      surface: 'landing_query',
    }));
  } catch (e) { /* ignore */ }

  if (history.replaceState) {
    history.replaceState(null, '', location.pathname);
  }

  var bar = document.createElement('div');
  bar.setAttribute('role', 'alert');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 16px;background:#1e0f19;border-bottom:1px solid rgba(239,68,68,0.4);color:#fca5a5;font:600 12px/1.4 system-ui,sans-serif;text-align:center;';
  bar.textContent = BANNER + ' — Suspicious request contained on public landing. Sign in for full protection.';
  document.addEventListener('DOMContentLoaded', function () {
    document.body.prepend(bar);
    document.body.style.paddingTop = '48px';
  });
})();