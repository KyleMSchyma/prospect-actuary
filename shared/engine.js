/* Prospect Actuary: the trade-value engine, written once for every page.
 *
 * Presentation only: every number it uses comes from the R models (window.TV = trade-values/data/tv.js, written by
 * dv_12 each Tuesday; window.TVAGE = agetab.js). This file only turns those projections into values for a league:
 *   replacement lines  fill every team's lineup (position slots, then FLEX, then SUPERFLEX) by expected PPG   (dv_10 rep_lines)
 *   redraft value      (credible PPG - replacement) x expected games left                                      (dv_10)
 *   dynasty value      rest of 2026 + sum_t v^t x games_t x E[(PPG_t - replacement)+]  (stop-loss, normal)     (dv_11 / dv_13)
 *   2027 picks         sum over tiers P(tier) x sum_k v^k x games x E[(tier PPG + age adj - replacement)+]       (dv_13)
 *   100,000 scale      the top player on each sheet = 100,000; values add.
 * It replaces the four copies that lived in Trade Values, the Trade Calculator, Market Check and league-value.js.
 * The weekly gate 6b (rf_03_gates.R) checks the Trade Values page, which calls this file, against R in 5 leagues.
 *
 * usage: const E = PAEngine(window.TV, window.TVAGE);  const C = E.compute(S);   (S = a league from PALeague)
 */
