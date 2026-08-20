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

import { FloriaDOM         }  from "./module-dom.js";
import { FloriaText        }  from "./module-text.js";
import { FloriaDate        }  from "./module-date.js";

FloriaDOM.injectCSSLink("FLORIA_CSS_ANCHOR", true, new URL("./module-tables.css", import.meta.url).href);



function getColumnDescriptionTitle(colName, dataDictionary)
 {
   if (dataDictionary != null)
    {
      var col = dataDictionary.getSE(colName, "columnName");
      if (col != null)
       return 'title="'+FloriaText.TextUtil.printHtmlAttrValue(col.description)+'"';
    }
   return "";
 }
 
function paintHeaders(mappings, dataDictionary, start)
 {
   var str = "<TH></TH>";
   for (let m = start; m < mappings.length; ++m)
     str+='<TH class="rotate" '+getColumnDescriptionTitle(mappings[m].field, dataDictionary)+'><DIV><SPAN>'+FloriaText.print(mappings[m].label, FloriaText.spanNA)+'</SPAN></DIV></TH>';
   return str;
 }
 
function paintRows(data, mappings, isTotalRow)
 {
   if (data == null || data.length == 0)
    return '<TR><TD colspan="'+(mappings.length+1)+'"><BR><BR><BR>No data found at this time. Check your filter settings.</TD></TR>';

   var str = "";
   for (let i = 0; i < data.length; ++i)
     {
       var d = data[i];
       if (isTotalRow==true)
        str+='<TR class="totalRow"><TD>&nbsp;</TD>';
       else
        str+='<TR class="selectableItem" data-rowid="'+i+'"><TD align="right"  class="boldable">'+(i+1)+'</TD>';

       for (var m = 0; m < mappings.length; ++m)
         {
           var map = mappings[m];
           var title = '';
           if (map.title != null)
            {
              title = map.title;
              if (FloriaDOM.isFunction(title) == true)
               title = title(d);
              if (map.columns != null)
               for (var c = 0; c < map.columns.length; ++c)
                title = title.replaceAll("$"+(c+1), d[map.columns[c]]);
              title = "title=\""+title+"\"";
            }
           var backgroundColor = map.backgroundColorFormatter == null ? null : map.backgroundColorFormatter(d);
           backgroundColor = backgroundColor == null ? "" : 'style="background-color:'+backgroundColor+';"';
           if (map.formatter != null)
            str+='<TD '+title+' '+backgroundColor+'>'+map.formatter(d)+'</TD>';
//           else if (map.score != null)
//            str+='<TD '+title+'><img border="1px" src="/static/img/gauge'+CohortRiskManager.getRiskScale(map.score, d[map.field])+'.jpg"></TD>';
           else if (map.flag == true)
            str+='<TD '+title+' '+backgroundColor+'>'+FloriaText.TextUtil.getSemanticCheckbox(d[map.field])+'</TD>';
           else if (map.date == true)
            str+='<TD '+title+' '+backgroundColor+'>'+FloriaText.print(FloriaDate.toDtStr(d[map.field], true), FloriaText.spanNA)+'</TD>';
           else if (isTotalRow==true && d[map.field] == undefined)
            str+='<TD>&nbsp;</TD>';
           else 
            str+='<TD '+title+' '+backgroundColor+' '+(m==0?' class="boldable"':'')+'>'+FloriaText.print(d[map.field], FloriaText.spanNA)+'</TD>';
         }
       str+='</TR>';
     }
    return str;
 }


export var BoardManager = { };

BoardManager.paint = function(divId, data, mappings, dataDictionary, timerFunc, tableCssClasses)
 {
   var config = mappings==null || mappings.length == 0 ? null : mappings[0].config;
   var idCol = config?.idCol;
   var toolbarClassName = config?.toolbarClassName;
   
   var dt = config?.dateCol == null || data == null || data.length == 0 
          ? ""
          : "Refreshed on: "+FloriaDate.toDtStr(data[0][config.dateCol])+' 00:00'
          ;
   if (tableCssClasses == null)
    tableCssClasses = "tableLayout rowSelectable rowHighlightable stickyHeader";
   var timingDivId = divId+"_TIMING";
   var str = `<TABLE class="${tableCssClasses}" border="0px" cellpadding="2px">
              <TR valign="bottom">
                <TH colspan="2" style="text-align:left; width:1px;">
                  ${FloriaText.isNoE(toolbarClassName)==true?'':'<DIV id="'+divId+'_MINI_TOOLBAR" class="'+toolbarClassName+'"></DIV><BR>'}
                  <DIV id="${timingDivId}">${dt}</DIV>
                  <BR>
                  Patient Count: ${data==null?0:data.length}<BR>
                  <BR>
                  ${mappings[0].label}
                </TH>
             `;
   str+=paintHeaders(mappings, dataDictionary, 1);
   str+='</TR>';
   str+=paintRows(data, mappings);
   str+='</TABLE>';
   FloriaDOM.setInnerHTML(divId, str);
   if (timerFunc != null)
    timerFunc(timingDivId);
 }



