#!/usr/bin/env python3
"""Prospect Actuary: NFL team analytics data (data/teams/), for the /team-analytics/ page and player profiles.

Source: nflverse weekly player stats, regular season (github.com/nflverse/nflverse-data, stats_player_week_{season}.csv).
Only the raw stat categories are stored, never points: the browser scores them with the league settings the person
picked (PPR, passing TD points, TE premium, first-down bonuses), the same settings every value on the site uses.

Each QB, RB (incl. FB), WR and TE player-week is stored as 16 numbers in three groups:
  passing   pass_yds, pass_td, int, pass_2pt, sack_fumbles_lost
  rushing   rush_yds, rush_td, rush_first_downs, rush_2pt, rush_fumbles_lost
  receiving receptions, rec_yds, rec_td, rec_first_downs, rec_2pt, rec_fumbles_lost
Special-teams TDs are not offense and are left out.

Writes:
  data/teams/{season}.json   {"season", "weeks", "players": [[name, pos, site_id_or_null], ...],
                               "rows": [[player_index, team, week, opponent, c1..c16], ...]}
  data/teams/summary.json    every team-season, totals by position for offense and allowed by defense, plus games:
                               {"seasons", "last", "teams", "off": {season: {team: [games, QB16, RB16, WR16, TE16]}}, "def": {...}}
Validation (a failed check writes nothing): the latest season present, 32 teams each season, and the stored categories
reproduce nflverse's own full-PPR points (4-point passing TD) for at least 99% of player-weeks.
Files that did not change are not rewritten.

usage: python3 scripts/build_teams.py [--site .] [--first 2016] [--last <current season>]
"""
import argparse, csv, datetime, io, json, math, os, sys, urllib.request
from collections import defaultdict

BASE = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/"
GROUP = {"QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE"}
POS = ["QB", "RB", "WR", "TE"]
COLS = ["passing_yards", "passing_tds", "passing_interceptions", "passing_2pt_conversions", "sack_fumbles_lost",
        "rushing_yards", "rushing_tds", "rushing_first_downs", "rushing_2pt_conversions", "rushing_fumbles_lost",
        "receptions", "receiving_yards", "receiving_tds", "receiving_first_downs", "receiving_2pt_conversions", "receiving_fumbles_lost"]


def get(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "prospect-actuary-build"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))


def num(x):
    try:
        v = float(x)
        return v if math.isfinite(v) else 0.0
    except (TypeError, ValueError):
        return 0.0


def ppr4(c):
    """nflverse full PPR, 4-point passing TD, from the 16 categories (first-down bonus 0, no TE premium)."""
    return (0.04 * c[0] + 4 * c[1] - 2 * c[2] + 2 * c[3] - 2 * c[4]
            + 0.1 * c[5] + 6 * c[6] + 2 * c[8] - 2 * c[9]
            + 1 * c[10] + 0.1 * c[11] + 6 * c[12] + 2 * c[14] - 2 * c[15])


def clean(v):
    return int(v) if float(v).is_integer() else round(v, 2)


def write_if_changed(path, doc):
    body = json.dumps(doc, separators=(",", ":"))
    try:
        if open(path).read() == body:
            return False
    except OSError:
        pass
    with open(path, "w") as f:
        f.write(body)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default=".")
    ap.add_argument("--first", type=int, default=2016)
    ap.add_argument("--last", type=int, default=None)
    a = ap.parse_args()
    today = datetime.date.today()
    last = a.last or (today.year if today.month >= 9 else today.year - 1)

    ours = {p["gsis"]: p["id"] for p in json.load(open(os.path.join(a.site, "data", "players.json")))["players"] if p.get("gsis")}
    season_docs, off, dfn = {}, {}, {}
    checked = matched = 0
    for s in range(a.first, last + 1):
        try:
            rows = get(f"stats_player_week_{s}.csv")
        except Exception as e:
            sys.exit(f"weekly stats for {s} missing: {e}")
        pidx, players, out = {}, [], []
        o = defaultdict(lambda: [set()] + [[0.0] * 16 for _ in POS])   # team -> [weeks, QB, RB, WR, TE]
        d = defaultdict(lambda: [set()] + [[0.0] * 16 for _ in POS])   # defense -> allowed
        weeks = set()
        for r in rows:
            if r.get("season_type") != "REG":
                continue
            pos = GROUP.get(r.get("position_group") or r.get("position"))
            if not pos:
                continue
            c = [num(r.get(k)) for k in COLS]
            team, opp, wk = r.get("team") or "", r.get("opponent_team") or "", int(num(r.get("week")))
            if not team or not wk:
                continue
            weeks.add(wk)
            # every team-week counts as a game for the team, even a player with all zeros
            o[team][0].add(wk)
            if opp:
                d[opp][0].add(wk)
            if not any(c):
                continue
            checked += 1
            st = 6 * num(r.get("special_teams_tds"))
            if abs(ppr4(c) + st - num(r.get("fantasy_points_ppr"))) < 0.11:
                matched += 1
            gid = r.get("player_id") or ""
            if gid not in pidx:
                pidx[gid] = len(players)
                players.append([r.get("player_display_name") or r.get("player_name") or "", pos, ours.get(gid)])
            out.append([pidx[gid], team, wk, opp] + [clean(v) for v in c])
            k = 1 + POS.index(pos)
            for i in range(16):
                o[team][k][i] += c[i]
                if opp:
                    d[opp][k][i] += c[i]
        if len(o) != 32:
            sys.exit(f"{s}: {len(o)} teams, expected 32")
        out.sort(key=lambda x: (x[2], x[1], x[0]))
        season_docs[s] = {"season": s, "weeks": max(weeks), "players": players, "rows": out}
        pack = lambda t: {tm: [len(v[0])] + [[clean(round(x, 2)) for x in v[k]] for k in range(1, 5)] for tm, v in sorted(t.items())}
        off[str(s)], dfn[str(s)] = pack(o), pack(d)
        print(f"{s}: {len(out)} player-weeks, {len(players)} players, weeks 1-{max(weeks)}", file=sys.stderr)

    if checked == 0 or matched / checked < 0.99:
        sys.exit(f"categories reproduce nflverse PPR for only {matched}/{checked} player-weeks: not writing")
    print(f"PPR check: {matched}/{checked} player-weeks match nflverse ({100 * matched / checked:.2f}%)", file=sys.stderr)

    folder = os.path.join(a.site, "data", "teams")
    os.makedirs(folder, exist_ok=True)
    n = 0
    for s, doc in season_docs.items():
        n += write_if_changed(os.path.join(folder, f"{s}.json"), doc)
    summary = {"source": "nflverse weekly player stats, regular season (github.com/nflverse/nflverse-data)",
               "cols": COLS, "pos": POS, "first": a.first, "last": last, "weeks_last": season_docs[last]["weeks"],
               "off": off, "def": dfn}
    n += write_if_changed(os.path.join(folder, "summary.json"), summary)
    print(f"{n} file(s) written in {folder}" if n else "no change")


if __name__ == "__main__":
    main()
