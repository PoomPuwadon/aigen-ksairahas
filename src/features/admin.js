import { sb } from '../config.js';
import { fetchGuessPhase } from '../views.js';
import { ADMIN_UNLOCK_CLICKS, ADMIN_CLICK_RESET_MS } from '../theme.js';

const adminBadge = document.getElementById('admin-k-badge');
const adminConfirmModal = document.getElementById('admin-confirm-modal');
const adminConfirmYes = document.getElementById('admin-confirm-yes');
const adminConfirmNo = document.getElementById('admin-confirm-no');
const adminOverlay = document.getElementById('admin-overlay');
const adminPanelContent = document.getElementById('admin-panel-content');
const adminCloseBtn = document.getElementById('admin-close-btn');
const adminOpenDateInput = document.getElementById('admin-open-date-input');
const adminRevealDateInput = document.getElementById('admin-reveal-date-input');
const adminOpenCountdown = document.getElementById('admin-open-countdown');
const adminRevealCountdown = document.getElementById('admin-reveal-countdown');
const adminSaveDatesBtn = document.getElementById('admin-save-dates-btn');
const adminDatesError = document.getElementById('admin-dates-error');
const adminSummaryList = document.getElementById('admin-summary-list');
const adminRefreshSummaryBtn = document.getElementById('admin-refresh-summary-btn');

let adminClickCount = 0;
let adminClickResetTimer = null;
let adminToken = localStorage.getItem('admin_token') || null; // "armed" state — set only via the namebar trick
let adminCountdownTimer = null;
let adminOpenDateIso = null;
let adminRevealDateIso = null;

function bumpAdminClick() {
  // Not armed yet (never typed the password, or the stored session already expired) —
  // stay completely silent, no feedback of any kind, so an idle clicker learns nothing.
  if (!adminToken) return;

  adminClickCount++;
  clearTimeout(adminClickResetTimer);
  adminClickResetTimer = setTimeout(() => {
    adminClickCount = 0;
  }, ADMIN_CLICK_RESET_MS);
  if (adminClickCount >= ADMIN_UNLOCK_CLICKS) {
    adminClickCount = 0;
    adminConfirmModal.classList.remove('hidden');
  }
}

async function openAdminOverlay() {
  const ok = await tryLoadAdminPanel();
  if (!ok) return; // token turned out to be invalid/expired — silently do nothing, stay disarmed
  adminOverlay.classList.remove('hidden');
}

function closeAdminOverlay() {
  adminOverlay.classList.add('hidden');
  clearInterval(adminCountdownTimer);
}

// Called from the namebar login handler when the typed text matches the admin password.
export async function armAdminSession(token) {
  adminToken = token;
  localStorage.setItem('admin_token', adminToken);
}

async function tryLoadAdminPanel() {
  const dateOk = await loadAdminDates();
  const summaryOk = await loadAdminSummary();
  if (!dateOk || !summaryOk) {
    adminToken = null;
    localStorage.removeItem('admin_token');
    return false;
  }
  adminPanelContent.classList.remove('hidden');
  return true;
}

