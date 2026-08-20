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

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Radio buttons and check boxes and dropdowns and...
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import { FloriaDOM } from "./module-dom.js";
import { FloriaText } from "./module-text.js";

const DT_LOAD = window._STARTUP_DATE_MS || new Date().getTime();

// Consolidated with module-forms2.js (both self-inject the same stylesheet; injectCSSLink()
// is idempotent - a <link> for a given href is only ever added once - so standalone usage of
// these controls, without module-forms2.js ever being imported, still gets styled).
FloriaDOM.injectCSSLink("FLORIA_CSS_ANCHOR", true, new URL("./module-forms2.css?ts="+DT_LOAD, import.meta.url).href);

  
// NOTE on the Grid vs Legacy split below (Radio.gen/Checkbox.gen): tableEdgeFunc() no longer builds
// <TABLE>-based wrapping markup. It now returns a lightweight, tagged marker function - Radio.gen/
// Checkbox.gen detect the tag (_isFloriaTableEdgeFunc) and, when present (or when edgeFunc is simply
// null), render options into a responsive CSS Grid (see ".controlGrid" in module-forms2.css) instead of
// invoking the function at all. This keeps the Radio.gen/Checkbox.gen/TableEdgeFunc call signatures 100%
// unchanged (no caller anywhere - module-forms2.js or any other consuming app - needs to change), while
// still letting Radio.gen/Checkbox.gen fall back to the ORIGINAL callback-driven table-rendering loop
// (kept below, byte-for-byte capable) for any genuine hand-rolled edgeFunc that ISN'T a TableEdgeFunc
// result - e.g. module-forms2.js's matrix/"questions" mode, which deliberately keeps using a raw <TD>-
// per-cell callback of its own and is unaffected by this change.
function tableEdgeFunc(columnsCount, classNames)
 { 
    if (classNames == null)
     classNames = "";
    var effectiveColumnsCount = columnsCount == null ? 4 : columnsCount;
    var width=Math.floor(100/effectiveColumnsCount)+"%";
    var fn = function(i, before, count, tdExtras, doWrap)
     {
        if (doWrap == true)
         return effectiveColumnsCount - i%effectiveColumnsCount;
        if (tdExtras == null)
         tdExtras = "";
        if (i == null && before == null) // This is a forced break
         return '</TR>';

        if (before == true)
         return i == 0                    ? '<TABLE align="left" border="0px" cellpadding="0px" cellspacing="0px" width="98%" class="'+classNames+'"><TR><TD width="'+width+'" '+tdExtras+'>' 
              : i!=0 && i%effectiveColumnsCount==0 ? '<TR valign="top"><TD width="'+width+'" '+tdExtras+'>'
                                          : '<TD width="'+width+'" '+tdExtras+'>' ;
        else if (i == count-1)
          {
            var Str = '</TD>';
            while (i % effectiveColumnsCount != effectiveColumnsCount-1)
              {
                Str+='<TD width="'+width+'">&nbsp;</TD>';
                ++i;
              }
            return Str+'</TR></TABLE>\n';
          }
        else
         return i % effectiveColumnsCount == effectiveColumnsCount-1 ? '</TD></TR>' : '</TD>';
      };
    // Tag: read by Radio.gen/Checkbox.gen to opt into the new CSS Grid layout instead of calling fn().
    // columnsCount (untouched, possibly null) is preserved as-is so "=== 1" reliably means "force a
    // single stacked column"; any other value (including the default of 4 above) means "responsive,
    // content-sized auto-fit grid" - see ".controlGrid"/".controlGrid.singleColumn" in module-forms2.css.
    fn._isFloriaTableEdgeFunc = true;
    fn._floriaColumnsCount = columnsCount;
    fn._floriaClassNames = classNames;
    return fn;
};

function makeRelIds(elementId)
 {
   var isArray = Array.isArray(elementId); 
   var formId = isArray == false ? null : elementId[0];
   if (isArray == true)
    elementId = elementId[1];
   return {formId: formId, elementId: elementId, fullId: formId+'_'+elementId};
 }

// ".controlGrid" lays each field's options out in a responsive CSS Grid whose columns are sized to the
// content that actually lands in them - so a row can legitimately be "one wide column + two narrow ones"
// rather than three equally-wide ones. That combination (responsive count + per-column content sizing)
// can't be expressed in CSS alone, hence the JS pass below. The CSS-only fallback in module-forms2.css
// (repeat(auto-fit, minmax(...))) is what applies before/without this pass, and it necessarily produces
// EQUAL tracks: auto-fit needs one definite minimum to divide the available width by, and that single
// minimum has to accommodate the field's WIDEST label. That's needlessly pessimistic - e.g. two options
// measuring 260px and 180px in a 505px container "don't fit" as equal tracks (2 x 260 + 14 = 534) even
// though they trivially fit as content-sized ones (260 + 180 + 14 = 454). So this pass measures every
// option individually, picks the largest column count whose per-column content widths actually fit, and
// pins an explicit "repeat(N, max-content)" template.
//
// Note the options are (and must stay) "white-space:nowrap" - a radio/checkbox label is a single atomic
// choice and must never break across lines - so a label that genuinely can't share the width with a
// neighbour correctly drops the field to fewer columns rather than wrapping.
//
// CRITICAL - why this is a DEFERRED, post-insertion pass rather than computed inside Radio.gen/
// Checkbox.gen: the option styling is almost entirely font-relative ("width:1em" indicator, "gap:0.35em",
// plus the label text itself), and FloriaForms fields typically sit several levels deep inside nested
// tables/panels that inherit a SMALLER font-size than <body>. Measuring anywhere other than the option's
// true final position skews every result by a constant factor (empirically ~1.23x against <body>), which
// is silently enough to cost a column per field. And measuring at generation time is impossible anyway:
// module-forms2.js (like most callers) invokes gen() with ContainerId === null, i.e. it wants the markup
// returned as a STRING and inserts it later - so at gen() time the destination element, and therefore
// the real font context AND the available width, do not exist yet. Hence: emit the grid unsized, then
// measure it in place (rAF-debounced, plus a MutationObserver for later-inserted grids, plus a
// ResizeObserver per grid so container/zoom/visibility changes re-run it).
var _controlGridSizingPending = false;
var _controlGridObserver = null;
var _controlGridResizeObserver = null;
var _controlGridResizeHooked = false;
var _controlGridResizeTimer = null;

