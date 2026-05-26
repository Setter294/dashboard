/* ==========================================================
   MODERN DASHBOARD — extra UX animations
   - Scroll-reveal (IntersectionObserver)
   - KPI count-up (re-runs when values change)
   - Mouse-follow gradient on KPI cards
   - Active chip sync with current preset
   - HTML-safe i18n rendering for hero <em>
   ========================================================== */
(function () {
  // ---------- 1) Scroll reveal with stagger ----------
  function setupReveal() {
    const blocks = document.querySelectorAll('.reveal');
    blocks.forEach((b, i) => { b.style.setProperty('--i', i % 6); });
    if (!('IntersectionObserver' in window)) {
      blocks.forEach(b => b.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });
    blocks.forEach(b => io.observe(b));
  }

  // ---------- 2) KPI count-up ----------
  // Watches the KPI grid; when a kpi-value changes, animates from 0 → new value.
  function setupKpiCounter() {
    const grid = document.getElementById('kpis');
    if (!grid) return;

    function animateValue(el, finalText) {
      // Try to parse a number (with sign, decimals, separators) out of the text.
      // Keep prefix/suffix (e.g. "+", "%", letters) verbatim.
      const m = finalText.match(/^([^\d\-+]*)([+-]?[\d.,\s]+)([^\d]*)$/);
      if (!m) { el.textContent = finalText; return; }
      const prefix = m[1];
      const numStr = m[2].replace(/\s/g, '');
      const suffix = m[3];

      // Detect locale separators
      const lastComma = numStr.lastIndexOf(',');
      const lastDot   = numStr.lastIndexOf('.');
      let decimalSep, thousandSep, decimals = 0;
      if (lastComma > lastDot) { decimalSep = ','; thousandSep = '.'; }
      else if (lastDot > lastComma) { decimalSep = '.'; thousandSep = ','; }
      else { decimalSep = '.'; thousandSep = ','; }
      const decPart = decimalSep && numStr.includes(decimalSep)
        ? numStr.split(decimalSep)[1] : '';
      decimals = decPart ? decPart.length : 0;

      const cleaned = numStr.split(thousandSep).join('').replace(decimalSep, '.');
      const target = parseFloat(cleaned);
      if (!isFinite(target)) { el.textContent = finalText; return; }

      const dur = 900;
      const start = performance.now();
      const startVal = 0;
      const fmt = (v) => {
        const fixed = v.toFixed(decimals);
        let [int, dec] = fixed.split('.');
        const negative = int.startsWith('-');
        if (negative) int = int.slice(1);
        // re-insert thousands separator
        int = int.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
        const signOut = negative ? '-' : (prefix.includes('+') ? '+' : '');
        const cleanedPrefix = prefix.replace(/[+\-]$/, '');
        const out = cleanedPrefix + signOut + int + (dec ? decimalSep + dec : '') + suffix;
        return out;
      };

      function tick(now) {
        const t = Math.min(1, (now - start) / dur);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        const v = startVal + (target - startVal) * eased;
        el.textContent = fmt(v);
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = finalText;
      }
      requestAnimationFrame(tick);
    }

    const seen = new WeakMap();
    function scan() {
      grid.querySelectorAll('.kpi-value').forEach(el => {
        const txt = el.textContent.trim();
        if (seen.get(el) === txt) return;
        seen.set(el, txt);
        // Only animate numeric-looking values (skip "Amazon" etc.)
        if (/\d/.test(txt) && !/^[A-Za-z]/.test(txt)) animateValue(el, txt);
      });
    }
    // Initial pass + observe re-renders
    const mo = new MutationObserver(() => {
      // debounce
      clearTimeout(mo._t);
      mo._t = setTimeout(scan, 30);
    });
    mo.observe(grid, { childList: true, subtree: true, characterData: true });
    setTimeout(scan, 100);
  }

  // ---------- 3) Pointer-follow gradient on KPI cards ----------
  function setupCardSheen() {
    document.addEventListener('pointermove', (e) => {
      const target = e.target.closest && e.target.closest('.kpi, .crisis-card, .compare-card');
      if (!target) return;
      const r = target.getBoundingClientRect();
      target.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      target.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  }

  // ---------- 4) Sync active state on preset chips ----------
  function setupChipActive() {
    const chips = document.querySelectorAll('[data-preset]');
    chips.forEach(c => {
      c.addEventListener('click', () => {
        chips.forEach(x => x.classList.remove('active'));
        c.classList.add('active');
      });
    });
  }

  // ---------- 5) HTML-safe i18n for the hero <em> word ----------
  // The base app overwrites textContent from i18n. For the hero h1 we want to keep <em>.
  // Strategy: store original innerHTML, after every i18n pass restore <em> formatting
  // around the localized keyword.
  function setupHeroEmphasis() {
    const h1 = document.querySelector('.hero h1[data-i18n="title"]');
    if (!h1) return;
    const wordMap = {
      es: 'tecnológico',
      ca: 'tecnològic',
    };
    function reformat() {
      const lang = document.documentElement.lang === 'ca' ? 'ca' : 'es';
      const txt = h1.textContent;
      const w = wordMap[lang];
      if (!w) return;
      // case-insensitive replace, only first occurrence
      const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i');
      h1.innerHTML = txt.replace(re, '<em>$1</em>');
    }
    // run after each i18n update
    const mo = new MutationObserver(() => {
      // Avoid reentry: only reformat if no <em> present
      if (!h1.querySelector('em')) reformat();
    });
    mo.observe(h1, { childList: true, characterData: true, subtree: true });
    reformat();
  }

  // ---------- 6) Decorative giant outline numerals per section ----------
  function setupBgNumerals() {
    document.querySelectorAll('.block').forEach(block => {
      const num = block.querySelector('.section-num');
      if (!num) return;
      if (block.querySelector('.section-bg-num')) return;
      const ghost = document.createElement('span');
      ghost.className = 'section-bg-num';
      ghost.textContent = num.textContent.trim();
      ghost.setAttribute('aria-hidden', 'true');
      block.prepend(ghost);
    });
  }

  // ---------- 7) Scroll progress bar ----------
  function setupScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    let raf = null;
    function update() {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const p = total > 0 ? (window.scrollY / total) * 100 : 0;
      bar.style.width = Math.max(0, Math.min(100, p)) + '%';
      raf = null;
    }
    window.addEventListener('scroll', () => {
      if (raf == null) raf = requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  // ---------- 8) Hero marquee ----------
  function setupMarquee() {
    const track = document.getElementById('marquee-track');
    if (!track) return;
    const words = [
      '25 empresas', '2001 — 2025', 'Puntocom', 'Crisis 08', 'COVID',
      'Post-COVID', 'Big Tech', 'PIB', 'Desempleo', 'Variación neta',
      'Productividad', 'Volatilidad', 'OLS', 'Predicción 2026',
    ];
    const html = words.map(w => `<span>${w}</span>`).join('');
    // Duplicate for seamless loop
    track.innerHTML = html + html;
  }

  // ---------- 9) In-view section underline ----------
  function setupInView() {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        e.target.classList.toggle('in-view', e.isIntersecting);
      });
    }, { threshold: 0.18 });
    document.querySelectorAll('.block').forEach(b => io.observe(b));
  }

  // ---------- INIT ----------
  function init() {
    setupReveal();
    setupKpiCounter();
    setupCardSheen();
    setupChipActive();
    setupHeroEmphasis();
    setupBgNumerals();
    setupScrollProgress();
    setupMarquee();
    setupInView();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
