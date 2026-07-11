/* ===========================================================================
 * Copyright (C) 2021 CapsicoHealth Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { FloriaDOM } from "./module-dom.js";

FloriaDOM.injectCSSLink("FLORIA_CSS_ANCHOR", true, new URL("./module-charts2-funnel.css", import.meta.url).pathname);

// Inject the funnel-graph-js stylesheet (renders .svg-funnel-js labels & layout)
(function _injectFunnelGraphCSS() {
  const href = 'https://cdn.jsdelivr.net/npm/d3-funnel-graph@1.1.3/dist/css/funnel-graph.min.css';
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}());

// Load the UMD bundle once, shared across all instances.
// d3-funnel-graph has no native ESM export so we inject a <script> tag.
const _fgReady = new Promise((resolve, reject) => {
  if (window.FunnelGraph) { resolve(window.FunnelGraph); return; }
  const s   = document.createElement('script');
  s.src     = 'https://cdn.jsdelivr.net/npm/d3-funnel-graph@1.1.3/dist/js/funnel-graph.min.js';
  s.onload  = () => resolve(window.FunnelGraph);
  s.onerror = () => reject(new Error('Failed to load d3-funnel-graph'));
  document.head.appendChild(s);
});


// ============================================================================
// Default callback implementations — sensible out-of-the-box behavior that
// callers can override selectively.
// ============================================================================

const DEFAULTS = {

  /**
   * Minimum pixel size used as a safety floor when the container reports zero
   * dimensions (e.g. not yet laid out).  The chart otherwise fills the container.
   */
  minSize: 100,

  /**
   * Explicit pixel width for the chart.  null = derive from container offsetWidth.
   * @type {number|null}
   */
  width: null,

  /**
   * Explicit pixel height for the chart.  null = derive from container offsetHeight.
   * @type {number|null}
   */
  height: null,

  /**
   * Layout direction of the funnel.
   * `'horizontal'` — the waveform / left-to-right river look (default).
   * `'vertical'`   — traditional top-to-bottom funnel.
   * @type {'horizontal'|'vertical'}
   */
  direction: 'horizontal',

  /**
   * Direction of the gradient fill within each block.
   * @type {'horizontal'|'vertical'}
   */
  gradientDirection: 'horizontal',

  /**
   * When true a percentage drop label is shown between consecutive blocks.
   * @type {boolean}
   */
  displayPercent: true,

  /**
   * Whether to render labels alongside the funnel blocks.
   * @type {boolean}
   */
  labelEnabled: true,

  /**
   * Controls what the sub-label beneath each step name shows.
   * `'percent'` — percentage of the previous step (default).
   * `'value'`   — raw numeric value.
   * @type {'percent'|'value'}
   */
  subLabelValue: 'percent',

  /**
   * When set, overrides all per-block colors and paints the entire funnel waveform
   * with a single smooth gradient.  Controlled by the **caller** — not applied by default.
   *
   * ```js
   * waveGradient: { start: '#3b6fce', end: '#a8d0f5', direction: 'horizontal' }
   * ```
   *
   * @type {{start:string, end:string, direction?:'horizontal'|'vertical'}|null}
   */
  waveGradient: null,

  /**
   * Callback to customise the sub-label text shown beneath each step's title.
   * Return an HTML string to replace the library's default sub-label content.
   * Return `null` or `undefined` to leave the default in place.
   *
   * ```js
   * labelSubText: b => `${b.value.toLocaleString()} · ${b._pct}%`
   * ```
   *
   * @param {object} block — enriched block data.
   * @returns {string|null}
   */
  labelSubText: null,

  // --- Color callbacks ---

  /**
   * Fill color(s) for a funnel block.
   * Return a single CSS color string for a solid fill, or a
   * `[color1, color2]` pair to produce a two-stop gradient.
   * @param {object} block — enriched block (`.label`, `.value`, `.index`, `._pct`, plus any meta).
   * @returns {string|[string,string]}
   */
  blockColor: (block) => {
    const GRADIENTS = [
      ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7'],
      ['#fa709a', '#fee140'],
      ['#a18cd1', '#fbc2eb'],
      ['#fccb90', '#d57eeb'],
      ['#a1c4fd', '#c2e9fb'],
      ['#fd7f6f', '#b2e061'],
      ['#84fab0', '#8fd3f4'],
      ['#ffecd2', '#fcb69f'],
      ['#ff9a9e', '#fad0c4'],
    ];
    return GRADIENTS[block.index % GRADIENTS.length];
  },

  // --- Tooltip callbacks ---

  /**
   * HTML content for a block tooltip.  Return null or `""` to suppress.
   * @param {object} block — enriched block data.
   * @returns {string|null}
   */
  blockTooltipHTML: (block) => {
    const pct = block._pct != null ? `<br/>${block._pct}% of top` : '';
    return `<strong>${block.label ?? ''}</strong><br/>Value: ${(block.value ?? 0).toLocaleString()}${pct}`;
  },

  // --- Event callbacks ---

  /**
   * Called when a block is clicked.
   * @param {MouseEvent} event
   * @param {object}     block — enriched block data.
   */
  onBlockClick: null,
};


