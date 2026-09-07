import { GROUP_BADGE_LETTER, PUNISHMENT_WARNING_TEXT } from './theme.js';
import { initBgGallery } from './features/bgGallery.js';
import { initPhotoVote, enterPhotoVote } from './features/photoVote.js';
import { initDashboard, loadDashboard } from './features/dashboard.js';
import { initGuessing } from './features/guessing.js';
import { initAdmin } from './features/admin.js';
import { initLogin } from './features/login.js';

// Apply the few bits of copy that live in theme.js instead of hardcoded HTML.
document.getElementById('admin-k-badge').textContent = GROUP_BADGE_LETTER;
document.getElementById('punishment-warning-text').textContent = PUNISHMENT_WARNING_TEXT;

initBgGallery();
initAdmin();
initGuessing();
initDashboard();
initPhotoVote(() => loadDashboard());
initLogin(() => enterPhotoVote());
