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

College stats come from collegefootballdata.com (via the cfbfastR R package).
