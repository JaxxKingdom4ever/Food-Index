# Food Index v0.1

A phone-first Progressive Web App for looking up packaged foods and calculating three experimental scores:

- **Purity v2** — weighted ingredient quality.
- **Nutritional Balance** — nutrition normalized to 100 kcal.
- **Health Index** — harmonic mean of Purity and Balance.

## Fastest phone setup: GitHub Pages

1. On GitHub, create a new public repository, for example `food-index`.
2. Extract this ZIP on your phone.
3. Upload **all files and folders inside `food-index-v0.1`** to the root of the repository. Make sure the `icons` folder is included.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select branch **main** and folder **/(root)**, then Save.
7. Wait roughly a minute and open the GitHub Pages link GitHub shows you.
8. In Chrome on Android, open the browser menu and choose **Add to Home screen / Install app**.

Camera barcode scanning only works from a secure origin such as GitHub Pages (`https://`). If the browser does not support the BarcodeDetector API, manual UPC entry still works.

## Current data source

v0.1 uses Open Food Facts for product lookup. Barcode lookup is the primary route. Name search uses the legacy Open Food Facts text-search endpoint because their current v2/v3 APIs do not yet provide regular full-text search.

## Scoring notes

### Purity v2

Quality values:

- Wholesome = 1.000
- Neutral = 0.667
- Questionable = 0.333
- Noxious = 0.000
- Unclassified = neutral placeholder (0.667) + confidence penalty

Ingredient rank weight:

`w(r) = 0.8^(r - 1)`

Ingredients after an explicit “contains 2% or less” marker receive `0.25 ×` their normal rank weight.

`Purity = 100 × Σ(qᵢwᵢ) / Σwᵢ`

Any noxious ingredient caps Purity at 50. A noxious top-three ingredient caps Purity at 25.

### Nutritional Balance

All nutrients are converted to a 100-kcal basis.

`Balance = 0.35 Macro + 0.35 Micronutrients + 0.10 Fiber + 0.20 Limits`

- Macro target: 50% carbohydrate / 25% protein / 25% fat calories
- Micronutrient target: 5% FDA Daily Value per 100 kcal for each reported micronutrient
- Fiber target: ≥1.4 g / 100 kcal
- Added sugar ideal ceiling: ≤0.625 g / 100 kcal
- Saturated fat ideal ceiling: ≤1 g / 100 kcal
- Sodium ideal ceiling: ≤115 mg / 100 kcal
- Trans fat target: 0 g

Unreported micronutrients are **not** assumed to be zero. If no micronutrients are available at all, that component uses a neutral 50-point placeholder and confidence falls.

### Health Index

`Index = 2PB / (P + B)`

This is a harmonic mean, so a low Purity or low Balance score drags the Index down more than a simple average would.

## Important limitation

This is an experimental scoring model, not an FDA rating, diagnosis, or medical recommendation. The starter ingredient classifier is intentionally small. Unknown ingredients are visible in the UI and lower confidence so they can be reviewed and added to `ingredients.js` over time.

## Files

- `index.html` — app interface
- `style.css` — phone-first styling
- `app.js` — Open Food Facts lookup, barcode camera, history, UI
- `scoring.js` — Purity / Balance / Index formulas
- `ingredients.js` — editable ingredient classification rules
- `manifest.webmanifest` — installable PWA metadata
- `sw.js` — offline static app shell cache
- `icons/` — PWA icons