// Natural (max-content) width of every option in the grid, in DOM order, with nulls marking the
// full-row ".controlGridBreak" separators. Measured via a throwaway probe that is absolutely positioned
// INSIDE the grid itself, which (a) takes it out of grid flow so it can't disturb layout or create a
// phantom track, and (b) inherits the grid's exact font context. We can't just read the existing
// children's offsetWidth: they're grid items, so they've already been stretched to their track's width.
function measureControlGridItems(grid)
 {
   var items = [];
   var probe = document.createElement("DIV");
   probe.style.cssText = "position:absolute; visibility:hidden; pointer-events:none; top:-9999px; left:-9999px; width:auto; white-space:nowrap;";
   for (var i = 0; i < grid.children.length; ++i)
    {
      var c = grid.children[i];
      if (c.className != null && c.className.indexOf("controlGridBreak") != -1)
       {
         items.push(null);
         continue;
       }
      if (c.tagName != "A")
       continue;
      // Built via DOM APIs (not an HTML string) so arbitrary label text needs no escaping. Normalize to
      // the "_OFF" (normal-weight) variant so a currently-selected/greyed option doesn't skew the
      // measurement, and use textContent so the nested hidden <INPUT> (and its id) isn't cloned.
      var a = document.createElement("A");
      a.className = c.className.split("_")[0] + "_OFF";
      a.textContent = c.textContent;
      probe.appendChild(a);
      items.push({w: 0});
    }
   if (probe.children.length == 0)
    return items;
   grid.appendChild(probe);
   var n = 0;
   for (var i = 0; i < items.length; ++i)
    if (items[i] != null)
     items[i].w = probe.children[n++].offsetWidth;
   grid.removeChild(probe);
   return items;
 }

// Total width this option list would need laid out in exactly columnCount columns, given that grid
// auto-placement fills row-major and each track ends up as wide as the widest option that lands in it.
// A null entry (".controlGridBreak") spans the full row, so whatever follows restarts at column 0.
function controlGridWidthFor(items, columnCount, gapPx)
 {
   var cols = [];
   for (var i = 0; i < columnCount; ++i)
    cols.push(0);
   var col = 0;
   for (var i = 0; i < items.length; ++i)
    {
      if (items[i] == null)
       { col = 0; continue; }
      if (items[i].w > cols[col])
       cols[col] = items[i].w;
      col = (col + 1) % columnCount;
    }
   var total = gapPx * (columnCount - 1);
   for (var i = 0; i < cols.length; ++i)
    total += cols[i];
   return total;
 }

function sizeControlGrid(grid)
 {
   if (grid == null)
    return;
   if (grid.className.indexOf("singleColumn") != -1) // 1 column by definition - nothing to compute.
    {
      grid.setAttribute("data-floria-col-sized", "1");
      return;
    }
   var availPx = grid.clientWidth;
   if (availPx <= 0) // not laid out yet (hidden tab/panel, detached...): leave it for a later pass.
    return;
   // Re-measure only when the available width actually changed (the attribute doubles as both the
   // "already sized" marker and the width it was sized against).
   if (grid.getAttribute("data-floria-col-sized") == ""+availPx)
    return;

   var items = measureControlGridItems(grid);
   var optionCount = 0;
   for (var i = 0; i < items.length; ++i)
    if (items[i] != null)
     ++optionCount;
   if (optionCount == 0)
    {
      grid.setAttribute("data-floria-col-sized", ""+availPx);
      return;
    }

   var gapPx = parseFloat(getComputedStyle(grid).columnGap);
   if (isNaN(gapPx) == true)
    gapPx = 0;

   // Largest column count that genuinely fits, content-sized. Falls back to 1, which may overflow if a
   // single label is wider than the whole container - unavoidable without wrapping, and no worse than
   // any other choice at that point.
   var best = 1;
   for (var n = optionCount; n >= 2; --n)
    if (controlGridWidthFor(items, n, gapPx) <= availPx)
     { best = n; break; }

   // "max-content" tracks: each column is exactly as wide as its own widest option, independent of its
   // neighbours - which is the whole point of computing the count here rather than using auto-fit.
   grid.style.gridTemplateColumns = "repeat("+best+", max-content)";
   grid.setAttribute("data-floria-col-sized", ""+availPx);
 }

