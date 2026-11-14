#!/usr/bin/env python3
"""Prospect Actuary: Sleeper player id crosswalk (data/sleeper_ids.json) for the Sleeper league import.

Sleeper rosters list players by Sleeper's own id. This maps each Sleeper id to the player's trade-value key
("name|pos" in trade-values/data/tv.js), through the official NFL id (gsis_id) already in data/players.json:
  Sleeper id -> gsis_id   DynastyProcess open player-id table (github.com/dynastyprocess/data, db_playerids.csv)
  gsis_id    -> tv key    data/players.json (scripts/build_players.py)
Players with no gsis match fall back to name + position (+ team when names repeat).
Other Sleeper QB/RB/WR/TE ids are kept with name, position and team only, so a roster can name players we don't value.

Output: {"built", "source", "n", "m": {sleeper_id: tv_key}, "o": {sleeper_id: [name, pos, team]}}
Validation (a failed check writes nothing): at least 95% of trade-value players matched, no tv key on two Sleeper ids.

usage: python3 scripts/build_sleeper_ids.py [--site .] [--ids db_playerids.csv]
"""
import argparse, csv, datetime, io, json, os, re, sys, unicodedata, urllib.request

URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv"
POS = {"QB", "RB", "WR", "TE"}
SUFFIX = re.compile(r"\b(jr|sr|ii|iii|iv|v)\b")


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[.'’\-]", "", s)
    s = SUFFIX.sub("", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def ok(x):
    return x not in (None, "", "NA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default=".")
    ap.add_argument("--ids", help="local copy of db_playerids.csv (downloaded when not given)")
    a = ap.parse_args()
    if a.ids:
        text = open(a.ids, encoding="utf-8").read()
    else:
        with urllib.request.urlopen(URL, timeout=120) as r:
            text = r.read().decode("utf-8")
    dp = [r for r in csv.DictReader(io.StringIO(text)) if ok(r.get("sleeper_id")) and r.get("position") in POS]

    s = open(os.path.join(a.site, "trade-values/data/tv.js"), encoding="utf-8").read()
    tv = json.loads(s[s.index("{"): s.rindex("}") + 1])
    tv_keys = {f"{p['n']}|{p['p']}": p for p in tv["players"]}
    players = json.load(open(os.path.join(a.site, "data/players.json"), encoding="utf-8"))["players"]
    gsis_tv = {p["gsis"]: p["keys"]["tv"] for p in players if p.get("gsis") and p.get("keys", {}).get("tv") in tv_keys}

    m = {}
    for r in dp:
        k = gsis_tv.get(r.get("gsis_id"))
        if k:
            m[r["sleeper_id"]] = k
    # name + position fallback for value players the gsis join missed
    done = set(m.values())
    by_name = {}
    for r in dp:
        if r["sleeper_id"] not in m:
            by_name.setdefault((norm(r["name"]), r["position"]), []).append(r)
    for k, p in tv_keys.items():
        if k in done:
            continue
        c = by_name.get((norm(p["n"]), p["p"]), [])
        if len(c) > 1:
            c = [r for r in c if (r.get("team") or "").upper() == (p.get("tm") or "").upper()] or c
        if len(c) == 1:
            m[c[0]["sleeper_id"]] = k
            done.add(k)

    o = {r["sleeper_id"]: [r["name"], r["position"], r["team"] if ok(r.get("team")) else ""] for r in dp if r["sleeper_id"] not in m}

    # validation
    rate = len(set(m.values())) / max(1, len(tv_keys))
    if rate < 0.95:
        sys.exit(f"only {rate:.1%} of trade-value players matched a Sleeper id; nothing written")
    seen = {}
    for sid, k in m.items():
        if k in seen:
            sys.exit(f"{k} matched two Sleeper ids ({seen[k]}, {sid}); nothing written")
        seen[k] = sid

    out_path = os.path.join(a.site, "data/sleeper_ids.json")
    body = {"source": "DynastyProcess player ids (github.com/dynastyprocess/data) + nflverse gsis ids in data/players.json",
            "n": len(m), "m": dict(sorted(m.items())), "o": dict(sorted(o.items()))}
    try:
        old = json.load(open(out_path, encoding="utf-8"))
        if {k: old.get(k) for k in ("n", "m", "o")} == {k: body[k] for k in ("n", "m", "o")}:
            print("sleeper ids unchanged")
            return
    except (OSError, ValueError):
        pass
    body = {"built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), **body}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(body, f, separators=(",", ":"), ensure_ascii=False)
    missing = sorted(set(tv_keys) - set(m.values()))
    print(f"wrote {out_path}: {len(m)} valued players matched ({rate:.1%}), {len(o)} other ids; unmatched: {missing}")


if __name__ == "__main__":
    main()
