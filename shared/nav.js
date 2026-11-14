/* Prospect Actuary: the site menu, written once for every page.
 *
 * Each page keeps a plain <nav class="pa-brand" data-root="../"> with simple links (works without JavaScript) and
 * loads this file right after it. This replaces that nav with the grouped menu:
 *   Prospect Actuary | Rookies: Pre-draft · Post-draft | Trade: Values · Calculator · Market check | Guide | [league badge]
 * The badge shows the league saved in this browser ("pa-tv-league", the same setting Trade Values, the Trade Calculator
 * and the grade boards' Value column use). On the two trade pages it opens their league panel (#lgWrap); elsewhere it
 * goes to Trade Values with that panel open. Pages call window.PANav.update() after the league changes.
 * To add a page: add it to GROUPS below. Paths are folder names, so the weekly refresh is not affected.
 */
(function(){
  const nav = document.querySelector("nav.pa-brand"); if (!nav) return;
  const root = nav.dataset.root != null ? nav.dataset.root : "../";
  const GROUPS = [
    ["Rookies", [["pre-draft","Pre-draft grades"],["post-draft","Post-draft grades"],["buy-sell","Buy / Sell"]]],
    ["Trade",   [["trade-values","Trade values"],["trade-calculator","Trade calculator"],["value-research","Market check"]]],
    ["",        [["track-record","Track record"],["guide","Guide"],["about","About"]]]];
  const here = (location.pathname.match(/([^\/]+)\/(index\.html)?$/) || [])[1] || "";
  const LEAGUE_PAGE = here === "trade-values" || here === "trade-calculator";

  const css = `
nav.pa-nav{display:flex;flex-direction:column;gap:10px;font-family:var(--f-mono);font-size:.76rem;letter-spacing:.06em;text-transform:uppercase;padding-bottom:12px;border-bottom:1px solid var(--line)}
nav.pa-nav .top{display:flex;align-items:center;justify-content:space-between;gap:8px 16px;flex-wrap:wrap}
nav.pa-nav .links{display:flex;align-items:baseline;gap:6px 26px;flex-wrap:wrap}
nav.pa-nav a{text-decoration:none;color:var(--accent)}
nav.pa-nav a:hover{text-decoration:underline}
nav.pa-nav .home{color:var(--ink);font-weight:600}
nav.pa-nav .grp{display:flex;align-items:baseline;gap:4px 12px;flex-wrap:wrap}
nav.pa-nav .gl{color:var(--muted);font-size:.68rem}
nav.pa-nav a[aria-current="page"]{color:var(--ink);font-weight:600;text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:4px;text-decoration-thickness:2px}
nav.pa-nav .lg{font:inherit;font-size:.72rem;text-transform:none;letter-spacing:.02em;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:3px 10px;cursor:pointer;display:inline-flex;gap:6px;align-items:baseline;text-decoration:none}
nav.pa-nav .lg:hover{border-color:var(--accent);text-decoration:none}
nav.pa-nav .lg span{color:var(--accent)}
nav.pa-nav .lg:focus-visible,nav.pa-nav a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- league summary (same string format as Trade Values: teams_ppr_tep_ptd_sf_rb_wr_te_flex_fdQB_fdRB_fdWR_fdTE) ----------
  function league(){
    let s = null;
    try { s = new URLSearchParams(location.search).get("league"); } catch(e){}
    if (!s) try { s = localStorage.getItem("pa-tv-league"); } catch(e){}
    let a = String(s || "").split("_").map(Number);
    if (a.length < 9 || a.some(isNaN)) a = [12,1,0,4,1,2,3,1,0];
    const [teams, ppr, tep, , sf] = a, fd = a.slice(9).some(x=>x>0);
    return `${teams}-team · ${sf ? "superflex" : "1QB"} · ${ppr===1 ? "PPR" : "0.5 PPR"}${tep ? " · TE+" + tep : ""}${fd ? " · 1D bonus" : ""}`;
  }
  const link = ([p, l]) => `<a href="${root}${p}/"${p===here ? ' aria-current="page"' : ""}>${l}</a>`;
  const badge = LEAGUE_PAGE
    ? `<button type="button" class="lg" id="paLg" aria-controls="lgWrap" title="Change league settings">League: <b></b><span>Change</span></button>`
    : `<a class="lg" id="paLg" href="${root}trade-values/?open=league" title="League used for every trade value and the grade boards' Value column">League: <b></b><span>Change</span></a>`;
  const out = document.createElement("nav");
  out.className = "pa-nav pa-brand"; out.setAttribute("aria-label", "Site");
  out.innerHTML = `<div class="top"><a class="home" href="${root || "./"}">Prospect Actuary</a>${badge}</div><div class="links">` +
    GROUPS.map(([g, ps]) => `<span class="grp">${g ? `<span class="gl">${g}</span>` : ""}${ps.map(link).join("")}</span>`).join("") + `</div>`;
  nav.replaceWith(out);

  function update(){ const b = document.querySelector("#paLg b"); if (b) b.textContent = league(); }
  function openLeague(scroll){
    const d = document.getElementById("lgWrap"); if (!d) return;
    d.open = true; if (scroll) d.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
  }
  if (LEAGUE_PAGE) document.getElementById("paLg").addEventListener("click", () => openLeague(true));
  update();
  window.PANav = { update, openLeague };
})();
