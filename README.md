# Prospect Actuary

Letter grades (A+ to F) for every drafted NFL QB, RB, WR and TE from the 2010-2026 classes,
built with the predictive-modeling methods from actuarial exams. Each historical player's
real NFL results sit beside his grade, so you can check the model yourself.

**Website:** https://kylemschyma.github.io/prospect-actuary/

| Board | What it uses | Page | Data |
|---|---|---|---|
| Pre-Draft Player Grades | College production, age, recruiting and conference level only (no combine, no draft pick). Includes top 2027 prospects as projections. | [pre-draft](https://kylemschyma.github.io/prospect-actuary/pre-draft/) | [`pre-draft/data`](pre-draft/data) |
| Post-Draft Player Grades | The same college profile plus draft slot and landing spot. | [post-draft](https://kylemschyma.github.io/prospect-actuary/post-draft/) | [`post-draft/data`](post-draft/data) |
| Trade Values | Redraft sheet (rest of 2026) and Dynasty sheet (rest of 2026 plus 2027-2031): points per game over replacement x expected games, with credibility-blended PPG, an injury factor, draft-slot potential and aging. Set to your league (teams, PPR, TE premium, passing TD, superflex, starters, flex), with 2027 rookie picks on the Dynasty sheet. One 100,000-point scale that adds up. | [trade-values](https://kylemschyma.github.io/prospect-actuary/trade-values/) | [`trade-values/data`](trade-values/data) |
| Trade Calculator | Add players and 2027 rookie picks to each side of a trade and compare the totals, redraft or dynasty, for your league. Uses the same values as the Trade Values page (`trade-values/data/tv.js`, refreshed weekly). | [trade-calculator](https://kylemschyma.github.io/prospect-actuary/trade-calculator/) | [`trade-values/data`](trade-values/data) |
| Market Check (folder value-research) | Our trade values (12-team superflex, 0.5 PPR) ranked against market values: [Dynasty Daddy](https://dynasty-daddy.com/help/api-documentation) (dynasty and redraft, from its public API, snapshot refreshed weekly in `value-research/data/dd.js`) and [DynastyProcess](https://github.com/dynastyprocess/data) (dynasty, loaded live with a saved copy as fallback). Overall and positional rank gaps, agreement by position, biggest disagreements. | [value-research](https://kylemschyma.github.io/prospect-actuary/value-research/) | [`value-research/data`](value-research/data) |

## How the site is organized

Five sections share one menu (`shared/nav.js`). Folder URLs did not change when the sections were introduced.

| Section | Pages (folders) |
|---|---|
| Dashboard | `index.html`: search, top dynasty values, quick trade, risers and fallers, 2027 prospects and pick values |
| Prospect Lab | `pre-draft/`, `post-draft/` (two stages of the same 2010-2026 players, plus the 2027 class) |
| Player Values | `trade-values/` (dynasty default, redraft, rookie picks, league settings) |
| Trade Center | `trade-calculator/`, `value-research/` (Market Check), `buy-sell/` |
| Research | `research/` (hub), `guide/`, `track-record/`, `about/` |

Shared code in `shared/`: `theme.css` (the one design), `nav.js` (menu), `search.js` (site-wide player search),
`league.js` (league settings, saved as `pa-tv-league` and shared as `?league=`), `engine.js` (the one copy of the
trade-value math every page uses), `league-value.js` (grade boards' Value column). The models run in R
([Football repo](https://github.com/KyleMSchyma/Football)); this site only displays their output.

Weekly refresh: `trade-values/index.html` is rebuilt from `Trade_Values/tv_page_template.html` (Football repo, and the
copy in Football2_Dynasty on the PC), so edit that template for any change to the Player Values page. The grade pages
keep exactly one `window.PD=` line (and `window.MOCK27=` on post-draft), which the refresh replaces. `data/movers.csv`
is the latest week-over-week movers file.

How the models work, in plain English: the [Guide page](https://kylemschyma.github.io/prospect-actuary/guide/)
(also in this repo as [GUIDE.md](GUIDE.md)).

Prospect Actuary is free to use. If it helped you, you can
[buy me a coffee](https://buymeacoffee.com/kylemschyma). A dollar is plenty.

## Data files

Each page's `data/` folder holds the CSVs behind it:

- `*_player_grades.csv`: every player on the board, with grade, model score, tier probabilities and NFL outcome.
- `*_grade_scale.csv`: the score cut-offs for each letter grade.
- `*_grade_validation.csv`: hit rates by grade, with bootstrap intervals.
- `*_grade_vs_pick.csv`: how the grade compares with draft slot (AUC and likelihood-ratio tests).
- `*_grade_by_round.csv`: hit rates by grade within each draft round group.

## Caveats

- A "hit" is at least one tier season in a player's first three NFL years. 2024 and 2025
  outcomes are best finish so far; 2026 rookies have no outcome yet.
- Drafted players need a college stats match, so a few are missing (for example Cam Newton, 2010).
- Draft slot is still more accurate than college stats alone. A grade is a flag, not a guarantee.

## Data sources and credits

These grades would not exist without free, openly shared football data. Thank you to:

- **[CollegeFootballData.com](https://collegefootballdata.com)**: college player season stats,
  team season stats and 247Sports-based recruiting ratings, pulled through the
  **[cfbfastR](https://cfbfastr.sportsdataverse.org)** R package from the SportsDataverse.
- **[nflverse](https://nflverse.com)**: NFL draft picks, player IDs, weekly player stats
  (used for fantasy finishes and landing-spot opportunity) and NFL Combine results, pulled
  through the **[nflreadr](https://nflreadr.nflverse.com)** R package. nflverse data is shared
  under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the grades here are
  derived from it, not copies of it.
- **[Pro Football Reference](https://www.pro-football-reference.com)** (Sports Reference LLC):
  the original source of the NFL draft and combine data that nflverse compiles.
- **[Dynasty Daddy](https://dynasty-daddy.com)** (Jeremy Timperio): superflex dynasty and redraft trade values
  from its public values API, compared on the Market Check page. Pulled once a week and cached, as the API asks.
- **[DynastyProcess](https://github.com/dynastyprocess/data)** (Tan Ho): the open superflex
  dynasty values (built from FantasyPros expert consensus rankings) that the Market Check
  page compares against. Only ranks derived from them are shown.
- Data provided by CollegeFootballData.com.

Each source has its own terms of use and licence, and you should follow them if you reuse
the raw data (see the nflverse and CollegeFootballData.com sites). The grades, model scores
and CSV tables in this repository are Prospect Actuary's own work built on that data.
Prospect Actuary is not affiliated with the NFL, any team, or any of the sources above.

Modeling used R with glmnet, ordinalNet, MASS, pROC, ranger and xgboost.
