/* ===========================================================================
 * Copyright (C) 2024 CapsicoHealth Inc.
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

import { FloriaDOM      } from "./module-dom.js";
import { FloriaDialog, FloriaTabs } from "./module-dialog.js";
import { FloriaAjax     } from "./module-ajax.js";
import { FloriaDate     } from "./module-date.js";
import { FloriaText     } from "./module-text.js";
import { FloriaControls } from "./module-controls.js";

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Date extensions
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export var FloriaPayments = { };


FloriaPayments.PayPalSDK = {
  _loadedCurrency: null,
  _loading: null,
  /**
   * Kicks off the DNS lookup + TLS handshake to PayPal's CDN ahead of time, so that time is spent in parallel
   * with whatever else is happening (e.g. the server round-trip to fetch the provider's clientId) rather than
   * being added on top of it once we actually know the clientId and request the SDK script itself. Safe to call
   * as early and as often as convenient: idempotent, and a no-op after the first call.
   */
  preconnect() {
    if (document.querySelector('link[data-paypal-preconnect]'))
     return;
    for (const rel of ['preconnect', 'dns-prefetch']) {
      const l = document.createElement('link');
      l.rel = rel;
      l.href = 'https://www.paypal.com';
      l.crossOrigin = 'anonymous';
      l.dataset.paypalPreconnect = '1';
      document.head.appendChild(l);
    }
  },
  load(clientId, currency="USD") {
    if (window.paypal && this._loadedCurrency === currency)
     return Promise.resolve(window.paypal);
    if (this._loading) 
     return this._loading;

    // Remove prior script if different currency
    const old = document.querySelector('script[data-paypal-sdk]');
    if (old)
     old.remove();
    delete window.paypal;

    this._loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://www.paypal.com/sdk/js?client-id="+encodeURIComponent(clientId)+"&intent=capture&currency=" + encodeURIComponent(currency);
      s.async = true;
      s.dataset.paypalSdk = "1";
      s.onload = () => {
        this._loadedCurrency = currency;
        resolve(window.paypal);
        this._loading = null;
      };
      s.onerror = () => {
        reject(new Error("PayPal SDK load failed"));
        this._loading = null;
      };
      document.head.appendChild(s);
    });
    return this._loading;
  },
  /**
   * @param onComplete optional. When supplied, it is called with the capture response instead of reloading the
   *        page. This matters for mid-workflow top-ups: the user is topping up precisely because they were in
   *        the middle of something, and reloading would throw away the results they just got back.
   * @return the underlying {@code paypal.Buttons(...).render(...)} promise, which resolves once the buttons are
   *         actually painted into the DOM (NOT just once the SDK script has loaded). Callers use this to know
   *         exactly when it's safe to swap out a "loading" placeholder for the real buttons -- see the Cart
   *         Summary rendering in {@link FloriaPayments.PlansDialog#paintPlans} for the pattern. Errors (SDK
   *         failing to load, or the render itself failing) are left to reject rather than being swallowed here,
   *         so callers can show their own inline error UI instead of a jarring alert().
   */
  initButtons: async function (buttonId, clientId, planCode, period, currency='USD', onComplete=null) {
    // Load (or reload) the SDK for the selected currency.
    const paypal = await FloriaPayments.PayPalSDK.load(clientId, currency);

    return paypal.Buttons({
      style: { layout: 'vertical', label: 'paypal' },

      createOrder: function() {
        return FloriaAjax.ajaxUrlAsync('/web/svc/payments/order/create', 'POST', 'Cannot create order', null, null, {
           paymentProvider: 'paypal'
          ,planCode: planCode
          ,cycle: period
          ,currency: currency
        }).then(data => data.orderId);
      },

      onApprove: function(data) {
        return FloriaAjax.ajaxUrlAsync('/web/svc/payments/order/capture', 'POST', 'Cannot capture payment', null, null, {
           paymentProvider: 'paypal'
          ,orderId: data.orderID
          // Required: pre-orders are keyed by (user, product) server-side, so the capture step needs the
          // planCode to know which product's pending order it is completing.
          ,planCode: planCode
        }).then(resp => {
          if (resp?.completed == true) {
            if (typeof onComplete === 'function')
             return onComplete(resp);
            alert('Payment successful. Plan activated.');
            window.location.reload();
          } else {
            alert('Payment not completed: ' + resp?.message);
          }
        }).catch(e => {
          console.error(e);
          alert('Capture failed.');
        });
      },

      onCancel: () => alert('Payment cancelled.'),
      onError:  err => {
        console.error(err);
        alert('PayPal error.');
      }
    }).render('#'+buttonId);
  }
};


