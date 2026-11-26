/* Prospect Actuary: the site menu, written once for every page.
 *
 * Each page keeps a plain <nav class="pa-brand" data-root="../"> with simple links (works without JavaScript) and loads
 * this file right after it. This removes that nav and puts the site bar at the top of the page:
 *   Prospect Actuary (home) | Values · Usage · Prospects · Tools · Research | [Search] [league badge]
 *   and under it the pages of the current section. On a phone the sections fold into a menu button, and shared/mobile.js
 *   (loaded at the end) adds the bottom bar and the phone layouts.
 * The badge shows the league saved in this browser ("pa-tv-league"), the setting Values, the Trade Calculator,
 * the grade boards' Value column, the Dashboard and search all use. Pages call window.PANav.update() after it changes.
 * To add a page: add it to SECTIONS. Paths are folder names, so the weekly refresh is not affected.
 */
/* Visitor counts (GoatCounter: free, no cookies, no personal data; dashboard at https://kylemschyma.goatcounter.com).
 * Added here because every page, including the weekly-refresh pages, loads nav.js, so the refresh never drops it.
 * Counts only on the live site, not local copies. Open any page with #no-count to stop counting your own visits
 * in this browser (#count turns it back on). */
(function(){
  try {
    if (location.hash === "#no-count") localStorage.setItem("skipgc", "t");
    if (location.hash === "#count") localStorage.removeItem("skipgc");
  } catch(e){}
  if (location.hostname !== "kylemschyma.github.io") return;
  const s = document.createElement("script");
  s.async = true; s.src = "https://gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", "https://kylemschyma.goatcounter.com/count");
  document.head.appendChild(s);
})();
(function(){
  const old = document.querySelector("nav.pa-brand"); if (!old) return;
  const root = old.dataset.root != null ? old.dataset.root : "../";
  // [section id, label, landing page, [[path, label], ...]]; a path may carry ?query or #hash
  // Redesign Phase 1 (2026-11-24): three core products first (Values, Usage, Prospects), then Tools and Research.
  // The logo is the way home. Folder names (URLs) are unchanged, so the weekly refresh is not affected.
  const SECTIONS = [
    ["values",   "Values",    "trade-values/",     [["trade-values/?mode=dynasty","Dynasty"],["trade-values/?mode=redraft","Redraft"],["trade-values/?mode=dynasty&pos=PICK","Rookie-pick values"],["value-history/","Value history"],["compare/","Player comparison"],["trade-values/?open=league","League settings"]]],
    ["usage",    "Usage",     "buy-sell/",         [["buy-sell/","Breakout Watch"],["team-analytics/","Team usage and offense"]]],
    ["lab",      "Prospects", "pre-draft/",        [["pre-draft/","Pre-draft grades"],["post-draft/","Post-draft grades"],["pre-draft/#class-2027","2027 class"],["post-draft/#mock-2027","2027 mock draft"],["rookie-rankings/","2027 top 24 rookies"],["pick-pockets/","2027 pick pockets"],["compare/?for=prospects","Prospect comparison"],["pre-draft/#does-it-work","Model validation"]]],
    ["trade",    "Tools",     "trade-calculator/", [["trade-calculator/","Trade calculator"],["value-research/","Market check"],["moves/","Contending and rebuild moves"],["league/","Sleeper league"],["compare/","Player comparison"]]],
    ["research", "Research",  "research/",         [["research/","Overview"],["guide/","How the models work"],["track-record/","Track record"],["value-history/#track-record","Value track record"],["research/#data-status","Data and limitations"],["research/#methodology","Methodology"],["about/","About"]]]];
  const FOLDER = {"":"","pre-draft":"lab","post-draft":"lab","pick-pockets":"lab","rookie-rankings":"lab","trade-values":"values","trade-calculator":"trade","value-research":"trade","buy-sell":"usage","league":"trade","moves":"trade",
                  "research":"research","team-analytics":"usage","guide":"research","track-record":"research","about":"research","compare":"values","value-history":"values","player":""};
  const here = (location.pathname.match(/([^\/]+)\/(index\.html)?$/) || [])[1] || "";
  const sec = here==="compare" && /[?&]for=prospects/.test(location.search) ? "lab" : FOLDER[here] != null ? FOLDER[here] : "";
  const LEAGUE_PAGE = here === "trade-values" || here === "trade-calculator";
  const qs = (() => { try { return new URLSearchParams(location.search); } catch(e){ return new URLSearchParams(); } })();
  // the sub-link for this exact view: same folder, and every ?key=value / #hash it names is what is on screen; most specific wins
  const storedMode = () => { try { return localStorage.getItem("pa-tc-mode")==="r" ? "redraft" : "dynasty"; } catch(e){ return "dynasty"; } };
  function score(path){
    const m = path.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/), f = m[1].replace(/\/$/, "");
    if (f !== here) return -1;
    let n = 0;
    if (m[3]) { if (location.hash !== m[3]) return -1; n++; }
    if (m[2]) for (const [k,v] of new URLSearchParams(m[2].slice(1))) {
      const have = qs.get(k) || (k==="mode" ? storedMode() : null);
      if (have !== v) return -1; n++; }
    return n;
  }
  function currentSub(pages){ let best = null, bs = -1; pages.forEach(([p])=>{ const s = score(p); if (s > bs){ bs = s; best = p; } }); return best; }
  const logo = `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="var(--accent)" stroke-width="1.6"/><path d="M5 15.5 9 11l3 2.5 5-6" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const searchIco = `<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m11 11 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const S = SECTIONS.find(s=>s[0]===sec);
  const cur = S ? currentSub(S[3]) : null;
  // A page measured in one fixed league (Market Check) says so in the badge instead of showing the visitor's league.
  const FIXED = old.dataset.fixedLeague || "";
  const badge = FIXED
    ? `<span class="lg lg-wide lg-fixed" id="paLg" title="This page always uses this league, whatever your saved settings are">This page: <b>${FIXED}</b> <span>fixed</span></span>`
    : LEAGUE_PAGE
    ? `<button type="button" class="lg lg-wide" id="paLg" aria-controls="lgWrap" title="Change league settings">League: <b></b> <span>Change</span></button>`
    : `<button type="button" class="lg lg-wide" id="paLg" aria-expanded="false" aria-controls="paLgPop" title="League used for every value on the site">League: <b></b> <span>Change</span></button>`;
  const top = document.createElement("header");
  top.className = "pa-top"; top.setAttribute("role", "banner");
  top.innerHTML =
    `<nav class="bar" aria-label="Site">` +
      `<a class="brand" href="${root || "./"}" aria-label="Prospect Actuary home">${logo}<span>Prospect Actuary</span></a>` +
      `<div class="main">${SECTIONS.map(([id,l,p])=>`<a href="${root}${p}"${id===sec?' aria-current="true"':""}>${l}</a>`).join("")}</div>` +
      `<div class="right">` +
        `<div class="pa-search" id="paSearch"><span class="ico">${searchIco}</span><input type="search" id="paQ" placeholder="Search players, prospects, or rookie picks…" aria-label="Search players, prospects, or rookie picks" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="paRes" aria-autocomplete="list"><div class="pa-results" id="paRes" role="listbox" hidden></div></div>` +
        `<button type="button" class="srchbtn" id="paSearchBtn" aria-label="Search players, prospects, or rookie picks" title="Search (press /)">${searchIco}<span>Search</span><kbd>/</kbd></button>` +
        badge +
        `<button type="button" class="iconbtn" id="paMenuBtn" aria-label="Menu" aria-expanded="false" aria-controls="paDrawer"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>` +
      `</div>` +
    `</nav>` +
    (S && S[3].length ? `<div class="pa-sub"><div class="in"><span class="sec">${S[1]}</span>${S[3].map(([p,l])=>`<a href="${root}${p}"${p===cur?' aria-current="page"':""}>${l}</a>`).join("")}</div></div>` : "") +
    `<div class="pa-drawer" id="paDrawer">${SECTIONS.map(([id,l,p,ps])=>`<div class="grp"><a class="gh" href="${root}${p}"${id===sec?' aria-current="true"':""}>${l}</a>${ps.map(([q,t])=>`<a href="${root}${q}"${id===sec&&q===cur?' aria-current="page"':""}>${t}</a>`).join("")}</div>`).join("")}` +
      `<button type="button" class="lg" id="paLgM">${FIXED ? "Your league (other pages)" : "League"}: <b id="paLg2"></b> <span>Change</span></button></div>` +
    `<div class="pa-lgpop" id="paLgPop" role="dialog" aria-label="League settings" hidden></div>`;
  old.remove();
  document.body.insertBefore(top, document.body.firstChild);

  const menuBtn = document.getElementById("paMenuBtn"), drawer = document.getElementById("paDrawer");
  // ---------- league badge ----------
  function leagueShort(){
    if (window.PALeague) return window.PALeague.short(window.PALeague.load());
    let s = null; try { s = qs.get("league") || localStorage.getItem("pa-tv-league"); } catch(e){}
    let a = String(s || "").split("_").map(Number); if (a.length < 9 || a.some(isNaN)) a = [12,1,0,4,1,2,3,1,0];
    const [teams, ppr, tep, , sf] = a, fd = a.slice(9).some(x=>x>0);
    return `${teams}-team · ${sf ? "superflex" : "1QB"} · ${ppr===1 ? "PPR" : "0.5 PPR"}${tep ? " · TE+" + tep : ""}${fd ? " · 1D bonus" : ""}`;
  }
  function update(){ const t = leagueShort(); if (FIXED) { const b2 = document.getElementById("paLg2"); if (b2) b2.textContent = t; return; } const b = document.querySelector("#paLg b"); if (b) b.textContent = t; const b2 = document.getElementById("paLg2"); if (b2) b2.textContent = t; }
  function openLeague(scroll){
    const d = document.getElementById("lgWrap"); if (!d) return;
    d.open = true; if (scroll) d.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
  }
  // League badge: on Player Values and the calculator it opens the page's own settings panel; everywhere else a compact
  // panel opens in place. Changes are staged, then Apply saves them (this browser + the address) and reloads the page,
  // so every value on it is recomputed by the same engine for the new league.
  const pop = document.getElementById("paLgPop");
  const needLeague = () => window.PALeague ? Promise.resolve() : new Promise(ok=>{ const s = document.createElement("script"); s.src = root + "shared/league.js"; s.onload = ok; document.head.appendChild(s); });
  function closePop(){ pop.hidden = true; document.getElementById("paLg").setAttribute("aria-expanded", "false"); }
  async function openPop(){
    await needLeague(); const L = window.PALeague; let st = L.load(), mode = L.loadMode();
    drawer.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false);
    pop.innerHTML = `<div class="hd"><b>League settings</b><span class="muted small">Used by every value on the site: Actuarial Trade Values, the Trade Calculator, the home page, the prospect boards' Value column and player profiles. Saved in this browser only.</span></div>
      <div class="cur small" id="paLgCur"></div>
      <div class="setting"><span class="lbl">Valuation mode</span><div class="tabs seg" id="paMode"><button type="button" data-m="d">Dynasty</button><button type="button" data-m="r">Redraft</button></div></div>
      <div class="pa-lgset" id="paLgSet"></div>
      <div class="ft"><button type="button" class="btn primary" id="paLgApply">Apply</button><button type="button" class="btn" id="paLgCancel">Cancel</button><span class="small muted" id="paLgNote"></span></div>`;
    const cur = () => { document.getElementById("paLgCur").innerHTML = `${L.long(st)} <span class="muted">Mode: ${mode==="d"?"dynasty":"redraft"}.</span>`;
      pop.querySelectorAll("#paMode button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.m===mode));
      const same = L.serialize(st)===L.serialize(L.load()) && mode===L.loadMode(); document.getElementById("paLgNote").textContent = same ? "No changes yet" : "Apply to update the values on this page"; };
    const panel = L.panel(document.getElementById("paLgSet"), ()=>st, (k,v)=>{ st[k] = v; panel.mark(); cur(); }, S2=>{ st = S2; panel.mark(); cur(); });
    pop.querySelector("#paMode").addEventListener("click", e=>{ const b = e.target.closest("button[data-m]"); if (b){ mode = b.dataset.m; cur(); } });
    document.getElementById("paLgCancel").addEventListener("click", closePop);
    document.getElementById("paLgApply").addEventListener("click", ()=>{ L.save(st, {url:true}); const hadMode = qs.has("mode"); L.saveMode(mode, {url:hadMode}); location.reload(); });
    cur(); pop.hidden = false; document.getElementById("paLg").setAttribute("aria-expanded", "true");
    const first = pop.querySelector("button[aria-pressed=true]"); if (first) first.focus();
  }
  const lgClick = () => LEAGUE_PAGE ? (drawer.classList.remove("open"), openLeague(true)) : (pop.hidden ? openPop() : closePop());
  if (!FIXED) document.getElementById("paLg").addEventListener("click", lgClick);
  document.getElementById("paLgM").addEventListener("click", lgClick);
  document.addEventListener("keydown", e=>{ if (e.key==="Escape" && !pop.hidden) closePop(); });
  document.addEventListener("mousedown", e=>{ if (!pop.hidden && !pop.contains(e.target) && !e.target.closest("#paLg,#paLgM")) closePop(); });
  update();

  // ---------- phone menu and search toggle ----------
  menuBtn.addEventListener("click", ()=>{ const o = drawer.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", o); top.classList.remove("searching"); });
  // One search: the menu shows a search button on every page. On the Dashboard it goes to the big search box there;
  // elsewhere it opens the same search in the menu bar. "/" does the same.
  function openSearch(){ drawer.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false); closePop();
    const big = document.getElementById("heroQ");
    if (big) { big.scrollIntoView({block:"center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); big.focus({preventScroll:true}); return; }
    top.classList.add("searching"); document.getElementById("paQ").focus(); }
  document.getElementById("paSearchBtn").addEventListener("click", openSearch);
  document.getElementById("paQ").addEventListener("blur", ()=>setTimeout(()=>{ if (document.activeElement !== document.getElementById("paQ")) top.classList.remove("searching"); }, 200));
  // "/" jumps to search
  document.addEventListener("keydown", e=>{ if (e.key==="/" && !/input|textarea|select/i.test((document.activeElement||{}).tagName||"")) { e.preventDefault(); openSearch(); }
    if (e.key==="Escape" && top.classList.contains("searching")) top.classList.remove("searching"); });

  // ---------- site search: shared/search.js, loaded now (it fetches its data only when someone types) ----------
  window.PA_ROOT = root;
  function attach(){ if (window.PASearch) window.PASearch.attach(document.getElementById("paQ"), document.getElementById("paRes"), {root}); }
  if (window.PASearch) attach();
  else { const s = document.createElement("script"); s.src = root + "shared/search.js"; s.onload = attach; document.head.appendChild(s); }
  window.PANav = { update, openLeague, root, sec };

  // ---------- phone layout: shared/mobile.js (bottom bar, cards, sheets). It changes nothing above 760px wide. ----------
  if (!window.PAMobile) { const m = document.createElement("script"); m.src = root + "shared/mobile.js"; document.head.appendChild(m); }
})();
