#!/usr/bin/env python3
"""Prospect Actuary: build the canonical player list (data/players.json) and the data manifest (data/manifest.json).

One permanent player_id per person, joining the files the site already publishes:
  pre-draft/data/pd_player_grades.csv        pre-draft grades (2010-2026 drafted + 2027 projected)
  post-draft/data/pd_post_player_grades.csv  post-draft grades (2010-2026 drafted)
  post-draft/data/pd_post_2027_mock_grades.csv  2027 class graded from the public Renner mock
  trade-values/data/tv.js                    trade values (every NFL QB/RB/WR/TE in the value pool)
with nflverse (CC BY 4.0) for the official NFL id (gsis_id), birth date and draft details:
  draft_picks.csv  joined on (draft year, overall pick): exact for every drafted prospect
  players.csv      joined on name + position (+ draft pick, + team) for trade-value players

IDs are permanent: an id once written to data/players.json is kept for the same gsis_id or the same source key on every
later run, so links like /player/?id=jahmyr-gibbs-2023 keep working. New people get "<name>-<year>".

Validation (a failed check writes nothing, so the published files stay as they were):
  duplicate ids, a source row without an id, two trade-value players on one id, invalid positions or grades,
  ids that disappeared since the last build, player counts that moved more than 10%, too many unmatched NFL players.

usage: python3 scripts/build_players.py [--site .] [--nflverse DIR] [--check-only]
       (downloads the two nflverse files when --nflverse is not given)
"""
import argparse, csv, hashlib, io, json, os, re, sys, unicodedata, urllib.request, datetime, collections

POS = {"QB", "RB", "WR", "TE"}
GRADES = {"A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"}
NFLVERSE = {"players": "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv",
            "draft_picks": "https://github.com/nflverse/nflverse-data/releases/download/draft_picks/draft_picks.csv"}
