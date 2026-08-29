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

import { FloriaDOM   } from "./module-dom.js";
import { createPopper } from "/static/jslibs/popperjs/popper.js";

const DT_LOAD = window._STARTUP_DATE_MS || new Date().getTime();

FloriaDOM.injectCSSLink("FLORIA_CSS_ANCHOR", true, new URL("./module-dialog.css?ts="+DT_LOAD, import.meta.url).href);

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Floria Dialog
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var __DIALOGS = [];
var __hiding = false; // global flag to manage overlapping dialog functionality, e.g., hiding one while showing another

// Cache of fetched FloriaTabs help fragments, keyed by helpUrl, shared across every FloriaTabs
// instance on the page — a given help URL's HTML is only ever fetched once per page load, no
// matter how many different FloriaTabs (or repeated opens of the same one) reference it.
var __TABS_HELP_CACHE = {};

function printDialogStack()
 {
//   for (var i = 0; i < __DIALOGS.length; ++i)
//    console.log(""+i+__DIALOGS[i]._md.id+" ("+__DIALOGS[i]._md.style.display+")");
 }

export function FloriaDialog(elementId)
 {
   this._e = document.getElementById("FLORIA_DLG_BG");
   if (this._e == null)
    {
      this._e = document.createElement('div');
      this._e.id = "FLORIA_DLG_BG";
      this._e.classList.add("modalBackground");
      document.body.appendChild(this._e);
    }
   this._md = document.getElementById(elementId);
   if (this._md == null)
    {
      this._md = document.createElement('div');
      this._md.id = elementId;
      this._md.classList.add("modalDialog");
      this._md.innerHTML = '<DIV class="modalTitle"><SPAN id="'+elementId+'_MD_TITLE"></SPAN><SPAN id="'+elementId+'_MD_CLOSE"></SPAN></DIV>'
                          +'<DIV class="modalContent" id="'+elementId+'_MD_CNT"></DIV>'
                         ;
      this._e.appendChild(this._md);
    }
   
   this._closeable = true;

   var that = this;
   FloriaDOM.addEvent(elementId+"_MD_CLOSE", "click", async function() {
     if (that._onBeforeHideHandler != null)
      {
        var proceed = await that._onBeforeHideHandler(true);
        if (proceed === false)
         return;
      }
     that.hide(true);
   }, null, true);
   
   this.setCloseable = function(closeable)
    {
      this._closeable = closeable;
      document.getElementById(this._md.id+"_MD_CLOSE").style.display = closeable == true? "" : "none";
    }
   this.setOnHide = function(func)
    {
      this._onHideHandler = func;
    };
   // Optional, cancelable hook invoked ONLY when the user closes the dialog via its own "X" close
   // button (i.e. manualClose === true from that path). `func` may be async and should return false
   // to abort the close (e.g. to surface an "unsaved changes" confirmation), or anything else/undefined
   // to allow it. NOT invoked for programmatic hide()/close() calls made directly by app code — those
   // callers are expected to perform their own confirmation before calling hide(), same as before.
   this.setOnBeforeHide = function(func)
    {
      this._onBeforeHideHandler = func;
    };
   this.setOnLoad = function(func)
    {
      this._onLoadHandler = func;
    };
   this.show = function(title, url, w, h, contents, recall)
    {
      var that = this;
//      console.log("dialog.show() - "+this._md.id)
      if (__hiding == true && recall == null)
       return setTimeout(function() { that.show(title, url, w, h, contents, true); }, 300); // 500 is the hiding delay, so we undershoot a little
      else
       __hiding = false;
       
      var repaint = false;
      if (__DIALOGS.length > 0)
       {
         // push down and slide down previous dialog
         var lastDialog = __DIALOGS[__DIALOGS.length-1];
         // If we are repainting the current popup, then we can't tuck it away. 
         if (lastDialog._md.id == this._md.id)
          repaint = true;
         else
          {
            setTimeout(() => {
                lastDialog._md.style.top = "85%";       // slide down
                lastDialog._md.style.opacity = "";   // fade back
                lastDialog._md.style.zIndex = 0;
//                lastDialog._md.style.transform="rotate(1deg)";
            }, 100); // 100ms delay for smoother effect
          }
       }

      // Paint title
      var t = this._md.childNodes[0].childNodes[0]; // first child element -> modalTitle, then first element is first SPAN
      t.innerHTML = title;

      // Set the dialog's size
      this._w = w > 0.98 ? 98 : w < 0.2 ? 2 : 100*w;
      this._h = h > 0.98 ? 98 : h < 0.2 ? 2 : 100*h;
      this._md.style.width=this._w+"%";
      this._md.style.height=this._h+"%";
      this._md.style.left=((100-this._w)/2)+"%";
      this._md.style.top = "-10%"; //((100-this._h)/2)+"%"; // new comes from the top

      if (repaint == false)
       {
         __DIALOGS.push(this);
         this._md.style.zIndex=1000+__DIALOGS.length;
       }

       // Unhide everything as a setTimeout to trigger animations if any
       setTimeout(function() { 
         that._e.style.opacity=1;
         that._e.style.left=0;
         that._md.style.opacity=1;
         that._md.style.top = ((100-that._h)/2)+"%";
       }, 10);
          
      // Paint the dialog's content
      if (url != null)
       {
         // We can load HTML dynamically, and in doing so, we need to execute the script blocks if any
         fetch(url).then(response => response.text()) 
                   .then(function(html) { 
                       that._md.childNodes[1].innerHTML = html;
                       // Eventually replace the below with FloriaDOM.execScriptBlocks...
                       Array.from(that._md.childNodes[1].querySelectorAll("script"))
                            .forEach( oldScript => {
                               const newScript = document.createElement("script");
                               Array.from(oldScript.attributes)
                                    .forEach( attr => newScript.setAttribute(attr.name, attr.value) );
                               newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                               oldScript.parentNode.replaceChild(newScript, oldScript);
                       });
                      if (that._onLoadHandler != null)
                       that._onLoadHandler();
                   });
          return;
       }
      
      if (typeof contents == "string")
       this._md.childNodes[1].innerHTML = contents;
      else if (contents != null)
       contents(this._md.id+"_MD_CNT"); // second element, i.e., the modalContent
      if (that._onLoadHandler != null)
       that._onLoadHandler();
      window.FloriaHelp?.enablePopupDialog(t);
    }
   this.setContent = function(contents)
    {
      this._md.childNodes[1].innerHTML = contents;
    }
   this.getId = function()
    {
      return this._md.id+"_MD_CNT";
    }
   this.hide = function(manualClose)
    {
//      console.log("dialog.hide() - "+this._md.id);
//      console.trace();
      var that = this;
      
      window.FloriaHelp?.disablePopupDialog();

      var topDlg = __DIALOGS.pop();
      if (topDlg != null && topDlg._md.id != this._md.id) // hide is being called twice on the same object
       {
         __DIALOGS.push(topDlg);
         return;
       }
      
      __hiding = true;

      if (that._onHideHandler != null)
       that._onHideHandler(manualClose);

      // It's possible for someone to close a dialog and re-open a new one right away.
      // Because of the timeouts below for animation effects, we have to "capture" this._md
      // before it gets overwritten by the following show().
      var that_md = that._md;       
      // Reset items to default (from css)
      setTimeout(function(){
        that_md.style.top="-10%";
        that_md.style.opacity="0";
        that_md.style.zIndex=0;
        __hiding = false;
      }, 10);

      // sliding back in the previous dialog
      if (__DIALOGS.length > 0)
       {
          var lastDialog = __DIALOGS[__DIALOGS.length-1];
          lastDialog._md.style.opacity="1";
          lastDialog._md.style.transform="rotate(0deg)";
          lastDialog._md.style.top = ((100-lastDialog._h)/2)+"%";
          lastDialog._md.style.zIndex=1000+__DIALOGS.length;
       }
      else
       setTimeout(function(){
         that._e.style.opacity="0";
         setTimeout(function(){
           if (__DIALOGS.length == 0) // Only move out the background div and clear the node if we cleared the whole stack
            {
              that._e.style.left="";
              that_md.childNodes[1].innerHTML = '';
            }
         }, 500);
       }, 10);
    }
   this.isVisible = function()
    {
      return this._md.style.opacity == "1";
    }
 };
  







// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Tooltip dialog
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function FloriaTooltipDialog(elementId, content, arrow, manual, additionalClass, reuseTooltipDiv, placement, offset)
 {
   var that = this;
   
   that._e = FloriaDOM.getElement(elementId);
   if (that._e == null) // no anchor, so let's make one.
    {
      that._e = FloriaDOM.getElement("DEFAULT_CENTERED_FLORIA_TOOLTIPDIALOG");
      arrow = false;
      if (that._e == null)
        {
          that._e = document.createElement('div');
          that._e.id = "DEFAULT_CENTERED_FLORIA_TOOLTIPDIALOG";
          that._e.style.position = "fixed";
          that._e.style.left = "50%";
          that._e.style.top = "10%";
          that._e.style.opacity = 0;
          that._e.style.transform = "translate(-50%, -50%)";
          document.body.appendChild(that._e);
        }
    }
   that._tt = document.getElementById(reuseTooltipDiv==true ? "FLORIA_TTD" : that._e.id+"_TD");
   if (that._tt == null)
    {
      that._tt = document.createElement('div');
      that._tt.setAttribute("id", reuseTooltipDiv==true ? "FLORIA_TTD" : that._e.id+"_TD");
      that._tt.setAttribute("role", "tooltip");
      that._tt.style.opacity=0;
//      that._tt.setAttribute("fade-in-popper", "");
      document.body.appendChild(that._tt);
    }
   that._tt.className=additionalClass==null?"popperTooltip":"popperTooltip "+additionalClass;
   that._tt.innerHTML=content+(arrow==true?'\n<div class="popperArrow" data-popper-arrow></div>':'');
   that._popper = createPopper(that._e, that._tt, {
        placement: placement||'bottom'
       ,modifiers: [
           { name: 'offset'
            ,options: {
               offset: [0, offset||0]
             }
           }
          // Without 'flip', an anchor with too little room in its preferred
          // direction (e.g. a top-row cell in a scrollable table using
          // placement:'top') gets its tooltip squeezed/clipped by
          // preventOverflow instead of flipping to the opposite side where
          // there IS room — this is what made tooltips look clipped/
          // mispositioned near a scrollable ancestor's edge.
          ,{ name: 'flip'
            ,options: {
               boundary    : document.body
              ,rootBoundary: 'viewport'
              ,fallbackPlacements: ['top', 'bottom', 'right', 'left']
             }
           }
          ,{ name: 'preventOverflow'
            ,options: {
               // The tooltip <div> itself is portaled to document.body, so it
               // should never be clipped by a scrollable ancestor of the
               // anchor (e.g. a "overflow:auto" table wrapper) — only by the
               // actual browser viewport. NOTE: 'boundary' must be an actual
               // Element (or the default 'clippingParents', which WOULD walk
               // up through — and get squeezed by — any overflow:auto/hidden
               // ancestor like .mx-wrap); 'viewport' is only valid as a
               // rootBoundary value, not as boundary.
               boundary    : document.body
              ,rootBoundary: 'viewport'
              ,altAxis     : true
              }
           }
        ]
     });
//      var onclick=function(evt) { that._clickHandler(evt); };
//      that._e.addEventListener("click", onclick);
//      var onmouseleave=function(evt) { that.hide(evt); };
//      var onmouseleave2=function(evt) { setTimeout(function(){that.hide();},100); };
//      that._tt.addEventListener("mouseleave", onmouseleave, null, true);
//      that._tt.addEventListener("click", onmouseleave2, null, true);

      if (manual != true)
       {
         FloriaDOM.addEvent(that._e , "click"     , function(e, event, target) { that._clickHandler(event); }, null, true);
         FloriaDOM.addEvent(that._tt, "mouseleave", function(e, event, target) { setTimeout(function(){that.hide(event);},500); }, null, true);
       }
       
      that.setSize = function(w, h)
       {
         if (w == null && h == null) // autoposition
          {
//            if (that._e.style.position)
          }
         that._w = w;
         that._h = h;
         if (w != null)
          that._tt.style.width=w;
         if (h != null)
          that._tt.style.height=h;
//         console.log(FloriaDOM.getElementDimensions(that._tt));
         return that;
       }
      that.setPosition = function(t, l, b, r, forceShow=false)
       {
         that._t = t;
         that._l = l;
         that._b = b;
         that._r = r;
         if (t != null)
          that._tt.style.top=t;
         if (l != null)
          that._tt.style.left=l;
         if (b != null)
          that._tt.style.bottom=b;
         if (r != null)
          that._tt.style.right=r;
         if (l != null && r != null)
          that._tt.style.width="";
         if (t != null && b != null)
          that._tt.style.height="";
         if (t!= null || l!=null || b!=null || r!=null)
          that._tt.style.transform="none";
         if (forceShow == true)
          {
            this._tt.style.opacity="";
            this._tt.style.display="";
          }
//         console.log(FloriaDOM.getElementDimensions(that._tt));
         return that;
       }

      that._clickHandler = function (evt)
       {
         if (evt != null)
          evt.preventDefault();
         if (this._tt.hasAttribute("show-popper"))
          this._tt.removeAttribute("show-popper");
         else
          this._tt.setAttribute("show-popper", "");
         that._tt.style.opacity="";
         this._popper.update();
       }
      that.destroy = function()
       {
         if (this._popper)
          {
            this.hide();
            this._popper.destroy();
            if (manual != true)
             {
               FloriaDOM.removeEvents(this._e, "click");
               FloriaDOM.removeEvents(this._tt, "mouseleave");
               FloriaDOM.removeEvents(this._tt, "click");
             }
            this._popper = null;
            this._e = null;
            that._tt.innerHTML = '';
            this._tt = null;
          }
       }
      that.hide = function (evt)
       {
         if (evt != null)
          evt.preventDefault();
         that._tt.style.opacity=0;
         this._tt.removeAttribute("show-popper");
         this._popper.update();
         return that;
       }
      that.show = function (evt, maximized, delayShow=false)
       {
         if (evt != null)
          evt.preventDefault();
         if (this._t == null)
          this._popper.update();
         else
          this._tt.style.transform="none";
         if (maximized == true)
          setTimeout(function(){that.maximize();}, 10);
         this._tt.setAttribute("show-popper", "");
         if (delayShow == false)
          this._tt.style.opacity="";
         else
          this._tt.style.display="none";
         console.log(FloriaDOM.getElementDimensions(that._tt));
         return this;
       }
      that.maximize = function(w=0.6, h=0.92)
       {
         // Set the dialog's size
         w = w > 0.98 ? 98 : w < 0.3 ? 3 : 100*w;
         h = h > 0.98 ? 98 : h < 0.3 ? 3 : 100*h;
         that._tt.style.width=w+"%";
         that._tt.style.height=h+"%";
         that._tt.style.left=((100-w)/2)+"%";
         that._tt.style.top=((100-h)/2)+"%";
         that._tt.style.transform="none";
       }
      that.minimize = function()
       {
         that.setSize(that._w, that._h);
         that.setPosition(that._t, that._l);
         this._popper.update();
       }
      that.setContents = function(str)
       {
         that._tt.innerHTML=str;
       }
      that.getTooltipDiv = function()
       {
         return that._tt;
       }
 };