export var HeatTable = { };

HeatTable.paint = function(divId, data, mappings, dataDictionary, totalRowFields, title, tableCssClasses, onClickHandler)
 {
   var str = (title||'')+`<TABLE id="${divId}_TABLE" class="${tableCssClasses}"><TR valign="bottom">`;
   str+=paintHeaders(mappings, dataDictionary, 0);
   str+='</TR>';
   str+=paintRows(data, mappings);
   if (totalRowFields != null)
    {
      var totalRow = data.createTotalRow(totalRowFields);
      str+='<TR class="blankRow"><TD colspan="'+mappings.length+1+'">&nbsp</TD></TR>';
      str+=paintRows([totalRow], mappings, true);
    }
   str+='</TABLE>';
   FloriaDOM.setInnerHTML(divId, str);
   if (onClickHandler != null)
    {
      FloriaDOM.addEvent(divId+"_TABLE", "click", function(e, event, target) {
           var TR = FloriaDOM.getAncestorNode(target, 'TR');
           if (TR == null || TR.dataset.rowid == null)
            return;
           var TABLE = FloriaDOM.getAncestorNode(TR, 'TABLE');
           for (let i = 0; i < TABLE.rows.length; ++i)
            FloriaDOM.removeCSS(TABLE.rows[i], "selected");
           FloriaDOM.addCSS(TR, "selected");
           onClickHandler(data[TR.dataset.rowid]);
      }, null, true);
    }
};


// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaTable
// A modern fixed-header, sortable, filterable table component.
//
// Column meta-data shape:
//   {
//     field       : string            – data property name
//     label       : string            – header label
//     sortable    : bool              – default false
//     preSorted   : 'asc'|'desc'      – optional; indicates the data is already sorted by this column
//                                       on first render. The sort icon will be shown immediately
//                                       without requiring a user click. Only one column should carry
//                                       this property; if multiple columns have it the last one wins.
//     align       : 'left'|'right'|'center'  – default: 'right' for integer/number, else 'left'
//     type        : 'string'|'string-ml'|'integer'|'number'|'date'|'datetime'|'boolean'
//     renderer    : function(row)→html  OR  string e.g. "date('short')" | "datetime('long')" | "number(2)"
//     title       : function(row)→string – optional; when present, its return value is set as the
//                                          cell's "title" attribute (tooltip shown on hover).
//     _sortOverride: function(row)→value – optional; when present, replaces the default field-value
//                                          extraction during sorting. Useful when the rendered value
//                                          differs from what should be sorted on (e.g. return -Infinity
//                                          for null/masked cells so they always sink to the bottom).
//     onClickHandler: function(row)       – optional; when present the cell content is wrapped in a
//                                          clickable span that appears as a link (blue + underline)
//                                          on row hover. The full data row object is passed to the
//                                          handler. The rest of the cell remains selectable/copyable.
//     clickable   : function(row)→bool    – optional; only meaningful when onClickHandler is set.
//                                          Called per row: when it returns false the cell is rendered
//                                          as plain text (no link, click suppressed) even though the
//                                          column has an onClickHandler. Use this to make only a
//                                          subset of rows selectable (e.g. inactive/locked users).
//     wrap        : 'clip'|'nowrap'|'wrap'|'pre'  – text overflow behaviour (default: 'clip' for string/string-ml, 'wrap' for all other types)
//                    'clip'   → single line, overflow hidden with ellipsis (…)
//                    'nowrap' → single line, content never clipped — column automatically shrinks
//                               to the width of its content (header label included) while other,
//                               flexible columns absorb the remaining table width. Ideal for short
//                               ids/counts/dates/small numeric columns. minWidth/maxWidth are
//                               ignored on nowrap columns (they wouldn't make sense here).
//                               NOTE: as soon as ANY column in the table uses wrap:'nowrap', the
//                               whole table switches from table-layout:fixed to table-layout:auto
//                               (required for the shrink-to-content trick to work).
//                    'wrap'   → normal word-wrap
//                    'pre'    → pre-wrap, preserves whitespace/newlines (classic string-ml behaviour)
//     minWidth    : string            – CSS min-width value (e.g. '120px'). Ignored for wrap:'nowrap' columns.
//     maxWidth    : string            – CSS max-width value (e.g. '300px'). Ignored for wrap:'nowrap' columns.
//     summary     : bool              – when true, this column is included in the summary (totals) row
//                                       pinned at the bottom. Values are summed across the currently
//                                       visible (filtered) rows. The column's renderer is used for
//                                       formatting. Only meaningful for numeric types.
//   }
//
//   Gap / spacer column — set gap:true to insert a visual separator between column groups.
//   Only minWidth is meaningful; all other properties are ignored.
//   Example: { gap: true, minWidth: '16px' }
//   Gap columns have no header text, no cell content, are not sortable, and are excluded from filter text.
//
// Constructor:
//   new FloriaTable(parentDivId, columns, data [, enableFilter=true [, wideTable=false [, showRowNumbers=true]]])
//
// wideTable=true  → enables horizontal scrolling; columns use natural (content) widths.
//                   Combine with minWidth/maxWidth on columns to control column widths precisely.
// wideTable=false → table stretches to fill the parent div width (default).
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ── Self-contained styles (injected once per page) ────────────────────────
(function() {
  if (document.getElementById('_ftbl_css')) return;
  var s = document.createElement('style');
  s.id = '_ftbl_css';
  s.textContent =
    '.ftbl-wrap-clip   { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }' +
    '.ftbl-wrap-nowrap { white-space:nowrap; overflow:visible; }' +
    '.ftbl-wrap-wrap   { white-space:normal; word-break:break-word; }' +
    '.ftbl-wrap-pre    { white-space:pre-wrap; }' +
    // Summary / totals footer — sticky at the bottom of the scroll container,
    // visually paired with the header: same background, bold text, top border.
    '.ftbl-table tfoot            { position:sticky; bottom:0; z-index:1; }' +
    '.ftbl-table tfoot td         { font-size:1rem; font-weight:600; padding:4px 6px;' +
    '                               background:var(--ftbl-header-bg, #f0f0f0);' +
    '                               border-top:2px solid #bbb; }' +
    // Prevent the sticky footer from rendering flush against the scrollbar
    '.ftbl-body                   { padding-bottom:1px; box-sizing:border-box; }' +
    // Clickable cell content — shown as a link only when the row is hovered,
    // so the text remains freely selectable/copyable the rest of the time.
    '.ftbl-link                   { cursor:pointer; }' +
    'tr:hover .ftbl-link          { color:#2563eb; text-decoration:underline; }';
  document.head.appendChild(s);
})();

// ── Built-in cell renderers ────────────────────────────────────────────────

const _FT_NA = '<span style="color:#9ca3af">—</span>';

/** Escape a column label for safe HTML insertion.
 *  After escaping, any literal \n, &lt;BR&gt;, or &lt;br&gt; sequences in the
 *  original string are converted to <br> so labels can wrap over multiple lines.
 *  Each line segment is wrapped in a nowrap span so individual lines never
 *  soft-wrap — only the explicit breaks take effect.
 *  Usage: write label: 'Patients\n(All)'  or  label: 'Patients<BR>(All)'
 */
function _ftEsc(s) {
  if (s == null) return '';
  var parts = String(s).split(/\n|<[Bb][Rr]\s*\/?>/g);
  for (var _i = 0; _i < parts.length; ++_i)
    parts[_i] = '<span style="white-space:nowrap">'
      + parts[_i]
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
      + '</span>';
  return parts.join('<br>');
}

function _ftVal(v) { return v == null || v === '' ? _FT_NA : v; }

