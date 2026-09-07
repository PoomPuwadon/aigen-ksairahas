export const views = {
  login: document.getElementById('login-view'),
  photoVote: document.getElementById('photo-vote-view'),
  lilbroWaiting: document.getElementById('lilbro-waiting-view'),
  punishmentWarning: document.getElementById('punishment-warning-view'),
  bigbroSearch: document.getElementById('bigbro-search-view'),
  guessConfirm: document.getElementById('guess-confirm-view'),
  reveal: document.getElementById('reveal-view'),
};

export function showView(name) {
  Object.values(views).forEach((v) => v.classList.add('hidden'));
  if (views[name]) views[name].classList.remove('hidden');
  if (name !== 'reveal') clearRevealView();
}

export function clearRevealView() {
  document.getElementById('reveal-status-title').textContent = '';
  document.getElementById('reveal-real-bigbro').textContent = '';
  document.getElementById('reveal-real-bigbro-branch').textContent = '';
  document.getElementById('reveal-punishment-text').textContent = '';
  document.getElementById('reveal-teammates').innerHTML = '';
  document.getElementById('reveal-punishment-box').classList.add('hidden');
  const tag = document.getElementById('reveal-tag');
  tag.style.color = '';
  tag.style.borderColor = '';
}

export function unwrapSingle(data) {
  if (!data) return null;
  return Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
}

export function renderTeammateList(container, teammates, currentUserNickname) {
  container.innerHTML = '';
  if (!teammates || teammates.length === 0) return;

  teammates.forEach((item) => {
    const isObject = typeof item === 'object' && item !== null;
    const name = isObject ? item.nickname : item;
    const guess = isObject ? item.guess : null;
    const isMe = name === currentUserNickname;

    const card = document.createElement('div');
    card.className = `teammate-card ${isMe ? 'is-me' : ''}`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'teammate-name';
    nameSpan.textContent = `น้อง${name}${isMe ? ' ' : ''}`;

    const choiceSpan = document.createElement('span');
    choiceSpan.className = `teammate-choice ${guess ? '' : 'pending'}`;
    choiceSpan.textContent = guess ? `ทายว่า: พี่${guess}` : 'ยังไม่ได้ทาย';

    card.appendChild(nameSpan);
    card.appendChild(choiceSpan);
    container.appendChild(card);
  });
}

export async function fetchGuessPhase(sb) {
  const { data, error } = await sb.rpc('get_guess_phase');
  if (error) return { error };
  return { data: unwrapSingle(data) };
}
