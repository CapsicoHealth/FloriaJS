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
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyLeft } from "https://cdn.jsdelivr.net/npm/d3-sankey@0.12/+esm";
import { FloriaDOM } from "./module-dom.js";

FloriaDOM.injectCSSLink("FLORIA_CSS_ANCHOR", true, new URL("./module-charts2-sankey.css", import.meta.url).href);


// ============================================================================
// Default callback implementations — sensible out-of-the-box behavior that
// callers can override selectively.
// ============================================================================

const DEFAULTS = {

  /**
   * Minimum pixel size (width and height) used only as a safety floor when the
   * container reports zero dimensions (e.g. not yet laid out).  The chart
   * otherwise fills the container exactly.
   */
  minSize: 100,

  /** Margins around the sankey layout inside the SVG. */
  margin: { top: 20, right: 160, bottom: 20, left: 160 },

  /** d3-sankey layout parameters. */
  nodeWidth:   15,
  nodePadding: 12,
  nodeAlign:   null,  // null → d3-sankey default (justify).  Or pass d3Sankey.sankeyLeft, etc.
  iterations:  6,     // d3-sankey relaxation iterations.

  /**
   * When true, nodes in each column are vertically centered within the
   * available chart height after the d3-sankey layout.  Useful for linear
   * funnels where single-node columns would otherwise be top-aligned.
   * @type {boolean}
   */
  verticalCenter: false,

  // --- Visual callbacks ---

  /**
   * Fill color for a node rectangle.
   * @param {object} node — the enriched d3-sankey node (has .x0/.x1/.y0/.y1 plus any custom fields).
   * @returns {string} CSS color.
   */
  nodeColor: (node) => '#69a3b2',

  /**
   * Stroke (border) color for a node rectangle.
   * @param {object} node
   * @returns {string} CSS color.
   */
  nodeStroke: (_node) => '#333',

  /**
   * Stroke width for a node rectangle.
   * @param {object} node
   * @returns {number}
   */
  nodeStrokeWidth: (_node) => 1,

  /**
   * Stroke dash array for a node rectangle (e.g. "4 2" for dashed).
   * Return null or "" for solid.
   * @param {object} node
   * @returns {string|null}
   */
  nodeStrokeDash: (_node) => null,

  /**
   * Stroke color for a link path.
   * @param {object} link — the enriched d3-sankey link.
   * @returns {string} CSS color.
   */
  linkColor: (link) => '#aaa',

  /**
   * Stroke dash array for a link path.
   * Return null or "" for solid.
   * @param {object} link
   * @returns {string|null}
   */
  linkStrokeDash: (_link) => null,

  /**
   * Opacity for a link path in its normal (non-hovered) state.
   * @param {object} link
   * @returns {number} 0..1
   */
  linkOpacity: (_link) => 0.55,

  /**
   * Opacity for a link path when hovered.
   * @param {object} link
   * @returns {number} 0..1
   */
  linkHoverOpacity: (_link) => 0.85,

  /**
   * Text label for a node.
   * @param {object} node
   * @returns {string}
   */
  nodeLabel: (node) => node.name ?? '',

  /**
   * Font size for the node label.
   * @param {object} node
   * @returns {string} CSS font-size value.
   */
  nodeLabelSize: (_node) => '12px',

  /**
   * Font weight for the node label.
   * @param {object} node
   * @returns {string} CSS font-weight value.
   */
  nodeLabelWeight: (_node) => 'normal',

  /**
   * Optional secondary label rendered below the main label (e.g. a count or percentage).
   * Return null/undefined/"" to skip.
   * @param {object} node
   * @returns {string|null}
   */
  nodeSubLabel: (_node) => null,

  /**
   * Font size for the optional secondary (sub) label.
   * @param {object} node
   * @returns {string} CSS font-size value.
   */
  nodeSubLabelSize: (_node) => '11px',

  /**
   * Whether to place labels to the right of right-half nodes (true) or always to the right (false).
   * When true (default), labels on the right half of the chart are placed to the left of the node.
   * @type {boolean}
   */
  labelAutoSide: true,

  // --- Tooltip callbacks ---

  /**
   * HTML content for a node tooltip.  Return null/"" to suppress the tooltip.
   * @param {object} node
   * @returns {string|null}
   */
  nodeTooltipHTML: (node) => `<strong>${node.name ?? ''}</strong>`,

  /**
   * HTML content for a link tooltip.  Return null/"" to suppress the tooltip.
   * @param {object} link
   * @returns {string|null}
   */
  linkTooltipHTML: (link) => {
    const src = link.source?.name ?? '';
    const tgt = link.target?.name ?? '';
    return `<strong>${src} → ${tgt}</strong><br/>Value: ${(link.value ?? 0).toLocaleString()}`;
  },

  /**
   * Called when a node is clicked.
  /**
   * Called when a node is clicked.
   * @param {MouseEvent} event
   * @param {object}     node
   */
  onNodeClick:  null,

  /**
   * Called when a link is clicked.
   * @param {MouseEvent} event
   * @param {object}     link
   */
  onLinkClick:  null,
};


