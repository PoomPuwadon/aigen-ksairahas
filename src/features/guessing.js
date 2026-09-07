import { sb } from '../config.js';
import { state } from '../state.js';
import { showView, renderTeammateList, unwrapSingle } from '../views.js';

const bigbroGrid = document.getElementById('bigbro-grid');
const searchInput = document.getElementById('bigbro-search-input');
const guessModal = document.getElementById('guess-modal');

export function renderBigBroGrid(filterText) {
  bigbroGrid.innerHTML = '';
  const filtered = state.allBigBros.filter((b) => {
    const fn = (b.first_name || '').toLowerCase();
    const nn = (b.nickname || '').toLowerCase();
    return fn.includes(filterText) || nn.includes(filterText);
  });

  if (filtered.length === 0) {
    bigbroGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--muted); padding: 20px 0; text-align: center;">ไม่พบรายชื่อพี่รหัส</div>`;
    return;
  }

  filtered.forEach((u) => {
    const card = document.createElement('div');
    card.className = 'bigbro-card';
    const displayName = u.first_name || u.nickname || '';
    const branchDisplay = u.branch ? `#2 ${u.branch}` : '';
    card.innerHTML =
      `<div class="bb-name">${displayName}</div>` +
      (branchDisplay ? `<div class="bb-branch">${branchDisplay}</div>` : '');

    card.addEventListener('click', () => openGuessModal(u));
    bigbroGrid.appendChild(card);
  });
}

function openGuessModal(u) {
  state.selectedBigbro = u;
  const displayName = u.first_name || u.nickname || '';
  document.getElementById('modal-bigbro-name').textContent = `พี่${displayName}`;
  document.getElementById('modal-bigbro-sub').textContent = u.branch ? `ภาค${u.branch}` : '';
  guessModal.classList.remove('hidden');
}

function closeGuessModal() {
  guessModal.classList.add('hidden');
  state.selectedBigbro = null;
}

export function setupConfirmView(guessName, teammates) {
  document.getElementById('confirm-guess-name').textContent = `พี่${guessName}`;
  renderTeammateList(document.getElementById('confirm-teammates'), teammates, state.currentUser?.nickname);
  showView('guessConfirm');
}

export function initGuessing() {
  searchInput.addEventListener('input', () => {
    renderBigBroGrid(searchInput.value.trim().toLowerCase());
  });

  document.getElementById('btn-modal-cancel').addEventListener('click', closeGuessModal);

  document.getElementById('btn-modal-confirm').addEventListener('click', async () => {
    if (!state.selectedBigbro) return;
    const confirmBtn = document.getElementById('btn-modal-confirm');
    confirmBtn.textContent = 'กำลังบันทึก...';
    confirmBtn.disabled = true;

    const { data: rawData, error } = await sb.rpc('submit_guess', {
      p_lilbro_nickname: state.currentUser.nickname,
      p_bigbro_first_name: state.selectedBigbro.first_name,
      p_token: state.currentUser.access_token,
    });

    if (error) {
      console.error('Submit Error:', error);
      alert(`บันทึกไม่สำเร็จ: ${error.message}`);
      confirmBtn.textContent = 'ยืนยันคำตอบ';
      confirmBtn.disabled = false;
      return;
    }

    const data = unwrapSingle(rawData);
    confirmBtn.textContent = 'ยืนยันคำตอบ';
    confirmBtn.disabled = false;
    const guessedName = state.selectedBigbro.first_name;
    closeGuessModal();

    const userChoice = data?.user_guess || data?.guess || guessedName;
    const groupChoices = data?.group_guesses || data?.teammates || [];

    setupConfirmView(userChoice, groupChoices);
  });

  document.getElementById('btn-change-guess').addEventListener('click', async () => {
    if (state.allBigBros.length === 0) {
      const { data } = await sb.rpc('list_bigbros');
      if (data) state.allBigBros = data;
    }
    renderBigBroGrid('');
    showView('bigbroSearch');
  });
}
