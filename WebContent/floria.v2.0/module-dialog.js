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


// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Floria Dialog
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var __DIALOGS = [];
var __hiding = false; // global flag to manage overlapping dialog functionality, e.g., hiding one while showing another

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
   FloriaDOM.addEvent(elementId+"_MD_CLOSE", "click", function() {
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
      window.FloriaTours?.enablePopupDialog(t);
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
      
      window.FloriaTours?.disablePopupDialog();

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
          ,{ name: 'preventOverflow'
            ,options: {
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
         FloriaDOM.addEvent(that._tt, "mouseleave", function(e, event, target) { setTimeout(function(){that.hide(event);},250); }, null, true);
//         FloriaDOM.addEvent(that._tt, "click"     , function(e, event, target) { setTimeout(function(){that.hide(event);},250); }, null, true);
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
 tabs ia an array:
    { label:"", descr:"", hide:true|false, onHideHanler: function, onSelectHandler: function }
 */
export function FloriaTabs(elementId, tabs, singleDiv, managingFunc, trashcan)
 {
   this._elementId = elementId;
   this._tabs = tabs;
   this._currentTabId = null;
   this._singleDiv = singleDiv || false;
   
   this.show = function(defaultTabId = 0)
    {
      var str = '<DIV class="tabContainer"><DIV id="'+elementId+'_TABHEADERS" class="tabHeader">';
      for (var i = 0; i < this._tabs.length; ++i)
       {
         var t = this._tabs[i];
         if (t.hide == true)
          continue;
         str+='<SPAN id="'+elementId+'_TABHEADER_'+i+'" data-tabid="'+i+'" data-contextTarget="1" title="'+(t.descr==null?"":t.descr.printHtmlAttrValue())+'">'+t.label+'</SPAN>';
       }
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
        that.select(tabId);
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
    
   this.select = function(i)
    {
      if (this._currentTabId != null)
       {
         FloriaDOM.removeCSS(elementId+'_TABHEADER_'+this._currentTabId, "selected");
         FloriaDOM.removeCSS(elementId+'_TABPANEL_'+this._currentTabId, "selected");
         var t = this._tabs[this._currentTabId];
         t.current = false;
         if (t.onHideHanler != null)
          t.onHideHanler(elementId+'_TABPANEL_'+this._currentTabId);
       }
      FloriaDOM.addCSS(elementId+'_TABHEADER_'+i, "selected");
      FloriaDOM.addCSS(elementId+'_TABPANEL_'+(this._singleDiv==true?0:i), "selected");
      var t = this._tabs[i];
       if (t._renderCount == null)
           t._renderCount = 0;
    
      ++t._renderCount;
      if (t._renderCount == 1)
       document.getElementById(elementId+'_TABPANEL_'+(this._singleDiv==true?0:i)).scrollTop = 0;
      if (t.onSelectHandler != null)
       {
         try {
           t.onSelectHandler(elementId+'_TABPANEL_'+(this._singleDiv==true?0:i), t._renderCount==1);
         } catch (e)
         {
           console.error("Exception displaying tab '"+t.label+"': ", e);
         }
       }
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



