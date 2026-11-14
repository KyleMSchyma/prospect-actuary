/* Prospect Actuary: Sleeper league import, written once for the League page and the Trade Calculator.
 *
 * Reads Sleeper's free public API (api.sleeper.app, read only, no login or key) straight from the browser. Nothing is
 * sent anywhere else and nothing can be changed in Sleeper. What it does:
 *   leagues(username)        the user's leagues this NFL season (dynasty first)
 *   fetchLeague(id)          league, users, rosters, traded picks and drafts
 *   settings(league)         maps Sleeper's scoring and lineup onto our league options (shared/league.js); every
 *                            setting we can't match exactly comes back as a plain-English note, never silently
 *   build(raw, X)            teams with players (matched through data/sleeper_ids.json) and the draft picks each owns
 *   price(M, C, D, mode)     every player and pick valued with our engine (shared/engine.js), team totals,
 *                            position totals, best starting lineup and a contender / middle / rebuilder label
 * Picks: our values cover 2027 rounds 1-3. A 2027 pick is priced at its exact slot when the league has set the 2027
 * draft order, otherwise at the average of its round (stated on screen). 2028+ picks and rounds 4+ are listed as not valued.
 * Remembers the last league (and which team is yours) in this browser: localStorage "pa-sleeper".
 */
