// ---------------------------------------------------------------------------
// THEME / CONTENT CONFIG
// ---------------------------------------------------------------------------
// Everything in this file is safe (and meant) to change per event. None of it
// touches auth, data access, or the Supabase schema — it's just copy, links,
// and a couple of gameplay knobs. See README.md for the full customization
// guide.
// ---------------------------------------------------------------------------

// The little badge letter shown in the top-left "eyebrow" tag on the login
// screen (e.g. a group/team initial). Tapping/clicking it N times is the
// secret entry point into the admin panel — see ADMIN_UNLOCK_CLICKS below.
export const GROUP_BADGE_LETTER = 'K';

// Punishment text shown to a lilbro (little sibling) whose guess turns out
// wrong at reveal time and in the pre-guess warning screen. Swap this for
// whatever your event's actual dare/forfeit is, or set to something neutral.
export const PUNISHMENT_TEXT =
  'บทลงโทษ: ถ่ายคลิปกับพี่รหัส ตะโกนว่า "ผมรักกรุ๊ปK" ลง Story (คนที่อยู่ร้านห้ามบิด)';

export const PUNISHMENT_WARNING_TEXT =
  'ถ้ากลุ่มของน้องทายผิด จะต้องถ่ายคลิปกับพี่รหัสแล้วตะโกนว่า "ผมรักกรุ๊ปK" ลง Story (ทายถูกคนเดียวรอดทั้งกลุ่ม)';

// How many times the badge must be tapped/clicked (within ADMIN_CLICK_RESET_MS
// of each other) to pop the "enter admin panel?" confirmation. This only does
// anything once a session has already been armed by typing the real admin
// password into the login field once (see features/admin.js) — an unarmed
// badge stays silent no matter how many times it's clicked.
export const ADMIN_UNLOCK_CLICKS = 15;
export const ADMIN_CLICK_RESET_MS = 2500;

// Background "memory wall" gallery images, tiled behind the card. Replace
// with your own event photos, or set to an empty array to disable the
// gallery entirely (main.js handles an empty list gracefully).
export const GALLERY_PHOTOS = [
  'https://i.ibb.co/pjMr23T7/Screenshot-2026-08-21-014924.png',
  'https://i.ibb.co/WvGYVzBd/Screenshot-2026-08-21-014907.png',
  'https://i.ibb.co/KcsWDy1D/Screenshot-2026-08-21-014855.png',
  'https://i.ibb.co/Gf7j8Wjy/Screenshot-2026-08-21-014845.png',
  'https://i.ibb.co/9kGjD87K/Screenshot-2026-08-21-014721.png',
  'https://i.ibb.co/WWbDdGSw/Screenshot-2026-08-21-014617.png',
  'https://i.ibb.co/m52phrSw/Screenshot-2026-08-21-014557.png',
  'https://i.ibb.co/wNKBrrfv/Screenshot-2026-08-21-014546.png',
  'https://i.ibb.co/hRtWbcfD/Save-Clip-App-775799401-17904798735532504-3292068172356910273-n.jpg',
  'https://i.ibb.co/FqwZsQ5b/Screenshot-2026-08-21-021415.png',
];

// The single photo shown on the post-login "vote" screen. VOTE_PHOTO_ID must
// match a row you insert into the photo_votes table (see supabase/schema.sql)
// — bump the id and add a new row if you want a fresh photo/round later.
export const VOTE_PHOTO_ID = 1;
export const VOTE_PHOTO_URL =
  'https://i.ibb.co/Lz2tmr5n/Save-Clip-App-775799401-17904798735532504-3292068172356910273-n.jpg';

// Optional hidden easter-egg: typing a secret keyword (checked server-side
// against betsim_keywords — see schema.sql) into the login field does a
// one-way full-screen takeover redirecting into an iframe of this URL.
// Set to null / remove the check in features/betsim.js if you don't want
// this feature at all.
export const BETSIM_URL = 'https://betsim-nine.vercel.app/';
