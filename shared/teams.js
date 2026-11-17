/* Prospect Actuary: NFL team analytics, shared by /team-analytics/ and player profiles.
 *
 * Data: data/teams/{season}.json and data/teams/summary.json (scripts/build_teams.py, from nflverse weekly player stats,
 * regular season). The files hold raw stat categories only; points are scored here with the league settings in use
 * (shared/league.js): PPR or half PPR, passing TD points, TE premium and per-position first-down bonuses.
 *
 * Each player-week carries 16 categories:
 *   0-4   passing   pass_yds, pass_td, int, pass_2pt, sack_fumbles_lost
 *   5-9   rushing   rush_yds, rush_td, rush_first_downs, rush_2pt, rush_fumbles_lost
 *   10-15 receiving receptions, rec_yds, rec_td, rec_first_downs, rec_2pt, rec_fumbles_lost
 * Passing and receiving count the same plays twice (a TD pass scores for the passer and the receiver), as fantasy scoring does.
 */
(function(){
  const POS = ["QB","RB","WR","TE"];
  // [passing, rushing, receiving] fantasy points for one set of 16 categories by a player at pos, in league S
  function score(c, pos, S){
    const fd = S["fd"+pos] || 0, ppr = S.ppr + (pos==="TE" ? (S.tep||0) : 0);
    return [0.04*c[0] + S.ptd*c[1] - 2*c[2] + 2*c[3] - 2*c[4],
            0.1*c[5] + 6*c[6] + fd*c[7] + 2*c[8] - 2*c[9],
            ppr*c[10] + 0.1*c[11] + 6*c[12] + fd*c[13] + 2*c[14] - 2*c[15]];
  }
  const cache = {};
  const load = (root, f) => cache[f] || (cache[f] = fetch(root + "data/teams/" + f).then(r=>{ if (!r.ok) throw new Error(f + " " + r.status); return r.json(); }));
  // One season, scored for league S. win = "all" or a number of most recent games per team.
  // Returns {weeks, teams: {T: {g, weeks:[...], off:[p,r,c], offPos:{QB:[p,r,c]...}, def:[p,r,c], defPos:{QB:n...}, byWeek:{w:{opp, off:[p,r,c]}}, players:[...]}}}
  function season(doc, S, win){
    const T = {}, get = t => T[t] || (T[t] = {weeks:new Set(), dweeks:new Set(), byWeek:{}, dByWeek:{}});
    doc.rows.forEach(r=>{ get(r[1]).weeks.add(r[2]); if (r[3]) get(r[3]).dweeks.add(r[2]); });
    const keep = {}, dkeep = {};
    Object.entries(T).forEach(([t, x])=>{ const ws = [...x.weeks].sort((a,b)=>a-b), ds = [...x.dweeks].sort((a,b)=>a-b);
      keep[t] = new Set(win==="all" ? ws : ws.slice(-win)); dkeep[t] = new Set(win==="all" ? ds : ds.slice(-win)); });
    const z = () => [0,0,0], zp = () => ({QB:[0,0,0], RB:[0,0,0], WR:[0,0,0], TE:[0,0,0]});
    Object.values(T).forEach(x=>{ x.off = z(); x.offPos = zp(); x.def = z(); x.defPos = zp(); x.pl = {}; });
    doc.rows.forEach(r=>{
      const [pi, tm, wk, opp] = r, pl = doc.players[pi], pos = pl[1], s = score(r.slice(4), pos, S);
      if (keep[tm].has(wk)) {
        const x = T[tm]; for (let i=0;i<3;i++){ x.off[i] += s[i]; x.offPos[pos][i] += s[i]; }
        const bw = x.byWeek[wk] || (x.byWeek[wk] = {opp, off:z()}); for (let i=0;i<3;i++) bw.off[i] += s[i];
        const p = x.pl[pi] || (x.pl[pi] = {i:pi, n:pl[0], pos, id:pl[2], g:new Set(), pts:z()}); p.g.add(wk); for (let i=0;i<3;i++) p.pts[i] += s[i];
      }
      if (opp && dkeep[opp] && dkeep[opp].has(wk)) { const x = T[opp]; for (let i=0;i<3;i++){ x.def[i] += s[i]; x.defPos[pos][i] += s[i]; }
        const bw = x.dByWeek[wk] || (x.dByWeek[wk] = {opp:tm, def:z()}); for (let i=0;i<3;i++) bw.def[i] += s[i]; }
    });
    Object.entries(T).forEach(([t, x])=>{ x.g = keep[t].size; x.dg = dkeep[t].size; x.players = Object.values(x.pl).map(p=>Object.assign(p, {g:p.g.size})); delete x.pl; });
    return {season: doc.season, weeks: doc.weeks, teams: T};
  }
  // every season from summary.json, scored for S: {season: {team: {g, off:[p,r,c], def:[p,r,c], defPos:{QB:n...}}}}
  function history(sum, S){
    const out = {};
    Object.keys(sum.off).forEach(s=>{ out[s] = {};
      Object.keys(sum.off[s]).forEach(t=>{
        const o = sum.off[s][t], d = sum.def[s][t] || [0, ...POS.map(()=>new Array(16).fill(0))];
        const off = [0,0,0], def = [0,0,0], defPos = {};
        POS.forEach((p,k)=>{ const a = score(o[k+1], p, S), b = score(d[k+1], p, S); for (let i=0;i<3;i++){ off[i] += a[i]; def[i] += b[i]; } defPos[p] = b[0]+b[1]+b[2]; });
        out[s][t] = {g:o[0], dg:d[0], off, def, defPos};
      }); });
    return out;
  }
  const sum3 = a => a[0]+a[1]+a[2];
  // rank 1 = highest; f(teamObject, teamCode); returns {team: rank}
  function ranks(teams, f){ const ks = Object.keys(teams).sort((a,b)=>f(teams[b], b)-f(teams[a], a)); const o = {}; ks.forEach((k,i)=>o[k]=i+1); return o; }
  const NAMES = {ARI:"Arizona Cardinals",ATL:"Atlanta Falcons",BAL:"Baltimore Ravens",BUF:"Buffalo Bills",CAR:"Carolina Panthers",CHI:"Chicago Bears",CIN:"Cincinnati Bengals",CLE:"Cleveland Browns",
    DAL:"Dallas Cowboys",DEN:"Denver Broncos",DET:"Detroit Lions",GB:"Green Bay Packers",HOU:"Houston Texans",IND:"Indianapolis Colts",JAX:"Jacksonville Jaguars",KC:"Kansas City Chiefs",
    LA:"Los Angeles Rams",LAC:"Los Angeles Chargers",LV:"Las Vegas Raiders",MIA:"Miami Dolphins",MIN:"Minnesota Vikings",NE:"New England Patriots",NO:"New Orleans Saints",NYG:"New York Giants",
    NYJ:"New York Jets",PHI:"Philadelphia Eagles",PIT:"Pittsburgh Steelers",SEA:"Seattle Seahawks",SF:"San Francisco 49ers",TB:"Tampa Bay Buccaneers",TEN:"Tennessee Titans",WAS:"Washington Commanders"};
  window.PATeams = {POS, score, season, history, ranks, sum3, NAMES,
    loadSeason: (root, s) => load(root, s + ".json"), loadSummary: root => load(root, "summary.json")};
})();
