import { state } from '../state.js';
import { showView, renderTeammateList, clearRevealView } from '../views.js';

export function setupRevealView(data) {
  const title = document.getElementById('reveal-status-title');
  const realBigBro = document.getElementById('reveal-real-bigbro');
  const realBigBroBranch = document.getElementById('reveal-real-bigbro-branch');
  const punBox = document.getElementById('reveal-punishment-box');
  const punText = document.getElementById('reveal-punishment-text');
  const tag = document.getElementById('reveal-tag');

  clearRevealView();

  const realName = data.real_bigbro_first_name || '';
  realBigBro.textContent = `พี่${realName}`;
  realBigBroBranch.textContent = data.real_bigbro_branch ? `ภาค${data.real_bigbro_branch}` : '';
  renderTeammateList(
    document.getElementById('reveal-teammates'),
    data.group_guesses || [],
    state.currentUser?.nickname
  );

  if (data.is_correct) {
    title.textContent = '🎉 ถูกต้องงงงงง! 🎉';
    title.className = 'text-correct';
    tag.style.color = 'var(--yellow)';
    tag.style.borderColor = 'var(--yellow)';
    punBox.classList.add('hidden');
  } else {
    title.textContent = 'ทายผิดดดดดดดดดดดดด!';
    title.className = 'text-wrong';
    tag.style.color = 'var(--red)';
    tag.style.borderColor = 'var(--red)';
    punText.textContent = data.punishment || 'มีบทลงโทษสำหรับสายนี้!';
    punBox.classList.remove('hidden');
  }

  showView('reveal');
}