/** Escape a value for safe insertion into an HTML attribute (e.g. title="..."). */
function _ftAttrEsc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const _FT_RENDERERS = {
  'date': function(fmt) {
    return function(row, field) {
      var v = row[field];
      if (v == null || v === '') return _FT_NA;
      var d = FloriaDate.parseDateTime(v);
      if (d == null) return _ftVal(v);
      return fmt === 'long' ? d.printFriendly(true, false) : d.printYYYYMMDD();
    };
  },
  'datetime': function(fmt) {
    return function(row, field) {
      var v = row[field];
      if (v == null || v === '') return _FT_NA;
      var d = FloriaDate.parseDateTime(v);
      if (d == null) return _ftVal(v);
      var dateStr = fmt === 'long' ? d.printFriendly(true, false) : d.printYYYYMMDD();
      var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
      var timeStr = (h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
      return dateStr + ' ' + timeStr;
    };
  },
  'number': function(decimals) {
    var dec = parseInt(decimals, 10);
    if (isNaN(dec)) dec = 2;
    return function(row, field) {
      var v = row[field];
      if (v == null || v === '') return _FT_NA;
      var n = parseFloat(v);
      return isNaN(n) ? _ftVal(v) : n.toFixed(dec);
    };
  }
};

/** Parse a renderer string like "date('short')", "number(2)" into a render function. */
function _ftParseRendererStr(spec, field) {
  var m = spec.match(/^(\w+)\(\s*['"']?([^'"')]*)['"']?\s*\)$/);
  if (m) {
    var name = m[1], arg = m[2];
    if (_FT_RENDERERS[name]) return _ftParseRendererFn(_FT_RENDERERS[name](arg), field);
  }
  return null;
}

function _ftParseRendererFn(fn, field) {
  return function(row) { return fn(row, field); };
}

/** Resolve a column's render function from its meta-data. Returns null for gap columns. */
function _ftResolveRenderer(col) {
  if (col.gap) return null;
  if (typeof col.renderer === 'function') return col.renderer;
  if (typeof col.renderer === 'string')   return _ftParseRendererStr(col.renderer, col.field);

  // Type-based defaults
  switch (col.type) {
    case 'date':      return _ftParseRendererFn(_FT_RENDERERS.date('short'),    col.field);
    case 'datetime':  return _ftParseRendererFn(_FT_RENDERERS.datetime('short'), col.field);
    case 'boolean':   return function(row) {
      var v = row[col.field];
      if (v == null) return _FT_NA;
      return v ? '<span class="ftbl-bool-true">✓</span>' : '<span class="ftbl-bool-false">✗</span>';
    };
    default: return null; // plain text
  }
}

/** Default alignment for a column if not specified. Gap columns default to 'left' (irrelevant). */
function _ftDefaultAlign(col) {
  if (col.gap)  return 'left';
  if (col.align) return col.align;
  if (col.type === 'integer' || col.type === 'number') return 'right';
  return 'left';
}

/** Default wrap behaviour for a column if not specified. Gap columns use 'clip' (irrelevant). */
function _ftDefaultWrap(col) {
  if (col.gap)  return 'clip';
  if (col.wrap) return col.wrap; // 'clip' | 'nowrap' | 'wrap' | 'pre' — all passed through as-is
  if (col.type == null || col.type === 'string' || col.type === 'string-ml') return 'clip';
  return 'wrap';
}

/** Build the inline style attribute string for min/max width constraints.
 *  For gap columns only min-width is emitted (max-width is intentionally omitted so the
 *  browser doesn't collapse the spacer when the table is wide).
 *  For nowrap columns, minWidth/maxWidth are ignored (they wouldn't make sense combined with
 *  shrink-to-content) and instead we emit width:1% — combined with white-space:nowrap (applied
 *  via the ftbl-wrap-nowrap class) this is the standard trick that makes a column shrink to the
 *  width of its content while sibling flexible columns absorb the remaining space. This requires
 *  the table to NOT be using table-layout:fixed — see _hasNowrapCol handling in the constructor
 *  and render(). */
function _ftWidthStyle(col) {
  if (col.gap) return col.minWidth ? ' style="min-width:' + col.minWidth + '"' : '';
  if (col._wrap === 'nowrap' || col.wrap === 'nowrap') return ' style="width:1%"';
  var parts = [];
  if (col.minWidth) parts.push('min-width:' + col.minWidth);
  if (col.maxWidth) parts.push('max-width:' + col.maxWidth);
  return parts.length ? ' style="' + parts.join(';') + '"' : '';
}

// ── Sort helpers ────────────────────────────────────────────────────────────

function _ftSortValue(row, col) {
  if (typeof col._sortOverride === 'function') return col._sortOverride(row);
  var v = row[col.field];
  if (v == null) return col.type === 'integer' || col.type === 'number' ? -Infinity : '';
  if (col.type === 'integer') return parseInt(v, 10) || 0;
  if (col.type === 'number')  return parseFloat(v)   || 0;
  if (col.type === 'date' || col.type === 'datetime') {
    var d = FloriaDate.parseDateTime(v);
    return d ? d.getTime() : 0;
  }
  return String(v).toLowerCase();
}

// ── FloriaTable export ───────────────────────────────────────────────────────

export class FloriaTable {