(function(){
  const POS = ["QB","RB","WR","TE"];
  function erf(x){ const s = x<0?-1:1; x = Math.abs(x); const t = 1/(1+0.3275911*x);
    return s*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x)); }
  const pnorm = z => 0.5*(1+erf(z/Math.SQRT2)), dnorm = z => Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
  const stoploss = (mu, r, s) => { const z = (mu-r)/s; return s*dnorm(z) + (mu-r)*pnorm(z); };   // E[(PPG - replacement)+]
  // scoring key of a position's projections: QB by pass-TD points, TE by points per catch incl. premium, RB/WR by PPR; then first-down bonus
  const keyOf = (S, p) => (p==="QB" ? "QB_p"+S.ptd : p==="TE" ? "TE_t"+(S.ppr+S.tep) : p+"_r"+S.ppr) + "f" + (S["fd"+p]||0);

  function PAEngine(D, AGE){
    if (!D || !D.players) return null;
    const V = D.v, NF = D.nf||4;
    function repLines(S, cp){                       // cp(player) = credible PPG under the chosen scoring
      const by = {}; POS.forEach(p=>by[p]=[]);
      D.players.forEach(pl=>{ if (pl.pool) { const c = cp(pl); if (c!=null) by[pl.p].push(c); } });
      POS.forEach(p=>by[p].sort((a,b)=>b-a));
      const n = {QB:S.teams, RB:S.rb*S.teams, WR:S.wr*S.teams, TE:S.te*S.teams};
      POS.forEach(p=>n[p]=Math.min(n[p], by[p].length));
      const take = (ps, k) => { for (let s=0; s<k; s++){ let best=null, bv=-Infinity;
        ps.forEach(p=>{ if (n[p]<by[p].length && by[p][n[p]]>bv){ bv=by[p][n[p]]; best=p; } }); if (!best) break; n[best]++; } };
      take(["RB","WR","TE"], S.flex*S.teams); take(POS, S.sf*S.teams);
      const rep = {}; POS.forEach(p=>rep[p]=by[p][Math.max(n[p],1)-1]); return {rep, n};
    }
    // 2027 prospect / pick value (raw scale) from cumulative tier odds P = [P(top), P(2nd), P(3rd), P(none)] and per-season age adjustments d
    function tierValue(S, RD, pos, P, d){
      const key = keyOf(S, pos), c = D.picks && D.picks.cal[key]; if (!c || !d) return null;
      const r = RD.rep[pos], NK = D.picks.nk||4; let v = 0;
      for (let tr=0; tr<4; tr++) for (let k=0; k<NK; k++){ const i = NK*tr+k; v += (D.picks.f||1) * P[tr] * Math.pow(V,k+1) * c.G[i] * stoploss(c.mu[i]+d[k], r, c.sd[i]); }
      return v;
    }
    let cacheKey = null, cache = null;
    function compute(S){
      const ck = JSON.stringify(S); if (ck===cacheKey) return cache;
      const kp = p => keyOf(S, p);
      const rdArr = pl => (pl.r && pl.r[kp(pl.p)]) || pl.k[kp(pl.p)];      // pl.r: redraft frozen after Week 18
      const RR = repLines(S, pl => { const a = rdArr(pl); return a ? a[1] : null; });
      const RD = repLines(S, pl => { const a = pl.k[kp(pl.p)]; return a ? a[1] : null; });
      const red = [], dyn = [], rRaw = new Array(D.players.length).fill(0), dRaw = new Array(D.players.length).fill(0);
      D.players.forEach((pl,i)=>{
        const key = kp(pl.p), a = rdArr(pl);
        if (a) { const por = a[1]-RR.rep[pl.p], v = por*a[2]; rRaw[i] = Math.max(0, v);
          if (v>0) red.push({i, n:pl.n, st:pl.st, p:pl.p, tm:pl.tm, a:pl.a, g:pl.g, ppg:a[0], cppg:a[1], por, eg:a[2], rep:RR.rep[pl.p], raw:v}); }
        const x = pl.k[key]; if (!x || x.length<4+2*NF) return;          // [2026 PPG, credible PPG, games left, (games, PPG) 2027..2031, P(playing 2030)]
        const sd = D.sd[key], r = RD.rep[pl.p];
        let v = x[2]*stoploss(x[1], r, sd[0]);
        const parts = [{y:0, g:x[2], ppg:x[1], v}];
        for (let t=1; t<=NF; t++){ const pv = Math.pow(V,t) * x[1+2*t] * stoploss(x[2+2*t], r, sd.length>2 ? sd[1+t] : sd[1]*Math.sqrt(t));
          v += pv; parts.push({y:t, g:x[1+2*t], ppg:x[2+2*t], v:pv}); }
        dRaw[i] = v;
        dyn.push({i, n:pl.n, st:pl.st, p:pl.p, tm:pl.tm, a:pl.a, dp:pl.dp, g:pl.g, ppg:x[0], cppg:x[1], rep:r, parts, p27:x[4], p30:x[10], s30:x[x.length-1], raw:v});
      });
      // 2027 rookie picks: each prospect's value for this league, sorted; pick 1.01 = best value, 1.02 = second ...
      const pv = D.picks ? D.picks.pros.map(pr=>tierValue(S, RD, pr.p, pr.P, pr.d[kp(pr.p)]) || 0).sort((a,b)=>b-a) : [];
      const pickRows = [];
      for (let s=0; s<3*S.teams && s<pv.length; s++){ const rd = Math.floor(s/S.teams)+1, pk = s%S.teams+1, lab = `${rd}.${String(pk).padStart(2,"0")}`;
        pickRows.push({id:"k:"+lab, slot:lab, n:`2027 Pick ${lab}`, p:"PICK", pick:true, raw:pv[s]}); }
      const topR = Math.max(...red.map(r=>r.raw)), topD = Math.max(...dyn.map(r=>r.raw));
      red.forEach(r=>r.v = 1e5*r.raw/topR); dyn.forEach(r=>r.v = 1e5*r.raw/topD); pickRows.forEach(r=>r.v = 1e5*r.raw/topD);
      const rank = rows => { rows.sort((a,b)=>b.v-a.v); const pc = {};
        rows.forEach((r,k)=>{ r.r = k+1; pc[r.p] = (pc[r.p]||0)+1; r.rp = r.pick ? "" : r.p+pc[r.p]; }); return rows; };
      const dynAll = rank(dyn.concat(pickRows.map(r=>Object.assign({}, r))));
      rank(red);
      // by player index (the calculator, search and Market Check look players up this way); ranks only for value > 0
      const rk = rows => { const o = {}; rows.forEach(r=>{ if (!r.pick && r.v>0) o[r.i] = r.rp; }); return o; };
      cacheKey = ck;
      cache = {red, dyn: dynAll.filter(r=>r.v>=500), dynAll, picks: pickRows, RR, RD, topR, topD,
               r: rRaw.map(v=>1e5*v/topR), d: dRaw.map(v=>1e5*v/topD), rr: rk(red), rd: rk(dynAll)};
      return cache;
    }
    // Value of one prospect on the dynasty 100k scale (grade boards' Value column): q = cumulative [P(top), P(top two), P(any)], age on the 0.1 grid
    function prospectValue(S, pos, q, age){
      if (!AGE || !q || q.length<3 || age==null) return null;
      const C = compute(S); if (!(C.topD>0)) return null;
      const tab = AGE.t[keyOf(S, pos)]; if (!tab) return null;
      const i = Math.min(AGE.n-1, Math.max(0, Math.round((age - AGE.a0)/AGE.step)));
      const d = [0].concat(tab[i]), q2 = Math.max(q[1], q[0]), q3 = Math.max(q[2], q2);
      const v = tierValue(S, C.RD, pos, [q[0], q2-q[0], q3-q2, 1-q3], d);
      return v==null ? null : 1e5*v/C.topD;
    }
    return {compute, prospectValue, repLines, keyOf, stoploss, POS, asof: D.asof, data: D};
  }
  PAEngine.keyOf = keyOf; PAEngine.stoploss = stoploss; PAEngine.POS = POS;
  window.PAEngine = PAEngine;
})();
