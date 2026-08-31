window.FOOD_INDEX_SCORING = (() => {
  const { classify, cleanName } = window.FOOD_INDEX_INGREDIENTS;
  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  const round1 = n => Math.round(n * 10) / 10;

  const DV = [
    { ids: ['vitamin-d'], name: 'Vitamin D', dv: 20, unit: 'mcg' },
    { ids: ['calcium'], name: 'Calcium', dv: 1300, unit: 'mg' },
    { ids: ['iron'], name: 'Iron', dv: 18, unit: 'mg' },
    { ids: ['potassium'], name: 'Potassium', dv: 4700, unit: 'mg' },
    { ids: ['vitamin-a'], name: 'Vitamin A', dv: 900, unit: 'mcg' },
    { ids: ['vitamin-c'], name: 'Vitamin C', dv: 90, unit: 'mg' },
    { ids: ['vitamin-e'], name: 'Vitamin E', dv: 15, unit: 'mg' },
    { ids: ['vitamin-k'], name: 'Vitamin K', dv: 120, unit: 'mcg' },
    { ids: ['magnesium'], name: 'Magnesium', dv: 420, unit: 'mg' },
    { ids: ['zinc'], name: 'Zinc', dv: 11, unit: 'mg' },
    { ids: ['copper'], name: 'Copper', dv: 0.9, unit: 'mg' },
    { ids: ['manganese'], name: 'Manganese', dv: 2.3, unit: 'mg' },
    { ids: ['selenium'], name: 'Selenium', dv: 55, unit: 'mcg' },
    { ids: ['iodine'], name: 'Iodine', dv: 150, unit: 'mcg' },
    { ids: ['vitamin-b1', 'thiamin'], name: 'Thiamin (B1)', dv: 1.2, unit: 'mg' },
    { ids: ['vitamin-b2', 'riboflavin'], name: 'Riboflavin (B2)', dv: 1.3, unit: 'mg' },
    { ids: ['vitamin-pp', 'niacin'], name: 'Niacin (B3)', dv: 16, unit: 'mg' },
    { ids: ['pantothenic-acid'], name: 'Pantothenic acid (B5)', dv: 5, unit: 'mg' },
    { ids: ['vitamin-b6'], name: 'Vitamin B6', dv: 1.7, unit: 'mg' },
    { ids: ['biotin'], name: 'Biotin (B7)', dv: 30, unit: 'mcg' },
    { ids: ['folates', 'folate', 'vitamin-b9'], name: 'Folate (B9)', dv: 400, unit: 'mcg' },
    { ids: ['vitamin-b12'], name: 'Vitamin B12', dv: 2.4, unit: 'mcg' }
  ];

  function splitTopLevelIngredients(text) {
    if (!text) return [];
    const raw = String(text).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = [];
    let buffer = '';
    let depth = 0;
    let traceMode = false;

    const push = () => {
      let value = buffer.trim().replace(/^[,;:.\s]+|[,;:.\s]+$/g, '');
      buffer = '';
      if (!value) return;
      const marker = value.match(/(?:contains\s*)?(?:2|two)\s*%\s*(?:or\s*less)?\s*(?:of)?\s*[:\-]?\s*(.*)$/i) ||
                     value.match(/(?:contains\s*)?less\s*than\s*2\s*%\s*(?:of)?\s*[:\-]?\s*(.*)$/i);
      if (marker) {
        traceMode = true;
        value = (marker[1] || '').trim();
      }
      if (value) parts.push({ name: cleanName(value), trace: traceMode });
    };

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
      if ((ch === ',' || ch === ';') && depth === 0) push();
      else buffer += ch;
    }
    push();
    return parts.filter(x => x.name);
  }

  function scorePurity(text) {
    const parsed = splitTopLevelIngredients(text);
    if (!parsed.length) {
      return { score: 50, ingredients: [], knownWeightShare: 0, counts: {}, note: 'No ingredient list was available; a neutral placeholder is used.' };
    }

    const ingredients = parsed.map((item, idx) => {
      const rank = idx + 1;
      const baseWeight = Math.pow(0.8, rank - 1);
      const weight = baseWeight * (item.trace ? 0.25 : 1);
      const c = classify(item.name);
      return { ...item, rank, weight, ...c };
    });

    const totalWeight = ingredients.reduce((s, x) => s + x.weight, 0);
    const weighted = ingredients.reduce((s, x) => s + x.quality * x.weight, 0);
    let score = totalWeight ? (weighted / totalWeight) * 100 : 50;

    const noxious = ingredients.filter(x => x.category === 'noxious');
    if (noxious.length) {
      score = Math.min(score, noxious.some(x => x.rank <= 3) ? 25 : 50);
    }

    const knownWeight = ingredients.filter(x => x.known).reduce((s, x) => s + x.weight, 0);
    const knownWeightShare = totalWeight ? knownWeight / totalWeight : 0;
    const counts = ingredients.reduce((m, x) => {
      m[x.category] = (m[x.category] || 0) + 1;
      return m;
    }, {});

    return {
      score: round1(score),
      ingredients: ingredients.map(x => ({ ...x, influence: totalWeight ? (x.weight / totalWeight) * 100 : 0 })),
      knownWeightShare,
      counts,
      note: knownWeightShare < 0.8 ? 'Some ingredients are unclassified and use a neutral placeholder, so Purity confidence is reduced.' : 'Ingredient classifications cover most of the weighted list.'
    };
  }

  function energyKcal100(n) {
    const kcal = Number(n?.['energy-kcal_100g']);
    if (Number.isFinite(kcal) && kcal > 0) return kcal;
    const kj = Number(n?.['energy-kj_100g'] ?? n?.energy_100g);
    return Number.isFinite(kj) && kj > 0 ? kj / 4.184 : NaN;
  }

  function hasNutrient(n, id) {
    return Object.prototype.hasOwnProperty.call(n || {}, `${id}_100g`) && Number.isFinite(Number(n[`${id}_100g`]));
  }

  function convertUnit(value, from, to) {
    if (!Number.isFinite(value)) return NaN;
    const normalize = u => String(u || '').toLowerCase().replace('µ', 'u').replace('μ', 'u').trim();
    from = normalize(from || 'g');
    to = normalize(to);
    const toGrams = { kg: 1000, g: 1, mg: 1e-3, ug: 1e-6, mcg: 1e-6 };
    if (!(from in toGrams) || !(to in toGrams)) return value;
    return value * toGrams[from] / toGrams[to];
  }

  function readNutrient(n, ids, targetUnit = 'g') {
    for (const id of (Array.isArray(ids) ? ids : [ids])) {
      const key = `${id}_100g`;
      if (!Object.prototype.hasOwnProperty.call(n || {}, key)) continue;
      const value = Number(n[key]);
      if (!Number.isFinite(value)) continue;
      const unit = n[`${id}_unit`] || (targetUnit === 'g' ? 'g' : 'g');
      return { id, value: convertUnit(value, unit, targetUnit), unit: targetUnit, rawUnit: unit };
    }
    return null;
  }

  function per100Kcal(valuePer100g, kcal100g) {
    return Number.isFinite(valuePer100g) && kcal100g > 0 ? valuePer100g * 100 / kcal100g : NaN;
  }

  function macroComponent(actual, target) {
    return clamp(100 * (1 - Math.abs(actual - target) / target));
  }

  function scoreBalance(product) {
    const n = product?.nutriments || {};
    const kcal100g = energyKcal100(n);
    if (!Number.isFinite(kcal100g) || kcal100g <= 0) {
      return {
        score: 50,
        components: { macro: 50, micro: 50, fiber: 50, limits: 50 },
        normalized: [],
        coverage: 0,
        note: 'Energy data is missing, so nutritional balance cannot be normalized to 100 kcal.'
      };
    }

    const fat100 = readNutrient(n, 'fat', 'g');
    const carb100 = readNutrient(n, 'carbohydrates', 'g');
    const protein100 = readNutrient(n, 'proteins', 'g');
    const fat = fat100 ? per100Kcal(fat100.value, kcal100g) : NaN;
    const carbs = carb100 ? per100Kcal(carb100.value, kcal100g) : NaN;
    const protein = protein100 ? per100Kcal(protein100.value, kcal100g) : NaN;

    let macro = 50;
    let macroDist = null;
    if ([fat, carbs, protein].every(Number.isFinite)) {
      const macroCals = { carbs: carbs * 4, protein: protein * 4, fat: fat * 9 };
      const sum = macroCals.carbs + macroCals.protein + macroCals.fat;
      if (sum > 0) {
        macroDist = {
          carbs: macroCals.carbs / sum,
          protein: macroCals.protein / sum,
          fat: macroCals.fat / sum
        };
        macro = (
          macroComponent(macroDist.carbs, 0.50) +
          macroComponent(macroDist.protein, 0.25) +
          macroComponent(macroDist.fat, 0.25)
        ) / 3;
      }
    }

    const microRows = [];
    for (const nutrient of DV) {
      const r = readNutrient(n, nutrient.ids, nutrient.unit);
      if (!r) continue;
      const amount = per100Kcal(r.value, kcal100g);
      const target = nutrient.dv * 0.05;
      const score = clamp(Math.min(amount / target, 1) * 100);
      microRows.push({ name: nutrient.name, amount, unit: nutrient.unit, target, score });
    }
    const micro = microRows.length ? microRows.reduce((s, x) => s + x.score, 0) / microRows.length : 50;

    const fiberRead = readNutrient(n, 'fiber', 'g');
    const fiberAmount = fiberRead ? per100Kcal(fiberRead.value, kcal100g) : NaN;
    const fiber = Number.isFinite(fiberAmount) ? clamp(Math.min(fiberAmount / 1.4, 1) * 100) : 50;

    const limitRows = [];
    const addedRead = readNutrient(n, ['added-sugars', 'added-sugar'], 'g');
    if (addedRead) {
      const x = per100Kcal(addedRead.value, kcal100g);
      const score = x <= 0.625 ? 100 : clamp(100 * (1 - (x - 0.625) / 5.625));
      limitRows.push({ name: 'Added sugar', amount: x, unit: 'g', score, targetText: '≤0.625 g' });
    }

    const satRead = readNutrient(n, 'saturated-fat', 'g');
    if (satRead) {
      const x = per100Kcal(satRead.value, kcal100g);
      const score = x <= 1 ? 100 : clamp(100 * (1 - (x - 1) / 3));
      limitRows.push({ name: 'Saturated fat', amount: x, unit: 'g', score, targetText: '≤1 g' });
    }

    let sodiumRead = readNutrient(n, 'sodium', 'mg');
    if (!sodiumRead) {
      const salt = readNutrient(n, 'salt', 'g');
      if (salt) sodiumRead = { value: salt.value * 1000 / 2.5, unit: 'mg', fromSalt: true };
    }
    if (sodiumRead) {
      const x = per100Kcal(sodiumRead.value, kcal100g);
      const score = x <= 115 ? 100 : clamp(100 * (1 - (x - 115) / 485));
      limitRows.push({ name: 'Sodium', amount: x, unit: 'mg', score, targetText: '≤115 mg' });
    }

    const transRead = readNutrient(n, 'trans-fat', 'g');
    if (transRead) {
      const x = per100Kcal(transRead.value, kcal100g);
      const score = clamp(100 * (1 - x / 1));
      limitRows.push({ name: 'Trans fat', amount: x, unit: 'g', score, targetText: '0 g' });
    }
    const limits = limitRows.length ? limitRows.reduce((s, x) => s + x.score, 0) / limitRows.length : 50;

    const score = 0.35 * macro + 0.35 * micro + 0.10 * fiber + 0.20 * limits;

    const normalized = [
      { name: 'Energy basis', amount: 100, unit: 'kcal' },
      Number.isFinite(carbs) ? { name: 'Carbohydrate', amount: carbs, unit: 'g' } : null,
      Number.isFinite(protein) ? { name: 'Protein', amount: protein, unit: 'g' } : null,
      Number.isFinite(fat) ? { name: 'Fat', amount: fat, unit: 'g' } : null,
      Number.isFinite(fiberAmount) ? { name: 'Fiber', amount: fiberAmount, unit: 'g', score: fiber, targetText: '≥1.4 g' } : null,
      ...microRows,
      ...limitRows
    ].filter(Boolean);

    const expected = [
      'fat', 'saturated-fat', 'carbohydrates', 'fiber', 'sugars', 'added-sugars',
      'proteins', 'sodium', 'vitamin-d', 'calcium', 'iron', 'potassium'
    ];
    let present = 1; // energy
    for (const id of expected) {
      if (id === 'sodium') {
        if (hasNutrient(n, 'sodium') || hasNutrient(n, 'salt')) present++;
      } else if (id === 'added-sugars') {
        if (hasNutrient(n, 'added-sugars') || hasNutrient(n, 'added-sugar')) present++;
      } else if (hasNutrient(n, id)) present++;
    }
    const coverage = present / (expected.length + 1);

    return {
      score: round1(score),
      components: { macro: round1(macro), micro: round1(micro), fiber: round1(fiber), limits: round1(limits) },
      normalized,
      macroDist,
      microRows,
      limitRows,
      coverage,
      kcal100g,
      note: microRows.length ? `Micronutrient adequacy uses ${microRows.length} reported nutrient${microRows.length === 1 ? '' : 's'}; unreported nutrients are not treated as zero.` : 'No micronutrients were reported; the micronutrient component uses a neutral 50-point placeholder and lowers confidence.'
    };
  }

  function healthIndex(purity, balance) {
    if (purity <= 0 || balance <= 0) return 0;
    return round1((2 * purity * balance) / (purity + balance));
  }

  function confidenceLabel(value) {
    if (value >= 0.85) return 'High';
    if (value >= 0.65) return 'Moderate';
    return 'Low';
  }

  function indexRating(score) {
    if (score >= 90) return 'Exceptional';
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Strong';
    if (score >= 60) return 'Fair';
    if (score >= 45) return 'Weak';
    if (score >= 25) return 'Poor';
    return 'Very poor';
  }

  function scoreProduct(product) {
    const purity = scorePurity(product?.ingredients_text || '');
    const balance = scoreBalance(product);
    const index = healthIndex(purity.score, balance.score);
    const confidence = 0.5 * purity.knownWeightShare + 0.5 * balance.coverage;
    const noxiousCount = purity.counts.noxious || 0;
    const questionableCount = purity.counts.questionable || 0;
    const unknownCount = purity.counts.unknown || 0;

    return {
      purity,
      balance,
      index,
      rating: indexRating(index),
      confidence,
      confidenceLabel: confidenceLabel(confidence),
      flags: { noxiousCount, questionableCount, unknownCount }
    };
  }

  return { scoreProduct, scorePurity, scoreBalance, healthIndex, splitTopLevelIngredients };
})();
