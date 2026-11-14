/* Prospect Actuary: one loader for everything the connected pages read (search, player profiles, compare).
 *
 * The canonical player list is data/players.json (scripts/build_players.py): one permanent id per person, with the keys
 * that join him to each published file. Grades, values and market data are looked up through those keys, never by name:
 *   keys.pre  "name|pos|class" -> pre-draft/data/pd_player_grades.csv
 *   keys.post "name|pos|class" -> post-draft/data/pd_post_player_grades.csv
 *   keys.mock "name|pos"       -> post-draft/data/pd_post_2027_mock_grades.csv
 *   keys.tv   "name|pos"       -> trade-values/data/tv.js (values computed in the browser by shared/engine.js)
 * Everything is fetched once per page, on first use.   PAData.load(root) -> Promise<DB>
 */
(function(){
  if (window.PAData) return;
  function parseCSV(t){
    const rows = []; let row = [], cur = "", q = false;
    for (let i=0; i<t.length; i++){ const c = t[i];
      if (q){ if (c==='"'){ if (t[i+1]==='"'){ cur+='"'; i++; } else q = false; } else cur += c; }
      else if (c==='"') q = true; else if (c===','){ row.push(cur); cur=""; }
      else if (c==='\n' || c==='\r'){ if (c==='\r' && t[i+1]==='\n') i++; row.push(cur); cur=""; if (row.length>1 || row[0]!=="") rows.push(row); row = []; }
      else cur += c; }
    if (cur!=="" || row.length){ row.push(cur); rows.push(row); }
    const h = rows.shift() || [];
    return rows.map(r=>{ const o = {}; h.forEach((k,i)=>{ const v = r[i]; o[k] = (v==="" || v==="NA" || v==null) ? null : (v!=="" && !isNaN(v) && /^-?[\d.]+(e-?\d+)?$/i.test(v) ? +v : v); }); return o; });
  }
  const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[.'’\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
  const loadScript = src => new Promise((ok, bad)=>{ const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  const text = url => fetch(url).then(r=>r.ok ? r.text() : null).catch(()=>null);
  const json = url => fetch(url).then(r=>r.ok ? r.json() : null).catch(()=>null);
  let P = null;
  function load(root){
    if (P) return P;
    root = root!=null ? root : (window.PA_ROOT || "");
    P = (async()=>{
      const need = [];
      if (!window.PALeague) need.push(loadScript(root+"shared/league.js"));
      if (!window.PAEngine) need.push(loadScript(root+"shared/engine.js"));
      if (!window.TV) need.push(loadScript(root+"trade-values/data/tv.js").catch(()=>null));
      if (!window.TVAGE) need.push(loadScript(root+"trade-values/data/agetab.js").catch(()=>null));
      const [players, manifest, pre, post, mock, board] = await Promise.all([json(root+"data/players.json"), json(root+"data/manifest.json"),
        text(root+"pre-draft/data/pd_player_grades.csv"), text(root+"post-draft/data/pd_post_player_grades.csv"),
        text(root+"post-draft/data/pd_post_2027_mock_grades.csv"), text(root+"pre-draft/data/rookie_board_values.csv"), ...need]);
      const DB = {root, manifest, players: players ? players.players : [], byId: {}, pre: {}, post: {}, mock: {}, board: {}, tvIdx: {}, preRows: [], postRows: []};
      DB.players.forEach(p=>{ DB.byId[p.id] = p; p.k = norm(p.name); p.w = p.k.split(" "); });
      if (pre) DB.preRows = parseCSV(pre), DB.preRows.forEach(r=>DB.pre[`${r.name}|${r.position}|${r.class}`] = r);
      if (post) DB.postRows = parseCSV(post), DB.postRows.forEach(r=>DB.post[`${r.name}|${r.position}|${r.class}`] = r);
      if (mock) parseCSV(mock).forEach(r=>DB.mock[`${r.board_name||r.name}|${r.position}`] = r);
      // Value inputs for prospects (tier odds + age), from the same file the boards' Value column uses
      if (board) parseCSV(board).filter(r=>r.board==="pre").forEach(r=>DB.board[`${r.name}|${r.position}|${r.class}`] = r);
      DB.D = window.TV || null;
      if (DB.D) DB.D.players.forEach((pl,i)=>DB.tvIdx[pl.n+"|"+pl.p] = i);
      DB.E = DB.D && window.PAEngine ? window.PAEngine(DB.D, window.TVAGE) : null;
      // per-person accessors
      DB.rows = p => ({pre: p.keys.pre ? DB.pre[p.keys.pre] : null, post: p.keys.post ? DB.post[p.keys.post] : null,
                       mock: p.keys.mock ? DB.mock[p.keys.mock] : null, board: p.keys.pre ? DB.board[p.keys.pre] : null,
                       tv: p.keys.tv!=null && DB.tvIdx[p.keys.tv]!=null ? DB.tvIdx[p.keys.tv] : null});
      // values in a league: dynasty / redraft for NFL players; projected pick value for 2027 prospects
      DB.values = (p, S) => {
        if (!DB.E) return null; S = S || window.PALeague.load(); const C = DB.E.compute(S), r = DB.rows(p);
        if (r.tv!=null) return {kind:"nfl", d:C.d[r.tv], r:C.r[r.tv], rd:C.rd[r.tv], rr:C.rr[r.tv], C, i:r.tv,
          row: C.dynAll.find(x=>x.i===r.tv && !x.pick), rrow: C.red.find(x=>x.i===r.tv)};
        if (p.proj && r.board && r.board.p_any!=null) { const v = DB.E.prospectValue(S, p.pos, [r.board.p_top, r.board.p_top2, r.board.p_any], r.board.age);
          if (v==null) return null; const slot = C.picks.findIndex(x=>x.v <= v + 1e-6);
          return {kind:"prospect", d:v, slot: slot>=0 ? C.picks[slot].slot : null, src:r.board.source, C}; }
        return null; };
      return DB;
    })();
    return P;
  }
  const url = (root, id) => `${root}player/?id=${encodeURIComponent(id)}`;
  window.PAData = {load, parseCSV, norm, url};
})();