export function FloriaContextMenu(elementId, options, cssPostfix, callbackFunc, leftClick)
 {
   this._elementId = elementId;
   this._callbackFunc = callbackFunc;
   this._cssPostfix = cssPostfix || '';
   this._contextMenu = document.createElement('UL');
   
   var str = '';
   for (let i = 0; i < options.length; ++i)
    str+='<LI data-id="'+options[i].id+'">'+options[i].label+'</LI>';
   this._contextMenu.innerHTML = str;
   this._contextMenu.classList.add("contextMenu"+this._cssPostfix);
   this._contextMenu.style.display="none";
   document.body.appendChild(this._contextMenu);

   let that = this;

   FloriaDOM.addEvent(elementId, leftClick == true ? "click" : "contextmenu", function(e, event, target) {
       if (target.dataset.contexttarget != 1)
        return;
       event.preventDefault();
       event.stopPropagation();
       event.stopImmediatePropagation();
       that._contextMenu.style.left=(event.pageX-5)+"px";
       that._contextMenu.style.top=(event.pageY-5)+"px";
       that._contextMenu.lastTarget = target;
       FloriaDOM.show(that._contextMenu);
       var screenWidth = document.body.offsetWidth;
       if (that._contextMenu.offsetLeft+that._contextMenu.offsetWidth > screenWidth)
        that._contextMenu.style.left = (that._contextMenu.offsetLeft - that._contextMenu.offsetWidth+15)+"px";
   });

   FloriaDOM.addEvent(this._contextMenu, "click", function(e, event, target) {
     if (target.nodeName != 'LI')
      return;
     event.preventDefault();
     event.stopPropagation();
     event.stopImmediatePropagation();
     FloriaDOM.hide(that._contextMenu);
     callbackFunc(that._contextMenu.lastTarget, target.dataset.id);
   });

   // We have to prevent right click menus on the context menu
   FloriaDOM.addEvent(this._contextMenu, "contextmenu", function(e, event, target) {
     event.preventDefault();
     event.stopPropagation();
     event.stopImmediatePropagation();
   });

   FloriaDOM.addEvent(this._contextMenu, "mouseleave", function(e, event, target) {
     FloriaDOM.hide(that._contextMenu);
   });
 }




