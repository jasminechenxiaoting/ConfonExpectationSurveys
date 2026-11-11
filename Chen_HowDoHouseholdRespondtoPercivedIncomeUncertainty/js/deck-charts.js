/* js/deck-charts.js — the deck's stages.
 *
 * A slide asks for a chart with
 *     <div class="stage" data-chart="name"></div>
 * and adds data-animate when the chart's build-in should replay every time the
 * slide is shown. A chart is CH[name] = (el, { animate }) => optional cleanup.
 * Numbers come from LIB.DATA in js/lib.js; anything stylised says so in its caption.
 *
 * Stages in this deck:
 *   coin        Jasmine's income tree: guaranteed, then a coin flip (chips); data-mode="fog" blanks the odds
 *   design      the four groups across stage 0, 1, 2; data-focus="all|swap|fog" selects the displayed arms
 *   extensive   share of households that adjust at all, two spreads (build-in)
 *   intensive   log changes with 95% intervals, three outcomes, two spreads
 *   scaling     the 40/20 ratio against the linear and CRRA benchmarks
 *   budget      Jasmine's 70/20/10 split moved by the estimates (chips)
 *   paths       the two within-subject paths plotted against the level (chips)
 *   pathdiff    via-minus-direct differences with intervals
 *   ambiguity   known-odds response, then the known→unknown step (build-in)
 *   retain      share with no change when the odds are withdrawn
 *   tug         increase and decrease contributions that cancel
 */
