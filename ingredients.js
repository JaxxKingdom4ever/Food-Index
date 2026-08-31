/*
  Starter ingredient knowledge base for Food Index v0.1.
  This is deliberately conservative and editable. Unknown ingredients use a
  neutral placeholder in the numeric score and reduce confidence.
*/
window.FOOD_INDEX_INGREDIENTS = (() => {
  const Q = {
    wholesome: 1.0,
    neutral: 2 / 3,
    questionable: 1 / 3,
    noxious: 0,
    unknown: 2 / 3
  };

  const rules = [
    // Noxious: intentionally tiny category. Mostly obsolete/prohibited food uses.
    { category: 'noxious', match: /\bbrominated vegetable oil\b|\bbvo\b/i, reason: 'Historically used beverage additive whose U.S. food authorization was revoked.' },
    { category: 'noxious', match: /\bpartially hydrogenated (?:oil|oils|vegetable oil|soybean oil|cottonseed oil)\b/i, reason: 'Industrial trans-fat source; partially hydrogenated oils are no longer generally recognized as safe in U.S. foods.' },

    // Questionable: minimize / dose-dependent / actively debated / highly refined discretionary sources.
    { category: 'questionable', match: /\bpotassium bromate\b/i, reason: 'Food additive with enough concern to justify minimizing in this model.' },
    { category: 'questionable', match: /\b(?:bha|butylated hydroxyanisole)\b|\b(?:bht|butylated hydroxytoluene)\b/i, reason: 'Preservative placed in the model’s research/minimize category.' },
    { category: 'questionable', match: /\bred\s*(?:no\.?\s*)?3\b|\berythrosine\b/i, reason: 'Color additive being phased out of U.S. food use.' },
    { category: 'questionable', match: /\b(?:red\s*40|yellow\s*5|yellow\s*6|blue\s*1|blue\s*2|green\s*3)\b/i, reason: 'Synthetic color additive; treated as optional/minimize rather than inherently toxic.' },
    { category: 'questionable', match: /\btitanium dioxide\b/i, reason: 'Permitted color additive with differing international assessments; minimize category.' },
    { category: 'questionable', match: /\bsodium nitrite\b|\bsodium nitrate\b|\bpotassium nitrite\b|\bpotassium nitrate\b/i, reason: 'Curing agent whose health impact depends strongly on dose and food context.' },
    { category: 'questionable', match: /\bmaltodextrin\b/i, reason: 'Highly refined rapidly digestible carbohydrate; not inherently toxic, but easy to minimize.' },
    { category: 'questionable', match: /\bhigh[- ]fructose corn syrup\b|\bcorn syrup solids\b/i, reason: 'Concentrated added-sugar/refined-carbohydrate source.' },
    { category: 'questionable', match: /\b(?:cane sugar|sugar|brown sugar|invert sugar|dextrose|glucose syrup|corn syrup|rice syrup|agave syrup|fructose|sucrose)\b/i, reason: 'Added/refined sugar source; nutritional impact is dose-dependent.' },

    // Wholesome: recognizable whole/minimally processed foods with useful nutrition.
    { category: 'wholesome', match: /\bwhole(?: grain)? (?:oats?|wheat|rye|barley|corn|rice|quinoa|sorghum|millet)\b|\brolled oats?\b|\bsteel[- ]cut oats?\b/i, reason: 'Whole-grain ingredient.' },
    { category: 'wholesome', match: /\b(?:oats?|quinoa|barley|buckwheat|millet)\b/i, reason: 'Nutrient-dense grain ingredient.' },
    { category: 'wholesome', match: /\b(?:black beans?|kidney beans?|pinto beans?|chickpeas?|garbanzo beans?|lentils?|peas?)\b/i, reason: 'Legume with fiber, protein, and micronutrients.' },
    { category: 'wholesome', match: /\b(?:almonds?|walnuts?|pecans?|pistachios?|cashews?|hazelnuts?|peanuts?|chia seeds?|flax(?:seed)?s?|pumpkin seeds?|sunflower seeds?|sesame seeds?)\b/i, reason: 'Whole nut or seed ingredient.' },
    { category: 'wholesome', match: /\b(?:blueberries?|strawberries?|raspberries?|blackberries?|apples?|bananas?|oranges?|lemons?|limes?|mango(?:es)?|peaches?|pears?|cherries?|grapes?|raisins?|dates?)\b/i, reason: 'Fruit ingredient.' },
    { category: 'wholesome', match: /\b(?:tomatoes?|onions?|garlic|spinach|kale|broccoli|carrots?|peppers?|sweet potatoes?|potatoes?|dried potatoes|pumpkin|squash|cauliflower|cabbage)\b/i, reason: 'Vegetable ingredient.' },
    { category: 'wholesome', match: /\b(?:cocoa|cacao)\b/i, reason: 'Plant-derived ingredient with useful micronutrients/polyphenols when not dominated by added sugar.' },
    { category: 'wholesome', match: /\b(?:cinnamon|turmeric|ginger|oregano|basil|parsley|paprika|rosemary|thyme|cumin|coriander|black pepper|spices?)\b/i, reason: 'Herb or spice; wholesome but usually low-weight on labels.' },
    { category: 'wholesome', match: /\b(?:milk|whole milk|skim milk|nonfat milk|yogurt|egg|eggs)\b/i, reason: 'Whole/basic food ingredient with meaningful nutrition.' },

    // Neutral: safe/ordinary functional or refined ingredients; neither rewarded nor targeted for avoidance.
    { category: 'neutral', match: /\bwater\b/i, reason: 'Nutritionally neutral.' },
    { category: 'neutral', match: /\b(?:vegetable oil|canola oil|soybean oil|sunflower oil|safflower oil|corn oil|cottonseed oil|olive oil|coconut oil|palm oil|avocado oil)\b/i, reason: 'Dietary fat source; health effect depends on type and overall dose, handled mainly by nutrition scoring.' },
    { category: 'neutral', match: /\b(?:cornstarch|corn starch|rice flour|wheat flour|corn flour|rice starch|wheat starch|potato starch|tapioca starch|modified food starch|modified corn starch)\b/i, reason: 'Refined starch/flour; little reason to seek out, but not inherently concerning.' },
    { category: 'neutral', match: /\b(?:salt|sea salt|sodium chloride)\b/i, reason: 'Ordinary mineral seasoning; dose is handled by sodium scoring.' },
    { category: 'neutral', match: /\b(?:citric acid|lactic acid|malic acid|acetic acid|ascorbic acid|calcium citrate|sodium citrate)\b/i, reason: 'Common food acid or salt with established functional use.' },
    { category: 'neutral', match: /\b(?:lecithin|soy lecithin|sunflower lecithin|mono(?:-| )?and(?:-| )?diglycerides|monoglycerides|diglycerides)\b/i, reason: 'Common emulsifier; treated as neutral in this model.' },
    { category: 'neutral', match: /\b(?:xanthan gum|guar gum|gellan gum|locust bean gum|carrageenan|cellulose gum|pectin)\b/i, reason: 'Texture/stabilizing ingredient; neutral by default in this model.' },
    { category: 'neutral', match: /\b(?:monosodium glutamate|msg|disodium inosinate|disodium guanylate|yeast extract)\b/i, reason: 'Flavor-enhancing ingredient; not treated as inherently harmful.' },
    { category: 'neutral', match: /\b(?:natural flavors?|artificial flavors?|natural and artificial flavors?|flavoring|flavouring)\b/i, reason: 'Flavor system; opaque but not automatically classified as harmful.' },
    { category: 'neutral', match: /\b(?:baking soda|sodium bicarbonate|baking powder|calcium carbonate|calcium phosphate|potassium chloride)\b/i, reason: 'Common functional/mineral food ingredient.' },
    { category: 'neutral', match: /\b(?:whey|whey powder|milk solids|nonfat milk|buttermilk|cheddar cheese|cheese cultures?|enzymes?)\b/i, reason: 'Common dairy/processing ingredient; generally neutral at ingredient-list level.' }
  ];

  function cleanName(name) {
    return String(name || '')
      .replace(/[_*]/g, '')
      .replace(/^\s*(?:and\s+)?(?:less than|contains)?\s*\d+(?:\.\d+)?%\s*(?:or less)?\s*(?:of)?\s*[:\-]?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function classify(name) {
    const clean = cleanName(name);
    for (const rule of rules) {
      if (rule.match.test(clean)) {
        return { category: rule.category, quality: Q[rule.category], reason: rule.reason, known: true };
      }
    }
    return {
      category: 'unknown',
      quality: Q.unknown,
      reason: 'Not yet classified. v0.1 uses a neutral placeholder and lowers confidence.',
      known: false
    };
  }

  return { Q, classify, cleanName };
})();