/**
 * The "Plans / Billing" and "Top Up Your Credits" popups: fetches the eligible catalog from
 * {@code /svc/user/plan/status}, paints the pricing table (with a synced currency selector per priced plan),
 * the Cart Summary + PayPal checkout, and the Billing History tab.
 * <P>
 * Owns its own {@link FloriaDialog} instance rather than sharing the sign-in/EULA/help dialog: this is rarely
 * used code (sign-up, upgrade, top-up), cheap to give its own modal, and it decouples the payments module from
 * having to reach into FloriaLogin's dialog plumbing.
 * <P>
 * {@code basePath} is passed in by the caller (see {@code FloriaLogin.PopupLogin.pickPlan}/{@code topUpCredits},
 * which forward {@code FloriaLogin.Account.basePath}) rather than read off another module's namespace, so this
 * module has no compile-time dependency on module-login.js.
 */
FloriaPayments.PlansDialog = {
  dlgHandle: null,

  pickPlan: function(basePath, genericPlanOnly=false)
   {
      if (FloriaPayments.PlansDialog.dlgHandle == null)
       FloriaPayments.PlansDialog.dlgHandle = new FloriaDialog("DLG_POPUP_PAYMENTS");
      FloriaPayments.PlansDialog.dlgHandle.show("Plans / Billing", null, 0.75, 0.9, function(cntId) {
         document.getElementById(cntId).innerHTML = '<BR><BR><BR><CENTER><IMG src="/static/img/progress.gif" height="60px"></CENTER>';
         FloriaAjax.ajaxUrl("/"+basePath+"/svc/user/plan/status", "GET", null, function(data) {
           if (data == null || data.plans == null || data.plans.length == 0)
            {
              document.getElementById(cntId).innerHTML = '<BR><BR><BR><CENTER><IMG src="/static/img/warning.gif" height="60px"><BR>You are currently on a free unlimited plan. There is nothing else for you to do at this time.</CENTER>';
              return;
            }
           if (genericPlanOnly == true)
            return FloriaPayments.PlansDialog.paintPlans(basePath, cntId, data.plans, data.billingCurrent==true?data.billingHistory[0]:null, genericPlanOnly);                

           let tabs = [ {label:"Billing History", onSelectHandler:function(cntId, firstRender) {
                            if (firstRender != true)
                             return;
                            FloriaPayments.PlansDialog.paintBillingHistory(cntId, data.billingHistory);
                        }}
                       ,{label:"Plans", onSelectHandler:function(cntId, firstRender) {
                            if (firstRender != true)
                             return;
                            FloriaPayments.PlansDialog.paintPlans(basePath, cntId, data.plans, data.billingCurrent==true?data.billingHistory[0]:null);
                        }}
                    ];
           let tabControl = new FloriaTabs(cntId, tabs);
           tabControl.show(data.billingCurrent==true?0:1);
         }, function(code, msg, errors) {
           document.getElementById(cntId).innerHTML = '<BR><BR><BR><CENTER><IMG src="/static/img/warning.gif" height="60px"><BR>An error occurred when retrieving elligible plans.</CENTER><BR><BR>'+msg;
         });
      });
   },
  /**
   * Opens the credit top-up popup for a product, reusing the whole plan-picking + PayPal infrastructure.
   * <P>
   * This is what an application front-end calls when its own service returned the app-level
   * "INSUFFICIENT_CREDITS" code (see CreditHelper on the server side), either because the user was already in
   * the red before the operation started, or because the operation just took them there.
   *
   * @param productId the paymentSystemProductId of the metered product, e.g. "CAPSICO-AGENTIC-01"
   * @param onComplete optional callback invoked after a successful top-up. Supply one to resume whatever the
   *        user was doing; without it the page reloads, which would discard any results already on screen.
   */
  topUpCredits: function(basePath, productId, onComplete)
   {
      if (FloriaPayments.PlansDialog.dlgHandle == null)
       FloriaPayments.PlansDialog.dlgHandle = new FloriaDialog("DLG_POPUP_PAYMENTS");
      FloriaPayments.PlansDialog.dlgHandle.show("Top Up Your Credits", null, 0.75, 0.9, function(cntId) {
         document.getElementById(cntId).innerHTML = '<BR><BR><BR><CENTER><IMG src="/static/img/progress.gif" height="60px"></CENTER>';
         // productId filters the catalog down to just this product's packs: the user is topping up, not
         // shopping the whole catalog.
         FloriaAjax.ajaxUrl("/"+basePath+"/svc/user/plan/status?productId="+encodeURIComponent(productId), "GET", null, function(data) {
           if (data == null || data.plans == null || data.plans.length == 0)
            {
              document.getElementById(cntId).innerHTML = '<BR><BR><BR><CENTER><IMG src="/static/img/warning.gif" height="60px"><BR>No credit packs are available on your account. Please contact us.</CENTER>';
              return;
            }
           // creditStatus rides along on the same call when a productId is supplied, so no second round trip.
           let bal = data.creditStatus;
           // balance arrives as a BigDecimal-backed JSON string (e.g. "500.0000"): Number(...) both parses it
           // and drops the credits-are-always-whole-units trailing decimals before formatting.
           let balNum = bal == null ? 0 : Math.round(Number(bal.balance) || 0);
           let banner = bal == null ? ''
                      : '<CENTER><DIV style="padding:10px;">Your current balance is <B>'+balNum.toLocaleString()+'</B> credits.'
                        +(balNum < 0 ? '<BR>You have used more credits than you purchased. Please top up to continue.' : '')
                        +'</DIV></CENTER>';
           FloriaPayments.PlansDialog.paintPlans(basePath, cntId, data.plans, null, false, function(captureData) {
              FloriaPayments.PlansDialog.dlgHandle.hide();
              if (typeof onComplete === 'function')
               return onComplete(captureData);
              window.location.reload();
           }, banner);
         }, function(code, msg, errors) {
           document.getElementById(cntId).innerHTML = '<BR><BR><BR><CENTER><IMG src="/static/img/warning.gif" height="60px"><BR>An error occurred when retrieving credit packs.</CENTER><BR><BR>'+msg;
         });
      });
   },
  paintPlans: function(basePath, cntId, plans, billingCurrent, genericPlanOnly=false, onComplete=null, banner=null)
   {
     let spacing = '<TD>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</TD>';
     let str = (banner != null ? banner : '')
                +'<TABLE class="planLayout">\n'
                +'<colgroup>'
                  +'<col class="blue-light" width="30%" /><col/>'
                  +'<col class="orange-light" width="30%" /><col/>'
                  +(plans.length==3 ? '<col class="green-light" width="30%" /><col/>'
                                   : '')
                  +'</colgroup>'
              +'<TR>'
              ;
     for (let i = 0; i < plans.length; ++i)
      {
        let p = plans[i].plan;
        if (i > 0)
         str+=spacing;
        str+='<TD class="planLabel">'+p.label+'</TD>'
      }
     str+='</TR><TR>\n';
     let contactUs = null;
     for (let i = 0; i < plans.length; ++i)
      {
        let p = plans[i].plan;
        if (i > 0)
         str+=spacing;
        str+= '<TD class="planFeatures"><DIV>Features</DIV><UL>';
        for (let j = 0; j < p.descr.length; ++j)
         {
           if (p.descr[j].startsWith("Contact us at") == true)
            contactUs = p.descr[j];
           else
            str+='<LI>'+p.descr[j]+'</LI>\n'
         }
        str+='</UL></TD>'
      }
     str+='</TR>\n';
     let defaultCurr = 'USD';
     
     window.pricingSelect = function(planCode, period, currency, amount)
      {
        let str = '';
        for (let i = 0; i < plans.length; ++i)
         {
           if (plans[i].plan.code == planCode)
            {
              let p = plans[i];
              let pr = p.pricings.getSE(currency, 'currency');
              if (pr == null)
               {
                 alert("An error occurred: cannot find pricing for " + currency);
                 FloriaPayments.PlansDialog.paintPlans(basePath, cntId, plans, billingCurrent, genericPlanOnly, onComplete, banner);
                 return false;
               }
              // Credit packs (planType "C") are one-time pre-paid purchases: there is no billing period, no
              // renewal and no expiry. They use "oneTime" pricing instead of "monthly"/"yearly", and buying
              // again simply tops the wallet back up.
              let isCredits = p.plan.planType == 'C';
              amount = isCredits ? pr.oneTime : period == 'M' ? pr.monthly : pr.yearly;
              let nextBillingDt = new Date();
              nextBillingDt.addMonths(p.discountPct==100 ? p.discountMonths : period=='M'?1:12);
              let cartRows = isCredits
                ? `<TR valign="top"><TD class="fieldName">Pack</TD><TD>${p.plan.label}</TD></TR>
                   <TR valign="top"><TD class="fieldName">Credits</TD><TD>${Math.round(Number(pr.oneTimeCredits)||0).toLocaleString()} credits${pr.oneTimeDesc ? '<BR><BLOCKQUOTE style="font-size: 90%; color: grey;">'+pr.oneTimeDesc+'</BLOCKQUOTE>' : ''}</TD></TR>
                   ${p.initialCredits ? `<TR valign="top"><TD class="fieldName">Bonus</TD><TD style="color:#2a7a2a; font-weight:bold;">+${Math.round(Number(p.initialCredits)||0).toLocaleString()} bonus credits (first purchase only)</TD></TR>` : ''}
                   <TR valign="top"><TD class="fieldName">Total Today</TD><TD>${currency} ${FloriaText.printWith2Dec(amount)}</TD></TR>
                   <TR valign="top"><TD colspan="2">One-time purchase. Your credits are added to your balance and never expire.<BR>There is no subscription and nothing to cancel.</TD></TR>`
                : `<TR valign="top"><TD class="fieldName">Plan</TD><TD>${p.plan.label}</TD></TR>
                   <TR valign="top"><TD class="fieldName">Amount</TD><TD>${currency} ${FloriaText.printWith2Dec(amount)} billed ${p.autoRenew=true?'once only' : period == 'M' ? 'monthly' : 'yearly'}<BR>
                      <BLOCKQUOTE style="font-size: 90%; color: grey;">
                        ${p.discountMonths <= 0 || p.discountPct <= 0 ? ''
                          : (p.discountMonths==1? "First month" : "First "+p.discountMonths+" months")
                           +(p.discountPct==100? " free/trial!" : " at "+p.discountPct+"% off")
                         }
                   </TD></TR>
                   <TR valign="top"><TD class="fieldName">Total Today</TD><TD>${p.discountPct==100 ? 'Nothing' : currency+" "+FloriaText.printWith2Dec((p.discountPct||100)*amount/100.0)}</TD></TR>
                   <TR valign="top">${p.autoRenew == true ?
                                       `<TD class="fieldName">Next Billing</TD>${currency} ${FloriaText.printWith2Dec(amount)} on ${nextBillingDt.printFriendly(true)}</TD>`
                                      :'<TD colspan="2">Your subscription expires on '+nextBillingDt.printFriendly(true)+'<BR>You will need to renew manually.</TD>'
                                     }
                   </TD></TR>`;
              str=`<TABLE width="90%" align="center">
                   <TR valign="top"><TD width="50%">
                       <H1 align="center">Cart Summary</H2>
                       <TABLE border="0px" cellspacing="0px" cellpadding="10px" align="center">
                         ${cartRows}
                       </TABLE>
                       <BR>
                       <BR>
                       <CENTER><BUTTON id="${cntId}_CANCEL" class="buttonLogin inForm" style="font-size:100%; padding: 5px 25px; background-color:#68C;">Cancel</BUTTON></CENTER>
                   </TD>
                   <TD align="center"><BR><BR><BR><BR><div id="${cntId}_PAY" style="max-width:360px;">
                       <div id="${cntId}_PAY_SPINNER"><CENTER><IMG src="/static/img/progress.gif" height="60px"><BR><SPAN style="font-size:85%; color:grey;">Loading payment options&hellip;</SPAN></CENTER></div>
                       <div id="${cntId}_PAY_BUTTONS"></div>
                   </div></TD>
                   <TD>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</TD>
                   </TR></TABLE>
                  `;
              break;
            }
         }
        if (str == '')
         {
           alert("An error occurred: cannot find plan " + planCode);
           FloriaPayments.PlansDialog.paintPlans(basePath, cntId, plans, billingCurrent, genericPlanOnly, onComplete, banner);
         }
        else
         {
           document.getElementById(cntId).innerHTML = str;
           FloriaDOM.addEvent(cntId+"_CANCEL", "click", function() {
             FloriaPayments.PlansDialog.paintPlans(basePath, cntId, plans, billingCurrent, genericPlanOnly, onComplete, banner);
           });
           // Kick the SDK domain's DNS/TLS off right away, in parallel with the provider-details round-trip
           // below, rather than only starting it once we know the clientId: that overlap is pure savings since
           // neither depends on the other.
           FloriaPayments.PayPalSDK.preconnect();
           FloriaAjax.ajaxUrl("/"+basePath+"/svc/payments/provider/details?paymentProvider=paypal", "GET", "Cannot get payment provider details", function(data) {
               if (data == null || data.clientId == null)
                return document.getElementById(cntId+"_PAY").innerHTML = '<CENTER><IMG src="/static/img/warning.gif" height="60px"><BR>No PayPal configuration<BR></CENTER>';
               // Deliberately do NOT clear #_PAY here: the PayPal SDK APPENDS its buttons/iframe into whatever
               // container you hand it rather than replacing that container's content, so rendering straight
               // into a div that still holds the spinner would just stack the two on top of each other instead
               // of swapping one for the other. Instead, the spinner and the (still-empty) render target are
               // separate sibling divs: PayPal only ever touches #_PAY_BUTTONS, and the spinner is removed once
               // (and only once) the buttons have actually finished painting.
               FloriaPayments.PayPalSDK.initButtons(cntId+"_PAY_BUTTONS", data.clientId, planCode, period, currency, onComplete)
                 .then(() => {
                    let spinner = document.getElementById(cntId+"_PAY_SPINNER");
                    if (spinner != null)
                     spinner.remove();
                 })
                 .catch(e => {
                    console.error(e);
                    let payDiv = document.getElementById(cntId+"_PAY");
                    if (payDiv != null)
                     payDiv.innerHTML = '<CENTER><IMG src="/static/img/warning.gif" height="60px"><BR>Unable to load PayPal.<BR></CENTER>';
                 });
           }, function(code, msg, errors) {
               document.getElementById(cntId+"_PAY").innerHTML = '<CENTER><IMG src="/static/img/warning.gif" height="60px"><BR>No PayPal configuration<BR></CENTER>';
           });
         }
        return false;
     }
     
     let paintPrices = function()
      {
         let tag = genericPlanOnly==true?'AAA':'A';
         for (let i = 0; i < plans.length; ++i)
          {
            let pricing = null;
            let str='<TABLE style="width:90%; margin-left: 7.5%;">';
            for (let j = 0; j < plans[i].pricings.length; ++j)
             {
               let pr = plans[i].pricings[j];
               if (pr.currency != defaultCurr)
                continue;
               pricing = pr;
               if (plans[i].plan.planType == 'C')
                {
                  // Credit pack: a single one-time price, no monthly/yearly choice. Cycle 'O' server-side.
                  str+=`<TR><TD>&bull;</TD>
                            <TD>One-time:</TD>
                            <TD width="1" nowrap align="right">
                              <${tag} href="javascript:pricingSelect('${plans[i].plan.code}', 'O','${pr.currency}', ${pr.oneTime})">${pr.currency} ${FloriaText.printWith2Dec(pr.oneTime)}</${tag}>
                            </TD>
                        </TR>
                        <TR><TD></TD><TD colspan="2">${Math.round(Number(pr.oneTimeCredits)||0).toLocaleString()} credits${pr.oneTimeDesc ? '<BR>'+pr.oneTimeDesc : ''}</TD></TR>
                       `;
                }
               else
                {
               str+=`<TR><TD>&bull;</TD>
                         <TD>Monthly:</TD>
                         <TD width="1" nowrap align="right">
                           <${tag} href="javascript:pricingSelect('${plans[i].plan.code}', 'M','${pr.currency}', ${pr.monthly})">${pr.currency} ${FloriaText.printWith2Dec(pr.monthly)}</${tag}>
                         </TD>
                     </TR>
                     <TR><TD>&bull;</TD>
                         <TD>Yearly:</TD>
                         <TD width="1" nowrap align="right">
                           <${tag} href="javascript:pricingSelect('${plans[i].plan.code}', 'Y','${pr.currency}', ${pr.yearly})">${pr.currency} ${FloriaText.printWith2Dec(pr.yearly)}</${tag}>
                         </TD>
                     </TR>
                     <TR><TD></TD><TD colspan="2">${pr.yearlyDesc}</TD></TR>
                    `;
                }
                if (genericPlanOnly == true)
                 {
                   str+='<TR><TD colspan="3" style="font-size:85%;font-style:italic;"><BR>Additional discounts may be available at the time of registration.</TD></TR>';
                 }
             }
            if (pricing == null)
              str+='<TR><TD>&bull;</TD><TD>'+(contactUs!=null?contactUs:'Contact us for pricing.')+'</TD></TR>\n';
            str+='</TABLE><BR>\n';
            document.getElementById(cntId+"_CURR_"+i).innerHTML = str;
            
            let discountMonths = plans[i].discountMonths;
            let discountPct = plans[i].discountPct;
            let discountPctYear = plans[i].discountPctYear;
            let initialCredits = plans[i].initialCredits;
            let e = document.getElementById(cntId+"_DISC_"+i);
            // Credit packs have no monthly rate to discount from, but may instead carry a one-time promo
            // signup bonus (Promo.initialCredits granted alongside the pack's own credits, first purchase only).
            if (plans[i].plan.planType == 'C')
             {
               if (initialCredits > 0)
                {
                  e.innerHTML = 'New customer bonus: +'+Math.round(Number(initialCredits)||0).toLocaleString()+' credits on your first purchase!';
                  e.parentNode.classList.add("planDiscount");
                }
               else
                {
                  e.style.display="none";
                  e.parentNode.classList.remove("planDiscount");
                }
             }
            // Promo discounts are expressed in months/years and only apply to subscription plans.
            else if (discountMonths > 0 && discountPct > 0)
             {
               let pricing = null;
               for (let j = 0; j < plans[i].pricings.length; ++j)
                {
                  let pr = plans[i].pricings[j];
                  if (pr.currency != defaultCurr)
                   continue;
                  pricing = pr;
                }
               if (pricing != null)
                {
                  let actualPrice = (100-discountPct)*pricing.monthly/100.0;
                  str = (discountMonths==1? "First month" : "First "+discountMonths+" months")
                       +(discountPct==100? " free!" : " at "+discountPct+"% off (pay "+defaultCurr+" "+FloriaText.printWith2Dec(actualPrice)+")")
                       +'<BR>\n'
                       ;
                  if (discountPctYear != null)
                   {
                     actualPrice = (100-discountPctYear)*pricing.yearly/100.0;
                     str +="First year"
                          +(discountPctYear==100? " free!" : " at "+discountPctYear+"% off (pay "+defaultCurr+" "+FloriaText.printWith2Dec(actualPrice)+")")
                          +'<BR>\n'
                          ;
                   }
                  e.innerHTML = str;
                  e.parentNode.classList.add("planDiscount");
                }
               else
                {
                  e.style.display="none";
                  e.parentNode.classList.remove("planDiscount");
                }
             }
            str+='</BR>';
          }
      }
     
     str+='<TR>';
     for (let i = 0; i < plans.length; ++i)
      {
        if (i > 0)
         str+=spacing;
        // Only plans that actually have a purchasable price need a currency selector. Contact-us plans
        // (planType "X", e.g. Enterprise) have no pricing at all, just a "contact us" message, so they never
        // get one. This must be driven off the plan's own planType rather than its column position: earlier
        // this was hardcoded to the first two columns only, on the assumption that the 3rd/last column was
        // always a contact-us Enterprise tier -- which broke as soon as a 3-tier, all-priced product (e.g. the
        // Agentic credit packs) came along.
        let needsCurrency = plans[i].plan.planType != 'X';
        str+= '<TD class="planPricing"><DIV>Pricing'+(needsCurrency?'<DIV id="'+cntId+'_CURR'+i+'" class="currency"></DIV>':'')
                     +'</DIV><DIV id="'+cntId+'_CURR_'+i+'"></DIV></TD>';
         }
     str+='</TR>\n';
     
     str+='<TR>';
     for (let i = 0; i < plans.length; ++i)
      {
        if (i > 0)
         str+=spacing;
        str+= '<TD class=""><DIV id="'+cntId+'_DISC_'+i+'"></DIV></TD>';
      }
     str+='</TR>\n';

     str+='</TABLE><BR><BR>';
     document.getElementById(cntId).innerHTML = str;
     paintPrices(genericPlanOnly);
     
     let currencies = [["USD", '<img src="/static/img/flags/us.jpg"> US Dollars'   , 'US Dollars']
                      ,["EUR", '<img src="/static/img/flags/eu.jpg"> Euros'        , 'Euros']
                      ,["INR", '<img src="/static/img/flags/in.jpg"> Indian Rupees', 'Indian Rupees']
                      ];
     // One synced currency selector per priced plan (see needsCurrency above), rather than a hardcoded pair:
     // whichever one the user changes pushes the new currency to every other selector and repaints all columns.
     let currencyCombos = [];
     for (let i = 0; i < plans.length; ++i)
      {
        if (plans[i].plan.planType == 'X')
         continue;
        let combo = new FloriaControls.ComboBox(cntId+"_CURR"+i, cntId+"_curr"+i, currencies, null, "USD", function(e, v) {
           defaultCurr = v;
           paintPrices(genericPlanOnly);
           for (let c of currencyCombos)
            if (c !== combo)
             c.setValue(v);
        }, true);
        currencyCombos.push(combo);
      }
   },
  paintBillingHistory: function(cntId, billingHistory)
   {
     let str = `<BR>
                <TABLE class="tableLayout stickyHeader" style="width:80%;" align="center">
                  <TR><TH align="left">Plan</TH>
                      <TH align="left">Subscription</TH>
                      <TH align="left">Dates</TH>
                      <TH align="right">Amount</TH>
                  </TR>
               `;
     for (let i = 0; i < billingHistory.length; ++i)
      {
        let b = billingHistory[i];
        if (b == null)
         continue;
        let orderDt = FloriaDate.parseDateTime(b.billingOrderDt);
        orderDt = orderDt == null ? 'N/A' : orderDt.printFriendly(true, false);
        let expiryDt = FloriaDate.parseDateTime(b.billingExpiryDt);
        // Credit purchases have no expiry at all (null), so we show what they bought instead of "Expires on N/A".
        let isCredits = b.subscriptionCycle == 'O';
        str += `<TR valign="top">
                  <TD align="left">${b.planLabel}${b.active == true ? '<BR><SPAN style="font-size:90%; font-weight:bold; color:green;">ACTIVE</SPAN>':''}</TD>
                  <TD align="left" nowrap>${isCredits ? "One-time" : b.subscriptionCycle == 'M' ? "Monthly" : "Yearly"}</TD>
                  <TD align="left" nowrap width="1px">
                        Billed ${orderDt}<BR>
                        <SPAN style="font-size: 90%; color: grey;">${isCredits ? "Credits do not expire" : "Expires on " + (expiryDt == null ? 'N/A' : expiryDt.printFriendly(true, false))}</SPAN>
                  </TD>
                  <TD align="right" nowrap>${b.subscriptionCurrency} ${FloriaText.printWith2Dec(b.billingTotal)}</TD>
                </TR>
               `;
     }
     str += '</TABLE><BR><BR>';
     document.getElementById(cntId).innerHTML = str;
   }
};