function sizeAllControlGrids()
 {
   if (typeof document === "undefined")
    return;
   var grids = document.querySelectorAll(".controlGrid");
   for (var i = 0; i < grids.length; ++i)
    {
      sizeControlGrid(grids[i]);
      // Per-grid width watching covers everything a global resize listener can't see on its own:
      // becoming visible (tab/panel switch), an ancestor changing width, zoom, etc.
      if (_controlGridResizeObserver != null)
       _controlGridResizeObserver.observe(grids[i]);
    }
 }

// The chosen column count is derived from measured px, so it goes stale whenever the rendered size of an
// option changes - notably on browser zoom, which shifts the CSS-pixel viewport and can cross the host
// app's media-query breakpoints and restyle font-size/padding. Nothing in CSS can re-run a JS
// measurement, so drop the markers and re-measure everything.
function resizeAllControlGrids()
 {
   if (typeof document === "undefined")
    return;
   var grids = document.querySelectorAll(".controlGrid[data-floria-col-sized]");
   for (var i = 0; i < grids.length; ++i)
    grids[i].removeAttribute("data-floria-col-sized");
   sizeAllControlGrids();
 }

function scheduleControlGridSizing()
 {
   if (typeof document === "undefined" || _controlGridSizingPending == true)
    return;
   _controlGridSizingPending = true;
   var run = function()
    {
      _controlGridSizingPending = false;
      sizeAllControlGrids();
    };
   if (typeof requestAnimationFrame !== "undefined")
    requestAnimationFrame(run);
   else
    setTimeout(run, 0);

   if (_controlGridResizeObserver == null && typeof ResizeObserver !== "undefined")
    _controlGridResizeObserver = new ResizeObserver(function(entries)
     {
       // sizeControlGrid() no-ops unless the width really changed, so this can't feed back on itself
       // (setting grid-template-columns doesn't alter the grid's own outer width - it's a block box).
       for (var i = 0; i < entries.length; ++i)
        sizeControlGrid(entries[i].target);
     });

   // Callers that build markup as a string may insert it well after this frame (and repeatedly, e.g.
   // paging/tab switching in FloriaForms), so watch for any later-inserted grids too. Cheap: the
   // observer only ever schedules the same rAF-debounced pass, which no-ops when nothing is unsized.
   if (_controlGridObserver == null && typeof MutationObserver !== "undefined" && document.body != null)
    {
      _controlGridObserver = new MutationObserver(function()
       {
         if (document.querySelector(".controlGrid:not([data-floria-col-sized])") != null)
          scheduleControlGridSizing();
       });
      _controlGridObserver.observe(document.body, {childList: true, subtree: true});
    }
   if (_controlGridResizeHooked == false && typeof window !== "undefined")
    {
      _controlGridResizeHooked = true;
      window.addEventListener("resize", function()
       {
         if (_controlGridResizeTimer != null)
          clearTimeout(_controlGridResizeTimer);
         _controlGridResizeTimer = setTimeout(function()
          {
            _controlGridResizeTimer = null;
            resizeAllControlGrids();
          }, 150);
       });
    }
 }