function toDatetimeLocalValue(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatCountdown(targetIso) {
  if (!targetIso) return '';
  const target = new Date(targetIso).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return 'ถึงเวลาแล้ว';
  const d = Math.floor(diff / 86400000);
  const hr = Math.floor((diff % 86400000) / 3600000);
  const min = Math.floor((diff % 3600000) / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  return `เหลืออีก ${d > 0 ? d + ' วัน ' : ''}${hr} ชม. ${min} นาที ${sec} วิ.`;
}

async function loadAdminDates() {
  const { data: phaseData, error } = await fetchGuessPhase(sb);
  if (error || !phaseData) return false;
  adminOpenDateIso = phaseData.guess_open_date;
  adminRevealDateIso = phaseData.guess_reveal_date;
  adminOpenDateInput.value = toDatetimeLocalValue(adminOpenDateIso);
  adminRevealDateInput.value = toDatetimeLocalValue(adminRevealDateIso);

  clearInterval(adminCountdownTimer);
  const tick = () => {
    adminOpenCountdown.textContent = formatCountdown(adminOpenDateIso);
    adminRevealCountdown.textContent = formatCountdown(adminRevealDateIso);
  };
  tick();
  adminCountdownTimer = setInterval(tick, 1000);
  return true;
}

async function loadAdminSummary() {
  if (!adminToken) return false;
  const { data, error } = await sb.rpc('admin_get_summary', { p_admin_token: adminToken });
  if (error || data === null) return false;

  const isRevealed = !!data.is_revealed;
  const groups = data.groups || [];

  adminSummaryList.innerHTML = '';
  groups.forEach((group) => {
    // Only color-code once revealed, and only when the line actually answered —
    // an unanswered line stays neutral either way.
    let status = 'neutral';
    if (isRevealed && group.any_guessed) {
      status = group.group_correct ? 'correct' : 'wrong';
    }

    const el = document.createElement('div');
    el.className = 'admin-bigbro-group' + (status !== 'neutral' ? ` ${status}` : '');

    const header = document.createElement('div');
    header.className = 'admin-bigbro-header';
    const branchLabel = group.bigbro_branch ? `ภาค${group.bigbro_branch}` : '';
    let dotHtml = '';
    if (status === 'correct') dotHtml = '<span class="admin-correct-dot" title="มีคนทายถูก"></span>';
    else if (status === 'wrong') dotHtml = '<span class="admin-wrong-dot" title="ทายผิดทั้งกลุ่ม"></span>';
    header.innerHTML = `
      <span><span class="abh-name">พี่${group.bigbro_first_name}</span><span class="abh-branch">${branchLabel}</span></span>
      ${dotHtml}
    `;
    header.addEventListener('click', () => el.classList.toggle('open'));

    const list = document.createElement('div');
    list.className = 'admin-lilbro-list';
    (group.lilbros || []).forEach((l) => {
      const row = document.createElement('div');
      row.className = 'admin-lilbro-row';
      let guessClass = 'empty';
      let guessText = 'ยังไม่ทาย';
      if (l.guess) {
        guessClass = l.is_correct ? 'correct' : 'wrong';
        guessText = l.guess;
      }
      row.innerHTML = `<span>น้อง${l.nickname}</span><span class="alr-guess ${guessClass}">${guessText}</span>`;
      list.appendChild(row);
    });

    el.appendChild(header);
    el.appendChild(list);
    adminSummaryList.appendChild(el);
  });
  return true;
}

export function initAdmin() {
  adminBadge.addEventListener('click', bumpAdminClick);
  adminBadge.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') bumpAdminClick();
  });

  adminConfirmNo.addEventListener('click', () => adminConfirmModal.classList.add('hidden'));
  adminConfirmYes.addEventListener('click', async () => {
    adminConfirmModal.classList.add('hidden');
    await openAdminOverlay();
  });

  adminCloseBtn.addEventListener('click', closeAdminOverlay);
  adminOverlay.addEventListener('click', (e) => {
    if (e.target === adminOverlay) closeAdminOverlay();
  });

  adminOpenDateInput.addEventListener('change', () => {
    adminOpenDateIso = new Date(adminOpenDateInput.value).toISOString();
    adminOpenCountdown.textContent = formatCountdown(adminOpenDateIso);
  });
  adminRevealDateInput.addEventListener('change', () => {
    adminRevealDateIso = new Date(adminRevealDateInput.value).toISOString();
    adminRevealCountdown.textContent = formatCountdown(adminRevealDateIso);
  });

  adminSaveDatesBtn.addEventListener('click', async () => {
    adminDatesError.textContent = '';
    if (!adminToken) return;
    const { error } = await sb.rpc('admin_update_dates', {
      p_admin_token: adminToken,
      p_guess_open: adminOpenDateIso,
      p_guess_reveal: adminRevealDateIso,
    });
    if (error) {
      adminDatesError.textContent = 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง';
      return;
    }
    await loadAdminDates();
  });

  adminRefreshSummaryBtn.addEventListener('click', loadAdminSummary);
}