/**
 A small, self-contained "quick guide" popover: an anchored, dismissable panel whose contents are an
 HTML fragment fetched from a URL. Originally FloriaTabs' private "(?)" help implementation, now
 factored out so the exact same help content and chrome can be attached to ANY anchor element — a
 host application that supplies its own navigation (and therefore renders no FloriaTabs header strip,
 or suppresses its help icon) can still surface the same guide from wherever it makes sense in its
 own layout, without duplicating the fetch/cache/dismiss logic or drifting from FloriaTabs' look.

 anchorElementId: id of the ALREADY-RENDERED element the popover attaches to and points at. Note that
    this component does NOT create, style or wire that anchor — the caller owns it (FloriaTabs, for
    one, renders a ".tabHelpIcon" SPAN and calls show() from its own toggle-safe click handler). The
    element only has to exist by the time show() is first called, not at construction time.

 helpUrl: the fragment to display. Fetched at most once PER PAGE LOAD across every FloriaHelpPopover
    and FloriaTabs referencing the same URL (see __TABS_HELP_CACHE), so repeated opens — and several
    popovers sharing one guide — are instant and cost a single request. Cache-busting, if wanted, is
    the caller's business: vary the URL (e.g. append a build timestamp) and it becomes a distinct
    cache key.

 tooltipClass (optional): extra class on the underlying FloriaTooltipDialog, defaulting to
    "tabHelpTooltip" so anything using this inherits FloriaTabs' help styling for free. Pass your own
    only to skin a popover differently; the inner ".tabHelpPopover"/".tabHelpClose"/".tabHelpBody"
    structure is fixed either way.

 Behavior: content renders immediately from cache (or a "Loading…" placeholder while the first fetch
 is in flight, which is then swapped in place — the popover never blocks on the network before
 appearing), and can be dismissed via its own "×" or by clicking anywhere outside it. A failed fetch
 degrades to an inline apology rather than an empty box, and is deliberately NOT cached, so simply
 reopening the popover retries.
*/
export function FloriaHelpPopover(anchorElementId, helpUrl, tooltipClass)
 {
   var that = this;
   this._helpUrl = helpUrl;
   this._dialog = null;

   this._render = function(html)
    {
      that._dialog.setContents(
          '<div class="tabHelpPopover">'
        +   '<span class="tabHelpClose" title="Close">&times;</span>'
        +   '<div class="tabHelpBody">'+html+'</div>'
        + '</div>');
      var closeEl = that._dialog.getTooltipDiv().querySelector(".tabHelpClose");
      if (closeEl != null)
       closeEl.onclick = function(e) { e.preventDefault(); e.stopPropagation(); that._dialog.hide(); };
    };

   // Lazily creates (on first use) and (re)opens the popover anchored to anchorElementId, rendering
   // helpUrl's HTML from cache when it has already been fetched once this page load.
   this.show = function()
    {
      if (that._dialog == null)
       {
         that._dialog = new FloriaTooltipDialog(anchorElementId, "", true, true, tooltipClass || "tabHelpTooltip");
         that._dialog.setSize("min(560px, 92vw)", "min(70vh, 620px)");
         // Click-outside-to-close: only acts while THIS popover is actually shown, and ignores clicks
         // on the popover itself or on the anchor that opened it (whose own handler is expected to be
         // toggle-safe, so a click there doesn't get double-handled into close-then-reopen).
         document.addEventListener("click", function(ev)
          {
            var tt = that._dialog?.getTooltipDiv();
            if (tt == null || tt.hasAttribute("show-popper") == false)
             return;
            var anchor = document.getElementById(anchorElementId);
            if (tt.contains(ev.target) || anchor === ev.target || (anchor != null && anchor.contains(ev.target)))
             return;
            that._dialog.hide();
          }, true);
       }

      that._render(__TABS_HELP_CACHE[that._helpUrl] || '<div class="tabHelpLoading">Loading…</div>');
      that._dialog.show(null, false);

      if (__TABS_HELP_CACHE[that._helpUrl] != null)
       return;
      fetch(that._helpUrl)
        .then(function(resp) { return resp.text(); })
        .then(function(html)
         {
           __TABS_HELP_CACHE[that._helpUrl] = html;
           that._render(html);
         })
        .catch(function()
         {
           // Not cached: reopening the popover retries the fetch.
           that._render('<p>Sorry, this help content could not be loaded.</p>');
         });
    };

   this.hide = function() { that._dialog?.hide(); };
 }




/**
 tabs ia an array:
    { label:"", descr:"", hide:true|false, onHideHanler: function, onSelectHandler: function }

    onSelectHandler(panelId, isFirstRender, setStatus) is called every time this tab is selected
    (see select() below):
      panelId       - id of this tab's panel DIV, to render/refresh content into.
      isFirstRender - true only the very first time this tab is ever selected (handlers typically
                      use this to lazily build their panel's DOM once, rather than on every select).
      setStatus     - a function(status) already bound to THIS tab — status is one of "busy",
                      "success", "failure", or null/undefined to clear. Equivalent to calling
                      floriaTabsInstance.setTabStatus(thisTabsIndexOrLabel, status) yourself, minus
                      having to hold onto the FloriaTabs instance or hard-code this tab's own
                      index/label just to reference itself — see setTabStatus()'s docs further
                      below for what the status actually looks like. Typical usage from inside a
                      tab's own long-running action (e.g. a "Run" button click handler kicked off
                      from onSelectHandler, or later, from any code that still has a reference to
                      this same setStatus closure):
                        setStatus('busy');
                        try { await doTheWork(); setStatus('success'); }
                        catch (e) { setStatus('failure'); }

 skin (optional): visual skin for the tab header — see module-dialog.css.
    null|"classic" (default) - original look & feel, fully backward compatible.
    "modern"                 - Material-ish flat header with a sliding underline
                                indicator (".tabContainer--modern" in module-dialog.css).
    The skin only ever ADDS a modifier class alongside ".tabContainer" — the shared
    structural/layout rules (position, sizing, .tabBody scrolling, ...) are never
    duplicated or overridden, only the header's visual appearance changes.

 helpUrl (optional): when provided, a small "(?)" help icon is rendered to the right of the tab
    headers (see ".tabHelpIcon" in module-dialog.css). Clicking it fetches helpUrl (once — the
    result is cached in __TABS_HELP_CACHE, shared across every FloriaTabs instance on the page)
    and displays it as a rich popover (a FloriaTooltipDialog, per this app's convention of using
    that component for any anchored, dismissable HTML popup) anchored to the icon itself, with
    its own close ("×") affordance and click-outside-to-dismiss behavior. Purely additive: a
    FloriaTabs with no helpUrl renders and behaves exactly as before.

 position (optional): where the tab headers are rendered relative to the tab body — one of
    "top" (default), "bottom", "left", or "right". Purely additive/backward compatible: omitting
    it (or passing "top") renders exactly as before. See module-dialog.css's
    ".tabContainer--pos-*" rules for the actual layout — headers flip to a vertical column for
    "left"/"right", with each tab's label text rotated to run vertically (-90deg on the left,
    so it reads bottom-to-top; +90deg on the right, so it reads top-to-bottom), and "bottom"
    simply reorders the same top layout to the other edge.
 */
