(() => {
  const S = window.FOOD_INDEX_SCORING;
  const API_BASE = 'https://world.openfoodfacts.org';
  const PRODUCT_FIELDS = [
    'code','product_name','product_name_en','brands','quantity','serving_size','ingredients_text','ingredients_text_en',
    'image_front_url','image_front_small_url','image_front_thumb_url','nutriments','countries_tags'
  ].join(',');

  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];
  const els = {
    searchForm: $('#searchForm'), searchInput: $('#searchInput'), searchStatus: $('#searchStatus'),
    resultsSection: $('#resultsSection'), searchResults: $('#searchResults'), resultsTitle: $('#resultsTitle'),
    scanBtn: $('#scanBtn'), scannerPanel: $('#scannerPanel'), scannerVideo: $('#scannerVideo'),
    scannerStatus: $('#scannerStatus'), closeScannerBtn: $('#closeScannerBtn'), demoBtn: $('#demoBtn'),
    productView: $('#productView'), homeView: $('#homeView'), backBtn: $('#backBtn'),
    productImage: $('#productImage'), productBrand: $('#productBrand'), productName: $('#productName'), productSub: $('#productSub'),
    indexScore: $('#indexScore'), purityScore: $('#purityScore'), balanceScore: $('#balanceScore'), confidenceScore: $('#confidenceScore'),
    scoreSummary: $('#scoreSummary'), macroMetric: $('#macroMetric'), microMetric: $('#microMetric'), fiberMetric: $('#fiberMetric'), limitMetric: $('#limitMetric'),
    flagsBox: $('#flagsBox'), ingredientList: $('#ingredientList'), ingredientLegend: $('#ingredientLegend'), ingredientNote: $('#ingredientNote'),
    nutritionList: $('#nutritionList'), nutritionNote: $('#nutritionNote'), historyList: $('#historyList'), historyEmpty: $('#historyEmpty'), clearHistoryBtn: $('#clearHistoryBtn'),
    installBtn: $('#installBtn')
  };

  let scannerStream = null;
  let scannerActive = false;
  let deferredInstallPrompt = null;
  let lastView = 'homeView';

  function esc(s) {
    return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function fmt(n, digits = 1) {
    if (!Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    return Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : x.toFixed(digits).replace(/\.0$/, '');
  }

  function normalizeProduct(p) {
    if (!p) return p;
    if (!p.product_name && p.product_name_en) p.product_name = p.product_name_en;
    if (!p.ingredients_text && p.ingredients_text_en) p.ingredients_text = p.ingredients_text_en;
    return p;
  }

  function setStatus(text, isError = false) {
    els.searchStatus.textContent = text || '';
    els.searchStatus.classList.toggle('error', !!isError);
  }

  function setView(id) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === id));
    if (id !== 'productView') lastView = id;
    if (id === 'historyView') renderHistory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setTab(tab) {
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  }

  async function lookupBarcode(code) {
    const cleaned = String(code).replace(/\D/g, '');
    if (cleaned.length < 8) throw new Error('That barcode looks too short.');
    setStatus('Looking up barcode…');
    const url = `${API_BASE}/api/v2/product/${encodeURIComponent(cleaned)}.json?fields=${encodeURIComponent(PRODUCT_FIELDS)}`;
    const data = await fetchJson(url);
    if (!data || data.status !== 1 || !data.product) throw new Error('That barcode is not in Open Food Facts yet.');
    openProduct(normalizeProduct(data.product));
    setStatus('');
  }

  async function searchProducts(query) {
    setStatus('Searching Open Food Facts…');
    els.resultsSection.hidden = true;
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '18',
      fields: PRODUCT_FIELDS
    });
    const data = await fetchJson(`${API_BASE}/cgi/search.pl?${params}`);
    const products = (data?.products || []).map(normalizeProduct).filter(p => p.code && p.product_name);
    renderSearchResults(products, query);
    setStatus(products.length ? '' : 'No matches found. Try a shorter product name.');
  }

  function renderSearchResults(products, query) {
    els.resultsTitle.textContent = `Results for “${query}”`;
    els.searchResults.innerHTML = '';
    els.resultsSection.hidden = false;
    if (!products.length) return;
    for (const p of products) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'product-row';
      const image = p.image_front_small_url || p.image_front_thumb_url;
      btn.innerHTML = `
        ${image ? `<img src="${esc(image)}" alt="">` : '<div class="product-thumb-placeholder">FI</div>'}
        <span><strong>${esc(p.product_name)}</strong><small>${esc(p.brands || 'Unknown brand')}${p.quantity ? ` · ${esc(p.quantity)}` : ''}</small></span>
        <span aria-hidden="true">›</span>`;
      btn.addEventListener('click', () => openProduct(p));
      els.searchResults.appendChild(btn);
    }
  }

  function scoreColorClass(score) {
    if (score >= 80) return 'good';
    if (score >= 45) return 'warn';
    return 'bad';
  }

  function openProduct(product) {
    stopScanner();
    const scored = S.scoreProduct(product);
    const name = product.product_name || 'Unnamed product';
    const brand = product.brands || 'Unknown brand';
    els.productBrand.textContent = brand;
    els.productName.textContent = name;
    els.productSub.textContent = [product.quantity, product.serving_size ? `Serving ${product.serving_size}` : null, product.code ? `UPC/EAN ${product.code}` : null].filter(Boolean).join(' · ');

    const image = product.image_front_url || product.image_front_small_url || product.image_front_thumb_url;
    if (image) {
      els.productImage.src = image;
      els.productImage.alt = `${name} package`;
      els.productImage.hidden = false;
    } else {
      els.productImage.hidden = true;
    }

    els.indexScore.textContent = Math.round(scored.index);
    els.purityScore.textContent = Math.round(scored.purity.score);
    els.balanceScore.textContent = Math.round(scored.balance.score);
    els.confidenceScore.textContent = `${scored.confidenceLabel} ${Math.round(scored.confidence * 100)}%`;
    els.scoreSummary.textContent = `${scored.rating} overall: Purity ${Math.round(scored.purity.score)} + Balance ${Math.round(scored.balance.score)} → Index ${Math.round(scored.index)}.`;
    els.macroMetric.textContent = Math.round(scored.balance.components.macro);
    els.microMetric.textContent = Math.round(scored.balance.components.micro);
    els.fiberMetric.textContent = Math.round(scored.balance.components.fiber);
    els.limitMetric.textContent = Math.round(scored.balance.components.limits);

    renderFlags(scored);
    renderIngredients(scored.purity);
    renderNutrition(scored.balance);
    addHistory(product, scored);
    setTab('overview');
    setView('productView');
  }

  function renderFlags(scored) {
    const flags = [];
    if (scored.flags.noxiousCount) flags.push(`<span class="flag bad">⛔ ${scored.flags.noxiousCount} noxious</span>`);
    if (scored.flags.questionableCount) flags.push(`<span class="flag warn">⚠ ${scored.flags.questionableCount} questionable</span>`);
    if (scored.flags.unknownCount) flags.push(`<span class="flag">? ${scored.flags.unknownCount} unclassified</span>`);
    if (!scored.flags.noxiousCount && scored.purity.score >= 85) flags.push('<span class="flag good">🌱 High ingredient purity</span>');
    if (scored.balance.score >= 85) flags.push('<span class="flag good">⚖ Highly balanced</span>');
    if (!flags.length) flags.push('<span class="flag">No special flags</span>');
    els.flagsBox.innerHTML = `<div class="flag-row">${flags.join('')}</div>`;
  }

  function renderIngredients(purity) {
    const counts = purity.counts || {};
    els.ingredientLegend.innerHTML = [
      ['wholesome','Wholesome',counts.wholesome || 0],
      ['neutral','Neutral',counts.neutral || 0],
      ['questionable','Questionable',counts.questionable || 0],
      ['noxious','Noxious',counts.noxious || 0],
      ['unknown','Unclassified',counts.unknown || 0]
    ].map(([cls,label,count]) => `<span class="flag"><span class="class-dot ${cls}" style="margin:0 6px 0 0"></span>${label} ${count}</span>`).join('');

    if (!purity.ingredients.length) {
      els.ingredientList.innerHTML = '<p class="empty-state">No ingredient list available.</p>';
    } else {
      els.ingredientList.innerHTML = purity.ingredients.map(x => `
        <div class="ingredient-item">
          <span class="class-dot ${esc(x.category)}"></span>
          <div><strong>${x.rank}. ${esc(x.name)}</strong><small>${esc(x.category === 'unknown' ? 'Unclassified / neutral placeholder' : x.category)} · ${esc(x.reason)}${x.trace ? ' · Listed at 2% or less' : ''}</small></div>
          <span class="weight-pill">${fmt(x.influence, 1)}% influence</span>
        </div>`).join('');
    }
    els.ingredientNote.textContent = purity.note;
  }

  function renderNutrition(balance) {
    if (!balance.normalized?.length) {
      els.nutritionList.innerHTML = '<p class="empty-state">Not enough nutrition data to normalize this product.</p>';
      els.nutritionNote.textContent = balance.note;
      return;
    }
    els.nutritionList.innerHTML = balance.normalized.map(row => `
      <div class="nutrient-row">
        <span>${esc(row.name)}${row.targetText ? `<small class="muted"> · target ${esc(row.targetText)}</small>` : ''}</span>
        <strong>${fmt(row.amount, row.unit === 'mcg' ? 2 : 1)} ${esc(row.unit)}</strong>
        <span class="nutrient-score">${Number.isFinite(row.score) ? `${Math.round(row.score)}/100` : ''}</span>
      </div>`).join('');
    const macro = balance.macroDist ? ` Macro calories: ${Math.round(balance.macroDist.carbs*100)}% carb / ${Math.round(balance.macroDist.protein*100)}% protein / ${Math.round(balance.macroDist.fat*100)}% fat.` : '';
    els.nutritionNote.textContent = balance.note + macro;
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem('foodIndexHistory') || '[]'); }
    catch { return []; }
  }

  function addHistory(product, scored) {
    const history = getHistory().filter(x => x.code !== product.code);
    history.unshift({
      code: product.code,
      name: product.product_name || 'Unnamed product',
      brand: product.brands || 'Unknown brand',
      image: product.image_front_small_url || product.image_front_thumb_url || '',
      index: scored.index,
      purity: scored.purity.score,
      balance: scored.balance.score,
      at: Date.now()
    });
    localStorage.setItem('foodIndexHistory', JSON.stringify(history.slice(0, 30)));
  }

  function renderHistory() {
    const history = getHistory();
    els.historyList.innerHTML = '';
    els.historyEmpty.hidden = history.length > 0;
    for (const item of history) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'product-row';
      btn.innerHTML = `
        ${item.image ? `<img src="${esc(item.image)}" alt="">` : '<div class="product-thumb-placeholder">FI</div>'}
        <span><strong>${esc(item.name)}</strong><small>${esc(item.brand)} · P ${Math.round(item.purity)} · B ${Math.round(item.balance)}</small></span>
        <span class="row-score">${Math.round(item.index)}</span>`;
      btn.addEventListener('click', async () => {
        try { await lookupBarcode(item.code); } catch (e) { setView('homeView'); setStatus(e.message, true); }
      });
      els.historyList.appendChild(btn);
    }
  }

  async function startScanner() {
    els.scannerPanel.hidden = false;
    els.scannerStatus.textContent = 'Starting camera…';
    if (!('BarcodeDetector' in window)) {
      els.scannerStatus.textContent = 'This browser does not expose BarcodeDetector. Type the UPC in the search box instead.';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      els.scannerStatus.textContent = 'Camera access is unavailable here. Use the manual barcode box.';
      return;
    }
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = ['ean_13','ean_8','upc_a','upc_e'].filter(x => supported.includes(x));
      const detector = new BarcodeDetector({ formats: formats.length ? formats : undefined });
      scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      els.scannerVideo.srcObject = scannerStream;
      await els.scannerVideo.play();
      scannerActive = true;
      els.scannerStatus.textContent = 'Scanning… hold the barcode inside the frame.';
      let lastScan = 0;
      const loop = async time => {
        if (!scannerActive) return;
        if (time - lastScan > 250 && els.scannerVideo.readyState >= 2) {
          lastScan = time;
          try {
            const codes = await detector.detect(els.scannerVideo);
            if (codes?.length) {
              const value = codes[0].rawValue;
              els.scannerStatus.textContent = `Found ${value}`;
              stopScanner();
              els.searchInput.value = value;
              await lookupBarcode(value);
              return;
            }
          } catch (_) {}
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) {
      els.scannerStatus.textContent = `Could not start camera: ${e.message}`;
      stopScanner(false);
    }
  }

  function stopScanner(hide = true) {
    scannerActive = false;
    if (scannerStream) scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
    els.scannerVideo.srcObject = null;
    if (hide) els.scannerPanel.hidden = true;
  }

  function demoProduct() {
    return {
      code: 'demo-001',
      product_name: 'Demo Crunch Cereal',
      brands: 'Food Index Lab',
      quantity: 'Demo data',
      ingredients_text: 'Whole grain oats, almonds, dried blueberries, canola oil, cornstarch, contains 2% or less of: sugar, cinnamon, natural flavor',
      nutriments: {
        'energy-kcal_100g': 400,
        'fat_100g': 10,
        'saturated-fat_100g': 1.5,
        'carbohydrates_100g': 60,
        'fiber_100g': 8,
        'sugars_100g': 8,
        'added-sugars_100g': 3,
        'proteins_100g': 18,
        'sodium_100g': 0.25,
        'calcium_100g': 0.20,
        'calcium_unit': 'g',
        'iron_100g': 0.006,
        'iron_unit': 'g',
        'potassium_100g': 0.65,
        'potassium_unit': 'g',
        'vitamin-d_100g': 0.000004,
        'vitamin-d_unit': 'g'
      }
    };
  }

  els.searchForm.addEventListener('submit', async e => {
    e.preventDefault();
    const q = els.searchInput.value.trim();
    if (!q) return setStatus('Type a product name or barcode.', true);
    try {
      if (/^\d{8,14}$/.test(q.replace(/\s/g, ''))) await lookupBarcode(q);
      else await searchProducts(q);
    } catch (err) {
      setStatus(err.message || 'Lookup failed.', true);
    }
  });

  els.scanBtn.addEventListener('click', startScanner);
  els.closeScannerBtn.addEventListener('click', () => stopScanner());
  els.demoBtn.addEventListener('click', () => openProduct(demoProduct()));
  els.backBtn.addEventListener('click', () => setView(lastView === 'productView' ? 'homeView' : lastView));
  els.clearHistoryBtn.addEventListener('click', () => { localStorage.removeItem('foodIndexHistory'); renderHistory(); });
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => { stopScanner(); setView(btn.dataset.view); }));
  $$('.tab').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    els.installBtn.hidden = false;
  });
  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { els.installBtn.hidden = true; deferredInstallPrompt = null; });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