var Radio = {
  header : function(Values, Before, After)
    {
      var Str = '';
      for (var i = 0; i < Values.length; ++i)
        Str += Before + Values[i][1] + After + '\n';
      return Str;
    },
  gen : function(ContainerId, elementId, Values, edgeFunc, onChange, Default, Mode, noLabels, readOnly)
    {
      // A genuine custom callback (not one produced by FloriaControls.TableEdgeFunc()) is rendered via
      // the original callback-driven loop below, unchanged - this is what module-forms2.js's matrix/
      // "questions" mode relies on. Everything else (edgeFunc null, or a TableEdgeFunc(...) result) uses
      // the new ".controlGrid" CSS Grid layout instead.
      var isLegacyEdgeFunc = edgeFunc != null && edgeFunc._isFloriaTableEdgeFunc != true;
      if (Default != null && Default.indexOfSE != null)
        Default = Default.length == 0 ? null : Default[0];
      var Ids = makeRelIds(elementId);
      var Str = '<INPUT id="'+Ids.fullId+'" name="' + Ids.elementId + '"'
      if (Default != null)
        Str += ' value="' + Default + '"';
      Str += ' type="hidden">';
      if (readOnly != true)
       {
         if (isLegacyEdgeFunc == true)
          {
            var totalValidElements = 0;
            for (var i = 0; i < Values.length; ++i)
             if (Values[i] != null)
              ++totalValidElements;
            var counter = 0;
            var cells = 0;
            for (var i = 0; i < Values.length; ++i)
             {
               var v = Values[i];
               if (v != null)
                {
                  var fullId = Ids.fullId+'_'+counter;
                  Str += edgeFunc(cells, true, totalValidElements) 
                      + '<A id="RADIO_'+fullId+'" class="Radio_' + (Default == v[0] ? 'ON' : 'OFF')
                      + '" title="' + (v.length > 2 && v[2]!=null?v[2]:v[1]) 
                      + '" href="javascript:Radio.click([\'' + Ids.formId + '\',\'' + Ids.elementId + '\'], \'' + v[0] + '\', \'RADIO_' + fullId
                      + '\', ' + onChange + ',' + Mode + ');' + '">' + (noLabels == true ? '&nbsp;' : v[1]) + '</A>' 
                      + edgeFunc(cells, false, totalValidElements) + '\n';
                  ++counter;
                  ++cells;
                }
               else
                {
                  Str+=edgeFunc(null, null, totalValidElements);
                  var x = edgeFunc(cells, null, totalValidElements, null, true); // advance to first cell of next row.
                  totalValidElements+=x;
                  cells += x;
                }
             }
          }
         else
          {
            // New CSS Grid layout: ONE shared ".controlGrid" for the whole Values list, so every row
            // shares the same column tracks (proper column-wise alignment) even across forced breaks -
            // a null entry no longer starts an independent grid (which would size its columns on its own
            // and misalign against neighboring rows); it instead inserts a full-row-spanning
            // ".controlGridBreak" marker (see module-forms2.css) that simply pushes subsequent options to
            // a fresh row within the SAME grid. columnsCount === 1 forces a single stacked column; any
            // other value (or none) lets the grid auto-fit as many content-sized columns as fit within
            // ".controlGrid"'s (capped) width.
            var singleColumn = edgeFunc != null && edgeFunc._floriaColumnsCount == 1;
            var gridClassNames = edgeFunc != null && edgeFunc._floriaClassNames ? ' '+edgeFunc._floriaClassNames : '';
            var counter = 0;
            Str += '<DIV class="controlGrid'+(singleColumn==true?' singleColumn':'')+gridClassNames+'">\n';
            for (var i = 0; i < Values.length; ++i)
             {
               var v = Values[i];
               if (v == null)
                {
                  Str += '<DIV class="controlGridBreak"></DIV>\n';
                  continue;
                }
               var fullId = Ids.fullId+'_'+counter;
               Str += '<A id="RADIO_'+fullId+'" class="Radio_' + (Default == v[0] ? 'ON' : 'OFF')
                   + '" title="' + (v.length > 2 && v[2]!=null?v[2]:v[1]) 
                   + '" href="javascript:Radio.click([\'' + Ids.formId + '\',\'' + Ids.elementId + '\'], \'' + v[0] + '\', \'RADIO_' + fullId
                   + '\', ' + onChange + ',' + Mode + ');' + '">' + (noLabels == true ? '&nbsp;' : v[1]) + '</A>\n';
               ++counter;
             }
            Str += '</DIV>\n';
          }
       }
      else 
        for (var i = 0; i < Values.length; ++i)
          {
            var v = Values[i];
            if (Default != v[0])
              continue;
            var fullId = Ids.fullId+'_'+i;
            Str += '<B>'+v[1]+'<B>';
          }
      // Kicks off the deferred, in-place column sizing (see sizeControlGrid()) - covers both the
      // "insert it here" path below and the "return a string, caller inserts later" path.
      scheduleControlGridSizing();
      if (ContainerId == null)
        return Str;
      FloriaDOM.setInnerHTML(ContainerId, Str);
    },
  click : function(elementId, Value, TriggerId, onChange, Mode)
    {
      var Ids = makeRelIds(elementId);
      var e = document.getElementById(Ids.fullId);
      if (e == null)
        return;
      if (e.value == Value && Mode == null)
       {
         e.value = '';
         var t = document.getElementById(TriggerId);
         t.className = t.className.split("_")[0] + "_OFF";
       }
      else
       {
         e.value = Value;
         var t = document.getElementById(TriggerId);
         var ClassName = t.className.split("_")[0];
         t.className = ClassName + "_ON";
         ClassName = ClassName + "_OFF";
         for (var i = 0; i < 100; ++i)
          {
            var r = document.getElementById("RADIO_" + Ids.fullId + "_" + i);
            if (r == null)
             break;
            if (r.className == t.className && r != t)
             {
               r.className = ClassName;
               break;
             }
          }
       }
      if (onChange != null)
       onChange(Ids.fullId, e.value);
      else if (e.form != null)
        FloriaDOM.fireEvent(e.form, "change");         
    },
  get : function(elementId)
    {
      var Ids = makeRelIds(elementId);
      var e = document.getElementById(Ids.fullId);
      return e == null || FloriaText.TextUtil.isNullOrEmpty(e.value) ? null : e.value;
    }
};

var Dropdown = {
  gen : function(ContainerId, elementId, Values, firstEmpty, onChange, Default, Multiple, size)
    {
      var Ids = makeRelIds(elementId);
      var Str = '<SELECT id="'+Ids.fullId+'" name="' + Ids.elementId + '"';
      if (onChange != null)
        Str += ' onChange="' + onChange + '"';
      if (Multiple == true)
       {
         Str += ' multiple';
         if (size == null)
          size = Values.length >= 10 ? 10 : Values.length;
         else if (size > Values.length)
          size = Values.length;
         Str+= ' size="'+size+'"';
       }
      Str += '>';
      if (firstEmpty == true)
        Str += '<OPTION value=""></OPTION>';
      for (var i = 0; i < Values.length; ++i)
       {
         var v = Values[i];
         Str += '<OPTION ' + (Default == v[0] ? 'selected' : '') + ' value="' + v[0] + '">' + v[1] + '</OPTION>';
       }
      Str += '</SELECT>';
      if (ContainerId == null)
        return Str;
      FloriaDOM.setInnerHTML(ContainerId, Str);
    },
  get : function(elementId)
    {
      var Ids = makeRelIds(elementId);
      var e = document.getElementById(Ids.fullId);
      if (e.multiple == true)
        {
        var a = [];
        for (var i = 0; i < e.options.length; ++i)
         if (e.options[i].selected==true)
          a.push(e.options[i].value);
        return a;
        }
       else
        return e.selectedIndex == -1 ? null : e.options[e.selectedIndex].value;
    },
  set : function(elementId, Value)
    {
      var Ids = makeRelIds(elementId);
      var e = FloriaDOM.getElement(Ids.fullId, "Cannot find element "+Ids.fullId+".");
      var o = e.options;
      for (var i = 0; i < o.length; ++i)
        if (o[i].value == Value || o[i].label == Value || o[i].text == Value)
        {
          e.selectedIndex = i;
          return;
        }
    }
};

