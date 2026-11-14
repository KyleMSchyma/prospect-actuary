/* Prospect Actuary: league settings, written once for every page.
 *
 * One league is saved in this browser ("pa-tv-league") and in the address (?league=teams_ppr_tep_ptd_sf_rb_wr_te_flex_fdQB_fdRB_fdWR_fdTE),
 * and used by Player Values, the Trade Calculator, the grade boards' Value column, the Dashboard and search.
 * The sheet (dynasty / redraft) is shared the same way ("pa-tc-mode", ?mode=). Same storage keys and link format as before,
 * so saved settings and shared links keep working.
 *   PALeague.load()                -> league S (address first, then this browser, else the default)
 *   PALeague.save(S, {url:true})   -> remembers it (and puts it in the address)
 *   PALeague.panel(el, get, set, setAll) -> draws the settings buttons into el, with named leagues saved in this browser ("pa-leagues")
 */
(function(){
  const DEF = {teams:12, ppr:1, tep:0, ptd:4, sf:1, rb:2, wr:3, te:1, flex:0, fdQB:0, fdRB:0, fdWR:0, fdTE:0};
  const FDO = [[0,"0"],[0.25,".25"],[0.5,".5"],[0.75,".75"],[1,"1"]];
  const OPTS = [
    ["teams","Teams",[[8,"8"],[10,"10"],[12,"12"],[14,"14"]]],
    ["ppr","Points per catch",[[0.5,"0.5 PPR"],[1,"PPR"]]],
    ["tep","TE premium",[[0,"None"],[0.5,"+0.5"],[1,"+1.0"]]],
    ["ptd","Passing TD",[[4,"4 pts"],[5,"5 pts"],[6,"6 pts"]]],
    ["sf","Superflex",[[0,"Off"],[1,"On"]]],
    ["rb","Starting RB",[[2,"2"],[3,"3"]]],
    ["wr","Starting WR",[[2,"2"],[3,"3"]]],
    ["te","Starting TE",[[1,"1"],[2,"2"]]],
    ["flex","FLEX (RB/WR/TE)",[[0,"0"],[1,"1"],[2,"2"],[3,"3"]]],
    ["fdQB","1st-down bonus · QB",FDO], ["fdRB","1st-down bonus · RB",FDO], ["fdWR","1st-down bonus · WR",FDO], ["fdTE","1st-down bonus · TE",FDO]];
  const ORDER = OPTS.map(o=>o[0]), POS = ["QB","RB","WR","TE"];
  const valid = (k,v) => OPTS.find(o=>o[0]===k)[2].some(([x])=>x===v);
  const qs = () => { try { return new URLSearchParams(location.search); } catch(e){ return null; } };
  function parse(src){
    if (!src) return null;
    const a = String(src).split("_").map(Number); while (a.length < ORDER.length && a.length >= 9) a.push(0);   // links made before the first-down bonus
    if (a.length !== ORDER.length || !ORDER.every((k,i)=>valid(k,a[i]))) return null;
    const S = {}; ORDER.forEach((k,i)=>S[k]=a[i]); return S;
  }
  const serialize = S => ORDER.map(k=>S[k]).join("_");
  const isDefault = S => ORDER.every(k=>S[k]===DEF[k]);
  function load(){
    const q = qs(); let s = q && q.get("league");
    if (!parse(s)) { s = null; try { s = localStorage.getItem("pa-tv-league"); } catch(e){} }
    return parse(s) || Object.assign({}, DEF);
  }
  function save(S, opt){
    const s = serialize(S);
    try { localStorage.setItem("pa-tv-league", s); } catch(e){}
    if (opt && opt.url) try { const u = new URL(location.href); if (isDefault(S)) u.searchParams.delete("league"); else u.searchParams.set("league", s);
      history.replaceState(history.state, "", u); } catch(e){}
    if (window.PANav) window.PANav.update();
  }
  function loadMode(){
    const q = qs(); let m = q && q.get("mode");
    if (!m && (location.hash==="#redraft" || location.hash==="#dynasty")) m = location.hash.slice(1);
    if (!m) try { m = localStorage.getItem("pa-tc-mode"); } catch(e){}
    return (m==="redraft" || m==="r") ? "r" : "d";
  }
  function saveMode(M, opt){
    try { localStorage.setItem("pa-tc-mode", M); } catch(e){}
    if (opt && opt.url) try { const u = new URL(location.href); u.searchParams.set("mode", M==="d" ? "dynasty" : "redraft"); history.replaceState(history.state, "", u); } catch(e){}
  }
  // ?league= to carry the current league onto a link (only when it isn't the default)
  const param = S => isDefault(S) ? "" : "league=" + encodeURIComponent(serialize(S));
  const starters = S => { const per = ["1 QB", `${S.rb} RB`, `${S.wr} WR`, `${S.te} TE`]; if (S.flex) per.push(`${S.flex} FLEX`); if (S.sf) per.push("1 SUPERFLEX"); return per; };
  const fdList = S => POS.filter(p=>S["fd"+p]>0).map(p=>`${p} +${S["fd"+p]}`);
  // short: menu badge; long: settings summary; label: one line under a table
  const short = S => `${S.teams}-team · ${S.sf ? "superflex" : "1QB"} · ${S.ppr===1 ? "PPR" : "0.5 PPR"}${S.tep ? " · TE+" + S.tep : ""}${fdList(S).length ? " · 1D bonus" : ""}`;
  const long = S => `<b>${S.teams} teams</b>, each starting ${starters(S).join(", ")} (${S.teams*(1+S.rb+S.wr+S.te+S.flex+S.sf)} starters in all). ${S.ppr===1?"Full PPR":"Half PPR"}${S.tep?`, TE premium +${S.tep}`:""}, ${S.ptd}-point passing TDs${fdList(S).length ? ", first-down bonus "+fdList(S).join(", ") : ""}.`;
  const label = S => `${S.teams} teams, ${S.sf?"superflex":"1 QB"}, ${S.ppr===1?"PPR":"half PPR"}` +
    `${S.tep?`, TE premium +${S.tep}`:""}${S.ptd!==4?`, ${S.ptd}-pt passing TD`:""}` +
    `, ${S.rb} RB / ${S.wr} WR / ${S.te} TE${S.flex?`, ${S.flex} FLEX`:", no flex"}${fdList(S).length?`, first-down bonus ${fdList(S).map(x=>x.replace(" +"," ")).join(", ")}`:""}`;
  // named leagues saved in this browser ("pa-leagues"): [{name, s}] where s is the league string. Nothing leaves the browser.
  const LS = "pa-leagues", MAXN = 12;
  function saved(){ try { const a = JSON.parse(localStorage.getItem(LS) || "[]"); return Array.isArray(a) ? a.filter(x=>x && x.name && parse(x.s)) : []; } catch(e){ return []; } }
  function keep(a){ try { localStorage.setItem(LS, JSON.stringify(a.slice(0, MAXN))); return true; } catch(e){ return false; } }
  function saveNamed(name, S){ name = String(name||"").trim().slice(0, 40); if (!name) return false;
    const a = saved().filter(x=>x.name.toLowerCase()!==name.toLowerCase()); a.unshift({name, s: serialize(S)}); return keep(a); }
  function removeNamed(name){ return keep(saved().filter(x=>x.name!==name)); }
  // settings buttons: get() returns the current league, set(k, v) changes one setting, setAll(S) swaps in a whole league (optional)
  function panel(el, get, set, setAll){
    const esc = t => String(t).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    el.innerHTML = `<div class="setting pa-saved"><span class="lbl">My leagues</span><div class="pa-saved-list"></div>
      <form class="pa-saved-add"><input type="text" maxlength="40" placeholder="Name this league" aria-label="Name for these settings"><button type="submit" class="btn">Save</button></form></div>` +
      OPTS.map(([k,l,os])=>`<div class="setting"><span class="lbl" id="l-${k}">${l}</span><div class="tabs seg" role="group" aria-labelledby="l-${k}" data-k="${k}">${os.map(([v,t])=>`<button type="button" data-v="${v}">${t}</button>`).join("")}</div></div>`).join("");
    const list = el.querySelector(".pa-saved-list"), form = el.querySelector(".pa-saved-add");
    const apply = S2 => { if (setAll) setAll(Object.assign({}, S2)); else ORDER.forEach(k=>{ if (get()[k]!==S2[k]) set(k, S2[k]); }); mark(); };
    function drawSaved(){ const cur = serialize(get()), a = saved();
      list.innerHTML = (a.length ? a.map(x=>`<span class="pa-lg${x.s===cur?" on":""}"><button type="button" data-use="${esc(x.name)}" title="${esc(label(parse(x.s)))}">${esc(x.name)}</button><button type="button" class="rm" data-rm="${esc(x.name)}" aria-label="Delete ${esc(x.name)}" title="Delete">×</button></span>`).join("") : `<span class="muted small">None yet. Set up a league below, name it and save it to switch between leagues in one click.</span>`) +
        (isDefault(get()) ? "" : `<button type="button" class="pa-lg-def" data-def="1">Default</button>`); }
    el.addEventListener("click", e=>{
      const u = e.target.closest("[data-use]"), r = e.target.closest("[data-rm]"), d = e.target.closest("[data-def]");
      if (u) { const x = saved().find(y=>y.name===u.dataset.use); if (x) apply(parse(x.s)); return; }
      if (r) { removeNamed(r.dataset.rm); drawSaved(); return; }
      if (d) { apply(DEF); return; }
      const b = e.target.closest("button[data-v]"); if (!b) return; set(b.parentNode.dataset.k, Number(b.dataset.v)); });
    form.addEventListener("submit", e=>{ e.preventDefault(); const i = form.querySelector("input"); if (saveNamed(i.value, get())) { i.value = ""; drawSaved(); } });
    function mark(){ const S = get(); el.querySelectorAll(".tabs.seg").forEach(t=>t.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", Number(b.dataset.v)===S[t.dataset.k]))); drawSaved(); }
    mark(); return {mark};
  }
  window.PALeague = {DEF, OPTS, ORDER, parse, serialize, isDefault, load, save, loadMode, saveMode, param, short, long, label, starters, panel, saved, saveNamed, removeNamed};
})();
