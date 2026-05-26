/* ==========================================================
   CHARTS — Plotly renderers
   ========================================================== */
(function () {
  const S = window.STATS;

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const palette = () => ({
    bg: 'rgba(0,0,0,0)',
    text: css('--text'),
    soft: css('--text-soft'),
    mute: css('--text-mute'),
    grid: css('--border-soft'),
    accent: css('--accent'),
    pos: css('--pos'),
    neg: css('--neg'),
    blue: css('--blue'),
    purple: css('--purple'),
  });

  const HISTORICAL = [
    { i: 2001, f: 2003, label: 'Puntocom', color: '#d4a017' },
    { i: 2008, f: 2010, label: 'Crisis 08', color: '#d2503b' },
    { i: 2020, f: 2021, label: 'COVID',    color: '#4daf7c' },
    { i: 2022, f: 2024, label: 'Ajuste',   color: '#a55ec9' },
  ];

  function isMobile() { return window.innerWidth < 720; }

  function baseLayout(extra = {}) {
    const p = palette();
    const mob = isMobile();
    return Object.assign({
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Inter, sans-serif', color: p.text, size: mob ? 11 : 12 },
      margin: mob
        ? { l: 44, r: 10, t: 16, b: 40 }
        : { l: 56, r: 18, t: 12, b: 44 },
      xaxis: {
        gridcolor: p.grid, zerolinecolor: p.grid,
        tickfont: { color: p.soft, family: 'JetBrains Mono, monospace', size: mob ? 9 : 10 },
        title: { font: { color: p.mute, size: mob ? 10 : 11, family: 'JetBrains Mono, monospace' } },
      },
      yaxis: {
        gridcolor: p.grid, zerolinecolor: p.grid,
        tickfont: { color: p.soft, family: 'JetBrains Mono, monospace', size: mob ? 9 : 10 },
        title: { font: { color: p.mute, size: mob ? 10 : 11, family: 'JetBrains Mono, monospace' } },
      },
      hoverlabel: {
        bgcolor: css('--bg-elev-2'),
        bordercolor: css('--border'),
        font: { color: p.text, family: 'JetBrains Mono, monospace', size: 11 },
      },
      legend: mob
        ? { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center', yanchor: 'top', font: { color: p.soft, size: 10 } }
        : { orientation: 'h', y: 1.08, x: 1, xanchor: 'right', font: { color: p.soft, size: 11 } },
    }, extra);
  }

  function addHistoricalShapes(layout, range, mostrar) {
    if (!mostrar) { layout.shapes = (layout.shapes || []).filter(s => !s.__hist); layout.annotations = []; return; }
    const shapes = HISTORICAL
      .filter(h => h.f >= range[0] && h.i <= range[1])
      .map(h => ({
        type: 'rect', xref: 'x', yref: 'paper',
        x0: h.i - 0.5, x1: h.f + 0.5, y0: 0, y1: 1,
        fillcolor: h.color, opacity: 0.10, line: { width: 0 }, layer: 'below',
        __hist: true,
      }));
    layout.shapes = (layout.shapes || []).concat(shapes);
    layout.annotations = HISTORICAL
      .filter(h => h.f >= range[0] && h.i <= range[1])
      .map(h => ({
        xref: 'x', yref: 'paper',
        x: (h.i + h.f) / 2, y: 0.97,
        text: h.label, showarrow: false,
        font: { color: h.color, size: 9, family: 'JetBrains Mono, monospace' },
        bgcolor: 'rgba(0,0,0,0.35)', borderpad: 3,
      }));
  }

  const cfg = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d','select2d','autoScale2d'] };

  // ====================================================================
  // §02 EVOLUCIÓN
  // ====================================================================

  function renderNetChange(el, anual, range, ctx, t) {
    const p = palette();
    const colors = anual.map(r => r.net >= 0 ? p.pos : p.neg);
    const data = [{
      type: 'bar',
      x: anual.map(r => r.year),
      y: anual.map(r => r.net / 1000),
      marker: { color: colors, line: { width: 0 } },
      hovertemplate: `<b>%{x}</b><br>${t.netChange}: %{y:.1f}k<extra></extra>`,
      name: t.netChange,
    }];
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, { title: t.year }),
      yaxis: Object.assign({}, baseLayout().yaxis, { title: `${t.netChange} (k)`, zeroline: true, zerolinecolor: p.mute, zerolinewidth: 1 }),
      bargap: 0.25,
    });
    addHistoricalShapes(layout, range, ctx);
    Plotly.react(el, data, layout, cfg);
  }

  function renderHiresLayoffs(el, anual, range, ctx, t) {
    const p = palette();
    const data = [
      {
        type: 'scatter', mode: 'lines',
        x: anual.map(r => r.year), y: anual.map(r => r.hires / 1000),
        line: { color: p.blue, width: 2.5 },
        fill: 'tozeroy', fillcolor: hexA(p.blue, 0.22),
        name: t.hires,
        hovertemplate: `<b>%{x}</b><br>${t.hires}: %{y:.1f}k<extra></extra>`,
      },
      {
        type: 'scatter', mode: 'lines',
        x: anual.map(r => r.year), y: anual.map(r => r.layoffs / 1000),
        line: { color: p.neg, width: 2.5 },
        fill: 'tozeroy', fillcolor: hexA(p.neg, 0.28),
        name: t.layoffsLbl,
        hovertemplate: `<b>%{x}</b><br>${t.layoffsLbl}: %{y:.1f}k<extra></extra>`,
      },
    ];
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, { title: t.year }),
      yaxis: Object.assign({}, baseLayout().yaxis, { title: `${t.employees} (k)` }),
    });
    addHistoricalShapes(layout, range, ctx);
    Plotly.react(el, data, layout, cfg);
  }

  // ====================================================================
  // §02b ¿EL PIB EXPLICA LAS CONTRATACIONES?
  // ====================================================================

  function renderGdpScatter(el, rows, t) {
    const p = palette();
    // Aggregate by year: 1 punto = 1 año (sum of new_hires)
    const byYear = {};
    rows.forEach(r => {
      const y = r.year;
      if (!byYear[y]) byYear[y] = { year: y, hires: 0, gdp: r.gdp_growth_us_pct };
      byYear[y].hires += r.new_hires;
    });
    const yearsArr = Object.values(byYear).sort((a, b) => a.year - b.year);
    const xs = yearsArr.map(d => d.gdp);
    const ys = yearsArr.map(d => d.hires);
    const labels = yearsArr.map(d => String(d.year));
    const model = S.linReg(xs, ys);

    const data = [
      {
        type: 'scatter', mode: 'markers+text',
        x: xs, y: ys,
        text: labels,
        textposition: 'top center',
        textfont: { color: p.soft, family: 'JetBrains Mono, monospace', size: 10 },
        marker: { color: hexA(p.blue, 0.65), size: 9, line: { width: 1, color: p.blue } },
        hovertemplate: `<b>%{text}</b><br>${t.gdp_x}: %{x:.2f}%<br>${t.gdp_y}: %{y:,}<extra></extra>`,
        name: 'obs',
        showlegend: false,
      },
    ];
    if (isFinite(model.slope)) {
      data.push({
        type: 'scatter', mode: 'lines',
        x: model.line.x, y: model.line.y,
        line: { color: p.accent, width: 2, dash: 'dot' },
        name: `${t.slope} = ${model.slope.toFixed(2)} · R² = ${model.r2.toFixed(3)}`,
        hoverinfo: 'skip',
        showlegend: false,
      });
    }
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, {
        title: t.gdp_x, zeroline: true, zerolinecolor: p.mute,
        tickformat: '.0%', tickprefix: '', ticksuffix: '%',
      }),
      yaxis: Object.assign({}, baseLayout().yaxis, {
        title: t.gdp_y, separatethousands: true,
      }),
    });
    Plotly.react(el, data, layout, cfg);
    // r = sign(slope) * sqrt(R²)
    model.r = (model.slope >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, model.r2));
    return model;
  }

  // ====================================================================
  // §03 INGRESOS POR EMPLEADO (PRODUCTIVIDAD)
  // ====================================================================

  function renderProductivity(el, rows, range, ctx, selectedCompanies, t) {
    const p = palette();
    const colors = [p.accent, p.blue, p.pos, p.neg, p.purple, '#e07b3a', '#5fb2d4'];

    // Compute series per company
    const series = {};
    rows.forEach(r => {
      if (!r.revenue_billions_usd || !r.employees_end) return;
      const mPerEmp = (r.revenue_billions_usd * 1000) / r.employees_end; // M USD / empleado
      (series[r.company] = series[r.company] || []).push({ year: r.year, v: mPerEmp });
    });
    Object.keys(series).forEach(c => series[c].sort((a, b) => a.year - b.year));

    // Pick top 8 companies by latest value to avoid spaghetti
    const cosArr = Object.keys(series);
    const latestVal = (c) => {
      const arr = series[c];
      return arr.length ? arr[arr.length - 1].v : 0;
    };
    cosArr.sort((a, b) => latestVal(b) - latestVal(a));
    const top = cosArr.slice(0, 8);

    // Mean across selected companies per year
    const yearMap = {};
    rows.forEach(r => {
      if (!r.revenue_billions_usd || !r.employees_end) return;
      const v = (r.revenue_billions_usd * 1000) / r.employees_end;
      yearMap[r.year] = yearMap[r.year] || [];
      yearMap[r.year].push(v);
    });
    const meanSeries = Object.keys(yearMap).map(Number).sort((a,b)=>a-b).map(y => ({
      year: y,
      v: yearMap[y].reduce((a, b) => a + b, 0) / yearMap[y].length,
    }));

    const traces = top.map((c, i) => ({
      type: 'scatter', mode: 'lines',
      x: series[c].map(d => d.year),
      y: series[c].map(d => d.v),
      name: c,
      line: { color: colors[i % colors.length], width: 1.5 },
      opacity: 0.85,
      hovertemplate: `<b>${c} · %{x}</b><br>%{y:.2f} M$/${t.lang === 'ca' ? 'empleat' : 'empleado'}<extra></extra>`,
    }));
    traces.push({
      type: 'scatter', mode: 'lines',
      x: meanSeries.map(d => d.year), y: meanSeries.map(d => d.v),
      name: t.productivity_mean,
      line: { color: p.text, width: 3, dash: 'solid' },
      hovertemplate: `<b>${t.productivity_mean}<br>%{x}</b>: %{y:.2f}<extra></extra>`,
    });

    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, { title: t.year }),
      yaxis: Object.assign({}, baseLayout().yaxis, { title: t.productivity_y }),
    });
    addHistoricalShapes(layout, range, ctx);
    Plotly.react(el, traces, layout, cfg);
  }

  // ====================================================================
  // §04 BOXPLOT
  // ====================================================================

  function renderBoxplot(el, rows, t) {
    const p = palette();
    const byCo = {};
    rows.forEach(r => (byCo[r.company] = byCo[r.company] || []).push(r.net_change / 1000));
    const cos = Object.keys(byCo).sort((a, b) => median(byCo[b]) - median(byCo[a]));
    const traces = cos.map(c => ({
      type: 'box', y: byCo[c], name: c,
      boxpoints: 'outliers',
      marker: { color: p.neg, size: 4, outliercolor: p.neg },
      fillcolor: hexA(p.blue, 0.30),
      line: { color: p.blue, width: 1.5 },
      hovertemplate: `<b>${c}</b><br>${t.netChange}: %{y:.2f}k<extra></extra>`,
    }));
    const shapes = cos.map((c, i) => ({
      type: 'line', xref: 'x', yref: 'y',
      x0: i - 0.35, x1: i + 0.35, y0: median(byCo[c]), y1: median(byCo[c]),
      line: { color: p.neg, width: 3 }, layer: 'above',
    }));
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, { tickangle: -45 }),
      yaxis: Object.assign({}, baseLayout().yaxis, { title: `${t.netChange} (k)` }),
      showlegend: false,
      shapes,
      margin: { l: 56, r: 18, t: 12, b: 90 },
    });
    Plotly.react(el, traces, layout, cfg);
  }

  // ====================================================================
  // §05 HEATMAP
  // ====================================================================

  function renderHeatmap(el, rows, t) {
    const p = palette();
    const cos = [...new Set(rows.map(r => r.company))];
    const years = [...new Set(rows.map(r => r.year))].sort((a, b) => a - b);
    const meanByCo = {};
    cos.forEach(c => {
      const vals = rows.filter(r => r.company === c).map(r => r.net_change / 1000);
      meanByCo[c] = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    });
    const ordered = cos.sort((a, b) => meanByCo[b] - meanByCo[a]);
    const z = ordered.map(c => years.map(y => {
      const r = rows.find(r => r.company === c && r.year === y);
      return r ? r.net_change / 1000 : null;
    }));
    const data = [{
      type: 'heatmap', x: years.map(String), y: ordered, z,
      colorscale: [
        [0, p.neg], [0.5, css('--bg-elev')], [1, p.blue],
      ],
      zmin: -10, zmax: 10, zmid: 0,
      hovertemplate: `<b>%{y}</b> · %{x}<br>${t.netChange}: %{z:.2f}k<extra></extra>`,
      xgap: 1, ygap: 1,
      colorbar: {
        thickness: 10, len: 0.85, outlinewidth: 0,
        tickfont: { color: p.soft, family: 'JetBrains Mono, monospace', size: 9 },
        tickvals: [-10, -5, 0, 5, 10],
        ticktext: ['≤-10', '-5', '0', '+5', '≥+10'],
      },
    }];
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, { side: 'bottom' }),
      yaxis: Object.assign({}, baseLayout().yaxis, { autorange: 'reversed' }),
      margin: { l: 110, r: 18, t: 12, b: 44 },
    });
    Plotly.react(el, data, layout, cfg);
  }

  // ====================================================================
  // §06 HIRING RATE vs UNEMPLOYMENT
  // ====================================================================

  function renderHiringVsUnemploy(el, rows, t) {
    const p = palette();
    // Tercile thresholds by employees_end across the filtered rows
    const empSizes = rows.map(r => r.employees_end).filter(Boolean).sort((a, b) => a - b);
    const q1 = empSizes[Math.floor(empSizes.length / 3)] || 0;
    const q2 = empSizes[Math.floor(2 * empSizes.length / 3)] || 0;
    const sizeOf = (e) => e <= q1 ? 'small' : e <= q2 ? 'mid' : 'large';
    const sizeColor = { small: p.purple, mid: p.blue, large: p.accent };
    const sizeLabel = { small: t.sizeSmall, mid: t.sizeMid, large: t.sizeLarge };

    const xs = rows.map(r => r.unemployment_rate_us_pct);
    const ys = rows.map(r => r.hiring_rate_pct);
    const model = S.linReg(xs, ys);

    const grouped = { small: [], mid: [], large: [] };
    rows.forEach(r => {
      const k = sizeOf(r.employees_end);
      grouped[k].push(r);
    });

    const traces = ['large', 'mid', 'small'].map(k => ({
      type: 'scatter', mode: 'markers',
      x: grouped[k].map(r => r.unemployment_rate_us_pct),
      y: grouped[k].map(r => r.hiring_rate_pct),
      name: sizeLabel[k],
      marker: { color: hexA(sizeColor[k], 0.6), size: 7, line: { width: 1, color: sizeColor[k] } },
      text: grouped[k].map(r => `${r.company} · ${r.year}`),
      hovertemplate: `<b>%{text}</b><br>${t.hu_x}: %{x:.1f}%<br>${t.hu_y}: %{y:.1f}%<extra></extra>`,
    }));
    if (isFinite(model.slope)) {
      traces.push({
        type: 'scatter', mode: 'lines',
        x: model.line.x, y: model.line.y,
        line: { color: p.text, width: 2.5, dash: 'solid' },
        name: `${t.slope}=${model.slope.toFixed(2)} · R²=${model.r2.toFixed(3)}`,
        hoverinfo: 'skip',
      });
    }
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, { title: t.hu_x }),
      yaxis: Object.assign({}, baseLayout().yaxis, { title: t.hu_y }),
    });
    Plotly.react(el, traces, layout, cfg);
    return model;
  }

  // ====================================================================
  // §07 POST-COVID OVERHIRE → ADJUSTMENT
  // ====================================================================

  function renderPostCovid(el, rows, t) {
    const p = palette();
    const cos = [...new Set(rows.map(r => r.company))];
    const items = cos.map(c => {
      const boom = rows.filter(r => r.company === c && r.year >= 2020 && r.year <= 2021)
        .reduce((s, r) => s + r.net_change, 0) / 1000;
      const adj = rows.filter(r => r.company === c && r.year >= 2022 && r.year <= 2023)
        .reduce((s, r) => s + r.net_change, 0) / 1000;
      return { co: c, boom, adj };
    }).filter(d => isFinite(d.boom) && isFinite(d.adj) && (d.boom !== 0 || d.adj !== 0));

    // Determine ranges and diagonal
    const all = items.flatMap(d => [d.boom, d.adj]);
    let lo = Math.min(0, ...all);
    let hi = Math.max(0, ...all);
    const pad = (hi - lo) * 0.1 || 1;
    lo -= pad; hi += pad;
    const diagX = [lo, hi], diagY = [-lo, -hi];

    const data = [
      // y = -x diagonal first so it sits below points
      {
        type: 'scatter', mode: 'lines',
        x: diagX, y: diagY,
        line: { color: p.mute, width: 1.5, dash: 'dash' },
        name: t.pc_diag,
        hoverinfo: 'skip',
      },
      {
        type: 'scatter', mode: 'markers+text',
        x: items.map(d => d.boom),
        y: items.map(d => d.adj),
        text: items.map(d => d.co),
        textposition: 'top center',
        textfont: { color: p.soft, family: 'Inter, sans-serif', size: 10 },
        marker: {
          size: items.map(d => Math.max(6, Math.min(28, Math.sqrt(Math.abs(d.boom) + Math.abs(d.adj)) * 3))),
          color: items.map(d => d.adj < 0 && d.boom > 0 ? p.neg : (d.adj > 0 ? p.pos : p.blue)),
          opacity: 0.85,
          line: { width: 1, color: p.text },
        },
        hovertemplate: `<b>%{text}</b><br>${t.pc_x.replace(' (miles)','')}: %{x:.1f}k<br>${t.pc_y.replace(' (miles)','')}: %{y:.1f}k<extra></extra>`,
        showlegend: false,
      },
    ];
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, {
        title: t.pc_x, zeroline: true, zerolinecolor: p.mute, range: [lo, hi],
      }),
      yaxis: Object.assign({}, baseLayout().yaxis, {
        title: t.pc_y, zeroline: true, zerolinecolor: p.mute, range: [lo, hi],
      }),
    });
    Plotly.react(el, data, layout, cfg);
  }

  // ====================================================================
  // §08 CORRELATION MATRIX
  // ====================================================================

  const CORREL_VARS = [
    'net_change', 'new_hires', 'layoffs',
    'hiring_rate_pct', 'attrition_rate_pct',
    'revenue_billions_usd', 'stock_price_change_pct',
    'gdp_growth_us_pct', 'unemployment_rate_us_pct',
    'employees_end',
  ];
  const CORREL_KEYS = {
    net_change: 'var_net', new_hires: 'var_hires', layoffs: 'var_layoffs',
    hiring_rate_pct: 'var_hireRate', attrition_rate_pct: 'var_attrition',
    revenue_billions_usd: 'var_revenue', stock_price_change_pct: 'var_stock',
    gdp_growth_us_pct: 'var_gdp', unemployment_rate_us_pct: 'var_unemp',
    employees_end: 'var_empEnd',
  };

  function renderCorrelMatrix(el, rows, t) {
    const p = palette();
    const vars = CORREL_VARS;
    const labels = vars.map(v => t[CORREL_KEYS[v]] || v);
    const n = vars.length;
    const z = []; const txt = [];
    for (let i = 0; i < n; i++) {
      const rowZ = []; const rowT = [];
      for (let j = 0; j < n; j++) {
        if (j > i) { rowZ.push(null); rowT.push(''); continue; } // upper triangle empty
        const x = rows.map(r => r[vars[i]]);
        const y = rows.map(r => r[vars[j]]);
        const c = S.pearson(x, y).r;
        rowZ.push(isFinite(c) ? c : null);
        rowT.push(isFinite(c) ? c.toFixed(2) : '');
      }
      z.push(rowZ); txt.push(rowT);
    }
    const data = [{
      type: 'heatmap', x: labels, y: labels, z,
      text: txt, texttemplate: '%{text}',
      textfont: { color: p.text, family: 'JetBrains Mono, monospace', size: 11 },
      colorscale: [
        [0, p.neg], [0.5, css('--bg-elev')], [1, p.blue],
      ],
      zmin: -1, zmax: 1, zmid: 0,
      hovertemplate: '<b>%{y}</b> · <b>%{x}</b><br>r = %{z:.3f}<extra></extra>',
      xgap: 2, ygap: 2,
      colorbar: {
        thickness: 10, len: 0.85, outlinewidth: 0,
        tickfont: { color: p.soft, family: 'JetBrains Mono, monospace', size: 9 },
        tickvals: [-1, -0.5, 0, 0.5, 1],
      },
    }];
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, { tickangle: -40 }),
      yaxis: Object.assign({}, baseLayout().yaxis, { autorange: 'reversed' }),
      margin: { l: 110, r: 18, t: 12, b: 90 },
    });
    Plotly.react(el, data, layout, cfg);
  }

  // ====================================================================
  // §10 COMPARATOR — radar / lines
  // ====================================================================

  function renderCompareRadar(el, rows, coA, coB, t) {
    const p = palette();
    // Compute per-company metrics scaled to global percentile so each axis is 0..1
    const cosAll = [...new Set(rows.map(r => r.company))];
    function metricsOf(co) {
      const sub = rows.filter(r => r.company === co);
      if (!sub.length) return null;
      const totalNet = sub.reduce((s, r) => s + r.net_change, 0);
      const avgHire = avg(sub.map(r => r.hiring_rate_pct));
      const avgAttr = avg(sub.map(r => r.attrition_rate_pct));
      const peakRev = Math.max(...sub.map(r => r.revenue_billions_usd || 0));
      const lastRow = sub.slice().sort((a, b) => b.year - a.year)[0];
      const revPerEmp = lastRow && lastRow.employees_end ? (lastRow.revenue_billions_usd * 1000) / lastRow.employees_end : 0;
      return { totalNet, avgHire, avgAttr, peakRev, revPerEmp };
    }
    const all = cosAll.map(c => metricsOf(c)).filter(Boolean);
    function normInverse(key, v) {
      const vals = all.map(m => m[key]).filter(x => isFinite(x));
      if (!vals.length) return 0;
      const lo = Math.min(...vals), hi = Math.max(...vals);
      if (hi === lo) return 0.5;
      return (v - lo) / (hi - lo);
    }
    const ma = metricsOf(coA), mb = metricsOf(coB);
    const axes = [
      { k: 'totalNet', l: t.totalNet },
      { k: 'avgHire', l: t.avgHireRate },
      { k: 'revPerEmp', l: t.revPerEmployee },
      { k: 'peakRev', l: t.peakRev },
      { k: 'avgAttr', l: t.avgAttrition, invert: true },
    ];
    function buildTrace(co, m, color) {
      const r = axes.map(a => {
        let v = normInverse(a.k, m[a.k]);
        if (a.invert) v = 1 - v;
        return v;
      });
      return {
        type: 'scatterpolar',
        r: r.concat([r[0]]),
        theta: axes.map(a => a.l).concat([axes[0].l]),
        fill: 'toself',
        fillcolor: hexA(color, 0.18),
        line: { color, width: 2 },
        name: co,
        hovertemplate: `<b>${co}</b><br>%{theta}: %{r:.2f}<extra></extra>`,
      };
    }
    const data = [];
    if (ma) data.push(buildTrace(coA, ma, p.accent));
    if (mb) data.push(buildTrace(coB, mb, p.blue));

    const layout = baseLayout({
      polar: {
        bgcolor: 'rgba(0,0,0,0)',
        radialaxis: {
          range: [0, 1], gridcolor: p.grid,
          tickfont: { color: p.mute, family: 'JetBrains Mono, monospace', size: 9 },
          showline: false, tickangle: 90,
        },
        angularaxis: {
          gridcolor: p.grid,
          tickfont: { color: p.soft, family: 'Inter, sans-serif', size: 11 },
        },
      },
      margin: { l: 40, r: 40, t: 30, b: 30 },
    });
    delete layout.xaxis; delete layout.yaxis;
    Plotly.react(el, data, layout, cfg);
  }

  function renderCompareLines(el, rows, coA, coB, t) {
    const p = palette();
    const subA = rows.filter(r => r.company === coA).sort((a, b) => a.year - b.year);
    const subB = rows.filter(r => r.company === coB).sort((a, b) => a.year - b.year);
    const data = [
      {
        type: 'scatter', mode: 'lines+markers',
        x: subA.map(r => r.year), y: subA.map(r => r.employees_end / 1000),
        name: coA, line: { color: p.accent, width: 2.5 }, marker: { color: p.accent, size: 5 },
        hovertemplate: `<b>${coA} · %{x}</b><br>${t.employees}: %{y:.1f}k<extra></extra>`,
      },
      {
        type: 'scatter', mode: 'lines+markers',
        x: subB.map(r => r.year), y: subB.map(r => r.employees_end / 1000),
        name: coB, line: { color: p.blue, width: 2.5 }, marker: { color: p.blue, size: 5 },
        hovertemplate: `<b>${coB} · %{x}</b><br>${t.employees}: %{y:.1f}k<extra></extra>`,
      },
    ];
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, { title: t.year }),
      yaxis: Object.assign({}, baseLayout().yaxis, { title: `${t.employees} (k)` }),
    });
    Plotly.react(el, data, layout, cfg);
  }

  // ====================================================================
  // §11 PREDICTIVE MODEL — coefficient bar chart
  // ====================================================================

  function renderPredictiveCoefBars(el, model, names, t) {
    const p = palette();
    const data = [{
      type: 'bar', orientation: 'h',
      x: model.beta, y: names,
      marker: {
        color: model.beta.map(b => b >= 0 ? p.pos : p.neg),
        line: { width: 0 },
      },
      error_x: {
        type: 'data',
        array: model.se.map(s => 1.96 * s),
        thickness: 1.5, width: 4, color: p.text,
      },
      hovertemplate: '<b>%{y}</b><br>β = %{x:.4f}<extra></extra>',
    }];
    const layout = baseLayout({
      xaxis: Object.assign({}, baseLayout().xaxis, { title: 'β', zeroline: true, zerolinecolor: p.text, zerolinewidth: 1 }),
      yaxis: Object.assign({}, baseLayout().yaxis, { automargin: true }),
      margin: { l: 140, r: 30, t: 10, b: 40 },
      showlegend: false,
    });
    Plotly.react(el, data, layout, cfg);
  }

  // ====================================================================
  // CRISIS MICRO CHART
  // ====================================================================

  function renderCrisisChart(el, rows, range, t) {
    const p = palette();
    const sub = rows.filter(r => r.year >= range[0] && r.year <= range[1]);
    const byYear = {};
    sub.forEach(r => {
      const y = r.year;
      byYear[y] = byYear[y] || { hires: 0, layoffs: 0, net: 0 };
      byYear[y].hires += r.new_hires;
      byYear[y].layoffs += r.layoffs;
      byYear[y].net += r.net_change;
    });
    const ys = Object.keys(byYear).map(Number).sort((a,b) => a-b);
    const data = [
      { type: 'bar', x: ys, y: ys.map(y => byYear[y].hires / 1000), name: t.hires, marker: { color: p.blue }, hovertemplate: `<b>%{x}</b><br>${t.hires}: %{y:.1f}k<extra></extra>` },
      { type: 'bar', x: ys, y: ys.map(y => -byYear[y].layoffs / 1000), name: t.layoffsLbl, marker: { color: p.neg }, hovertemplate: `<b>%{x}</b><br>${t.layoffsLbl}: %{y:.1f}k<extra></extra>` },
    ];
    const layout = baseLayout({
      barmode: 'relative',
      xaxis: Object.assign({}, baseLayout().xaxis, { dtick: 1 }),
      yaxis: Object.assign({}, baseLayout().yaxis, { zeroline: true, zerolinecolor: p.mute, title: 'k' }),
      legend: { orientation: 'h', y: 1.12, x: 1, xanchor: 'right', font: { color: p.soft, size: 10 } },
      margin: { l: 40, r: 8, t: 18, b: 28 },
    });
    Plotly.react(el, data, layout, cfg);
  }

  // ====================================================================
  // HELPERS
  // ====================================================================

  function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    const n = a.length;
    if (!n) return 0;
    return n % 2 ? a[(n-1)/2] : (a[n/2-1] + a[n/2]) / 2;
  }
  function avg(arr) {
    const f = arr.filter(x => isFinite(x));
    return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
  }
  function hexA(hex, a) {
    hex = (hex || '').trim();
    if (hex.startsWith('rgb')) return hex.replace('rgb(', 'rgba(').replace(')', `,${a})`);
    if (hex[0] !== '#') return hex;
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  window.CHARTS_A = {
    renderNetChange, renderHiresLayoffs,
    renderGdpScatter, renderProductivity,
    renderBoxplot, renderHeatmap,
    renderHiringVsUnemploy, renderPostCovid, renderCorrelMatrix,
    renderCompareRadar, renderCompareLines,
    renderPredictiveCoefBars,
    renderCrisisChart,
  };
})();