var Checkbox = {
  header : Radio.header,
  gen : function(ContainerId, elementId, Values, edgeFunc, onChange, Defaults, noLabels)
    {
      // See Radio.gen's comment: legacy callback-driven rendering only kicks in for a genuine custom
      // edgeFunc (not produced by FloriaControls.TableEdgeFunc()). Nothing in this codebase currently
      // calls Checkbox.gen that way, but the fallback is kept for parity/safety.
      var isLegacyEdgeFunc = edgeFunc != null && edgeFunc._isFloriaTableEdgeFunc != true;

      if (Defaults != null && Defaults.indexOfSE == null)
        Defaults = [ Defaults ];
      
      var Ids = makeRelIds(elementId);
      var Str = '';

      var noneItem = null;
      for (var i = 0; i < Values.length; ++i)
        {
          var v = Values[i];
          if (v != null && v[3] == "1")
           {
             noneItem = i;
             break;
           }
        }

      if (isLegacyEdgeFunc == true)
       {
         var totalValidElements = 0;
         for (var i = 0; i < Values.length; ++i)
          if (Values[i] != null)
            ++totalValidElements;
         var counter = 0;
         var cells = 0;
         for (var i = 0; i < Values.length; ++i)
          {
            var v = Values[i];
            if (v != null)
             {
   //            console.log("cells-within: "+cells);
               var match = Defaults != null && Defaults.indexOfSE(v[0]) != -1;
               var fullId = Ids.fullId + '_' + counter;
               Str += edgeFunc(cells, true, totalValidElements) 
                   + '<A href="javascript:Checkbox.click([\'' + Ids.formId + '\',\'' + Ids.elementId+'_'+counter+ '\'], ' 
                   + onChange + ',' + noneItem +');' + '" id="CHECKBOX_'
                   + fullId + '" class="Checkbox_' + (match ? 'ON' : 'OFF') + '" title="' + (v.length > 2 && v[2]!=null?v[2]:v[1]) + '"><INPUT id="' + fullId
                   + '" name="' + Ids.elementId + v[0] + '" type="hidden" value="' + (match ? '1' : '0') + '">' + (noLabels == true ? '' : v[1])
                   + '</A>'
                   + edgeFunc(cells, false, totalValidElements) + '\n';
               ++counter;
               ++cells;
             }
            else
             {
               Str+=edgeFunc(null, null, totalValidElements);
               var x = edgeFunc(cells, null, totalValidElements, null, true); // advance to first cell of next row.
               totalValidElements+=x;
               cells += x;
             }
          }
       }
      else
       {
         // New CSS Grid layout - see Radio.gen's equivalent block for the shared-grid/row-break rationale.
         var singleColumn = edgeFunc != null && edgeFunc._floriaColumnsCount == 1;
         var gridClassNames = edgeFunc != null && edgeFunc._floriaClassNames ? ' '+edgeFunc._floriaClassNames : '';
         var counter = 0;
         Str += '<DIV class="controlGrid'+(singleColumn==true?' singleColumn':'')+gridClassNames+'">\n';
         for (var i = 0; i < Values.length; ++i)
          {
            var v = Values[i];
            if (v == null)
             {
               Str += '<DIV class="controlGridBreak"></DIV>\n';
               continue;
             }
            var match = Defaults != null && Defaults.indexOfSE(v[0]) != -1;
            var fullId = Ids.fullId + '_' + counter;
            Str += '<A href="javascript:Checkbox.click([\'' + Ids.formId + '\',\'' + Ids.elementId+'_'+counter+ '\'], ' 
                + onChange + ',' + noneItem +');' + '" id="CHECKBOX_'
                + fullId + '" class="Checkbox_' + (match ? 'ON' : 'OFF') + '" title="' + (v.length > 2 && v[2]!=null?v[2]:v[1]) + '"><INPUT id="' + fullId
                + '" name="' + Ids.elementId + v[0] + '" type="hidden" value="' + (match ? '1' : '0') + '">' + (noLabels == true ? '' : v[1])
                + '</A>\n';
            ++counter;
          }
         Str += '</DIV>\n';
       }
      // See Radio.gen - deferred, in-place column sizing.
      scheduleControlGridSizing();
      if (ContainerId == null)
        return Str;
      FloriaDOM.setInnerHTML(ContainerId, Str);
    },
  flipNotNoneItems: function(fullId, grey)
   {
     var under = fullId.lastIndexOf("_");
     if (under != -1)
       {
         var rootElementId = fullId.substring(0, under);
         for (var i = 0; i < 50; ++i)
           {
             var id = rootElementId + "_" + i;
             if (id == fullId)
              continue;
             var r = FloriaDOM.getElement(id);
             if (r == null)
              break;
             r.parentNode.className = r.parentNode.className.split("_")[0] + (grey==true ? "_GREY" : "_OFF");
             r.value = 0;
           }
       }
   },
  click : function(elementId, onChange, noneItem)
    {
      var Ids = makeRelIds(elementId);
      var e = FloriaDOM.getElement(Ids.fullId);
      if (e == null)
        return;
      if (e.parentNode.className.endsWith("_GREY") == true)
       return;
      var i = Ids.fullId.lastIndexOf("_");
      if (i != -1)
       i = +Ids.fullId.substring(i+1);

      if (e.value != 0)
       {
         var c = e.parentNode.className;
         if (c.endsWith("_ON") == false)
          return;
         e.parentNode.className = c.split("_")[0] + "_OFF";
         e.value = 0;
         if (i == noneItem)
           Checkbox.flipNotNoneItems(Ids.fullId, false);
         var under = Ids.fullId.lastIndexOf("_");
         if (under != -1)
           {
             var rootElementId = Ids.fullId.substring(0, under);
             var activeCount = 0;
             for (var i = 0; i < 100; ++i)
               {
                 // we are iterating till we find nothing, so if we called FloriaDOM
                 // we'd get a warning in the logs which would be OK in this case. So
                 // let's go plain vanilla here.
                 var r = document.getElementById(rootElementId + "_" + i);
                 if (r == null)
                  break;
                 if (r.value == 1)
                  ++activeCount;
               }
             if (activeCount == 0)
               {
                 // Same argument here as per above... Plain Vanilla since mostly always expected.
                 var r = document.getElementById(rootElementId + "_" + noneItem);
                 if (r != null)
                   {
                     r.parentNode.className = r.parentNode.className.split("_")[0] + "_OFF";
                     r.value=0;
                   }
               }
           }
       }
      else
       {
         var c = e.parentNode.className;
         if (c.endsWith("_OFF") == false)
          return;
         e.parentNode.className = c.split("_")[0] + "_ON";
         e.value = 1;
         if (i == noneItem)
          Checkbox.flipNotNoneItems(Ids.fullId, true);
         else // this is not a noneItem, so we have to grey out the noneItem
           {
             var r = Ids.fullId.lastIndexOf("_");
             if (r != -1)
              {
                r = Ids.fullId.substring(0, r);
                // most expected, so plain vanilla here and no FloriaDOM.getElement as per above.
                r = document.getElementById(r + "_" + noneItem);
                if (r != null)
                  {
                    r.parentNode.className = r.parentNode.className.split("_")[0] + "_GREY";
                    r.value = 0;
                  }
              } 
           }
       }
      if (onChange != null)
       onChange(Ids.fullId, e.value);
      else if (e.form != null)
       FloriaDOM.fireEvent(e.form, "change");         
      
    },
  get : function(elementId)
    {
      var Ids = makeRelIds(elementId);
      var vals = [];
      for (var i = 0; i < 100; ++i)
      {
        var r = document.getElementById(Ids.fullId + "_" + i);
        if (r == null)
          break;
        if (r.value != 0)
         vals.push(r.name.substring(Ids.elementId.length));
      }
      return vals;
    }
};