export function FloriaTabs(elementId, tabs, singleDiv, managingFunc, trashcan, skin, helpUrl, position)
 {
   this._elementId = elementId;
   this._tabs = tabs;
   this._currentTabId = null;
   this._singleDiv = singleDiv || false;
   this._skinClass = (skin != null && skin != "classic") ? " tabContainer--"+skin : "";
   this._position = (position == null || position == "top") ? "top" : position;
   this._posClass = this._position != "top" ? " tabContainer--pos-"+this._position : "";
   this._helpUrl = helpUrl || null;
   // The help popover itself is not special to FloriaTabs — see FloriaHelpPopover above, which owns
   // all of the fetch/cache/anchor/dismiss behavior. FloriaTabs merely renders the ".tabHelpIcon"
   // anchor (in show(), below) and points one of these at it.
   this._help = this._helpUrl == null ? null : new FloriaHelpPopover(elementId+"_TABHELP", this._helpUrl);
   this._showHelp = function() { this._help?.show(); };

   this.show = function(defaultTabId = 0)
    {
      var str = '<DIV class="tabContainer'+this._skinClass+this._posClass+'"><DIV id="'+elementId+'_TABHEADERS" class="tabHeader">';
      for (var i = 0; i < this._tabs.length; ++i)
       {
         var t = this._tabs[i];
         if (t.hide == true)
          continue;
         str+='<SPAN id="'+elementId+'_TABHEADER_'+i+'" data-tabid="'+i+'" data-contextTarget="1"'
             +(t._status!=null?' data-tabstatus="'+t._status+'"':'')
             +' title="'+(t.descr==null?"":t.descr.printHtmlAttrValue())+'">'+t.label+'</SPAN>';

       }
      if (this._helpUrl != null)
       str += '<SPAN id="'+elementId+'_TABHELP" class="tabHelpIcon" title="Quick Guide / Help"></SPAN>';
      str+='</DIV><DIV class="tabBody">';
      var current = 0;
      for (var i = 0; i < this._tabs.length; ++i)
       {
         var t = this._tabs[i];
         if (defaultTabId == i || defaultTabId == null && t.current == true)
          current = i;
         t._renderCount = 0;
         if (this._singleDiv == false || i == 0)
          str+='<DIV id="'+elementId+'_TABPANEL_'+i+'"></DIV>';
       }
      str+='</DIV></DIV>';
      FloriaDOM.setInnerHTML(elementId, str);

      var that = this;
      setTimeout(function() { that.select(current); }, 10);

      FloriaDOM.addEvent(elementId+"_TABHEADERS", "click", function(e, event, target) {
        var tabId = target.dataset.tabid;
        if (tabId == null)
         return; // click landed on the header strip itself (or the help icon — handled separately below), not a tab
        that.select(tabId);
      }, null, true);

      if (this._helpUrl != null)
       FloriaDOM.addEvent(elementId+"_TABHELP", "click", function(e, event, target) {
         event.preventDefault();
         event.stopPropagation();
         that._showHelp();
       }, null, true);

      if (managingFunc != null)
       {
         let contextMenuOptions = [{id:"PROPERTIES", label:"Properties" }
                                  ,{id:"NEW"       , label:"New"      }
                                  ,{id:"SLIDE"     , label:"Slide"    }
                                  ,{id:"DELETE"    , label:"Delete"   }
                                  ];
         if (trashcan == true)
          contextMenuOptions.push({id:"TRASHCAN"  , label:"Trashcan"   });

         that._contextMenu = new FloriaContextMenu(elementId+"_TABHEADERS", contextMenuOptions, "_tabs", function(targetTab, menuOptionId) {
             let tabId = 1*targetTab.dataset.tabid;
             let tab = that._tabs[tabId];
             managingFunc(tabId, tab, menuOptionId, function() { 
                that.show();
             });
          });
       }
    }
    
   // Resolves a tab reference to an index, or null if not found. Accepts a numeric index (either a
   // real number, or the numeric STRING that the header click handler passes through from
   // target.dataset.tabid — see show()'s click handler above), or the tab's .label string.
   this._resolveTabIndex = function(tabIdOrLabel)
    {
      if (typeof tabIdOrLabel === "number")
       return tabIdOrLabel;
      if (typeof tabIdOrLabel === "string" && tabIdOrLabel.trim() !== "" && !isNaN(tabIdOrLabel))
       return Number(tabIdOrLabel);
      var idx = this._tabs.findIndex(function(t) { return t.label === tabIdOrLabel; });
      return idx >= 0 ? idx : null;
    }

   /**
    * Sets (or clears) a "long running process" status badge on a background tab's header — mirrors
    * how browser tabs show a spinner for a loading background tab, then a dot/icon once it's done,
    * until the user actually clicks over to that tab. See module-dialog.css's "Tab Status Badges"
    * section for the actual visuals (busy = looping spinner ring; success/failure = a short pop-in
    * animation settling on a static check/✕ dot).
    *
    *   tabIdOrLabel - the tab's numeric index (as passed to select()), OR its .label string —
    *                  whichever is more convenient for the caller (e.g. app code that only knows
    *                  a tab by name, not its position in the array).
    *   status       - one of "busy", "success", "failure", or null/undefined to clear the badge
    *                  outright (e.g. if the app wants to cancel/reset it itself, without waiting
    *                  for the user to select the tab).
    *
    * The badge is automatically cleared the moment the user selects that tab (see select() below) —
    * callers never need to clear "success"/"failure" themselves in the common case. BUT if the tab
    * reporting "success"/"failure" is ALREADY the one currently in focus (e.g. the user kicked off
    * the action and stayed put, rather than switching away and back), select()'s clear-on-select
    * would never fire — so that specific case is instead auto-dismissed here after a short 1s
    * delay, just long enough for the pop/shake flourish to register before it disappears.
    */
   this.setTabStatus = function(tabIdOrLabel, status)
    {
      var idx = this._resolveTabIndex(tabIdOrLabel);
      if (idx == null)
       return;
      var self = this;
      var t = this._tabs[idx];
      t._status = status || null;
      // Bumped on every call and captured below so a LATER call (e.g. the user re-triggers the
      // same action, or switches away/back re-clearing it via select()) can invalidate this one's
      // pending auto-dismiss timeout instead of it firing late and clobbering a newer status.
      var myGen = (t._statusGen = (t._statusGen || 0) + 1);
      var headerEl = document.getElementById(elementId+'_TABHEADER_'+idx);
      if (headerEl == null)
       return; // tab isn't currently rendered (e.g. t.hide==true) — _status is still recorded above
                // and will be painted next time show() rebuilds the header for this tab.
      if (t._status == null)
       headerEl.removeAttribute('data-tabstatus');
      else
       headerEl.setAttribute('data-tabstatus', t._status);

      if ((status === "success" || status === "failure") && idx == this._currentTabId)
       setTimeout(function() {
         if (t._statusGen === myGen) // nothing else touched this tab's status in the meantime
          self.setTabStatus(idx, null);
       }, 2500);
    }

   /**
    * Updates a tab's header label text/HTML after the fact (e.g. to append a live document
    * count, "All Documents (145)", as filters change) — mirrors setTabStatus() above, but for
    * the label itself rather than the separate busy/success/failure badge.
    *
    * Safe to call at any time, including before the tab has ever been rendered/selected (e.g.
    * right after construction, before show() has run): this._tabs[idx].label is updated either
    * way, so a LATER show()/re-render (which rebuilds every header SPAN from this._tabs[i].label)
    * still picks up the latest value. If the header SPAN already exists in the DOM, it's also
    * updated in place immediately — cheaper than a full show() and it doesn't disturb the
    * sliding-underline indicator (a separate ::after pseudo-element) or any status badge
    * (::before), nor reset which tab is currently selected.
    *
    *   tabIdOrLabel - the tab's numeric index, or its ORIGINAL/CURRENT .label string (same
    *                  resolution rules as setTabStatus() — see _resolveTabIndex() above).
    *   newLabel     - the new label (HTML allowed, same as the "label" tabs-array property
    *                  itself, which is interpolated unescaped when show() first builds the
    *                  header — see the "tabs" jsdoc above).
    */
   this.setTabLabel = function(tabIdOrLabel, newLabel)
    {
      var idx = this._resolveTabIndex(tabIdOrLabel);
      if (idx == null)
       return;
      this._tabs[idx].label = newLabel;
      var headerEl = document.getElementById(elementId+'_TABHEADER_'+idx);
      if (headerEl != null)
       headerEl.innerHTML = newLabel;
    }

   this.select = function(i)
    {
      var self = this; // captured so the setStatus closure passed to onSelectHandler below (a plain
                        // function, not an arrow function) can still reach this FloriaTabs instance
                        // after `this` itself is no longer in scope for it.
      var t = this._tabs[i];
      if (t._renderCount == null)
       t._renderCount = 0;
      var isFirstRender = t._renderCount == 0;

      // Give the target tab a chance to veto the switch (e.g. "you must save this record before doing
      // X") BEFORE touching any visuals — returning exactly `false` from onSelectHandler aborts right
      // here, leaving the previously active tab's CSS/onHideHanler untouched, as if nothing happened.
      // Any other return value (including undefined, the common case for handlers that only render)
      // is treated as "proceed", so this is fully backward-compatible with existing callers.
      if (t.onSelectHandler != null)
       {
         var proceed = true;
         try {
           // Third argument: a setStatus(status) closure pre-bound to THIS tab (via its stable index
           // `i`, not `this._currentTabId` — which is about to be reassigned to `i` a few lines down
           // anyway, but capturing `i` directly here is what makes this correct/safe to stash away
           // and call much later, e.g. from inside an async "Run" action kicked off from this very
           // call). See this function's docs above for the full contract/example.
           proceed = t.onSelectHandler(elementId+'_TABPANEL_'+(this._singleDiv==true?0:i), isFirstRender,
             function(status) { self.setTabStatus(i, status); });
         } catch (e)
         {
           console.error("Exception displaying tab '"+t.label+"': ", e);
         }
         if (proceed === false)
          return;
       }

      // Selecting a tab acknowledges a pending "done" status badge on it — mirrors a browser tab's
      // notification dot clearing the moment you actually switch to that tab. A "busy" status is
      // NOT cleared here, since the work is still in progress regardless of which tab is focused.
      if (t._status == "success" || t._status == "failure")
       this.setTabStatus(i, null);

      if (this._currentTabId != null)
       {
         FloriaDOM.removeCSS(elementId+'_TABHEADER_'+this._currentTabId, "selected");
         FloriaDOM.removeCSS(elementId+'_TABPANEL_'+this._currentTabId, "selected");
         var prevT = this._tabs[this._currentTabId];
         prevT.current = false;
         if (prevT.onHideHanler != null)
          prevT.onHideHanler(elementId+'_TABPANEL_'+this._currentTabId);
       }
      FloriaDOM.addCSS(elementId+'_TABHEADER_'+i, "selected");
      FloriaDOM.addCSS(elementId+'_TABPANEL_'+(this._singleDiv==true?0:i), "selected");

      ++t._renderCount;
      if (t._renderCount == 1)
       document.getElementById(elementId+'_TABPANEL_'+(this._singleDiv==true?0:i)).scrollTop = 0;
      t.current = true;
      this._currentTabId = i;
    }
 };



