import { GALLERY_PHOTOS } from '../theme.js';

let bgGalleryTileCount = 0;

function renderBgGallery() {
  const el = document.getElementById('bg-gallery');
  if (!el || GALLERY_PHOTOS.length === 0) return;

  const isMobile = window.innerWidth <= 600;
  const tileW = isMobile ? 100 : 160;
  const tileH = isMobile ? 100 : 160;
  const cols = Math.ceil(window.innerWidth / tileW);
  const rows = Math.ceil(window.innerHeight / tileH);
  // small buffer so resizing slightly larger doesn't leave a gap before the next re-render
  const neededTiles = Math.min(300, cols * rows + cols);

  if (neededTiles <= bgGalleryTileCount) return; // already enough tiles, no need to re-render

  el.innerHTML = '';
  for (let i = 0; i < neededTiles; i++) {
    const img = document.createElement('img');
    img.src = GALLERY_PHOTOS[i % GALLERY_PHOTOS.length];
    img.loading = 'lazy';
    img.alt = '';
    el.appendChild(img);
  }
  bgGalleryTileCount = neededTiles;
}

export function initBgGallery() {
  renderBgGallery();
  let bgGalleryResizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(bgGalleryResizeTimer);
    bgGalleryResizeTimer = setTimeout(renderBgGallery, 250);
  });
}
