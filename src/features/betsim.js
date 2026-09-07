import { BETSIM_URL } from '../theme.js';

const betsimTakeover = document.getElementById('betsim-takeover');
const betsimLoading = document.getElementById('betsim-loading');
const betsimIframeWrap = document.getElementById('betsim-iframe-wrap');
const betsimIframe = document.getElementById('betsim-iframe');

// One-way, full-screen iframe takeover triggered by a secret keyword typed
// into the login field (checked server-side, see features/login.js and the
// check_betsim_keyword RPC in supabase/schema.sql).
export function enterBetsim() {
  betsimTakeover.classList.remove('hidden');
  betsimLoading.classList.remove('hidden');
  betsimIframeWrap.classList.add('hidden');

  const MIN_LOADING_MS = 3000;
  const startTime = Date.now();
  let iframeLoaded = false;
  let revealed = false;

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    betsimLoading.classList.add('hidden');
    betsimIframeWrap.classList.remove('hidden');
  };

  const tryReveal = () => {
    const remaining = MIN_LOADING_MS - (Date.now() - startTime);
    if (remaining > 0) {
      setTimeout(reveal, remaining);
    } else {
      reveal();
    }
  };

  betsimIframe.onload = () => {
    iframeLoaded = true;
    tryReveal();
  };
  betsimIframe.src = BETSIM_URL;

  // Fallback in case onload never fires (e.g. blocked) — still respects the
  // 3s minimum, just via a longer cap so we don't wait forever either.
  setTimeout(() => {
    if (!iframeLoaded) tryReveal();
  }, 6000);
}