  /**
   * @param {string}   parentDivId      – ID of the host element
   * @param {Array}    columns          – column meta-data array (see above)
   * @param {Array}    data             – array of data objects
   * @param {boolean}  [enableFilter=true]
   * @param {boolean}  [wideTable=false]       – when true, enables horizontal scrolling
   * @param {boolean}  [showRowNumbers=true]   – when true (default), prepends a 1-based display
   *                                             row-number column. The number always reflects the
   *                                             current display order, not the original data index.
   * @param {number}   [preSelectedIndex=null] – 0-based index into `data` (original, unfiltered
   *                                             order) whose row should render as pre-selected
   *                                             (see .ftbl-row-selected) as soon as the table is
   *                                             first painted — no click / handler invocation,
   *                                             purely visual. Ignored if out of range.
   * @param {string}   [description=null]      – optional blurb rendered as a sibling flex-item
   *                                             inside the existing filter bar row (no extra
   *                                             vertical height). Clips with an ellipsis when it
   *                                             doesn't fit; the full text is always available via
   *                                             its `title` attribute. The filter input keeps a
   *                                             12em minimum width and absorbs/yields whatever
   *                                             space remains.
   * @param {boolean}  [descriptionFirst=false] – when true, the description sits to the LEFT of
   *                                             the filter input; otherwise (default) it sits to
   *                                             the right, after it.
   */
  constructor(parentDivId, columns, data, enableFilter = true, wideTable = false, showRowNumbers = true, preSelectedIndex = null, description = null, descriptionFirst = false) {
    this._id             = parentDivId;
    this._columns        = (columns || []).map(c => ({
      ...c,
      _align      : _ftDefaultAlign(c),
      _renderer   : _ftResolveRenderer(c),
      _wrap       : _ftDefaultWrap(c),
      _widthStyle : _ftWidthStyle(c)
    }));
    this._data           = data || [];
    this._enableFilter   = enableFilter;
    this._wideTable      = wideTable;
    this._showRowNumbers = showRowNumbers;
    this._description      = description;
    this._descriptionFirst = descriptionFirst === true;
    this._hasSummary     = (columns || []).some(c => c.summary === true);
    // Click-handler bookkeeping: when exactly ONE column carries an onClickHandler, the whole
    // row becomes clickable (pointer cursor + click-anywhere) instead of just that cell — see
    // _singleClickColIdx usage in render()/_renderRows(). With 2+ click columns, each retains
    // its own per-cell "link" styling/behaviour (row itself is not globally clickable).
    var _clickIdxs      = (columns || []).reduce((acc, c, i) => { if (typeof c.onClickHandler === 'function') acc.push(i); return acc; }, []);
    this._hasClickCol      = _clickIdxs.length > 0;
    this._singleClickColIdx = _clickIdxs.length === 1 ? _clickIdxs[0] : null;
    // Any column explicitly marked wrap:'nowrap' needs the table to use table-layout:auto
    // (not the default fixed layout for non-wide tables) so it can shrink to its content width —
    // see _ftWidthStyle()'s width:1% trick, which only works under auto layout.
    this._hasNowrapCol   = (columns || []).some(c => c.wrap === 'nowrap');
    // The currently "selected" row (by object reference) — set whenever a click-column's
    // handler is invoked (single- or multi-click-column mode alike), or up front via
    // preSelectedIndex. Rendered with a left accent border (see .ftbl-row-selected in
    // module-tables.css). Naturally clears itself across setData() calls since the old row
    // objects are no longer present in the new data.
    this._selectedRow    = (preSelectedIndex != null && this._data[preSelectedIndex] != null)
                          ? this._data[preSelectedIndex]
                          : null;
    this._filterText     = '';
    this._sortCol        = null;
    this._sortDir        = 1;
    // Honour preSorted on any column — the last one found wins
    for (var _pi = 0; _pi < this._columns.length; ++_pi) {
      var _pc = this._columns[_pi];
      if (_pc.preSorted === 'asc'  || _pc.preSorted === 'desc') {
        this._sortCol = _pi;
        this._sortDir = _pc.preSorted === 'asc' ? 1 : -1;
      }
    }
    this._visible        = null;
    this._loading        = (data == null);
  }

  // ── Public API ─────────────────────────────────────────────────────────

