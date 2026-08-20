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

import { FloriaDOM } from "./module-dom.js";
import { FloriaTooltipDialog } from "./module-dialog.js";

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Floria Help
//
// Generic, app-agnostic contextual-help capability: highlights currently-visible DOM elements that have
// registered tooltips, and offers a small "help" action-marker icon that can be attached either to an
// arbitrary action bar (via init()) or automatically to every FloriaDialog title (via the optional
// window.FloriaHelp hook consumed by module-dialog.js).
//
// This module is intentionally independent from any "tour"/learning-pathway concept: the help definition
// is a plain array of items, typically supplied by a JS module (so tooltips can use backtick template
// literals for expressive, multi-line HTML), rather than a JSON file:
//   [ { "elementId": "<DOM element id>", "tooltip": `<HTML tooltip>` }, ... ]
// Each item is addressed directly by its elementId (falling back to a generic ".floriaHelpItem-{id}"
// class convention if elementId is omitted but the item carries its own "id").
//
// Positioning strategy: the highlight "ring" is applied as an inline CSS outline directly on the target
// element itself, so it is always pixel-perfect regardless of window resizes or scrolling (it's part of
// the element's own box, not a separately-positioned DOM node). Only the small numbered "badge" (which
// needs its own hoverable/clickable DOM node, independent stacking, and a tooltip trigger) is a separately
// tracked overlay; while help mode is active, a requestAnimationFrame loop keeps every badge's position in
// sync with its target, and hides the ring+badge whenever the target scrolls out of the visible area of
// any of its scrollable ancestors (or off the viewport entirely).
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export var FloriaHelp = {};

// Default (English) strings. Consuming apps can override via FloriaHelp.setStrings().
let helpStrings = {
  tooltips: {
    toggleHelp: "   Toggle contextual help",
    stepByStep: "   Step-by-step help"
  },
  errors: {
    noVisibleElements: "There are no visible elements with help at this time."
  }
};

FloriaHelp.setStrings = function(strings)
 {
   if (strings != null)
    helpStrings = strings;
 };

let helpItems = null;     // Array of help items: [ {id, elementId, tooltip}, ... ]
let testElementId = null; // Optional override, mirrors testing hooks used elsewhere in Floria (e.g. "FLORIA_HELP_TESTING")

FloriaHelp.getHelpItems = function() {
  return helpItems;
};

// Registers the help items array (accepts either a plain array, or an object carrying a "helpItems" array,
// for a little extra flexibility) and, optionally, wires an action-marker icon into the element identified
// by actionElementId (prepended to its existing contents).
FloriaHelp.init = function(helpItemsOrDef, actionElementId, tooltipLabel, _testElementId)
 {
   testElementId = _testElementId;
   helpItems = Array.isArray(helpItemsOrDef) ? helpItemsOrDef : helpItemsOrDef?.helpItems;
   if (helpItems == null || helpItems.length == 0)
    return console.error("FloriaHelp.init() was called without any help items.");

   // Make ourselves discoverable to module-dialog.js's optional-chaining hook.
   window.FloriaHelp = FloriaHelp;

   if (actionElementId != null)
    {
      let container = document.getElementById(actionElementId);
      if (container != null)
       {
         // NOTE: deliberately insertAdjacentHTML() rather than read+rewrite innerHTML: some other,
         // app-specific module may independently inject its OWN action icon into this same
         // container, in either call order (e.g. a "product tour"/walkthrough module living
         // outside of Floria). Rewriting innerHTML wholesale would re-parse/destroy any such
         // sibling icon's DOM node - and the click listener attached to it - regardless of which
         // one ran first. insertAdjacentHTML() only inserts this new node, leaving existing
         // children (and their listeners) untouched.
         if (document.getElementById(actionElementId+'_HELP') == null)
          {
            container.insertAdjacentHTML('afterbegin', '<IMG id="'+actionElementId+'_HELP" src="/static/img/action-marker.gif" title="'+(tooltipLabel||helpStrings.tooltips.stepByStep)+'">');
            FloriaDOM.addEvent(actionElementId+'_HELP', "click", function(e, event, target) {
              FloriaHelp.highlightVisibleElements();
            });
          }
       }
    }
 };

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Ring: applied directly on the target element as an inline outline, so it never needs repositioning.
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const RING_OUTLINE = "2px solid rgba(255,165,0,0.6)"; // matches the previous overlay's border color/alpha
const RING_OFFSET = "2px";