// ============================================================================
// SankeyChart — generic, domain-agnostic Sankey diagram renderer.
// ============================================================================

/**
 * A reusable, domain-agnostic Sankey diagram component built on d3-sankey.
 *
 * The caller is responsible for building the `nodes` and `links` arrays and
 * injecting any domain-specific behavior through the `options` callbacks
 * (colors, labels, tooltips, click handlers, etc.).
 *
 * ### Minimal usage
 * ```js
 * import { SankeyChart } from './module-charts2-sankey.js';
 *
 * const chart = new SankeyChart('my-container', {
 *   nodes: [ { id: 0, name: 'A' }, { id: 1, name: 'B' } ],
 *   links: [ { source: 0, target: 1, value: 42 } ],
 * });
 * chart.render();
 * ```
 *
 * ### Full control
 * ```js
 * const chart = new SankeyChart('my-container', {
 *   nodes,
 *   links,
 *   options: {
 *     nodeColor:      n => n.mandatory ? '#4285f4' : '#ccc',
 *     linkColor:      l => l.bypass    ? '#eee'    : '#69b',
 *     linkStrokeDash: l => l.bypass    ? '6 3'     : null,
 *     nodeTooltipHTML: n => `<b>${n.name}</b><br/>Patients: ${n.count}`,
 *     nodeSubLabel:    n => n.count?.toLocaleString(),
 *   }
 * });
 * chart.render();
 * ```
 */
export class SankeyChart {

