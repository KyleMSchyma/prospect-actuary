#!/usr/bin/env python3
"""Prospect Actuary: NFL production, usage and career comparables for player profiles (data/production.json).

Source: nflverse open data (github.com/nflverse/nflverse-data releases), regular season only:
  stats_player/stats_player_reg_{season}.csv   season totals per player (games, targets, carries, yards, TDs, PPR points, target share)
  snap_counts/snap_counts_{season}.csv         offensive snap share per game (pfr ids)
  players/players.csv                          gsis <-> pfr ids and birth dates
Fantasy points are nflverse's full-PPR points (4-point passing TD); the profile labels them that way.

For every player in data/players.json with an NFL id it writes his seasons since 2016:
  [season, team, games, ppr_points, ppg, snap_pct, targets, receptions, rec_yards, rec_td, target_share, air_yards_share,
   carries, rush_yards, rush_td, pass_att, pass_yards, pass_td, interceptions]
and up to 5 career comparables: past QB/RB/WR/TE seasons (2016 on) at the same position whose age, points per game and
previous-season points per game were closest to his latest season with 6+ games, with what those players scored the
next two seasons. Nothing is estimated: a comparable's later season is shown only if he played it.

Validation (a failed check writes nothing): at least 300 players with a season, and the latest season present.
If nothing changed, nothing is written.

usage: python3 scripts/build_production.py [--site .] [--first 2016] [--last <current season>]
"""
import argparse, csv, datetime, io, json, math, os, sys, urllib.request
from collections import defaultdict

BASE = "https://github.com/nflverse/nflverse-data/releases/download/"
POS = {"QB", "RB", "WR", "TE"}
MIN_GAMES = 6          # a season counts as a basis or a comparable only with this many games
K = 5                  # comparables per player
# similarity scales: one unit of distance = this much difference
SCALE = {"ppg": 2.5, "age": 1.0, "prev": 4.0}


def get(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "prospect-actuary-build"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))


def num(x):
    try:
        v = float(x)
        return v if math.isfinite(v) else 0.0
    except (TypeError, ValueError):
        return 0.0


