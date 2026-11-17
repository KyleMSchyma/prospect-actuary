/* Prospect Actuary: the phone layout, written once for every page. nav.js loads it.
 *
 * Only presentation changes here. Every number on a phone comes from the same page code, data files and shared engine
 * as on desktop: this file re-arranges what the page already drew. At 760px wide or less it:
 *   - adds the bottom bar (Dashboard, Prospect Lab, Player Values, Trade Center, Research) with the current section in orange
 *   - folds each page's long introduction into one "About this page" line, so the tool comes first
 *   - shows wide tables as cards: the main columns on the card, every other column one tap away under "More"
 *     (a tap on the card opens the player's profile, as the name link does)
 *   - moves the prospect board's filters into a bottom sheet, and adds a sort control to Player Values
 *   - folds player profile sections, valuation first
 * Above 760px nothing here runs or shows, so desktop and tablet are unchanged. Page tables are re-drawn by their own code
 * (and by the weekly refresh's data), so the card styling is re-applied whenever a table changes.
 */
(function(){
  if (window.PAMobile) return;
  const MQ = matchMedia("(max-width:760px)");
  const root = (window.PANav && window.PANav.root != null) ? window.PANav.root : (window.PA_ROOT || "");
  const sec = (window.PANav && window.PANav.sec) || "";
  const here = (location.pathname.match(/([^\/]+)\/(index\.html)?$/) || [])[1] || "";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} } };

  // iOS: let the page reach under the home bar so env(safe-area-inset-*) has values; the bars pad themselves
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/viewport-fit/.test(vp.content)) vp.content += ",viewport-fit=cover";

  // ---------- bottom bar ----------
  const ICO = {
    dash:     '<path d="M3 10.5 11 4l8 6.5V18a1 1 0 0 1-1 1h-4.5v-5h-5v5H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    lab:      '<path d="M8 3h6M9 3v5.5L4.5 17a1.4 1.4 0 0 0 1.2 2h10.6a1.4 1.4 0 0 0 1.2-2L13 8.5V3M6.7 13h8.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    values:   '<path d="M3 17.5 8.5 11l4 3.5L19 6.5M14.5 6.5H19V11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    trade:    '<path d="M4 8h13l-3.5-3.5M18 14H5l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    research: '<path d="M5 3.5h9.5L18 7v11.5H5zM14 3.5V7.5h4M8 11h7M8 14.5h7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>'};
  const BAR = [["dash","Dashboard",""],["lab","Prospect Lab","pre-draft/"],["values","Player Values","trade-values/"],["trade","Trade Center","trade-calculator/"],["research","Research","research/"]];
  const bnav = document.createElement("nav");
  bnav.className = "pa-bnav"; bnav.setAttribute("aria-label", "Sections");
  bnav.innerHTML = BAR.map(([id,l,p])=>`<a href="${root}${p}"${id===sec?' aria-current="page"':""}><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">${ICO[id]}</svg><span>${l}</span></a>`).join("");
  document.body.appendChild(bnav);

  // a league button in the top bar on phones (the wide league badge does not fit); it does exactly what the badge does
  const right = document.querySelector(".pa-top .right"), badge = document.getElementById("paLg");
  if (right && badge) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "m-lg m-only"; b.setAttribute("aria-label", "League settings"); b.title = "League settings";
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 5h7M14 5h1M3 13h1M8 13h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="5" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="13" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    b.addEventListener("click", ()=>badge.click());
    right.insertBefore(b, document.getElementById("paMenuBtn"));
  }
  // the league panel is a bottom sheet on phones: dim the page behind it, tap outside to close
  const scrim = document.createElement("div"); scrim.className = "m-scrim"; document.body.appendChild(scrim);
  const pop = document.getElementById("paLgPop");
  if (pop) new MutationObserver(()=>{ const on = MQ.matches && !pop.hidden; scrim.classList.toggle("on", on || !!document.querySelector(".m-sheet.on")); document.body.classList.toggle("m-locked", on || !!document.querySelector(".m-sheet.on")); })
    .observe(pop, {attributes:true, attributeFilter:["hidden"]});
  scrim.addEventListener("click", ()=>{ if (pop && !pop.hidden) { const c = document.getElementById("paLgCancel"); if (c) c.click(); else pop.hidden = true; } closeSheets(); });

  // ---------- page intro: fold the explanations under the title into one line (phones only; put back on wider screens) ----------
  const intro = [];   // [details, [[node, parent, next], ...]]
  function foldIntro(){
    if (here === "" || here === "player") return;   // the Dashboard and profiles lay out their own headers
    const h = document.querySelector(".wrap > header:not(.pa-top), body > header:not(.pa-top), main > header");
    if (!h || h.dataset.mFold) return;
    const h1 = h.querySelector("h1"); if (!h1) return;
    const keep = el => /asof|stamp|updated/i.test(el.id + " " + el.className) || el.matches(".switch,.facts,.tabs,.crumb,form,label,.row,nav") || el.querySelector("input,select,button:not(.linkbtn)");
    const nodes = [...h.children].filter(el => el !== h1 && !el.matches("nav.pa-brand,script") && !keep(el) && (el.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_PRECEDING || el.matches(".eyebrow")));
    if (nodes.length < 2) return;
    h.dataset.mFold = "1";
    const d = document.createElement("details"); d.className = "m-intro";
    const lim = nodes.some(n => n.matches(".dev"));
    d.innerHTML = `<summary>About this page${lim ? " · known limits" : ""}</summary><div class="in"></div>`;
    const saved = nodes.map(n => [n, n.parentNode, n.nextSibling]);
    let anchor = h1; while (anchor.nextElementSibling && keep(anchor.nextElementSibling)) anchor = anchor.nextElementSibling;
    anchor.after(d);
    nodes.forEach(n => d.lastElementChild.appendChild(n));
    intro.push([d, saved, h]);
  }
  // sections built around a table (Player Values sheets, prospect boards): their explanations fold the same way, under the heading
  function foldSections(){
    document.querySelectorAll(".wrap section, body > section").forEach(sc => {
      if (sc.dataset.mFold || !sc.querySelector(":scope > .tablebox")) return;
      const h2 = sc.querySelector(":scope > h2"); if (!h2) return;
      const nodes = [...sc.children].filter(el => (el.matches("p:not([id]),details.note,.eyebrow") || el.matches(".st-legend")) && !el.querySelector("input,select") && (el.matches(".eyebrow") || (el.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_PRECEDING)) && el.textContent.trim().length > 30);
      if (!nodes.length || !nodes.some(n => n.textContent.length > 120)) return;
      sc.dataset.mFold = "1";
      const d = document.createElement("details"); d.className = "m-intro";
      d.innerHTML = `<summary>How to read this</summary><div class="in"></div>`;
      const saved = nodes.map(n => [n, n.parentNode, n.nextSibling]);
      h2.after(d); nodes.forEach(n => d.lastElementChild.appendChild(n));
      intro.push([d, saved, sc]);
    });
  }
  function unfoldIntro(){
    intro.splice(0).forEach(([d, saved, h]) => { saved.slice().reverse().forEach(([n, p, nx]) => p.insertBefore(n, nx && nx.parentNode === p ? nx : null)); d.remove(); delete h.dataset.mFold; });
  }

  // ---------- cards from tables ----------
  // Column roles come from the header text, so they keep working when a page or the weekly data changes a table.
  const RANK = /^(rank|#)$/i, VAL = /^(trade value|value|total value|value now|current|(dynasty|redraft) value\b.*)$/i, GRADE = /^grade/i;
  const META = here === "team-analytics" ? /./                // team rows: every number stays on the card
    : here === "league"
    ? /^(outlook|starters now|qb|rb|wr|te|picks|needs)$/i     // team cards: positional values, picks and needs stay on the card
    : /^(pos|pos rank|team|age|college|class|drafted|stage|pick|draft pick|outlook|yrs out of hs|change|previous|p\(.*\))$/i;
  const SKIP = new Set(["fresh", "scaleTable", "vpTable", "brTable", "valTable"]);   // small reference tables: keep them as tables (they scroll inside their box)
  let movers = null;   // rank change since the last weekly snapshot, Player Values only (data/movers.csv: the 25 biggest movers each sheet)
  function eligible(t){
    if (SKIP.has(t.id) || t.closest(".m-sheet,.pa-results,.whybox,.why")) return false;
    const ths = t.tHead ? t.tHead.rows[0] && t.tHead.rows[0].cells : null;
    if (!ths || ths.length < 4) return false;
    return !!t.querySelector("tbody a.pl, tbody button.nmbtn, tbody a[data-team], tbody a[href*='player/']" + (here === "player" ? ", tbody a[href^='./?']" : ""));
  }
  function profileHref(tr){
    const a = tr.querySelector("td.m-name a.pl, td.m-name a[href*='player/'], td.m-name a[href^='./?']"); if (a) return a.getAttribute("href");
    const b = tr.querySelector("button.nmbtn"); if (b && b.dataset.id) return `${root}player/?key=${encodeURIComponent("tv:" + b.dataset.id)}`;
    return null;
  }
  function cardify(t){
    if (!MQ.matches) return;
    const ths = [...t.tHead.rows[0].cells].map(c => c.textContent.trim());
    if (!t.classList.contains("mc")) {
      t.classList.add("mc"); const box = t.closest(".tablebox"); if (box) box.classList.add("m-cb");
      // profile tables are short: every column shows on the card
      t.classList.toggle("m-all", here === "player" || store.get("pa-m-all") === "1");
    }
    const tb = t.tBodies[0]; if (!tb) return;
    // a row about two or more players (a trade move: you give / you get): no single name, so every column shows on the card
    const sample = tb.querySelector("tr:not(.why)");
    if ((sample && [...sample.cells].filter(c => c.querySelector("a.pl, a[href*='player/']")).length > 1) || (ths.some(h => /^you give/i.test(h)) && ths.some(h => /^you get/i.test(h)))) t.classList.add("m-multi");
    const nameIx = t.classList.contains("m-multi") ? -1 : (() => { const r = sample; if (!r) return -1;
      const i = [...r.cells].findIndex(c => c.querySelector("a.pl, button.nmbtn, a[data-team], a[href*='player/'], a[href^='./?']")); if (i >= 0) return i;
      return ths.findIndex(h => /^(player|team|name)$/i.test(h)); })();
    const valIx = (() => { const pri = ths.findIndex(h => /^(trade value|total value)$/i.test(h)); return pri >= 0 ? pri : ths.findIndex(h => VAL.test(h)); })();
    const rankIx = ths.findIndex(h => RANK.test(h)), gradeIx = ths.findIndex(h => GRADE.test(h));
    const isTV = t.id === "dTable" || t.id === "rTable", sheet = t.id === "dTable" ? "dynasty" : "redraft";
    [...tb.rows].forEach(tr => {
      if (tr.dataset.mc === "1" || tr.classList.contains("why")) return;
      tr.dataset.mc = "1";
      const cells = [...tr.cells];
      if (cells.length < 3) { tr.classList.add("m-none"); return; }
      cells.forEach((td, i) => {
        if (td.classList.contains("m-tog")) return;
        td.dataset.l = ths[i] || "";
        td.classList.add(i === nameIx ? "m-name" : i === valIx ? "m-val" : i === rankIx ? "m-rank" : i === gradeIx ? "m-grade" : META.test(ths[i] || "") ? "m-meta" : "m-x");
      });
      if (rankIx < 0 && nameIx > 0 && /^\d+$/.test(cells[0].textContent.trim())) { cells[0].classList.remove("m-x", "m-meta"); cells[0].classList.add("m-rank"); }
      const href = t.classList.contains("m-multi") ? null : profileHref(tr);
      const extras = cells.filter(td => td.classList.contains("m-x") && td.textContent.trim()).length;
      const tog = document.createElement("td"); tog.className = "m-tog";
      let h = "";
      if (isTV && movers) { const nm = tr.querySelector("button.nmbtn"); const m = nm && movers[sheet + "|" + nm.dataset.id];
        if (m) h += `<span class="m-mv ${m > 0 ? "up" : "down"}" title="Rank change since last week's snapshot (reference league)">${m > 0 ? "▲" : "▼"}${Math.abs(m)} wk</span> `; }
      const team = tr.querySelector("a[data-team]");
      if (team && here === "league") { const s = sleeperMe(); const rid = team.dataset.team;
        h += `<a href="#hTeam" data-mteam="${esc(rid)}">Roster</a>`;
        if (s && s.league && s.me && String(s.me) !== String(rid)) h += `<a href="${root}trade-calculator/?sleeper=${encodeURIComponent(s.league)}&me=${encodeURIComponent(s.me)}&with=${encodeURIComponent(rid)}">Trade</a>`; }
      if (extras && !t.classList.contains("m-multi") && here !== "player") h += `<button type="button" aria-expanded="false">More</button>`;
      tog.innerHTML = h;
      if (h) tr.appendChild(tog);
      if (href) { tr.classList.add("m-link"); tr.dataset.href = href; }
    });
  }
  function sleeperMe(){ try { return JSON.parse(store.get("pa-sleeper") || "null"); } catch(e){ return null; } }
  function uncardify(){
    document.querySelectorAll("table.mc").forEach(t => { t.classList.remove("mc", "m-all", "m-multi"); const b = t.closest(".tablebox"); if (b) b.classList.remove("m-cb");
      t.querySelectorAll("td.m-tog").forEach(x => x.remove()); t.querySelectorAll("tr[data-mc]").forEach(r => { r.dataset.mc = ""; r.classList.remove("m-open"); }); });
  }
  // a tap on a card opens the profile, unless it was on a link, button or form control; "More" shows the other columns
  document.addEventListener("click", e => {
    if (!MQ.matches) return;
    const more = e.target.closest("table.mc td.m-tog button");
    if (more) { const tr = more.closest("tr"); const o = tr.classList.toggle("m-open"); more.setAttribute("aria-expanded", o); more.textContent = o ? "Less" : "More"; return; }
    const mt = e.target.closest("a[data-mteam]");
    if (mt) { e.preventDefault(); const a = mt.closest("tr").querySelector("a[data-team]"); if (a) a.click(); const h = document.getElementById("hTeam"); if (h) h.scrollIntoView({block:"start"}); return; }
    const tr = e.target.closest("table.mc tr.m-link");
    if (!tr || e.target.closest("a,button,input,select,label,summary")) return;
    if (here === "league") { const a = tr.querySelector("a[data-team]"); if (a) { a.click(); const h = document.getElementById("hTeam"); if (h) h.scrollIntoView({block:"start"}); } return; }
    if (tr.dataset.href) location.href = tr.dataset.href;
  });
  // league team rows: the whole card opens the roster
  function markLeague(){ if (here !== "league") return; document.querySelectorAll("table.mc tbody tr").forEach(tr => { if (tr.querySelector("a[data-team]")) tr.classList.add("m-link"); }); }

  // a "Show all columns" switch above each card list (remembered in this browser)
  function listbar(t){
    if (t.dataset.mBar) return;
    if (here === "" || here === "player" || t.classList.contains("m-multi") || ![...t.querySelectorAll("td.m-x")].some(td => td.textContent.trim())) return;   // nothing hidden: no switch needed
    t.dataset.mBar = "1";
    const box = t.closest(".tablebox") || t;
    const bar = document.createElement("div"); bar.className = "m-listbar m-only";
    bar.innerHTML = `<span class="small muted">Tap a card for the full profile.</span><button type="button" class="linkbtn" data-mall>${t.classList.contains("m-all") ? "Hide extra columns" : "Show all columns"}</button>`;
    bar.querySelector("[data-mall]").addEventListener("click", ev => { const on = !t.classList.contains("m-all");
      document.querySelectorAll("table.mc").forEach(x => x.classList.toggle("m-all", on)); store.set("pa-m-all", on ? "1" : "0");
      document.querySelectorAll("[data-mall]").forEach(b => b.textContent = on ? "Hide extra columns" : "Show all columns"); });
    box.parentNode.insertBefore(bar, box);
    return bar;
  }

  // ---------- Player Values: sort on phones (rank is the default; other orders show every row, then sort them) ----------
  const SORTS = [["rank","Rank (value)"],["age","Youngest first"],["pos","Position rank"],["name","Name A-Z"]];
  function sortBar(t){
    if (!isTVTable(t) || t.dataset.mSort) return; t.dataset.mSort = "1";
    const bar = t.closest(".tablebox").previousElementSibling; if (!bar || !bar.classList.contains("m-listbar")) return;
    const s = document.createElement("label"); s.className = "m-sortbar";
    s.innerHTML = `Sort <select aria-label="Sort players">${SORTS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>`;
    bar.insertBefore(s, bar.firstChild); bar.querySelector(".small.muted").remove();
    const sel = s.querySelector("select"); sel.value = store.get("pa-m-sort") || "rank";
    sel.addEventListener("change", () => { store.set("pa-m-sort", sel.value); document.querySelectorAll(".m-sortbar select").forEach(x => x.value = sel.value); resort(t, true); });
  }
  const isTVTable = t => here === "trade-values" && (t.id === "dTable" || t.id === "rTable");
  let sorting = false;
  function resort(t, fromUser){
    const how = store.get("pa-m-sort") || "rank";
    if (how === "rank") { if (fromUser) { const tabs = document.getElementById(t.id[0] + "Name"); if (tabs) tabs.dispatchEvent(new Event("input")); } return; }
    const more = document.getElementById(t.id[0] + "More");
    if (more && !more.hidden) { sorting = true; let n = 0; while (!more.hidden && n++ < 40) more.click(); sorting = false; }
    const tb = t.tBodies[0]; if (!tb) return;
    cardify(t);
    const ths = [...t.tHead.rows[0].cells].map(c => c.textContent.trim());
    const ix = h => ths.findIndex(x => x.toLowerCase() === h);
    const groups = []; [...tb.rows].forEach(r => { if (r.classList.contains("why") && groups.length) groups[groups.length - 1].push(r); else groups.push([r]); });
    const num = (r, i) => { const v = parseFloat((r.cells[i] && r.cells[i].textContent || "").replace(/[^\d.]/g, "")); return isNaN(v) ? Infinity : v; };
    const key = {age: r => num(r, ix("age")), pos: r => num(r, ix("pos rank")), name: r => (r.querySelector(".nmbtn,td.m-name") || r).textContent.trim().toLowerCase()}[how];
    if (!key) return;
    groups.sort((a, b) => { const x = key(a[0]), y = key(b[0]); return x < y ? -1 : x > y ? 1 : 0; });
    const f = document.createDocumentFragment(); groups.forEach(g => g.forEach(r => f.appendChild(r))); tb.appendChild(f);
    tb.dataset.mSorted = how;   // the page replaces the tbody when it redraws, which clears this and sorts again
  }

  // ---------- filters in a bottom sheet (Prospect Lab boards) ----------
  const sheets = [];
  function closeSheets(){ document.querySelectorAll(".m-sheet.on").forEach(s => s.classList.remove("on")); scrim.classList.toggle("on", !!(pop && !pop.hidden && MQ.matches)); document.body.classList.toggle("m-locked", scrim.classList.contains("on")); }
  function sheetify(ctl, title){
    if (!ctl || ctl.dataset.mSheet) return; ctl.dataset.mSheet = "1";
    const labels = [...ctl.querySelectorAll(":scope > label")].filter(l => !l.querySelector("input[type=search]"));
    if (!labels.length) return;
    const saved = labels.map(l => [l, l.parentNode, l.nextSibling]);
    const sh = document.createElement("div"); sh.className = "m-sheet"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-label", title);
    sh.innerHTML = `<div class="hd"><b>${esc(title)}</b><button type="button" class="linkbtn" data-reset>Reset</button></div><div class="fl" style="display:flex;flex-direction:column;gap:12px"></div><div class="ft"><button type="button" class="btn primary" data-done>Show results</button></div>`;
    labels.forEach(l => sh.querySelector(".fl").appendChild(l));
    document.body.appendChild(sh);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn m-fbtn"; btn.setAttribute("aria-haspopup", "dialog");
    const count = () => { const n = labels.filter(l => { const s = l.querySelector("select"); return s && s.selectedIndex > 0 && !/fSort|fMode/.test(s.id); }).length;
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M4.5 8h7M7 12h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>Filters${n ? ` <span class="n">${n}</span>` : ""}`; };
    count(); ctl.insertBefore(btn, ctl.firstChild);
    btn.addEventListener("click", () => { sh.classList.add("on"); scrim.classList.add("on"); document.body.classList.add("m-locked"); const f = sh.querySelector("select,input"); if (f) f.focus({preventScroll:true}); });
    sh.querySelector("[data-done]").addEventListener("click", closeSheets);
    sh.querySelector("[data-reset]").addEventListener("click", () => { labels.forEach(l => { const s = l.querySelector("select"); if (s && !/fSort|fMode/.test(s.id) && s.selectedIndex) { s.selectedIndex = 0; s.dispatchEvent(new Event("change", {bubbles:true})); } }); count(); });
    sh.addEventListener("change", count);
    sheets.push([sh, btn, saved]);
  }
  function unsheet(){ sheets.splice(0).forEach(([sh, btn, saved]) => { saved.forEach(([n, p, nx]) => p.insertBefore(n, nx && nx.parentNode === p ? nx : null)); sh.remove(); btn.remove(); delete (saved[0] && saved[0][1]).dataset.mSheet; }); }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheets(); });

  // ---------- player profile: valuation first, sections fold ----------
  const ORDER = [[/dynasty valuation|projected dynasty value/i, 1, true], [/prospect evaluation/i, 2, false], [/how the draft changed/i, 2, false], [/nfl production/i, 3, false], [/historical comparables|career comparables/i, 4, false], [/market comparison/i, 6, false]];
  function profile(){
    if (here !== "player") return;
    document.body.classList.add("m-prof");
    document.querySelectorAll("#main .sec").forEach(s => {
      if (s.dataset.mSec) return; s.dataset.mSec = "1";
      const h = s.querySelector(":scope > header h2"), t = h ? h.textContent : "";
      const o = ORDER.find(([re]) => re.test(t));
      if (o) s.classList.add("m-o" + o[1]);
      const prospect = /prospect/i.test((document.querySelector("#main .ph .eyebrow") || {}).textContent || "");
      const open = o ? (o[2] || (prospect && o[1] === 2)) : false;   // a 2027 prospect: his evaluation opens too
      if (!open) s.classList.add("m-shut");
      const hd = s.querySelector(":scope > header");
      hd.setAttribute("role", "button"); hd.tabIndex = 0; hd.setAttribute("aria-expanded", open);
      const tg = () => { const shut = s.classList.toggle("m-shut"); hd.setAttribute("aria-expanded", !shut); };
      hd.addEventListener("click", e => { if (MQ.matches && !e.target.closest("a,button")) tg(); });
      hd.addEventListener("keydown", e => { if (MQ.matches && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tg(); } });
    });
  }

  // ---------- run ----------
  let raf = 0, on = false;
  function enhance(){
    raf = 0; if (!MQ.matches || sorting) return;
    document.querySelectorAll("table").forEach(t => { if (t.classList.contains("mc") || eligible(t)) { cardify(t); listbar(t); sortBar(t);
      const how = store.get("pa-m-sort") || "rank", tb = t.tBodies[0];
      if (isTVTable(t) && how !== "rank" && tb && tb.dataset.mSorted !== how) resort(t); } });
    markLeague(); profile();
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(enhance); };
  const obs = new MutationObserver(muts => { if (muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && !(n.classList && n.classList.contains("m-tog"))))) queue(); });
  function setMode(){
    const m = MQ.matches;
    if (m === on) return; on = m;
    document.body.classList.toggle("m-dash", m && here === "");
    document.body.classList.toggle("m-calc", m && here === "trade-calculator");
    document.body.classList.toggle("m-league", m && here === "league");
    // the league panel lives in the menu bar, whose blur effect would trap a fixed sheet inside the bar: on phones it moves to <body>
    const top = document.querySelector(".pa-top");
    if (pop && top) { if (m) document.body.appendChild(pop); else top.appendChild(pop); }
    if (m) {
      foldIntro(); foldSections();
      if (here === "pre-draft" || here === "post-draft") document.querySelectorAll("#board-sec .ctl").forEach(c => sheetify(c, "Filter prospects"));
      enhance(); obs.observe(document.body, {childList:true, subtree:true});
    } else {
      obs.disconnect(); unfoldIntro(); unsheet(); uncardify(); closeSheets();
      document.body.classList.remove("m-prof");
    }
  }
  if (here === "trade-values") fetch(root + "data/movers.csv").then(r => r.ok ? r.text() : "").then(txt => {
    const lines = txt.trim().split(/\r?\n/); if (lines.length < 2) return;
    const parse = l => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
    const h = parse(lines[0]), ix = k => h.indexOf(k), M = {};
    lines.slice(1).forEach(l => { const c = parse(l), rc = Number(c[ix("rank_change")]); if (rc) M[c[ix("sheet")] + "|" + c[ix("name")] + "|" + c[ix("pos")]] = rc; });
    movers = M; document.querySelectorAll("table.mc tbody tr").forEach(r => { r.dataset.mc = ""; const t = r.querySelector("td.m-tog"); if (t) t.remove(); }); queue();
  }).catch(() => {});
  const start = () => { setMode(); (MQ.addEventListener ? MQ.addEventListener("change", setMode) : MQ.addListener(setMode)); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.PAMobile = { refresh: queue, isPhone: () => MQ.matches };
})();
