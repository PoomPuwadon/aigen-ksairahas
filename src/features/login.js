import { sb } from '../config.js';
import { state } from '../state.js';
import { unwrapSingle } from '../views.js';
import { armAdminSession } from './admin.js';
import { enterBetsim } from './betsim.js';

const usernameInput = document.getElementById('username');
const suggestList = document.getElementById('suggest-list');
let suggestDebounce = null;
let activeSuggestions = [];
let activeIndex = -1;

async function fetchSuggestions(q) {
  const { data, error } = await sb.rpc('search_lilbro_nicknames', { prefix: q });
  if (error || !data) {
    hideSuggestions();
    return;
  }
  const qLower = q.toLowerCase();
  activeSuggestions = data.sort((a, b) => {
    const aMatch = a.nickname ? a.nickname.toLowerCase().startsWith(qLower) : false;
    const bMatch = b.nickname ? b.nickname.toLowerCase().startsWith(qLower) : false;
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0;
  });
  activeIndex = -1;
  renderSuggestions();
}

function renderSuggestions() {
  if (activeSuggestions.length === 0) {
    hideSuggestions();
    return;
  }
  suggestList.innerHTML = '';
  activeSuggestions.forEach((u, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggest-item' + (i === activeIndex ? ' active' : '');
    const branchDisplay = u.branch ? `ภาค${u.branch}` : '';
    const sub = [u.first_name, branchDisplay].filter(Boolean).join(' · ');
    btn.innerHTML =
      `<span class="u-nickname">น้อง${u.nickname}</span>` + (sub ? `<span class="u-sub">${sub}</span>` : '');
    btn.addEventListener('click', () => chooseSuggestion(u));
    suggestList.appendChild(btn);
  });
  suggestList.classList.remove('hidden');
}

function chooseSuggestion(u) {
  state.selectedLilbro = u;
  usernameInput.value = `น้อง${u.nickname} (${u.first_name})`;
  hideSuggestions();
}

function hideSuggestions() {
  suggestList.classList.add('hidden');
  activeSuggestions = [];
  activeIndex = -1;
}

export function initLogin(onLoggedIn) {
  usernameInput.addEventListener('input', () => {
    state.selectedLilbro = null;
    const q = usernameInput.value.trim();
    clearTimeout(suggestDebounce);
    if (!q) {
      hideSuggestions();
      return;
    }
    suggestDebounce = setTimeout(() => fetchSuggestions(q), 200);
  });

  usernameInput.addEventListener('keydown', (e) => {
    if (suggestList.classList.contains('hidden') || activeSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, activeSuggestions.length - 1);
      renderSuggestions();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderSuggestions();
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        chooseSuggestion(activeSuggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.field')) {
      hideSuggestions();
    }
  });

  document.getElementById('login-btn').addEventListener('click', async () => {
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    // Stealth admin trigger: try the raw typed text as the admin password.
    // If it matches, silently arm the K badge — nothing visible happens here.
    // The normal login flow below still runs either way, so the field shows
    // its usual "select a name" error exactly as it would for a mistyped name.
    const typedText = usernameInput.value.trim();
    if (typedText) {
      const { data: adminData, error: adminErr } = await sb.rpc('admin_login', { p_password: typedText });
      if (!adminErr && adminData) {
        await armAdminSession(adminData);
      }

      // Secret keyword for the hidden betsim site — server-verified, one-way trip,
      // full-screen takeover. If it matches, we stop here entirely.
      const { data: betsimMatch, error: betsimErr } = await sb.rpc('check_betsim_keyword', { p_text: typedText });
      if (!betsimErr && betsimMatch === true) {
        enterBetsim();
        return;
      }
    }

    if (!state.selectedLilbro) {
      errorEl.textContent = 'กรุณาเลือกชื่อน้องจากรายการค้นหา';
      return;
    }

    const { data, error } = await sb.rpc('get_lilbro_hints', { p_first_name: state.selectedLilbro.first_name });
    const result = unwrapSingle(data);
    if (error || !result) {
      errorEl.textContent = 'ไม่พบข้อมูล กรุณาเลือกจากรายการค้นหาอีกครั้ง';
      return;
    }

    state.currentUser = result;
    onLoggedIn();
  });
}