// ============================================================================
// FunnelChart — generic, domain-agnostic funnel diagram renderer.
// ============================================================================

/**
 * A reusable, domain-agnostic funnel chart component built on d3-funnel-graph
 * (funnel-graph-js).  Renders a beautiful horizontal waveform-style funnel or
 * a traditional vertical funnel depending on the `direction` option.
 *
 * ### Minimal usage
 * ```js
 * import { FunnelChart } from './module-charts2-funnel.js';
 *
 * const chart = new FunnelChart('my-container', {
 *   steps: [
 *     { label: 'Total',     value: 1000 },
 *     { label: 'Qualified', value:  600 },
 *     { label: 'Converted', value:  200 },
 *   ],
 * });
 * chart.render();
 * ```
 *
 * ### Full control
 * ```js
 * const chart = new FunnelChart('my-container', {
 *   steps,
 *   options: {
 *     direction:        'horizontal',
 *     displayPercent:   true,
 *     blockColor:       b => b.mandatory ? ['#3a3f47', '#5a6070'] : ['#4facfe', '#00f2fe'],
 *     blockTooltipHTML: b => `<b>${b.label}</b><br/>${b.value.toLocaleString()} patients`,
 *     onBlockClick:     (ev, b) => console.log('clicked', b),
 *   }
 * });
 * chart.render();
 * ```
 */
export class FunnelChart {