// PERSONAL-USD-MONTHLY
//<div id="paypal-button-container-P-1JT30264KG444845MNDSEEEA"></div>
//<script src="https://www.paypal.com/sdk/js?client-id=AX23VzjuNuKugwTvw0wgfmHWOsa2z_ou4dFl1umvpbfUk7IV-AAhrifqUSFEsO1tZ39ijdczBn0P9YS7&vault=true&intent=subscription" data-sdk-integration-source="button-factory"></script>
//<script>
//  paypal.Buttons({
//      style: {
//          shape: 'rect',
//          color: 'gold',
//          layout: 'vertical',
//          label: 'subscribe'
//      },
//      createSubscription: function(data, actions) {
//        return actions.subscription.create({
//          /* Creates the subscription */
//          plan_id: 'P-1JT30264KG444845MNDSEEEA'
//        });
//      },
//      onApprove: function(data, actions) {
//        alert(data.subscriptionID); // You can add optional success message for the subscriber here
//      }
//  }).render('#paypal-button-container-P-1JT30264KG444845MNDSEEEA'); // Renders the PayPal button
//</script>


// PERSONAL-USD-YEARLY
//<div id="paypal-button-container-P-4JV15276W6172181TNDSEQUA"></div>
//<script src="https://www.paypal.com/sdk/js?client-id=AX23VzjuNuKugwTvw0wgfmHWOsa2z_ou4dFl1umvpbfUk7IV-AAhrifqUSFEsO1tZ39ijdczBn0P9YS7&vault=true&intent=subscription" data-sdk-integration-source="button-factory"></script>
//<script>
//  paypal.Buttons({
//      style: {
//          shape: 'rect',
//          color: 'gold',
//          layout: 'vertical',
//          label: 'subscribe'
//      },
//      createSubscription: function(data, actions) {
//        return actions.subscription.create({
//          /* Creates the subscription */
//          plan_id: 'P-4JV15276W6172181TNDSEQUA'
//        });
//      },
//      onApprove: function(data, actions) {
//        alert(data.subscriptionID); // You can add optional success message for the subscriber here
//      }
//  }).render('#paypal-button-container-P-4JV15276W6172181TNDSEQUA'); // Renders the PayPal button
//</script>


// PROFESSIONAL-USD-YEARLY
//<div id="paypal-button-container-P-0WR51242PK283933ENDSUSCA"></div>
//<script src="https://www.paypal.com/sdk/js?client-id=AX23VzjuNuKugwTvw0wgfmHWOsa2z_ou4dFl1umvpbfUk7IV-AAhrifqUSFEsO1tZ39ijdczBn0P9YS7&vault=true&intent=subscription" data-sdk-integration-source="button-factory"></script>
//<script>
//  paypal.Buttons({
//      style: {
//          shape: 'rect',
//          color: 'gold',
//          layout: 'vertical',
//          label: 'subscribe'
//      },
//      createSubscription: function(data, actions) {
//        return actions.subscription.create({
//          /* Creates the subscription */
//          plan_id: 'P-0WR51242PK283933ENDSUSCA'
//        });
//      },
//      onApprove: function(data, actions) {
//        alert(data.subscriptionID); // You can add optional success message for the subscriber here
//      }
//  }).render('#paypal-button-container-P-0WR51242PK283933ENDSUSCA'); // Renders the PayPal button
//</script>
