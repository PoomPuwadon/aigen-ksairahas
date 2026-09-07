import { sb } from '../config.js';
import { state } from '../state.js';
import { showView, unwrapSingle, fetchGuessPhase } from '../views.js';
import { setupRevealView } from './reveal.js';
import { setupConfirmView, renderBigBroGrid } from './guessing.js';

const btnGoToGuess = document.getElementById('go-to-guess-btn');
const dashError = document.getElementById('dash-error');

export function loadDashboard() {
  if (!state.currentUser) {
    showView('login');
    return;
  }
  document.getElementById('lilbro-nickname').textContent = `น้อง${state.currentUser.nickname}`;
  const branchDisplay = state.currentUser.branch ? `ภาค${state.currentUser.branch}` : '';
  document.getElementById('lilbro-sub').textContent = [state.currentUser.first_name, branchDisplay]
    .filter(Boolean)
    .join(' · ');

  const hintsWrapper = document.getElementById('hints-wrapper');
  const hintsList = document.getElementById('hints-list');
  hintsList.innerHTML = '';
  const hints = [state.currentUser.hint1, state.currentUser.hint2, state.currentUser.hint3];
  let hasVisibleHints = false;

  hints.forEach((h, i) => {
    if (!h || !h.trim()) return;
    hasVisibleHints = true;
    const item = document.createElement('div');
    item.className = 'hint-item';

    if (h.startsWith('LOCKED:')) {
      const dateString = h.substring(7);
      const targetDate = new Date(dateString).getTime();
      const textSpan = document.createElement('span');
      textSpan.className = 'hint-text';
      textSpan.style.color = 'var(--muted)';

      item.innerHTML = `<span class="hint-num">${i + 1}.</span>`;
      item.appendChild(textSpan);
      hintsList.appendChild(item);

      const updateTimer = async () => {
        const now = new Date().getTime();
        const diff = targetDate - now;
        if (diff <= 0) {
          textSpan.textContent = 'กำลังโหลดคำใบ้...';
          try {
            const { data } = await sb.rpc('get_lilbro_hints', { p_first_name: state.currentUser.first_name });
            const res = unwrapSingle(data);
            if (res) {
              state.currentUser = res;
              loadDashboard();
            }
          } catch (err) {
            textSpan.innerHTML = 'รีเฟรชหน้าเว็บ';
          }
          return true;
        }
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hr = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const min = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const sec = Math.floor((diff % (1000 * 60)) / 1000);
        textSpan.textContent = `🔒 คำใบ้จะเปิดให้ดูในอีก: ${d > 0 ? d + ' วัน ' : ''}${hr} ชม. ${min} นาที ${sec} วิ.`;
        return false;
      };
      updateTimer().then((isExpired) => {
        if (!isExpired) {
          const timerId = setInterval(async () => {
            if (await updateTimer()) clearInterval(timerId);
          }, 1000);
        }
      });
    } else {
      item.innerHTML = `<span class="hint-num">${i + 1}.</span><span class="hint-text">${h}</span>`;
      hintsList.appendChild(item);
    }
  });

  if (hasVisibleHints) hintsWrapper.classList.remove('hidden');
  else hintsWrapper.classList.add('hidden');

  showView('lilbroWaiting');
  updateDashboardAction();
}

async function updateDashboardAction() {
  const btn = btnGoToGuess;
  btn.classList.remove('hidden');
  btn.textContent = 'กำลังตรวจสอบ...';
  btn.disabled = true;

  const { data: phaseData, error } = await fetchGuessPhase(sb);
  btn.disabled = false;

  if (error || !phaseData) {
    btn.classList.add('hidden');
    return;
  }

  if (phaseData.phase === 'revealed') {
    btn.textContent = 'ดูเฉลยสายรหัส';
  } else if (phaseData.phase === 'not_open') {
    btn.classList.add('hidden');
  } else {
    btn.textContent = 'ทายชื่อพี่รหัส';
  }
}

export function initDashboard() {
  btnGoToGuess.addEventListener('click', async () => {
    btnGoToGuess.textContent = 'กำลังตรวจสอบ...';
    btnGoToGuess.disabled = true;
    dashError.textContent = '';

    const { data: phaseData, error: phaseErr } = await fetchGuessPhase(sb);

    if (phaseErr || !phaseData) {
      dashError.textContent = 'เกิดข้อผิดพลาดในการตรวจสอบเวลา';
      await updateDashboardAction();
      return;
    }

    if (phaseData.phase === 'not_open') {
      const openDate = phaseData.guess_open_date
        ? new Date(phaseData.guess_open_date).toLocaleString('th-TH')
        : 'ยังไม่กำหนด';
      dashError.textContent = `ระบบยังไม่เปิดให้ทาย จะเปิดในวันที่: ${openDate}`;
      await updateDashboardAction();
      return;
    }

    if (phaseData.phase === 'revealed') {
      const { data: rawRevData, error: revErr } = await sb.rpc('get_reveal', {
        p_lilbro_nickname: state.currentUser.nickname,
        p_token: state.currentUser.access_token,
      });
      const revData = unwrapSingle(rawRevData);

      if (revErr) {
        dashError.textContent = revErr.message?.includes('not started')
          ? 'ยังไม่ถึงเวลาเฉลย'
          : 'โหลดข้อมูลเฉลยไม่ได้';
        await updateDashboardAction();
        return;
      }

      if (!revData) {
        dashError.textContent = 'โหลดข้อมูลเฉลยไม่ได้';
        await updateDashboardAction();
        return;
      }

      setupRevealView(revData);
      await updateDashboardAction();
      return;
    }

    const { data: rawMyGuess } = await sb.rpc('get_my_guess', {
      p_lilbro_nickname: state.currentUser.nickname,
      p_token: state.currentUser.access_token,
    });
    const myGuess = unwrapSingle(rawMyGuess);

    const userChoice = myGuess?.guess;
    const groupChoices = myGuess?.group_guesses || [];

    if (userChoice) {
      setupConfirmView(userChoice, groupChoices);
    } else {
      showView('punishmentWarning');
    }

    await updateDashboardAction();
  });

  document.getElementById('btn-warning-ack').addEventListener('click', async () => {
    const btn = document.getElementById('btn-warning-ack');
    btn.textContent = 'กำลังโหลดรายชื่อ...';

    const { data, error } = await sb.rpc('list_bigbros');
    if (error || !data) {
      alert('โหลดรายชื่อพี่รหัสล้มเหลว');
      btn.innerHTML = 'เข้าใจแล้ว<br>พร้อมทาย';
      return;
    }

    state.allBigBros = data;
    btn.innerHTML = 'เข้าใจแล้ว<br>พร้อมทาย';
    renderBigBroGrid('');
    showView('bigbroSearch');
  });
}