  /**
   * @param {string} containerId — DOM id of the element to render into.
   * @param {object} spec
   * @param {Array}  spec.steps    — array of step objects; each MUST have `label` (string) and
   *                                 `value` (number).  Any extra fields are carried through to callbacks.
   * @param {object} [spec.options] — partial overrides of {@link DEFAULTS}.
   */
  constructor(containerId, { steps, options = {} }) {
    this.containerId  = containerId;
    this.steps        = steps;
    this.opts         = Object.assign({}, DEFAULTS, options);
    this._funnelGraph = null;   // underlying FunnelGraph instance
    this._tooltipEl   = null;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Render (or re-render) the funnel into the container.
   * Safe to call repeatedly — the container is cleared each time.
   * Returns a Promise that resolves to `this` once the library is loaded and the chart is drawn.
   */
  async render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`FunnelChart: container '${this.containerId}' not found`);
      return;
    }

    this._destroyFunnelGraph(container);
    container.innerHTML = '';
    container.classList.add('funnel-chart');

    if (!this.steps || this.steps.length === 0) {
      this._renderEmpty(container);
      return;
    }

    const o  = this.opts;
    const cw = container.offsetWidth  || o.minSize;
    const ch = container.offsetHeight || o.minSize;

    // ---- Enrich step objects with index & percentage ----
    const topValue = this.steps[0]?.value || 1;
    const enriched = this.steps.map((s, i) => ({
      ...s,
      index:          i,
      formattedValue: (s.value ?? 0).toLocaleString(),
      _pct:           i === 0 ? 100 : Math.round(((s.value ?? 0) / topValue) * 100),
    }));

    // ---- Build funnel-graph-js data ----
    // colors: array of [color1, color2] per step (single color → duplicate into pair)
    const labels = enriched.map(b => b.label);
    const values = enriched.map(b => b.value);
    const colors = enriched.map(b => {
      const c = o.blockColor(b);
      return Array.isArray(c) ? c : [c, c];
    });

    // ---- Load library ----
    let FunnelGraph;
    try {
      FunnelGraph = await _fgReady;
    } catch (err) {
      console.error('FunnelChart: could not load chart library:', err);
      container.innerHTML = '<div style="color:#c00;padding:20px;text-align:center;">Could not load chart library.</div>';
      return;
    }

    // ---- Instantiate and draw ----
    this._funnelGraph = new FunnelGraph({
      container:         `#${CSS.escape(this.containerId)}`,
      gradientDirection: o.gradientDirection,
      data: {
        labels,
        colors,
        values,
      },
      displayPercent: o.displayPercent,
      direction:      o.direction,
      width:          o.width  ?? cw,
      height:         o.height ?? ch,
      subLabelValue:  o.subLabelValue,
    });
    this._funnelGraph.draw();

    // Make the waveform fit exactly in the space *below* the labels, instead of
    // being pushed down (and clipped) by the label row's height.
    //
    // funnel-graph-js lays the label row and the SVG out in normal flow, then
    // sizes the SVG to the full container height — so labels + SVG overflow and
    // the bottom of the wave gets clipped.  We fix this by:
    //   1. turning the wrapper into a flex column,
    //   2. giving the SVG a viewBox (+ preserveAspectRatio:none) so its drawn
    //      geometry scales to whatever box CSS gives it,
    //   3. letting the SVG flex to fill all remaining height under the labels.
    const _wrapEl = container.querySelector('.svg-funnel-js');
    const _svgEl  = container.querySelector('svg');
    if (_wrapEl && _svgEl) {
      const vbW = parseFloat(_svgEl.getAttribute('width'))  || cw;
      const vbH = parseFloat(_svgEl.getAttribute('height')) || ch;
      _svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
      _svgEl.setAttribute('preserveAspectRatio', 'none');

      _wrapEl.style.display       = 'flex';
      _wrapEl.style.flexDirection = 'column';
      _wrapEl.style.height        = '100%';

      _svgEl.style.flex      = '1 1 auto';
      _svgEl.style.width     = '100%';
      _svgEl.style.height    = 'auto';
      _svgEl.style.minHeight = '0';
    }

    // ---- Optional wave-gradient overlay ----
    if (o.waveGradient) {
      this._applyWaveGradient(container, o.waveGradient);
    }

    // ---- Optional custom sub-label text ----
    if (o.labelSubText) {
      this._applyLabelSubText(container, enriched, o.labelSubText);
    }

    // Hide the library's default labels if labelEnabled is false
    if (!o.labelEnabled) {
      const labelsEl = container.querySelector('.svg-funnel-js__labels');
      if (labelsEl) labelsEl.style.display = 'none';
    }

    // ---- Wire up custom tooltips & click handlers ----
    this._bindEvents(container, enriched, o);

    return this;
  }

  /**
   * Replace steps and re-render.
   * @param {Array} steps
   * @returns {Promise<FunnelChart>}
   */
  update(steps) {
    this.steps = steps;
    return this.render();
  }

  /**
   * Remove the rendered chart and clean up the tooltip element.
   */
  destroy() {
    const container = document.getElementById(this.containerId);
    this._destroyFunnelGraph(container);
    if (this._tooltipEl) { this._tooltipEl.remove(); this._tooltipEl = null; }
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  _destroyFunnelGraph(container) {
    if (this._funnelGraph) {
      try { this._funnelGraph.destroy(); } catch (_) { /* some versions lack destroy() */ }
      this._funnelGraph = null;
    }
    if (container) container.innerHTML = '';
  }

  /**
   * Overlay D3 mouse listeners on the funnel-graph-js segment elements so we
   * can show our custom tooltip and fire the click callback with enriched data.
   *
   * funnel-graph-js renders each block as a <path> with a `data-index` attribute
   * inside the `.svg-funnel-js` wrapper SVG.
   */
  _bindEvents(container, enriched, o) {
    const chart = this;  // capture for use inside non-arrow callbacks

    d3.select(container)
      .selectAll('[data-index]')
      .each(function () {
        // `this` is the DOM element (D3 default — no .bind() override here)
        const i = parseInt(this.dataset.index, 10);
        if (isNaN(i)) return;
        const block = enriched[i];
        if (!block) return;

        d3.select(this)
          .on('mouseover.funnel', (event) => {
            const html = o.blockTooltipHTML(block);
            if (html) chart._showTooltip(event, html);
          })
          .on('mousemove.funnel', (event) => chart._moveTooltip(event))
          .on('mouseout.funnel',  ()      => chart._hideTooltip());

        if (o.onBlockClick) {
          d3.select(this)
            .classed('funnel-clickable', true)
            .on('click.funnel', (event) => o.onBlockClick(event, block));
        }
      });
  }

  /**
   * Inject a single SVG `<linearGradient>` that spans the full funnel and apply it
   * as the fill for every block path.  This creates a unified gradient wash across
   * the entire waveform instead of per-block colors.
   *
   * @param {HTMLElement} container
   * @param {{start:string, end:string, direction?:'horizontal'|'vertical'}} wg
   */
  _applyWaveGradient(container, wg) {
    const svg = container.querySelector('svg');
    if (!svg) return;

    const svgW   = parseFloat(svg.getAttribute('width'))  || container.offsetWidth  || 300;
    const svgH   = parseFloat(svg.getAttribute('height')) || container.offsetHeight || 200;
    const dir    = wg.direction || 'horizontal';
    // Use a safe id: strip anything that isn't word-char or hyphen
    const gradId = 'fwg_' + this.containerId.replace(/[^\w-]/g, '_');
    const NS     = 'http://www.w3.org/2000/svg';

    // Ensure <defs> exists as first child of <svg>
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }

    // Replace any previous gradient we created (re-render safety)
    const prev = defs.querySelector(`[id="${gradId}"]`);
    if (prev) prev.remove();

    const grad = document.createElementNS(NS, 'linearGradient');
    grad.setAttribute('id',            gradId);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute('x1', '0');
    grad.setAttribute('y1', '0');
    grad.setAttribute('x2', dir === 'horizontal' ? String(svgW) : '0');
    grad.setAttribute('y2', dir === 'horizontal' ? '0' : String(svgH));

    const s1 = document.createElementNS(NS, 'stop');
    s1.setAttribute('offset',     '0%');
    s1.setAttribute('stop-color', wg.start || '#4facfe');
    grad.appendChild(s1);

    const s2 = document.createElementNS(NS, 'stop');
    s2.setAttribute('offset',     '100%');
    s2.setAttribute('stop-color', wg.end   || '#00f2fe');
    grad.appendChild(s2);

    defs.appendChild(grad);

    // Apply gradient fill to every funnel block path.
    // Use inline style so it wins over the library's presentational fill attribute.
    svg.querySelectorAll('path').forEach(path => {
      path.style.fill = `url(#${gradId})`;
    });
  }

  /**
   * Post-process the rendered label DOM to replace each step's sub-label with
   * custom HTML produced by the `labelSubText` callback.
   *
   * The library renders `.svg-funnel-js__label` wrappers, one per step, each
   * containing a `.label__value` element for the sub-label text.
   *
   * @param {HTMLElement} container
   * @param {Array}       enriched  — enriched block objects (ordered by index)
   * @param {Function}    callback  — `(block) => string|null`
   */
  _applyLabelSubText(container, enriched, callback) {
    const labelEls = container.querySelectorAll('.svg-funnel-js__label');
    labelEls.forEach((el, i) => {
      const block = enriched[i];
      if (!block) return;
      const text = callback(block);
      if (text == null) return;
      // Try both possible class names used by different versions of the library
      const valueEl = el.querySelector('.label__value')
                   || el.querySelector('.svg-funnel-js__label__value');
      if (valueEl) valueEl.innerHTML = text;
    });
  }

  _renderEmpty(container) {
    container.innerHTML = `
      <div class="funnel-empty">
        <div class="funnel-empty-icon">⬦</div>
        <div class="funnel-empty-message">No data to display</div>
      </div>`;
  }

  _ensureTooltip() {
    if (!this._tooltipEl) {
      this._tooltipEl = document.createElement('div');
      this._tooltipEl.className = 'funnel-tooltip';
      document.body.appendChild(this._tooltipEl);
    }
    return this._tooltipEl;
  }

  _showTooltip(event, html) {
    if (!html) return;
    const tip = this._ensureTooltip();
    tip.innerHTML      = html;
    tip.style.display  = 'block';
    tip.style.left     = (event.clientX + 14) + 'px';
    tip.style.top      = (event.clientY + 14) + 'px';
  }

  _moveTooltip(event) {
    if (this._tooltipEl && this._tooltipEl.style.display !== 'none') {
      this._tooltipEl.style.left = (event.clientX + 14) + 'px';
      this._tooltipEl.style.top  = (event.clientY + 14) + 'px';
    }
  }

  _hideTooltip() {
    if (this._tooltipEl) this._tooltipEl.style.display = 'none';
  }
}