  /**
   * @param {string} containerId — DOM id of the element to render into.
   * @param {object} spec
   * @param {Array}  spec.nodes   — array of node objects; each MUST have a numeric `id`.
   * @param {Array}  spec.links   — array of link objects; each MUST have `source` (id), `target` (id), `value` (number).
   * @param {object} [spec.options] — partial overrides of {@link DEFAULTS}.
   */
  constructor(containerId, { nodes, links, options = {} }) {
    this.containerId = containerId;
    this.nodes       = nodes;
    this.links       = links;
    this.opts        = Object.assign({}, DEFAULTS, options);
    this._tooltipEl  = null;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Render (or re-render) the Sankey diagram into the container.
   * Safe to call repeatedly — the container is cleared each time.
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`SankeyChart: container '${this.containerId}' not found`);
      return;
    }
    container.innerHTML = '';
    container.classList.add('sankey-chart');

    const o      = this.opts;
    const margin = o.margin;

    // Size the diagram to fill the container exactly.
    // Fall back to minSize only when the container has not been laid out yet.
    const cw     = container.offsetWidth  || o.minSize;
    const ch     = container.offsetHeight || o.minSize;
    const width  = Math.max(0, cw - margin.left - margin.right);
    const height = Math.max(0, ch - margin.top  - margin.bottom);

    // ---- d3-sankey layout ----
    const layout = d3Sankey()
      .nodeWidth(o.nodeWidth)
      .nodePadding(o.nodePadding)
      .extent([[0, 0], [width, height]])
      .iterations(o.iterations);

    if (o.nodeAlign) layout.nodeAlign(o.nodeAlign);

    const graph = layout({
      nodes: this.nodes.map(d => Object.assign({}, d)),
      links: this.links.map(d => Object.assign({}, d)),
    });

    // ---- Optional vertical centering ----
    // Group nodes by column (depth / x0) and shift each column so that
    // its vertical center aligns with the center of the available height.
    // We must also shift link y0/y1 — d3-sankey stores those separately
    // from the node coordinates.
    if (o.verticalCenter && height > 0) {
      const cols = new Map();
      for (const n of graph.nodes) {
        const key = n.x0;
        if (!cols.has(key)) cols.set(key, []);
        cols.get(key).push(n);
      }
      // Compute per-node dy shift
      const dyMap = new Map();
      for (const nodes of cols.values()) {
        const minY = Math.min(...nodes.map(n => n.y0));
        const maxY = Math.max(...nodes.map(n => n.y1));
        const colH = maxY - minY;
        const dy   = (height - colH) / 2 - minY;
        if (Math.abs(dy) > 0.5) {
          for (const n of nodes) {
            n.y0 += dy;
            n.y1 += dy;
            dyMap.set(n, dy);
          }
        }
      }
      // Shift link endpoints to match their shifted source/target nodes
      for (const l of graph.links) {
        const dySrc = dyMap.get(l.source) || 0;
        const dyTgt = dyMap.get(l.target) || 0;
        if (dySrc !== 0) l.y0 += dySrc;
        if (dyTgt !== 0) l.y1 += dyTgt;
      }
    }

    // ---- SVG scaffolding ----
    const svg = d3.select(container)
      .append('svg')
        .attr('width',  width  + margin.left + margin.right)
        .attr('height', height + margin.top  + margin.bottom)
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // ---- Links ----
    const linkSel = svg.append('g')
      .attr('class', 'sankey-links')
      .attr('fill', 'none')
      .selectAll('path')
      .data(graph.links)
      .join('path')
        .attr('d', sankeyLinkHorizontal())
        .attr('stroke',       d => o.linkColor(d))
        .attr('stroke-width', d => Math.max(1, d.width))
        .attr('opacity',      d => o.linkOpacity(d))
        .attr('stroke-dasharray', d => o.linkStrokeDash(d));

    linkSel
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).attr('opacity', o.linkHoverOpacity(d));
        this._showTooltip(event, o.linkTooltipHTML(d));
      })
      .on('mousemove', (event) => this._moveTooltip(event))
      .on('mouseout', (event, d) => {
        d3.select(event.currentTarget).attr('opacity', o.linkOpacity(d));
        this._hideTooltip();
      });

    if (o.onLinkClick) {
      linkSel.style('cursor', 'pointer').on('click', (event, d) => o.onLinkClick(event, d));
    }

    // ---- Nodes ----
    const nodeSel = svg.append('g')
      .attr('class', 'sankey-nodes')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
        .attr('x',      d => d.x0)
        .attr('y',      d => d.y0)
        .attr('height', d => d.y1 - d.y0)
        .attr('width',  d => d.x1 - d.x0)
        .attr('fill',         d => o.nodeColor(d))
        .attr('stroke',       d => o.nodeStroke(d))
        .attr('stroke-width', d => o.nodeStrokeWidth(d))
        .attr('stroke-dasharray', d => o.nodeStrokeDash(d));

    nodeSel
      .on('mouseover', (event, d) => this._showTooltip(event, o.nodeTooltipHTML(d)))
      .on('mousemove', (event)    => this._moveTooltip(event))
      .on('mouseout',  ()         => this._hideTooltip());

    if (o.onNodeClick) {
      nodeSel.style('cursor', 'pointer').on('click', (event, d) => o.onNodeClick(event, d));
    }

    // ---- Node labels ----
    const labelG = svg.append('g').attr('class', 'sankey-labels');

    const labelSel = labelG.selectAll('g')
      .data(graph.nodes)
      .join('g');

    // Main label
    labelSel.append('text')
      .attr('x', d => this._labelX(d, width, o))
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', d => {
        const sub = o.nodeSubLabel(d);
        return sub ? '-0.2em' : '0.35em';
      })
      .attr('text-anchor', d => this._labelAnchor(d, width, o))
      .text(d => o.nodeLabel(d))
      .style('font-size',   d => o.nodeLabelSize(d))
      .style('font-weight', d => o.nodeLabelWeight(d));

    // Capture helpers for the .each() closure below (no `this` access there).
    const _labelX      = (d) => this._labelX(d, width, o);
    const _labelAnchor = (d) => this._labelAnchor(d, width, o);

    // Sub-label (rendered only when callback returns a truthy value)
    labelSel.each(function(d) {
      const sub = o.nodeSubLabel(d);
      if (sub) {
        d3.select(this).append('text')
          .attr('class', 'sankey-sublabel')
          .attr('x', _labelX(d))
          .attr('y', (d.y1 + d.y0) / 2)
          .attr('dy', '1.0em')
          .attr('text-anchor', _labelAnchor(d))
          .style('font-size', d => o.nodeSubLabelSize(d))
          .text(sub);
      }
    });

    return this;
  }

  /**
   * Replace nodes/links and re-render.
   * @param {Array} nodes
   * @param {Array} links
   */
  update(nodes, links) {
    this.nodes = nodes;
    this.links = links;
    this.render();
    return this;
  }

  /**
   * Remove the rendered chart and clean up the tooltip element.
   */
  destroy() {
    const container = document.getElementById(this.containerId);
    if (container) container.innerHTML = '';
    if (this._tooltipEl) { this._tooltipEl.remove(); this._tooltipEl = null; }
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  _labelX(d, width, o) {
    if (o.labelAutoSide && d.x0 > width / 2) return d.x0 - 6;
    return d.x1 + 6;
  }

  _labelAnchor(d, width, o) {
    if (o.labelAutoSide && d.x0 > width / 2) return 'end';
    return 'start';
  }

  _ensureTooltip() {
    if (!this._tooltipEl) {
      this._tooltipEl = document.createElement('div');
      this._tooltipEl.className = 'sankey-tooltip';
      document.body.appendChild(this._tooltipEl);
    }
    return this._tooltipEl;
  }

  _showTooltip(event, html) {
    if (!html) return;
    const tip = this._ensureTooltip();
    tip.innerHTML = html;
    tip.style.display = 'block';
    tip.style.left = (event.clientX + 14) + 'px';
    tip.style.top  = (event.clientY + 14) + 'px';
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
// SankeyDataBuilder — optional helper to programmatically construct node/link
// arrays using a fluent API.
// ============================================================================

/**
 * Convenience builder for constructing `{nodes, links}` data for {@link SankeyChart}.
 *
 * Handles id allocation and de-duplication by name.
 *
 * ```js
 * const b = new SankeyDataBuilder();
 * b.addNode('Cohort', { count: 1000 });
 * b.addNode('Step A', { mandatory: true });
 * b.addLink('Cohort', 'Step A', 800);
 * const { nodes, links } = b.build();
 * ```
 */
export class SankeyDataBuilder {

  constructor() {
    /** @type {Map<string, object>} keyed by name */
    this._nodeMap = new Map();
    this._nextId  = 0;
    /** @type {Array<{source:number, target:number, value:number}>} */
    this._links   = [];
  }

  /**
   * Add (or retrieve) a node by name.
   * If a node with the same `name` already exists, the extra metadata is merged in.
   * @param {string} name
   * @param {object} [meta] — arbitrary extra fields carried through to the chart.
   * @returns {object} the node object (has at least `{id, name}`).
   */
  addNode(name, meta = {}) {
    if (this._nodeMap.has(name)) {
      const existing = this._nodeMap.get(name);
      Object.assign(existing, meta);
      return existing;
    }
    const node = { id: this._nextId++, name, ...meta };
    this._nodeMap.set(name, node);
    return node;
  }

  /**
   * Add a link between two nodes (by name).
   * Both nodes must already exist (call {@link addNode} first) or will be auto-created.
   * @param {string} sourceName
   * @param {string} targetName
   * @param {number} value — link weight (e.g. patient count, token count).
   * @param {object} [meta] — arbitrary extra fields carried through to the chart.
   * @returns {object} the link object.
   */
  addLink(sourceName, targetName, value, meta = {}) {
    const src = this.addNode(sourceName);
    const tgt = this.addNode(targetName);
    const link = { source: src.id, target: tgt.id, value, ...meta };
    this._links.push(link);
    return link;
  }

  /**
   * Return the `{nodes, links}` arrays ready for {@link SankeyChart}.
   */
  build() {
    return {
      nodes: Array.from(this._nodeMap.values()),
      links: this._links.slice(),  // defensive copy
    };
  }
}


export { sankeyLeft };
