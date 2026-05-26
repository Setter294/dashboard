/* ==========================================================
   APP — dashboard logic
   ========================================================== */
(function () {
  const DATA = window.DATA;
  const I18N = window.I18N;
  const FOUNDED = window.FOUNDED;
  const S = window.STATS;
  const C = window.CHARTS_A;

  const BIGTECH = ['Amazon', 'Microsoft', 'Apple', 'Alphabet', 'Meta', 'NVIDIA'];

  // ====== STATE ======
  const allCompanies = [...new Set(DATA.map(d => d.company))].sort();
  const yearMin = Math.min(...DATA.map(d => d.year));
  const yearMax = Math.max(...DATA.map(d => d.year));

  // Pre-compute macro (PIB, desempleo) by year — they're US-wide and constant across companies
  const macroByYear = {};
  DATA.forEach(r => {
    if (!macroByYear[r.year]) {
      macroByYear[r.year] = {
        gdp: r.gdp_growth_us_pct,
        unemp: r.unemployment_rate_us_pct,
      };
    }
  });

  const state = {
    lang: localStorage.getItem('var-a-lang') || 'es',
    theme: localStorage.getItem('var-a-theme') || 'dark',
    selected: new Set(allCompanies),
    range: [yearMin, yearMax],
    showContext: true,
    cmpA: 'Amazon',
    cmpB: 'Microsoft',
    cmpMode: 'radar',
    sidebarOpen: false,
    // Predictive
    predTarget: 'net_change',
    predFeatures: new Set(['gdp_growth_us_pct', 'unemployment_rate_us_pct', 'revenue_billions_usd']),
    predLag: 0,
  };

  // ====== HELPERS ======
  const fmtInt = (n) => new Intl.NumberFormat(I18N[state.lang].nf).format(Math.round(n));
  const fmtFloat = (n, d = 2) => new Intl.NumberFormat(I18N[state.lang].nf, { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const fmtPct = (n) => fmtFloat(n, 2) + '%';
  const fmtSigned = (n) => (n >= 0 ? '+' : '') + fmtInt(n);
  const fmtSci = (n) => {
    if (!isFinite(n)) return '—';
    if (Math.abs(n) >= 1000 || (Math.abs(n) > 0 && Math.abs(n) < 0.01)) {
      return n.toExponential(2);
    }
    return fmtFloat(n, 3);
  };

  function getCategoryForCompany(c) {
    const rows = DATA.filter(d => d.company === c);
    return rows[rows.length - 1].categoria;
  }
  function filtered() {
    return DATA.filter(d =>
      state.selected.has(d.company) &&
      d.year >= state.range[0] && d.year <= state.range[1]
    );
  }
  function avg(arr) {
    const f = arr.filter(x => isFinite(x));
    return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
  }
  function stddev(arr) {
    const f = arr.filter(x => isFinite(x));
    if (f.length < 2) return 0;
    const m = avg(f);
    return Math.sqrt(f.reduce((s, x) => s + (x - m) ** 2, 0) / (f.length - 1));
  }

  // ====== T (i18n) ======
  let t = I18N[state.lang];
  function applyI18n() {
    t = I18N[state.lang];
    document.documentElement.lang = state.lang === 'ca' ? 'ca' : 'es';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (t[key] != null) el.textContent = t[key];
    });
    document.querySelectorAll('[data-lang-set]').forEach(b => b.classList.toggle('active', b.dataset.langSet === state.lang));
    document.querySelectorAll('[data-theme-set]').forEach(b => b.classList.toggle('active', b.dataset.themeSet === state.theme));
    // attach a `lang` field for charts that need it
    t.lang = state.lang;
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    localStorage.setItem('var-a-theme', state.theme);
  }

  // ====== SIDEBAR build ======
  function buildCompanyList() {
    const root = document.getElementById('company-list');
    root.innerHTML = '';
    allCompanies.forEach(c => {
      const cat = getCategoryForCompany(c);
      const id = 'co-' + c.replace(/\W+/g, '_');
      const row = document.createElement('label');
      row.className = 'company-item';
      const catLabel = t[cat.toLowerCase()] || cat;
      row.innerHTML = `
        <input type="checkbox" id="${id}" ${state.selected.has(c) ? 'checked' : ''}/>
        <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis;">${c}</span>
        <span class="company-cat ${cat.toLowerCase()}">${catLabel}</span>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        e.target.checked ? state.selected.add(c) : state.selected.delete(c);
        renderAll();
      });
      root.appendChild(row);
    });
  }

  function refreshCompanyChecks() {
    allCompanies.forEach(c => {
      const id = 'co-' + c.replace(/\W+/g, '_');
      const el = document.getElementById(id);
      if (el) el.checked = state.selected.has(c);
    });
  }

  function setupRange() {
    const a = document.getElementById('year-min');
    const b = document.getElementById('year-max');
    a.min = yearMin; a.max = yearMax; a.value = state.range[0];
    b.min = yearMin; b.max = yearMax; b.value = state.range[1];
    a.addEventListener('input', () => {
      let v = Math.min(+a.value, +b.value);
      state.range[0] = v;
      a.value = v;
      updateRangeLabels();
      renderAll();
    });
    b.addEventListener('input', () => {
      let v = Math.max(+b.value, +a.value);
      state.range[1] = v;
      b.value = v;
      updateRangeLabels();
      renderAll();
    });
    updateRangeLabels();
  }
  function updateRangeLabels() {
    document.getElementById('yr-min-v').textContent = state.range[0];
    document.getElementById('yr-max-v').textContent = state.range[1];
  }

  function setupPresets() {
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.preset;
        if (p === 'all') state.selected = new Set(allCompanies);
        else if (p === 'none') state.selected = new Set();
        else if (p === 'bigtech') state.selected = new Set(BIGTECH);
        else state.selected = new Set(allCompanies.filter(c => getCategoryForCompany(c).toLowerCase() === p));
        refreshCompanyChecks();
        renderAll();
      });
    });
  }

  function setupCtxToggle() {
    const el = document.getElementById('ctx-toggle');
    el.classList.toggle('on', state.showContext);
    el.addEventListener('click', () => {
      state.showContext = !state.showContext;
      el.classList.toggle('on', state.showContext);
      renderAll();
    });
  }

  function setupLangTheme() {
    document.querySelectorAll('[data-lang-set]').forEach(b => {
      b.addEventListener('click', () => {
        state.lang = b.dataset.langSet;
        localStorage.setItem('var-a-lang', state.lang);
        applyI18n();
        buildCompanyList();
        rebuildPredictiveControls();
        renderAll();
      });
    });
    document.querySelectorAll('[data-theme-set]').forEach(b => {
      b.addEventListener('click', () => {
        state.theme = b.dataset.themeSet;
        applyTheme();
        applyI18n();
        renderAll();
      });
    });
  }

  function setupCompare() {
    const a = document.getElementById('cmp-a');
    const b = document.getElementById('cmp-b');
    [a, b].forEach(sel => {
      sel.innerHTML = allCompanies.map(c => `<option value="${c}">${c}</option>`).join('');
    });
    a.value = state.cmpA; b.value = state.cmpB;
    a.addEventListener('change', () => { state.cmpA = a.value; renderCompare(); });
    b.addEventListener('change', () => { state.cmpB = b.value; renderCompare(); });
    document.querySelectorAll('[data-cmpmode]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.cmpMode = btn.dataset.cmpmode;
        document.querySelectorAll('[data-cmpmode]').forEach(b => b.classList.toggle('active', b.dataset.cmpmode === state.cmpMode));
        renderCompare();
      });
    });
  }

  // ====== MOBILE SIDEBAR DRAWER ======
  function setupSidebarDrawer() {
    const btn = document.getElementById('filters-btn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const close = document.getElementById('sidebar-close');
    if (!sidebar) return;

    function open() {
      state.sidebarOpen = true;
      sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('show');
    }
    function shut() {
      state.sidebarOpen = false;
      sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('show');
    }
    if (btn) btn.addEventListener('click', () => state.sidebarOpen ? shut() : open());
    if (backdrop) backdrop.addEventListener('click', shut);
    if (close) close.addEventListener('click', shut);
  }

  // ====================================================================
  // RENDER — KPIs
  // ====================================================================
  function renderKPIs() {
    const f = filtered();
    const totalLayoffs = f.reduce((s, r) => s + r.layoffs, 0);
    const totalHires = f.reduce((s, r) => s + r.new_hires, 0);
    const netChange = f.reduce((s, r) => s + r.net_change, 0);
    const hireRate = f.length ? f.reduce((s, r) => s + (r.hiring_rate_pct || 0), 0) / f.length : 0;
    const recordRev = f.length ? Math.max(...f.map(r => r.revenue_billions_usd || 0)) : 0;

    const byCo = {};
    f.forEach(r => byCo[r.company] = (byCo[r.company] || 0) + r.net_change);
    const topCo = Object.entries(byCo).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
    const peakYear = (() => {
      const byY = {}; f.forEach(r => byY[r.year] = (byY[r.year] || 0) + r.layoffs);
      const ent = Object.entries(byY).sort((a, b) => b[1] - a[1])[0];
      return ent ? ent[0] : '—';
    })();

    const ncByYear = {}; f.forEach(r => ncByYear[r.year] = (ncByYear[r.year] || 0) + r.net_change);
    const years = Object.keys(ncByYear).map(Number).sort((a, b) => a - b);
    let deltaStr = '';
    if (years.length >= 2) {
      const last = years[years.length - 1], prev = years[years.length - 2];
      const d = ncByYear[last] - ncByYear[prev];
      deltaStr = `${fmtSigned(d)} (${prev}→${last})`;
    }

    const items = [
      { label: t.kpi_net, value: fmtSigned(netChange), delta: deltaStr, dir: netChange >= 0 ? 'pos' : 'neg' },
      { label: t.kpi_layoffs, value: fmtInt(totalLayoffs), delta: t.kpi_peakYear + ': ' + peakYear },
      { label: t.kpi_hireRate, value: fmtPct(hireRate), delta: t.kpi_hires + ': ' + fmtInt(totalHires) },
      { label: t.kpi_topGrowth, value: topCo[0], delta: fmtSigned(topCo[1]) + ' · max ' + fmtFloat(recordRev, 1) + 'B$', dir: topCo[1] >= 0 ? 'pos' : 'neg' },
    ];
    document.getElementById('kpis').innerHTML = items.map(it => `
      <div class="kpi">
        <div class="kpi-label">${it.label}</div>
        <div class="kpi-value">${it.value}</div>
        <div class="kpi-delta ${it.dir || ''}">${it.delta || ''}</div>
      </div>
    `).join('');
  }

  // ====================================================================
  // RENDER — NARRATIVE
  // ====================================================================
  function renderNarrative() {
    const root = document.getElementById('narrative');
    const crises = [
      { key: 'dotcom', i: 2001, f: 2003, color: 'var(--accent)' },
      { key: '2008', i: 2008, f: 2010, color: 'var(--neg)' },
      { key: 'covid', i: 2020, f: 2021, color: 'var(--pos)' },
      { key: 'post', i: 2022, f: 2024, color: 'var(--blue)' },
    ];
    root.innerHTML = '';
    crises.forEach((c, i) => {
      const sub = filtered().filter(r => r.year >= c.i && r.year <= c.f);
      const hires = sub.reduce((s, r) => s + r.new_hires, 0);
      const lays = sub.reduce((s, r) => s + r.layoffs, 0);
      const net = sub.reduce((s, r) => s + r.net_change, 0);
      const card = document.createElement('div');
      card.className = 'crisis-card';
      card.style.borderLeftColor = c.color;
      card.innerHTML = `
        <div>
          <div class="crisis-years">${t['crisis_' + c.key + '_years']}</div>
          <h3>${t['crisis_' + c.key]}</h3>
          <p>${t['crisis_' + c.key + '_body']}</p>
          <div class="crisis-stats">
            <div class="crisis-stat"><div class="v ${net >= 0 ? 'pos' : 'neg'}">${fmtSigned(net)}</div><div class="l">${t.kpi_net}</div></div>
            <div class="crisis-stat"><div class="v">${fmtInt(hires)}</div><div class="l">${t.kpi_hires}</div></div>
            <div class="crisis-stat"><div class="v">${fmtInt(lays)}</div><div class="l">${t.kpi_layoffs}</div></div>
          </div>
        </div>
        <div class="crisis-chart" id="crisis-${i}"></div>
      `;
      root.appendChild(card);
      C.renderCrisisChart(card.querySelector('.crisis-chart'), filtered(), [c.i, c.f], t);
    });
  }

  // ====================================================================
  // RENDER — EVOLUTION (§02)
  // ====================================================================
  function annualAgg(rows) {
    const byY = {};
    rows.forEach(r => {
      byY[r.year] = byY[r.year] || { year: r.year, hires: 0, layoffs: 0, net: 0 };
      byY[r.year].hires += r.new_hires;
      byY[r.year].layoffs += r.layoffs;
      byY[r.year].net += r.net_change;
    });
    return Object.values(byY).sort((a, b) => a.year - b.year);
  }
  function renderEvolution() {
    const f = filtered();
    const anual = annualAgg(f);
    C.renderNetChange(document.getElementById('ch-netchange'), anual, state.range, state.showContext, t);
    C.renderHiresLayoffs(document.getElementById('ch-hires-layoffs'), anual, state.range, state.showContext, t);
  }

  // ====================================================================
  // RENDER — §02b GDP vs hiring
  // ====================================================================
  function renderGdp() {
    const f = filtered();
    const model = C.renderGdpScatter(document.getElementById('ch-gdp-scatter'), f, t);
    const gridEl = document.getElementById('gdp-verdict-grid');
    const badgeEl = document.getElementById('gdp-verdict-badge');
    const explainEl = document.getElementById('gdp-verdict-explain');
    if (!gridEl) return;
    if (!model || !isFinite(model.slopeP)) {
      gridEl.innerHTML = '';
      if (badgeEl) badgeEl.innerHTML = '';
      if (explainEl) explainEl.textContent = '';
      return;
    }
    const sig = model.slopeP < 0.05;
    const r = (model.slope >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, model.r2));
    const tiles = [
      { l: 'R',           v: fmtFloat(r, 3) },
      { l: 'R²',         v: fmtFloat(model.r2, 3) },
      { l: t.slope,        v: fmtFloat(model.slope, 3) },
      { l: t.pValue,       v: fmtFloat(model.slopeP, 3) },
      { l: 'N',            v: fmtInt(model.n) },
    ];
    gridEl.innerHTML = tiles.map(it => `
      <div class="verdict-tile">
        <div class="l">${it.l}</div>
        <div class="v">${it.v}</div>
      </div>
    `).join('');
    if (badgeEl) {
      let cls = 'nosig', label = t.verdict_nosig;
      if (sig && model.slope >= 0) { cls = 'sig'; label = t.verdict_sig_pos; }
      else if (sig && model.slope < 0) { cls = 'neg'; label = t.verdict_sig_neg; }
      badgeEl.className = 'verdict-badge ' + cls;
      badgeEl.textContent = label;
    }
    if (explainEl) {
      let exp = t.gdp_explain_nosig;
      if (sig && model.slope >= 0) exp = t.gdp_explain_pos;
      else if (sig && model.slope < 0) exp = t.gdp_explain_neg;
      explainEl.textContent = exp;
    }
  }

  // ====================================================================
  // RENDER — §03 PRODUCTIVIDAD
  // ====================================================================
  function renderProductivity() {
    C.renderProductivity(
      document.getElementById('ch-productivity'),
      filtered(), state.range, state.showContext,
      [...state.selected], t,
    );
  }

  // ====================================================================
  // RENDER — §04 BOXPLOT / §05 HEATMAP
  // ====================================================================
  function renderBoxplot() {
    C.renderBoxplot(document.getElementById('ch-boxplot'), filtered(), t);
  }
  function renderHeatmap() {
    C.renderHeatmap(document.getElementById('ch-heatmap'), filtered(), t);
  }
  function renderInsight() {
    document.getElementById('insight').innerHTML =
      `<b>${t.insightTitle}.</b> ` + (state.lang === 'ca'
        ? "Amazon domina el creixement absolut a 2010–2021. Les crisis de 2001 i 2008 colpegen sobretot empreses madures (Intel, AMD, Oracle); l'ajust de 2022–2023 és el més transversal de tot el període."
        : "Amazon domina el crecimiento absoluto en 2010–2021. Las crisis de 2001 y 2008 golpean sobre todo a empresas maduras (Intel, AMD, Oracle); el ajuste de 2022–2023 es el más transversal de todo el periodo.");
  }

  // ====================================================================
  // RENDER — §06 hiring vs unemployment
  // ====================================================================
  function renderHiringUnemp() {
    const f = filtered();
    const model = C.renderHiringVsUnemploy(document.getElementById('ch-hu-scatter'), f, t);
    const verdict = document.getElementById('hu-verdict');
    if (!model || !isFinite(model.slopeP)) { verdict.innerHTML = ''; return; }
    const sig = model.slopeP < 0.05;
    const badge = sig
      ? (model.slope >= 0
          ? `<span class="badge sig">${t.verdict_sig_pos}</span>`
          : `<span class="badge neg">${t.verdict_sig_neg}</span>`)
      : `<span class="badge nosig">${t.verdict_nosig}</span>`;
    verdict.innerHTML = `
      ${badge}
      <span class="metric"><b>R²</b> ${model.r2.toFixed(3)}</span>
      <span class="metric"><b>${t.slope}</b> ${fmtFloat(model.slope, 2)}</span>
      <span class="metric"><b>${t.pValue}</b> ${S.fmtP(model.slopeP)} ${S.sigCode(model.slopeP)}</span>
      <span class="metric">${t.n_obs.replace('{n}', model.n)}</span>
    `;
  }

  // ====================================================================
  // RENDER — §07 post-COVID
  // ====================================================================
  function renderPostCovid() {
    // Use ALL companies but filter respects selected set
    C.renderPostCovid(document.getElementById('ch-postcovid'), filtered(), t);
  }

  // ====================================================================
  // RENDER — §08 correl matrix
  // ====================================================================
  function renderCorrel() {
    C.renderCorrelMatrix(document.getElementById('ch-correl'), filtered(), t);
  }

  // ====================================================================
  // RENDER — §09 VOLATILITY ranking
  // ====================================================================
  function renderVolatility() {
    const byCo = {};
    filtered().forEach(r => (byCo[r.company] = byCo[r.company] || []).push(r.net_change));

    const items = Object.entries(byCo)
      .filter(([_, vals]) => vals.length >= 3)
      .map(([co, vals]) => {
        const m = avg(vals);
        const sd = stddev(vals);
        const cv = Math.abs(m) > 1e-9 ? sd / Math.abs(m) : Infinity;
        return { co, mean: m, sd, cv };
      })
      .filter(x => isFinite(x.cv));

    // sort ascending CV
    items.sort((a, b) => a.cv - b.cv);
    const stable = items.slice(0, 5);                  // lowest CV
    const volatile = items.slice(-5).reverse();        // highest CV

    const maxCV = items.length ? items[items.length - 1].cv : 1;

    const render = (id, list, kind) => {
      const root = document.getElementById(id);
      root.innerHTML = list.map((r, i) => {
        const pct = Math.min(100, (r.cv / maxCV) * 100);
        const cls = kind === 'vol' ? 'neg' : 'cool';
        return `
          <div class="rank-row ${cls}">
            <span class="pos">#${i + 1}</span>
            <div>
              <div class="nm">${r.co}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
              <div class="sub">σ = ${fmtInt(r.sd)} · μ = ${fmtSigned(Math.round(r.mean))}</div>
            </div>
            <span class="v">CV ${fmtFloat(r.cv, 2)}</span>
          </div>`;
      }).join('');
    };
    render('rank-top', volatile, 'vol');
    render('rank-bot', stable, 'stable');

    document.getElementById('rank-top-title').textContent = t.rank_least_stable;
    document.getElementById('rank-bot-title').textContent = t.rank_most_stable;
    document.getElementById('rank-top-crumb').textContent = t.rank_volatility_metric_short + ' ↓';
    document.getElementById('rank-bot-crumb').textContent = t.rank_volatility_metric_short + ' ↑';
  }

  // ====================================================================
  // RENDER — §10 COMPARATOR
  // ====================================================================
  function renderCompare() {
    const f = DATA.filter(r => r.year >= state.range[0] && r.year <= state.range[1]);
    if (state.cmpMode === 'radar') {
      C.renderCompareRadar(document.getElementById('ch-compare'), f, state.cmpA, state.cmpB, t);
    } else {
      C.renderCompareLines(document.getElementById('ch-compare'), f, state.cmpA, state.cmpB, t);
    }
    renderCompareStats('cmp-a-stats', state.cmpA);
    renderCompareStats('cmp-b-stats', state.cmpB);
  }
  function renderCompareStats(elId, co) {
    const sub = DATA.filter(r => r.company === co && r.year >= state.range[0] && r.year <= state.range[1]);
    if (!sub.length) { document.getElementById(elId).innerHTML = ''; return; }
    const net = sub.reduce((s, r) => s + r.net_change, 0);
    const avgGrowth = sub.length ? net / sub.length : 0;
    const peakRev = Math.max(...sub.map(r => r.revenue_billions_usd || 0));
    const founded = FOUNDED[co] || '—';
    const avgHire = avg(sub.map(r => r.hiring_rate_pct));
    const avgAttr = avg(sub.map(r => r.attrition_rate_pct));
    const lastRow = sub.slice().sort((a, b) => b.year - a.year)[0];
    const revPerEmp = lastRow && lastRow.employees_end ? (lastRow.revenue_billions_usd * 1000) / lastRow.employees_end : 0;
    document.getElementById(elId).innerHTML = `
      <div class="compare-stat"><div class="l">${t.founded}</div><div class="v">${founded}</div></div>
      <div class="compare-stat"><div class="l">${t.totalNet}</div><div class="v" style="color:${net >= 0 ? 'var(--pos)' : 'var(--neg)'}">${fmtSigned(net)}</div></div>
      <div class="compare-stat"><div class="l">${t.avgGrowth}</div><div class="v">${fmtSigned(Math.round(avgGrowth))}</div></div>
      <div class="compare-stat"><div class="l">${t.peakRev}</div><div class="v">$${fmtFloat(peakRev, 1)}B</div></div>
      <div class="compare-stat"><div class="l">${t.avgHireRate}</div><div class="v">${fmtFloat(avgHire, 1)}%</div></div>
      <div class="compare-stat"><div class="l">${t.avgAttrition}</div><div class="v">${fmtFloat(avgAttr, 1)}%</div></div>
      <div class="compare-stat" style="grid-column: span 2"><div class="l">${t.revPerEmployee}</div><div class="v">$${fmtFloat(revPerEmp, 2)}M</div></div>
    `;
  }

  // ====================================================================
  // RENDER — §11 PREDICTIVE OLS
  // ====================================================================
  const PRED_FEATURES = [
    { k: 'gdp_growth_us_pct', laggable: true },
    { k: 'unemployment_rate_us_pct', laggable: true },
    { k: 'revenue_billions_usd', laggable: false },
    { k: 'year', laggable: false },
  ];

  function predFeatureLabel(k) {
    return ({
      gdp_growth_us_pct: t.var_gdp,
      unemployment_rate_us_pct: t.var_unemp,
      revenue_billions_usd: t.var_revenue,
      year: t.year,
    })[k] || k;
  }

  function rebuildPredictiveControls() {
    // target radio
    const tgtRoot = document.getElementById('pred-target');
    if (tgtRoot) {
      const options = [
        { v: 'net_change', l: t.pred_target_net },
        { v: 'hiring_rate_pct', l: t.pred_target_hire },
      ];
      tgtRoot.innerHTML = options.map(o => `
        <label class="${state.predTarget === o.v ? 'on' : ''}">
          <input type="radio" name="pred-target-radio" value="${o.v}" ${state.predTarget === o.v ? 'checked' : ''}/>
          <span>${o.l}</span>
        </label>
      `).join('');
      tgtRoot.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        state.predTarget = inp.value;
        rebuildPredictiveControls();
        renderPredictive();
      }));
    }
    // predictors
    const predRoot = document.getElementById('pred-features');
    if (predRoot) {
      predRoot.innerHTML = PRED_FEATURES.map(f => `
        <label class="${state.predFeatures.has(f.k) ? 'on' : ''}">
          <input type="checkbox" value="${f.k}" ${state.predFeatures.has(f.k) ? 'checked' : ''}/>
          <span>${predFeatureLabel(f.k)}</span>
        </label>
      `).join('');
      predRoot.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        inp.checked ? state.predFeatures.add(inp.value) : state.predFeatures.delete(inp.value);
        rebuildPredictiveControls();
        renderPredictive();
      }));
    }
    // lag
    const lagRoot = document.getElementById('pred-lag');
    if (lagRoot) {
      lagRoot.innerHTML = [0, 1, 2].map(k =>
        `<button data-lag="${k}" class="${state.predLag === k ? 'on' : ''}">t−${k}</button>`
      ).join('');
      lagRoot.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        state.predLag = +b.dataset.lag;
        rebuildPredictiveControls();
        renderPredictive();
      }));
    }
  }

  function buildPredictiveData() {
    // Each observation: one (company, year) row in the filtered set.
    // Features: predictors in state.predFeatures, with PIB and desempleo lagged.
    // Target: state.predTarget
    const feats = PRED_FEATURES.filter(f => state.predFeatures.has(f.k));
    if (!feats.length) return null;

    const rows = filtered();
    const X = []; const y = []; const meta = [];
    for (const r of rows) {
      const xRow = [1]; // intercept
      let ok = true;
      for (const f of feats) {
        let v;
        if (f.laggable) {
          const macroY = macroByYear[r.year - state.predLag];
          if (!macroY) { ok = false; break; }
          v = f.k === 'gdp_growth_us_pct' ? macroY.gdp : macroY.unemp;
        } else if (f.k === 'year') {
          v = r.year;
        } else {
          v = r[f.k];
        }
        if (v == null || !isFinite(v)) { ok = false; break; }
        xRow.push(v);
      }
      const yv = r[state.predTarget];
      if (!ok || yv == null || !isFinite(yv)) continue;
      X.push(xRow);
      y.push(yv);
      meta.push({ company: r.company, year: r.year });
    }
    return { X, y, feats, meta };
  }

  function renderPredictive() {
    const root = document.getElementById('pred-result');
    if (!root) return;
    const built = buildPredictiveData();
    if (!built) {
      root.innerHTML = `<div class="pred-warn">${t.pred_n_too_small}</div>`;
      Plotly.purge(document.getElementById('ch-predcoef'));
      return;
    }
    const { X, y, feats } = built;
    if (X.length < feats.length + 2) {
      root.innerHTML = `<div class="pred-warn">${t.pred_n_too_small}</div>`;
      Plotly.purge(document.getElementById('ch-predcoef'));
      return;
    }
    const model = S.olsMulti(X, y);
    if (!model || model.error) {
      root.innerHTML = `<div class="pred-warn">${model && model.error ? model.error : '—'}</div>`;
      Plotly.purge(document.getElementById('ch-predcoef'));
      return;
    }

    // Build 2026 prediction xRow
    // For lagged macro vars: use macroByYear[2026 - lag]; fallback to last available.
    const macroSrc = macroByYear[2026 - state.predLag] || macroByYear[yearMax - state.predLag] || macroByYear[yearMax];
    const last = yearMax;
    const lastRevPerCo = {};
    DATA.forEach(r => {
      if (r.year === last) lastRevPerCo[r.company] = r.revenue_billions_usd;
    });
    const meanLastRev = avg(
      [...state.selected].map(c => lastRevPerCo[c]).filter(v => v != null)
    ) || avg(Object.values(lastRevPerCo));

    const xPred = [1];
    feats.forEach(f => {
      if (f.k === 'gdp_growth_us_pct') xPred.push(macroSrc.gdp);
      else if (f.k === 'unemployment_rate_us_pct') xPred.push(macroSrc.unemp);
      else if (f.k === 'revenue_billions_usd') xPred.push(meanLastRev);
      else if (f.k === 'year') xPred.push(2026);
    });
    const pred = S.predictWithCI(model, xPred);

    const names = [t.pred_intercept, ...feats.map(f => predFeatureLabel(f.k))];
    const targetLabel = state.predTarget === 'net_change' ? t.pred_target_net : t.pred_target_hire;
    const unit = state.predTarget === 'net_change' ? '' : '%';

    // Coefficients table
    let rowsHTML = '';
    for (let j = 0; j < model.beta.length; j++) {
      const b = model.beta[j];
      const se = model.se[j];
      const tt = model.t[j];
      const pv = model.p[j];
      const code = S.sigCode(pv);
      rowsHTML += `
        <tr>
          <td>${names[j]}</td>
          <td class="${b >= 0 ? 'pos' : 'neg'}">${fmtSci(b)}</td>
          <td>${fmtSci(se)}</td>
          <td>${fmtFloat(tt, 2)}</td>
          <td>${S.fmtP(pv)} <span class="coef-sig ${code ? '' : 'muted'}">${code}</span></td>
        </tr>
      `;
    }
    const lowR2 = model.r2 < 0.3;

    root.innerHTML = `
      <div class="pred-headline">
        <div class="pred-stat">
          <div class="l">${t.rSquared}</div>
          <div class="v">${fmtFloat(model.r2, 3)}</div>
          <div class="band">${t.pred_n_obs}: ${model.n} · df = ${model.df}</div>
        </div>
        <div class="pred-stat">
          <div class="l">${t.pred_predict_2026}</div>
          <div class="v" style="color:${pred.mean >= 0 ? 'var(--pos)' : 'var(--neg)'}">${state.predTarget === 'net_change' ? fmtSigned(pred.mean) : fmtFloat(pred.mean, 2) + '%'}</div>
          <div class="band">${t.pred_band}: [${state.predTarget === 'net_change' ? fmtSigned(pred.lo) : fmtFloat(pred.lo, 2) + '%'} , ${state.predTarget === 'net_change' ? fmtSigned(pred.hi) : fmtFloat(pred.hi, 2) + '%'}]</div>
        </div>
        <div class="pred-stat">
          <div class="l">${t.pred_target}</div>
          <div class="v" style="font-size:18px; line-height:1.3">${targetLabel}</div>
          <div class="band">lag = t−${state.predLag}</div>
        </div>
      </div>
      <div>
        <h4 style="margin:0 0 8px 0; font: 500 10px/1 var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--text-mute)">${t.pred_coefficients}</h4>
        <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
          <table class="coef-table">
            <thead><tr>
              <th>${t.pred_predictors}</th>
              <th>β</th>
              <th>SE</th>
              <th>t</th>
              <th>${t.pValue}</th>
            </tr></thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
        <div class="sig-codes" style="margin-top:8px">${t.sigCodes}</div>
      </div>
      ${lowR2 ? `<div class="pred-warn">${t.pred_warn_low_r2}</div>` : ''}
    `;

    // Coefficient bar chart (without intercept)
    const showIdx = [];
    for (let j = 1; j < model.beta.length; j++) showIdx.push(j);
    const modelNoIntercept = {
      beta: showIdx.map(j => model.beta[j]),
      se: showIdx.map(j => model.se[j]),
    };
    C.renderPredictiveCoefBars(
      document.getElementById('ch-predcoef'),
      modelNoIntercept,
      showIdx.map(j => names[j]),
      t,
    );
  }

  // ====================================================================
  // RENDER — TABLE
  // ====================================================================
  function renderTable() {
    const f = filtered();
    const cols = [
      { k: 'company', l: t.company, type: 'str' },
      { k: 'year', l: t.year, type: 'int' },
      { k: 'employees_start', l: t.lang === 'ca' ? 'Inici' : 'Inicio', type: 'int' },
      { k: 'employees_end', l: t.lang === 'ca' ? 'Final' : 'Final', type: 'int' },
      { k: 'new_hires', l: t.hires, type: 'int' },
      { k: 'layoffs', l: t.layoffsLbl, type: 'int' },
      { k: 'net_change', l: t.netChange, type: 'signed' },
      { k: 'hiring_rate_pct', l: '% Hire', type: 'pct' },
      { k: 'attrition_rate_pct', l: '% Attrit', type: 'pct' },
      { k: 'revenue_billions_usd', l: '$B', type: 'float' },
      { k: 'categoria', l: t.lang === 'ca' ? 'Categoria' : 'Categoría', type: 'str' },
    ];
    const head = '<thead><tr>' + cols.map(c => `<th>${c.l}</th>`).join('') + '</tr></thead>';
    const rows = f.slice().sort((a, b) => a.company.localeCompare(b.company) || a.year - b.year);
    const body = '<tbody>' + rows.map(r => '<tr>' + cols.map(c => {
      const v = r[c.k];
      if (c.type === 'str') return `<td>${v ?? ''}</td>`;
      if (c.type === 'int') return `<td>${fmtInt(v)}</td>`;
      if (c.type === 'signed') return `<td class="${v >= 0 ? 'pos' : 'neg'}">${fmtSigned(v)}</td>`;
      if (c.type === 'pct') return `<td>${v != null ? fmtFloat(v, 1) + '%' : '—'}</td>`;
      if (c.type === 'float') return `<td>${v != null ? fmtFloat(v, 2) : '—'}</td>`;
      return `<td>${v ?? ''}</td>`;
    }).join('') + '</tr>').join('') + '</tbody>';
    document.getElementById('data-table').innerHTML = head + body;
    document.getElementById('table-count').textContent = fmtInt(rows.length) + ' ' + t.rows;
    document.getElementById('meta-rows').innerHTML = `<b>${fmtInt(rows.length)}</b> ${t.rows} · <b>${state.selected.size}</b> ${state.lang === 'ca' ? 'empreses' : 'empresas'}`;
  }

  function setupDownload() {
    document.getElementById('dl-csv').addEventListener('click', () => {
      const f = filtered();
      const cols = ['company','year','employees_start','employees_end','new_hires','layoffs','net_change','hiring_rate_pct','attrition_rate_pct','revenue_billions_usd','stock_price_change_pct','gdp_growth_us_pct','unemployment_rate_us_pct','categoria','tamanyo','periodo'];
      const csv = [cols.join(',')].concat(f.map(r => cols.map(c => r[c] ?? '').join(','))).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `tech_employment_${state.range[0]}_${state.range[1]}.csv`;
      a.click(); URL.revokeObjectURL(url);
    });
  }

  // ====== MASTER RENDER ======
  function renderAll() {
    renderKPIs();
    renderNarrative();
    renderEvolution();
    renderGdp();
    renderProductivity();
    renderBoxplot();
    renderHeatmap();
    renderInsight();
    renderHiringUnemp();
    renderPostCovid();
    renderVolatility();
    renderCompare();
    renderPredictive();
    renderTable();
  }

  function resizeAllCharts() {
    document.querySelectorAll('.chart, .chart-sm, .chart-tall, .chart-xl, .crisis-chart, .heatmap-inner, .correl-inner').forEach(el => {
      if (el && el._fullLayout) try { Plotly.Plots.resize(el); } catch (e) {}
    });
  }
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeAllCharts();
      // also re-render the ones that adapt their layout (legend position, margins)
      renderEvolution(); renderGdp(); renderProductivity();
      renderHiringUnemp(); renderPostCovid();
      renderBoxplot(); renderHeatmap(); renderCompare(); renderPredictive();
    }, 250);
  });
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'poke-resize') resizeAllCharts();
  });

  // ====== INIT ======
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    applyI18n();
    buildCompanyList();
    setupRange();
    setupPresets();
    setupCtxToggle();
    setupLangTheme();
    setupCompare();
    setupSidebarDrawer();
    setupDownload();
    rebuildPredictiveControls();
    renderAll();
  });
})();