// ============================================================================
// FunnelDataBuilder — optional helper to programmatically construct step arrays
// using a fluent API.
// ============================================================================

/**
 * Convenience builder for constructing `steps` data for {@link FunnelChart}.
 *
 * ```js
 * const b = new FunnelDataBuilder();
 * b.addStep('Total Population', 10000);
 * b.addStep('Screened',          7500, { cohort: 'screened' });
 * b.addStep('Eligible',          4000, { cohort: 'eligible' });
 * b.addStep('Enrolled',          1200, { cohort: 'enrolled' });
 * const chart = new FunnelChart('my-container', { steps: b.build() });
 * chart.render();
 * ```
 */
export class FunnelDataBuilder {

  constructor() {
    /** @type {Array<{label:string, value:number}>} */
    this._steps = [];
  }

  /**
   * Append a step to the funnel (top → bottom / left → right order).
   * @param {string} label   — display name for this step.
   * @param {number} value   — numeric size of this step.
   * @param {object} [meta]  — arbitrary extra fields carried through to callbacks.
   * @returns {FunnelDataBuilder} this (for chaining).
   */
  addStep(label, value, meta = {}) {
    this._steps.push({ label, value, ...meta });
    return this;
  }

  /**
   * Remove all steps.
   * @returns {FunnelDataBuilder} this (for chaining).
   */
  clear() {
    this._steps = [];
    return this;
  }

  /**
   * Return the steps array ready for {@link FunnelChart}.
   * @returns {Array<{label:string, value:number}>}
   */
  build() {
    return this._steps.slice();  // defensive copy
  }
}