(function () {
  'use strict';

  function main() {
    const L = window.LIB;
    if (!L) { console.error('deck-charts.js: load js/lib.js first'); return; }
    const D = L.DATA, S = L.svg, E = L.el;
    const STATIC = /[?&](static|print-pdf)\b/.test(location.search) || L.reduced();

    // ---------- small helpers ----------
    const wrap = (svg, style) => { const d = E('div', { class: 'chart-wrap' }, [svg]); if (style) d.style.cssText = style; return d; };
    const cap = (html) => E('p', { class: 'caption', html });
    const chip = (text, pressed, onClick) => { const b = E('button', { class: 'chip', text, 'aria-pressed': pressed ? 'true' : 'false' }); b.addEventListener('click', onClick); return b; };
    const press = (container, test) => [...container.querySelectorAll('.chip')].forEach((b) => b.setAttribute('aria-pressed', test(b) ? 'true' : 'false'));
    const OUT = { spend: { name: 'Spending', c: 'var(--spend)', soft: 'var(--spend-soft)' }, save: { name: 'Saving', c: 'var(--save)', soft: 'var(--save-soft)' }, debt: { name: 'Debt repayment', c: 'var(--debt)', soft: 'var(--debt-soft)' } };
    const KEYS = ['spend', 'save', 'debt'];
    const eur = (x) => '€' + L.fmtInt(x);
    const sgn = (x, d = 3) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
    const pct1 = (x) => x.toFixed(1) + '%';
    const rrect = (x, y, w, h, attrs) => S('rect', Object.assign({ x, y, width: w, height: h, rx: 8 }, attrs));
    const txt = (x, y, text, attrs) => S('text', Object.assign({ x, y, text }, attrs));
    const legend = (items) => E('div', { class: 'legend' }, items.map((it) => E('span', { class: it.hatched ? 'hatched' : '', style: `--c:${it.c}`, text: it.t })));
    const arrowDefs = (svg, id, color) => {
      const defs = S('defs');
      const m = S('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      m.appendChild(S('path', { d: 'M0 0 L10 5 L0 10 z', fill: color }));
      defs.appendChild(m); svg.insertBefore(defs, svg.firstChild);
      return `url(#${id})`;
    };
    // CI whisker
    const whisker = (g, x, y1, y2, color = 'var(--ink)') => {
      g.appendChild(S('line', { x1: x, x2: x, y1, y2, stroke: color, 'stroke-width': 2 }));
      for (const y of [y1, y2]) g.appendChild(S('line', { x1: x - 5, x2: x + 5, y1: y, y2: y, stroke: color, 'stroke-width': 2 }));
    };

    const CH = {};

    // ---------- the coin-fork glyph: the deck's one drawn object ----------
    // A stem, two branches with round caps, a coin on each branch carrying the odds,
    // and the dashed mean line between them. `opts.fog` blanks the coins.
    const coin = (g, x, y, r, label, fog) => {
      g.appendChild(S('circle', { cx: x, cy: y, r, fill: 'var(--paper)', stroke: fog ? 'var(--fog)' : 'var(--ink)', 'stroke-width': 2.5 }));
      g.appendChild(S('circle', { cx: x, cy: y, r: r - 5, fill: 'none', stroke: fog ? 'var(--fog)' : 'var(--ink)', 'stroke-width': 1, 'stroke-dasharray': '2 2', opacity: 0.6 }));
      g.appendChild(txt(x, y + r * 0.36, label, { 'text-anchor': 'middle', class: 'lbl', 'font-size': r * 0.95, fill: fog ? 'var(--fog)' : 'var(--ink)', stroke: 'none' }));
    };
    // draws one fork into g; returns the end points. reach in px; x0,y0 the stem start; len the stem+branch length
    const fork = (g, x0, y0, len, reach, opts = {}) => {
      const color = opts.color || 'var(--ink)', sw = opts.sw || 3, r = opts.r || 16;
      const xs = x0 + len * 0.3, xe = x0 + len;
      g.appendChild(S('line', { x1: x0, y1: y0, x2: xs, y2: y0, stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round' }));
      const curve = (y) => `M${xs} ${y0} C ${xs + len * 0.3} ${y0}, ${xs + len * 0.35} ${y}, ${xe} ${y}`;
      const up = S('path', { d: curve(y0 - reach), fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round' });
      const dn = S('path', { d: curve(y0 + reach), fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round' });
      g.append(up, dn);
      if (opts.mean !== false) g.appendChild(S('line', { x1: xs, x2: xe + (opts.meanExtra || 0), y1: y0, y2: y0, stroke: 'var(--ink-3)', 'stroke-dasharray': '4 5' }));
      if (opts.coins !== false && reach > 6) {
        const mid = (p) => { const L = p.getTotalLength ? p.getTotalLength() : 0; return L ? p.getPointAtLength(L * 0.55) : { x: (xs + xe) / 2, y: y0 }; };
        const lab = opts.fog ? '?' : (opts.coinLabel || '50');
        const pu = mid(up), pd = mid(dn);
        coin(g, pu.x, pu.y, r, lab, opts.fog); coin(g, pd.x, pd.y, r, lab, opts.fog);
      }
      return { xe, yu: y0 - reach, yd: y0 + reach, xs };
    };

    // =====================================================================
    // coin: Jasmine's income next year, drawn in type. Chips open and close the fork.
    // data-mode="fog" draws Max with the coins blank.
    // =====================================================================
    CH.coin = (el) => {
      const fog = el.dataset.mode === 'fog';
      const inc = D.jasmine.income;
      const W = 760, H = 400, cy = 200;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
      svg.append(txt(130, cy - 6, fog ? 'Max, this month' : 'Jasmine, this month', { 'text-anchor': 'middle', class: 'lbl', 'font-size': 18 }),
        txt(130, cy + 22, eur(inc), { 'text-anchor': 'middle', class: 'lbl-mono', 'font-size': 20 }));
      const g = S('g'); svg.appendChild(g);
      const labels = S('g'); svg.appendChild(labels);
      let cur = 20, target = cur;
      const draw = (sp) => {
        g.replaceChildren(); labels.replaceChildren();
        const r = Math.round(sp), reach = sp * 4.6;
        if (r < 1) {
          g.appendChild(S('line', { x1: 240, y1: cy, x2: 560, y2: cy, stroke: 'var(--ink)', 'stroke-width': 3, 'stroke-linecap': 'round' }));
          labels.append(txt(580, cy - 6, 'next year', { class: 'lbl', 'font-size': 16 }), txt(580, cy + 20, eur(inc) + ', guaranteed', { class: 'lbl-mono', 'font-size': 15 }));
          return;
        }
        const f = fork(g, 240, cy, 330, reach, { fog, r: 20, coinLabel: '50', meanExtra: 170 });
        labels.append(txt(f.xe + 14, f.yu - 4, `rises by ${r}%`, { class: 'lbl', 'font-size': 16 }), txt(f.xe + 14, f.yu + 18, eur(inc * (1 + r / 100)), { class: 'lbl-mono', 'font-size': 15 }),
          txt(f.xe + 14, f.yd - 4, `falls by ${r}%`, { class: 'lbl', 'font-size': 16 }), txt(f.xe + 14, f.yd + 18, eur(inc * (1 - r / 100)), { class: 'lbl-mono', 'font-size': 15 }));
        if (!fog) labels.appendChild(txt(f.xe + 170, cy - 8, 'same on average', { 'text-anchor': 'end', class: 'tiny', 'font-size': 12 }));
      };
      draw(cur);
      const ctl = E('div', { class: 'ctl' });
      const go = (sp) => { const from = target; target = sp; L.tween(from, sp, 500, (v) => { cur = v; draw(v); }); press(ctl, (b) => +b.dataset.s === sp); };
      if (!fog) {
        for (const [t, sp] of [['Guaranteed', 0], ['Coin flip ±20%', 20], ['Coin flip ±40%', 40]]) { const b = chip(t, sp === 20, () => go(sp)); b.dataset.s = sp; ctl.appendChild(b); }
        el.append(wrap(svg), ctl, cap(`Jasmine earns the sample's median income, <span class="num">${eur(inc)}</span> a month. The coins carry the odds: each branch is equally likely, so the mean is unchanged and only the spread moves.`));
      } else {
        el.append(wrap(svg), cap('Max, in group 2: the same ±20 percent spread, and then the odds are withdrawn. The probability of each outcome is unknown.'));
      }
    };

    // =====================================================================
    // fork glyph for the dividers and the scale drawing. data-state:
    //   one      a single fork, coins showing 50 (section 1)
    //   two      two forks on one stem, ±20 behind in grey, ±40 in front (section 2)
    //   fog      one fork, coins blank (section 3)
    //   quiet    one fork in grey, no coins (appendix)
    //   scale    three forks side by side at true angle: ±3, ±20, ±40
    // =====================================================================
    CH.fork = (el) => {
      const st = el.dataset.state || 'one';
      if (st === 'scale') {
        const W = 760, H = 230, cy = 92;
        const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
        [[3, 'median household forecast'], [20, 'the vignette'], [40, 'the vignette']].forEach(([sp, t], i) => {
          const g = S('g'); svg.appendChild(g);
          const x0 = 40 + i * 250;
          fork(g, x0, cy, 170, sp * 1.9, { coins: false, mean: false, sw: 2.5 });
          g.appendChild(txt(x0 + 85, H - 32, '±' + sp + '%', { 'text-anchor': 'middle', class: 'lbl', 'font-size': 16 }));
          g.appendChild(txt(x0 + 85, H - 12, t, { 'text-anchor': 'middle', class: 'lbl dim', 'font-size': 12 }));
        });
        el.append(wrap(svg), cap('Three spreads drawn at one scale. The 3 percent is the panel median of perceived income uncertainty (0.032 of income); the angle is a drawing.'));
        return;
      }
      const W = 520, H = 130, cy = 65;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
      const g = S('g'); svg.appendChild(g);
      if (st === 'two') {
        fork(g, 10, cy, 300, 26, { color: 'var(--ink-3)', coins: false, mean: false, sw: 2.5 });
        fork(g, 10, cy, 300, 52, { r: 15, mean: false });
      } else if (st === 'fog') {
        fork(g, 10, cy, 300, 46, { r: 15, fog: true, mean: false });
      } else if (st === 'quiet') {
        fork(g, 10, cy, 300, 40, { color: 'var(--ink-3)', coins: false, mean: false, sw: 2.5 });
      } else {
        fork(g, 10, cy, 300, 46, { r: 15, meanExtra: 60 });
      }
      el.append(wrap(svg, 'justify-content:flex-start'));
    };

    // =====================================================================
    // strip: Jasmine's split as a colour bar. data-state="before" (70/20/10) or "after" (the ±40 estimates)
    // =====================================================================
    CH.strip = (el) => {
      const after = el.dataset.state === 'after';
      const base = D.jasmine.split, inc = D.jasmine.income, rows = Object.fromEntries(D.intensive.rows.map((r) => [r.k, r]));
      const W = 560, H = 96, bx = 0, by = 12, bh = 28, scale = W / 100;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
      let x = 0, xb = 0;
      KEYS.forEach((k) => {
        const sh = after ? base[k] * Math.exp(rows[k].b40) : base[k], w = sh * scale, wb = base[k] * scale;
        svg.appendChild(S('rect', { x, y: by, width: Math.max(0, w), height: bh, fill: OUT[k].c }));
        const short = { spend: 'spending', save: 'saving', debt: 'debt' }[k];
        svg.appendChild(txt(x + w / 2, by + bh + 20 + (k === 'debt' ? 16 : 0), short + ' ' + sh.toFixed(after ? 1 : 0), { 'text-anchor': 'middle', class: 'lbl', 'font-size': 12, fill: OUT[k].c }));
        if (after && k !== 'debt') svg.appendChild(S('line', { x1: xb + wb, x2: xb + wb, y1: by - 8, y2: by + bh + 8, stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }));
        x += w; xb += wb;
      });
      const d = (k) => inc * (base[k] * Math.exp(rows[k].b40) - base[k]) / 100;
      const t = after ? `Jasmine at ±40: ${eur(Math.abs(d('spend')))} less spending, ${eur(d('save'))} more saving, ${eur(d('debt'))} more repaid, a month. The mean has not moved.`
        : `out of every 100 euros, Jasmine spends 70, saves 20 and repays 10 · stylised, close to the panel median`;
      el.append(wrap(svg, 'justify-content:flex-start'), cap(t));
    };

    // =====================================================================
    // design: three stages. data-focus selects only the requested experimental arms.
    // =====================================================================
    CH.design = (el) => {
      const focus = el.dataset.focus || 'all';
      const W = 780, H = 400;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
      const arrow = arrowDefs(svg, 'des-arr-' + focus, 'var(--ink-3)');
      const groups = D.design.filter((g) => focus === 'all' || g.role === focus);
      const colW = groups.length === 2 ? 230 : 150, gap = groups.length === 2 ? 90 : 12;
      const totalWidth = groups.length * colW + (groups.length - 1) * gap;
      const x0 = 110 + (W - 110 - totalWidth) / 2;
      const cols = groups.map((_, i) => x0 + i * (colW + gap));
      const mid = x0 + totalWidth / 2;
      const rowY = { s0: 28, s1: 160, s2: 272, note: 352 };
      const lab = (y, t) => svg.appendChild(txt(12, y + 4, t, { class: 'axis-label' }));
      lab(rowY.s0 + 26, 'Stage 0'); lab(rowY.s1 + 26, 'Stage 1'); lab(rowY.s2 + 26, 'Stage 2');
      // stage 0: shared guarantee
      const s0dim = 1;
      svg.append(rrect(mid - 190, rowY.s0, 380, 52, { fill: 'var(--paper-2)', stroke: 'var(--ink)', opacity: s0dim }),
        txt(mid, rowY.s0 + 21, 'Income guaranteed unchanged', { 'text-anchor': 'middle', class: 'lbl', opacity: s0dim }),
        txt(mid, rowY.s0 + 40, focus === 'all' ? 'all respondents · then randomised into four groups' : 'common baseline · selected randomized groups shown', { 'text-anchor': 'middle', class: 'tiny', opacity: s0dim }));
      groups.forEach((g, i) => {
        const x = cols[i], o = 1, cx = x + colW / 2;
        const grp = S('g', { opacity: o });
        grp.appendChild(S('line', { x1: mid, y1: rowY.s0 + 52, x2: cx, y2: rowY.s1 - 4, stroke: 'var(--ink-3)', 'stroke-width': 1.5, 'marker-end': arrow }));
        const big = g.s1 === '±40%';
        grp.append(rrect(x, rowY.s1, colW, 52, { fill: 'var(--paper-2)', stroke: 'var(--ink-2)' }),
          txt(cx, rowY.s1 + 21, `Group ${g.g}`, { 'text-anchor': 'middle', class: 'tiny' }),
          txt(cx, rowY.s1 + 41, `${g.s1}, odds 50-50`, { 'text-anchor': 'middle', class: 'lbl', 'font-size': big ? 15 : 13 }));
        grp.appendChild(S('line', { x1: cx, y1: rowY.s1 + 52, x2: cx, y2: rowY.s2 - 4, stroke: 'var(--ink-3)', 'stroke-width': 1.5, 'marker-end': arrow }));
        const isFog = g.role === 'fog';
        grp.append(rrect(x, rowY.s2, colW, 52, { fill: isFog ? 'var(--fog-soft)' : 'var(--paper)', stroke: isFog ? 'var(--fog)' : 'var(--ink)', 'stroke-width': 1.5 }),
          txt(cx, rowY.s2 + 21, isFog ? 'same spread' : 'other spread', { 'text-anchor': 'middle', class: 'tiny' }),
          txt(cx, rowY.s2 + 41, `${g.s2}, odds ${g.s2odds}`, { 'text-anchor': 'middle', class: 'lbl', fill: isFog ? 'var(--fog)' : 'var(--ink)' }));
        grp.appendChild(txt(cx, rowY.note + 14, g.note, { 'text-anchor': 'middle', class: 'tiny', fill: isFog ? 'var(--fog)' : 'var(--ink-2)' }));
        svg.appendChild(grp);
      });
      // family brackets
      const caption = { all: 'Groups 1 and 3 swap spreads at stage 2; groups 2 and 4 keep their spread and lose the odds. Every comparison is within the same respondent.',
        swap: 'Uncertainty sequences (groups 1 and 3): both spreads, opposite orders, known probabilities. First-stage estimates pool all groups facing known probabilities.',
        fog: 'Groups 2 and 4: the same household faces the same spread, first with odds, then without.' }[focus];
      el.append(wrap(svg), cap(caption));
    };

    // ---------- shared: grouped bars for three outcomes × two spreads ----------
    // Both spreads are drawn in the outcome's full colour; the spread is written under each bar,
    // so no legend and no second visual channel. `twoStep` holds the ±40 bars back behind a button
    // when the chart animates in, so the room can bet on them first.
    const grouped = (el, o, opts) => {
      const { rows, val, se, sig, yd, yticks, fmt, ylabel, caption, animate, labelFmt, twoStep, count, interval } = opts;
      const c = L.chart(680, 380, { l: 60, r: 16, t: 34, b: 58 }, [0, 3], yd);
      L.axisY(c, yticks, fmt, ylabel);
      const zero = c.y(0);
      c.g.appendChild(S('line', { x1: c.m.l, x2: c.W - c.m.r, y1: zero, y2: zero, stroke: 'var(--ink-2)' }));
      const bw = 62, items = [];
      rows.forEach((r, i) => {
        const O = OUT[r.k], gx = c.x(i + 0.5);
        let patternedFill = O.c;
        if (opts.pattern20) {
          const id = (opts.patternIdPrefix || 'adjustment-dashes') + '-' + r.k;
          const defs = S('defs'), pattern = S('pattern', { id, width: 9, height: 9, patternUnits: 'userSpaceOnUse' });
          pattern.append(S('rect', { width: 9, height: 9, fill: 'white' }), S('path', { d: 'M1 3 H6 M5 8 H9', stroke: O.c, 'stroke-width': 2 }));
          defs.append(pattern); c.svg.append(defs); patternedFill = `url(#${id})`;
        }
        c.g.appendChild(txt(gx, c.H - c.m.b + 34, O.name, { 'text-anchor': 'middle', class: 'lbl' }));
        if (opts.debtorsOnly && r.k === 'debt') c.g.appendChild(txt(gx, c.H - c.m.b + 51, '(debtors only)', { 'text-anchor': 'middle', class: 'tiny' }));
        [['20', gx - bw / 2 - 4], ['40', gx + bw / 2 + 4]].forEach(([s, x]) => {
          const v = val(r, s), e = se ? se(r, s) : 0, ok = sig ? sig(r, s) : true;
          const rect = S('rect', { x: x - bw / 2, width: bw, y: zero, height: 0, fill: ok ? (s === '20' ? patternedFill : O.c) : 'var(--paper)', stroke: O.c, 'stroke-width': opts.pattern20 && s === '20' ? 1 : (ok ? 0 : 2) });
          const lab = txt(x, 0, '', { 'text-anchor': 'middle', class: 'lbl', 'font-size': 12 });
          const sub = txt(x, c.H - c.m.b + 16, '±' + s + '%', { 'text-anchor': 'middle', class: 'tiny' });
          const wg = S('g');
          c.g.append(rect, wg, lab, sub);
          items.push({ rect, lab, sub, wg, v, e, x, s, r, n: count ? count(r, s) : null });
        });
      });
      const draw = (k20, k40) => items.forEach((it) => {
        const k = it.s === '20' ? k20 : k40, v = it.v * k;
        const y0 = c.y(Math.max(0, v)), h = Math.abs(c.y(v) - zero);
        it.rect.setAttribute('y', y0); it.rect.setAttribute('height', h);
        it.rect.setAttribute('opacity', k > 0.001 ? 1 : 0); it.sub.setAttribute('opacity', k > 0.001 ? 1 : 0.35);
        it.wg.replaceChildren();
        const bounds = interval ? interval(it.r, it.s) : [it.v - 1.96 * (it.e || 0), it.v + 1.96 * (it.e || 0)];
        if (k >= 0.999 && (it.e || interval)) whisker(it.wg, it.x, c.y(bounds[0]), c.y(bounds[1]));
        const above = it.v >= 0;
        const yl = above ? c.y(bounds[1]) - 8 : c.y(bounds[0]) + 16;
        it.lab.setAttribute('y', yl - (it.n != null ? 15 : 0)); it.lab.textContent = k >= 0.999 ? (labelFmt ? labelFmt(it.v) : fmt(it.v)) : '';
        if (k >= 0.999 && it.n != null) it.lab.appendChild(S('tspan', {x: it.x, dy: 15})).textContent = (opts.countPairs ? '(' + it.n + ')' : '(N=' + it.n + ')');
      });
      el.append(wrap(c.svg));
      let t = null;
      if (twoStep) {
        const row = E('div', { class: 'ctl' });
        const btn = E('button', { class: 'btn', text: 'Now double the spread to ±40%' });
        btn.addEventListener('click', () => { btn.disabled = true; btn.style.opacity = 0.35; L.tween(0, 1, 1100, (k) => draw(1, k)); });
        row.appendChild(btn); el.appendChild(row);
        if (!animate) { draw(1, 1); btn.disabled = true; btn.style.opacity = 0.35; }
        else { draw(0, 0); L.tween(0, 1, 900, (k) => draw(k, 0)); }
      } else if (!animate) { draw(1, 1); }
      else { draw(0, 0); L.tween(0, 1, 900, (k) => draw(k, 0), () => { t = setTimeout(() => L.tween(0, 1, 1100, (k) => draw(1, k)), 500); }); }
      el.appendChild(cap(caption));
      return () => { if (t) clearTimeout(t); };
    };

    // =====================================================================
    // extensive: share with any adjustment (build-in, the payoff of the hook's bet)
    // =====================================================================
    CH.extensive = (el, o) => grouped(el, o, {
      rows: D.extensive.rows, val: (r, s) => r['s' + s], yd: [0, 80], yticks: [0, 20, 40, 60, 80], fmt: (v) => v + '%', ylabel: 'share who change their split',
      labelFmt: (v) => v.toFixed(1) + '%', count: (r, s) => r['n' + s], animate: o.animate,
      caption: `Share of respondents whose allocation at stage 1 differs from their allocation under the guarantee. First encounter only; ${L.fmtInt(D.extensive.base.s20)} respondents at ±20%, ${L.fmtInt(D.extensive.base.s40)} at ±40%. The 20-vs-40 difference is significant at 1% for every outcome.`,
    });

    CH.extensiveUpdated = (el, o) => grouped(el, o, {
      rows: [
        { k: 'spend', s20: 46.6, s40: 60.9, n20: '448/961', n40: '571/938' },
        { k: 'save', s20: 48.0, s40: 61.4, n20: '461/961', n40: '576/938' },
        { k: 'debt', s20: 23.4, s40: 34.0, n20: '112/479', n40: '162/476' }
      ],
      val: (r, s) => r['s' + s], yd: [0, 80], yticks: [0, 20, 40, 60, 80],
      fmt: (v) => v + '%', ylabel: 'households adjusting (%)',
      labelFmt: (v) => v.toFixed(1) + '%', count: (r, s) => r['n' + s],
      countPairs: true, pattern20: true, debtorsOnly: true, animate: o.animate,
      caption: 'Dashed pattern: ±20%; solid fill: ±40%. Labels: adjusters / valid paired responses. Spending and saving: all households; debt repayment: pre-treatment debtors only. Unweighted.'
    });

    // =====================================================================
    // intensive: approximate percent changes in allocation shares with 95% intervals
    // =====================================================================
    CH.intensive = (el, o) => grouped(el, o, {
      rows: D.intensive.rows, val: (r, s) => r['b' + s], se: (r, s) => r['se' + s], sig: (r, s) => r['sig' + s],
      yd: [-0.10, 0.17], yticks: [-0.10, -0.05, 0, 0.05, 0.10, 0.15], fmt: (v) => L.fmtNum(v * 100, 0) + '%', ylabel: 'change in allocation share (%)',
      labelFmt: (v) => sgn(v * 100, 1) + '%', count: (r, s) => r['n' + s], animate: o.animate, twoStep: false, pattern20: true, patternIdPrefix: 'intensive-dashes',
      caption: `Approximate percent change in allocation share relative to no income uncertainty (the guaranteed-income scenario), with 95% intervals. Estimates are 100 × log-share changes, interpreted approximately as percent changes. All four groups; ${L.fmtInt(D.intensive.obs.s20)} respondents at ±20%, ${L.fmtInt(D.intensive.obs.s40)} at ±40%.`,
    });

    CH.intensiveCommon = (el, o) => grouped(el, o, {
      rows: D.intensiveCommon.rows,
      val: (r, s) => 100 * (Math.exp(r['b' + s]) - 1),
      interval: (r, s) => [100 * (Math.exp(r['low' + s]) - 1), 100 * (Math.exp(r['high' + s]) - 1)],
      count: (r, s) => r['n' + s], pattern20: true, patternIdPrefix: 'common-intensity-dashes',
      yd: [-15, 20], yticks: [-10, 0, 10, 20], fmt: (v) => L.fmtNum(v, 0) + '%',
      ylabel: 'change in geometric mean allocation (%)',
      labelFmt: (v) => sgn(v, 1) + '%', animate: o.animate, twoStep: false,
      caption: 'Common sample: positive observed allocations in all three channels at both the guaranteed and uncertainty stages. Bars show 100 × [exp(mean log change) − 1]; whiskers show transformed 95% confidence intervals. N = 404 at ±20% and N = 374 at ±40% for each channel. Dashed: ±20%; solid: ±40%.'
    });

    // =====================================================================
    // scaling: the 40/20 ratio against two benchmarks
    // =====================================================================
    CH.scaling = (el) => {
      const c = L.chart(640, 380, { l: 60, r: 170, t: 30, b: 46 }, [0, 42], [0, 5.2]);
      L.axisY(c, [0, 1, 2, 3, 4, 5], (v) => v + '×', 'response relative to ±20%');
      L.axisX(c, [0, 20, 40], (v) => (v ? '±' + v + '%' : 'guaranteed'), 'uncertainty');
      const lin = [], quad = [];
      for (let x = 0; x <= 40; x += 1) { lin.push([c.x(x), c.y(x / 20)]); quad.push([c.x(x), c.y(Math.pow(x / 20, 2))]); }
      c.g.appendChild(S('path', { d: L.linePath(quad), fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2 }));
      c.g.appendChild(S('path', { d: L.linePath(lin), fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 2, 'stroke-dasharray': '5 5' }));
      c.g.appendChild(txt(c.x(40) + 8, c.y(D.scaling.crra) + 4, `CRRA prudence, ∝ spread²: ${D.scaling.crra}×`, { class: 'lbl dim' }));
      c.g.appendChild(txt(c.x(40) + 8, c.y(D.scaling.linear) + 4, `linear in the uncertainty: ${D.scaling.linear}×`, { class: 'lbl dim' }));
      c.g.appendChild(S('circle', { cx: c.x(20), cy: c.y(1), r: 6, fill: 'var(--ink)' }));
      c.g.appendChild(txt(c.x(20) - 12, c.y(1) + 4, 'anchor: 1×', { 'text-anchor': 'end', class: 'tiny' }));
      const ys = D.intensive.rows.map((r) => c.y(r.ratio)), ymid = (ys[0] + ys[2]) / 2;
      D.intensive.rows.forEach((r, i) => {
        const O = OUT[r.k], y = ys[i], yl = ymid + (i - 1) * 18, xd = c.x(40) + (i - 1) * 9;
        // delta-method SE of the ratio, the two groups treated as independent samples
        const seR = r.ratio * Math.sqrt(Math.pow(r.se40 / r.b40, 2) + Math.pow(r.se20 / r.b20, 2));
        whisker(c.g, xd, c.y(Math.min(4.55, r.ratio + 1.96 * seR)), c.y(r.ratio - 1.96 * seR), O.c);
        c.g.appendChild(S('line', { x1: xd + 7, y1: y, x2: c.x(40) + 30, y2: yl, stroke: O.c, 'stroke-width': 1 }));
        c.g.appendChild(S('circle', { cx: xd, cy: y, r: 6, fill: O.c, stroke: 'var(--paper)', 'stroke-width': 2 }));
        c.g.appendChild(txt(c.x(40) + 34, yl + 4, `${O.name} ${r.ratio.toFixed(2)}×`, { class: 'lbl', fill: O.c }));
      });
      el.append(wrap(c.svg), cap('Observed: the ±40% response divided by the ±20% response, from the estimates two slides back. Whiskers: delta-method 95% intervals, the two groups treated as independent. Benchmarks: a response linear in the uncertainty doubles; the Kimball precautionary premium is proportional to the variance and quadruples. Stylised curves, measured dots.'));
    };

    // =====================================================================
    // budget: Jasmine's split moved by the estimates
    // =====================================================================
    CH.budget = (el) => {
      const inc = D.jasmine.income, base = D.jasmine.split;
      const W = 1000, H = 300, bx = 20, by = 110, bh = 96, scale = (W - 40) / 100;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
      const rows = Object.fromEntries(D.intensive.rows.map((r) => [r.k, r]));
      const segs = KEYS.map((k) => ({ k, rect: S('rect', { y: by, height: bh, fill: OUT[k].c, 'fill-opacity': 0.9 }), name: txt(0, by - 34, OUT[k].name, { class: 'lbl', 'text-anchor': 'middle' }), val: txt(0, by - 14, '', { class: 'lbl-mono', 'text-anchor': 'middle' }), delta: txt(0, by + bh + 24, '', { class: 'lbl', 'text-anchor': 'middle' }), share: txt(0, by + bh / 2 + 5, '', { class: 'lbl onbar', 'text-anchor': 'middle', 'font-size': 15 }) }));
      segs.forEach((s) => svg.append(s.rect, s.name, s.val, s.delta, s.share));
      svg.appendChild(txt(bx, by + bh + 64, `Monthly income ${eur(inc)}. Bar width = share of the budget.`, { class: 'lbl dim' }));
      const ghost = KEYS.map(() => S('line', { y1: by - 6, y2: by + bh + 6, stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', opacity: 0 }));
      ghost.forEach((g) => svg.appendChild(g));
      let cur = Object.fromEntries(KEYS.map((k) => [k, rows[k].b40]));
      const draw = (b) => {
        let x = bx, xb = bx;
        segs.forEach((s, i) => {
          const sh = base[s.k] * Math.exp(b[s.k]), w = sh * scale, wb = base[s.k] * scale;
          s.rect.setAttribute('x', x); s.rect.setAttribute('width', Math.max(0, w));
          const m = x + w / 2;
          s.name.setAttribute('x', m); s.val.setAttribute('x', m); s.delta.setAttribute('x', m); s.share.setAttribute('x', m);
          const lift = (i === 2) ? -44 : 0; // the narrow last segment labels one level up
          s.name.setAttribute('y', by - 34 + lift); s.val.setAttribute('y', by - 14 + lift); s.delta.setAttribute('y', by + bh + 24 - lift);
          const euros = inc * sh / 100, d = euros - inc * base[s.k] / 100;
          s.val.textContent = eur(euros); s.share.textContent = sh.toFixed(1) + '%';
          s.delta.textContent = Math.abs(d) < 0.5 ? '' : (d > 0 ? '+' : '−') + eur(Math.abs(d)) + ' a month';
          s.delta.setAttribute('fill', OUT[s.k].c);
          ghost[i].setAttribute('x1', xb + wb); ghost[i].setAttribute('x2', xb + wb); ghost[i].setAttribute('opacity', Math.abs(w - wb) > 1 ? 1 : 0);
          x += w; xb += wb;
        });
      };
      draw(cur);
      const ctl = E('div', { class: 'ctl' });
      const go = (s) => {
        const to = s === 0 ? { spend: 0, save: 0, debt: 0 } : Object.fromEntries(KEYS.map((k) => [k, rows[k]['b' + s]]));
        const from = Object.assign({}, cur);
        L.tween(0, 1, 500, (t) => { cur = Object.fromEntries(KEYS.map((k) => [k, L.lerp(from[k], to[k], t)])); draw(cur); });
        press(ctl, (b) => +b.dataset.s === s);
      };
      for (const [t, s] of [['Guaranteed', 0], ['±20%', 20], ['±40%', 40]]) { const b = chip(t, s === 40, () => go(s)); b.dataset.s = s; ctl.appendChild(b); }
      el.append(wrap(svg), ctl, cap('Stylised level, measured slopes: Jasmine\'s 70 / 20 / 10 split is illustrative, and each category moves by the estimated log change from the first section. Dashed ticks mark the guaranteed-income split. The three moves are separate means, so the new shares need not sum to exactly 100.'));
    };

    // =====================================================================
    // paths: the two within-subject paths plotted against the level
    // =====================================================================
    CH.paths = (el) => {
      const YD = { spend: [-0.115, 0.015], save: [-0.015, 0.215], debt: [-0.015, 0.11] };
      const YT = { spend: [-0.10, -0.05, 0], save: [0, 0.05, 0.10, 0.15, 0.20], debt: [0, 0.05, 0.10] };
      const box = E('div', { class: 'chart-wrap' });
      const ctl = E('div', { class: 'ctl' });
      let key = 'save';
      const render = () => {
        const P = D.paths[key], O = OUT[key];
        const c = L.chart(680, 380, { l: 62, r: 30, t: 34, b: 46 }, [-4, 56], YD[key]);
        const arrowA = arrowDefs(c.svg, 'p-a-' + key, O.c), arrowB = arrowDefs(c.svg, 'p-b-' + key, 'var(--ink-2)');
        L.axisY(c, YT[key], (v) => L.fmtNum(v, 2), 'Δ log share vs guarantee');
        L.axisX(c, [0, 20, 40], (v) => (v ? '±' + v + '%' : 'guaranteed'), 'uncertainty the household faces');
        c.g.appendChild(S('line', { x1: c.m.l, x2: c.W - c.m.r, y1: c.y(0), y2: c.y(0), stroke: 'var(--ink-3)' }));
        // path A: 0 → 20 → 40 (group 1); path B: 0 → 40 → 20 (group 3). Slight x offsets so points at one level do not hide each other.
        const A = [[0, 0, 0], [20 - 2, P.at20.direct, P.at20.dse], [40 - 2, P.at40.via, P.at40.vse]];
        const B = [[0, 0, 0], [40 + 2, P.at40.direct, P.at40.dse], [20 + 2, P.at20.via, P.at20.vse]];
        const drawPath = (pts, color, dash, marker) => {
          for (let i = 1; i < pts.length; i++) {
            const x1 = c.x(pts[i - 1][0]), y1 = c.y(pts[i - 1][1]), x2 = c.x(pts[i][0]), y2 = c.y(pts[i][1]);
            c.g.appendChild(S('path', { d: `M${x1} ${y1} L${(x1 + x2) / 2} ${(y1 + y2) / 2} L${x2} ${y2}`, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-dasharray': dash, 'marker-mid': marker }));
          }
          pts.slice(1).forEach((p) => { whisker(c.g, c.x(p[0]), c.y(p[1] - 1.96 * p[2]), c.y(p[1] + 1.96 * p[2]), color); c.g.appendChild(S('circle', { cx: c.x(p[0]), cy: c.y(p[1]), r: 6, fill: color, stroke: 'var(--paper)', 'stroke-width': 2 })); });
        };
        drawPath(A, O.c, null, arrowA); drawPath(B, 'var(--ink-2)', '6 5', arrowB);
        c.g.appendChild(S('circle', { cx: c.x(0), cy: c.y(0), r: 6, fill: 'var(--ink)' }));
        // labels at the two end levels
        const lab = (x, v, color, side, dy, t) => c.g.appendChild(txt(c.x(x) + (side * 16), c.y(v) + dy, t, { class: 'lbl', fill: color, 'text-anchor': side > 0 ? 'start' : 'end' }));
        const m40 = (A[2][1] + B[1][1]) / 2, m20 = (A[1][1] + B[2][1]) / 2;
        lab(43, m40, O.c, 1, -8, `${sgn(P.at40.via)} after ±20`); lab(43, m40, 'var(--ink-2)', 1, 12, `${sgn(P.at40.direct)} direct`);
        lab(17, m20, O.c, -1, -8, `${sgn(P.at20.direct)} direct`); lab(17, m20, 'var(--ink-2)', -1, 12, `${sgn(P.at20.via)} after ±40`);
        box.replaceChildren(c.svg);
        leg.replaceChildren(E('span', { style: `--c:${O.c}`, text: 'group 1: ±20% then ±40% (solid)' }), E('span', { style: '--c:var(--ink-2)', text: 'group 3: ±40% then ±20% (dashed)' }));
        const d20 = P.at20, d40 = P.at40;
        note.innerHTML = `At ±40%: ${sgn(d40.direct)} direct vs ${sgn(d40.via)} after ±20, difference ${sgn(d40.diff)} (SE ${d40.diffse.toFixed(3)})${d40.sig ? ', significant' : ', not significant'}. At ±20%: ${sgn(d20.direct)} vs ${sgn(d20.via)}, difference ${sgn(d20.diff)} (SE ${d20.diffse.toFixed(3)})${d20.sig ? ', <b>significant at 5%</b>' : ', not significant'}.`;
        press(ctl, (b) => b.dataset.k === key);
      };
      const note = cap('');
      KEYS.forEach((k) => { const b = chip(OUT[k].name, k === key, () => { key = k; render(); }); b.dataset.k = k; ctl.appendChild(b); });
      const leg = E('div', { class: 'legend' });
      ctl.appendChild(E('span', { style: 'flex:1 1 auto' })); ctl.appendChild(leg);
      el.append(box, ctl, note);
      render();
    };

    // =====================================================================
    // pathdiff: via − direct at each level, six rows
    // =====================================================================
    CH.pathcomparison = (el) => {
      const svg = S('svg', { viewBox: '0 0 760 410', class: 'chart', role: 'img', 'aria-label': 'Paired responses at each final uncertainty level, with 95 percent confidence intervals' });
      const colors = ['var(--spend)', 'var(--save)', 'var(--debt)'];
      const names = ['Spending', 'Saving', 'Repayment'];
      ['at20', 'at40'].forEach((level, panel) => {
        const left = panel * 380, x0 = left + 100, width = 260;
        const x = (v) => x0 + (v + 0.12) / 0.36 * width;
        svg.appendChild(txt(left + 190, 27, `Final uncertainty: ±${level.slice(2)}%`, { 'text-anchor': 'middle', class: 'lbl', 'font-size': 20 }));
        svg.appendChild(S('line', { x1: x(0), x2: x(0), y1: 65, y2: 310, stroke: 'var(--ink-3)', 'stroke-dasharray': '4 4' }));
        KEYS.forEach((key, row) => {
          const p = D.paths[key][level], cy = 102 + row * 88;
          svg.appendChild(txt(x0 - 8, cy + 4, names[row], { 'text-anchor': 'end', class: 'lbl', 'font-size': 15 }));
          [['direct', 'dse', cy - 13, 'var(--ink-2)'], ['via', 'vse', cy + 13, colors[row]]].forEach(([field, seField, y, col]) => {
            const v = p[field], se = p[seField], lo = x(v - 1.96 * se), hi = x(v + 1.96 * se);
            svg.appendChild(S('line', { x1: lo, x2: hi, y1: y, y2: y, stroke: col, 'stroke-width': 2 }));
            [lo, hi].forEach((xx) => svg.appendChild(S('line', { x1: xx, x2: xx, y1: y - 5, y2: y + 5, stroke: col, 'stroke-width': 2 })));
            if (field === 'direct') svg.appendChild(S('circle', { cx: x(v), cy: y, r: 5, fill: col }));
            else svg.appendChild(S('path', { d: `M ${x(v)} ${y-6} L ${x(v)+6} ${y} L ${x(v)} ${y+6} L ${x(v)-6} ${y} Z`, fill: col }));
          });
        });
        svg.appendChild(S('line', { x1: x0, x2: x0 + width, y1: 321, y2: 321, stroke: 'var(--ink-3)' }));
        [-0.1, 0, 0.1, 0.2].forEach((v) => {
          svg.appendChild(S('line', { x1: x(v), x2: x(v), y1: 321, y2: 326, stroke: 'var(--ink-3)' }));
          svg.appendChild(txt(x(v), 347, (v * 100).toFixed(0) + '%', { 'text-anchor': 'middle', class: 'lbl', 'font-size': 14 }));
        });
      });
      svg.appendChild(txt(380, 385, 'Change from guaranteed income (log-share change ×100)', { 'text-anchor': 'middle', class: 'lbl', 'font-size': 17 }));
      el.append(wrap(svg));
    };

    CH.pathspending = (el) => {
      const P = D.paths.spend.at20;
      const c = L.chart(620, 360, { l: 70, r: 25, t: 28, b: 70 }, [0, 3], [-0.075, 0]);
      L.axisY(c, [-0.06, -0.04, -0.02, 0], (v) => (100 * v).toFixed(0) + '%', 'Spending share: change from guarantee');
      L.axisX(c, [1, 2], (v) => v === 1 ? '±20% directly' : '±40% then ±20%', 'Same final uncertainty: ±20%');
      [[1, P.direct, P.dse, 'var(--ink-2)'], [2, P.via, P.vse, 'var(--spend)']].forEach(([x, v, se, col]) => {
        whisker(c.g, c.x(x), c.y(v - 1.96 * se), c.y(v + 1.96 * se), col);
        c.g.appendChild(S('circle', { cx: c.x(x), cy: c.y(v), r: 7, fill: col }));
        c.g.appendChild(txt(c.x(x) + 14, c.y(v) + 5, (100 * v).toFixed(1) + '%', { class: 'lbl', fill: col }));
      });
      el.append(wrap(c.svg), cap('Approximate percent changes in allocation shares; 95% confidence intervals.'));
    };

    CH.pathdiff = (el) => {
      const rows = [];
      for (const lvl of ['at20', 'at40']) for (const k of KEYS) { const p = D.paths[k][lvl]; rows.push({ k, lvl, label: `${OUT[k].name}, ends at ±${lvl.slice(2)}%`, beta: p.diff, se: p.diffse, sig: p.sig }); }
      const W = 680, rowH = 44, top = 30, H = top + rows.length * rowH + 50;
      const lo = Math.min(...rows.map((r) => r.beta - 1.96 * r.se)), hi = Math.max(...rows.map((r) => r.beta + 1.96 * r.se)), pad = (hi - lo) * 0.1;
      const c = L.chart(W, H, { l: 215, r: 110, t: top, b: 40 }, [lo - pad, hi + pad], [0, 1]);
      L.axisX(c, [-0.05, 0, 0.05], (v) => L.fmtNum(v, 2), 'difference in Δ log share: via the other level − direct');
      c.g.appendChild(S('line', { x1: c.x(0), x2: c.x(0), y1: top - 10, y2: H - c.m.b, stroke: 'var(--ink-3)' }));
      rows.forEach((r, i) => {
        const y = top + i * rowH, mid = y + rowH / 2, l = r.beta - 1.96 * r.se, h = r.beta + 1.96 * r.se, dead = !r.sig;
        c.g.appendChild(txt(c.m.l - 12, mid + 5, r.label, { 'text-anchor': 'end', class: 'lbl', fill: dead ? 'var(--ink-3)' : 'var(--ink)' }));
        const bar = S('rect', { x: Math.min(c.x(0), c.x(r.beta)), y: y + 9, width: Math.abs(c.x(r.beta) - c.x(0)), height: rowH - 18, rx: 2, fill: dead ? 'var(--paper)' : OUT[r.k].c, stroke: dead ? 'var(--ink-3)' : 'none', 'stroke-width': 1.5 });
        c.g.appendChild(bar);
        c.g.appendChild(S('line', { x1: c.x(l), x2: c.x(h), y1: mid, y2: mid, stroke: 'var(--ink)', 'stroke-width': 2 }));
        for (const v of [l, h]) c.g.appendChild(S('line', { x1: c.x(v), x2: c.x(v), y1: mid - 6, y2: mid + 6, stroke: 'var(--ink)', 'stroke-width': 2 }));
        c.g.appendChild(txt(c.x(Math.max(h, 0)) + 10, mid + 5, sgn(r.beta), { class: 'lbl-mono', fill: dead ? 'var(--ink-3)' : 'var(--ink)' }));
      });
      el.append(wrap(c.svg), cap('Difference between the response of a household that reached a level via the other level and one that faced it directly, with 95% intervals. Hollow bars are not distinguishable from zero in the source tables; the filled bar is significant at 5%. Groups 1 and 3, 219 to 479 respondents per cell.'));
    };

    // =====================================================================
    // ambiguity: known-odds response, then the known → unknown step (build-in)
    // =====================================================================
    CH.ambiguity = (el, o) => {
      const c = L.chart(680, 380, { l: 60, r: 16, t: 34, b: 44 }, [0, 6], [-0.08, 0.16]);
      L.axisY(c, [-0.05, 0, 0.05, 0.10, 0.15], (v) => L.fmtNum(v, 2), 'Δ log share');
      const zero = c.y(0);
      c.g.appendChild(S('line', { x1: c.m.l, x2: c.W - c.m.r, y1: zero, y2: zero, stroke: 'var(--ink-2)' }));
      const bw = 38, items = [];
      let i = 0;
      for (const s of ['s20', 's40']) for (const k of KEYS) {
        const A = D.ambiguity[s][k], O = OUT[k], gx = c.x(i + 0.5);
        c.g.appendChild(txt(gx, c.H - c.m.b + 16, O.name, { 'text-anchor': 'middle', class: 'lbl', 'font-size': 12 }));
        c.g.appendChild(txt(gx, c.H - c.m.b + 31, '±' + s.slice(1) + '%', { 'text-anchor': 'middle', class: 'tiny' }));
        [['known', gx - bw / 2 - 3, A.known, A.kse, A.ksig, O.c], ['fog', gx + bw / 2 + 3, A.fog, A.fse, A.fsig, 'var(--fog)']].forEach(([ph, x, v, e, ok, col]) => {
          const rect = S('rect', { x: x - bw / 2, width: bw, y: zero, height: 0, fill: ok ? col : 'var(--paper)', stroke: col, 'stroke-width': ok ? 0 : 2 });
          const lab = txt(x, 0, '', { 'text-anchor': 'middle', class: 'lbl', 'font-size': 11, fill: ph === 'fog' ? 'var(--fog)' : 'var(--ink)' });
          const wg = S('g'); c.g.append(rect, wg, lab);
          lab.setAttribute('x', x + (ph === 'known' ? -5 : 5)); // nudged apart so two small labels at one height do not touch
          items.push({ ph, rect, lab, wg, v, e, x, above: v >= 0 });
        });
        i++;
      }
      c.g.appendChild(S('line', { x1: c.x(3), x2: c.x(3), y1: c.m.t - 6, y2: c.H - c.m.b + 34, stroke: 'var(--line)' }));
      const draw = (kK, kF) => items.forEach((it) => {
        const k = it.ph === 'known' ? kK : kF, v = it.v * k;
        it.rect.setAttribute('y', c.y(Math.max(0, v))); it.rect.setAttribute('height', Math.abs(c.y(v) - zero));
        it.wg.replaceChildren();
        if (k >= 0.999) whisker(it.wg, it.x, c.y(it.v - 1.96 * it.e), c.y(it.v + 1.96 * it.e), it.ph === 'fog' ? 'var(--fog)' : 'var(--ink)');
        const yl = it.above ? c.y(Math.max(it.v, 0) + 1.96 * it.e) - 7 : c.y(Math.min(it.v, 0) - 1.96 * it.e) + 15;
        it.lab.setAttribute('y', yl); it.lab.textContent = k >= 0.999 ? sgn(it.v) : '';
      });
      const leg = legend([{ c: 'var(--spend)', t: 'spending' }, { c: 'var(--save)', t: 'saving' }, { c: 'var(--debt)', t: 'debt repayment: stage 1, guarantee → known odds' }, { c: 'var(--fog)', t: 'stage 2: known odds → odds withdrawn' }]);
      el.append(wrap(c.svg), leg, cap('Groups 2 and 4 only, so the stage-1 bars differ from the pooled estimates of section 1. Hollow bars are not distinguishable from zero in the source table. 212 to 486 respondents per bar.'));
      if (!o.animate) { draw(1, 1); return; }
      draw(0, 0);
      let t = null;
      L.tween(0, 1, 900, (k) => draw(k, 0), () => { t = setTimeout(() => L.tween(0, 1, 900, (k) => draw(1, k)), 900); });
      return () => { if (t) clearTimeout(t); };
    };

    // =====================================================================
    // retain: share with no change when the odds are withdrawn
    // =====================================================================
    CH.retain = (el) => {
      const W = 1000, H = 300, left = 150, right = 230, rowH = 38, top = 24;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
      const sx = (v) => left + v / 100 * (W - left - right);
      const hat = {};
      let i = 0;
      for (const s of ['s20', 's40']) {
        svg.appendChild(txt(left, top + i * rowH - 4, `odds withdrawn at ±${s.slice(1)}%`, { class: 'axis-label' }));
        for (const k of KEYS) {
          const R = D.counter[s][k], O = OUT[k], y = top + i * rowH + 4;
          if (!hat[k]) hat[k] = L.hatch(svg, 'rt-h-' + k, O.c);
          svg.appendChild(txt(left - 10, y + 19, O.name, { 'text-anchor': 'end', class: 'lbl' }));
          svg.appendChild(S('rect', { x: sx(0), y, width: sx(R.none) - sx(0), height: 28, fill: 'var(--paper-3)', stroke: 'var(--line)' }));
          svg.appendChild(txt(sx(R.none) - 8, y + 19, `${R.none}% keep their split`, { 'text-anchor': 'end', class: 'lbl', 'font-size': 14 }));
          svg.appendChild(S('rect', { x: sx(R.none), y, width: sx(R.inc) - sx(0), height: 28, fill: O.c }));
          svg.appendChild(S('rect', { x: sx(R.none + R.inc), y, width: sx(R.dec) - sx(0), height: 28, fill: hat[k], stroke: O.c }));
          svg.appendChild(txt(sx(100) + 10, y + 19, `${R.inc}% up · ${R.dec}% down`, { class: 'lbl-mono', 'font-size': 13 }));
          i++;
        }
        i += 0.5;
      }
      el.append(wrap(svg), cap('Direction of the stage-2 adjustment when the odds are withdrawn, as a share of respondents in groups 2 and 4. Grey: no change. Solid: increased the share. Hatched: decreased it. 209 to 365 respondents keep their split in each row.'));
    };

    // =====================================================================
    // tug: increase and decrease contributions to the mean, which cancel
    // =====================================================================
    CH.tug = (el) => {
      const c = L.chart(1000, 340, { l: 70, r: 16, t: 30, b: 64 }, [0, 6], [-0.085, 0.085]);
      L.axisY(c, [-0.08, -0.04, 0, 0.04, 0.08], (v) => L.fmtNum(v, 2), 'contribution to mean Δ log share');
      const zero = c.y(0);
      c.g.appendChild(S('line', { x1: c.m.l, x2: c.W - c.m.r, y1: zero, y2: zero, stroke: 'var(--ink-2)' }));
      const bw = 80, hat = {};
      let i = 0;
      for (const s of ['s20', 's40']) for (const k of KEYS) {
        const R = D.counter[s][k], O = OUT[k], x = c.x(i + 0.5);
        if (!hat[k]) hat[k] = L.hatch(c.svg, 'tug-h-' + k, O.c);
        c.g.appendChild(S('rect', { x: x - bw / 2, width: bw, y: c.y(R.cInc), height: zero - c.y(R.cInc), fill: O.c }));
        c.g.appendChild(S('rect', { x: x - bw / 2, width: bw, y: zero, height: c.y(R.cDec) - zero, fill: hat[k], stroke: O.c }));
        c.g.appendChild(txt(x, c.y(R.cInc) - 6, `${sgn(R.cInc)} from ${R.inc}%`, { 'text-anchor': 'middle', class: 'lbl', 'font-size': 12 }));
        c.g.appendChild(txt(x, c.y(R.cDec) + 15, `${sgn(R.cDec)} from ${R.dec}%`, { 'text-anchor': 'middle', class: 'lbl', 'font-size': 12 }));
        const net = R.cInc + R.cDec;
        c.g.appendChild(S('line', { x1: x - bw / 2 - 6, x2: x + bw / 2 + 6, y1: c.y(net), y2: c.y(net), stroke: 'var(--ink)', 'stroke-width': 3 }));
        c.g.appendChild(txt(x, c.H - c.m.b + 16, O.name, { 'text-anchor': 'middle', class: 'lbl', 'font-size': 12 }));
        c.g.appendChild(txt(x, c.H - c.m.b + 30, '±' + s.slice(1) + '%', { 'text-anchor': 'middle', class: 'tiny' }));
        c.g.appendChild(txt(x, c.H - c.m.b + 46, 'net ' + sgn(net), { 'text-anchor': 'middle', class: 'lbl', 'font-size': 13 }));
        i++;
      }
      c.g.appendChild(S('line', { x1: c.x(3), x2: c.x(3), y1: c.m.t - 6, y2: c.H - c.m.b + 34, stroke: 'var(--line)' }));
      el.append(wrap(c.svg), cap('Each direction\'s contribution to the mean log change, with the share of respondents who moved that way ("+0.064 from 12.9%": the 12.9% who raised their saving share add 0.064 to the mean). Solid: increased. Hatched: decreased. The black tick is the sum, the average effect two slides back.'));
    };

    // =====================================================================
    // Wiring
    // =====================================================================
    const draw = (el, animate) => {
      if (el._cleanup) { try { el._cleanup(); } catch (e) { /* noop */ } el._cleanup = null; }
      el.replaceChildren();
      const fn = CH[el.dataset.chart];
      if (!fn) { el.appendChild(E('p', { class: 'caption', text: 'unknown chart: ' + el.dataset.chart })); console.error('deck-charts.js: unknown chart ' + el.dataset.chart); return; }
      try { el._cleanup = fn(el, { animate: !!animate }) || null; }
      catch (e) { console.error('deck-charts.js: ' + el.dataset.chart, e); el.appendChild(E('p', { class: 'caption', text: 'This chart failed to draw.' })); }
    };

    const title = document.getElementById('title-slide');
    if (title && !title.querySelector('.stage')) title.appendChild(E('div', { class: 'stage glyph strip', 'data-chart': 'strip', 'data-state': 'before' }));
    document.querySelectorAll('.stage[data-chart]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) b.blur(); });
      el.addEventListener('pointerup', () => { const a = document.activeElement; if (a && a.tagName === 'INPUT') a.blur(); });
      draw(el, false);
    });
    const animateIn = (section) => {
      if (STATIC || !section) return;
      section.querySelectorAll('.stage[data-animate]').forEach((el) => {
        if (el.dataset.animate === 'once' && el._played) return;
        el._played = true; draw(el, true);
      });
    };
    document.querySelectorAll('.data[data-key]').forEach((sp) => {
      const v = L.get(sp.dataset.key);
      if (v === undefined) { console.error('deck-charts.js: no L.DATA entry for ' + sp.dataset.key); sp.textContent = '?'; return; }
      let n = v;
      if (typeof n === 'number' && sp.dataset.mul) n *= +sp.dataset.mul;
      if (typeof n === 'number' && sp.dataset.abs) n = Math.abs(n);
      sp.textContent = typeof n === 'number' && sp.dataset.d !== undefined ? L.fmtNum(n, +sp.dataset.d) : String(v);
    });
    if (window.Reveal && typeof Reveal.on === 'function') {
      Reveal.on('slidechanged', (e) => animateIn(e.currentSlide));
      if (typeof Reveal.getCurrentSlide === 'function') animateIn(Reveal.getCurrentSlide());
    }
  }

  const start = () => {
    if (window.Reveal && typeof Reveal.isReady === 'function' && Reveal.isReady()) main();
    else if (window.Reveal && typeof Reveal.on === 'function') Reveal.on('ready', main);
    else main();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