function applyRing(e)
 {
   e.style.outline = RING_OUTLINE;
   e.style.outlineOffset = RING_OFFSET;
 }
function clearRing(e)
 {
   e.style.outline = "";
   e.style.outlineOffset = "";
 }

// Elements styled with a CSS "filter" (e.g. monochrome icons colorized via filter:invert()/hue-rotate()/...)
// paint their entire box - including any inline outline - through that filter, which would visibly distort
// the ring's color. For such elements we can't use an inline outline on the element itself; instead we fall
// back to drawing the ring as a border on the (already separately-tracked, filter-free) badge overlay sibling,
// reusing the existing ".floriaHelpOverlay" CSS border/radius rather than the inline outline.
function hasFilter(e)
 {
   let f = getComputedStyle(e).filter;
   return f != null && f != "none";
 }

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Visibility: is the element fully within the visible (i.e. non-clipped) area of every one of its
// scrollable ancestors, and within the viewport? Used every tracking tick to show/hide ring+badge as the
// user scrolls a nested container. (Deliberately not reusing FloriaDOM.isElementVisible() here: that
// helper does a "what's on top at this point?" hit-test which would always find our own badge overlay
// once created, so it can't be used to detect nested-scroll clipping on every subsequent frame.)
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function isFullyVisible(e)
 {
   let rect = e.getBoundingClientRect();
   if (rect.width <= 0 || rect.height <= 0)
    return false;

   let clipTop = 0, clipLeft = 0, clipRight = window.innerWidth, clipBottom = window.innerHeight;
   let p = e.parentElement;
   while (p != null && p.nodeType == 1 && p.tagName != "BODY")
    {
      let style = getComputedStyle(p);
      if (style.overflow == "hidden" || style.overflow == "auto" || style.overflow == "scroll"
          || style.overflowY == "hidden" || style.overflowY == "auto" || style.overflowY == "scroll"
          || style.overflowX == "hidden" || style.overflowX == "auto" || style.overflowX == "scroll")
       {
         let pRect = p.getBoundingClientRect();
         clipTop = Math.max(clipTop, pRect.top);
         clipLeft = Math.max(clipLeft, pRect.left);
         clipRight = Math.min(clipRight, pRect.right);
         clipBottom = Math.min(clipBottom, pRect.bottom);
       }
      p = p.parentElement;
    }

   const epsilon = 0.5; // tolerance for sub-pixel rounding jitter
   return rect.top >= clipTop-epsilon && rect.left >= clipLeft-epsilon
       && rect.bottom <= clipBottom+epsilon && rect.right <= clipRight+epsilon;
 }

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Badge overlay: a small tracked DOM node (still needed for its own hover/click/tooltip behavior),
// repositioned every frame while help mode is active.
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function addBadgeTooltip(overlay, tooltipStr)
 {
    let badge = overlay.childNodes[0];
    let tooltip = new FloriaTooltipDialog(badge, tooltipStr, false, true, "simple", false, null, 2);
    FloriaDOM.addEvent(badge, "mouseenter", function(e, event, target) {
       tooltip.show(event);
    });
    FloriaDOM.addEvent(badge, "mouseleave", function(e, event, target) {
       tooltip.hide(event);
    });
    FloriaDOM.addEvent(overlay, "click", function(e, event, target) {
       tooltip.hide(event);
       clearHighlights();
       const newEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: event.clientX,
          clientY: event.clientY
       });
       document.elementFromPoint(event.clientX, event.clientY)?.dispatchEvent(newEvent);
    });
 }

function repositionOverlay(overlay, e)
 {
   let rect = e.getBoundingClientRect();
   overlay.style.top = (rect.top-2)+"px";
   overlay.style.left = (rect.left-2)+"px";
   overlay.style.width = (rect.right-rect.left+2)+"px";
   overlay.style.height = (rect.bottom-rect.top+2)+"px";
 }

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Tracking loop: while any highlight is active, keep badge positions in sync and toggle ring+badge
// visibility based on isFullyVisible(). This is what fixes both the window-resize and nested-scroll bugs.
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let activeHighlights = []; // [{ element, overlay, useOverlayRing }]
let rafId = null;