  render() {
    const host = document.getElementById(this._id);
    if (!host) throw new Error('FloriaTable: element #' + this._id + ' not found');
    host.classList.add('ftbl-root');

    var descHtml = this._description
      ? `<div class="ftbl-filter-desc" title="${_ftAttrEsc(this._description)}">${_ftEsc(this._description)}</div>`
      : '';

    var filterBar = (this._enableFilter || descHtml)
      ? `<div class="ftbl-filterbar">
           ${this._descriptionFirst ? descHtml : ''}
           ${this._enableFilter ? `<input id="${this._id}_FLT" class="ftbl-filter-input" type="text" placeholder="Filter…" value="${this._filterText}">` : ''}
           ${this._enableFilter ? `<span id="${this._id}_CNT" class="ftbl-filter-count"></span>` : ''}
           ${this._descriptionFirst ? '' : descHtml}
         </div>`
      : '';

    host.innerHTML = filterBar
      + `<div class="ftbl-body${this._wideTable ? ' ftbl-wide' : ''}" id="${this._id}_BODY">
           <table class="ftbl-table${(this._wideTable || this._hasNowrapCol) ? '' : ' ftbl-layout-fixed'}" id="${this._id}_TBL">
             <thead id="${this._id}_HEAD"></thead>
             <tbody id="${this._id}_BODY_TBL"></tbody>
             ${this._hasSummary ? `<tfoot id="${this._id}_FOOT"></tfoot>` : ''}
           </table>
         </div>`;

    this._renderHead();
    this._applyFilter(false); // initial render without re-filtering (no text yet)

    if (this._enableFilter) {
      var flt = document.getElementById(this._id + '_FLT');
      if (this._loading) flt.disabled = true;
      flt.addEventListener('input', (e) => {
        this._filterText = e.target.value;
        this._applyFilter(true);
      });
    }

    // Single delegated click handler for sorting on the thead
    document.getElementById(this._id + '_HEAD').addEventListener('click', (e) => {
      var th = e.target.closest('th[data-sortcol]');
      if (!th) return;
      var idx = parseInt(th.dataset.sortcol, 10);
      if (this._sortCol === idx) {
        this._sortDir *= -1;
      } else {
        this._sortCol = idx;
        this._sortDir = 1;
      }
      this._sortData();
      this._renderHead();
      this._renderRows();
    });

    // Single delegated click handler for onClickHandler columns on the tbody.
    // Two modes:
    //  - exactly one click column  → the whole <tr> is clickable (row-clickable mode)
    //  - two or more click columns → each retains its own per-cell "link" click target
    // Either way, the clicked row becomes the "selected" row (left accent border) until
    // another row is clicked — see this._selectedRow / _renderRows().
    if (this._singleClickColIdx != null) {
      document.getElementById(this._id + '_BODY_TBL').addEventListener('click', (e) => {
        var tr = e.target.closest('tr[data-ftbl-row]');
        if (!tr) return;
        var rowIdx = parseInt(tr.dataset.ftblRow, 10);
        var col = this._columns[this._singleClickColIdx];
        var rows = this._visible != null ? this._visible.map(i => this._data[i]) : this._data;
        var row  = rows[rowIdx];
        if (row == null) return;
        if (typeof col.clickable === 'function' && col.clickable(row) !== true) return;
        this._selectedRow = row;
        this._renderRows();
        col.onClickHandler(row);
      });
    } else if (this._hasClickCol) {
      document.getElementById(this._id + '_BODY_TBL').addEventListener('click', (e) => {
        var td = e.target.closest('td[data-ftbl-click]');
        if (!td) return;
        var tr = td.closest('tr[data-ftbl-row]');
        if (!tr) return;
        var colIdx = parseInt(td.dataset.ftblClick, 10);
        var rowIdx = parseInt(tr.dataset.ftblRow,  10);
        var col = this._columns[colIdx];
        if (typeof col.onClickHandler !== 'function') return;
        var rows = this._visible != null ? this._visible.map(i => this._data[i]) : this._data;
        var row  = rows[rowIdx];
        if (row == null) return;
        if (typeof col.clickable === 'function' && col.clickable(row) !== true) return;
        this._selectedRow = row;
        this._renderRows();
        col.onClickHandler(row);
      });
    }
  }

  /** Replace the data array and re-render rows. Clears loading state if this is the first data load. */
  setData(data) {
    this._loading  = false;
    this._data     = data || [];
    // Reset to preSorted state (or clear if none)
    this._sortCol  = null;
    this._sortDir  = 1;
    for (var _pi = 0; _pi < this._columns.length; ++_pi) {
      var _pc = this._columns[_pi];
      if (_pc.preSorted === 'asc' || _pc.preSorted === 'desc') {
        this._sortCol = _pi;
        this._sortDir = _pc.preSorted === 'asc' ? 1 : -1;
      }
    }
    this._visible  = null;
    if (this._enableFilter) {
      var flt = document.getElementById(this._id + '_FLT');
      if (flt) flt.disabled = false;
    }
    this._applyFilter(this._filterText.trim() !== '');
    this._renderHead();
  }

