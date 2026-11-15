// Bookmarks sync: pulls the "book" bookmarks from CUB, adds Ukrainian/English titles and
// posters from TMDB, and writes bookmarks/data.json. Runs from GitHub Actions; the file is
// committed only when its content changes.
import {readFile, writeFile} from 'node:fs/promises';

const OUT = 'bookmarks/data.json';
const CUB_DOMAINS = ['cub.best', 'cub.red', 'cub.rip'];
const {CUB_TOKEN, CUB_PROFILE = ''} = process.env;
const TMDB_KEY = process.env.TMDB_KEY || '4ef0d7355d9ffb5151e987764708ce96';

if (!CUB_TOKEN) {
  console.log('CUB_TOKEN is not set – nothing to sync');
  process.exit(0);
}

async function loadPrev() {
  try { return JSON.parse(await readFile(OUT, 'utf8')); } catch { return {items: []}; }
}

// The account token from Lampa goes in the "token" header; an OAuth access token goes in
// "Authorization: Bearer". Both are tried, the profile id is sent in the "profile" header.
async function fetchCub() {
  const auths = [{token: CUB_TOKEN}, {authorization: 'Bearer ' + CUB_TOKEN}];
  for (const d of CUB_DOMAINS) {
    for (const auth of auths) {
      const how = auth.token ? 'token' : 'bearer';
      try {
        const r = await fetch(`https://${d}/api/bookmarks/all?full=1`, {
          headers: {...auth, profile: String(CUB_PROFILE)},
          signal: AbortSignal.timeout(30000),
        });
        const j = await r.json().catch(() => null);
        if (j && j.error) { console.log(`${d} (${how}): error ${j.code || ''} ${j.text || j.message || ''}`.trim()); continue; }
        if (!r.ok || !j) { console.log(`${d} (${how}): HTTP ${r.status}`); continue; }
        const list = Array.isArray(j) ? j : (j.bookmarks || j.result || j.data);
        if (Array.isArray(list)) { console.log(`${d} (${how}): ${list.length} bookmarks`); return list; }
        console.log(`${d} (${how}): unexpected answer, keys: ${Object.keys(j).join(', ')}`);
      } catch (e) {
        console.log(`${d} (${how}): ${e.message}`);
      }
    }
  }
  throw new Error('CUB is unavailable, the token is invalid or the answer format changed');
}

const isTv = (c) => !!(c.name || c.original_name || c.first_air_date || c.number_of_seasons || c.media_type === 'tv');
const yearOf = (v) => { const m = String(v || '').match(/\d{4}/); return m ? Number(m[0]) : null; };
const msOf = (v) => { const n = Number(v); if (!n) return null; return n < 1e12 ? n * 1000 : n; };

function toItem(b) {
  let c = b.data;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = null; } }
  if (!c || !c.id) return null;
  const tv = isTv(c);
  return {
    id: Number(c.id),
    k: tv ? 'tv' : 'movie',
    s: c.source || 'tmdb',
    t: {ru: String((tv ? c.name : c.title) || c.title || c.name || '').trim()},
    o: String((tv ? c.original_name : c.original_title) || c.original_title || c.original_name || '').trim(),
    y: yearOf(tv ? c.first_air_date : c.release_date) || yearOf(c.release_date || c.first_air_date || c.year),
    p: c.poster_path || null,
    b: c.backdrop_path || null,
    a: msOf(b.time || b.date || b.created),
  };
}

async function tmdb(kind, id, lang) {
  const url = `https://api.themoviedb.org/3/${kind}/${id}?api_key=${TMDB_KEY}&language=${lang}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(20000)});
      if (r.status === 404) return null;
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 2000)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === 2) { console.log(`TMDB ${kind}/${id} ${lang}: ${e.message}`); return undefined; }
    }
  }
  return undefined;
}

async function enrich(it, prev) {
  if (prev && prev.t && prev.t.uk && prev.t.en) {
    it.t.uk = prev.t.uk; it.t.en = prev.t.en;
    it.p = it.p || prev.p; it.b = it.b || prev.b; it.y = it.y || prev.y;
    if (it.y || prev.y === null) return;
  }
  const [uk, en] = [await tmdb(it.k, it.id, 'uk-UA'), await tmdb(it.k, it.id, 'en-US')];
  const name = (d) => d && String(d.name || d.title || '').trim();
  if (uk) it.t.uk = name(uk);
  if (en) it.t.en = name(en);
  const d = en || uk;
  if (d) {
    it.p = it.p || d.poster_path || null;
    it.b = it.b || d.backdrop_path || null;
    it.y = it.y || yearOf(d.first_air_date || d.release_date);
  }
}

async function pool(list, n, fn) {
  let i = 0;
  await Promise.all(Array.from({length: n}, async () => { while (i < list.length) { const k = i++; await fn(list[k]); } }));
}

const prev = await loadPrev();
const prevMap = new Map((prev.items || []).map((x) => [`${x.k}:${x.id}`, x]));
const raw = await fetchCub();

const seen = new Set();
const items = raw
  .filter((b) => b && b.type === 'book')
  .map(toItem)
  .filter((x) => x && !seen.has(`${x.k}:${x.id}`) && seen.add(`${x.k}:${x.id}`))
  .sort((a, b) => (b.a || 0) - (a.a || 0));

if (!items.length && (prev.items || []).length) {
  throw new Error('CUB returned no bookmarks – the token may have expired; the old list is kept');
}

await pool(items, 6, (it) => enrich(it, prevMap.get(`${it.k}:${it.id}`)));

const same = JSON.stringify(items) === JSON.stringify(prev.items || []);
if (same) {
  console.log(`No changes (${items.length} items)`);
} else {
  await writeFile(OUT, JSON.stringify({updated: new Date().toISOString(), items}));
  const tv = items.filter((x) => x.k === 'tv').length;
  console.log(`Saved ${items.length} items: ${tv} series, ${items.length - tv} movies`);
}
