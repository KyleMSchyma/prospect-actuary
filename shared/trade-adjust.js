/* Prospect Actuary: trade-type + best-asset-gap adjustment for the Trade Calculator (Kyle approved 2026-11-24, shipped with
 * the Nov 28 batch). Values stay additive and unchanged; this only adds a second, market-style read of a multi-player trade.
 *
 * Fit (Football repo Trade_Values/research/trade_adjustment/ta_01_fit_market.py, system ADD, PR #43): 68,903 Dynasty Daddy
 * dynasty trades (superflex, 10-14 teams, players only, 1-3 assets a side, Sep 8 - Nov 20 2026, owner permission), last
 * 14 days held out. Side 1 = the side holding the single best asset; type = n1 v n2; g = ln(best1 / best2) >= 0.
 * Real trades are taken as fair, so adj(type, g) = a + b g + c g^2 = -E[ln(S1/S2) | type, g]. Adjusted gap = ln(S1/S2) + adj.
 * 1-for-1 trades are left unadjusted (a gap term there would just turn our values into market prices).
 * Held-out error vs unadjusted additive: 1v2 0.23, 2v1 0.23, 2v2 0.29 (normalised by the typical 1-for-1 miss).
 * Throw-in cliff guard: an asset worth under 25% of the trade's best asset counts as a fraction of a piece (0 at 5% or
 * less, full at 25%), so adding a near-worthless bench player cannot flip the read.
 * Limits: dynasty only; picks were not in the fit (trades with a pick get no adjustment); g is clipped to the range seen
 * in training. Refit weekly with the trade-market update (tm_weekly) once that job writes these coefficients.
 */
(function(){
  const FIT = {   // type: [a, b, c, g_max]  (ta_market_fit.csv / ta_market_curves.csv, system ADD, 2026-11-24)
    "1v2": [ 0.30370636, -0.89416928, -0.01887787, 1.853],
    "1v3": [ 0.46886815, -0.82676742, -0.02292916, 1.862],
    "2v1": [-0.30022622, -0.94660735, -0.01064944, 1.783],
    "2v2": [-0.00616422, -0.71971167, -0.07587482, 1.480],
    "2v3": [ 0.14040998, -0.62076633, -0.07936280, 1.411],
    "3v1": [-0.47208060, -0.92075280, -0.02942676, 1.724],
    "3v2": [-0.16150054, -0.68431486, -0.09212458, 1.272],
    "3v3": [-0.02496583, -0.51690607, -0.13628551, 1.232],
    asof: "2026-11-24", trades: 68903 };
  const adjOf = (type, g) => { const f = FIT[type]; if (!f) return type==="1v1" ? 0 : null; const x = Math.max(0, Math.min(f[3], g)); return f[0] + f[1]*x + f[2]*x*x; };
  const w = (v, best) => Math.max(0, Math.min(1, (v/best - 0.05) / 0.20));   // weight of a small piece
  // a, b: arrays of asset values (our additive values, any scale). Returns null when the read does not apply.
  function read(a, b){
    a = a.filter(v=>v>0); b = b.filter(v=>v>0);
    if (!a.length || !b.length) return null;
    if (a.length > 3 || b.length > 3) return {skip:"more than 3 pieces a side (not in the fitted trades)"};
    const sa = a.reduce((s,v)=>s+v,0), sb = b.reduce((s,v)=>s+v,0), ma = Math.max(...a), mb = Math.max(...b);
    const oneIsA = ma >= mb, S1 = oneIsA ? a : b, S2 = oneIsA ? b : a, best = Math.max(ma, mb);
    const g = Math.log(Math.max(...S1) / Math.max(...S2)), r = Math.log((oneIsA ? sa : sb) / (oneIsA ? sb : sa));
    // the full type, then blend toward the type without the smallest piece if that piece is a throw-in
    const all = S1.map(v=>[v,1]).concat(S2.map(v=>[v,2])), small = all.filter(([v])=>v<best).sort((x,y)=>x[0]-y[0])[0];
    const t = (n1, n2) => n1 + "v" + n2;
    let adj = adjOf(t(S1.length, S2.length), g);
    if (adj == null) return {skip:"trade shape not in the fitted trades"};
    if (small) { const k = w(small[0], best);
      if (k < 1) { const n1 = S1.length - (small[1]===1), n2 = S2.length - (small[1]===2);
        if (n1 >= 1 && n2 >= 1) { const a0 = adjOf(t(n1, n2), g); if (a0 != null) adj = k*adj + (1-k)*a0; } } }
    const ra = r + adj;   // > 0: side 1 (holding the best asset) comes out ahead the way real trades of this shape settle
    return {type: t(S1.length, S2.length), g, r, adj, ra, aAhead: oneIsA ? ra > 0 : ra < 0, pct: Math.exp(Math.abs(ra)) - 1, even: Math.abs(ra) < -Math.log(0.9)};
  }
  window.PATradeAdjust = {read, FIT};
})();