var GeneralControl = {
    get : function(elementId, optional)
     {
       var Ids = makeRelIds(elementId);
       var e = document.getElementById(Ids.fullId);
       if (e == null)
        e = document.getElementById(Ids.fullId+"_0");
       if (e != null)
        {
          if (e.tagName == "INPUT" && e.type == "hidden")
           {
             if (e.id == Ids.fullId)
              {
                var v = Radio.get([Ids.formId, Ids.elementId]);
                return FloriaText.TextUtil.isNullOrEmpty(v) == true ? [] : [v];
              }
             return Checkbox.get([Ids.formId, Ids.elementId])
           }
          else if (e.tagName == "INPUT" && (e.type=="text" || e.type=="number") || e.tagName == "TEXTAREA")
           {
             return [e.value];
           }
          else if (e.tagName == "SELECT")
           {
             var res = Dropdown.get([Ids.formId, Ids.elementId]);
             return e.multiple == false ? [res]:res;
           }
        }

       if (optional != true)
         FloriaDOM.consoleThrow("Cannot find Control element "+Ids.fullId);

       return [];
     },
    makeUrlParams: function(paramDefs)
     {
       var error = false;
       var urlParams = "";
       for (var i = 0; i < paramDefs.length; ++i)
        {
          var p = paramDefs[i];
          var val = GeneralControl.get(p.id);
          if (p.mandatory == true && (val == null || val.length == 0 || FloriaText.TextUtil.isNullOrEmpty(val[0]) == true))
           {
             var Ids = makeRelIds(p.id);
             var e = FloriaDOM.getElement(Ids.fullId);
             if (e == null)
              {
                e = FloriaDOM.getElement(Ids.fullId+"_0");
                if (e != null)
                 e = e.parentNode;
              }
             FloriaDOM.addCSSToParent(e, "ErrorMessage");
             error = true;
           }
          if (val != null)
           for (var j = 0; j < val.length; ++j)
          urlParams+="&"+p.name+"="+escape(val[j]);
        }
       return error == true ? null : urlParams;
     }
};

