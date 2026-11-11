# Prospect Actuary

Letter grades (A+ to F) for every drafted NFL QB, RB, WR and TE from the 2010-2026 classes,
built with the predictive-modeling methods from actuarial exams. Each historical player's
real NFL results sit beside his grade, so you can check the model yourself.

**Website:** https://kylemschyma.github.io/prospect-actuary/

| Board | What it uses | Page | Data |
|---|---|---|---|
| Pre-Draft Player Grades | College production, age, recruiting and conference level only (no combine, no draft pick). Includes top 2027 prospects as projections. | [pre-draft](https://kylemschyma.github.io/prospect-actuary/pre-draft/) | [`pre-draft/data`](pre-draft/data) |
| Post-Draft Player Grades | The same college profile plus draft slot and landing spot. | [post-draft](https://kylemschyma.github.io/prospect-actuary/post-draft/) | [`post-draft/data`](post-draft/data) |

How the models work, in plain English: [GUIDE.md](GUIDE.md).

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
- Data provided by CollegeFootballData.com.

Each source has its own terms of use and licence, and you should follow them if you reuse
the raw data (see the nflverse and CollegeFootballData.com sites). The grades, model scores
and CSV tables in this repository are Prospect Actuary's own work built on that data.
Prospect Actuary is not affiliated with the NFL, any team, or any of the sources above.

Modeling used R with glmnet, ordinalNet, MASS, pROC, ranger and xgboost.