(function(){
  if (window.PASleeper) return;
  const API = "https://api.sleeper.app/v1/", POS = ["QB","RB","WR","TE"];
  const get = path => fetch(API + path).then(r=>{ if (!r.ok) throw new Error("Sleeper answered " + r.status); return r.json(); });
  const KEY = "pa-sleeper";
  const remember = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch(e){} };
  const recall = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); return o && o.league ? o : null; } catch(e){ return null; } };
  const forget = () => { try { localStorage.removeItem(KEY); } catch(e){} };
  const isLeagueId = s => /^\d{12,20}$/.test(String(s||"").trim());

  async function season(){ try { const s = await get("state/nfl"); return String(s.league_season || s.season); } catch(e){ return String(new Date().getFullYear()); } }
  async function leagues(username){
    const u = await get("user/" + encodeURIComponent(String(username).trim()));
    if (!u || !u.user_id) throw new Error(`No Sleeper user named "${username}"`);
    const yr = await season(), ls = await get(`user/${u.user_id}/leagues/nfl/${yr}`) || [];
    const out = ls.map(l=>({id:l.league_id, name:l.name, teams:l.total_rosters, dynasty: l.settings && l.settings.type===2, keeper: l.settings && l.settings.type===1, season:l.season, status:l.status}));
    out.sort((a,b)=>(b.dynasty-a.dynasty) || a.name.localeCompare(b.name));
    return {user:{id:u.user_id, name:u.display_name || u.username}, season:yr, leagues:out};
  }
  async function fetchLeague(id){
    id = String(id).trim();
    const [league, users, rosters, traded, drafts] = await Promise.all([get("league/"+id), get(`league/${id}/users`), get(`league/${id}/rosters`), get(`league/${id}/traded_picks`), get(`league/${id}/drafts`)]);
    if (!league || !league.league_id) throw new Error("No Sleeper league with that ID");
    return {league, users: users||[], rosters: rosters||[], traded: traded||[], drafts: drafts||[]};
  }

  // ---------- settings: Sleeper scoring and lineup -> our options ----------
  const nearest = (x, opts) => opts.reduce((b,o)=>Math.abs(o-x) < Math.abs(b-x) ? o : b, opts[0]);
  const q = x => Math.round(Number(x||0)*1000)/1000;                    // Sleeper stores 0.04 as 0.03999999
  function settings(league){
    const sc = league.scoring_settings || {}, rp = league.roster_positions || [], notes = [], S = {};
    const n = {}; rp.forEach(p=>n[p] = (n[p]||0)+1);
    // teams
    const nt = league.total_rosters || (league.settings && league.settings.num_teams) || 12;
    S.teams = nearest(nt, [8,10,12,14]); if (S.teams!==nt) notes.push(`${nt} teams: our values support 8, 10, 12 or 14, so this uses ${S.teams}.`);
    // points per catch and TE premium
    const rec = q(sc.rec);
    S.ppr = rec >= 0.75 ? 1 : 0.5; if (rec!==S.ppr) notes.push(`${rec} points per catch: our values support half or full PPR, so this uses ${S.ppr===1?"full":"half"} PPR.`);
    const tep = q(sc.bonus_rec_te);
    S.tep = nearest(tep, [0,0.5,1]); if (tep!==S.tep) notes.push(`TE premium +${tep} per catch: this uses +${S.tep}, the nearest we support.`);
    ["rb","wr"].forEach(p=>{ const b = q(sc["bonus_rec_"+p]); if (b) notes.push(`Extra ${b} per ${p.toUpperCase()} catch is not in our values (only a TE premium is).`); });
    // passing TDs
    const ptd = q(sc.pass_td || 4);
    S.ptd = nearest(ptd, [4,5,6]); if (ptd!==S.ptd) notes.push(`${ptd}-point passing TDs: this uses ${S.ptd}.`);
    // first-down bonuses: our bonus is per rushing or receiving first down, per position (never passing)
    const rfd = q(sc.rush_fd), cfd = q(sc.rec_fd);
    const fd = (p, base) => { const raw = q(base + q(sc["bonus_fd_"+p.toLowerCase()])), v = Math.max(0, Math.min(1, Math.round(raw*4)/4));
      if (v!==raw) notes.push(`${p} first-down bonus of ${raw}: this uses ${v} (we support 0 to 1 in steps of 0.25).`); return v; };
    S.fdQB = fd("QB", rfd);
    if (rfd!==cfd) notes.push(`Rushing (${rfd}) and receiving (${cfd}) first downs score differently: RBs use the average of the two.`);
    S.fdRB = fd("RB", (rfd+cfd)/2); S.fdWR = fd("WR", cfd); S.fdTE = fd("TE", cfd);
    if (q(sc.pass_fd)) notes.push(`Passing first downs (${q(sc.pass_fd)} each) are not in our values.`);
    // scoring we don't model (the values assume standard yardage and no milestone bonuses)
    const std = {pass_yd:0.04, rush_yd:0.1, rec_yd:0.1};
    Object.entries(std).forEach(([k,v])=>{ if (sc[k]!=null && q(sc[k])!==v) notes.push(`${k.replace("_yd"," yards").replace("pass","Passing").replace("rush","Rushing").replace("rec","Receiving")} score ${q(sc[k])} a yard; our values assume ${v}.`); });
    const extra = Object.keys(sc).filter(k=>/^(bonus_(pass|rush|rec|rush_rec)_yd_|bonus_pass_cmp|bonus_rush_att|rush_att$|pass_cmp$|pass_att$|rec_\d+_\d+|rec_40p|rush_40p|pass_td_40p|rec_td_40p|rush_td_40p|bonus_rush_td_qb)/.test(k) && q(sc[k])!==0);
    if (extra.length) notes.push(`Not in our values: ${extra.length} bonus${extra.length>1?"es":""} such as ${extra.slice(0,3).join(", ")}.`);
    // lineup
    let qb = n.QB||0, rb = n.RB||0, wr = n.WR||0, te = n.TE||0, flex = n.FLEX||0, sf = n.SUPER_FLEX||0;
    if (n.WRRB_FLEX) { flex += n.WRRB_FLEX; notes.push(`${n.WRRB_FLEX} RB/WR flex counted as a regular flex.`); }
    if (n.REC_FLEX) { flex += n.REC_FLEX; notes.push(`${n.REC_FLEX} WR/TE flex counted as a regular flex.`); }
    if (qb===0 && sf===0) notes.push("No QB slot: values still assume one starting QB.");
    if (qb>=2) { notes.push(`${qb} QB slots: valued as 1 QB plus superflex, the closest we support.`); sf = Math.max(sf, 1); }
    if (sf>1) notes.push(`${sf} superflex slots: valued as 1.`);
    S.sf = sf ? 1 : 0;
    const fit = (p, have, lo, hi) => { let v = have;
      while (v<lo && flex>0) { v++; flex--; }
      if (v<lo) { notes.push(`${have} starting ${p}: our values need at least ${lo}, so this uses ${lo}.`); v = lo; }
      else if (v!==have) notes.push(`${have} starting ${p}: this uses ${v} and ${v-have} fewer flex, so the number of starters stays the same.`);
      if (v>hi) { flex += v-hi; notes.push(`${v} starting ${p}: this uses ${hi} plus ${v-hi} more flex.`); v = hi; }
      return v; };
    S.rb = fit("RB", rb, 2, 3); S.wr = fit("WR", wr, 2, 3); S.te = fit("TE", te, 1, 2);
    if (flex>3) notes.push(`${flex} flex slots: our values support up to 3, so this uses 3.`);
    S.flex = Math.min(3, flex);
    const other = rp.filter(p=>!["QB","RB","WR","TE","FLEX","SUPER_FLEX","WRRB_FLEX","REC_FLEX","BN","IR","TAXI"].includes(p));
    if (other.length) notes.push(`${[...new Set(other)].join(", ")} slots are left out (we value QB, RB, WR and TE only).`);
    return {S, notes, exact: !notes.length};
  }

  // ---------- teams, players and owned picks ----------
  function build(raw, X){
    const {league, users, rosters, traded, drafts} = raw, yr = Number(league.season), rounds = (league.settings && league.settings.draft_rounds) || 4;
    const uById = {}; users.forEach(u=>uById[u.user_id] = u);
    // picks are tradable for the next three drafts (the current one too while it hasn't happened)
    const thisDraft = drafts.find(d=>Number(d.season)===yr), seasons = [];
    if (thisDraft && thisDraft.status!=="complete" && league.status!=="in_season") seasons.push(yr);
    for (let s=yr+1; s<=yr+3; s++) seasons.push(s);
    const owner = {};                                     // "season.round.origRoster" -> current roster id
    rosters.forEach(r=>seasons.forEach(s=>{ for (let k=1; k<=rounds; k++) owner[`${s}.${k}.${r.roster_id}`] = r.roster_id; }));
    traded.forEach(t=>{ const id = `${t.season}.${t.round}.${t.roster_id}`; if (id in owner) owner[id] = t.owner_id; });
    // exact slot when the league has set that draft's order
    const slotOf = {};
    drafts.forEach(d=>{ if (d.slot_to_roster_id) Object.entries(d.slot_to_roster_id).forEach(([slot, rid])=>{ slotOf[`${d.season}.${rid}`] = {slot:+slot, snake: d.type==="snake"}; }); });
    const nT = rosters.length;
    const teams = rosters.map(r=>{
      const u = uById[r.owner_id] || {}, md = u.metadata || {};
      const reserve = new Set(r.reserve||[]), taxi = new Set(r.taxi||[]);
      const players = (r.players||[]).map(sid=>{ const k = X.m[sid], o = X.o[sid];
        return {sid, key:k||null, name: k ? k.split("|")[0] : o ? o[0] : null, pos: k ? k.split("|")[1] : o ? o[1] : null, tm: o ? o[2] : null, ir: reserve.has(sid), taxi: taxi.has(sid)}; });
      const picks = Object.entries(owner).filter(([,rid])=>rid===r.roster_id).map(([id])=>{ const [s,k,orig] = id.split(".").map(Number);
        const so = slotOf[`${s}.${orig}`]; let slot = so ? so.slot : null; if (slot && so.snake && k%2===0) slot = nT+1-slot;
        return {id:`s:${s}.${k}.${orig}`, season:s, round:k, orig, slot}; }).sort((a,b)=>a.season-b.season || a.round-b.round || (a.slot||99)-(b.slot||99));
      return {rid:r.roster_id, owner:r.owner_id, user: u.display_name || "Open team", name: md.team_name || u.display_name || `Team ${r.roster_id}`,
              avatar: u.avatar || null, players, picks, wins: r.settings ? r.settings.wins : 0, losses: r.settings ? r.settings.losses : 0};
    });
    const byRid = {}; teams.forEach(t=>byRid[t.rid] = t);
    teams.forEach(t=>t.picks.forEach(p=>{ const o = byRid[p.orig]; p.from = o && o.rid!==t.rid ? o.name : null; }));
    return {id: league.league_id, name: league.name, season: yr, dynasty: league.settings && league.settings.type===2, rounds, teams, byRid, nT};
  }
  const ordinal = k => k===1?"1st":k===2?"2nd":k===3?"3rd":k+"th";
  const pickName = p => `${p.season} ${p.slot ? `Pick ${p.round}.${String(p.slot).padStart(2,"0")}` : `Round ${p.round} pick`}`;
  // value of one owned pick on the dynasty scale (redraft: 0)
  function pickValue(p, C, S, mode){
    if (mode!=="d" || p.season!==2027 || p.round>3) return {v:0, note: p.season!==2027 ? "Not valued yet: our pick values cover 2027" : p.round>3 ? "Not valued: our pick values cover rounds 1-3" : "Picks count in dynasty only", valued:false};
    const row = C.picks.filter(x=>x.slot.startsWith(p.round+"."));
    if (!row.length) return {v:0, note:"Not valued", valued:false};
    if (p.slot) { const r = row[Math.min(p.slot, row.length)-1]; return {v:r.v, note:"Exact slot", valued:true, exact:true}; }
    return {v: row.reduce((a,x)=>a+x.v,0)/row.length, note:"Slot not set yet: valued at the round's average", valued:true};
  }
  // players and picks valued for a league; teams ranked
  function price(M, C, D, S, mode){
    const idx = {}; D.players.forEach((pl,i)=>idx[pl.n+"|"+pl.p] = i);
    const val = i => mode==="d" ? C.d[i] : C.r[i], rk = mode==="d" ? C.rd : C.rr;
    M.teams.forEach(t=>{
      t.players.forEach(p=>{ p.i = p.key!=null && idx[p.key]!=null ? idx[p.key] : null;
        if (p.i!=null) { const pl = D.players[p.i]; p.v = val(p.i); p.d = C.d[p.i]; p.r = C.r[p.i]; p.rank = rk[p.i] || ""; p.a = pl.a; p.tm = pl.tm; p.st = pl.st; }
        else { p.v = p.d = p.r = 0; } });
      t.players.sort((a,b)=>(b.v-a.v) || ((a.pos||"Z")>(b.pos||"Z")?1:-1));
      t.picks.forEach(p=>Object.assign(p, pickValue(p, C, S, mode), {name: pickName(p)}));
      t.pos = {}; POS.forEach(p=>t.pos[p] = t.players.filter(x=>x.pos===p).reduce((a,x)=>a+x.v,0));
      t.pickTotal = t.picks.reduce((a,p)=>a+p.v,0);
      t.total = POS.reduce((a,p)=>a+t.pos[p],0) + t.pickTotal;
      // best starting lineup now (redraft values): QB, RB, WR, TE slots, then FLEX, then SUPERFLEX
      const pool = t.players.filter(x=>x.i!=null && !x.taxi).map(x=>({p:x.pos, r:x.r, x})).sort((a,b)=>b.r-a.r), used = new Set(), lineup = [];
      const take = (ok, k) => { for (let s=0; s<k; s++){ const c = pool.find(y=>!used.has(y) && ok(y.p)); if (!c) break; used.add(c); lineup.push(c.x); } };
      take(p=>p==="QB",1); take(p=>p==="RB",S.rb); take(p=>p==="WR",S.wr); take(p=>p==="TE",S.te);
      take(p=>p!=="QB",S.flex); take(()=>true,S.sf);
      t.lineup = lineup; t.now = lineup.reduce((a,x)=>a+x.r,0);
      const nP = t.players.filter(x=>x.i==null && POS.includes(x.pos)).length; t.unvalued = nP;
      t.unknown = t.players.filter(x=>!x.pos).length;
    });
    const rankBy = (f, k) => [...M.teams].sort((a,b)=>f(b)-f(a)).forEach((t,j)=>t[k] = j+1);
    rankBy(t=>t.total, "rk"); rankBy(t=>t.now, "rkNow"); POS.forEach(p=>rankBy(t=>t.pos[p], "rk"+p)); rankBy(t=>t.pickTotal, "rkPick");
    const n = M.teams.length, third = Math.max(1, Math.round(n/3));
    M.teams.forEach(t=>{ t.label = t.rkNow<=third ? "Contender" : t.rkNow>n-third ? "Rebuilder" : "Middle"; });
    return M;
  }
  // crosswalk, fetched once
  let XP = null;
  const crosswalk = root => XP || (XP = fetch((root||"") + "data/sleeper_ids.json").then(r=>{ if (!r.ok) throw new Error("player id list missing"); return r.json(); }));
  window.PASleeper = {leagues, fetchLeague, settings, build, price, pickValue, pickName, ordinal, crosswalk, remember, recall, forget, isLeagueId, season};
})();
