/* Prospect Actuary: site-wide player search (the box in the site bar, and the Dashboard's boxes).
 *
 * Searches every graded prospect (pre-draft board, post-draft board, 2027 mock) and every player with a trade value,
 * and shows what the site knows about him in one place, kept apart on purpose:
 *   Prospect grade  = how his prospect profile ranks WITHIN his position (pre-draft: college only; post-draft: adds draft slot and team)
 *   Value           = what he is worth as a fantasy asset in YOUR league, on the 100,000-point scale (dynasty and redraft)
 * Data is loaded only when someone starts typing: trade-values/data/tv.js (+ shared/engine.js, shared/league.js) and the
 * grade CSVs the boards publish. Players are matched across the files by name + position (+ class); a name that fits
 * more than one prospect is shown separately rather than guessed. Permanent player IDs are planned for Release 2.
 *   PASearch.attach(input, resultsBox, {root, mode:"site"|"asset", onPick(asset)})
 */
(function(){
  if (window.PASearch) return;
  const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[.'’\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
  const fmt = x => (Math.round(x/100)*100).toLocaleString("en-US");
  const chipCls = g => !g ? "" : g[0]==="A"?"gA":g[0]==="B"?"gB":g[0]==="C"?"gC":"gD";
  const chip = g => g ? `<span class="chip ${chipCls(g)}">${esc(g)}</span>` : "";
  const posb = p => `<span class="posb" style="color:var(--${p})">${p==="PICK"?"PICK":p}</span>`;
  function parseCSV(t){
    const rows = []; let row = [], cur = "", q = false;
    for (let i=0; i<t.length; i++){ const c = t[i];
      if (q){ if (c==='"'){ if (t[i+1]==='"'){ cur+='"'; i++; } else q = false; } else cur += c; }
      else if (c==='"') q = true; else if (c===','){ row.push(cur); cur=""; }
      else if (c==='\n' || c==='\r'){ if (c==='\r' && t[i+1]==='\n') i++; row.push(cur); cur=""; if (row.length>1 || row[0]!=="") rows.push(row); row = []; }
      else cur += c; }
    if (cur!=="" || row.length){ row.push(cur); rows.push(row); }
    const h = rows.shift() || []; return rows.map(r=>{ const o = {}; h.forEach((k,i)=>o[k]=r[i]===""||r[i]==="NA"?null:r[i]); return o; });
  }
  const loadScript = src => new Promise((ok, bad)=>{ const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  const getText = url => fetch(url).then(r=>r.ok ? r.text() : Promise.reject(url)).catch(()=>null);

  let READY = null;
  function load(root){
    if (READY) return READY;
    READY = (async()=>{
      const need = [];
      if (!window.PALeague) need.push(loadScript(root+"shared/league.js"));
      if (!window.PAEngine) need.push(loadScript(root+"shared/engine.js"));
      if (!window.TV) need.push(loadScript(root+"trade-values/data/tv.js").catch(()=>null));
      const [pre, post, mock] = await Promise.all([getText(root+"pre-draft/data/pd_player_grades.csv"), getText(root+"post-draft/data/pd_post_player_grades.csv"),
                                                   getText(root+"post-draft/data/pd_post_2027_mock_grades.csv"), ...need]);
      // prospects: one entry per name + position + class
      const P = new Map(), key = (n,p,c) => norm(n)+"|"+p+"|"+c;
      const get = (n,p,c) => { const k = key(n,p,c); if (!P.has(k)) P.set(k, {n, p, cls:+c}); return P.get(k); };
      if (pre) parseCSV(pre).forEach(r=>{ const e = get(r.name, r.position, r.class); e.col = r.college; e.pre = r.grade; e.proj = r.status!=="drafted";
        if (r.pick) e.pk = +r.pick; if (r.round) e.rd = +r.round; e.preRank = r.pos_rank_class; });
      if (post) parseCSV(post).forEach(r=>{ const e = get(r.name, r.position, r.class); e.col = e.col || r.college; e.post = r.post_grade; if (!e.pre) e.pre = r.pre_grade;
        if (r.pick) e.pk = +r.pick; if (r.round) e.rd = +r.round; });
      if (mock) parseCSV(mock).forEach(r=>{ const e = P.get(key(r.board_name||r.name, r.position, 2027)) || get(r.name, r.position, 2027);
        e.col = e.col || r.school; e.mock = {pick:+r.pick, rd:+r.round, team:r.team_abbr, grade:r.post_grade}; e.proj = true; });
      // NFL players with trade values; attach to a prospect only when exactly one prospect has that name + position
      const byNP = new Map(); P.forEach(e=>{ const k = norm(e.n)+"|"+e.p; byNP.set(k, (byNP.get(k)||[]).concat(e)); });
      const people = [...P.values()];
      const D = window.TV;
      if (D && D.players) D.players.forEach((pl,i)=>{ const k = norm(pl.n)+"|"+pl.p, m = (byNP.get(k)||[]).filter(e=>!e.proj);
        if (m.length===1 && !m[0].tv) { m[0].tv = i; m[0].tm = pl.tm; m[0].age = pl.a; m[0].n = pl.n; }
        else people.push({n:pl.n, p:pl.p, tv:i, tm:pl.tm, age:pl.a}); });
      people.forEach(e=>{ e.k = norm(e.n); e.w = e.k.split(" "); });
      const E = D && window.PAEngine ? window.PAEngine(D, window.TVAGE) : null;
      return {people, E, D};
    })();
    return READY;
  }
  function values(DB){
    if (!DB.E || !window.PALeague) return null;
    const S = window.PALeague.load(); return {S, C: DB.E.compute(S)};
  }
  function match(DB, q){
    const t = norm(q); if (!t) return [];
    const words = t.split(" ");
    return DB.people.map(e=>{
      if (!words.every(w=>e.w.some(x=>x.startsWith(w)) || (e.col && norm(e.col).includes(w)))) return null;
      const exact = e.k===t ? 3 : e.k.startsWith(t) ? 2 : e.w.some(x=>x.startsWith(words[0])) ? 1 : 0;
      return {e, s: exact*1e7 + (e.tv!=null ? 5e6 : 0) + (e.proj ? 4e6 : 0) + (e.cls||2000)*100};
    }).filter(Boolean).sort((a,b)=>b.s-a.s).slice(0, 8).map(x=>x.e);
  }
  function card(e, V, root, mode, j){
    const lg = V ? window.PALeague.param(V.S) : "", amp = lg ? "&"+lg : "";
    const bits = [];
    if (e.tm) bits.push(e.tm); if (e.col) bits.push(e.col); if (e.cls) bits.push(e.proj ? `${e.cls} class (projected)` : `${e.cls} class`);
    if (e.pk) bits.push(`pick ${e.pk}`); else if (e.cls && !e.proj && e.pre) bits.push("undrafted");
    if (e.age!=null) bits.push(`age ${Number(e.age).toFixed(1)}`);
    const rows = [];
    const grades = [];
    if (e.pre) grades.push(`Pre-draft ${chip(e.pre)}`);
    if (e.post) grades.push(`Post-draft ${chip(e.post)}`);
    if (e.mock) grades.push(`2027 mock: pick ${e.mock.pick} ${esc(e.mock.team||"")} ${chip(e.mock.grade)}`);
    if (grades.length) rows.push(["Grade", grades.join(" &nbsp; ") + ` <span class="muted">within ${e.p}</span>`]);
    if (e.tv!=null && V){ const d = V.C.d[e.tv], r = V.C.r[e.tv], rd = V.C.rd[e.tv], rr = V.C.rr[e.tv];
      rows.push(["Value", `Dynasty <b class="num">${fmt(d)}</b>${rd?` <span class="muted">${rd}</span>`:""} &nbsp; Redraft <b class="num">${fmt(r)}</b>${rr?` <span class="muted">${rr}</span>`:""}`]); }
    else if (e.proj) rows.push(["Value", `<span class="muted">Priced through the 2027 rookie picks until he is drafted</span>`]);
    const name = encodeURIComponent(e.n);
    const acts = [];
    if (e.pre || e.post) acts.push(`<a href="${root}${e.post && !e.proj ? "post" : "pre"}-draft/?q=${name}&pos=${e.p}">Prospect Lab</a>`);
    if (e.tv!=null) acts.push(`<a href="${root}trade-values/?q=${name}${amp}">Player Values</a>`, `<a href="${root}trade-calculator/?mode=dynasty&get=${encodeURIComponent(e.n+"|"+e.p)}${amp}">+ Add to trade</a>`);
    const href = e.tv!=null ? `${root}trade-values/?q=${name}${amp}` : `${root}pre-draft/?q=${name}&pos=${e.p}`;
    return `<div class="pa-res" role="option" id="paOpt${j}" data-j="${j}" data-href="${esc(href)}" aria-selected="${j===0}">` +
      `<div class="top"><span class="nm">${esc(e.n)}</span>${posb(e.p)}<span class="meta">${esc(bits.join(" · "))}</span></div>` +
      (rows.length ? `<div class="rows">${rows.map(([k,v])=>`<span class="k">${k}</span><span class="v">${v}</span>`).join("")}</div>` : "") +
      (mode==="site" ? `<div class="acts">${acts.join("")}</div>` : "") + `</div>`;
  }
  // asset mode (Dashboard trade launcher): players with a value and 2027 picks, one line each
  function assetRows(DB, q){
    const V = values(DB); if (!V) return [];
    const t = norm(q), words = t.split(" ");
    const out = DB.D.players.map((pl,i)=>({id:pl.n+"|"+pl.p, n:pl.n, p:pl.p, tm:pl.tm, v:V.C.d[i], k:norm(pl.n)}));
    V.C.picks.forEach(pk=>out.push({id:"pick-"+pk.slot, n:pk.n, p:"PICK", tm:"", v:pk.v, k:norm(pk.n+" pick rookie "+pk.slot)}));
    return out.filter(a=>words.every(w=>a.k.includes(w))).sort((a,b)=>(b.k.startsWith(t)-a.k.startsWith(t)) || b.v-a.v).slice(0,8);
  }

  function attach(input, box, opt){
    if (!input || !box) return;
    opt = opt || {}; const root = opt.root!=null ? opt.root : (window.PA_ROOT||""); const mode = opt.mode || "site";
    let items = [], sel = 0, DB = null, seq = 0;
    const close = () => { box.hidden = true; input.setAttribute("aria-expanded","false"); input.removeAttribute("aria-activedescendant"); };
    async function open(){
      const q = input.value.trim(), my = ++seq;
      if (!q) { close(); return; }
      if (!DB) { box.innerHTML = `<div class="hint">Loading players…</div>`; box.hidden = false; DB = await load(root); if (my!==seq) return; }
      if (mode==="asset") {
        items = assetRows(DB, q);
        box.innerHTML = items.length ? items.map((a,j)=>`<div class="pa-res" role="option" id="${input.id}O${j}" data-j="${j}" aria-selected="${j===0}"><div class="top"><span class="nm">${esc(a.n)}</span>${posb(a.p)}<span class="meta">${esc(a.tm||"")}</span><span class="num" style="margin-left:auto">${fmt(a.v)}</span></div></div>`).join("")
          : `<div class="none">No player or 2027 pick matches.</div>`;
      } else {
        items = match(DB, q); const V = values(DB);
        box.innerHTML = items.length ? items.map((e,j)=>card(e, V, root, mode, j)).join("") + `<div class="hint">Grade = rank within position. Value = worth in your league (${V ? esc(window.PALeague.short(V.S)) : "default league"}), 100,000-point scale.</div>`
          : `<div class="none">No player or prospect matches “${esc(q)}”.</div>`;
      }
      sel = 0; box.hidden = false; input.setAttribute("aria-expanded","true"); mark();
    }
    function mark(){ box.querySelectorAll("[data-j]").forEach(el=>el.setAttribute("aria-selected", +el.dataset.j===sel));
      const el = box.querySelector(`[data-j="${sel}"]`); if (el) { input.setAttribute("aria-activedescendant", el.id); el.scrollIntoView({block:"nearest"}); } }
    function go(j){
      if (mode==="asset") { const a = items[j]; if (!a) return; input.value = ""; close(); if (opt.onPick) opt.onPick(a); return; }
      const el = box.querySelector(`[data-j="${j}"]`); if (el && el.dataset.href) location.href = el.dataset.href;
    }
    input.addEventListener("input", open);
    input.addEventListener("focus", ()=>{ load(root); if (input.value.trim()) open(); });
    input.addEventListener("keydown", e=>{
      if (e.key==="ArrowDown"){ e.preventDefault(); if (items.length){ sel=(sel+1)%items.length; mark(); } }
      else if (e.key==="ArrowUp"){ e.preventDefault(); if (items.length){ sel=(sel-1+items.length)%items.length; mark(); } }
      else if (e.key==="Enter"){ if (!box.hidden && items.length){ e.preventDefault(); go(sel); } }
      else if (e.key==="Escape"){ close(); input.blur(); }
    });
    box.addEventListener("mousedown", e=>{ if (e.target.closest("a")) return; const el = e.target.closest("[data-j]"); if (el){ e.preventDefault(); go(+el.dataset.j); } });
    input.addEventListener("blur", ()=>setTimeout(close, 180));
  }
  window.PASearch = {attach, load, norm, parseCSV};
})();
