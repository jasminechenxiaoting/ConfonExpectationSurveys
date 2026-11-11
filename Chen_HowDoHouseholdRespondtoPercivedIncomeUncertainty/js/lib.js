/* lib.js — drawing helpers and the deck's numbers.
 *
 * L.DATA is the single home of every number a chart draws. Fill it from the
 * source's tables and say in each entry where the number comes from. Charts
 * read L.DATA; prose on the slides is transcribed from the same tables. When a
 * source number changes, change it here and grep index.qmd for the old value.
 *
 * If an explorable already exists for this topic, replace L.DATA with its data
 * object (and copy its model functions) so the two never disagree.
 */
(function () {
  const L = {};

  // ---------- numbers ----------
  L.fmtPct = (x, d = 1) => (x >= 0 ? '' : '−') + Math.abs(x).toFixed(d) + '%';
  L.fmtPP = (x, d = 2) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d) + ' points';
  L.fmtInt = (x) => Math.round(x).toLocaleString('en');
  L.fmtNum = (x, d = 2) => (x >= 0 ? '' : '−') + Math.abs(x).toFixed(d);
  L.clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  // Read a dotted path from L.DATA: L.get('specs.0.beta')
  L.get = (path, obj) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj || L.DATA);
  // A tick step giving about n ticks over a range, at 1, 2 or 5 × a power of ten
  L.niceStep = (range, n = 5) => { const raw = Math.abs(range) / n || 1, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  L.lerp = (a, b, t) => a + (b - a) * t;

  // Seeded RNG (mulberry32) so stylised dots are identical on every render
  L.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  L.randn = (r) => {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // ---------- the source's numbers ----------
  // Every number comes from 1_Core.tex (slides v11) or the figures it includes.
  // Outcomes are within-subject log changes in allocation shares unless stated.
  // `sig` records the table's stars (true = at least one star), never a rounded SE.
  L.DATA = {
    // Jasmine, the running example: the sample's median monthly income and a stylised split
    // close to the panel's median prior allocation (70 / 20 / 5 in the Prior Allocation table).
    jasmine: { income: 4500, split: { spend: 70, save: 20, debt: 10 } },

    // Extensive margin (figure Extensive_Margin_Risk_No_Adjustment): share with any adjustment,
    // 20% vs 40% spread, first encounter (stage 0 → stage 1). N in brackets = adjusters; p < 0.01 each.
    extensive: {
      base: { s20: 961, s40: 938 },
      rows: [
        { k: 'spend', s20: 46.6, n20: 448, s40: 60.9, n40: 571 },
        { k: 'save',  s20: 48.0, n20: 461, s40: 61.4, n40: 576 },
        { k: 'debt',  s20: 13.9, n20: 134, s40: 20.1, n40: 189 },
      ],
    },

    // Intensive margin (table "Responses to 20% or 40% Uncertainty", Δlog X stage 1 − stage 0), all four groups.
    intensive: {
      obs: { s20: 960, s40: 938 },
      rows: [
        { k: 'spend', b20: -0.020, se20: 0.005, sig20: true, b40: -0.066, se40: 0.008, sig40: true, ratio: 3.30, n20: 960, n40: 938 },
        { k: 'save',  b20:  0.039, se20: 0.015, sig20: true, b40:  0.123, se40: 0.019, sig40: true, ratio: 3.15, n20: 837, n40: 790 },
        { k: 'debt',  b20:  0.026, se20: 0.011, sig20: true, b40:  0.078, se40: 0.015, sig40: true, ratio: 3.00, n20: 489, n40: 469 },
      ],
    },

    // Common sample: positive observed allocations in all channels at both stages.
    intensiveCommon: {
      rows: [
        { k: 'spend', b20: -0.032, low20: -0.048, high20: -0.016, b40: -0.102, low40: -0.128, high40: -0.077, n20: 404, n40: 374 },
        { k: 'save',  b20:  0.047, low20:  0.000, high20:  0.094, b40:  0.111, low40:  0.054, high40:  0.168, n20: 404, n40: 374 },
        { k: 'debt',  b20:  0.019, low20: -0.003, high20:  0.041, b40:  0.067, low40:  0.036, high40:  0.097, n20: 404, n40: 374 },
      ],
    },

    // Benchmarks for the ratio of the 40% to the 20% response (appendix "Response Scales with Variance")
    scaling: { linear: 2, crra: 4 },

    // Guaranteed-income benchmark (appendix "Response to Guaranteed Income"): Δlog X guarantee − prior
    guarantee: [
      { k: 'spend', b: -0.025, se: 0.003, sig: true, n: 2121 },
      { k: 'save',  b:  0.065, se: 0.008, sig: true, n: 1898 },
      { k: 'debt',  b: -0.001, se: 0.006, sig: false, n: 1074 },
    ],

    // Path dependence (tables "Path Dependence Test at Final 20% / 40% Uncertainty"), groups 1 and 3 only.
    // direct = stage 1 at that level; via = stage 2 at that level after the other level; diff = via − direct.
    paths: {
      spend: { at20: { direct: -0.026, dse: 0.007, via: -0.051, vse: 0.008, diff: -0.025, diffse: 0.011, sig: true,  n: [474, 473] },
               at40: { direct: -0.084, dse: 0.012, via: -0.069, vse: 0.012, diff:  0.015, diffse: 0.017, sig: false, n: [479, 446] } },
      save:  { at20: { direct:  0.076, dse: 0.022, via:  0.096, vse: 0.020, diff:  0.019, diffse: 0.029, sig: false, n: [408, 424] },
               at40: { direct:  0.151, dse: 0.027, via:  0.151, vse: 0.031, diff:  0.000, diffse: 0.041, sig: false, n: [407, 363] } },
      debt:  { at20: { direct:  0.024, dse: 0.015, via:  0.049, vse: 0.018, diff:  0.025, diffse: 0.023, sig: false, n: [233, 227] },
               at40: { direct:  0.074, dse: 0.021, via:  0.046, vse: 0.024, diff: -0.028, diffse: 0.032, sig: false, n: [233, 219] } },
    },

    // Ambiguity (table "From Known to Unknown Probabilities"), groups 2 and 4.
    // known = stage 1 (guarantee → known odds); fog = stage 2 (known odds → unknown odds).
    ambiguity: {
      s20: {
        spend: { known: -0.014, kse: 0.008, ksig: true,  fog: -0.004, fse: 0.006, fsig: false, kn: 486, fn: 452 },
        save:  { known:  0.003, kse: 0.021, ksig: false, fog:  0.017, fse: 0.014, fsig: false, kn: 429, fn: 402 },
        debt:  { known:  0.028, kse: 0.015, ksig: true,  fog: -0.006, fse: 0.012, fsig: false, kn: 256, fn: 239 },
      },
      s40: {
        spend: { known: -0.047, kse: 0.010, ksig: true, fog: -0.001, fse: 0.007, fsig: false, kn: 459, fn: 418 },
        save:  { known:  0.094, kse: 0.027, ksig: true, fog: -0.005, fse: 0.018, fsig: false, kn: 383, fn: 347 },
        debt:  { known:  0.083, kse: 0.021, ksig: true, fog:  0.006, fse: 0.017, fsig: false, kn: 236, fn: 212 },
      },
    },

    // Direction of adjustment under ambiguity (figure Counter_Effects_Ambiguity_Shares): % of respondents, n in brackets;
    // and each direction's contribution to the mean log change (figure Counter_Effects_Ambiguity_Magnitude).
    counter: {
      s20: {
        spend: { dec: 10.8, ndec: 49, inc: 8.4,  ninc: 38, none: 80.8, nnone: 365, cInc: 0.019, cDec: -0.023 },
        save:  { dec: 8.7,  ndec: 35, inc: 12.9, ninc: 52, none: 78.4, nnone: 315, cInc: 0.064, cDec: -0.047 },
        debt:  { dec: 7.9,  ndec: 19, inc: 4.6,  ninc: 11, none: 87.4, nnone: 209, cInc: 0.024, cDec: -0.030 },
      },
      s40: {
        spend: { dec: 11.2, ndec: 47, inc: 12.7, ninc: 53, none: 76.1, nnone: 318, cInc: 0.029, cDec: -0.030 },
        save:  { dec: 13.5, ndec: 47, inc: 11.2, ninc: 39, none: 75.2, nnone: 261, cInc: 0.064, cDec: -0.069 },
        debt:  { dec: 9.0,  ndec: 19, inc: 8.5,  ninc: 18, none: 82.5, nnone: 175, cInc: 0.044, cDec: -0.038 },
      },
    },

    // The design: four groups, two treatment stages after the shared guarantee.
    design: [
      { g: 1, s1: '±20%', s2: '±40%', s2odds: '50-50',  role: 'swap', note: 'uncertainty up' },
      { g: 2, s1: '±20%', s2: '±20%', s2odds: 'unknown', role: 'fog',  note: 'odds withdrawn at 20' },
      { g: 3, s1: '±40%', s2: '±20%', s2odds: '50-50',  role: 'swap', note: 'uncertainty down' },
      { g: 4, s1: '±40%', s2: '±40%', s2odds: 'unknown', role: 'fog',  note: 'odds withdrawn at 40' },
    ],

    // Sample (summary statistics table, working sample 20–65)
    sample: { n: 2665, age: 43.0, income_mean: 4446, income_median: 4500, sigma_mean: 0.060, sigma_median: 0.032, mu_mean: 0.016 },
  };

  // ---------- SVG helpers ----------
  const NS = 'http://www.w3.org/2000/svg';
  L.svg = (tag, attrs = {}, children = []) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined) continue;
      if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const c of children) if (c) el.appendChild(c);
    return el;
  };
  L.el = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const c of children) if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  };

  // Linear scale with invert
  L.scale = (d0, d1, r0, r1) => {
    const f = (x) => r0 + (x - d0) / (d1 - d0) * (r1 - r0);
    f.invert = (y) => d0 + (y - r0) / (r1 - r0) * (d1 - d0);
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  };

  // A chart frame. Returns {svg, g, x, y, W, H, m}
  L.chart = (W, H, m, xd, yd) => {
    const svg = L.svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
    const x = L.scale(xd[0], xd[1], m.l, W - m.r);
    const y = L.scale(yd[0], yd[1], H - m.b, m.t);
    const g = L.svg('g');
    svg.appendChild(g);
    return { svg, g, x, y, W, H, m };
  };
  L.axisX = (c, ticks, fmt = (v) => v, label) => {
    const g = L.svg('g', { class: 'axis' });
    g.appendChild(L.svg('line', { x1: c.m.l, x2: c.W - c.m.r, y1: c.H - c.m.b, y2: c.H - c.m.b }));
    for (const t of ticks) {
      g.appendChild(L.svg('line', { x1: c.x(t), x2: c.x(t), y1: c.H - c.m.b, y2: c.H - c.m.b + 4 }));
      g.appendChild(L.svg('text', { x: c.x(t), y: c.H - c.m.b + 16, 'text-anchor': 'middle', text: fmt(t) }));
    }
    if (label) g.appendChild(L.svg('text', { x: (c.m.l + c.W - c.m.r) / 2, y: c.H - 4, 'text-anchor': 'middle', class: 'axis-label', text: label }));
    c.g.appendChild(g);
  };
  L.axisY = (c, ticks, fmt = (v) => v, label, grid = true) => {
    const g = L.svg('g', { class: 'axis' });
    for (const t of ticks) {
      if (grid) g.appendChild(L.svg('line', { class: 'grid', x1: c.m.l, x2: c.W - c.m.r, y1: c.y(t), y2: c.y(t) }));
      g.appendChild(L.svg('text', { x: c.m.l - 6, y: c.y(t) + 3.5, 'text-anchor': 'end', text: fmt(t) }));
    }
    if (label) g.appendChild(L.svg('text', { x: c.m.l, y: c.m.t - 8, 'text-anchor': 'start', class: 'axis-label', text: label }));
    c.g.appendChild(g);
  };
  L.linePath = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

  // Hatch pattern, the second visual channel. Call once per svg; returns "url(#id)".
  L.hatch = (svg, id, color) => {
    const defs = L.svg('defs');
    const p = L.svg('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    p.appendChild(L.svg('rect', { width: 6, height: 6, fill: color, 'fill-opacity': 0.18 }));
    p.appendChild(L.svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: color, 'stroke-width': 2 }));
    defs.appendChild(p);
    svg.insertBefore(defs, svg.firstChild);
    return `url(#${id})`;
  };

  // Slider row: returns {row, input, out}
  L.slider = (label, min, max, value, step, fmt, id) => {
    const input = L.el('input', { type: 'range', min, max, value, step, id });
    const out = L.el('output', { text: fmt(value), for: id });
    const row = L.el('label', { class: 'slider', for: id }, [L.el('span', { class: 'slider-label', text: label }), input, out]);
    input.addEventListener('input', () => { out.textContent = fmt(+input.value); });
    return { row, input, out };
  };

  L.toggle = (label, checked, id) => {
    const input = L.el('input', { type: 'checkbox', id });
    if (checked) input.checked = true;
    const row = L.el('label', { class: 'toggle', for: id }, [input, L.el('span', { class: 'toggle-track' }), L.el('span', { text: label })]);
    return { row, input };
  };

  L.reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Eased tween; jumps to the end under reduced motion
  L.tween = (from, to, ms, fn, done) => {
    if (L.reduced()) { fn(to); done && done(); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = L.clamp((t - t0) / ms, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      fn(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else done && done();
    };
    requestAnimationFrame(step);
  };

  window.LIB = L;
})();