SUFFIX = re.compile(r"\b(jr|sr|ii|iii|iv|v)\b")


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[.'’\-]", "", s)
    s = SUFFIX.sub("", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def slug(s):
    return re.sub(r"\s+", "-", norm(s)) or "player"


def read_csv(path):
    with open(path, encoding="utf-8", newline="") as f:
        return [{k: (None if v in ("", "NA") else v) for k, v in r.items()} for r in csv.DictReader(f)]


def fetch(url, cache_dir):
    os.makedirs(cache_dir, exist_ok=True)
    out = os.path.join(cache_dir, url.rsplit("/", 1)[1])
    if not os.path.exists(out):
        with urllib.request.urlopen(url, timeout=120) as r, open(out, "wb") as f:
            f.write(r.read())
    return out


def load_tv(path):
    s = open(path, encoding="utf-8").read()
    j = json.loads(s[s.index("{"): s.rindex("}") + 1])
    return j


def to_int(x):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default=os.path.join(os.path.dirname(__file__), ".."))
    ap.add_argument("--nflverse", default=None, help="folder holding players.csv and draft_picks.csv (else downloaded)")
    ap.add_argument("--check-only", action="store_true")
    a = ap.parse_args()
    site = os.path.abspath(a.site)
    cache = a.nflverse or os.path.join(site, ".cache", "nflverse")
    nv_players = read_csv(a.nflverse and os.path.join(a.nflverse, "players.csv") or fetch(NFLVERSE["players"], cache))
    nv_picks = read_csv(a.nflverse and os.path.join(a.nflverse, "draft_picks.csv") or fetch(NFLVERSE["draft_picks"], cache))

    pre = read_csv(os.path.join(site, "pre-draft/data/pd_player_grades.csv"))
    post = read_csv(os.path.join(site, "post-draft/data/pd_post_player_grades.csv"))
    mock = read_csv(os.path.join(site, "post-draft/data/pd_post_2027_mock_grades.csv"))
    tv = load_tv(os.path.join(site, "trade-values/data/tv.js"))
    prev_path = os.path.join(site, "data/players.json")
    prev = json.load(open(prev_path, encoding="utf-8")) if os.path.exists(prev_path) else {"players": []}

    errors, warnings = [], []
    by_gsis = {p["gsis_id"]: p for p in nv_players if p.get("gsis_id")}
    pick_gsis = {(to_int(r["season"]), to_int(r["pick"])): r for r in nv_picks}
    nv_by_name = collections.defaultdict(list)
    for p in nv_players:
        pos = "RB" if p.get("position") == "FB" else p.get("position")
        if pos not in POS:
            continue
        for nm in {p.get("display_name"), f'{p.get("first_name") or ""} {p.get("last_name") or ""}', f'{p.get("football_name") or ""} {p.get("last_name") or ""}'}:
            if nm and nm.strip():
                nv_by_name[(norm(nm), pos)].append(p)

    # ---------- people ----------
    people = {}                      # internal key -> record
    def person(k, **kw):
        r = people.setdefault(k, {"keys": {}})
        for f, v in kw.items():
            if v is not None and r.get(f) is None:
                r[f] = v
        return r

    # prospects: one per (name, pos, class); drafted ones joined to nflverse on (class, overall pick)
    for src, rows, gcol in (("pre", pre, "grade"), ("post", post, "post_grade")):
        for r in rows:
            pos, cls = r["position"], to_int(r["class"])
            if pos not in POS:
                errors.append(f"{src}: invalid position {pos!r} for {r['name']}")
            if r.get(gcol) and r[gcol] not in GRADES:
                errors.append(f"{src}: invalid grade {r[gcol]!r} for {r['name']}")
            drafted = (r.get("status") or "drafted") == "drafted"
            pk = to_int(r.get("pick"))
            g = None
            if drafted and pk:
                dp = pick_gsis.get((cls, pk))
                if dp and dp.get("gsis_id"):
                    g = dp["gsis_id"]
                    if norm(dp.get("pfr_player_name")).split(" ")[-1:] != norm(r["name"]).split(" ")[-1:]:
                        warnings.append(f"{src}: {r['name']} ({cls} pick {pk}) matched draft record {dp.get('pfr_player_name')}")
                else:
                    cand = [p for p in nv_players if to_int(p.get("draft_year")) == cls and to_int(p.get("draft_pick")) == pk]
                    if len(cand) == 1:
                        g = cand[0]["gsis_id"]
            k = ("g", g) if g else ("p", norm(r["name"]), pos, cls)
            rec = person(k, gsis=g, name=r["name"], pos=pos, college=r.get("college"), cls=cls, rd=to_int(r.get("round")), pk=pk,
                         proj=0 if drafted else 1)
            if drafted and pk and (cls, pk) in pick_gsis:
                rec.setdefault("dteam", pick_gsis[(cls, pk)].get("team"))
            rec["keys"][src] = f'{r["name"]}|{pos}|{cls}'
    for r in mock:
        nm = r.get("board_name") or r["name"]
        k = ("p", norm(nm), r["position"], 2027)
        rec = person(k, name=nm, pos=r["position"], college=r.get("board_school") or r.get("school"), cls=2027, proj=1)
        rec["keys"]["mock"] = f'{nm}|{r["position"]}'
        rec["mock"] = {"pick": to_int(r["pick"]), "team": r.get("team_abbr")}

    # trade-value players: nflverse by name + position, then draft pick, then team
    unmatched = []
    tv_ids = {}
    for i, pl in enumerate(tv["players"]):
        cands = nv_by_name.get((norm(pl["n"]), pl["p"]), [])
        cands = list({c["gsis_id"]: c for c in cands}.values())
        if len(cands) > 1 and pl.get("dp") is not None:
            c2 = [c for c in cands if to_int(c.get("draft_pick")) == pl["dp"]]
            cands = c2 or cands
        if len(cands) > 1 and pl.get("dp") is None:
            c2 = [c for c in cands if not c.get("draft_pick")]
            cands = c2 or cands
        if len(cands) > 1:
            c2 = [c for c in cands if c.get("latest_team") == pl.get("tm")]
            cands = c2 or cands
        if len(cands) > 1:
            c2 = sorted(cands, key=lambda c: to_int(c.get("last_season")) or 0, reverse=True)[:1]
            warnings.append(f"tv: {pl['n']} {pl['p']} had {len(cands)} nflverse matches; kept the most recent")
            cands = c2
        g = cands[0]["gsis_id"] if cands else None
        if not g:
            unmatched.append(f"{pl['n']} {pl['p']} {pl.get('tm')}")
        k = ("g", g) if g else ("t", norm(pl["n"]), pl["p"])
        nv = by_gsis.get(g, {}) if g else {}
        rec = person(k, gsis=g, name=pl["n"], pos=pl["p"], college=nv.get("college_name"),
                     cls=to_int(nv.get("draft_year")) or to_int(nv.get("rookie_season")),
                     rd=to_int(nv.get("draft_round")), pk=pl.get("dp"), proj=0)
        if "tv" in rec["keys"]:
            errors.append(f"tv: {pl['n']} and {rec['keys']['tv']} map to the same person")
        rec["keys"]["tv"] = f'{pl["n"]}|{pl["p"]}'
        rec["team"] = pl.get("tm")
        tv_ids[i] = k
    # nflverse details for everyone with a gsis id
    for k, r in people.items():
        nv = by_gsis.get(r.get("gsis"))
        if nv:
            r.setdefault("birth", nv.get("birth_date"))
            r.setdefault("team", nv.get("latest_team") if nv.get("status") in ("ACT", "RES", "INA", "DEV", "EXE") else None)
            r.setdefault("dteam", nv.get("draft_team"))
            r.setdefault("college", nv.get("college_name"))
            if not r.get("rd"):
                r["rd"] = to_int(nv.get("draft_round"))

    # ---------- permanent ids ----------
    old_by_gsis = {p["gsis"]: p["id"] for p in prev["players"] if p.get("gsis")}
    old_by_key = {}
    for p in prev["players"]:
        for src, kv in (p.get("keys") or {}).items():
            old_by_key[(src, kv)] = p["id"]
    used = set()
    ordered = sorted(people.values(), key=lambda r: (r.get("cls") or 9999, r.get("pk") or 9999, r["name"]))
    for r in ordered:
        pid = old_by_gsis.get(r.get("gsis")) or next((old_by_key[(s, v)] for s, v in r["keys"].items() if (s, v) in old_by_key), None)
        if not pid or pid in used:
            base = f'{slug(r["name"])}-{r.get("cls") or "nfl"}'
            pid, n = base, 2
            while pid in used:
                pid, n = f"{base}-{n}", n + 1
        used.add(pid)
        r["id"] = pid

    # ---------- validation ----------
    ids = [r["id"] for r in people.values()]
    dup = [i for i, c in collections.Counter(ids).items() if c > 1]
    if dup:
        errors.append(f"duplicate player ids: {dup[:10]}")
    if any(not r.get("id") for r in people.values()):
        errors.append("a player has no id")
    for src, rows, name in (("pre", pre, "name"), ("post", post, "name")):
        have = {r["keys"].get(src) for r in people.values()}
        miss = [x for x in rows if f'{x[name]}|{x["position"]}|{to_int(x["class"])}' not in have]
        if miss:
            errors.append(f"{src}: {len(miss)} rows without a player id (e.g. {miss[0][name]})")
    if len(tv_ids) != len(tv["players"]):
        errors.append("some trade-value players have no id")
    if len(unmatched) > 0.10 * len(tv["players"]):
        errors.append(f"{len(unmatched)} of {len(tv['players'])} trade-value players have no NFL id (limit 10%)")
    elif unmatched:
        warnings.append(f"{len(unmatched)} trade-value players without an nflverse id: {', '.join(unmatched[:12])}")
    gone = sorted({p["id"] for p in prev["players"]} - set(ids))
    if prev["players"] and len(gone) > 0.02 * len(prev["players"]):
        errors.append(f"{len(gone)} player ids from the last build disappeared (limit 2%): {gone[:10]}")
    elif gone:
        warnings.append(f"ids no longer in any source (kept out of this build): {gone[:10]}")
    if prev["players"] and abs(len(ids) - len(prev["players"])) > 0.10 * len(prev["players"]):
        errors.append(f"player count moved from {len(prev['players'])} to {len(ids)} (limit 10%)")

    # ---------- write ----------
    for w in warnings:
        print("WARN", w)
    if errors:
        for e in errors:
            print("FAIL", e)
        print("validation failed: nothing written")
        sys.exit(1)
    FIELDS = ["id", "gsis", "name", "pos", "college", "cls", "rd", "pk", "dteam", "team", "birth", "proj", "mock", "keys"]
    out = [{f: r[f] for f in FIELDS if r.get(f) is not None} for r in sorted(people.values(), key=lambda r: r["id"])]
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    players = {"built": now, "source": "Prospect Actuary grade and value files + nflverse players and draft_picks (CC BY 4.0)",
               "n": len(out), "players": out}
    srcs = lambda rows, col: sorted({r[col] for r in rows if r.get(col)})
    manifest = {
        "built": now,
        "values": {"asof": tv.get("asof"), "players": len(tv["players"]), "scale": "100,000 = most valuable player on each sheet; values add",
                   "model": "Trade values: credibility-weighted PPG over replacement x expected games; dynasty through 2031 with aging, survival, stop-loss upside and 15%/yr discount; status-based expected games (injury report, depth chart). Weekly R build with 6 output gates.",
                   "projected": "Projections for the rest of 2026 and 2027-2031; 2026 games played so far are actual."},
        "prospects": {"pre_classes": f"{min(to_int(r['class']) for r in pre)}-{max(to_int(r['class']) for r in pre)}",
                      "pre_rows": len(pre), "pre_projected_2027": sum(1 for r in pre if r.get("status") != "drafted"),
                      "post_rows": len(post), "mock_2027": len(mock),
                      "pre_model": srcs(pre, "score_source"), "post_model": srcs(post, "score_source"),
                      "projected": "2027 prospects are projections from 2026 college stats (pro-rated to 12 games); the mock pick stands in for draft capital."},
        "ids": {"players": len(out), "with_nfl_id": sum(1 for r in out if r.get("gsis")), "unmatched_value_players": unmatched},
        # fingerprint of each published input: changes whenever the file's contents change (the "data version" shown on the site)
        "files": {p: {"sha": hashlib.sha256(open(os.path.join(site, p), "rb").read()).hexdigest()[:10],
                      "bytes": os.path.getsize(os.path.join(site, p))}
                  for p in ["pre-draft/data/pd_player_grades.csv", "post-draft/data/pd_post_player_grades.csv",
                            "post-draft/data/pd_post_2027_mock_grades.csv", "trade-values/data/tv.js"] if os.path.exists(os.path.join(site, p))},
        "checks": ["every row of every grade and value file has exactly one player id", "no two players share an id",
                   "positions and grades are valid", "at most 10% of valued players lack an NFL id",
                   "at most 2% of ids disappear and the player count moves at most 10% from the last build"],
        "limits": ["No combine data and no draft capital in the pre-draft model, on purpose.",
                   "Grades rank within position; Value is the cross-position measure.",
                   "Players are joined across files by official NFL id where one exists, else by name, position and class."],
    }
    if a.check_only:
        print(f"check passed: {len(out)} players, {manifest['ids']['with_nfl_id']} with NFL id (nothing written: --check-only)")
        return
    os.makedirs(os.path.join(site, "data"), exist_ok=True)
    # nothing changed but the clock: keep both files as they are, so a scheduled run makes no commit
    man_path = os.path.join(site, "data/manifest.json")
    old_man = json.load(open(man_path, encoding="utf-8")) if os.path.exists(man_path) else {}
    strip = lambda m: {k: v for k, v in m.items() if k != "built"}
    if prev.get("players") == out and strip(old_man) == strip(manifest):
        print(f"no change: {len(out)} players, nothing written")
        return
    with open(prev_path, "w", encoding="utf-8") as f:
        json.dump(players, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(site, "data/manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"wrote data/players.json: {len(out)} players ({manifest['ids']['with_nfl_id']} with NFL id), data/manifest.json")


if __name__ == "__main__":
    main()