/**
 * FloriaPromptDialog
 * A self-contained, framework-independent modal <dialog> that asks the user
 * for a single text value and calls a callback when confirmed.
 *
 * @param {string}   title       - Heading shown inside the dialog
 * @param {string}   buttonName  - Label on the confirm button (e.g. "Rename", "Save")
 * @param {Function} onConfirm   - async (value: string) => void
 *                                 Called only when the user confirms with a non-empty value.
 *
 * @example
 *   const dlg = new FloriaPromptDialog('Rename', 'Rename', async (newName) => {
 *     await api.rename(refnum, newName);
 *   });
 *   await dlg.show('Current Name');   // optional pre-filled value
 */
export class FloriaPromptDialog {

  constructor(title, buttonName, onConfirm) {
    this._title      = title;
    this._btnName    = buttonName;
    this._onConfirm  = onConfirm;
    // Stable IDs — unique per instance so multiple dialogs can coexist
    this._uid = 'fpd_' + Math.random().toString(36).slice(2, 9);
  }

  /**
   * Opens the dialog modally.
   * @param  {string} [initialValue=''] - Pre-filled text in the input
   * @returns {Promise<void>}            Resolves when the dialog is closed (either way)
   */
  show(initialValue = '') {
    return new Promise((resolve) => {
      const uid    = this._uid;
      const inputId = uid + '_input';
      const okId    = uid + '_ok';

      const dlg = document.createElement('dialog');
      dlg.id = uid + '_dlg';
      dlg.style.cssText = [
        'border:none',
        'border-radius:12px',
        'padding:0',
        'box-shadow:0 8px 32px rgba(0,0,0,0.18)',
        'min-width:320px',
        'max-width:480px',
        'width:90vw',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        'font-size:14px',
        'color:#1a1f36',
      ].join(';');

      dlg.innerHTML = `
        <form method="dialog" style="margin:0;">
          <div style="padding:20px 20px 16px 20px;">
            <div style="font-weight:600;font-size:15px;margin-bottom:14px;">${_escFpd(this._title)}</div>
            <input id="${inputId}" type="text"
                   value="${_escFpd(initialValue)}"
                   style="width:100%;padding:8px 10px;border:1px solid #d1d5db;
                          border-radius:6px;font-size:14px;box-sizing:border-box;
                          outline:none;transition:border-color 0.15s;"
                   placeholder="…" />
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;
                      padding:12px 20px;border-top:1px solid #f3f4f6;
                      background:#f9fafb;border-radius:0 0 12px 12px;">
            <button value="cancel" type="submit"
                    style="padding:7px 18px;border:1px solid #d1d5db;border-radius:6px;
                           background:#fff;color:#374151;cursor:pointer;font-size:13px;">
              Cancel
            </button>
            <button id="${okId}" type="button"
                    style="padding:7px 18px;border:none;border-radius:6px;
                           background:#4f46e5;color:#fff;cursor:pointer;font-size:13px;
                           font-weight:600;">
              ${_escFpd(this._btnName)}
            </button>
          </div>
        </form>
      `;

      document.body.appendChild(dlg);

      const inp   = dlg.querySelector('#' + inputId);
      const okBtn = dlg.querySelector('#' + okId);

      inp.addEventListener('focus', () => {
        inp.style.borderColor = '#4f46e5';
        inp.style.boxShadow   = '0 0 0 2px rgba(79,70,229,0.15)';
      });
      inp.addEventListener('blur', () => {
        inp.style.borderColor = '#d1d5db';
        inp.style.boxShadow   = 'none';
      });

      const finish = async (confirmed) => {
        const value = inp.value.trim();
        if (confirmed && !value) {
          inp.style.borderColor = '#ef4444';
          inp.style.boxShadow   = '0 0 0 2px rgba(239,68,68,0.15)';
          inp.focus();
          return;
        }
        if (confirmed && this._onConfirm)
         {
           let errorMsg;
           try   { errorMsg = await this._onConfirm(value); }
           catch (err) { console.error('FloriaPromptDialog: onConfirm failed', err); }
           // If onConfirm returns a non-null/non-empty string, treat it as an error message
           // and keep the dialog open so the user can correct the input.
           if (typeof errorMsg === 'string' && errorMsg.length > 0)
            {
              inp.style.borderColor = '#ef4444';
              inp.style.boxShadow   = '0 0 0 2px rgba(239,68,68,0.15)';
              let errEl = dlg.querySelector('#' + uid + '_err');
              if (errEl == null)
               {
                 errEl = document.createElement('div');
                 errEl.id = uid + '_err';
                 errEl.style.cssText = 'color:#ef4444;font-size:12px;margin-top:6px;padding:0 20px 10px 20px;';
                 inp.parentNode.appendChild(errEl);
               }
              errEl.textContent = errorMsg;
              inp.focus();
              return;
            }
         }
        dlg.close();
        dlg.remove();
        resolve();
      };

      okBtn.addEventListener('click', () => finish(true));

      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); finish(true);  }
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });

      // Cancel button submits the <form method="dialog"> natively — catch the close event
      dlg.addEventListener('close', () => {
        if (dlg.returnValue === 'cancel') finish(false);
      });

      dlg.showModal();
      inp.select();
    });
  }
}