  // ── Private ────────────────────────────────────────────────────────────

  _renderHead() {
    var str = '<tr>';
    if (this._showRowNumbers)
      str += '<th class="ftbl-rownum-th" style="text-align:right; width:1px; white-space:nowrap;"></th>';
    for (var i = 0; i < this._columns.length; ++i) {
      var c = this._columns[i];
      // ── Gap / spacer column ──────────────────────────────────────────────
      if (c.gap) {
        str += `<th class="ftbl-gap"${c._widthStyle}></th>`;
        continue;
      }
      // ── Normal column ────────────────────────────────────────────────────
      var alignCls = ' ftbl-align-' + c._align;
      var wrapCls  = ' ftbl-wrap-' + c._wrap;
      if (c.sortable) {
        var sortCls = this._sortCol === i ? (this._sortDir === -1 ? ' ftbl-sort-desc' : ' ftbl-sort-asc') : '';
        var icon    = this._sortCol === i ? (this._sortDir === -1 ? '▼' : '▲') : '⇅';
        str += `<th class="ftbl-sortable${sortCls}${alignCls}${wrapCls}" data-sortcol="${i}"${c._widthStyle}>
                  <span class="ftbl-th-inner"><span class="ftbl-th-label">${_ftEsc(c.label)}</span><span class="ftbl-sort-icon">${icon}</span></span>
                </th>`;
      } else {
        str += `<th class="${alignCls}${wrapCls}"${c._widthStyle}><span class="ftbl-th-inner"><span class="ftbl-th-label">${_ftEsc(c.label)}</span></span></th>`;
      }
    }
    str += '</tr>';
    document.getElementById(this._id + '_HEAD').innerHTML = str;
  }

  _sortData() {
    if (this._sortCol == null) return;
    var col = this._columns[this._sortCol];
    if (col.gap) return; // should never happen (gap cols have no data-sortcol), but guard anyway
    var dir = this._sortDir;
    this._data.sort(function(a, b) {
      var av = _ftSortValue(a, col), bv = _ftSortValue(b, col);
      if (av < bv) return -dir;
      if (av > bv) return  dir;
      return 0;
    });
    // Reset visible indices to reflect new order after sort (filter re-applied below)
    this._visible = null;
  }

  _applyFilter(doFilter) {
    if (doFilter && this._filterText.trim() !== '') {
      var terms = this._filterText.trim().toLowerCase().split(/\s+/);
      var vis = [];
      for (var i = 0; i < this._data.length; ++i) {
        var row = this._data[i];
        var rowText = this._columns
          .filter(c => !c.gap)
          .map(c => String(row[c.field] == null ? '' : row[c.field]))
          .join(' ').toLowerCase();
        var match = terms.every(t => rowText.indexOf(t) !== -1);
        if (match) vis.push(i);
      }
      this._visible = vis;
    } else {
      this._visible = null;
    }
    this._renderRows();
    this._renderSummary();  // update totals to reflect the current visible set
    this._updateCount();
  }