def r1(x):
    return round(x, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default=".")
    ap.add_argument("--first", type=int, default=2016)
    ap.add_argument("--last", type=int, default=None)
    a = ap.parse_args()
    today = datetime.date.today()
    last = a.last or (today.year if today.month >= 9 else today.year - 1)

    players = json.load(open(os.path.join(a.site, "data", "players.json")))["players"]
    ours = {p["gsis"]: p for p in players if p.get("gsis")}

    meta = {}   # gsis -> (pfr, birth, name)
    for r in get("players/players.csv"):
        if r.get("gsis_id"):
            meta[r["gsis_id"]] = (r.get("pfr_id") or "", r.get("birth_date") or "", r.get("display_name") or "")
    pfr2gsis = {v[0]: k for k, v in meta.items() if v[0]}

    seasons = defaultdict(dict)   # gsis -> season -> row
    names, posof = {}, {}
    for s in range(a.first, last + 1):
        try:
            stats = get(f"stats_player/stats_player_reg_{s}.csv")
        except Exception as e:
            if s == last:
                sys.exit(f"latest season {s} stats missing: {e}")
            raise
        for r in stats:
            if r.get("season_type", "REG") != "REG" or r.get("position") not in POS:
                continue
            g = int(num(r["games"]))
            if g <= 0:
                continue
            gid = r["player_id"]
            names[gid] = r.get("player_display_name") or r.get("player_name")
            posof[gid] = r["position"]
            pts = num(r["fantasy_points_ppr"])
            seasons[gid][s] = {"team": r.get("recent_team") or "", "g": g, "pts": pts, "ppg": pts / g,
                               "tgt": int(num(r["targets"])), "rec": int(num(r["receptions"])), "recy": int(num(r["receiving_yards"])), "rectd": int(num(r["receiving_tds"])),
                               "ts": num(r["target_share"]), "ays": num(r["air_yards_share"]),
                               "car": int(num(r["carries"])), "rushy": int(num(r["rushing_yards"])), "rushtd": int(num(r["rushing_tds"])),
                               "att": int(num(r["attempts"])), "passy": int(num(r["passing_yards"])), "passtd": int(num(r["passing_tds"])),
                               "int": int(num(r.get("passing_interceptions", r.get("interceptions", 0)))), "snap": None}
        # snap share: mean offensive snap % over his regular-season games with an offensive snap
        try:
            snaps = get(f"snap_counts/snap_counts_{s}.csv")
        except Exception:
            snaps = []
        acc = defaultdict(list)
        for r in snaps:
            if r.get("game_type") != "REG":
                continue
            gid = pfr2gsis.get(r.get("pfr_player_id"))
            if gid and num(r["offense_snaps"]) > 0:
                acc[gid].append(num(r["offense_pct"]))
        for gid, v in acc.items():
            if s in seasons.get(gid, {}):
                seasons[gid][s]["snap"] = sum(v) / len(v)
        print(f"{s}: {sum(1 for x in seasons.values() if s in x)} players", file=sys.stderr)

    def age_at(gid, s):
        b = meta.get(gid, ("", "", ""))[1] or (ours.get(gid) or {}).get("birth") or ""
        try:
            bd = datetime.date.fromisoformat(b[:10])
        except ValueError:
            return None
        return (datetime.date(s, 9, 1) - bd).days / 365.25

    # comparable pool: seasons whose next season is complete (s + 1 < last)
    pool = []
    for gid, ss in seasons.items():
        for s, x in ss.items():
            if x["g"] < MIN_GAMES or s + 1 >= last:
                continue
            ag = age_at(gid, s)
            if ag is None:
                continue
            pv = ss.get(s - 1)
            pool.append((posof[gid], gid, s, ag, x["ppg"], pv["ppg"] if pv else 0.0))

    def after(gid, s):
        ss = seasons[gid]
        out = []
        for k in (1, 2):
            y = s + k
            if y >= last:          # the current season is still in progress: not shown as an outcome
                out.append(None)
            elif y in ss:
                out.append([y, ss[y]["g"], r1(ss[y]["ppg"])])
            else:
                out.append([y, 0, None])   # no regular-season games that year
        return out

    out = {}
    for gid, p in ours.items():
        ss = seasons.get(gid)
        if not ss:
            continue
        rows = []
        for s in sorted(ss):
            x = ss[s]
            rows.append([s, x["team"], x["g"], r1(x["pts"]), r1(x["ppg"]), None if x["snap"] is None else round(x["snap"], 3),
                         x["tgt"], x["rec"], x["recy"], x["rectd"], round(x["ts"], 3), round(x["ays"], 3),
                         x["car"], x["rushy"], x["rushtd"], x["att"], x["passy"], x["passtd"], x["int"]])
        rec = {"s": rows}
        basis = [s for s in sorted(ss) if ss[s]["g"] >= MIN_GAMES]
        if basis and posof.get(gid) == p["pos"]:
            s0 = basis[-1]
            ag0 = age_at(gid, s0)
            if ag0 is not None:
                x0, pv0 = ss[s0]["ppg"], ss[s0 - 1]["ppg"] if (s0 - 1) in ss else 0.0
                cand = []
                for pos, g2, s2, ag, ppg, prev in pool:
                    if pos != p["pos"] or g2 == gid:
                        continue
                    d = ((ppg - x0) / SCALE["ppg"]) ** 2 + ((ag - ag0) / SCALE["age"]) ** 2 + ((prev - pv0) / SCALE["prev"]) ** 2
                    cand.append((d, g2, s2, ag, ppg, prev))
                cand.sort()
                comps, seen = [], set()
                for d, g2, s2, ag, ppg, prev in cand:
                    if g2 in seen:
                        continue
                    seen.add(g2)
                    comps.append({"n": names.get(g2) or meta.get(g2, ("", "", ""))[2], "id": (ours.get(g2) or {}).get("id"),
                                  "s": s2, "a": r1(ag), "ppg": r1(ppg), "prev": r1(prev), "next": after(g2, s2), "d": round(math.sqrt(d), 2)})
                    if len(comps) == K:
                        break
                rec["b"] = {"s": s0, "a": r1(ag0), "ppg": r1(x0), "prev": r1(pv0), "partial": s0 == last}
                rec["c"] = comps
        out[p["id"]] = rec

    n = len(out)
    if n < 300:
        sys.exit(f"only {n} players with NFL seasons: not writing")
    if not any(r["s"][-1][0] == last for r in out.values()):
        sys.exit(f"no player has a {last} season: not writing")

    doc = {"source": "nflverse player stats and snap counts (regular season), github.com/nflverse/nflverse-data",
           "scoring": "full PPR, 4-point passing TD (nflverse fantasy_points_ppr)",
           "first": a.first, "last": last, "min_games": MIN_GAMES,
           "cols": ["season", "team", "games", "ppr_pts", "ppg", "snap_pct", "targets", "receptions", "rec_yds", "rec_td", "target_share", "air_yards_share",
                    "carries", "rush_yds", "rush_td", "pass_att", "pass_yds", "pass_td", "int"],
           "players": dict(sorted(out.items()))}
    path = os.path.join(a.site, "data", "production.json")
    body = json.dumps(doc, separators=(",", ":"))
    try:
        old = json.load(open(path))
        old.pop("built", None)
        if json.dumps(old, separators=(",", ":")) == body:
            print("no change")
            return
    except (OSError, ValueError):
        pass
    doc = {"built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), **doc}
    with open(path, "w") as f:
        f.write(json.dumps(doc, separators=(",", ":")))
    print(f"wrote {path}: {n} players, seasons {a.first}-{last}")


if __name__ == "__main__":
    main()