// Internal HTML-escape helper (scoped to this module, not exported)
function _escFpd(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


 // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
 // Floria Alert
 // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

 export function FloriaAlert(html, w, h)
  {
    var that = this;
    this._resolvePromise = null;

    // Create or get overlay
    this._overlay = document.getElementById("FLORIA_ALERT_OVERLAY");
    if (this._overlay == null)
     {
       this._overlay = document.createElement('div');
       this._overlay.id = "FLORIA_ALERT_OVERLAY";
       this._overlay.className = "floriaAlertOverlay";
       document.body.appendChild(this._overlay);
     }

    // Create alert box
    this._box = document.createElement('div');
    this._box.className = "floriaAlertBox";
    this._box.innerHTML = '<div class="floriaAlertClose">&times;</div>'
                        + '<div class="floriaAlertContent"></div>';
    this._overlay.appendChild(this._box);

    // Set dimensions - auto-size if not specified
    if (w !== undefined && h !== undefined)
     {
       this._w = w > 0.98 ? 98 : w < 0.1 ? 10 : 100 * w;
       this._h = h > 0.98 ? 98 : h < 0.1 ? 10 : 100 * h;
       this._box.style.width = this._w + "%";
       this._box.style.height = this._h + "%";
     }
    else
     {
       this._box.classList.add('floriaAlertBoxAuto');
     }

    // Set content
    this._box.querySelector('.floriaAlertContent').innerHTML = html;

    // Close handlers
    var closeHandler = function(e) {
      if (e) e.preventDefault();
      that.close();
    };

    this._box.querySelector('.floriaAlertClose').addEventListener('click', closeHandler);
    this._overlay.addEventListener('click', function(e) {
      if (e.target === that._overlay)
       closeHandler(e);
    });

    this._keyHandler = function(e) {
      if (e.key === 'Escape')
       closeHandler(e);
    };

    this.show = function(onButtonClickHandler)
     {
       return new Promise(function(resolve) {
         that._resolvePromise = resolve;
         document.addEventListener('keydown', that._keyHandler);

         // Attach button handlers if callback provided
         if (onButtonClickHandler)
          {
            var buttons = that._box.querySelectorAll('button');
            buttons.forEach(function(btn) {
              btn.addEventListener('click', function(e) {
                if (onButtonClickHandler(e, btn) == true)
                 that.close();
              });
            });
          }

         setTimeout(function() {
           that._overlay.classList.add('show');
           that._box.classList.add('show');
         }, 10);
       });
     };

    this.close = function()
     {
       that._overlay.classList.remove('show');
       that._box.classList.remove('show');
       setTimeout(function() {
         if (that._box && that._box.parentNode)
          that._box.parentNode.removeChild(that._box);
         if (document.querySelectorAll('.floriaAlertBox').length === 0 && that._overlay && that._overlay.parentNode)
          that._overlay.parentNode.removeChild(that._overlay);
         document.removeEventListener('keydown', that._keyHandler);
         if (that._resolvePromise)
          that._resolvePromise();
       }, 300);
     };
  };


 // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
 // Floria Alert Simple
 // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * FloriaAlertSimple
 * A quick Yes/No confirmation dialog — a specific instantiation of the baseline FloriaAlert
 * (see above), for whenever the app needs an "are you sure?"-style confirmation instead of
 * the native, browser-styled confirm().
 *
 * @param {string}   message  - The question/warning to show the user (HTML allowed)
 * @param {string}   yesLabel - Label for the confirming button (e.g. "Delete", "Yes")
 * @param {string}   noLabel  - Label for the dismissing button (e.g. "Cancel", "No")
 * @param {Function} onYes    - Called only when the user clicks the "yes" button.
 *
 * @example
 *   new FloriaAlertSimple('Delete this rule? This cannot be undone.', 'Delete', 'Cancel', () => {
 *     doTheDelete();
 *   }).show();
 */
 export function FloriaAlertSimple(message, subMessage, yesLabel, noLabel, onYes)
  {
    // Stable ids — unique per instance so multiple confirmations can coexist (FloriaAlert
    // itself supports several concurrently-visible '.floriaAlertBox' instances sharing one
    // overlay — see FloriaAlert.close() above).
    var uid   = 'fas_' + Math.random().toString(36).slice(2, 9);
    var yesId = uid + '_yes';
    var noId  = uid + '_no';

    // By convention, dialog buttons in this app use the "buttonLogin smallerBlue" classes
    // (see module-tours.js's doAlert() for the reference usage this was modeled after).
    var html = `<DIV class="floriaAlertSimpleMessage">${message}</DIV>
                ${subMessage==null?'':'<DIV class="floriaAlertSimpleSubMessage">'+subMessage+'</DIV>'}
                <BR><BR>
                <CENTER style="white-space: nowrap;">
                  <BUTTON id="${yesId}" class="buttonLogin smallerBlue" style="display:inline-block;width:7em;">${yesLabel || 'Yes'}</BUTTON>
                  &nbsp;&nbsp
                  <BUTTON id="${noId}" class="buttonLogin smallerBlue" style="display:inline-block;width:7em;">${noLabel  || 'No' }</BUTTON>
                </CENTER>
               `;
             

    var alert = new FloriaAlert(html);

    /** Opens the dialog modally. @returns {Promise<void>} resolves once the dialog is closed (either way). */
    this.show = function()
     {
       return alert.show(function(e, btn)
        {
          if (btn.id === yesId && typeof onYes === 'function')
           onYes();
          return true; // Yes or No, either choice closes the dialog
        });
     };

    this.close = function() { alert.close(); };
  };


 // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
 // Floria Toast
 // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * FloriaToast
 * A small, non-blocking, self-dismissing notification — the "toast" counterpart to FloriaAlert's
 * modal box. Mirrors this app's existing component conventions (see FloriaTooltipDialog/FloriaAlert
 * just above): a plain constructor function, a lazily-created shared host element appended to
 * document.body on first use (one stack per corner, like FloriaDialog's single "FLORIA_DLG_BG"),
 * and a small imperative API (show()/hide()) rather than a class, for consistency with the rest of
 * this file.
 *
 * Unlike FloriaAlert, a toast is NEVER modal: there is no overlay, the page underneath stays fully
 * interactive, and several toasts can be visible/stacked at once (newest at the bottom of its
 * corner's stack — see module-dialog.css's ".floriaToastHost" flex layout). Each toast auto-dismisses
 * after `duration` ms unless `duration` is 0/false, in which case it stays until the user dismisses
 * it (via the "×") or the caller calls hide() themselves — useful for an action-bearing toast the
 * user is expected to actually click (e.g. "Top Up").
 *
 * @param {string} message   - HTML allowed. The toast's body content.
 * @param {Object} [opts]
 * @param {string} [opts.type]      - "info" (default) | "success" | "warning" | "error" — only
 *                                    changes the accent color/icon (".floriaToast--<type>").
 * @param {number} [opts.duration]  - Auto-dismiss delay in ms (default 5000). Pass 0 or false to
 *                                    require an explicit dismissal (close button or hide()).
 * @param {string} [opts.corner]   - Which screen corner to stack in: "top-right" (default),
 *                                    "top-left", "bottom-right", "bottom-left".
 * @param {Array}  [opts.actions]  - Optional array of { label, onClick } — rendered as small buttons;
 *                                    onClick receives no arguments, and the toast is dismissed right
 *                                    after (return false from onClick to keep it open instead).
 *
 * @example
 *   new FloriaToast('Saved successfully.', { type: 'success' }).show();
 *
 *   new FloriaToast('You are running low on credits.', {
 *     type: 'warning', duration: 0,
 *     actions: [ { label: 'Top Up', onClick: () => FloriaLogin.PopupLogin.topUpCredits(productId) } ]
 *   }).show();
 */
export function FloriaToast(message, opts)
 {
   var that = this;
   opts = opts || {};
   this._type     = opts.type || 'info';
   this._duration = opts.duration === 0 || opts.duration === false ? 0 : (opts.duration || 5000);
   this._corner   = opts.corner || 'top-right';
   this._actions  = opts.actions || null;

   // One shared host <div> per corner, appended once to document.body — successive toasts in the
   // same corner simply append into it, exactly like FloriaDialog's single shared "FLORIA_DLG_BG".
   var hostId = "FLORIA_TOAST_HOST_" + this._corner;
   this._host = document.getElementById(hostId);
   if (this._host == null)
    {
      this._host = document.createElement('div');
      this._host.id = hostId;
      this._host.className = "floriaToastHost floriaToastHost--" + this._corner;
      document.body.appendChild(this._host);
    }

   this._el = document.createElement('div');
   this._el.className = "floriaToast floriaToast--" + this._type;
   this._el.innerHTML =
       '<div class="floriaToastIcon"></div>'
     + '<div class="floriaToastBody">' + message + '</div>'
     + (this._actions == null ? '' : '<div class="floriaToastActions">'
         + this._actions.map(function(a, i) { return '<button type="button" class="floriaToastAction" data-idx="' + i + '">' + a.label + '</button>'; }).join('')
         + '</div>')
     + '<div class="floriaToastClose" title="Dismiss">&times;</div>';

   this._el.querySelector('.floriaToastClose').addEventListener('click', function() { that.hide(); });
   if (this._actions != null)
    this._el.querySelectorAll('.floriaToastAction').forEach(function(btn)
     {
       btn.addEventListener('click', function()
        {
          var action = that._actions[1 * btn.dataset.idx];
          var keepOpen = action != null && action.onClick != null ? action.onClick() : undefined;
          if (keepOpen !== false)
           that.hide();
        });
     });

   this.show = function()
    {
      that._host.appendChild(that._el);
      setTimeout(function() { that._el.classList.add('show'); }, 10);
      if (that._duration > 0)
       that._hideTimer = setTimeout(function() { that.hide(); }, that._duration);
      return that;
    };

   this.hide = function()
    {
      if (that._hideTimer != null)
       { clearTimeout(that._hideTimer); that._hideTimer = null; }
      that._el.classList.remove('show');
      setTimeout(function()
       {
         if (that._el.parentNode != null)
          that._el.parentNode.removeChild(that._el);
       }, 300); // matches module-dialog.css's .floriaToast transition duration
    };
 };


