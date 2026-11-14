/* Prospect Actuary: league-aware rookie Value for the pre-draft and post-draft grade boards.
 *
 * Uses the league saved in this browser ("pa-tv-league", shared/league.js) and the shared value engine (shared/engine.js)
 * on the trade-values data (../trade-values/data/tv.js) and age tables (agetab.js). For any board row:
 *   Value = sum over tiers P(tier) x sum_{k=1..4} v^k x games(tier,k) x E[(PPG(tier,k) + age adj_k - replacement)+]
 * on the 100,000 scale (100,000 = the most valuable NFL player in that league). This is the same math as the 2027 rookie
 * picks on Player Values (dv_13_league_presets.R), so a 2027 prospect's Value is his pick value.
 * Value is a dynasty-asset measure for a league; the letter grade is a separate, within-position prospect measure.
 * Falls back to the default league when nothing is saved or storage is blocked; exposes window.PAValue.
 */
(function(){
  const D = window.TV, A = window.TVAGE, L = window.PALeague;
  if (!D || !A || !D.picks || !D.picks.cal || !L || !window.PAEngine) { window.PAValue = {ok:false}; return; }
  const E = window.PAEngine(D, A), S = L.load();
  let saved = false; try { saved = !!(new URLSearchParams(location.search).get("league") || localStorage.getItem("pa-tv-league")); } catch(e){}
  const value = (pos, q, age) => E.prospectValue(S, pos, q, age);
  window.PAValue = {ok:true, value, label: L.label(S), isDefault: L.isDefault(S), saved, league:S, rep: E.compute(S).RD.rep};
})();
