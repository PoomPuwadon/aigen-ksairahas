import { sb } from '../config.js';
import { state } from '../state.js';
import { showView, unwrapSingle } from '../views.js';
import { VOTE_PHOTO_ID, VOTE_PHOTO_URL } from '../theme.js';

const voteButtonsWrap = document.getElementById('vote-buttons');
const voteResultsWrap = document.getElementById('vote-results');
const btnVoteHod = document.getElementById('btn-vote-hod');
const btnVoteMeun = document.getElementById('btn-vote-meun');
const btnVoteContinue = document.getElementById('btn-vote-continue');

function showVoteResults(hod, meun) {
  const total = hod + meun;
  const hodPct = total > 0 ? Math.round((hod / total) * 100) : 0;
  const meunPct = total > 0 ? 100 - hodPct : 0;

  document.getElementById('vote-hod-pct').textContent = `${hodPct}% (${hod})`;
  document.getElementById('vote-meun-pct').textContent = `${meunPct}% (${meun})`;
  document.getElementById('vote-hod-bar').style.width = `${hodPct}%`;
  document.getElementById('vote-meun-bar').style.width = `${meunPct}%`;
  document.getElementById('vote-total').textContent = `รวม ${total} โหวต`;

  voteButtonsWrap.classList.add('hidden');
  voteResultsWrap.classList.remove('hidden');
  btnVoteContinue.classList.remove('hidden');
}

async function castVote(choice) {
  if (!state.currentUser) return;
  btnVoteHod.disabled = true;
  btnVoteMeun.disabled = true;

  const { data, error } = await sb.rpc('cast_photo_vote', {
    p_token: state.currentUser.access_token,
    p_photo_id: VOTE_PHOTO_ID,
    p_choice: choice,
  });
  if (error || !data) {
    alert('โหวตไม่สำเร็จ ลองใหม่อีกครั้ง');
    btnVoteHod.disabled = false;
    btnVoteMeun.disabled = false;
    return;
  }
  const res = unwrapSingle(data);
  showVoteResults(res.hod_votes, res.meun_votes);
}

export async function enterPhotoVote() {
  if (!state.currentUser) {
    showView('login');
    return;
  }

  document.getElementById('vote-photo-img').src = VOTE_PHOTO_URL;

  voteButtonsWrap.classList.remove('hidden');
  voteResultsWrap.classList.add('hidden');
  btnVoteContinue.classList.add('hidden');
  btnVoteHod.disabled = false;
  btnVoteMeun.disabled = false;

  showView('photoVote');

  const { data } = await sb.rpc('get_vote_state', {
    p_token: state.currentUser.access_token,
    p_photo_id: VOTE_PHOTO_ID,
  });
  const res = unwrapSingle(data);
  if (res && res.my_choice) {
    showVoteResults(res.hod_votes, res.meun_votes);
  }
}

export function initPhotoVote(onContinue) {
  btnVoteHod.addEventListener('click', () => castVote('hod'));
  btnVoteMeun.addEventListener('click', () => castVote('meun'));
  btnVoteContinue.addEventListener('click', () => onContinue());
}