var Rating = {
  gen : function(ContainerId, ElementId, label, maxValue, onChange, Default)
    {
      var Str = '<INPUT id="' + ElementId + '" name="' + ElementId + '"'
      if (Default != null)
        Str += ' value="' + Default + '"';
      Str += ' type="hidden"><SPAN id="' + ElementId + '_STARS" class="RatingStars">';
  
      for (var i = 1; i <= maxValue; ++i)
      {
        var match = Default != null && i <= Default;
        Str += '<A href="javascript:Rating.click(\'' + ElementId + '\', ' + i + ', ' + maxValue + ', ' + onChange + ', \'' + onChange
            + '\');' + '"><IMG src="/static/img/star' + (match == true ? "On" : "Off") + '.gif"></A>\n';
      }
      Str += '</SPAN><SPAN class="RatingLabel">' + label + '</SPAN>';
      if (ContainerId == null)
        return Str;
      FloriaDOM.setInnerHTML(ContainerId, Str);
    },
  click : function(ElementId, v, maxValue, onChange, onChangeStr)
    {
      var e = document.getElementById(ElementId);
      if (e == null)
        return;
      e.value = v;
      var Str = "";
      for (var i = 1; i <= maxValue; ++i)
      {
        var match = i <= v;
        Str += '<A href="javascript:Rating.click(\'' + ElementId + '\', ' + i + ', ' + maxValue + ', ' + onChange + ');'
            + '"><IMG src="/static/img/star' + (match == true ? "On" : "Off") + '.gif"></A>\n';
      }
      FloriaDOM.setInnerHTML(ElementId + '_STARS', Str);
      if (onChange != null)
        onChange(ElementId);
    },
  get : function(ElementId)
    {
      var e = document.getElementById(ElementId);
      return e == null ? null : e.value;
    }
};

var Ranking = {
  gen : function(ContainerId, ElementId, Values, onChange, Defaults)
  {
    if (Defaults != null && typeof Defaults == "string")
     Defaults = Defaults.split(",");
    if (Defaults != null && typeof Defaults == "Array" && Defaults.length > 0)
      {
        for (var i = 0; i < Defaults.length; ++i)
           if (Values.getSE(Defaults[i], 0) == null)
            {
              Defaults = null;
              break;
            }
      }
    else
     Defaults = null;

    if (Defaults == null)
     {
       Defaults = [];
       for (var i = 0; i < Values.length; ++i)
        Defaults.push(Values[i][0]);
     }

    var Str = '<INPUT id="' + ElementId + '" name="' + ElementId + '" value="' + Defaults + '" type="hidden">'
             +'<SPAN id="' + ElementId + '_RANKING" class="Ranking">';
    for (var i = 0; i < Defaults.length; ++i)
    {
      var v = Values.getSE(Defaults[i], 0, "Cannot locate option XXX");
      var Prev = '<A href="javascript:Checkbox.click(\'' + ElementId + '\', '+i+', -1, ' + onChange + ');' + '"><IMG class="left" src="/static/img/arrow-left.gif"></A>';
      var Next = '<A href="javascript:Checkbox.click(\'' + ElementId + '\', '+i+',  1, ' + onChange + ');' + '"><IMG class="right" src="/static/img/arrow-right.gif"></A>';
      Str += (i==0?'':Prev) + '<SPAN id="'+ElementId+'_'+v[0]+'">'+v[1]+'</SPAN>' + (i==Values.length-1?'':Next) + '\n';
    }
    Str+='</SPAN>';
    if (ContainerId == null)
      return Str;
    FloriaDOM.setInnerHTML(ContainerId, Str);
  },
  click : function(ElementId, i, direction, onChange)
  {
    var e = document.getElementById(ElementId);
    //childNode[4].parentNode.insertBefore(childNode[4], childNode[3]);
    if (e == null)
      return;
    if (e.value != 0)
    {
      e.parentNode.className = e.parentNode.className.split("_")[0] + "_OFF";
      e.value = 0;
    }
    else
    {
      e.parentNode.className = e.parentNode.className.split("_")[0] + "_ON";
      e.value = 1;
    }
    if (onChange != null)
      onChange(ElementId);
  },
  get : function(ElementId)
  {
    var vals = [];
    for (var i = 0; i < 20; ++i)
    {
      var r = document.getElementById(ElementId + "_" + i);
      if (r == null)
        break;
      if (r.value != 0)
       vals.push(r.name.substring(ElementId.length));
    }
    return vals;
  }
};





