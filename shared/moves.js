/* Prospect Actuary: Contending and Rebuild moves, written once for the Moves page and the Sleeper League page.
 *
 * A move is a one-for-one swap that keeps dynasty value level and shifts it toward now or toward later:
 *   Contending move  similar dynasty value, MORE redraft value (rest of 2026)            -> win now without selling the future
 *   Rebuild move     similar dynasty value, MORE future value (2027-2031 part of dynasty) -> get younger without losing value
 * Both sides use the site's two numbers only, from shared/engine.js on the league saved in this browser:
 *   d    dynasty value (100,000 scale)
 *   r    redraft value (100,000 scale, rest of 2026)
 *   fut  the part of the dynasty value that comes from 2027-2031 = dynasty value minus its rest-of-2026 part
 *        (2027 rookie picks: all of it; their redraft value is 0)
 * The 10% rule (the same band the Trade Calculator uses): a swap counts only when the two dynasty values are within 10% of
 * each other (too close to call, so a fair ask) AND the gain is more than 10% of the larger of the two values being compared
 * (a smaller gain is inside the values' normal error). Gains under 1,000 are dropped as noise.
 *   PAMoves.byIndex(C)                       -> {now, fut} per player index (dynasty-scale rest-of-2026 part and future part)
 *   PAMoves.player(C, F, i, extra)           -> an asset {d, r, fut, ...extra}
 *   PAMoves.pick(v, extra)                   -> a 2027 pick asset (r = 0, fut = v)
 *   PAMoves.swaps(give, pool, kind)          -> every qualifying swap, best gain first (kind "c" contending, "r" rebuild)
 *   PAMoves.spread(list, perGive, perGet, n) -> a short list that doesn't repeat one player too often
 */