function trackingTick()
 {
   for (let i = 0; i < activeHighlights.length; ++i)
    {
      let h = activeHighlights[i];
      if (isFullyVisible(h.element) == true)
       {
         h.overlay.style.display = '';
         repositionOverlay(h.overlay, h.element);
         if (h.useOverlayRing == false)
          applyRing(h.element);
       }
      else
       {
         h.overlay.style.display = 'none';
         if (h.useOverlayRing == false)
          clearRing(h.element);
       }
    }
   rafId = requestAnimationFrame(trackingTick);
 }
function startTracking()
 {
   if (rafId == null)
    rafId = requestAnimationFrame(trackingTick);
 }
function stopTracking()
 {
   if (rafId != null)
    cancelAnimationFrame(rafId);
   rafId = null;
 }

function clearHighlights()
 {
   stopTracking();
   for (let i = 0; i < activeHighlights.length; ++i)
    if (activeHighlights[i].useOverlayRing == false)
     clearRing(activeHighlights[i].element);
   activeHighlights = [];
   FloriaDOM.clearAllOverlays();
 }

// Called by FloriaDialog.show() (via window.FloriaHelp?.enablePopupDialog(t)) to add a help action-marker
// icon to a dialog's title element.
FloriaHelp.enablePopupDialog = function(t)
 {
   t.innerHTML = '<IMG id="'+t.id+'_ACTIONS" style="height:3vh; vertical-align:bottom; margin-right:10px; cursor:pointer;" src="/static/img/action-marker.gif" title="'+helpStrings.tooltips.stepByStep+'">'+t.innerHTML;
   FloriaDOM.addEvent(t.id+'_ACTIONS', "click", function(e, event, target) {
     FloriaHelp.highlightVisibleElements();
   });
 }
// Called by FloriaDialog.hide() (via window.FloriaHelp?.disablePopupDialog()) to clear any active help highlights.
FloriaHelp.disablePopupDialog = function(t)
 {
   return clearHighlights();
 }

FloriaHelp.highlightVisibleElements = function()
 {
   if (activeHighlights.length > 0)
    return clearHighlights();

   if (helpItems == null)
    return console.warn(helpStrings.errors.noVisibleElements);

   let elementsVisited = [];
   for (let i = 0; i < helpItems.length; ++i)
     {
       let it = helpItems[i];
       if (it.tooltip == null)
        continue;
       let className = it.elementId != null ? "#"+it.elementId : it.id != null ? ".floriaHelpItem-"+it.id : null;
       if (className == null)
        {
          console.error("Help item #"+i+" has neither 'elementId' nor 'id' to locate its target element.");
          continue;
        }
       let elements = testElementId != null ? [document.getElementById(testElementId)] : document.querySelectorAll(className);
       if (elements != null && elements.length == 1)
        {
          let e = elements[0];
          if (elementsVisited.includes(e) == false && FloriaDOM.isElementVisible(e) == true)
           {
             e.dataset.tooltip = it.tooltip;
             elementsVisited.push(e);
           }
        }
     }

   if (elementsVisited.length == 0)
    return console.warn(helpStrings.errors.noVisibleElements);

   for (let i = 0; i < elementsVisited.length; ++i)
    {
      let e = elementsVisited[i];
      let overlay = FloriaDOM.createElementOverlay(e, "floriaHelpOverlay", null, i+1);
      let useOverlayRing = hasFilter(e);
      // Normal case: cancel the overlay's CSS border and draw the ring inline on the element instead.
      // Filtered targets (e.g. a colorized monochrome icon) keep the overlay's own (filter-free) CSS
      // border as their ring instead, since an inline outline on the element would be distorted by its filter.
      if (useOverlayRing == false)
       {
         overlay.style.border = "none";
         applyRing(e);
       }
      addBadgeTooltip(overlay, e.dataset.tooltip);
      activeHighlights.push({ element: e, overlay: overlay, useOverlayRing: useOverlayRing });
    }
   startTracking();
 }
