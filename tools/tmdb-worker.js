// Cloudflare Worker "bookmarks-tmdb": TMDB proxy for the bookmarks page.
// The TMDB key stays in the Worker secret TMDB_KEY and never reaches the browser.
// Only GET /3/tv/<id> and /3/movie/<id> with a few known parameters are passed through,
// and only for requests coming from the page's origin.

const ALLOWED_ORIGINS = ['https://dmitryzemlyuk.github.io'];
const PARAMS = ['language', 'append_to_response', 'include_video_language'];

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json; charset=utf-8', ...headers}});
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {'access-control-allow-origin': allowed ? origin : ALLOWED_ORIGINS[0], 'vary': 'origin', 'x-robots-tag': 'noindex, nofollow'};

    if (req.method === 'OPTIONS') {
      return new Response(null, {status: 204, headers: {...cors, 'access-control-allow-methods': 'GET', 'access-control-max-age': '86400'}});
    }
    if (req.method !== 'GET') return json({error: 'method not allowed'}, 405, cors);
    if (!allowed) return json({error: 'forbidden'}, 403, cors);
    if (!env.TMDB_KEY) return json({error: 'TMDB_KEY is not set'}, 500, cors);

    const url = new URL(req.url);
    const m = url.pathname.match(/^\/3\/(tv|movie)\/(\d{1,9})$/);
    if (!m) return json({error: 'not found'}, 404, cors);

    const up = new URL(`https://api.themoviedb.org/3/${m[1]}/${m[2]}`);
    for (const p of PARAMS) {
      const v = url.searchParams.get(p);
      if (v && v.length <= 200 && /^[\w,.-]+$/.test(v)) up.searchParams.set(p, v);
    }
    const cacheKey = new Request(up.toString());
    const cache = typeof caches !== 'undefined' ? caches.default : null;

    let res = cache ? await cache.match(cacheKey) : null;
    if (!res) {
      up.searchParams.set('api_key', env.TMDB_KEY);
      let r;
      try {
        r = await fetch(up.toString());
      } catch (e) {
        return json({error: 'TMDB is unavailable'}, 502, cors);
      }
      res = new Response(r.body, {
        status: r.status,
        headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': r.ok ? 'public, max-age=43200' : 'no-store'},
      });
      if (r.ok && cache) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }

    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};