(function(){
  if (window.PAMoves) return;
  const BAND = 0.10, MIN_D = 1000, MIN_GAIN = 1000;
  function byIndex(C){
    const n = C.d.length, now = new Array(n).fill(0), fut = new Array(n).fill(0);
    C.dynAll.forEach(r=>{ if (!r.pick && r.parts) { now[r.i] = 1e5*r.parts[0].v/C.topD; fut[r.i] = Math.max(0, C.d[r.i] - now[r.i]); } });
    return {now, fut};
  }
  const player = (C, F, i, extra) => Object.assign({i, d:C.d[i]||0, r:C.r[i]||0, fut:F.fut[i]||0}, extra||{});
  const pick = (v, extra) => Object.assign({d:v||0, r:0, fut:v||0, isPick:true}, extra||{});
  const metric = kind => kind==="r" ? "fut" : "r";
  function swaps(give, pool, kind){
    const m = metric(kind), out = [];
    give.forEach(g=>{ if (!(g.d>=MIN_D)) return;
      const lo = g.d*(1-BAND), hi = g.d/(1-BAND);              // |d_get - d_give| < 10% of the larger
      pool.forEach(t=>{ if (t===g || !(t.d>lo && t.d<hi) || (t.key && t.key===g.key)) return;
        const gain = t[m]-g[m], big = Math.max(t[m], g[m]);
        if (gain < MIN_GAIN || gain < BAND*big) return;
        out.push({give:g, get:t, gain, pct: big>0 ? gain/big : 0, dd: t.d-g.d, dr: t.r-g.r, df: t.fut-g.fut}); }); });
    out.sort((a,b)=>(b.gain-a.gain) || (Math.abs(a.dd)-Math.abs(b.dd)));
    return out;
  }
  function spread(list, perGive, perGet, n){
    const cg = new Map(), ct = new Map(), out = [];
    for (const s of list){ if (out.length>=n) break;
      const a = cg.get(s.give)||0, b = ct.get(s.get)||0; if (a>=perGive || b>=perGet) continue;
      cg.set(s.give, a+1); ct.set(s.get, b+1); out.push(s); }
    return out;
  }
  // ---------- a Sleeper league (shared/sleeper.js, after PASleeper.price): every team's tradeable assets ----------
  // Players we value, plus 2027 picks rounds 1-4 (exact slot once the league sets the order, else the round's average).
  function league(M, C, S, SL){
    const F = byIndex(C);
    M.teams.forEach(t=>{
      t.mv = t.players.filter(p=>p.i!=null).map(p=>player(C, F, p.i, {n:p.name, p:p.pos, key:p.key, rid:t.rid, team:t.name, taxi:p.taxi}))
        .concat(t.picks.map(k=>{ const pv = SL.pickValue(k, C, S, "d"); if (!pv.valued) return null;
          return pick(pv.v, {n:SL.pickName(k) + (k.from ? ` (${k.from}'s)` : ""), p:"PICK", id:k.id, avg:!pv.exact, rid:t.rid, team:t.name}); }).filter(Boolean));
    });
    return M;
  }
  // a team's best moves against every other roster in the league
  function teamMoves(M, t, kind, n, keep){
    const pool = []; M.teams.forEach(o=>{ if (o.rid!==t.rid) pool.push(...o.mv); });
    return spread(swaps(keep ? t.mv.filter(keep) : t.mv, pool, kind), 1, 1, n || 8);   // each player once, so the list shows different ideas
  }
  // Trade Calculator link for one swap (players as "Name|POS", board picks as pick-1.05, Sleeper picks as spick-2027.1.4)
  const enc = a => a.id && a.id.startsWith("s:") ? "spick-"+a.id.slice(2) : a.slot ? "pick-"+a.slot : a.n+"|"+a.p;
  const calc = (root, s, extra) => `${root}trade-calculator/?mode=dynasty&give=${encodeURIComponent(enc(s.give))}&get=${encodeURIComponent(enc(s.get))}${extra||""}`;

  // ---------- one table for both pages ----------
  const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const fmt = x => (Math.round(x/100)*100).toLocaleString("en-US");
  const sgn = x => (x>=0 ? "+" : "−") + fmt(Math.abs(x));
  const chip = p => `<span class="pos" style="color:var(--${p||"muted"})">${p==="PICK" ? "Pick" : esc(p||"?")}</span>`;
  // o: {name(a) -> html for the asset name, owner(a) -> text or "", link(s) -> trade href or null, empty -> text}
  function table(list, kind, o){
    o = o || {};
    if (!list.length) return `<p class="small muted mv-empty">${esc(o.empty || "No move passes the 10% rule here.")}</p>`;
    const nm = o.name || (a => esc(a.n)), own = o.owner || (() => "");
    const side = (a, isGet) => { const w = own(a);
      const r = `Redraft ${fmt(a.r)}`, f = `Future ${fmt(a.fut)}`;
      return `<div class="mv-nm">${chip(a.p)} ${nm(a)}</div><div class="mv-meta">Dynasty ${fmt(a.d)} · ${kind==="r" ? `${r} · <b>${f}</b>` : `<b>${r}</b> · ${f}`}${isGet && w ? ` · <span class="mv-own">${esc(w)}</span>` : ""}</div>`; };
    const lab = kind==="r" ? "future" : "redraft";
    return `<div class="tablebox mv"><table><thead><tr><th>You give</th><th>You get</th><th class="r">Gain (${lab})</th><th class="r">Dynasty change</th>${o.link ? "<th></th>" : ""}</tr></thead><tbody>` +
      list.map(s=>{ const href = o.link ? o.link(s) : null;
        return `<tr><td>${side(s.give)}</td><td>${side(s.get, true)}</td>
          <td class="r num"><span class="up">${sgn(s.gain)}</span><div class="mv-meta">${Math.round(100*s.pct)}% more</div></td>
          <td class="r num">${sgn(s.dd)}<div class="mv-meta">${kind==="r" ? `redraft ${sgn(s.dr)}` : `future ${sgn(s.df)}`}</div></td>
          ${o.link ? `<td>${href ? `<a class="btn" href="${href}">Open trade</a>` : ""}</td>` : ""}</tr>`; }).join("") +
      `</tbody></table></div>`;
  }
  const CSS = `.mv td{vertical-align:top;white-space:normal}.mv td:first-child,.mv td:nth-child(2){min-width:190px}
.mv-nm{font-weight:600;overflow-wrap:anywhere}.mv-meta{font-size:.78rem;color:var(--muted);font-family:var(--f-body);white-space:nowrap}
.mv-meta b{color:var(--ink-2);font-weight:600}.mv-own{color:var(--ink-2)}.mv .btn{white-space:nowrap;text-decoration:none;font-size:.8rem;padding:4px 10px}`;
  if (typeof document!=="undefined" && document.head) { const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); }
  // Short explanation used under both pages' tables
  const RULE = "Dynasty values within 10% of each other (too close to call, so a fair ask), and a gain of more than 10%.";
  window.PAMoves = {byIndex, player, pick, swaps, spread, metric, table, league, teamMoves, calc, fmt, esc, BAND, MIN_D, MIN_GAIN, RULE};
})();