  _renderRows() {
    var rows      = this._visible != null ? this._visible.map(i => this._data[i]) : this._data;
    var cols      = this._columns;
    var totalCols = cols.length + (this._showRowNumbers ? 1 : 0);
    if (this._loading) {
      document.getElementById(this._id + '_BODY_TBL').innerHTML =
        `<tr><td class="ftbl-loading" colspan="${totalCols}" style="text-align:center; padding:24px;">` +
        `<img src="/static/img/progress.gif" alt="Loading…"></td></tr>`;
      return;
    }
    if (rows.length === 0) {
      document.getElementById(this._id + '_BODY_TBL').innerHTML =
        `<tr><td class="ftbl-empty" colspan="${totalCols}">No matching records found.</td></tr>`;
      return;
    }
    var str = '';
    for (var i = 0; i < rows.length; ++i) {
      var row = rows[i];
      var rowClickable = false;
      if (this._singleClickColIdx != null) {
        var _sc = cols[this._singleClickColIdx];
        rowClickable = typeof _sc.clickable !== 'function' || _sc.clickable(row) === true;
      }
      var rowSelected = this._selectedRow != null && row === this._selectedRow;
      var trAttrs = this._hasClickCol ? ` data-ftbl-row="${i}"` : '';
      var trClsParts = [];
      if (rowClickable) trClsParts.push('ftbl-row-clickable');
      if (rowSelected)  trClsParts.push('ftbl-row-selected');
      var trCls = trClsParts.length ? ` class="${trClsParts.join(' ')}"` : '';
      str += `<tr${trCls}${trAttrs}>`;
      if (this._showRowNumbers)
        str += `<td class="ftbl-rownum" style="text-align:right; padding-right:6px; white-space:nowrap; width:1px; color:#9ca3af; font-size:0.85em;">${i + 1}</td>`;
      for (var j = 0; j < cols.length; ++j) {
        var c = cols[j];
        // ── Gap / spacer cell ──────────────────────────────────────────────
        if (c.gap) {
          str += `<td class="ftbl-gap"${c._widthStyle}></td>`;
          continue;
        }
        // ── Normal cell ────────────────────────────────────────────────────
        var cell    = c._renderer ? c._renderer(row) : _ftEsc(row[c.field] == null ? '' : row[c.field]);
        var content = cell === '' ? _FT_NA : cell;
        var tdCls   = 'ftbl-align-' + c._align + ' ftbl-wrap-' + c._wrap;
        var titleAttr = typeof c.title === 'function' ? ' title="' + _ftAttrEsc(c.title(row)) + '"' : '';
        var isClickable = typeof c.onClickHandler === 'function'
                       && (typeof c.clickable !== 'function' || c.clickable(row) === true);
        if (isClickable) {
          str += `<td class="${tdCls}" data-ftbl-click="${j}"${c._widthStyle}${titleAttr}><span class="ftbl-link">${content}</span></td>`;
        } else {
          str += `<td class="${tdCls}"${c._widthStyle}${titleAttr}>${content}</td>`;
        }
      }
      str += '</tr>';
    }
    document.getElementById(this._id + '_BODY_TBL').innerHTML = str;
  }

  /** Computes and renders the summary (totals) row in <tfoot>. No-op if no summary columns. */
  _renderSummary() {
    if (!this._hasSummary) return;
    var foot = document.getElementById(this._id + '_FOOT');
    if (!foot) return;

    // Don't show a summary while loading or when there are no rows
    var rows = this._visible != null ? this._visible.map(i => this._data[i]) : this._data;
    if (this._loading || rows.length === 0) { foot.innerHTML = ''; return; }

    // Sum each summary column across the visible rows
    var totals = {};
    var cols = this._columns;
    for (var j = 0; j < cols.length; ++j) {
      if (!cols[j].summary) continue;
      var sum = 0;
      for (var i = 0; i < rows.length; ++i) {
        var v = rows[i][cols[j].field];
        if (v != null) sum += parseFloat(v) || 0;
      }
      totals[cols[j].field] = sum;
    }

    // Build a synthetic "total row" object so we can reuse each column's renderer
    var totalRow = {};
    for (var j = 0; j < cols.length; ++j)
      if (cols[j].summary) totalRow[cols[j].field] = totals[cols[j].field];

    var str = '<tr>';
    // Row-number column: show the Σ symbol instead of a number
    if (this._showRowNumbers)
      str += `<td style="text-align:right; padding:4px 6px; white-space:nowrap; width:1px; color:#9ca3af; font-size:1rem; font-weight:600; background:var(--ftbl-header-bg,#f0f0f0); border-top:2px solid #bbb;">Σ</td>`;
    for (var j = 0; j < cols.length; ++j) {
      var c = cols[j];
      if (c.gap) { str += `<td class="ftbl-gap"${c._widthStyle}></td>`; continue; }
      var alignCls = 'ftbl-align-' + c._align;
      var wrapCls  = 'ftbl-wrap-' + c._wrap;
      if (c.summary) {
        var cell = c._renderer ? c._renderer(totalRow) : _ftEsc(String(totals[c.field]));
        var titleAttr = typeof c.title === 'function' ? ' title="' + _ftAttrEsc(c.title(totalRow)) + '"' : '';
        str += `<td class="${alignCls} ${wrapCls}"${c._widthStyle}${titleAttr}>${cell}</td>`;
      } else {
        str += `<td class="${alignCls}"${c._widthStyle}></td>`;
      }
    }
    str += '</tr>';
    foot.innerHTML = str;
  }

  _updateCount() {
    if (!this._enableFilter) return;
    var el = document.getElementById(this._id + '_CNT');
    if (!el) return;
    if (this._loading) { el.textContent = ''; return; }
    var shown = this._visible != null ? this._visible.length : this._data.length;
    el.textContent = shown + ' / ' + this._data.length + ' rows';
  }
}