/* Prospect Actuary: the site menu, written once for every page.
 *
 * Each page keeps a plain <nav class="pa-brand" data-root="../"> with simple links (works without JavaScript) and loads
 * this file right after it. This removes that nav and puts the site bar at the top of the page:
 *   Prospect Actuary | Dashboard · Prospect Lab · Player Values · Trade Center · Research | [search] [league badge]
 *   and under it the pages of the current section. On a phone the sections fold into a menu button.
 * The badge shows the league saved in this browser ("pa-tv-league"), the setting Player Values, the Trade Calculator,
 * the grade boards' Value column, the Dashboard and search all use. Pages call window.PANav.update() after it changes.
 * To add a page: add it to SECTIONS. Paths are folder names, so the weekly refresh is not affected.
 */
(function(){
  const old = document.querySelector("nav.pa-brand"); if (!old) return;
  const root = old.dataset.root != null ? old.dataset.root : "../";
  // [section id, label, landing page, [[path, label], ...]]; a path may carry ?query or #hash
  const SECTIONS = [
    ["dash",     "Dashboard",     "",                  []],
    ["lab",      "Prospect Lab",  "pre-draft/",        [["pre-draft/","Pre-draft board"],["post-draft/","Post-draft board"],["pre-draft/#class-2027","2027 class"],["post-draft/#mock-2027","2027 mock draft"],["pre-draft/#does-it-work","Hit rates"]]],
    ["values",   "Player Values", "trade-values/",     [["trade-values/?mode=dynasty","Dynasty"],["trade-values/?mode=redraft","Redraft"],["trade-values/?mode=dynasty&pos=PICK","Rookie picks"],["trade-values/?open=league","League settings"]]],
    ["trade",    "Trade Center",  "trade-calculator/", [["trade-calculator/","Trade calculator"],["value-research/","Market check"],["buy-sell/","Buy / Sell"]]],
    ["research", "Research",      "research/",         [["research/","Overview"],["guide/","Methodology guide"],["track-record/","Track record"],["research/#data-status","Data status"],["about/","About"]]]];
  const FOLDER = {"":"dash","pre-draft":"lab","post-draft":"lab","trade-values":"values","trade-calculator":"trade","value-research":"trade","buy-sell":"trade",
                  "research":"research","guide":"research","track-record":"research","about":"research"};
  const here = (location.pathname.match(/([^\/]+)\/(index\.html)?$/) || [])[1] || "";
  const sec = FOLDER[here] != null ? FOLDER[here] : (root==="" ? "dash" : "");
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
  const badge = LEAGUE_PAGE
    ? `<button type="button" class="lg lg-wide" id="paLg" aria-controls="lgWrap" title="Change league settings">League: <b></b> <span>Change</span></button>`
    : `<a class="lg lg-wide" id="paLg" href="${root}trade-values/?open=league" title="League used for every value on the site">League: <b></b> <span>Change</span></a>`;
  const top = document.createElement("header");
  top.className = "pa-top"; top.setAttribute("role", "banner");
  top.innerHTML =
    `<nav class="bar" aria-label="Site">` +
      `<a class="brand" href="${root || "./"}">${logo}<span>Prospect Actuary</span></a>` +
      `<div class="main">${SECTIONS.map(([id,l,p])=>`<a href="${root}${p}"${id===sec?' aria-current="true"':""}>${l}</a>`).join("")}</div>` +
      `<div class="right">` +
        `<div class="pa-search" id="paSearch"><span class="ico">${searchIco}</span><input type="search" id="paQ" placeholder="Search players" aria-label="Search players and prospects" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="paRes" aria-autocomplete="list"><kbd>/</kbd><div class="pa-results" id="paRes" role="listbox" hidden></div></div>` +
        badge +
        `<button type="button" class="iconbtn" id="paSearchBtn" aria-label="Search players">${searchIco}</button>` +
        `<button type="button" class="iconbtn" id="paMenuBtn" aria-label="Menu" aria-expanded="false" aria-controls="paDrawer"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>` +
      `</div>` +
    `</nav>` +
    (S && S[3].length ? `<div class="pa-sub"><div class="in"><span class="sec">${S[1]}</span>${S[3].map(([p,l])=>`<a href="${root}${p}"${p===cur?' aria-current="page"':""}>${l}</a>`).join("")}</div></div>` : "") +
    `<div class="pa-drawer" id="paDrawer">${SECTIONS.map(([id,l,p,ps])=>`<div class="grp"><a class="gh" href="${root}${p}"${id===sec?' aria-current="true"':""}>${l}</a>${ps.map(([q,t])=>`<a href="${root}${q}"${id===sec&&q===cur?' aria-current="page"':""}>${t}</a>`).join("")}</div>`).join("")}` +
      `<a class="lg" href="${root}trade-values/?open=league">League: <b id="paLg2"></b> <span>Change</span></a></div>`;
  old.remove();
  document.body.insertBefore(top, document.body.firstChild);

  // ---------- league badge ----------
  function leagueShort(){
    if (window.PALeague) return window.PALeague.short(window.PALeague.load());
    let s = null; try { s = qs.get("league") || localStorage.getItem("pa-tv-league"); } catch(e){}
    let a = String(s || "").split("_").map(Number); if (a.length < 9 || a.some(isNaN)) a = [12,1,0,4,1,2,3,1,0];
    const [teams, ppr, tep, , sf] = a, fd = a.slice(9).some(x=>x>0);
    return `${teams}-team · ${sf ? "superflex" : "1QB"} · ${ppr===1 ? "PPR" : "0.5 PPR"}${tep ? " · TE+" + tep : ""}${fd ? " · 1D bonus" : ""}`;
  }
  function update(){ const t = leagueShort(); const b = document.querySelector("#paLg b"); if (b) b.textContent = t; const b2 = document.getElementById("paLg2"); if (b2) b2.textContent = t; }
  function openLeague(scroll){
    const d = document.getElementById("lgWrap"); if (!d) return;
    d.open = true; if (scroll) d.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
  }
  if (LEAGUE_PAGE) document.getElementById("paLg").addEventListener("click", () => openLeague(true));
  update();

  // ---------- phone menu and search toggle ----------
  const menuBtn = document.getElementById("paMenuBtn"), drawer = document.getElementById("paDrawer");
  menuBtn.addEventListener("click", ()=>{ const o = drawer.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", o); top.classList.remove("searching"); });
  document.getElementById("paSearchBtn").addEventListener("click", ()=>{ top.classList.add("searching"); drawer.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false); document.getElementById("paQ").focus(); });
  document.getElementById("paQ").addEventListener("blur", ()=>setTimeout(()=>{ if (document.activeElement !== document.getElementById("paQ")) top.classList.remove("searching"); }, 200));
  // "/" jumps to search
  document.addEventListener("keydown", e=>{ if (e.key==="/" && !/input|textarea|select/i.test((document.activeElement||{}).tagName||"")) { e.preventDefault();
    if (getComputedStyle(document.getElementById("paSearch")).display==="none") top.classList.add("searching"); document.getElementById("paQ").focus(); } });

  // ---------- site search: shared/search.js, loaded now (it fetches its data only when someone types) ----------
  window.PA_ROOT = root;
  function attach(){ if (window.PASearch) window.PASearch.attach(document.getElementById("paQ"), document.getElementById("paRes"), {root}); }
  if (window.PASearch) attach();
  else { const s = document.createElement("script"); s.src = root + "shared/search.js"; s.onload = attach; document.head.appendChild(s); }
  window.PANav = { update, openLeague, root };
})();
