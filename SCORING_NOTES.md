# Food Index v0.1 scoring specification

This file exists so future formula changes stay separate from UI code.

## Purity v2 — Label Mode

For ingredient rank `r`:

`base_weight = 0.8^(r-1)`

If the ingredient occurs after an explicit “contains 2% or less” declaration:

`weight = 0.25 × base_weight`

Otherwise:

`weight = base_weight`

Quality values:

- wholesome `q=1`
- neutral `q=2/3`
- questionable `q=1/3`
- noxious `q=0`
- unclassified uses `q=2/3` as a neutral placeholder but does not count as known for confidence

`P = 100 × Σ(qw) / Σ(w)`

Noxious override:

- any noxious ingredient => `P <= 50`
- any noxious ingredient rank 1–3 => `P <= 25`

Parenthetical subingredients are kept inside their parent ingredient and do not receive independent rank votes.

## Balance v0.1

All amounts are normalized to 100 kcal using product values per 100 g.

`B = .35M + .35A + .10F + .20L`

### Macro balance M

Compute macro calorie shares from 4 kcal/g carbohydrate, 4 kcal/g protein, and 9 kcal/g fat. Normalize the three shares so rounding inconsistencies do not distort the total.

Targets: carb `.50`, protein `.25`, fat `.25`.

For each macro:

`score = max(0, 100 × (1 - abs(actual-target)/target))`

`M = mean(three macro scores)`

### Micronutrient adequacy A

For every reported vitamin/mineral with a configured FDA Daily Value:

`target = 5% × DV`

`score = min(amount_per_100kcal / target, 1) × 100`

Do not penalize exceeding 5% DV. Do not treat unreported nutrients as zero. If zero micronutrients are reported, use 50 as a provisional neutral placeholder.

### Fiber F

Target: `1.4 g / 100 kcal`.

`F = min(fiber / 1.4, 1) × 100`

If missing, provisional placeholder = 50.

### Limit nutrients L

Average whichever limit nutrients are reported:

- Added sugar: 100 at ≤0.625 g; linear decline to 0 at 6.25 g / 100 kcal.
- Saturated fat: 100 at ≤1 g; linear decline to 0 at 4 g / 100 kcal.
- Sodium: 100 at ≤115 mg; linear decline to 0 at 600 mg / 100 kcal.
- Trans fat: 100 at 0 g; linear decline to 0 at 1 g / 100 kcal.

If none are reported, provisional placeholder = 50.

## Health Index

`HI = 2PB/(P+B)`

Ratings:

- 90–100 Exceptional
- 80–89 Excellent
- 70–79 Strong
- 60–69 Fair
- 45–59 Weak
- 25–44 Poor
- 0–24 Very poor
