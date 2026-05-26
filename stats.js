/* ==========================================================
   STATS — Regression engine, OLS, t-tests, correlations
   ==========================================================
   Shared engine used by:
     · §02b ¿El PIB explica las contrataciones? (renderGdpScatter)
     · §06 Hiring rate vs paro (renderHiringVsUnemploy)
     · §08 Matriz de correlaciones (renderCorrelMatrix)
     · §11 Modelo predictivo OLS (renderPredictiveModel)
   ========================================================== */
(function () {

  // ── log gamma via Lanczos ──────────────────────────────────────────────
  function logGamma(z) {
    const g = 7;
    const c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  // ── betacf — continued fraction expansion for incomplete beta ──────────
  function betacf(a, b, x) {
    const MAX_ITER = 200;
    const EPS = 3e-7;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAX_ITER; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  // ── regularised incomplete beta function I_x(a,b) ──────────────────────
  function incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(
      logGamma(a + b) - logGamma(a) - logGamma(b)
      + a * Math.log(x) + b * Math.log(1 - x)
    );
    if (x < (a + 1) / (a + b + 2)) {
      return bt * betacf(a, b, x) / a;
    } else {
      return 1 - bt * betacf(b, a, 1 - x) / b;
    }
  }

  // ── two-sided p-value for Student-t with df degrees of freedom ────────
  function tPValue(t, df) {
    if (!isFinite(t) || df <= 0) return NaN;
    const x = df / (df + t * t);
    return incompleteBeta(x, df / 2, 0.5);
  }

  // ── Pearson correlation ────────────────────────────────────────────────
  function pearson(x, y) {
    const pairs = [];
    for (let i = 0; i < x.length; i++) {
      if (x[i] == null || y[i] == null || isNaN(x[i]) || isNaN(y[i])) continue;
      pairs.push([x[i], y[i]]);
    }
    const n = pairs.length;
    if (n < 3) return { r: NaN, n };
    let sx = 0, sy = 0;
    for (const p of pairs) { sx += p[0]; sy += p[1]; }
    const mx = sx / n, my = sy / n;
    let num = 0, dx = 0, dy = 0;
    for (const p of pairs) {
      const a = p[0] - mx, b = p[1] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    const denom = Math.sqrt(dx * dy);
    return { r: denom > 0 ? num / denom : NaN, n };
  }

  // ── Univariate linear regression with significance test ────────────────
  //   linReg(x[], y[]) → { slope, intercept, r2, n, slopeT, slopeP, df,
  //                        residualSE, line: {x:[xMin,xMax], y:[..]} }
  function linReg(xs, ys) {
    const pairs = [];
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] == null || ys[i] == null || isNaN(xs[i]) || isNaN(ys[i])) continue;
      pairs.push([xs[i], ys[i]]);
    }
    const n = pairs.length;
    if (n < 3) return { n, slope: NaN, intercept: NaN, r2: NaN };
    let sx = 0, sy = 0;
    for (const p of pairs) { sx += p[0]; sy += p[1]; }
    const mx = sx / n, my = sy / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of pairs) {
      const a = p[0] - mx, b = p[1] - my;
      sxx += a * a; sxy += a * b; syy += b * b;
    }
    const slope = sxx > 0 ? sxy / sxx : NaN;
    const intercept = my - slope * mx;

    // residuals
    let ssr = 0;
    for (const p of pairs) {
      const yhat = intercept + slope * p[0];
      const e = p[1] - yhat;
      ssr += e * e;
    }
    const df = n - 2;
    const residualSE = df > 0 ? Math.sqrt(ssr / df) : NaN;
    const r2 = syy > 0 ? 1 - ssr / syy : NaN;
    // SE(slope) = residualSE / sqrt(sxx)
    const slopeSE = sxx > 0 ? residualSE / Math.sqrt(sxx) : NaN;
    const slopeT = slopeSE > 0 ? slope / slopeSE : NaN;
    const slopeP = isFinite(slopeT) ? tPValue(slopeT, df) : NaN;

    const xMin = pairs.reduce((m, p) => Math.min(m, p[0]), Infinity);
    const xMax = pairs.reduce((m, p) => Math.max(m, p[0]), -Infinity);
    return {
      n, slope, intercept, r2, df, residualSE, slopeSE, slopeT, slopeP,
      line: { x: [xMin, xMax], y: [intercept + slope * xMin, intercept + slope * xMax] },
      mx, my, sxx,
    };
  }

  // ── Matrix utilities (small dense, p ≤ ~10) ───────────────────────────
  function matMul(A, B) {
    const m = A.length, n = B[0].length, k = B.length;
    const C = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let i = 0; i < m; i++) {
      for (let l = 0; l < k; l++) {
        const a = A[i][l];
        for (let j = 0; j < n; j++) C[i][j] += a * B[l][j];
      }
    }
    return C;
  }
  function matT(A) {
    const m = A.length, n = A[0].length;
    const T = Array.from({ length: n }, () => new Array(m));
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) T[j][i] = A[i][j];
    return T;
  }
  function matVec(A, v) {
    const m = A.length, n = A[0].length;
    const r = new Array(m).fill(0);
    for (let i = 0; i < m; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += A[i][j] * v[j];
      r[i] = s;
    }
    return r;
  }
  // Gauss-Jordan inversion with partial pivoting
  function matInverse(M) {
    const n = M.length;
    const A = M.map(row => row.slice().concat(
      Array.from({ length: n }, (_, j) => (j === M.indexOf(row) ? 1 : 0))
    ));
    // rewrite augmented matrix manually to be safe
    const aug = [];
    for (let i = 0; i < n; i++) {
      const row = M[i].slice();
      for (let j = 0; j < n; j++) row.push(i === j ? 1 : 0);
      aug.push(row);
    }
    for (let i = 0; i < n; i++) {
      // pivot
      let maxR = i, maxV = Math.abs(aug[i][i]);
      for (let r = i + 1; r < n; r++) {
        if (Math.abs(aug[r][i]) > maxV) { maxV = Math.abs(aug[r][i]); maxR = r; }
      }
      if (maxV < 1e-12) return null; // singular
      if (maxR !== i) { const tmp = aug[i]; aug[i] = aug[maxR]; aug[maxR] = tmp; }
      const piv = aug[i][i];
      for (let j = 0; j < 2 * n; j++) aug[i][j] /= piv;
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const f = aug[r][i];
        if (f === 0) continue;
        for (let j = 0; j < 2 * n; j++) aug[r][j] -= f * aug[i][j];
      }
    }
    const inv = [];
    for (let i = 0; i < n; i++) inv.push(aug[i].slice(n));
    return inv;
  }

  // ── Multivariate OLS by normal equations ─────────────────────────────
  //   olsMulti(X, y)  where X is n×p design matrix (must include intercept col if wanted)
  //   returns { beta, se, t, p, r2, sigma2, n, p, xtxInv }
  function olsMulti(X, y) {
    const n = X.length;
    if (!n) return null;
    const p = X[0].length;
    if (n <= p) return { error: 'Not enough observations' };

    const Xt = matT(X);
    const XtX = matMul(Xt, X);
    const XtXinv = matInverse(XtX);
    if (!XtXinv) return { error: 'Singular' };
    const Xty = matVec(Xt, y);
    const beta = matVec(XtXinv, Xty);

    // residuals & fit
    let ssr = 0, sst = 0;
    let my = 0;
    for (let i = 0; i < n; i++) my += y[i];
    my /= n;
    const yhat = matVec(X, beta);
    for (let i = 0; i < n; i++) {
      const e = y[i] - yhat[i];
      ssr += e * e;
      const d = y[i] - my;
      sst += d * d;
    }
    const df = n - p;
    const sigma2 = df > 0 ? ssr / df : NaN;
    const r2 = sst > 0 ? 1 - ssr / sst : NaN;
    const se = new Array(p);
    const tStat = new Array(p);
    const pVal = new Array(p);
    for (let j = 0; j < p; j++) {
      const v = sigma2 * XtXinv[j][j];
      se[j] = v > 0 ? Math.sqrt(v) : NaN;
      tStat[j] = se[j] > 0 ? beta[j] / se[j] : NaN;
      pVal[j] = isFinite(tStat[j]) ? tPValue(tStat[j], df) : NaN;
    }
    return { beta, se, t: tStat, p: pVal, r2, sigma2, n, df, xtxInv: XtXinv, yhat };
  }

  // ── Prediction with confidence interval ──────────────────────────────
  //   predictWithCI(model, xRow)
  //   xRow: array of p values (same order as columns of X)
  //   returns { mean, lo, hi }   (95% interval, t-quantile approximated)
  function predictWithCI(model, xRow) {
    if (!model || model.error) return null;
    const { beta, sigma2, xtxInv, df } = model;
    let m = 0;
    for (let j = 0; j < beta.length; j++) m += beta[j] * xRow[j];
    // var(yhat_new) = sigma2 * (1 + xRow' * (X'X)^-1 * xRow)  (prediction interval)
    let q = 0;
    for (let i = 0; i < beta.length; i++) {
      for (let j = 0; j < beta.length; j++) {
        q += xRow[i] * xtxInv[i][j] * xRow[j];
      }
    }
    const seFit = Math.sqrt(sigma2 * (1 + q));
    // Approximate t_{0.975, df} — for df ≥ 30 use 2; otherwise lookup
    const tCrit = tCritical975(df);
    return { mean: m, lo: m - tCrit * seFit, hi: m + tCrit * seFit, seFit };
  }

  function tCritical975(df) {
    // Small lookup table for the 97.5 percentile of t (two-sided 95% CI)
    const table = {
      1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447,
      7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 12: 2.179, 15: 2.131,
      20: 2.086, 25: 2.060, 30: 2.042, 40: 2.021, 60: 2.000,
      120: 1.980, 1000: 1.962,
    };
    const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
    for (const k of keys) if (df <= k) return table[k];
    return 1.960;
  }

  // ── Formatter for p-values ──────────────────────────────────────────
  function fmtP(p) {
    if (!isFinite(p)) return '—';
    if (p < 0.001) return 'p < 0.001';
    if (p < 0.01) return 'p = ' + p.toFixed(3);
    return 'p = ' + p.toFixed(2);
  }
  function sigCode(p) {
    if (!isFinite(p)) return '';
    if (p < 0.001) return '***';
    if (p < 0.01) return '**';
    if (p < 0.05) return '*';
    if (p < 0.1) return '.';
    return '';
  }

  window.STATS = {
    logGamma, betacf, incompleteBeta, tPValue, tCritical975,
    pearson, linReg, olsMulti, predictWithCI,
    matMul, matT, matVec, matInverse,
    fmtP, sigCode,
  };

})();
