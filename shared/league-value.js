/* Prospect Actuary: league-aware rookie Value for the pre-draft and post-draft grade boards.
 *
 * Reads the league chosen on the Trade Values page (saved in this browser as "pa-tv-league", the same
 * setting the Trade Calculator uses), the trade-values data (../trade-values/data/tv.js: every NFL player's
 * projections per scoring option and the per-tier calibration used to price the 2027 rookie picks) and the
 * age-adjustment tables (../trade-values/data/agetab.js). Then, for any board row:
 *   Value = sum over tiers P(tier) x sum_{k=1..4} v^k x games(tier,k) x E[(PPG(tier,k) + age adj_k - replacement)+]
 * on the 100,000 scale (100,000 = the most valuable NFL player in that league). This is the same math as the
 * Trade Values page's 2027 rookie picks (dv_13_league_presets.R), so a 2027 prospect's Value is his pick value.
 * Falls back to the default league when nothing is saved or storage is blocked; exposes window.PAValue.
 */
(function(){
  const D = window.TV, A = window.TVAGE;
  if (!D || !A || !D.picks || !D.picks.cal) { window.PAValue = {ok:false}; return; }
  const POS = ["QB","RB","WR","TE"], V = D.v;
  const DEF = {teams:12, ppr:1, tep:0, ptd:4, sf:1, rb:2, wr:3, te:1, flex:0, fdQB:0, fdRB:0, fdWR:0, fdTE:0};
  const FD = [0,0.25,0.5,0.75,1];
  const OK = {teams:[8,10,12,14], ppr:[0.5,1], tep:[0,0.5,1], ptd:[4,5,6], sf:[0,1], rb:[2,3], wr:[2,3], te:[1,2], flex:[0,1,2,3],
              fdQB:FD, fdRB:FD, fdWR:FD, fdTE:FD};
  const ORDER = Object.keys(DEF);
  const S = Object.assign({}, DEF);
  let src = null, saved = false;
  try { src = new URLSearchParams(location.search).get("league"); } catch(e){}
  if (!src) try { src = localStorage.getItem("pa-tv-league"); } catch(e){}
  if (src) {
    const a = String(src).split("_").map(Number); while (a.length < ORDER.length && a.length >= 9) a.push(0);
    if (a.length === ORDER.length && ORDER.every((k,i)=>OK[k].includes(a[i]))) { ORDER.forEach((k,i)=>S[k]=a[i]); saved = true; }
  }
  const isDefault = ORDER.every(k=>S[k]===DEF[k]);
  const keyOf = p => (p==="QB" ? "QB_p"+S.ptd : p==="TE" ? "TE_t"+(S.ppr+S.tep) : p+"_r"+S.ppr) + "f" + S["fd"+p];
  function erf(x){ const s = x<0?-1:1; x = Math.abs(x); const t = 1/(1+0.3275911*x);
    return s*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x)); }
  const pnorm = z => 0.5*(1+erf(z/Math.SQRT2)), dnorm = z => Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
  const stoploss = (mu, r, s) => { const z = (mu-r)/s; return s*dnorm(z) + (mu-r)*pnorm(z); };
  // replacement lines: fill every team's lineup (position slots, then FLEX, then SUPERFLEX) -- same as the Trade Values page
  const by = {}; POS.forEach(p=>by[p]=[]);
  D.players.forEach(pl=>{ if (pl.pool) { const a = pl.k[keyOf(pl.p)]; if (a && a[1]!=null) by[pl.p].push(a[1]); } });
  POS.forEach(p=>by[p].sort((a,b)=>b-a));
  const n = {QB:S.teams, RB:S.rb*S.teams, WR:S.wr*S.teams, TE:S.te*S.teams};
  POS.forEach(p=>n[p]=Math.min(n[p], by[p].length));
  const take = (ps, k) => { for (let s=0; s<k; s++){ let best=null, bv=-Infinity;
    ps.forEach(p=>{ if (n[p]<by[p].length && by[p][n[p]]>bv){ bv=by[p][n[p]]; best=p; } }); if (!best) break; n[best]++; } };
  take(["RB","WR","TE"], S.flex*S.teams); take(POS, S.sf*S.teams);
  const rep = {}; POS.forEach(p=>rep[p]=by[p][Math.max(n[p],1)-1]);
  // 100k scale: the most valuable NFL player (dynasty) in this league
  let top = 0;
  D.players.forEach(pl=>{ const key = keyOf(pl.p), x = pl.k[key]; if (!x || x.length<4+2*(D.nf||4)) return;
    const sd = D.sd[key], r = rep[pl.p]; let v = x[2]*stoploss(x[1], r, sd[0]);
    for (let t=1; t<=(D.nf||4); t++) v += Math.pow(V,t) * x[1+2*t] * stoploss(x[2+2*t], r, sd.length>2 ? sd[1+t] : sd[1]*Math.sqrt(t));
    if (v > top) top = v; });
  // q = cumulative [P(top tier), P(top two), P(any tier)]; age on the 0.1 grid of the age table
  function value(pos, q, age){
    if (!q || q.length<3 || age==null || !(top>0)) return null;
    const key = keyOf(pos), c = D.picks.cal[key], tab = A.t[key]; if (!c || !tab) return null;
    const i = Math.min(A.n-1, Math.max(0, Math.round((age - A.a0)/A.step)));
    const d = [0].concat(tab[i]), q2 = Math.max(q[1], q[0]), q3 = Math.max(q[2], q2);
    const P = [q[0], q2-q[0], q3-q2, 1-q3], r = rep[pos]; let v = 0;
    const NK = D.picks.nk||4; for (let tr=0; tr<4; tr++) for (let k=0; k<NK; k++){ const j = NK*tr+k; v += (D.picks.f||1)*P[tr]*Math.pow(V,k+1)*c.G[j]*stoploss(c.mu[j]+d[k], r, c.sd[j]); }
    return 1e5*v/top;
  }
  const fdTxt = POS.filter(p=>S["fd"+p]>0).map(p=>`${p} ${S["fd"+p]}`).join(", ");
  const label = `${S.teams} teams, ${S.sf?"superflex":"1 QB"}, ${S.ppr===1?"PPR":"half PPR"}` +
    `${S.tep?`, TE premium +${S.tep}`:""}${S.ptd!==4?`, ${S.ptd}-pt passing TD`:""}` +
    `, ${S.rb} RB / ${S.wr} WR / ${S.te} TE${S.flex?`, ${S.flex} FLEX`:", no flex"}${fdTxt?`, first-down bonus ${fdTxt}`:""}`;
  window.PAValue = {ok:true, value, label, isDefault, saved, league:S, rep};
})();
