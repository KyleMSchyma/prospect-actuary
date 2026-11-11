# Prospect Actuary: Plain-English Guide

This guide explains the two Prospect Actuary boards: what each model predicts, what the
final model is, what drives it, and how to explain it to someone who doesn't do
statistics. The boards are the [Pre-Draft Player Grades](https://kylemschyma.github.io/prospect-actuary/pre-draft/)
and the [Post-Draft Player Grades](https://kylemschyma.github.io/prospect-actuary/post-draft/).
This guide is also on the site as a page: [Guide](https://kylemschyma.github.io/prospect-actuary/guide/).

## The one-paragraph version

Both boards answer one question: "How likely is this player to become a useful fantasy
starter in his first three NFL seasons?" The pre-draft grade answers it with college data
only, before anyone is drafted. The post-draft grade answers it again once we know where
he was picked and where he landed. The big lesson: **each new piece of real information
beats the clever stuff that came before it.** Draft position beats college stats, so the
post-draft grade is the more accurate of the two.

## Shared ideas (explain these once)

- **Tiers.** "Hitting" means at least one season in years 1-3 inside a tier. For QBs, RBs
  and TEs the tiers are top 8, top 16 and top 24 at the position. For WRs they are top 12,
  top 24 and top 36 (more WRs start in fantasy lineups).
- **Fair testing.** Each draft class is predicted only with classes whose results were
  already known at the time, like a forecaster who is not allowed to peek at the future.
  This is called rolling-origin testing, and it's the honest score.
- **Always compare to a simple benchmark.** Every model is measured against "just use the
  draft pick." If a fancy model can't beat that, we say so.
- **Elastic net.** The workhorse model. Think of it as a regression that is told "use as
  few inputs as you can, and keep their effects modest." It keeps the model from
  over-reacting to quirks in a small sample, which matters when there are only about 14
  draft classes to learn from.
- **Probabilities that make sense together.** The models are built so a player's chance
  of a top-8 season can never be higher than his chance of a top-24 season.
- **Letter grades.** Every player's model score is placed on one fixed A+ to F scale per
  board, so an A means the same thing in 2012 as in 2026.

## 1. The pre-draft (college-only) model

**What it predicts.** Before anyone is drafted, each college player's chance of a top,
top-two and any-tier season in his first three NFL years. It's trained on every
draft-eligible college player (about 900 to 2,800 per position), so "never made the NFL"
counts as a miss. Uses no draft pick and no combine.

**Final model in plain words.**

- QB, RB, TE: an elastic net on college production, age, recruiting and conference level.
- WR: a plain logistic regression on five inputs (receiving yards, dominator share, years
  out of high school, recruiting rating, Power 5). It tied the elastic net, and the
  simpler model wins ties.
- Random forests, gradient boosting (xgboost) and an average of models were all tested
  and lost. With only a few dozen hits per position, simpler models are more reliable.

**Key drivers.** Youth (fewer years out of high school), recruiting rating, Power 5, and
the position's production: QB accuracy, TD rate and low INT rate; RB touchdown share and
receiving; WR receiving yards and dominator share; TE yards per team pass attempt and
receiving share.

**FCS adjustment.** FCS stats are shrunk toward an FBS scale. Players who transferred from
FCS to FBS saw their production share drop more than FBS-to-FBS transfers, which gives a
factor of about 0.69 for receiving and rushing and 0.79 for passing. Conference labels
were tested as extra inputs (including a credibility-weighted conference effect) and did
not help.

**Class grades.** Add up the expected tier hits of each class's top prospects (QB 12, RB
20, WR 32, TE 15) and grade against 2010-2023 (A = top 10%, F = bottom 10%). Current:
2027 projected A− overall, 2026 F, 2025 A, 2024 C−. Class grades track reality modestly
(correlation about 0.5 for the overall grade), so trust the overall grade more than any
single position's.

**How to explain it.** "It's a scouting report built only from the box score and recruiting
rankings. It finds real signal (it ranks future hits well above average) but the NFL draft
still knows more."

## 2. Pre-draft player grades

**What it is.** A letter grade (A+ to F) for every drafted QB, RB, WR and TE from 2010-2026,
plus the top 2027 prospects, from the college-only model. Historical grades are scored by
a model that never saw that class, so they're honest.

**The result.** A-range players hit about 59% of the time, B about 31%, C and below about
14%. The grade separates the top well but not the bottom (C, D and F hit at similar
rates). Draft slot is still more accurate, and the grade only adds to draft slot for QBs.
Famous misses: Johnny Manziel (A+), N'Keal Harry (A+); famous low grades that hit: Josh
Allen (F), Cooper Kupp (F), Tyreek Hill (D), George Kittle (D).

**How to explain it.** "An A means the college résumé looks like past hits. It's a
strong flag at the top, not a guarantee, and a low grade doesn't rule a player out."

## 3. Post-draft player grades

**What it is.** The same A+ to F board for every drafted player from 2010-2026, but built
from the post-draft model: the college profile plus draft pick and landing spot (how much
target, touch or attempt share the new team has open, and how good the incumbents are).
It sits next to the pre-draft grade, so you can see how much draft capital moved each
player and each class. 2027 isn't on it because nobody has been drafted.

**Final model in plain words.** An ordered model: picture a ladder with rungs at top 8,
top 16 and top 24. One score per player says how high up the ladder he's likely to
climb. It's fit as an elastic net, and the biggest single input is the draft pick (as its
log, because the gap between picks 1 and 10 matters far more than between 150 and 160).

**The result.** Post-draft A-range players hit 69% of the time, B 35%, C 9% and D/F 4%.
Unlike the pre-draft grade, it separates the bottom too. It also ranks players within a
class better (average rank correlation 0.49-0.61 vs 0.31-0.45). For QBs it beats draft
slot alone; for RBs, WRs and TEs it's about the same as draft slot. Big risers include
Carson Wentz (F to A-), Doug Martin (D to A) and Travis Kelce (C to A-); big fallers are
mostly late picks with strong college numbers, such as Alex Collins (A- to D).

**How to explain it.** "The pre-draft grade is what the college stats say. The post-draft
grade adds what the NFL said with its pick. When they disagree, history sides with the
pick more often, which is why a pre-draft A who goes in round 6 usually fades."

## 4. Redraft Trade Values (in development)

A trade value for every QB, RB, WR and TE for the rest of the 2026 season, on a 100,000-point
scale where values add up, so two players together are worth the sum of their values.

**Formula.** Value = (credible points per game - replacement points per game) x expected games left.
Replacement is the QB24, RB24, WR36 or TE12 by points per game. Credible points per game blends this
season with the last three using Buhlmann credibility, Z = games / (games + k), with k fit per position
on 2016-2025 (weeks 1-9 predicting weeks 10-18). Expected games = team games left x his chance of playing
each game, blended from this season, his last three seasons and his position's average.

**Result.** The credible points per game beat "this season only" and "history only" at every position, and
the value ranked weeks 10-18 better than "current pace x games left" (rank correlation 0.54-0.68 vs 0.47-0.64).

## 5. Dynasty Trade Values (in development)

The same scale over the rest of 2026 plus 2027-2030, built like an actuarial annuity: each season's
expected points over replacement x expected games x the chance he is still playing, discounted 15% a year.
Draft slot sets a young player's potential until production takes over; aging, staying in the league and
availability are fit by position from past seasons; and a player just under replacement keeps a little value
from his chance of beating it (the insurance stop-loss formula).

**Result.** From week-9 snapshots of 2016-2020 with models fit only on earlier seasons, the values ranked
the next five seasons better than "current pace continues" (rank correlation 0.70 vs 0.63). Totals ran
about 16% high, so read them mainly as a ranking.

## Actuarial concepts behind it (SOA ATPA / PA exams)

| If someone asks... | Point to |
|---|---|
| "How do you know it isn't overfit?" | Rolling-origin validation by draft class; fixed benchmark; bootstrap confidence intervals |
| "Why not a fancier model?" | Model comparison (ATPA 4.5): random forest and xgboost lost to a penalized GLM on small samples |
| "Why does the model say what it says?" | Permutation importance, PDP/ICE and SHAP (ATPA 4.3) |
| "What about missing college data?" | Leakage-safe imputation with missing flags (ATPA 3.7a) |
| "Does conference strength matter?" | Credibility / mixed-model test (ATPA 3.3), no gain |
| "Why are probabilities nested?" | Ordered (cumulative logit) models and forced monotone probabilities |
