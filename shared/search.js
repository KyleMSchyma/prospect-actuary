/* Prospect Actuary: site-wide player search (the box in the site bar, the Dashboard's boxes, the Compare page).
 *
 * Searches the canonical player list (data/players.json via shared/data.js): every graded prospect and every player with a
 * trade value, one entry per person with a permanent id. A result keeps two measurements apart on purpose:
 *   Grade = how his prospect profile ranks WITHIN his position (pre-draft: college only; post-draft: adds draft slot and team)
 *   Value = what he is worth as a fantasy asset in YOUR league, on the 100,000-point scale (dynasty and redraft)
 * Choosing a result opens his player profile. Data loads only when someone starts typing.
 *   PASearch.attach(input, resultsBox, {root, mode:"site"|"asset"|"person", onPick(item)})
 *     site: results link to profiles · asset: players with a value + 2027 picks (trade launcher) · person: returns the player
 */
(function(){
  if (window.PASearch) return;
  const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const fmt = x => (Math.round(x/100)*100).toLocaleString("en-US");
  const chipCls = g => !g ? "" : g[0]==="A"?"gA":g[0]==="B"?"gB":g[0]==="C"?"gC":"gD";
  const chip = g => g ? `<span class="chip ${chipCls(g)}">${esc(g)}</span>` : "";
  const posb = p => `<span class="posb" style="color:var(--${p})">${p==="PICK"?"PICK":p}</span>`;
  const loadScript = src => new Promise((ok, bad)=>{ const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[.'’\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
  let READY = null;
  function load(root){
    if (!READY) READY = (window.PAData ? Promise.resolve() : loadScript(root+"shared/data.js")).then(()=>window.PAData.load(root));
    return READY;
  }
  function match(DB, q){
    const t = norm(q); if (!t) return [];
    const words = t.split(" ");
    return DB.players.map(p=>{
      if (!words.every(w=>p.w.some(x=>x.startsWith(w)) || (p.college && norm(p.college).includes(w)) || (p.team && p.team.toLowerCase()===w))) return null;
      const exact = p.k===t ? 3 : p.k.startsWith(t) ? 2 : p.w.some(x=>x.startsWith(words[0])) ? 1 : 0;
      return {p, s: exact*1e7 + (p.keys.tv ? 5e6 : 0) + (p.proj ? 4e6 : 0) + (p.cls||2000)*100};
    }).filter(Boolean).sort((a,b)=>b.s-a.s).slice(0, 8).map(x=>x.p);
  }
  function card(DB, p, S, root, mode, j){
    const lg = window.PALeague.param(S), amp = lg ? "&"+lg : "", R = DB.rows(p);
    const bits = [];
    if (p.team) bits.push(p.team); if (p.college) bits.push(p.college); if (p.cls) bits.push(p.proj ? `${p.cls} class (projected)` : `${p.cls} class`);
    if (p.pk) bits.push(`pick ${p.pk}`); else if (p.cls && !p.proj) bits.push("undrafted");
    const tvp = R.tv!=null ? DB.D.players[R.tv] : null; if (tvp && tvp.a!=null) bits.push(`age ${Number(tvp.a).toFixed(1)}`);
    const rows = [], grades = [];
    if (R.pre && R.pre.grade) grades.push(`Pre-draft ${chip(R.pre.grade)}`);
    if (R.post && R.post.post_grade) grades.push(`Post-draft ${chip(R.post.post_grade)}`);
    if (R.mock) grades.push(`2027 mock: pick ${R.mock.pick} ${esc(R.mock.team_abbr||"")} ${chip(R.mock.post_grade)}`);
    if (grades.length) rows.push(["Grade", grades.join(" &nbsp; ") + ` <span class="muted">within ${p.pos}</span>`]);
    const V = DB.values(p, S);
    if (V && V.kind==="nfl"){ const one = (lab, v, rk) => v < 50 ? `${lab} <span class="muted">below replacement</span>` : `${lab} <b class="num">${fmt(v)}</b>${rk?` <span class="muted">${rk}</span>`:""}`;
      rows.push(["Value", one("Dynasty", V.d, V.rd) + " &nbsp; " + one("Redraft", V.r, V.rr)]); }
    else if (V && V.kind==="prospect") rows.push(["Value", `Projected <b class="num">${fmt(V.d)}</b>${V.slot?` <span class="muted">≈ pick ${V.slot}</span>`:""}`]);
    else if (p.proj) rows.push(["Value", `<span class="muted">Priced through the 2027 rookie picks until he is drafted</span>`]);
    else if (p.cls && p.cls >= 2016) rows.push(["Value", `<span class="muted">Not in the trade values (retired, unsigned, or not valued yet)</span>`]);
    const href = window.PAData.url(root, p.id) + amp;
    const acts = [`<a href="${href}">Profile</a>`, `<a href="${root}compare/?ids=${encodeURIComponent(p.id)}${amp}">Compare</a>`];
    if (R.tv!=null) acts.push(`<a href="${root}trade-calculator/?mode=dynasty&get=${encodeURIComponent(p.keys.tv)}${amp}">+ Add to trade</a>`);
    return `<div class="pa-res" role="option" id="${mode}O${j}" data-j="${j}" data-href="${esc(href)}" aria-selected="${j===0}">` +
      `<div class="top"><span class="nm">${esc(p.name)}</span>${posb(p.pos)}<span class="meta">${esc(bits.join(" · "))}</span></div>` +
      (rows.length ? `<div class="rows">${rows.map(([k,v])=>`<span class="k">${k}</span><span class="v">${v}</span>`).join("")}</div>` : "") +
      (mode==="site" ? `<div class="acts">${acts.join("")}</div>` : "") + `</div>`;
  }
  // asset mode (Dashboard trade launcher): players with a value and 2027 picks, one line each
  function assetRows(DB, q){
    if (!DB.E) return [];
    const C = DB.E.compute(window.PALeague.load()), t = norm(q), words = t.split(" ");
    const out = DB.D.players.map((pl,i)=>({id:pl.n+"|"+pl.p, n:pl.n, p:pl.p, tm:pl.tm, v:C.d[i], k:norm(pl.n)}));
    C.picks.forEach(pk=>out.push({id:"pick-"+pk.slot, n:pk.n, p:"PICK", tm:"", v:pk.v, k:norm(pk.n+" pick rookie "+pk.slot)}));
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
        items = match(DB, q); const S = window.PALeague.load();
        box.innerHTML = items.length ? items.map((p,j)=>card(DB, p, S, root, mode, j)).join("") + (mode==="site" ? `<div class="hint">Grade = rank within position. Value = worth in your league (${esc(window.PALeague.short(S))}), 100,000-point scale.</div>` : "")
          : `<div class="none">No player or prospect matches “${esc(q)}”.</div>`;
      }
      sel = 0; box.hidden = false; input.setAttribute("aria-expanded","true"); mark();
    }
    function mark(){ box.querySelectorAll("[data-j]").forEach(el=>el.setAttribute("aria-selected", +el.dataset.j===sel));
      const el = box.querySelector(`[data-j="${sel}"]`); if (el) { input.setAttribute("aria-activedescendant", el.id); el.scrollIntoView({block:"nearest"}); } }
    function go(j){
      const it = items[j]; if (!it) return;
      if (mode==="asset" || mode==="person") { input.value = ""; close(); if (opt.onPick) opt.onPick(it); return; }
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
  // parseCSV kept for pages that read the CSVs directly (Dashboard)
  const parseCSV = t => { if (window.PAData) return window.PAData.parseCSV(t);
    const lines = t.trim().split(/\r?\n/), split = l => { const o = []; let c = "", q = false; for (let i=0;i<l.length;i++){ const ch = l[i];
      if (q){ if (ch==='"'){ if (l[i+1]==='"'){ c+='"'; i++; } else q=false; } else c+=ch; } else if (ch==='"') q=true; else if (ch===','){ o.push(c); c=""; } else c+=ch; } o.push(c); return o; };
    const h = split(lines[0]); return lines.slice(1).map(l=>{ const r = split(l), o = {}; h.forEach((k,i)=>o[k]=r[i]===""||r[i]==="NA"?null:r[i]); return o; }); };
  window.PASearch = {attach, load, norm, parseCSV};
})();
