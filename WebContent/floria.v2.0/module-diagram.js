/* ===========================================================================
 * Copyright (C) 2025 CapsicoHealth Inc.
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

import * as joint from "https://cdn.jsdelivr.net/npm/@joint/core@4.0.4/+esm";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Sets CSS properties directly as inline `style` on an SVG/HTML node, IN ADDITION to whatever SVG
// presentation attributes (fill/stroke/etc.) may already be set on it. This exists because SVG
// presentation attributes have the LOWEST possible priority in the CSS cascade — lower than even a
// single bare-tag selector rule like `rect { fill: transparent; }` — so if the host page's own global
// CSS happens to define such a rule anywhere (e.g. a broad reset added for D3 charts elsewhere in the
// app), it silently wins over a `fill="..."` attribute set via JointJS/this module, regardless of
// specificity. An inline `style` declaration, however, always outranks an external stylesheet's
// non-`!important` rule — so mirroring the same values there makes the diagram's visuals immune to
// this entire class of host-page CSS collisions. Exported so consumer apps' own item.draw()
// implementations (which set their own fill/stroke colors) can protect themselves the same way.
// See docs/module-diagram.md §10-I.
export function forceElementStyle(node, styles) {
  if (!node || !styles) return;
  Object.keys(styles).forEach(prop => {
    const val = styles[prop];
    if (val != null) node.style.setProperty(prop, String(val));
  });
}

const LINK_STYLE = {
  stroke: '#5c6bc0',
  strokeWidth: 2,
  targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 z', fill: '#5c6bc0' }
};

const LINK_ROUTING = {
  router: { name: 'manhattan', args: { step: 10 } },
  connector: { name: 'rounded', args: { radius: 10 } }
};

function createLink(source, target, vertices = []) {
  return new joint.shapes.standard.Link({
    source, target, vertices,
    attrs: { line: LINK_STYLE },
    ...LINK_ROUTING
  });
}

function createButton(html, title, style, onclick) {
  const btn = document.createElement('button');
  btn.type = 'button';   // prevent form submission when diagram is inside a <form>
  btn.innerHTML = html;
  btn.title = title;
  btn.style.cssText = style;
  btn.onclick = onclick;
  return btn;
}

function createMenuItem(text, action, style, hasSubMenu) {
  const item = document.createElement('li');
  item.dataset.action = action;
  item.style.cssText = style;
  if (hasSubMenu) {
    // Flex row: label on left, light chevron on right
    item.style.display         = 'flex';
    item.style.justifyContent  = 'space-between';
    item.style.alignItems      = 'center';
    const span = document.createElement('span');
    span.textContent = text;
    const arrow = document.createElement('span');
    arrow.textContent  = '›';
    arrow.style.cssText = 'color:#bbb;font-size:16px;line-height:1;margin-left:12px;font-weight:300;';
    item.appendChild(span);
    item.appendChild(arrow);
  } else {
    item.textContent = text;
  }
  item.onmouseenter = () => item.style.background = '#f0f0f0';
  item.onmouseleave = () => item.style.background = '';
  return item;
}

function createSeparator() {
  const sep = document.createElement('li');
  sep.style.cssText = 'border-top: 1px solid #e0e0e0; margin: 4px 0;';
  return sep;
}

function adjustMenuPosition(menu, x, y) {
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
}

// ============================================================================
// STYLES
// ============================================================================

const _STYLES = {
  controls      : `position:absolute;top:8px;right:8px;z-index:100;display:flex;gap:4px;
                   background:white;padding:4px;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,0.1)`,
  controlBtn    : `width:28px;height:28px;border:1px solid #ccc;border-radius:4px;background:white;
                   cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:#333`,
  helpBox       : `position:absolute;bottom:16px;right:16px;z-index:100;
                   background:rgba(255,255,255,0.95);padding:12px 16px;border-radius:6px;
                   box-shadow:0 2px 8px rgba(0,0,0,0.15);font-size:12px;color:#666;
                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`,
  contextMenu   : `position:fixed;display:none;list-style:none;margin:0;padding:4px 0;
                   background:white;border:1px solid #ccc;border-radius:4px;
                   box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10000;min-width:140px;
                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                   font-size:14px;color:#333`,
  linkContextMenu: `position:fixed;display:none;list-style:none;margin:0;padding:4px 0;
                    background:white;border:1px solid #ccc;border-radius:4px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10000;min-width:150px;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                    font-size:14px;color:#333`,
  menuItem      : 'padding:8px 16px;cursor:pointer;font-size:14px;color:#333;',
  menuItemActive : 'font-weight:600;color:#5c6bc0;',
  canvasWrapper : 'width:100%;height:100%'
};

// ============================================================================
// FLORIA DIAGRAM CONSTRUCTOR
// ============================================================================

// See docs/module-diagram.md for full constructor options reference.
export function FloriaDiagram(divId, options = {}) {
  const defaults = {
    scroll: { x: true, y: true },
    zoom: { min: 0.25, max: 4, wheel: false, wheelSensitivity: 0.01 },
    undo: 50,
    dimensions: { minW: 800, maxW: 1200, minH: 600, maxH: 900 },
    highlightDisconnected: true,
    pan: true,
    showHelp: true
  };
  
  this._options = {
    scroll: { ...defaults.scroll, ...options.scroll },
    zoom: { ...defaults.zoom, ...options.zoom },
    undo: options.undo ?? defaults.undo,
    dimensions: { ...defaults.dimensions, ...options.dimensions },
    highlightDisconnected: options.highlightDisconnected ?? defaults.highlightDisconnected,
    pan: options.pan ?? defaults.pan,
    showHelp: options.showHelp ?? defaults.showHelp,
    // Optional function(), called from _saveState() — i.e. on every user-driven change that pushes an
    // undo snapshot: element moves, vertex drags, link add/remove/reconnect, delete, clear, etc. Lets
    // the host app mark its own "unsaved changes" state dirty without having to hook every individual
    // graph event itself. Not fired for programmatic changes made while this._isRestoring is true
    // (undo/redo/load), since those aren't new user edits.
    onModified: typeof options.onModified === 'function' ? options.onModified : null
  };
  
  // Internal state
  this._divId = divId;
  this._items = new Map();
  this._elements = new Map();
  this._selectedId = null;
  this._undoStack = [];
  this._redoStack = [];
  this._isFullscreen = false;
  this._originalStyles = null;
  this._isRestoring = false;
  this._linkOperationInProgress = false;
  this._readOnly = false;
  this._boundaryRectSVG = null;
  // Context-menu registry: starts with a shallow copy of the built-in
  // descriptors so each FloriaDiagram instance has its own independent list.
  this._contextMenuItems = _BUILT_IN_CONTEXT_MENU_ITEMS.map(d => ({ ...d }));
  
  // Get container element
  this._container = document.getElementById(divId);
  if (!this._container) throw new Error(`FloriaDiagram: Container '${divId}' not found`);
  
  // Setup container styles
  Object.assign(this._container.style, {
    position: 'relative',
    overflow: 'hidden',
    minWidth: this._options.dimensions.minW ? this._options.dimensions.minW + 'px' : '',
    minHeight: this._options.dimensions.minH ? this._options.dimensions.minH + 'px' : ''
  });
  
  // Create canvas wrapper
  this._canvasWrapper = document.createElement('div');
  this._canvasWrapper.id = divId + '_CANVAS';
  this._canvasWrapper.style.cssText = _STYLES.canvasWrapper;
  this._container.appendChild(this._canvasWrapper);
  
  // Initialize JointJS
  this._graph = new joint.dia.Graph();
  this._paper = new joint.dia.Paper({
    el: this._canvasWrapper,
    model: this._graph,
    width: '100%',
    height: '100%',
    gridSize: 10,
    drawGrid: { name: 'dot', args: { color: '#d0d4da' } },
    background: { color: '#fafafa' },
    interactive: {
      linkMove: true, labelMove: true, arrowheadMove: true,
      vertexMove: true, vertexAdd: true, vertexRemove: true, useLinkTools: true
    },
    defaultLink: () => createLink({}, {}),
    validateConnection: (cellViewS, magnetS, cellViewT, magnetT) => {
      if (magnetS?.getAttribute('port-group') === 'in') return false;
      if (magnetT?.getAttribute('port-group') === 'out') return false;
      if (cellViewS === cellViewT) return false;
      return !!magnetT;
    },
    validateMagnet: (cellView, magnet) => magnet.getAttribute('port-group') === 'out',
    snapLinks: { radius: 20 },
    linkPinning: false,
    markAvailable: false
  });
  
  this._currentZoom = 1;
  this._panX = 0;
  this._panY = 0;
  
  this._createControls();
  this._createContextMenu();
  this._createLinkContextMenu();
  this._setupEventHandlers();
  this._setupKeyboardShortcuts();
  this._createCanvasBoundary();
};

// ============================================================================
// CANVAS BOUNDARY
// ============================================================================

// Boundary rect lives in the JointJS 'back' layer SVG <g> so the router ignores it.
// Falls back to a manually-transformed wrapper <g> if the back layer is unavailable.
// See docs/module-diagram.md §10-E and §7 (_createCanvasBoundary).
FloriaDiagram.prototype._createCanvasBoundary = function() {
  this._removeCanvasBoundary();

  const { maxW, maxH } = this._options.dimensions;
  if (!maxW && !maxH) return;

  const width  = maxW || 8000;
  const height = maxH || 8000;

  // Light outer background fills the entire JointJS paper SVG area
  this._paper.drawBackground({ color: '#e4e8ef' });

  const svgNS = 'http://www.w3.org/2000/svg';
  const rect = document.createElementNS(svgNS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width',  String(width));
  rect.setAttribute('height', String(height));
  // Interior fill is slightly lighter than the outer background so the working area is visually
  // distinguished from the surrounding margin, without a jarring pure-white flash.
  rect.setAttribute('fill',   '#f4f7fb');
  rect.setAttribute('stroke', '#b7c0cc');
  rect.setAttribute('stroke-width',    '1.5');
  rect.setAttribute('stroke-dasharray', '6 4');
  rect.setAttribute('pointer-events',  'none');
  rect.setAttribute('class', 'floria-canvas-boundary');
  // Mirror fill/stroke as inline style too — see forceElementStyle()'s docs above (and
  // docs/module-diagram.md §10-I) for why the plain attributes above aren't reliably enough on their own.
  forceElementStyle(rect, { fill: '#f4f7fb', stroke: '#b7c0cc' });
  this._boundaryRectSVG = rect;
  this._boundaryUsesManualTransform = false;

  // Locate the back layer – try the public JointJS API first, then a DOM query
  const backLayer =
    (typeof this._paper.getLayerNode === 'function' &&
      (() => { try { return this._paper.getLayerNode(
        (joint.dia.Paper.Layers && joint.dia.Paper.Layers.BACK) || 'back'
      ); } catch(e) { return null; } })()
    ) ||
    this._paper.el.querySelector('[data-layer="back"]');

  if (backLayer) {
    // Append to back layer – which renders as a whole before the cells layer
    backLayer.appendChild(rect);
  } else {
    // Last-resort fallback: inject a wrapper <g> into the paper SVG
    // element BEFORE the outermost viewport group.  It will not follow
    // zoom/pan automatically so we maintain the transform manually.
    const svg = (this._paper.el.tagName === 'svg')
      ? this._paper.el
      : this._paper.el.querySelector('svg');
    if (svg) {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'floria-canvas-boundary-wrapper');
      g.appendChild(rect);
      svg.insertBefore(g, svg.firstChild);
      this._boundaryWrapperG = g;
      this._boundaryUsesManualTransform = true;
      this._syncBoundaryTransform();
    }
  }
};

// Called from _applyTransform; only active in the manual-transform fallback path.
FloriaDiagram.prototype._syncBoundaryTransform = function() {
  if (!this._boundaryRectSVG || !this._boundaryUsesManualTransform || !this._boundaryWrapperG) return;
  this._boundaryWrapperG.setAttribute('transform',
    `translate(${this._panX} ${this._panY}) scale(${this._currentZoom})`);
};

FloriaDiagram.prototype._removeCanvasBoundary = function() {
  if (this._boundaryRectSVG) {
    (this._boundaryWrapperG || this._boundaryRectSVG).parentNode
      ?.removeChild(this._boundaryWrapperG || this._boundaryRectSVG);
    this._boundaryRectSVG    = null;
    this._boundaryWrapperG   = null;
    this._boundaryUsesManualTransform = false;
    this._paper.drawBackground({ color: '#fafafa' });
  }
};


// ============================================================================
// UI CREATION
// ============================================================================

FloriaDiagram.prototype._createControls = function() {
  const that = this;
  const controls = document.createElement('div');
  controls.className = 'floria-diagram-controls';
  controls.style.cssText = _STYLES.controls;
  
  controls.appendChild(createButton('+', 'Zoom In',           _STYLES.controlBtn, () => that.zoomIn()));
  controls.appendChild(createButton('−', 'Zoom Out',          _STYLES.controlBtn, () => that.zoomOut()));
  controls.appendChild(createButton('⟲', 'Reset View',        _STYLES.controlBtn, () => that.resetView()));
  this._fullscreenBtn = createButton('⛶', 'Toggle Fullscreen', _STYLES.controlBtn, () => that.fullscreen());
  controls.appendChild(this._fullscreenBtn);
  
  this._container.appendChild(controls);
  this._controls = controls;
  
  // Create help box
  if (this._options.showHelp) {
    const helpBox = document.createElement('div');
    helpBox.className = 'floria-diagram-help';
    helpBox.style.cssText = _STYLES.helpBox;
    
    const panText  = this._options.pan         ? '<strong style="color:#5c6bc0;font-weight:600">Pan:</strong> Click and drag on canvas<br>' : '';
    const zoomText = this._options.zoom.wheel  ? '<strong style="color:#5c6bc0;font-weight:600">Zoom:</strong> Mouse wheel<br>' : '';
    const undoText = this._options.undo > 0    ? '<strong style="color:#5c6bc0;font-weight:600">Undo/Redo:</strong> Ctrl+Z / Ctrl+Y' : '';
    
    helpBox.innerHTML = panText + zoomText + undoText;
    if (panText || zoomText || undoText) this._container.appendChild(helpBox);
  }
};

// Built-in context-menu descriptors — see docs/module-diagram.md §6.7
const _BUILT_IN_CONTEXT_MENU_ITEMS = [
  { id: 'edit',     name: 'Edit'           , style: _STYLES.menuItem },
  { separator: true },
  { id: 'tofront',  name: 'Bring to Front' , style: _STYLES.menuItem },
  { id: 'toback',   name: 'Send to Back'   , style: _STYLES.menuItem },
  { separator: true },
  { id: 'remove',   name: 'Remove'         , style: _STYLES.menuItem }
];

// Menu contents rebuilt dynamically on every right-click in _showContextMenu.
FloriaDiagram.prototype._createContextMenu = function() {
  const that = this;

  this._contextMenu = document.createElement('ul');
  this._contextMenu.className = 'floria-diagram-contextmenu';
  this._contextMenu.style.cssText = _STYLES.contextMenu;
  document.body.appendChild(this._contextMenu);

  // Shared sub-menu panel – repopulated on every parent mouseenter
  this._subMenu = document.createElement('ul');
  this._subMenu.className = 'floria-diagram-submenu';
  this._subMenu.style.cssText = _STYLES.contextMenu + 'z-index:10001;';
  document.body.appendChild(this._subMenu);

  // Bound reference stored on the instance so destroy() can remove exactly
  // this listener without disturbing other, still-active FloriaDiagram instances.
  this._boundDocClickContextMenu = (e) => {
    if (!that._contextMenu.contains(e.target) && !that._subMenu.contains(e.target))
      that._hideContextMenu();
  };
  document.addEventListener('click', this._boundDocClickContextMenu);

  // Hide both menus when pointer leaves the main menu — but only if it isn't
  // entering the sub-menu.
  this._contextMenu.addEventListener('mouseleave', (e) => {
    if (that._subMenu.style.display !== 'none' &&
        that._subMenu.contains(e.relatedTarget)) return;
    that._hideContextMenu();
  });

  // Hide sub-menu when pointer leaves it — but only if it isn't re-entering
  // the main menu.
  this._subMenu.addEventListener('mouseleave', (e) => {
    if (that._contextMenu.contains(e.relatedTarget)) return;
    that._hideSubMenu();
  });
};

FloriaDiagram.prototype._showContextMenu = function(x, y, itemId) {
  const that = this;
  const item    = this._items.get(itemId);
  const element = this._elements.get(itemId);
  if (!item || !element) return;

  this._contextMenuTargetId = itemId;
  this._hideSubMenu();

  // ── Rebuild <ul> contents ────────────────────────────────────────────────
  this._contextMenu.innerHTML = '';

  this._contextMenuItems.forEach(descriptor => {
    if (descriptor.separator) {
      this._contextMenu.appendChild(createSeparator());
      return;
    }

    // App-registered entries: filter by itemTypes when specified
    if (descriptor._appRegistered) {
      if (descriptor.itemTypes && !descriptor.itemTypes.includes(item.type)) return;
    }

    const label    = (typeof descriptor.name === 'function') ? descriptor.name(item) : descriptor.name;
    const hasSubMenu = Array.isArray(descriptor.subMenu) && descriptor.subMenu.length > 0;
    const li       = createMenuItem(label, descriptor.id, descriptor.style || _STYLES.menuItem, hasSubMenu);

    // Disabled state
    const disabled = descriptor.isDisabled ? descriptor.isDisabled(item) : false;
    if (disabled) {
      li.dataset.disabled = 'true';
      li.style.opacity  = '0.3';
      li.style.cursor   = 'default';
      li.onmouseenter   = null;
      li.onmouseleave   = null;
    }

    // ── Sub-menu wiring ────────────────────────────────────────────────────
    if (hasSubMenu && !disabled) {
      li.addEventListener('mouseenter', () => {
        that._showSubMenu(li, descriptor, item, element);
      });
    } else if (!hasSubMenu) {
      // Non-sub-menu items close the sub-menu when hovered
      li.addEventListener('mouseenter', () => that._hideSubMenu());
    }

    this._contextMenu.appendChild(li);
  });

  // ── Single delegated click handler ──────────────────────────────────────
  this._contextMenu.onclick = (e) => {
    const li = e.target.closest('li[data-action]');
    if (!li || li.dataset.disabled === 'true') return;

    const action      = li.dataset.action;
    const targetItem  = that._items.get(that._contextMenuTargetId);
    const targetEl    = that._elements.get(that._contextMenuTargetId);
    if (!targetItem || !targetEl) { that._hideContextMenu(); return; }

    // Items with subMenu expand on hover; direct clicks are ignored
    const descriptor = that._contextMenuItems.find(d => d.id === action);
    if (descriptor && Array.isArray(descriptor.subMenu)) return;

    let needsRepaint = false;

    // Built-in actions
    if (action === 'edit') {
      if (targetItem.onEdit) targetItem.onEdit(targetItem);
    } else if (action === 'remove') {
      that.remove(that._contextMenuTargetId);
    } else if (action === 'tofront') {
      targetEl.toFront();
    } else if (action === 'toback') {
      targetEl.toBack();
    } else {
      // App-registered action. Convention: handler(item) returning `true` means "this item's state
      // changed" — used both to trigger a repaint (targetItem.draw) AND to signal onModified(), so
      // host apps get automatic dirty-tracking for free just by returning true from their handler,
      // instead of having to call markDirty()/onModified() themselves inside every handler.
      const desc = that._contextMenuItems.find(d => d.id === action && d._appRegistered);
      if (desc?.handler) {
        const result = desc.handler(targetItem);
        needsRepaint = (result === true);
        if (needsRepaint) that._options.onModified?.();
      }
    }

    if (needsRepaint && targetItem.draw) {
      targetItem.draw(targetEl, targetItem);
    }

    that._hideContextMenu();
  };

  adjustMenuPosition(this._contextMenu, x, y);
};

FloriaDiagram.prototype._hideContextMenu = function() {
  this._contextMenu.style.display = 'none';
  this._hideSubMenu();
  this._contextMenuTargetId = null;
};

FloriaDiagram.prototype._hideSubMenu = function() {
  if (this._subMenu) this._subMenu.style.display = 'none';
  this._subMenuDescriptor = null;
};

// Build and show the sub-menu panel to the right of parentLi.
// descriptor.subMenu:  Array of { id, label } option objects.
// descriptor.getValue: function(item) => currently-active option id  (optional).
// descriptor.handler:  function(item, optionId) => bool needsRepaint  (required).
FloriaDiagram.prototype._showSubMenu = function(parentLi, descriptor, item, element) {
  const that = this;
  this._subMenuDescriptor = descriptor;

  const subMenu  = this._subMenu;
  const activeId = descriptor.getValue ? descriptor.getValue(item) : null;

  // ── Rebuild sub-menu items ───────────────────────────────────────────────
  subMenu.innerHTML = '';
  descriptor.subMenu.forEach(opt => {
    const isActive = opt.id === activeId;

    // Use createMenuItem so padding, font-size, hover colours and cursor are
    // identical to every other item in the main context menu.
    const li = createMenuItem(opt.label, opt.id, _STYLES.menuItem);

    // Overlay active styling on top of the base style
    if (isActive) li.style.cssText += _STYLES.menuItemActive;

    // Prepend a fixed-width checkmark column so labels stay aligned
    const chk = document.createElement('span');
    chk.textContent  = isActive ? '✓' : '';
    chk.style.cssText = 'width:16px;display:inline-block;flex-shrink:0;color:#5c6bc0;margin-right:4px;';
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.prepend(chk);

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetItem = that._items.get(that._contextMenuTargetId);
      const targetEl   = that._elements.get(that._contextMenuTargetId);
      if (!targetItem || !targetEl) { that._hideContextMenu(); return; }

      let needsRepaint = false;
      if (descriptor.handler) {
        const result = descriptor.handler(targetItem, opt.id);
        needsRepaint = (result === true);
        // Same convention as the main context menu: handler returning true also signals onModified().
        if (needsRepaint) that._options.onModified?.();
      }
      if (needsRepaint && targetItem.draw) targetItem.draw(targetEl, targetItem);
      that._hideContextMenu();
    });

    subMenu.appendChild(li);
  });

  // ── Position to the right of parentLi ───────────────────────────────────
  subMenu.style.display = 'block';
  const pRect = parentLi.getBoundingClientRect();
  let left = pRect.right;
  let top  = pRect.top;
  const sRect = subMenu.getBoundingClientRect();
  if (left + sRect.width  > window.innerWidth)  left = pRect.left - sRect.width;
  if (top  + sRect.height > window.innerHeight) top  = window.innerHeight - sRect.height - 4;
  subMenu.style.left = left + 'px';
  subMenu.style.top  = top  + 'px';
};

// ============================================================================
// PUBLIC API – context menu registration
// ============================================================================

// See docs/module-diagram.md §6.7 for full descriptor field reference.
// Sub-menu support: supply descriptor.subMenu = [{id, label}, ...] and
// descriptor.handler = function(item, optionId) => bool instead of the
// usual no-argument handler.  descriptor.getValue = function(item) => optionId
// is optional and used to show a checkmark next to the active option.
FloriaDiagram.prototype.registerContextMenuItem = function(descriptor) {
  if (!descriptor?.id)
    throw new Error('registerContextMenuItem: descriptor.id is required');
  if (descriptor?.name == null || (typeof descriptor.name !== 'string' && typeof descriptor.name !== 'function'))
    throw new Error('registerContextMenuItem: descriptor.name must be a string or function(item)=>string');

  const hasSubMenu = Array.isArray(descriptor.subMenu) && descriptor.subMenu.length > 0;
  if (!hasSubMenu && !descriptor?.handler)
    throw new Error('registerContextMenuItem: descriptor.handler is required (or supply descriptor.subMenu)');
  if (hasSubMenu && !descriptor?.handler)
    throw new Error('registerContextMenuItem: descriptor.handler(item, optionId) is required for sub-menu entries');

  const builtInIds = new Set(['edit', 'tofront', 'toback', 'remove']);
  if (builtInIds.has(descriptor.id)) {
    throw new Error(`registerContextMenuItem: id '${descriptor.id}' is reserved for built-in entries`);
  }
  if (this._contextMenuItems.some(d => d.id === descriptor.id)) {
    throw new Error(`registerContextMenuItem: id '${descriptor.id}' is already registered`);
  }

  // Mark as app-registered so _showContextMenu can distinguish it
  const entry = { ...descriptor, _appRegistered: true };

  // Insert right after the last app-registered entry that already sits after
  // 'edit', so repeated calls append in order.  If none exist yet, insert
  // immediately after 'edit' (index editIdx+1).
  const editIdx    = this._contextMenuItems.findIndex(d => d.id === 'edit');
  const tofrontIdx = this._contextMenuItems.findIndex(d => d.id === 'tofront');
  let   insertAt   = editIdx + 1;
  for (let i = editIdx + 1; i < tofrontIdx; i++) {
    if (this._contextMenuItems[i]?._appRegistered) insertAt = i + 1;
  }

  this._contextMenuItems.splice(insertAt, 0, entry);
};

FloriaDiagram.prototype._createLinkContextMenu = function() {
  const that = this;
  this._linkContextMenu = document.createElement('ul');
  this._linkContextMenu.className = 'floria-diagram-link-contextmenu';
  this._linkContextMenu.style.cssText = _STYLES.linkContextMenu;
  document.body.appendChild(this._linkContextMenu);
  // Bound reference stored on the instance so destroy() can remove exactly
  // this listener without disturbing other, still-active FloriaDiagram instances.
  this._boundDocClickLinkContextMenu = (e) => {
    if (!that._linkContextMenu.contains(e.target)) that._hideLinkContextMenu();
  };
  document.addEventListener('click', this._boundDocClickLinkContextMenu);
};

FloriaDiagram.prototype._showLinkContextMenu = function(x, y, linkView, vertexIndex) {
  const that = this;
  this._linkContextMenuTarget = linkView;
  this._linkContextMenuVertexIndex = vertexIndex;
  this._linkContextMenu.innerHTML = '';
  
  const link = linkView.model;
  const vertices = link.get('vertices') || [];
  
  if (vertexIndex !== undefined && vertexIndex >= 0) {
    this._linkContextMenu.appendChild(createMenuItem('Delete This Vertex', 'deletevertex', _STYLES.menuItem));
    this._linkContextMenu.appendChild(createSeparator());
  }
  if (vertices.length > 0) {
    this._linkContextMenu.appendChild(createMenuItem('Clear All Vertices', 'clearvertices', _STYLES.menuItem));
    this._linkContextMenu.appendChild(createSeparator());
  }
  this._linkContextMenu.appendChild(createMenuItem('Delete Connection', 'deletelink', _STYLES.menuItem));
  
  this._linkContextMenu.onclick = (e) => {
    const action = e.target.dataset.action;
    if (!action || !that._linkContextMenuTarget) return;
    const lnk = that._linkContextMenuTarget.model;
    
    // Mark as programmatic BEFORE saving state to prevent race conditions
    if (action === 'deletevertex' || action === 'clearvertices') {
      lnk._programmaticVertexChange = true;
    }
    
    that._saveState();
    
    if (action === 'deletevertex' && that._linkContextMenuVertexIndex >= 0) {
      const verts = [...(lnk.get('vertices') || [])];
      verts.splice(that._linkContextMenuVertexIndex, 1);
      lnk.set('vertices', verts);
    } else if (action === 'clearvertices') {
      lnk.set('vertices', []);
    } else if (action === 'deletelink') {
      lnk.remove();
    }
    that._hideLinkContextMenu();
  };
  
  adjustMenuPosition(this._linkContextMenu, x, y);
};

FloriaDiagram.prototype._hideLinkContextMenu = function() {
  if (this._linkContextMenu) this._linkContextMenu.style.display = 'none';
  this._linkContextMenuTarget = null;
  this._linkContextMenuVertexIndex = undefined;
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

FloriaDiagram.prototype._connectionExists = function(sourceId, sourcePort, targetId, targetPort) {
  const links = this._graph.getLinks();
  return links.some(link => {
    const src = link.get('source');
    const tgt = link.get('target');
    return src?.id === sourceId && src?.port === sourcePort && 
           tgt?.id === targetId && tgt?.port === targetPort;
  });
};

// ============================================================================
// EVENT HANDLERS
// ============================================================================

FloriaDiagram.prototype._setupEventHandlers = function() {
  const that = this;

  // Port hover effects - only trigger when directly over a port
  this._paper.on('cell:mouseenter', (cellView, evt) => {
    if (that._readOnly) return; // No hover effects in read-only mode
    const target = evt.target;
    const portGroup = target.getAttribute('port-group');
    const portId = target.getAttribute('port');
    
    if (portGroup === 'out' && portId) {
      cellView.model.portProp(portId, 'attrs/circle/fill', '#5c6bc0');
      cellView.model.portProp(portId, 'attrs/circle/r', 7);
    }
  });
  
  this._paper.on('cell:mouseleave', (cellView, evt) => {
    if (that._readOnly) return; // No hover effects in read-only mode
    const target = evt.target;
    const portGroup = target.getAttribute('port-group');
    const portId = target.getAttribute('port');
    
    if (portGroup === 'out' && portId) {
      cellView.model.portProp(portId, 'attrs/circle/fill', '#fff');
      cellView.model.portProp(portId, 'attrs/circle/r', 6);
    }
  });
  
  // Validate target during link dragging and update cursor
  this._paper.on('link:pointermove', (linkView, evt) => {
    const link = linkView.model;
    const source = link.get('source');
    const target = link.get('target');
    
    // Check if we're hovering over a valid target port
    if (source?.id && source?.port && target?.id && target?.port) {
      // _connectionExists scans all links; exclude the one being dragged first
      const isDuplicate = that._graph.getLinks()
        .filter(l => l.id !== link.id)
        .some(l => {
          const s = l.get('source'), t = l.get('target');
          return s?.id && t?.id &&
                 s.id === source.id && s.port === source.port &&
                 t.id === target.id && t.port === target.port;
        });
      
      if (isDuplicate) {
        that._paper.$el.css('cursor', 'not-allowed');
        link._isDuplicateConnection = true;
      } else {
        that._paper.$el.css('cursor', 'crosshair');
        link._isDuplicateConnection = false;
      }
    } else if (source?.id && source?.port) {
      that._paper.$el.css('cursor', 'crosshair');
      link._isDuplicateConnection = false;
    }
  });
  
  this._paper.on('link:pointerup', (linkView) => {
    that._paper.$el.css('cursor', '');
    // Remove the link if it was marked as duplicate during dragging
    if (linkView.model._isDuplicateConnection) {
      linkView.model.remove();
    }
  });
  
  // Link tools on hover
  this._paper.on('link:mouseenter', (linkView) => {
    if (that._readOnly) return; // Don't show link tools in read-only mode
    linkView.addTools(new joint.dia.ToolsView({
      tools: [
        new joint.linkTools.Vertices(),
        new joint.linkTools.Remove({
          distance: 20,
          markup: [
            { tagName: 'circle', selector: 'button', attributes: { r: 7, fill: '#f44336', cursor: 'pointer' } },
            { tagName: 'path', selector: 'icon', attributes: { d: 'M -3 -3 3 3 M -3 3 3 -3', fill: 'none', stroke: '#fff', 'stroke-width': 2, 'pointer-events': 'none' } }
          ]
        })
      ]
    }));
  });
  this._paper.on('link:mouseleave', (linkView) => linkView.removeTools());
  
  // Link context menu
  this._paper.on('link:contextmenu', (linkView, evt) => {
    evt.preventDefault();
    if (that._readOnly) return;
    const localPoint = that._paper.clientToLocalPoint({ x: evt.clientX, y: evt.clientY });
    const vertices = linkView.model.get('vertices') || [];
    let clickedVertexIndex = -1;
    for (let i = 0; i < vertices.length; i++) {
      const dx = vertices[i].x - localPoint.x, dy = vertices[i].y - localPoint.y;
      if (Math.sqrt(dx * dx + dy * dy) < 15) { clickedVertexIndex = i; break; }
    }
    that._showLinkContextMenu(evt.clientX, evt.clientY, linkView, clickedVertexIndex);
  });
  
  // Double-click to add vertex
  this._paper.on('link:pointerdblclick', (linkView, evt, x, y) => {
    if (that._readOnly) return; // Don't allow adding vertices in read-only mode
    that._saveState();
    const link = linkView.model;
    link._programmaticVertexChange = true;
    link.set('vertices', [...(link.get('vertices') || []), { x, y }]);
  });
  
  // Element interactions
  this._paper.on('element:pointerclick', (elementView) => {
    const itemId = elementView.model.get('itemId');
    if (itemId) that.select(itemId);
  });
  
  this._paper.on('element:pointerdblclick', (elementView) => {
    if (that._readOnly) return; // Don't allow editing in read-only mode
    const itemId = elementView.model.get('itemId');
    const item = that._items.get(itemId);
    if (item?.onEdit) item.onEdit(item);
  });
  
  this._paper.on('element:contextmenu', (elementView, evt) => {
    evt.preventDefault();
    if (that._readOnly) return; // Don't show context menu in read-only mode
    const itemId = elementView.model.get('itemId');
    if (itemId) that._showContextMenu(evt.clientX, evt.clientY, itemId);
  });
  
  this._paper.on('blank:pointerclick', () => that._clearSelection());
  
  // Element drag tracking
  this._paper.on('element:pointerdown', (elementView) => {
    const el = elementView.model;
    el._isDragging = false;
    el._dragStartPosition = el.position();
    // Bring element to front so it paints on top of other items while dragging.
    // SVG uses document order for painting; toFront() moves the <g> node last.
    el.toFront();
  });
  
  this._graph.on('change:position', (element, newPosition) => {
    if (!that._isRestoring && element._dragStartPosition && !element._isDragging) {
      const start = element._dragStartPosition;
      if (Math.abs(start.x - newPosition.x) > 1 || Math.abs(start.y - newPosition.y) > 1) {
        that._saveState();
        element._isDragging = true;
      }
    }
  });
  
  this._paper.on('element:pointerup', (elementView) => {
    delete elementView.model._isDragging;
    delete elementView.model._dragStartPosition;
  });
  
  // Vertex drag tracking
  this._graph.on('change:vertices', (link) => {
    if (that._isRestoring || link._programmaticVertexChange) {
      delete link._programmaticVertexChange;
      return;
    }
    if (!link._vertexDragStateSaved) {
      const current = link.get('vertices'), prev = link.previous('vertices');
      link.set('vertices', prev, { silent: true });
      that._saveState();
      link.set('vertices', current, { silent: true });
      link._vertexDragStateSaved = true;
    }
  });
  
  this._paper.on('link:pointerup', (linkView) => delete linkView.model._vertexDragStateSaved);
  this._paper.on('blank:pointerup', () => {
    that._graph.getLinks().forEach(link => delete link._vertexDragStateSaved);
  });
  
  // Link connection
  this._graph.on('change:target', (link, newTarget) => {
    if (!newTarget?.id || !newTarget?.port) return;
    const source = link.get('source');
    if (!source?.id || !source?.port) return;
    
    // Check for duplicate connection (excluding the current link being created)
    if (!that._isRestoring) {
      const isDuplicate = that._graph.getLinks()
        .filter(l => l.id !== link.id)
        .some(l => {
          const s = l.get('source'), t = l.get('target');
          return s?.id && t?.id &&
                 s.id === source.id && s.port === source.port &&
                 t.id === newTarget.id && t.port === newTarget.port;
        });
      
      if (isDuplicate) {
        // Mark as duplicate but don't remove yet - let the pointerup handler deal with it
        link._isDuplicateConnection = true;
        return;
      }
    }
    
    const prevTarget = link.previous('target');
    if (!that._isRestoring && (!prevTarget || !prevTarget.id) && !that._linkOperationInProgress) {
      link.set('target', prevTarget, { silent: true });
      that._saveState();
      link.set('target', newTarget, { silent: true });
      that._linkOperationInProgress = true;
    }
    
    const srcEl = that._graph.getCell(source.id), tgtEl = that._graph.getCell(newTarget.id);
    if (!srcEl || !tgtEl) return;
    const fromItem = that._itemFromCellId(source.id), toItem = that._itemFromCellId(newTarget.id);
    if (fromItem?.onConnect?.(fromItem, source.port, toItem, newTarget.port) === false) link.remove();
    that._linkOperationInProgress = false;
    
    // Update disconnected highlights after connection is made
    if (!that._isRestoring) {
      setTimeout(() => that._updateDisconnectedHighlights(), 0);
    }
  });
  
  this._graph.on('remove', (cell) => {
    if (!cell.isLink()) return;
    if (!that._isRestoring) that._saveState();
    const source = cell.get('source'), target = cell.get('target');
    if (!source?.id || !target?.id) return;
    const fromItem = that._itemFromCellId(source.id), toItem = that._itemFromCellId(target.id);
    if (!fromItem || !toItem) return;
    fromItem?.onDisconnect?.(fromItem, source.port, toItem, target.port);
    if (!that._isRestoring) {
      setTimeout(() => that._updateDisconnectedHighlights(), 0);
    }
  });
  
  // Zoom with wheel
  if (this._options.zoom.wheel) {
    this._canvasWrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      that._setZoom(that._currentZoom + (e.deltaY > 0 ? -that._options.zoom.wheelSensitivity : that._options.zoom.wheelSensitivity));
    }, { passive: false });
  }
  
  // Pan with drag on blank canvas only.
  if (this._options.pan) {
    // Inject cursor CSS once.
    // .floria-pan-hover → grab cursor only when over the active canvas area
    // .floria-panning   → grabbing cursor during active drag (overrides everything)
    const styleId = 'floria-pan-cursor-' + this._divId;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent =
        `#${this._divId}_CANVAS.floria-pan-hover > svg { cursor: grab !important; }\n` +
        `#${this._divId}_CANVAS.floria-panning > svg,\n` +
        `#${this._divId}_CANVAS.floria-panning > svg * { cursor: grabbing !important; }`;
      document.head.appendChild(style);
    }

    let isPanning = false, panStartX, panStartY;

    // Returns true only when the pointer is inside the active boundary area.
    const isInsideBoundary = (clientX, clientY) => {
      const { maxW, maxH } = that._options.dimensions;
      if (!maxW && !maxH) return true;
      const local = that._paper.clientToLocalPoint({ x: clientX, y: clientY });
      return local.x >= 0 && local.y >= 0 &&
             local.x <= (maxW || 8000) && local.y <= (maxH || 8000);
    };

    // Update hover class as the mouse moves over the wrapper.
    // blank:pointerdown already excludes cells/links, so here we only need to
    // track whether the pointer is inside the canvas boundary vs the grey background.
    this._canvasWrapper.addEventListener('mousemove', (evt) => {
      if (isPanning) return; // keep .floria-panning during drag
      if (isInsideBoundary(evt.clientX, evt.clientY)) {
        that._canvasWrapper.classList.add('floria-pan-hover');
      } else {
        that._canvasWrapper.classList.remove('floria-pan-hover');
      }
    });

    this._canvasWrapper.addEventListener('mouseleave', () => {
      if (!isPanning) that._canvasWrapper.classList.remove('floria-pan-hover');
    });

    // blank:pointerdown only fires on blank canvas (not cells/links).
    this._paper.on('blank:pointerdown', (evt) => {
      if (!isInsideBoundary(evt.clientX, evt.clientY)) return;
      isPanning = true;
      panStartX = evt.clientX - that._panX;
      panStartY = evt.clientY - that._panY;
      that._canvasWrapper.classList.remove('floria-pan-hover');
      that._canvasWrapper.classList.add('floria-panning');
      evt.preventDefault();
    });

    // Store bound references on the instance so destroy() can remove exactly
    // these document-level listeners without affecting any other FloriaDiagram
    // instance that may be active on the page at the same time.
    this._boundDocPanMouseMove = (evt) => {
      if (!isPanning) return;
      const raw = { x: evt.clientX - panStartX, y: evt.clientY - panStartY };
      const clamped = that._clampPan(raw.x, raw.y);
      that._panX = clamped.x;
      that._panY = clamped.y;
      that._applyTransform();
    };
    this._boundDocPanMouseUp = () => {
      if (!isPanning) return;
      isPanning = false;
      that._canvasWrapper.classList.remove('floria-panning');
    };
    document.addEventListener('mousemove', this._boundDocPanMouseMove);
    document.addEventListener('mouseup',   this._boundDocPanMouseUp);
  }
};

FloriaDiagram.prototype._setupKeyboardShortcuts = function() {
  const that = this;
  // Bound reference stored on the instance so destroy() can remove exactly
  // this listener without disturbing keyboard shortcuts of other, still-active
  // FloriaDiagram instances on the same page.
  this._boundKeydown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); that.undo(); }
    else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); that.redo(); }
  };
  document.addEventListener('keydown', this._boundKeydown);
};

// ============================================================================
// INTERNAL UTILITIES
// ============================================================================

FloriaDiagram.prototype._itemFromCellId = function(cellId) {
  const cell = this._graph.getCell(cellId);
  if (!cell) return null;
  return this._items.get(cell.get('itemId')) || null;
};

FloriaDiagram.prototype._applyTransform = function() {
  this._paper.scale(this._currentZoom, this._currentZoom);
  this._paper.translate(this._panX, this._panY);
  this._syncBoundaryTransform();
};

// Keeps the canvas from being panned off-screen; see docs/module-diagram.md §7.
FloriaDiagram.prototype._clampPan = function(panX, panY) {
  const { maxW, maxH } = this._options.dimensions;
  if (!maxW && !maxH) return { x: panX, y: panY };

  const rect = this._container.getBoundingClientRect();
  const z  = this._currentZoom;
  const bw = (maxW || 8000) * z;
  const bh = (maxH || 8000) * z;
  const MIN_VISIBLE = 250;
  return {
    x: Math.min(Math.max(MIN_VISIBLE - bw, panX), rect.width  - MIN_VISIBLE),
    y: Math.min(Math.max(MIN_VISIBLE - bh, panY), rect.height - MIN_VISIBLE)
  };
};

FloriaDiagram.prototype._setZoom = function(zoom) {
  this._currentZoom = Math.max(this._options.zoom.min, Math.min(this._options.zoom.max, zoom));
  const clamped = this._clampPan(this._panX, this._panY);
  this._panX = clamped.x;
  this._panY = clamped.y;
  this._applyTransform();
};

FloriaDiagram.prototype._clearSelection = function() {
  if (this._selectedId) {
    const el = this._elements.get(this._selectedId);
    if (el) { el.attr('body/stroke', '#333'); el.attr('body/strokeWidth', 1); }
    this._selectedId = null;
  }
};

FloriaDiagram.prototype._saveState = function() {
  this._undoStack.push(this.serialize());
  if (this._undoStack.length > this._options.undo) this._undoStack.shift();
  this._redoStack = [];
  if (!this._isRestoring) this._options.onModified?.();
};

FloriaDiagram.prototype._findNonOverlappingOffset = function(targetX, targetY, width, height) {
  const STEP = 30, MAX = 20;
  const hasOverlap = (x, y) => {
    for (const [, el] of this._elements) {
      const pos = el.position(), size = el.size();
      const ox = Math.max(0, Math.min(x + width, pos.x + size.width) - Math.max(x, pos.x));
      const oy = Math.max(0, Math.min(y + height, pos.y + size.height) - Math.max(y, pos.y));
      if (ox * oy > width * height * 0.5) return true;
    }
    return false;
  };
  if (!hasOverlap(targetX, targetY)) return { x: targetX, y: targetY };
  for (let i = 1; i <= MAX; i++) {
    const offsets = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
    for (const [dx, dy] of offsets) {
      const nx = targetX + dx * i * STEP, ny = targetY + dy * i * STEP;
      if (!hasOverlap(nx, ny)) return { x: nx, y: ny };
    }
  }
  return { x: targetX + STEP * 2, y: targetY + STEP * 2 };
};

FloriaDiagram.prototype._createPortConfig = function(ports) {
  const inPortAttrs = {
    circle: { 
      r: 4, 
      magnet: 'passive', 
      stroke: '#5c6bc0', 
      strokeWidth: 1, 
      fill: '#fff',
      cursor: 'default'
    },
    text: { fontSize: 10, fill: '#333' }
  };
  const outPortAttrs = {
    circle: { 
      r: 6, 
      magnet: true, 
      stroke: '#5c6bc0', 
      strokeWidth: 1, 
      fill: '#fff',
      cursor: this._readOnly ? 'default' : 'crosshair'
    },
    text: { fontSize: 10, fill: '#333' }
  };
  return {
    groups: {
      in: { position: { name: 'left' }, attrs: inPortAttrs, label: { position: { name: 'left', args: { x: -12 } } } },
      out: { position: { name: 'right' }, attrs: outPortAttrs, label: { position: { name: 'right', args: { x: 12 } } } }
    },
    items: [
      ...(ports.in || []).map(p => ({ id: p.id, group: 'in', attrs: { text: { text: p.label || '' } } })),
      ...(ports.out || []).map(p => ({ id: p.id, group: 'out', attrs: { text: { text: p.label || '' } } }))
    ]
  };
};

FloriaDiagram.prototype._redrawAllItems = function() {
  this._items.forEach((item, id) => {
    const el = this._elements.get(id);
    if (el && item.draw) item.draw(el, item);
  });
};

FloriaDiagram.prototype._restoreState = function(state) {
  this._isRestoring = true;
  try {
    const restoredIds = new Set(state.items?.map(i => i.id) || []);
    
    // Remove items not in restored state
    for (const [itemId, item] of this._items) {
      if (!restoredIds.has(itemId)) {
        this._elements.get(itemId)?.remove();
        this._elements.delete(itemId);
        item.onRemove?.(item);
        this._items.delete(itemId);
      }
    }
    
    // Remove all links
    this._graph.getLinks().forEach(link => link.remove());
    
    // Update positions
    state.items?.forEach(s => {
      const el = this._elements.get(s.id);
      if (el) {
        el.position(s.x, s.y);
        const item = this._items.get(s.id);
        if (item) { item._x = s.x; item._y = s.y; }
      }
    });
    
    // Restore links
    state.connectors?.forEach(c => {
      const srcEl = this._elements.get(c.from.id), tgtEl = this._elements.get(c.to.id);
      if (srcEl && tgtEl) {
        const newLink = createLink(
          { id: srcEl.id, port: c.from.port },
          { id: tgtEl.id, port: c.to.port },
          c.vertices
        );
        this._graph.addCell(newLink);
      }
    });

    this._redrawAllItems();
    this._paper.update();
  } finally {
    this._isRestoring = false;
  }
};

// ============================================================================
// PUBLIC API
// ============================================================================

FloriaDiagram.prototype.add = function(item) {
  if (!item?.id) throw new Error('FloriaDiagram.add: item.id is required');
  if (this._items.has(item.id)) throw new Error(`FloriaDiagram.add: item '${item.id}' already exists`);
  if (this._readOnly && !this._isRestoring) throw new Error('FloriaDiagram.add: cannot add items in read-only mode');
  
  if (!this._isRestoring) this._saveState();
  
  const rect = this._container.getBoundingClientRect();
  let x = item.x ?? (rect.width / 2 - 75) / this._currentZoom - this._panX;
  let y = item.y ?? (rect.height / 2 - 40) / this._currentZoom - this._panY;
  
  if (item.x === undefined && item.y === undefined) {
    const pos = this._findNonOverlappingOffset(x, y, 150, 60);
    x = pos.x; y = pos.y;
  }
  
  const ports = item.ports || { in: [{ id: 'in', label: '' }], out: [{ id: 'out', label: '' }] };
  const maxPorts = Math.max(ports.in?.length || 0, ports.out?.length || 0);
  
  const element = new joint.shapes.standard.Rectangle({
    position: { x, y },
    size: { width: 150, height: Math.max(60, maxPorts * 25 + 30) },
    attrs: {
      body: { fill: '#eef2fa', stroke: '#333', strokeWidth: 1, rx: 5, ry: 5 },
      label: { text: item.type || item.id, fill: '#333', fontSize: 14, fontWeight: 'bold' }
    },
    ports: this._createPortConfig(ports)
  });
  
  element.set('itemId', item.id);
  item._x = x; item._y = y;
  this._items.set(item.id, item);
  this._elements.set(item.id, element);
  this._graph.addCell(element);
  // Belt-and-braces default fill/stroke as inline style — see forceElementStyle()'s docs above
  // (and docs/module-diagram.md §10-I). Any custom item.draw() (invoked next, when not restoring)
  // that sets its own colors should do the same for its own body/rect selectors.
  forceElementStyle(element.findView(this._paper)?.selectors?.body, { fill: '#eef2fa', stroke: '#333', 'stroke-width': '1px' });
  if (!this._isRestoring) item.draw?.(element, item); // deferred during restore — see docs §10-D
  
  element.on('change:position', (el, pos) => {
    const it = this._items.get(item.id);
    if (it) { it._x = pos.x; it._y = pos.y; }
  });
  
  return element;
};

FloriaDiagram.prototype.remove = function(id) {
  if (this._readOnly) { console.warn('FloriaDiagram.remove: cannot remove items in read-only mode'); return false; }
  const item = this._items.get(id), element = this._elements.get(id);
  if (!item || !element) { console.warn(`FloriaDiagram.remove: '${id}' not found`); return false; }
  
  this._saveState();
  item.onRemove?.(item);
  if (this._selectedId === id) this._selectedId = null;
  element.remove();
  this._items.delete(id);
  this._elements.delete(id);
  return true;
};

FloriaDiagram.prototype.update = function(id) {
  const item = this._items.get(id), element = this._elements.get(id);
  if (!item || !element) { console.warn(`FloriaDiagram.update: '${id}' not found`); return false; }
  item.draw?.(element, item);
  return true;
};

FloriaDiagram.prototype.select = function(id) {
  this._clearSelection();
  const item = this._items.get(id), element = this._elements.get(id);
  if (!item || !element) { console.warn(`FloriaDiagram.select: '${id}' not found`); return false; }
  element.attr('body/stroke', '#5c6bc0');
  element.attr('body/strokeWidth', 3);
  this._selectedId = id;
  item.onSelect?.(item);
  return true;
};

FloriaDiagram.prototype.getItem = function(id) { return this._items.get(id) || null; };
FloriaDiagram.prototype.getElement = function(id) { return this._elements.get(id) || null; };
FloriaDiagram.prototype.getSelectedId = function() { return this._selectedId; };
FloriaDiagram.prototype.zoomIn = function() { this._setZoom(this._currentZoom + 0.1); };
FloriaDiagram.prototype.zoomOut = function() { this._setZoom(this._currentZoom - 0.1); };
FloriaDiagram.prototype.resetView = function() { this._currentZoom = 1; this._panX = 0; this._panY = 0; this._applyTransform(); };

// Computes the bounding box of every item currently on the diagram, then sets zoom/pan so
// that entire bounding box is centred and fully visible within the container (clamped to
// the configured zoom.min/zoom.max — content larger than what min zoom allows will be
// centred but not fully shrunk-to-fit). No-op if the diagram has no items yet, or if the
// container isn't currently laid out with real pixel dimensions (e.g. display:none).
// Intended primarily for read-only embedded viewers where there is no manual zoom/pan UX
// expectation and the whole graph should simply "just fit" on first render.
FloriaDiagram.prototype.fitToContent = function(padding = 40) {
  if (this._items.size === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  this._elements.forEach((el) => {
    const pos = el.position(), size = el.size();
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + size.width);
    maxY = Math.max(maxY, pos.y + size.height);
  });
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;

  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);

  const rect = this._container.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const availW = Math.max(50, rect.width  - padding * 2);
  const availH = Math.max(50, rect.height - padding * 2);

  let zoom = Math.min(availW / contentW, availH / contentH);
  zoom = Math.max(this._options.zoom.min, Math.min(this._options.zoom.max, zoom));
  this._currentZoom = zoom;

  const centerContentX = minX + contentW / 2;
  const centerContentY = minY + contentH / 2;
  this._panX = rect.width  / 2 - centerContentX * zoom;
  this._panY = rect.height / 2 - centerContentY * zoom;

  this._applyTransform();
};



FloriaDiagram.prototype.fullscreen = function(toggle) {
  const shouldBe = toggle !== undefined ? toggle : !this._isFullscreen;
  if (shouldBe && !this._isFullscreen) {
    this._originalStyles = { position: this._container.style.position, top: this._container.style.top,
      left: this._container.style.left, right: this._container.style.right, bottom: this._container.style.bottom,
      width: this._container.style.width, height: this._container.style.height, zIndex: this._container.style.zIndex };
    // Use inset (top/left/right/bottom = 0) rather than width:100vw/height:100vh: when this container
    // sits inside an ancestor with a CSS transform (e.g. a FloriaDialog, which transforms/positions its
    // modal wrapper), `position:fixed` is contained by that transformed ancestor — NOT the true browser
    // viewport — while `vw`/`vh` units still resolve against the real viewport. That mismatch made the
    // fullscreen canvas balloon past the dialog's own bounds, pushing its controls (incl. this very
    // "exit fullscreen" button) outside the dialog's clipped/visible area. Inset-based sizing instead
    // always fills whatever the actual containing block turns out to be (viewport OR a transformed
    // dialog ancestor), so the controls stay reachable in both contexts.
    Object.assign(this._container.style, { position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', width: '', height: '', zIndex: '9999' });
    this._isFullscreen = true;
  } else if (!shouldBe && this._isFullscreen) {
    if (this._originalStyles) Object.assign(this._container.style, this._originalStyles);
    this._isFullscreen = false;
  }
  this._fullscreenBtn.title = this._isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen';
  this._paper.setDimensions('100%', '100%');
};

FloriaDiagram.prototype.undo = function() {
  if (this._readOnly) return false;
  if (this._undoStack.length === 0) return false;
  this._redoStack.push(this.serialize());
  this._restoreState(this._undoStack.pop());
  this._options.onModified?.();
  return true;
};

FloriaDiagram.prototype.redo = function() {
  if (this._readOnly) return false;
  if (this._redoStack.length === 0) return false;
  this._undoStack.push(this.serialize());
  this._restoreState(this._redoStack.pop());
  this._options.onModified?.();
  return true;
};

FloriaDiagram.prototype.getUndoRedoInfo = function() {
  return {
    undoStack: this._undoStack.map(s => `${s.items?.length||0} items, ${s.connectors?.length||0} links`),
    redoStack: this._redoStack.map(s => `${s.items?.length||0} items, ${s.connectors?.length||0} links`),
    current: `${this._items.size} items, ${this._graph.getLinks().length} links`
  };
};

// Accepts a pre-fetched links array so callers can avoid repeated getLinks() calls.
FloriaDiagram.prototype._isItemConnected = function(itemId, links) {
  const element = this._elements.get(itemId);
  if (!element) return false;
  const allLinks = links || this._graph.getLinks();
  return allLinks.some(link => {
    const src = link.get('source'), tgt = link.get('target');
    return (src?.id === element.id && tgt?.id) || (tgt?.id === element.id && src?.id);
  });
};

FloriaDiagram.prototype._highlightDisconnectedItems = function() {
  if (!this._options.highlightDisconnected || this._isRestoring) return;
  const links = this._graph.getLinks(); // fetch once for all items
  this._items.forEach((item, id) => {
    const element = this._elements.get(id);
    if (!element) return;
    if (!this._isItemConnected(id, links)) {
      element.attr('body/stroke', '#f44336');
      element.attr('body/strokeWidth', 3);
      element._isDisconnected = true;
    }
  });
};

FloriaDiagram.prototype._clearDisconnectedHighlight = function(itemId) {
  const element = this._elements.get(itemId);
  if (!element || !element._isDisconnected) return;
  element._isDisconnected = false;
  // draw() is responsible for all visual styling — no need to manually reset stroke here
  const item = this._items.get(itemId);
  if (item?.draw) item.draw(element, item);
};

FloriaDiagram.prototype._updateDisconnectedHighlights = function() {
  if (!this._options.highlightDisconnected || this._isRestoring) return;
  const links = this._graph.getLinks(); // fetch once for all items
  this._items.forEach((item, id) => {
    const connected = this._isItemConnected(id, links);
    const element   = this._elements.get(id);
    if (!element) return;
    if (connected && element._isDisconnected) {
      this._clearDisconnectedHighlight(id);
    } else if (!connected && !element._isDisconnected) {
      element.attr('body/stroke', '#f44336');
      element.attr('body/strokeWidth', 3);
      element._isDisconnected = true;
    }
  });
};

FloriaDiagram.prototype.serialize = function() {
  const items = [], connectors = [];
  this._items.forEach((item, id) => { // boundary rect is not in _items so it is automatically excluded
    const el = this._elements.get(id);
    if (el) {
        const pos = el.position();
        const entry = { id: item.id, type: item.type, x: pos.x, y: pos.y };
        if (item.extras && typeof item.extras === 'object') {
          const reserved = ['id','type','x','y'];
          reserved.forEach(k => { if (k in item.extras) console.warn(`FloriaDiagram: extras.${k} on item '${item.id}' shadows a reserved key — it will be stored in extras but will NOT override the item's ${k} on restore`); });
          entry.extras = { ...item.extras };
        }
        items.push(entry);
      }
  });
  this._graph.getLinks().forEach(link => {
    const src = link.get('source'), tgt = link.get('target');
    if (!src?.id || !tgt?.id) return;
    const fromItem = this._itemFromCellId(src.id), toItem = this._itemFromCellId(tgt.id);
    if (fromItem && toItem) connectors.push({ from: { id: fromItem.id, port: src.port }, to: { id: toItem.id, port: tgt.port }, vertices: link.get('vertices') || [] });
  });
  
  return { items, connectors };
};

// Shared core for load() and deserialize(). Caller must set _isRestoring=true first.
FloriaDiagram.prototype._loadGraph = function(state, itemFactory) {
  state.items?.forEach(s => {
    const item = itemFactory(s.id, s.type);
    if (!item) return;
    item.id   = s.id;
    item.type = s.type;
    item.x    = s.x;
    item.y    = s.y;
    if (s.extras && typeof s.extras === 'object') item.extras = { ...s.extras };
    this.add(item);
  });

  state.connectors?.forEach(c => {
    const srcEl = this._elements.get(c.from.id), tgtEl = this._elements.get(c.to.id);
    if (srcEl && tgtEl) {
      this._graph.addCell(createLink(
        { id: srcEl.id, port: c.from.port },
        { id: tgtEl.id, port: c.to.port },
        c.vertices
      ));
    }
  });

  // draw() deferred until all items + connectors are present (see docs §10-D)
  this._redrawAllItems();
};

FloriaDiagram.prototype.deserialize = function(json, itemFactory) {
  if (!json || !itemFactory) throw new Error('FloriaDiagram.deserialize: json and itemFactory required');
  this._graph.clear();
  this._items.clear();
  this._elements.clear();
  this._selectedId = null;
  this._undoStack  = [];
  this._redoStack  = [];

  this._isRestoring = true;
  try   { this._loadGraph(json, itemFactory); }
  finally { this._isRestoring = false; }

  this._createCanvasBoundary();
};

// See docs/module-diagram.md §6.3 for parameter details and timing note.
FloriaDiagram.prototype.load = function(state, itemFactory, options = {}) {
  if (!state || !itemFactory) throw new Error('FloriaDiagram.load: state and itemFactory required');

  this._graph.clear();
  this._items.clear();
  this._elements.clear();
  this._selectedId = null;
  this._undoStack  = [];
  this._redoStack  = [];
  this._readOnly   = options.readOnly ?? false;

  this._isRestoring = true;
  try   { this._loadGraph(state, itemFactory); }
  finally { this._isRestoring = false; }

  this._createCanvasBoundary();
  this._updateInteractivity();
  this._elements.forEach(el => { el._isDisconnected = false; });
};

FloriaDiagram.prototype.isReadOnly  = function() { return this._readOnly; };
FloriaDiagram.prototype.setReadOnly = function(readOnly) { this._readOnly = readOnly; this._updateInteractivity(); };

FloriaDiagram.prototype._updateInteractivity = function() {
  const ro = this._readOnly;

  this._paper.setInteractivity({
    linkMove:      !ro, labelMove:   !ro, arrowheadMove: !ro,
    vertexMove:    !ro, vertexAdd:   !ro, vertexRemove:  !ro,
    useLinkTools:  !ro, elementMove: !ro
  });

  const portCursor = ro ? 'default'    : 'crosshair';
  const bodyCursor = ro ? 'default'    : 'move';
  const linkCursor = ro ? 'default'    : 'pointer';

  this._elements.forEach(element => {
    element.getPorts().forEach(port => {
      if (port.group === 'out')
        element.portProp(port.id, 'attrs/circle/cursor', portCursor);
    });
    element.attr('body/cursor', bodyCursor);
  });

  this._graph.getLinks().forEach(link => {
    link.attr('line/cursor',    linkCursor);
    link.attr('wrapper/cursor', linkCursor);
  });

  if (ro) {
    this._paper.$el.addClass('floria-readonly');
    if (!document.getElementById('floria-readonly-style')) {
      const style = document.createElement('style');
      style.id = 'floria-readonly-style';
      style.textContent = '.floria-readonly .joint-cell { cursor: default !important; }';
      document.head.appendChild(style);
    }
  } else {
    this._paper.$el.removeClass('floria-readonly');
  }
};

FloriaDiagram.prototype.clear = function() {
  if (this._readOnly) { console.warn('FloriaDiagram.clear: cannot clear in read-only mode'); return false; }
  this._saveState();
  this._graph.clear();
  this._items.clear();
  this._elements.clear();
  this._selectedId = null;
  this._createCanvasBoundary();
};

FloriaDiagram.prototype.destroy = function() {
  if (this._destroyed) return; // idempotent — safe to call more than once
  this._destroyed = true;

  // ── Remove document-level listeners registered by THIS instance only ──────
  // Each of these was stored as a bound reference at registration time so we
  // can remove exactly this instance's listener without affecting any other
  // FloriaDiagram instance that may still be active on the page.
  if (this._boundKeydown)             document.removeEventListener('keydown', this._boundKeydown);
  if (this._boundDocPanMouseMove)     document.removeEventListener('mousemove', this._boundDocPanMouseMove);
  if (this._boundDocPanMouseUp)       document.removeEventListener('mouseup',   this._boundDocPanMouseUp);
  if (this._boundDocClickContextMenu) document.removeEventListener('click', this._boundDocClickContextMenu);
  if (this._boundDocClickLinkContextMenu) document.removeEventListener('click', this._boundDocClickLinkContextMenu);

  // Remove this instance's own pan-cursor <style> tag (uniquely keyed by
  // divId, so this never affects any other instance's stylesheet).
  const panStyle = document.getElementById('floria-pan-cursor-' + this._divId);
  if (panStyle) panStyle.remove();

  // NOTE: we deliberately do NOT remove '#floria-readonly-style' — it is a
  // single shared/global stylesheet used by every read-only FloriaDiagram
  // instance on the page. Removing it here could break the cursor styling
  // of other instances that are still active. It is tiny and idempotent to
  // (re)create, so it is simply left in the document permanently.
  // Similarly, _measureText's shared hidden <svg> (a module-level singleton
  // used for text-width measurement by ALL instances) must not be torn down.

  this._contextMenu?.parentNode?.removeChild(this._contextMenu);
  this._subMenu?.parentNode?.removeChild(this._subMenu);
  this._linkContextMenu?.parentNode?.removeChild(this._linkContextMenu);
  this._removeCanvasBoundary();
  this._graph.clear();
  this._paper.remove();
  this._container.innerHTML = '';
  this._items.clear();
  this._elements.clear();
  this._undoStack = [];
  this._redoStack = [];
};