function ComboBox(divId, elementId, values, placeholder, defaultValue, onChangeFunc, selectOnly=false)
 {
   let options = '';
   let defaultValueStr = null;
   if (defaultValue != null)
    defaultValue = defaultValue.toLowerCase();

   for (let i = 0; i < values.length; ++i)
    {
      let v = values[i];
      if (defaultValue == (""+v[0]).toLowerCase())
       defaultValueStr = selectOnly==true ? (v[1]||v[0]) : v.length>=2 ? v[1] : v[0];
      let title = v.length>=3 && v[2]!=null ? ' title="\n'+FloriaText.TextUtil.printHtmlAttrValue(v[2])+'"' : '';
      options+='  <LI data-value="'+v[0]+'" '+title+'>'+(v[1]||v[0])+'</LI>\n';
    }
      
   let Ids = makeRelIds(elementId);
   let str = '<SPAN class="floriaCombo">'
               +'<INPUT id="'+Ids.fullId+'" name="'+Ids.elementId+'" type="hidden" '+(defaultValue == null ? '' : ' value="'+FloriaText.TextUtil.printHtmlAttrValue(defaultValue)+'"')+'>\n'
               +(selectOnly==true?
                     '<SPAN contenteditable="'+(!selectOnly)+'" id="'+Ids.fullId+'_INPUT" onchange="event.stopPropagation(); return false;">'
                         +(defaultValueStr == null ? '' : defaultValueStr)
                    +'</SPAN>\n'
                   : 
                     '<INPUT id="'+Ids.fullId+'_INPUT" type="text" onchange="event.stopPropagation(); return false;"'
                         +'placeholder="'+(placeholder||'')+'"'
                         +(defaultValueStr == null ? '' : ' value="'+FloriaText.TextUtil.printHtmlAttrValue(defaultValueStr)+'"')
                    +'>\n'
                 )
               +'<UL id="'+Ids.fullId+'_OPTIONS" style="display:none;">\n'
               +options
               +'</UL></SPAN>\n'
            ;
   
   {
     let hostEl = document.getElementById(divId);
     // Defense-in-depth: the host container can legitimately be gone by the time a caller builds/rebuilds a
     // combo into it (e.g. a dialog/panel torn down while an async load that repaints it was still in
     // flight -- see FloriaPayments.PlansDialog.UsageDashboard._paintFilterCombos's callers). Every other
     // control in this file already no-ops on a missing container; ComboBox previously did not, and would
     // throw here instead.
     if (hostEl == null)
      return;
     hostEl.innerHTML = str;
   }
   let valueElement = document.getElementById(Ids.fullId);
   let inputElement = document.getElementById(Ids.fullId+'_INPUT');
   let optionsDiv = document.getElementById(Ids.fullId+'_OPTIONS');

   let repaint = function()
    {
      valueElement.value = "";
      let val = (selectOnly==true ? inputElement.innerHTML : inputElement.value).trim().toLowerCase();
      val = new RegExp(".*"+FloriaText.TextUtil.escapeRegExpChars(val).replaceAll(/\s+/g, ".*")+".*");
      for (let i = 0; i < optionsDiv.children.length; ++i)
       {
         let li = optionsDiv.children[i];
         li.style.display= li.innerText.toLowerCase().search(val) >= 0 ? "" : "none";
       }
    };

   FloriaDOM.addEvent(inputElement, 'keyup', function() {
       repaint();
    }, 100, true);

   FloriaDOM.addEvent(inputElement, selectOnly==true?'click':'focus', function(e, event, target) {
//       let pos = FloriaDOM.getPos(inputElement);
//       console.log("pos: ", pos, "; inputElement.clientHeight: ", inputElement.clientHeight, "; inputElement.clientWidth: ", inputElement.clientWidth, ";");
//       optionsDiv.style.left = "5px"; // pos.left+"px";
//       optionsDiv.style.top  = "0px"; //(pos.top+inputElement.clientHeight)+"px";
       optionsDiv.style.width =  (inputElement.clientWidth-10)+"px";
       optionsDiv.style.display="";
    }, null, true);

   FloriaDOM.addEvent(inputElement, 'blur', function() {
       optionsDiv.style.display="none";
    }, 200, true);

   FloriaDOM.addEvent(optionsDiv, 'click', function(e, event, target) {
       optionsDiv.style.display="none";
       let val = target.dataset.value;
       if (val == null)
        return;
       valueElement.value = val;
       if (selectOnly == true)
        inputElement.innerHTML = target.innerHTML;
       else
        inputElement.value = target.innerText;
       if (onChangeFunc != null)
        {
//          console.log("COMBO --> call onChangeFunc")
          onChangeFunc(valueElement, val);
        }
       else
        {
//          console.log("COMBO --> call change on form if exists")
          let f = inputElement.closest("form");
          if (f != null)
           {
//             console.log("COMBO --> calling change on form")
             FloriaDOM.fireEvent(f, "change");
           }
          else
           {
//             console.log("COMBO --> could not find nearest form, so no onchange called!!")
           }
        }
    }, null, true);
    
    this.getValue = function()
     {
       return valueElement.value;
     }
    this.setValue = function(val)
     {
       if (val == null || val == valueElement.value)
        return;
       for (let i = 0; i < optionsDiv.children.length; ++i)
        {
          let o = optionsDiv.children[i];
          if (o.dataset.value == val)
           return FloriaDOM.fireEvent(o, 'click');
        }
     }
 }





window.Radio = Radio;
window.Dropdown = Dropdown;
window.Checkbox = Checkbox;
window.Rating = Rating;

export var FloriaControls = { "Radio": Radio
                            , "Dropdown": Dropdown
                            , "ComboBox": ComboBox
                            , "Checkbox": Checkbox
                            , "GeneralControl": GeneralControl
                            , "Rating": Rating
                            , "Ranking": Ranking
                            , "TableEdgeFunc": tableEdgeFunc
                            // Exposed for hosts that move/reparent already-rendered controls into a
                            // different font context, or otherwise need to force a re-measure.
                            // SizeControlGrids() only touches grids not yet sized; ResizeControlGrids()
                            // forcibly re-measures every grid (what the internal resize handler calls).
                            , "SizeControlGrids": sizeAllControlGrids
                            , "ResizeControlGrids": resizeAllControlGrids
                            };
