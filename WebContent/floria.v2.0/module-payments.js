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
import { FloriaDialog, FloriaTabs, FloriaAlert } from "./module-dialog.js";
import { FloriaAjax     } from "./module-ajax.js";
import { FloriaDate     } from "./module-date.js";
import { FloriaText     } from "./module-text.js";
import { FloriaControls } from "./module-controls.js";
import { FloriaCharts2  } from "./module-charts2.js";
import { FloriaTable    } from "./module-tables.js";

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Date extensions
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export var FloriaPayments = { };

// Small local HTML-escape helper (module-scoped, not exported) used by the Usage Dashboard below when
// building combo-box option lists / hot-spot card markup out of user-controlled (well, app-controlled but
// free-text) values such as document names, agent names, and flow names.
function _paymentsEsc(str)
 {
   if (str == null)
    return "";
   return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
 }


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
  // Set (while showing) / cleared (otherwise) by pickPlan() itself -- see its own docs below -- so
  // showUsage() can tell whether an already-open dlgHandle is currently showing pickPlan()'s own tabbed
  // Billing-History/Plans/Usage content (in which case this is a live closure it can call to jump straight
  // to the Usage tab) versus something else entirely sharing the same dialog instance (e.g. topUpCredits()).
  _activeFocusUsage: null,

  /**
   * @param focusUsageProductId when supplied (see {@link #showUsage}), the dialog opens straight onto its
   *        "Usage" tab instead of the usual default, with that tab's own product switcher (see
   *        {@link UsageDashboard#render}) pre-set to this product. Ignored (as if omitted) when
   *        {@code genericPlanOnly} is true, or when the user's catalog has no credit product matching it --
   *        falls back to the normal default tab in either case. Takes priority over {@code initialTab}.
   * @param initialTab optional case-insensitive tab name to open on instead of the usual default: "usage",
   *        "plans", or "billing" (matching "Billing History"). Ignored if that tab isn't offered at all (e.g.
   *        "usage" requested but the catalog has no credit product), in which case the usual default applies.
   *        <P>
   *        Requesting "usage" is additionally SMART: since the Usage tab is rendered eagerly as the opening
   *        tab, its very first data load is used to check whether there is any actual activity in the default
   *        window: if not, we bounce over to the Plans tab instead (see {@code smartUsageFallback} below) --
   *        an empty usage dashboard is a poor first impression for a brand new (or plans-only) user, who is
   *        much better served by the pricing table. This fallback only applies to this initial, automatic pick
   *        -- a user who manually clicks back onto the Usage tab afterwards sees its real (possibly empty)
   *        content, same as {@code focusUsageProductId} always has.
   */
  pickPlan: function(basePath, genericPlanOnly=false, focusUsageProductId=null, initialTab=null)
   {
      // Invalidated up front: only valid while THIS dialog instance is showing the tabbed content built
      // below (see the _activeFocusUsage assignment further down) -- e.g. topUpCredits() reusing the same
      // dlgHandle for its own, tab-less content clears it too, so isVisible()==true is never mistaken for
      // "the Usage tab is one call away" when it's actually showing something else entirely.
      FloriaPayments.PlansDialog._activeFocusUsage = null;
      if (FloriaPayments.PlansDialog.dlgHandle == null)
       FloriaPayments.PlansDialog.dlgHandle = new FloriaDialog("DLG_POPUP_PAYMENTS");
      FloriaPayments.PlansDialog.dlgHandle.show("Plans / Billing", null, 0.75, 0.9, function(cntId) {
         document.getElementById(cntId).innerHTML = '<BR><BR><BR><CENTER><IMG src="/static/img/progress.gif" height="60px"></CENTER>';

         // The Usage tab's own _load() guards a stale in-flight response against a RE-RENDER of the same
         // cntId (see UsageDashboard._load's "_state[cntId] !== state" check), but that guard alone does NOT
         // catch the dialog being closed/hidden outright while a usage fetch is still in flight (e.g. the
         // page navigated away, or the user dismissed the popup): _state[cntId] would still equal that same
         // state object, so _load's success/error callback would go on to touch a DOM (_UD_FILTER's combo,
         // _UD_BODY, ...) that this dialog.hide() already tore down. Clearing the entry here makes that same
         // guard catch this case too, so a response arriving after close becomes a harmless, silent no-op.
         FloriaPayments.PlansDialog.dlgHandle.setOnHide(function() {
            delete FloriaPayments.PlansDialog.UsageDashboard._state[cntId];
         });

         FloriaAjax.ajaxUrl("/"+basePath+"/svc/user/plan/status", "GET", null, function(data) {
           if (data == null || data.plans == null || data.plans.length == 0)
            {
              document.getElementById(cntId).innerHTML = '<BR><BR><BR><CENTER><IMG src="/static/img/warning.gif" height="60px"><BR>You are currently on a free unlimited plan. There is nothing else for you to do at this time.</CENTER>';
              return;
            }
           if (genericPlanOnly == true)
            return FloriaPayments.PlansDialog.paintPlans(basePath, cntId, data.plans, data.billingCurrent==true?data.billingHistory[0]:null, genericPlanOnly);                

           // Only offer a "Usage" tab when the user actually has at least one pre-paid credit product
           // (planType 'C') in their catalog -- subscription-only accounts have no per-operation ledger to
           // show a spend dashboard for.
           let creditProductIds = FloriaPayments.PlansDialog.UsageDashboard._creditProductIds(data.plans);
           let focusOnOpen = focusUsageProductId != null && creditProductIds.indexOf(focusUsageProductId) >= 0;
           if (focusOnOpen == true)
            // Bubble the product being focused to the front: it's what the dashboard's own product
            // switcher (see UsageDashboard.render) defaults to (productIds[0]) on first render.
            creditProductIds = [focusUsageProductId, ...creditProductIds.filter(function(p) { return p != focusUsageProductId; })];

           // Declared up front (assigned further down, once tabControl/plansIdx exist) so the Usage tab's
           // onSelectHandler closure below can reference it: it's only ever CALLED once a tab is actually
           // selected, well after this whole function body has finished assigning it.
           let smartUsageFallback = null;

           // Usage-first: for a returning user, "what have I been using / spending" is usually the more
           // interesting question than the static pricing table, so it leads when offered at all (i.e. only
           // when the catalog has at least one pre-paid credit product). Plans next, Billing History last --
           // the least frequently needed of the three.
           let tabs = [];
           if (creditProductIds.length > 0)
            tabs.push({label:"Usage", onSelectHandler:function(cntId, firstRender) {
                          if (firstRender != true)
                           return;
                          FloriaPayments.PlansDialog.UsageDashboard.render(cntId, basePath, creditProductIds, smartUsageFallback);
                       }});
           tabs.push({label:"Plans", onSelectHandler:function(cntId, firstRender) {
                          if (firstRender != true)
                           return;
                          FloriaPayments.PlansDialog.paintPlans(basePath, cntId, data.plans, data.billingCurrent==true?data.billingHistory[0]:null);
                      }});
           tabs.push({label:"Billing History", onSelectHandler:function(cntId, firstRender) {
                          if (firstRender != true)
                           return;
                          FloriaPayments.PlansDialog.paintBillingHistory(basePath, cntId, data.billingHistory, data.plans);
                      }});

           // "modern" skin: this dialog is a good showcase for it (a handful of top-level tabs, no nested
           // trashcan/manage affordances needed) -- see FloriaTabs' own docs in module-dialog.js for what it
           // changes (purely the header's visual treatment; layout/behavior are unaffected).
           let tabControl = new FloriaTabs(cntId, tabs, false, null, false, "modern");
           let usageIdx   = tabControl._resolveTabIndex("Usage");
           let plansIdx   = tabControl._resolveTabIndex("Plans");
           let billingIdx = tabControl._resolveTabIndex("Billing History");

           // Lets an already-open dialog (see #showUsage) jump straight to a specific product's Usage tab
           // without discarding whatever else the user had open (Plans / Billing History), by re-rendering
           // the Usage panel directly (bypassing its onSelectHandler's firstRender guard, which only ever
           // renders once per tab lifetime) and then just switching the header to it.
           FloriaPayments.PlansDialog._activeFocusUsage = function(productId) {
              let idx = tabControl._resolveTabIndex("Usage");
              if (idx == null)
               return false;
              let reordered = [productId, ...creditProductIds.filter(function(p) { return p != productId; })];
              FloriaPayments.PlansDialog.UsageDashboard.render(cntId+'_TABPANEL_'+idx, basePath, reordered);
              tabControl.select(idx);
              return true;
           };

           // Only wired up when the caller specifically ASKED for "usage" as the opening tab (initialTab --
           // e.g. the header account menu's "Plans / Billing" entry, see FloriaLogin.PopupLogin.pickPlan) AND
           // that tab is actually about to be shown (usageIdx exists, and focusUsageProductId isn't already
           // claiming this slot -- that path always shows real, possibly-empty content on purpose). See this
           // function's own docs above for the "why".
           let wantsUsage = focusOnOpen != true && usageIdx != null && (initialTab||'').toLowerCase() == 'usage';
           if (wantsUsage == true)
            smartUsageFallback = function(hasActivity) {
               if (hasActivity != true && plansIdx != null)
                tabControl.select(plansIdx);
            };

           let tabLower = (initialTab||'').toLowerCase();
           let defaultIdx = focusOnOpen == true ? usageIdx
                          : wantsUsage   == true ? usageIdx
                          : tabLower == 'plans'   && plansIdx   != null ? plansIdx
                          : tabLower == 'billing' && billingIdx != null ? billingIdx
                          : (data.billingCurrent==true && billingIdx != null ? billingIdx : (plansIdx != null ? plansIdx : 0));

           tabControl.show(defaultIdx);
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
      // Reuses the same dlgHandle as pickPlan(), but with entirely different (tab-less) content -- so any
      // _activeFocusUsage left over from a prior pickPlan() call must be invalidated, or a later showUsage()
      // call could mistake this dialog (open, but showing the top-up cart, not the Usage tab) for one it can
      // just switch tabs on.
      FloriaPayments.PlansDialog._activeFocusUsage = null;
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
  /**
   * Each plan is rendered as an independent "pricing card" DIV (its own rounded corners + soft shadow --
   * unlike the old shared {@code <TABLE>}, where only the whole table's 4 outer corners could ever be
   * rounded and adjoining columns could never get their own shadow) inside a CSS Grid row. Every card uses
   * {@code grid-template-rows: subgrid} against that row's own explicit tracks (see ".planCardsRow"/
   * ".planCard" in module-login.css) so its Header/Features/Pricing/Discount sections line up with every
   * other card's regardless of how many features (or how long the pricing/discount text) a particular plan
   * has -- the grid handles the alignment, no JS height-measuring needed.
   */
  paintPlans: function(basePath, cntId, plans, billingCurrent, genericPlanOnly=false, onComplete=null, banner=null)
   {
     // Plans flagged Plan.autoPlan=true (e.g. a promo's free/trial credit pack) are granted automatically at
     // registration/first-login with no payment and no picker (see wanda.servlets.helpers.PlanHelper's
     // autoAssignFreePlan/needsPlan) -- they should never appear as a purchasable card here. Filter them out
     // before laying out the grid; every downstream reference to "plans" in this function closes over this same
     // (already-filtered) array.
     plans = (plans || []).filter(function(p) { return p.plan.autoPlan != true; });

     // Cycled by column position rather than tied to plan count/order (the old colgroup was hardcoded to
     // "blue, orange, green only if exactly 3 plans") -- works for any number of plans, up to 4 distinct
     // accents before repeating (see the matching ".planAccent-*" rules in module-login.css).
     let accentClasses = ["planAccent-blue", "planAccent-orange", "planAccent-green", "planAccent-purple"];
     // grid-template-columns is set inline (rather than a fixed repeat(3, 1fr) in CSS) so the row always has
     // exactly plans.length columns, all cards in the SAME grid row -- required for "grid-template-rows:
     // subgrid" (see ".planCard" in module-login.css) to keep every card's Header/Features/Pricing/Discount
     // sections aligned to one shared set of row tracks; letting cards wrap onto a second grid row (e.g. an
     // auto-fit/auto-fill column policy) would put them on different (implicit) row tracks instead.
     let str = (banner != null ? banner : '')
                +'<DIV class="planCardsRow" style="grid-template-columns: repeat('+plans.length+', 1fr);">\n';
     let contactUs = null;
     for (let i = 0; i < plans.length; ++i)
      {
        let p = plans[i].plan;
        let needsCurrency = p.planType != 'X';
        str+= '<DIV class="planCard '+accentClasses[i % accentClasses.length]+'">\n'
            +   '<DIV class="planCardHeader"><DIV class="planLabel">'+p.label+'</DIV></DIV>\n'
            +   '<DIV class="planCardFeatures"><DIV class="planSectionTitle">Features</DIV><UL>';
        for (let j = 0; j < p.descr.length; ++j)
         {
           if (p.descr[j].startsWith("Contact us at") == true)
            contactUs = p.descr[j];
           else
            str+='<LI>'+p.descr[j]+'</LI>\n'
         }
        str+=   '</UL></DIV>\n'
            +   '<DIV class="planCardPricing"><DIV class="planSectionTitle">Pricing'
            +     (needsCurrency ? '<DIV id="'+cntId+'_CURR'+i+'" class="currency"></DIV>' : '')
            +   '</DIV><DIV id="'+cntId+'_CURR_'+i+'"></DIV></DIV>\n'
            +   '<DIV class="planCardDiscount"><DIV id="'+cntId+'_DISC_'+i+'"></DIV></DIV>\n'
            + '</DIV>\n';
      }
     str+='</DIV>\n';
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
                  //
                  // A genuine $0 tier (e.g. a free trial pack) is deliberately rendered as plain, non-clickable
                  // text -- same treatment as a contact-us plan further below -- rather than a "buy" button:
                  // PayPal's Orders API does not support $0 orders, so wiring this up for real needs a
                  // dedicated no-PayPal "claim your free credits" endpoint (with its own abuse-prevention, e.g.
                  // one claim per user) server-side first. Once that exists, drop the `pr.oneTime > 0` check
                  // below and point this at that new flow instead of pricingSelect() for the free case.
                  let isFree = (Number(pr.oneTime) || 0) <= 0;
                  str+=`<TR><TD>&bull;</TD>
                            <TD>One-time:</TD>
                            <TD width="1" nowrap align="right">
                              ${isFree
                                 ? `<SPAN style="font-weight:700;">Free</SPAN>`
                                 : `<${tag} href="javascript:pricingSelect('${plans[i].plan.code}', 'O','${pr.currency}', ${pr.oneTime})">${pr.currency} ${FloriaText.printWith2Dec(pr.oneTime)}</${tag}>`
                              }
                            </TD>
                        </TR>
                        <TR><TD></TD><TD colspan="2">${Math.round(Number(pr.oneTimeCredits)||0).toLocaleString()} credits${pr.oneTimeDesc ? '<BR>'+pr.oneTimeDesc : ''}${isFree ? '<BR><SPAN style="font-style:italic; color:grey;">Coming soon.</SPAN>' : ''}</TD></TR>
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
     
     document.getElementById(cntId).innerHTML = str;
     // Lets the panel center its content vertically when it's shorter than the available height (see
     // ".plansTabPanel" in module-login.css) -- e.g. a dialog header + tab header + a short 2-plan row no
     // longer all get squashed up against the top with a big empty gap below. Harmless/idempotent to set
     // again on every repaint (classList.add is a no-op if already present), and applies equally whether
     // cntId is a "Plans" tab panel (pickPlan) or the top-up dialog's own root (topUpCredits) -- both are
     // just as happy centered.
     document.getElementById(cntId).classList.add("plansTabPanel");
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
  /**
   * Paints the "Billing History" tab: a top-center row of live wallet gauges (one per distinct pre-paid
   * credit product -- planType 'C' -- found in the user's own plan catalog, so "what do I currently have"
   * is answered at a glance before scanning the row-level history below it), followed by the full
   * order/subscription history as a standard {@link FloriaTable} (sortable/filterable, consistent with the
   * rest of the app rather than a hand-rolled HTML table).
   * <P>
   * Each gauge is rendered {@code active=true}: clicking one jumps straight to the Usage Dashboard for that
   * exact product (see {@link FloriaPayments.PlansDialog#showUsage}), the same click-through behavior any
   * other embedded {@link FloriaPayments.CreditGauge} offers.
   */
  paintBillingHistory: function(basePath, cntId, billingHistory, plans)
   {
     // Distinct credit (planType 'C') products, in first-seen order -- subscription-only (planType 'S'/'X')
     // products have no wallet to show. The CATALOG (plans) only tells us WHICH products need a gauge; its
     // own plan label is used purely as a placeholder until we know better (see below) -- a user who has
     // never actually purchased that product yet has nothing else to label it with.
     let creditProducts = [];
     if (plans != null)
      for (let i = 0; i < plans.length; ++i)
       {
         let p = plans[i]?.plan;
         if (p?.planType != 'C' || p.paymentSystemProductId == null)
          continue;
         if (creditProducts.findIndex(function(cp) { return cp.productId == p.paymentSystemProductId; }) < 0)
          creditProducts.push({ productId: p.paymentSystemProductId, label: p.label });
       }

     // The caption's label is then overridden with the label of the user's OWN most recent purchase for that
     // product, taken from billingHistory (server-sorted most-recent-first -- see UserBillingView's
     // "billingOrderDt desc" query) rather than the catalog. This matters because the catalog is just the
     // current price list, not a record of what any given user actually bought: simply adding a new plan tier
     // (e.g. a "Trial" pack) ahead of an existing one (e.g. "Starter") in the catalog would otherwise silently
     // relabel every existing user's gauge to "Trial", even though they actually purchased "Starter".
     if (billingHistory != null)
      {
        let labeled = {};
        for (let i = 0; i < billingHistory.length; ++i)
         {
           let b = billingHistory[i];
           if (b == null || b.planType != 'C' || b.paymentSystemProductId == null || labeled[b.paymentSystemProductId] == true)
            continue;
           labeled[b.paymentSystemProductId] = true; // only the first (most recent) row per product wins
           let cp = creditProducts.find(function(c) { return c.productId == b.paymentSystemProductId; });
           if (cp != null)
            cp.label = b.planLabel;
         }
      }

     let walletsHtml = creditProducts.length == 0 ? '' :
         '<DIV class="billingWalletRow">'
       +   creditProducts.map(function(cp, i) {
              return '<DIV class="billingWalletCard">'
                   +   '<DIV class="billingWalletLabel">Current Plan: '+_paymentsEsc(cp.label)+'</DIV>'
                   +   '<DIV id="'+cntId+'_WALLET_'+i+'" class="billingWalletGauge"></DIV>'
                   + '</DIV>';
            }).join('')
       + '</DIV>';

     document.getElementById(cntId).innerHTML =
         walletsHtml
       + '<DIV id="'+cntId+'_TABLE" class="billingHistoryTableHost"></DIV>';

     for (let i = 0; i < creditProducts.length; ++i)
      FloriaPayments.CreditGauge.render(cntId+"_WALLET_"+i, basePath, creditProducts[i].productId, true);

     let rows = (billingHistory || []).filter(function(b) { return b != null; });
     let cols = [
        { field: "planLabel", label: "Plan", type: "string", sortable: true
         ,renderer: function(row) { return _paymentsEsc(row.planLabel)+(row.active == true ? ' <span style="font-size:90%; font-weight:bold; color:green;">ACTIVE</span>' : ''); }
        }
       ,{ field: "subscriptionCycle", label: "Subscription", type: "string", sortable: true, wrap: "nowrap"
         ,renderer: function(row) { return row.subscriptionCycle == 'O' ? "One-time" : row.subscriptionCycle == 'M' ? "Monthly" : "Yearly"; }
        }
       ,{ field: "billingOrderDt", label: "Dates", type: "string", sortable: true, preSorted: "desc"
         ,renderer: function(row) {
             let orderDt = FloriaDate.parseDateTime(row.billingOrderDt);
             let orderStr = orderDt == null ? 'N/A' : orderDt.printFriendly(true, false);
             let isCredits = row.subscriptionCycle == 'O';
             let expiryDt = FloriaDate.parseDateTime(row.billingExpiryDt);
             let sub = isCredits ? "Credits do not expire" : "Expires on "+(expiryDt == null ? 'N/A' : expiryDt.printFriendly(true, false));
             return 'Billed '+orderStr+'<BR><span style="font-size:90%; color:grey;">'+sub+'</span>';
           }
         ,_sortOverride: function(row) { let dt = FloriaDate.parseDateTime(row.billingOrderDt); return dt == null ? -Infinity : dt.getTime(); }
        }
       ,{ field: "billingTotal", label: "Amount", type: "string", sortable: true, align: "right", wrap: "nowrap"
         ,renderer: function(row) { return (row.subscriptionCurrency||'')+' '+FloriaText.printWith2Dec(row.billingTotal); }
         ,_sortOverride: function(row) { return Number(row.billingTotal)||0; }
        }
     ];
     new FloriaTable(cntId+"_TABLE", cols, rows, true, false, true).render();
   },

  /**
   * Puts the Usage Dashboard for one product in front of the user, pre-focused on it -- this is what an
   * "active" {@link FloriaPayments.CreditGauge} is clicked for (see CreditGauge._showDetails), and the same
   * destination whether the Plans/Billing dialog ({@link #pickPlan}) happens to already be open or not:
   * <UL>
   * <LI>If it's already open (checked via {@link FloriaDialog#isVisible}) and currently showing that same
   *     tabbed content -- i.e. {@code _activeFocusUsage} is still the closure pickPlan() wired up for THIS
   *     dialog instance, not stale from some other content sharing the same dlgHandle (see topUpCredits) --
   *     this just switches it over to the "Usage" tab and re-points its product switcher at {@code productId},
   *     leaving Plans/Billing History exactly as the user left them, one tab-click away.
   * <LI>Otherwise (dialog closed, or open on something without a Usage tab, e.g. mid top-up), it opens the
   *     full Plans/Billing dialog fresh via {@link #pickPlan} and lands straight on its Usage tab, focused on
   *     productId -- same destination, just via pickPlan()'s own richer tabbed UI rather than a bare
   *     standalone dashboard, so the user is never more than one tab-click from Plans/Billing History either
   *     way.
   * </UL>
   */
  showUsage: function(basePath, productId)
   {
      if (FloriaPayments.PlansDialog.dlgHandle != null && FloriaPayments.PlansDialog.dlgHandle.isVisible() == true
          && typeof FloriaPayments.PlansDialog._activeFocusUsage === 'function'
          && FloriaPayments.PlansDialog._activeFocusUsage(productId) == true)
       return;

      FloriaPayments.PlansDialog.pickPlan(basePath, false, productId);
   }
};


// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Usage Dashboard (FloriaPayments.PlansDialog.UsageDashboard) — "Usage" tab of the Plans/Billing popup, and the
// destination of clicking an "active" CreditGauge (see CreditGauge._showDetails / PlansDialog.showUsage).
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * A self-contained cost/activity dashboard for the signed-in user's own pre-paid credit wallet(s), built
 * entirely from the raw rows returned by {@code /svc/user/credits/usage} (see UserCreditsUsage.java on the
 * Wanda side): a Product / Days-back (30/60/90, 30 default) / Type / Item toolbar, four at-a-glance summary
 * cards, a daily spend-vs-operations trend chart, a "Where Your Credits Go" cost-breakdown pie, a set of
 * "Cost Hot Spots" cards (top 3 items per {@code reference} category -- e.g. Agents/Flows/Documents -- that
 * is actually present in the window; categories the user never used simply don't get a card), and a
 * collapsed-by-default sortable full-activity table for anyone who wants to drill further.
 * <P>
 * "Type" (the {@code reference} field, e.g. agents/flows/documents) and "Item" (the {@code notes} field --
 * one specific agent/flow/document name, dependent on the current Type) are two independent filters: Type
 * narrows the category, Item narrows to one specific thing within it. The Item combo is a search+select
 * (not a plain dropdown), since document titles in particular can be long and numerous. Clicking a pie slice
 * or a hot-spot card item is a shortcut for setting these same two filters.
 * <P>
 * By design (see UserCreditsUsage's own docs), the server does no aggregation at all beyond the USE-only,
 * date-window filter — every bucketing (by day, by {@code reference}, by {@code notes}) happens here, in one
 * place, off the one already-fetched row set, so changing a filter (or clicking a pie slice / hot-spot item)
 * never needs a new round trip. The hot-spot cards are deliberately computed off the FULL window (ignoring
 * the active Type/Item filters, though still respecting Days-back/Product) so they stay a stable overview
 * even while the rest of the dashboard is drilled into one specific category.
 * <P>
 * Multiple independent panels (unlikely, but the same signed-in user could in principle have more than one
 * open — e.g. this dialog plus a lingering async response from a since-replaced one) are kept from clobbering
 * each other by keying all per-panel state off the panel's own {@code cntId} in {@link #_state}, and by having
 * every async callback double-check its own closure's state object is still the one on file before touching
 * the DOM.
 */
FloriaPayments.PlansDialog.UsageDashboard = {
  _state: {},

  /**
   * The distinct paymentSystemProductId's of every pre-paid credit plan (planType 'C') found in a
   * {@code /svc/user/plan/status} "plans" array, in first-seen order. Empty for an account with only
   * subscription (non-credit) products — callers use this to decide whether a Usage tab/dashboard makes sense
   * to offer at all.
   */
  _creditProductIds: function(plans)
   {
      let ids = [];
      if (plans != null)
       for (let i = 0; i < plans.length; ++i)
        {
          let p = plans[i];
          let productId = p?.plan?.planType == 'C' ? p.plan.paymentSystemProductId : null;
          if (productId != null && ids.indexOf(productId) < 0)
           ids.push(productId);
        }
      return ids;
   },

  /**
   * Paints the toolbar (product switcher when there is more than one credit product, days-back selector, a
   * "Type" filter scoped to whatever {@code reference} buckets -- e.g. agents/flows/documents -- are actually
   * present, and a dependent "Item" filter for drilling into one specific agent/flow/document by name) into
   * {@code cntId}, then kicks off the first load.
   *
   * @param onFirstLoad optional; invoked exactly once, after the very first {@code _load} for this panel
   *        completes (success or failure), with a single boolean argument: whether the loaded window has any
   *        activity at all ({@code state.items.length > 0}). Used by {@link FloriaPayments.PlansDialog#pickPlan}
   *        to bounce over to the Plans tab when the Usage tab was opened automatically (see its own docs) and
   *        turns out to be empty. Never called again after subsequent reloads (product/days-back changes).
   */
  render: function(cntId, basePath, productIds, onFirstLoad)
   {
      let state = FloriaPayments.PlansDialog.UsageDashboard._state[cntId] =
        { basePath: basePath, productIds: productIds, productId: productIds[0], days: 30, reference: null, note: null
        , items: [], _filterCombo: null, _itemCombo: null, _tableDrawn: false
        , _onFirstLoad: typeof onFirstLoad === 'function' ? onFirstLoad : null };

      let productComboHtml = productIds.length > 1
        ? '<LABEL style="font-weight:bold;">Product:</LABEL><DIV id="'+cntId+'_UD_PRODUCT" class="usageDashCombo"></DIV>'
        : '';

      // "Item" uses a search+select combo (FloriaControls.ComboBox's selectOnly=true mode already gives a
      // type-ahead text box over the option list -- see module-controls.js) rather than a plain <SELECT>,
      // since document names in particular can be long/numerous and a native dropdown would be unusable.
      document.getElementById(cntId).innerHTML =
          '<DIV class="usageDash">'
        +   '<DIV class="usageDashToolbar">'
        +     productComboHtml
        +     '<LABEL style="font-weight:bold;">Days back:</LABEL>'
        +     '<SELECT id="'+cntId+'_UD_DAYS" class="usageDashSelect">'
        +       '<OPTION value="30" selected>30</OPTION>'
        +       '<OPTION value="60">60</OPTION>'
        +       '<OPTION value="90">90</OPTION>'
        +     '</SELECT>'
        +     '<LABEL style="font-weight:bold;">Type:</LABEL>'
        +     '<DIV id="'+cntId+'_UD_FILTER" class="usageDashCombo"></DIV>'
        +     '<LABEL style="font-weight:bold;">Item:</LABEL>'
        +     '<DIV id="'+cntId+'_UD_ITEM" class="usageDashCombo usageDashComboWide"></DIV>'
        +     '<A href="javascript:void(0);" id="'+cntId+'_UD_RESET" class="usageDashReset">Reset filters</A>'
        +     '<BUTTON type="button" id="'+cntId+'_UD_EXPORT" class="florgBtn florgBtnSmall usageDashExportBtn" title="Download the currently-filtered rows as a CSV file">\u2913 Export CSV</BUTTON>'
        +   '</DIV>'
        +   '<DIV id="'+cntId+'_UD_BODY"><BR><BR><CENTER><IMG src="/static/img/progress.gif" height="50px"></CENTER></DIV>'
        + '</DIV>';

      if (productIds.length > 1)
       {
         let values = productIds.map(function(p) { return [p, p]; });
         new FloriaControls.ComboBox(cntId+"_UD_PRODUCT", cntId+"_UD_PRODUCT_v", values, null, productIds[0], function(el, val) {
            state.productId = val;
            FloriaPayments.PlansDialog.UsageDashboard._load(cntId);
         }, true);
       }

      FloriaDOM.addEvent(cntId+"_UD_DAYS", "change", function(e, event, target) {
         state.days = parseInt(target.value, 10) || 30;
         FloriaPayments.PlansDialog.UsageDashboard._load(cntId);
      }, null, true);

      FloriaDOM.addEvent(cntId+"_UD_RESET", "click", function() {
         state.reference = null;
         state.note = null;
         FloriaPayments.PlansDialog.UsageDashboard._paintFilterCombos(cntId);
         FloriaPayments.PlansDialog.UsageDashboard._paint(cntId);
      }, null, true);

      FloriaDOM.addEvent(cntId+"_UD_EXPORT", "click", function() {
         FloriaPayments.PlansDialog.UsageDashboard._exportCsv(cntId);
      }, null, true);

      FloriaPayments.PlansDialog.UsageDashboard._load(cntId);
   },

  _load: function(cntId)
   {
      let state = FloriaPayments.PlansDialog.UsageDashboard._state[cntId];
      if (state == null)
       return;
      let body = document.getElementById(cntId+"_UD_BODY");
      if (body != null)
       body.innerHTML = '<BR><BR><CENTER><IMG src="/static/img/progress.gif" height="50px"></CENTER>';

      FloriaAjax.ajaxUrl("/"+state.basePath+"/svc/user/credits/usage?productId="+encodeURIComponent(state.productId)+"&days="+state.days+"&ts="+new Date().getTime(), "GET", null, function(data) {
         // The panel may have been re-render()'d (different productIds, or the dialog closed/reopened) while
         // this request was in flight -- only apply the response if it is still the current state object.
         if (FloriaPayments.PlansDialog.UsageDashboard._state[cntId] !== state)
          return;
         state.items = (data && data.items) || [];
         state.reference = null; // a fresh window/product invalidates any prior in-window filters
         state.note = null;
         FloriaPayments.PlansDialog.UsageDashboard._paintFilterCombos(cntId);
         FloriaPayments.PlansDialog.UsageDashboard._paint(cntId);
         if (state._onFirstLoad != null)
          {
            let cb = state._onFirstLoad;
            state._onFirstLoad = null; // fire once only -- subsequent product/days-back reloads don't repeat it
            cb(state.items.length > 0);
          }
      }, function(code, msg, errors) {
         if (FloriaPayments.PlansDialog.UsageDashboard._state[cntId] !== state)
          return;
         let b = document.getElementById(cntId+"_UD_BODY");
         if (b != null)
          b.innerHTML = '<BR><BR><CENTER><IMG src="/static/img/warning.gif" height="50px"><BR>Cannot load your usage.<BR>'+(msg||'')+'</CENTER>';
         if (state._onFirstLoad != null)
          {
            let cb = state._onFirstLoad;
            state._onFirstLoad = null;
            cb(false); // a failed load is treated as "no activity" -- falls back to Plans rather than an error tab
          }
      });
   },

  /** (Re)builds BOTH the "Type" (reference) and dependent "Item" (notes) combos from the loaded window. */
  _paintFilterCombos: function(cntId)
   {
      let state = FloriaPayments.PlansDialog.UsageDashboard._state[cntId];
      let refs = [];
      for (let i = 0; i < state.items.length; ++i)
       {
         let r = state.items[i].reference || "(uncategorized)";
         if (refs.indexOf(r) < 0)
          refs.push(r);
       }
      refs.sort();
      let values = [["", "\u2014 all activity \u2014"]].concat(refs.map(function(r) { return [_paymentsEsc(r), _paymentsEsc(r)]; }));
      state._filterCombo = new FloriaControls.ComboBox(cntId+"_UD_FILTER", cntId+"_UD_FILTER_v", values, null, _paymentsEsc(state.reference||""), function(el, val) {
         state.reference = val || null;
         state.note = null; // switching Type invalidates whatever specific item was picked under the old Type
         FloriaPayments.PlansDialog.UsageDashboard._paintItemCombo(cntId);
         FloriaPayments.PlansDialog.UsageDashboard._paint(cntId);
      }, true);

      FloriaPayments.PlansDialog.UsageDashboard._paintItemCombo(cntId);
   },

  /**
   * (Re)builds the "Item" combo -- every distinct agent/flow/document (i.e. {@code notes}, falling back to
   * the reference itself when a row has none) present under the currently-selected Type, or across the whole
   * window when Type is "all activity". A search+select combo (not a plain dropdown) because this list can
   * be long and its entries (document titles in particular) can be lengthy.
   */
  _paintItemCombo: function(cntId)
   {
      let state = FloriaPayments.PlansDialog.UsageDashboard._state[cntId];
      let labels = [];
      for (let i = 0; i < state.items.length; ++i)
       {
         let it = state.items[i];
         let ref = it.reference || "(uncategorized)";
         if (state.reference != null && ref != state.reference)
          continue;
         let label = it.notes || ref;
         if (labels.indexOf(label) < 0)
          labels.push(label);
       }
      labels.sort(function(a, b) { return a.localeCompare(b); });
      let values = [["", "\u2014 all items \u2014"]].concat(labels.map(function(l) { let e = _paymentsEsc(l); return [e, e, l]; }));
      state._itemCombo = new FloriaControls.ComboBox(cntId+"_UD_ITEM", cntId+"_UD_ITEM_v", values, "Search by name\u2026", _paymentsEsc(state.note||""), function(el, val) {
         state.note = val || null;
         FloriaPayments.PlansDialog.UsageDashboard._paint(cntId);
      }, true);
   },

  /**
   * Applies the current Type + Item filters (if any) to the loaded items, then rebuilds every visual from
   * scratch. The "Cost Hot Spots" category cards are deliberately built from the FULL, unfiltered-by-Type/Item
   * window (days/product still apply) rather than from the filtered set: they are meant to be a stable
   * at-a-glance overview across whatever categories (agents/flows/documents/...) the user actually has activity
   * in, so drilling into one Type via the filters shouldn't make the other categories' hot-spot cards vanish.
   * Everything else (summary cards, trend, pie, detail table) DOES respect the active filters.
   */
  _paint: function(cntId)
   {
      let state = FloriaPayments.PlansDialog.UsageDashboard._state[cntId];
      let body = document.getElementById(cntId+"_UD_BODY");
      if (state == null || body == null)
       return;

      let items = state.items.filter(function(it) {
          if (state.reference != null && (it.reference || "(uncategorized)") != state.reference)
           return false;
          if (state.note != null && (it.notes || (it.reference || "(uncategorized)")) != state.note)
           return false;
          return true;
        });

      if (items.length == 0)
       {
         body.innerHTML = '<BR><BR><CENTER style="color:#8a94a0;">No metered activity in the last '+state.days+' days'
                         +(state.note!=null?' for "'+_paymentsEsc(state.note)+'"':state.reference!=null?' for "'+_paymentsEsc(state.reference)+'"':'')+'.</CENTER>';
         return;
       }

      // ── Aggregate: by day (trend), by reference (hot-spot pie), by notes (item drill-down table) ──────────
      let totalSpent = 0;
      let byDay = {};
      let byReference = {};
      let byNotes = {};
      for (let i = 0; i < items.length; ++i)
       {
         let it = items[i];
         let amt = Math.abs(Number(it.amount) || 0); // amount is a signed debit (negative) for type=USE rows
         totalSpent += amt;

         let dt = FloriaDate.parseDateTime(it.created);
         let dayKey = dt == null ? "?" : dt.printYYYYMMDD("-");
         let d = byDay[dayKey] || (byDay[dayKey] = { spent: 0, count: 0 });
         d.spent += amt; ++d.count;

         let ref = it.reference || "(uncategorized)";
         let r = byReference[ref] || (byReference[ref] = { spent: 0, count: 0 });
         r.spent += amt; ++r.count;

         let label = it.notes || ref;
         let key = ref + "\u0001" + label;
         let n = byNotes[key] || (byNotes[key] = { reference: ref, label: label, spent: 0, count: 0, last: null });
         n.spent += amt; ++n.count;
         if (n.last == null || (dt != null && dt > n.last))
          n.last = dt;
       }

      let dayKeys = Object.keys(byDay).sort();
      let avgPerDay = state.days > 0 ? totalSpent / state.days : 0;
      let busiestDay = dayKeys.reduce(function(best, k) { return best == null || byDay[k].spent > byDay[best].spent ? k : best; }, null);

      let fmt = FloriaText.printWithThousands0Dec;
      let hotspotCategories = FloriaPayments.PlansDialog.UsageDashboard._hotspotsByCategory(state.items);
      body.innerHTML =
          '<DIV class="usageDashCards">'
        +   '<DIV class="usageDashCard"><DIV class="usageDashCardValue">'+fmt(Math.round(totalSpent))+'</DIV><DIV class="usageDashCardLabel">Credits spent ('+state.days+'d)</DIV></DIV>'
        +   '<DIV class="usageDashCard"><DIV class="usageDashCardValue">'+fmt(items.length)+'</DIV><DIV class="usageDashCardLabel">Metered operations</DIV></DIV>'
        +   '<DIV class="usageDashCard"><DIV class="usageDashCardValue">'+fmt(Math.round(avgPerDay))+'</DIV><DIV class="usageDashCardLabel">Avg. credits / day</DIV></DIV>'
        +   '<DIV class="usageDashCard"><DIV class="usageDashCardValue">'+(busiestDay!=null?fmt(Math.round(byDay[busiestDay].spent)):'\u2014')+'</DIV><DIV class="usageDashCardLabel">Busiest day'+(busiestDay!=null?' ('+busiestDay+')':'')+'</DIV></DIV>'
        + '</DIV>'
        + '<DIV class="usageDashChartsRow">'
        +   '<DIV class="usageDashTrendCol"><DIV id="'+cntId+'_UD_TREND" class="chart2DivContainer" style="height:280px;"></DIV></DIV>'
        +   '<DIV class="usageDashPieCol"><DIV id="'+cntId+'_UD_PIE" class="chart2DivContainer" style="height:280px;"></DIV></DIV>'
        + '</DIV>'
        + '<H3 class="usageDashSectionTitle">Cost Hot Spots</H3>'
        +   FloriaPayments.PlansDialog.UsageDashboard._hotspotCardsHtml(cntId, hotspotCategories)
        + '<DIV class="usageDashDetailsToggle"><A href="javascript:void(0);" id="'+cntId+'_UD_TOGGLE">\u25be Show full activity breakdown</A></DIV>'
        + '<DIV id="'+cntId+'_UD_TABLEWRAP" style="display:none;"><DIV id="'+cntId+'_UD_TABLE" style="height:32vh;"></DIV></DIV>'
        ;

      FloriaPayments.PlansDialog.UsageDashboard._drawTrend(cntId, dayKeys, byDay);
      FloriaPayments.PlansDialog.UsageDashboard._drawHotspotPie(cntId, byReference, state);
      FloriaPayments.PlansDialog.UsageDashboard._wireHotspotCards(cntId);

      // The detail table is built lazily (on first expand) rather than eagerly into a display:none host: some
      // chart/table libs mis-measure their own width when built inside a hidden element. It's rebuilt from
      // scratch on every _paint() (tableDrawn resets below), so toggling never shows stale/filtered-out rows.
      state._tableDrawn = false;
      state._byNotesForTable = byNotes;
      let toggle = document.getElementById(cntId+"_UD_TOGGLE");
      let wrap = document.getElementById(cntId+"_UD_TABLEWRAP");
      if (toggle != null && wrap != null)
       FloriaDOM.addEvent(toggle.id, "click", function() {
           let show = wrap.style.display == "none";
           wrap.style.display = show ? "" : "none";
           toggle.innerHTML = (show?'\u25b4':'\u25be')+' '+(show?'Hide':'Show')+' full activity breakdown';
           if (show == true && state._tableDrawn == false)
            {
              FloriaPayments.PlansDialog.UsageDashboard._drawItemsTable(cntId, state._byNotesForTable);
              state._tableDrawn = true;
            }
         }, null, true);
   },

  /**
   * Buckets the FULL (days/product-scoped, but Type/Item-filter-agnostic) item set by {@code reference}
   * (e.g. "agents"/"flows"/"documents"), then by {@code notes} (falling back to the reference itself) within
   * each, keeping only the top 3 by spend per category -- this is deliberately capped at 3 (per the dashboard's
   * design goal of a quick "where is my money going" glance, not a full drill-down; the detail table below
   * covers the rest). Categories with zero activity simply never appear in the returned array, so a user who
   * has only ever used e.g. documents never sees empty/zero "Agents"/"Flows" cards.
   */
  _hotspotsByCategory: function(items)
   {
      let byRefNotes = {};
      for (let i = 0; i < items.length; ++i)
       {
         let it = items[i];
         let amt = Math.abs(Number(it.amount) || 0);
         let ref = it.reference || "(uncategorized)";
         let label = it.notes || ref;
         let bucket = byRefNotes[ref] || (byRefNotes[ref] = {});
         let n = bucket[label] || (bucket[label] = { label: label, spent: 0, count: 0 });
         n.spent += amt; ++n.count;
       }

      let categories = Object.keys(byRefNotes).map(function(ref) {
          let entries = Object.keys(byRefNotes[ref]).map(function(l) { return byRefNotes[ref][l]; });
          let total = entries.reduce(function(s, e) { return s + e.spent; }, 0);
          let top = entries.sort(function(a, b) { return b.spent - a.spent; }).slice(0, 3);
          return { reference: ref, total: total, top: top };
        });
      categories.sort(function(a, b) { return b.total - a.total; });
      return categories;
   },

  /** Renders one card per non-empty hot-spot category, or a friendly empty state if there is none at all. */
  _hotspotCardsHtml: function(cntId, categories)
   {
      if (categories.length == 0)
       return '<DIV class="usageDashEmpty">No categorized activity to show hot spots for yet.</DIV>';

      let fmt = FloriaText.printWithThousands0Dec;
      let html = '<DIV id="'+cntId+'_UD_HOTSPOTS" class="usageDashHotspotsGrid">';
      for (let c = 0; c < categories.length; ++c)
       {
         let cat = categories[c];
         let maxSpent = cat.top.length > 0 ? cat.top[0].spent : 0;
         html += '<DIV class="usageDashHotspotCard">'
               +   '<DIV class="usageDashHotspotCardHeader">'
               +     '<SPAN class="usageDashHotspotCardTitle">'+_paymentsEsc(cat.reference)+'</SPAN>'
               +     '<SPAN class="usageDashHotspotCardTotal">'+fmt(Math.round(cat.total))+' credits</SPAN>'
               +   '</DIV>'
               +   '<DIV class="usageDashHotspotList">';
         for (let i = 0; i < cat.top.length; ++i)
          {
            let t = cat.top[i];
            let pct = maxSpent > 0 ? Math.max(4, Math.round(100*t.spent/maxSpent)) : 0;
            html += '<DIV class="usageDashHotspotItem" data-reference="'+_paymentsEsc(cat.reference)+'" data-label="'+_paymentsEsc(t.label)+'">'
                  +   '<DIV class="usageDashHotspotRank">'+(i+1)+'</DIV>'
                  +   '<DIV class="usageDashHotspotBody">'
                  +     '<DIV class="usageDashHotspotName" title="'+_paymentsEsc(t.label)+'">'+_paymentsEsc(t.label)+'</DIV>'
                  +     '<DIV class="usageDashHotspotBar"><DIV class="usageDashHotspotBarFill" style="width:'+pct+'%;"></DIV></DIV>'
                  +   '</DIV>'
                  +   '<DIV class="usageDashHotspotValue">'+fmt(Math.round(t.spent))+'</DIV>'
                  + '</DIV>';
          }
         html +=   '</DIV>'
               + '</DIV>';
       }
      html += '</DIV>';
      return html;
   },

  /** Clicking a hot-spot item drills the whole dashboard down to that exact Type + Item, same gesture as picking them from the toolbar combos. */
  _wireHotspotCards: function(cntId)
   {
      let state = FloriaPayments.PlansDialog.UsageDashboard._state[cntId];
      let host = document.getElementById(cntId+"_UD_HOTSPOTS");
      if (host == null)
       return;
      FloriaDOM.addEvent(host.id, "click", function(e, event, target) {
          target = FloriaDOM.getAncestorNode(target, "DIV", "label");
          if (target == null)
           return;
          let ref = target.dataset.reference;
          let label = target.dataset.label;
          if (state._filterCombo != null)
           state._filterCombo.setValue(ref); // fires Type onChange -> clears note, rebuilds Item combo, repaints
          if (state._itemCombo != null)
           state._itemCombo.setValue(label);
        }, null, true);
   },

  /** Client-side CSV export of the currently-filtered rows -- no server round trip needed, this dashboard already has the whole window's rows in hand. */
  _exportCsv: function(cntId)
   {
      let state = FloriaPayments.PlansDialog.UsageDashboard._state[cntId];
      if (state == null)
       return;
      let items = state.items.filter(function(it) {
          if (state.reference != null && (it.reference || "(uncategorized)") != state.reference)
           return false;
          if (state.note != null && (it.notes || (it.reference || "(uncategorized)")) != state.note)
           return false;
          return true;
        });
      let esc = function(v) { v = v==null?"":String(v); return /[",\n]/.test(v) ? '"'+v.replaceAll('"','""')+'"' : v; };
      let lines = ["Date,Type,Item,Credits"];
      for (let i = 0; i < items.length; ++i)
       {
         let it = items[i];
         let dt = FloriaDate.parseDateTime(it.created);
         lines.push([dt==null?"":dt.printYYYYMMDD("-"), esc(it.reference||"(uncategorized)"), esc(it.notes||""), Math.round(Math.abs(Number(it.amount)||0))].join(","));
       }
      let blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      let a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "credit-usage-"+state.productId+"-"+state.days+"d.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
   },

  _drawTrend: function(cntId, dayKeys, byDay)
   {
      let chart = new FloriaCharts2.Chart(cntId+"_UD_TREND");
      chart.setTitle('Daily Spend', { size: 16 });
      let spendData = dayKeys.map(function(k) { return { x: k, y: Math.round(byDay[k].spent) }; });
      let countData = dayKeys.map(function(k) { return { x: k, y: byDay[k].count }; });
      chart.addBar(spendData
                  ,{ labelFull: "Credits spent" }
                  ,{ borderColor: "#4da1ed", backgroundColor: "rgba(77,161,237,0.45)", borderWidth: 1 }
                  ,{ borderColor: "#4da1ed", backgroundColor: "rgba(77,161,237,0.65)", borderWidth: 2 }
                  ,18
                  );
      chart.addLine(countData
                   ,{ labelFull: "Operations" }
                   ,{ borderColor: "#7c6fcd", backgroundColor: "rgba(124,111,205,0.15)", borderWidth: 2, pointBorderWidth: 1, radius: 3 }
                   ,{ borderColor: "#7c6fcd", backgroundColor: "rgba(124,111,205,0.25)", borderWidth: 3, pointBorderWidth: 2, radius: 5 }
                   ,'y1'
                   );
      chart.setAxis("X", "Day", { weight: "bold" });
      chart.setAxis("Y", "Credits", { weight: "bold" }, function(value) { return FloriaText.printWithThousands0Dec(value); });
      chart.setSecondaryYAxis("Operations", { weight: "bold" }, function(value) { return FloriaText.printWithThousands0Dec(value); });
      chart.setInteractionMode('index', false);
      chart.setLegendBehavior(true);
      chart.setTooltip("left", "top", function(idx, dataset, label, seriesIndex) {
         let d = dataset[idx];
         let dateCell = seriesIndex === 0 ? '<TD style="font-weight:bold; padding-right:12px;">'+label+'</TD>' : '<TD></TD>';
         let val = seriesIndex === 0 ? FloriaText.printWithThousands0Dec(d.y)+' credits' : FloriaText.printWithThousands0Dec(d.y)+' ops';
         return dateCell + '<TD align="right">'+val+'</TD>';
      });
      chart.draw();
   },

  _drawHotspotPie: function(cntId, byReference, state)
   {
      let refs = Object.keys(byReference).sort(function(a, b) { return byReference[b].spent - byReference[a].spent; });

      // Top 6 + "Other": enough to be genuinely useful without turning into an unreadable rainbow of slivers
      // for a heavy user with dozens of distinct cost types (reference buckets).
      const MAX_SLICES = 6;
      let labels = [];
      let values = [];
      let otherSpent = 0;
      for (let i = 0; i < refs.length; ++i)
       {
         if (i < MAX_SLICES)
          {
            labels.push(refs[i]);
            values.push(Math.round(byReference[refs[i]].spent));
          }
         else
          otherSpent += byReference[refs[i]].spent;
       }
      if (otherSpent > 0)
       {
         labels.push("Other");
         values.push(Math.round(otherSpent));
       }

      let palette = ["#4da1ed", "#7c6fcd", "#e0a400", "#2da44e", "#e05c5c", "#20b2aa", "#9aa0a6"];
      let chart = new FloriaCharts2.Chart(cntId+"_UD_PIE");
      chart.setTitle('Where Your Credits Go', { size: 16 });
      chart.addPie(values
                  ,{ labelFull: "Cost breakdown" }
                  ,{ borderColor: "#fff", backgroundColor: palette, borderWidth: 1 }
                  ,{ borderColor: "#fff", backgroundColor: palette, borderWidth: 2 }
                  );
      chart.setPiePolarRadarLabels(labels);
      chart.setPieAttributes(60, false);
      chart.setFancyLabeling(false, false, true, 0);
      chart.setLegendBehavior(true);
      chart.setTooltip(null, null, function(idx, data, label) {
         return '<TR><TD></TD><TD>'+label+'</TD><TD align="right">'+FloriaText.printWithThousands0Dec(data[idx])+' credits</TD></TR>';
      });
      // Clicking a slice drills the whole dashboard down to that cost type, same as picking it from the
      // Filter combo -- a quick "hot spot → detail" gesture without hunting for the dropdown. Best-effort
      // index resolution (matching on the slice's own value) since the chart lib only hands the click
      // handler the raw data value, not its index; a tie between two buckets rounding to the same credit
      // total is harmless here (worst case, the first bucket with that value is selected instead).
      chart.setClickHandler(function(dataElement) {
         let idx = values.indexOf(dataElement);
         let ref = idx >= 0 ? labels[idx] : null;
         if (ref == null || ref == "Other" || state._filterCombo == null)
          return;
         state._filterCombo.setValue(ref);
      });
      chart.draw();
   },

  _drawItemsTable: function(cntId, byNotes)
   {
      let rows = Object.keys(byNotes).map(function(k) { return byNotes[k]; })
                        .sort(function(a, b) { return b.spent - a.spent; })
                        .slice(0, 25); // top 25 is plenty for a hot-spots drill-down; the trend/pie above already summarize the rest.

      let cols = [
         { field: "label"    , label: "Item / Activity", type: "string" , sortable: true, wrap: "nowrap", maxWidth: "480px" }
        ,{ field: "reference", label: "Type"           , type: "string" , sortable: true }
        ,{ gap: true, minWidth: "1em" }
        ,{ field: "count"    , label: "Count"          , type: "integer", sortable: true, align: "right", summary: true }
        ,{ field: "spent"    , label: "Credits"        , type: "string" , sortable: true, align: "right", summary: true, preSorted: "desc"
          ,renderer: function(row) { return FloriaText.printWithThousands0Dec(Math.round(row.spent)); }
          ,_sortOverride: function(row) { return row.spent; } }
        ,{ field: "avg"      , label: "Avg/Use"        , type: "string" , sortable: true, align: "right"
          ,renderer: function(row) { return FloriaText.printWithThousands0Dec(Math.round(row.spent/row.count)); }
          ,_sortOverride: function(row) { return row.spent/row.count; } }
        ,{ field: "last"     , label: "Last Used"      , type: "string" , sortable: true, align: "right"
          ,renderer: function(row) { return row.last == null ? FloriaText.spanNA : row.last.printFriendly(true, true); }
          ,_sortOverride: function(row) { return row.last == null ? -Infinity : row.last.getTime(); } }
      ];
      new FloriaTable(cntId+"_UD_TABLE", cols, rows, true, false, true).render();
   }
};




// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Credit balance gauge (embeddable "credit meter" widget)
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * A slim, wide (5:1 aspect ratio -- meant to sit within a single line of a host UI, e.g. a toolbar or header,
 * NOT a big square dial) SVG gauge showing the signed-in user's credit balance for ONE product.
 * <P>
 * Deliberately scoped to a single {@code productId} per instance: a user's plan can now span several products
 * at once (subscriptions, flat licenses, usage-based credits, or a mix), each with its own billing rules, so a
 * single gauge mixing more than one product's balance together would be meaningless. An app embedding this for
 * several products simply renders one gauge per product, each in its own host DIV.
 * <P>
 * Colors are never hardcoded here: the fill's color tier is expressed purely as a CSS class
 * ("creditGaugeFill--low/mid/high"), and the actual colors live in module-login.css so a host app can restyle
 * them (or override the CSS custom properties they're built from) without touching this file.
 * <P>
 * Balance data comes from {@code /svc/user/credits/balance}, which is backed server-side by CreditHelper's
 * small, bounded, short-TTL cache (see CreditHelper.getSnapshot on the Wanda side) -- safe to poll/re-render
 * fairly often without putting real load on the database.
 */
FloriaPayments.CreditGauge = {
  // Tier thresholds, in credit UNITS (1 credit = 1 US cent by convention -- see CreditHelper). Below _LOW_MAX is
  // the "low" (red) tier, from there up to (but excluding) _MID_MAX is "mid" (yellow), and _MID_MAX and above is
  // "high" (green). These are ONLY used for the color tier (and as a last-resort scale -- see _paint's
  // scaleMax) now that the balance endpoint reports back lastTopUpAmount (see CreditHelper.getLastTopUpAmount):
  // the real "100%" for the fill/label is the wallet's balance right after its last top-up finished -- i.e.
  // whatever was left over from before PLUS what the top-up added -- when known, so e.g. a user sitting at 100
  // who buys a 1,000+500-bonus Starter pack reads "1,409 / 1,600" after spending some of it (not ".../1,500",
  // since the 100 leftover credits are part of the ceiling too), rather than the fixed tier ceiling below. Both
  // are plain constants so a host app can tune them to its own product's pricing by reassigning them before the
  // first render() call, without needing a code change here.
  _LOW_MAX: 300,
  _MID_MAX: 500,

  /**
   * Renders (or re-renders) the gauge into an existing host DIV, then kicks off the balance fetch.
   *
   * @param hostDivId the id of an existing, empty-or-reusable host element. Its own width drives the widget's
   *        size (the gauge is a scalable SVG at a fixed 5:1 aspect ratio -- see module-login.css's
   *        ".creditGaugeHost"), so it works equally well at width:5em or width:20em.
   * @param basePath the app's own service base path, same convention as the rest of this module (see
   *        PlansDialog.pickPlan/topUpCredits).
   * @param productId the paymentSystemProductId this gauge is scoped to. A gauge only ever reflects ONE
   *        product's wallet.
   * @param active whether the widget is clickable. When true, the cursor indicates it (pointer) and clicking it
   *        opens {@link FloriaPayments.PlansDialog#showUsage}, the full Usage Dashboard pre-focused on this
   *        gauge's own product (see _showDetails). When false (or omitted), the gauge is purely informational.
   */
  render: function(hostDivId, basePath, productId, active = false)
   {
      let host = document.getElementById(hostDivId);
      if (host == null)
       return;

      host.classList.add("creditGaugeHost");
      host.innerHTML = FloriaPayments.CreditGauge._svgSkeleton(hostDivId);

      // Re-render-safe: drop any previously-attached click handler before deciding whether to add one again,
      // so calling render() again on the same host (e.g. after the productId or active flag changes) never
      // stacks up duplicate handlers.
      FloriaDOM.removeEvents(host, "click");
      if (active == true)
       {
         host.classList.add("creditGaugeHost--active");
         host.title = "View credit usage";
         FloriaDOM.addEvent(hostDivId, "click", function() {
            FloriaPayments.CreditGauge._showDetails(basePath, productId);
         }, null, true);
       }
      else
       {
         host.classList.remove("creditGaugeHost--active");
         host.removeAttribute("title");
       }

      FloriaAjax.ajaxUrl("/"+basePath+"/svc/user/credits/balance?productId="+encodeURIComponent(productId), "GET", null, function(data) {
         FloriaPayments.CreditGauge._paint(hostDivId, data);
         FloriaPayments.CreditGauge._maybeShowTrialWelcome(productId, data);
      }, function(code, msg, errors) {
         FloriaPayments.CreditGauge._paintError(hostDivId);
      });
   },

  /**
   * Shows a one-time (per browser tab session) welcome popup the first time a brand-new free-trial user sees
   * their credit gauge on the app's dashboard/landing page: "you were given X credits to get started, click the
   * gauge to add more". Piggybacks entirely on the balance fetch every render() call already makes -- no extra
   * network round trip -- and is gated on BOTH a sessionStorage flag (so it never repeats within the same
   * browser session/tab, even across dashboard reloads) AND the server's own `onTrialPlan` flag (so it only
   * fires while the user is still riding the auto-assigned free/trial plan -- see
   * wanda.servlets.helpers.PlanHelper#isOnAutoPlan -- and never again once they've picked/bought a real plan).
   */
  _maybeShowTrialWelcome: function(productId, data)
   {
      if (data == null || data.hasWallet != true || data.onTrialPlan != true)
       return;

      let flagKey = "FLORIA_TRIAL_WELCOME_SHOWN_" + productId;
      if (window.sessionStorage.getItem(flagKey) != null)
       return;
      window.sessionStorage.setItem(flagKey, "1");

      let balance = Math.round(Number(data.balance) || 0).toLocaleString();
      let html = `<DIV style="text-align:center;">
                    <DIV style="font-size:120%;">You're on a <B>free trial</B> with <B>${balance} credits</B> to get you started!</DIV>
                    <BR>
                    Click the credit gauge any time to check your balance or add more credits.
                  </DIV>`;
      new FloriaAlert(html, 0.4, 0.3).show();
   },

  _svgSkeleton: function(hostDivId)
   {
     // viewBox is 500x100 -- a fixed 5:1 canvas, deliberately tight on vertical padding above/below the bar so
     // the widget reads as a wide, slim strip rather than a tall dial -- and preserveAspectRatio="none" lets the
     // host DIV's own CSS aspect-ratio (module-login.css: ".creditGaugeHost { aspect-ratio: 5/1; }") be the
     // single source of truth for sizing: the SVG simply fills whatever box the host ends up being.
     // The 4 tick lines split the track into 5 even segments purely as a visual "levels" cue; the actual fill
     // amount/color is continuous, not stepped. A subtle white sheen (top-to-transparent gradient, clipped to
     // the same rounded-rect as the fill) is layered over the fill to soften what would otherwise be a flat,
     // "hard" block of solid color -- most noticeable at 100%, which is exactly when a flat fill looks harshest.
     return `<svg class="creditGaugeSvg" viewBox="0 0 500 100" preserveAspectRatio="none" role="img" aria-label="Credit balance gauge">
                <defs>
                  <clipPath id="${hostDivId}_CLIP"><rect x="6" y="8" width="488" height="46" rx="23" ry="23"/></clipPath>
                  <linearGradient id="${hostDivId}_SHEEN" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
                    <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                <rect class="creditGaugeTrack" x="6" y="8" width="488" height="46" rx="23" ry="23"/>
                <g clip-path="url(#${hostDivId}_CLIP)">
                  <rect id="${hostDivId}_FILL" class="creditGaugeFill" x="6" y="8" width="0" height="46"/>
                  <rect id="${hostDivId}_FILL_SHEEN" x="6" y="8" width="0" height="46" fill="url(#${hostDivId}_SHEEN)" pointer-events="none"/>
                </g>
                <g class="creditGaugeTicks">
                  <line x1="104.6" y1="8" x2="104.6" y2="54"/>
                  <line x1="201.2" y1="8" x2="201.2" y2="54"/>
                  <line x1="297.8" y1="8" x2="297.8" y2="54"/>
                  <line x1="394.4" y1="8" x2="394.4" y2="54"/>
                </g>
                <text id="${hostDivId}_LABEL" class="creditGaugeLabel" x="250" y="82" text-anchor="middle">&hellip;</text>
             </svg>`;
   },

  _paint: function(hostDivId, data)
   {
      let host = document.getElementById(hostDivId);
      let fillEl = document.getElementById(hostDivId+"_FILL");
      let sheenEl = document.getElementById(hostDivId+"_FILL_SHEEN");
      let labelEl = document.getElementById(hostDivId+"_LABEL");
      if (host == null || fillEl == null || labelEl == null)
       return; // widget was re-rendered/removed while the request was in flight

      // balance arrives as a BigDecimal-backed JSON string/number (e.g. "500.0000"): Number(...) both parses it
      // and drops the credits-are-always-whole-units trailing decimals before formatting (same convention as
      // PlansDialog.topUpCredits above).
      let balance = data == null ? 0 : Math.round(Number(data.balance) || 0);
      let hasWallet = data != null && data.hasWallet == true;
      let lastTopUpAmount = data == null ? 0 : Math.round(Number(data.lastTopUpAmount) || 0);

      let low = FloriaPayments.CreditGauge._LOW_MAX;
      let mid = FloriaPayments.CreditGauge._MID_MAX;
      let tier = hasWallet == false || balance < low ? "low" : balance < mid ? "mid" : "high";

      // The denominator shown alongside the balance (see the label below) is the wallet's balance right after
      // its last top-up finished (CreditHelper.getLastTopUpAmount -- any leftover balance from before the
      // top-up PLUS what it added) when known: that's a real, concrete "100%" a user recognizes (e.g. a user
      // sitting at 100 who buys a 1,000+500-bonus Starter pack ends the top-up at 1,600), so spending part of
      // it shows real progress instead of the balance always reading as its own ceiling. Falls back to
      // _MID_MAX (or the balance itself, whichever is bigger) only when no top-up has ever been recorded (e.g.
      // a promo-only wallet). Either way, the denominator can never end up SMALLER than the balance -- e.g. a
      // ledger/cache inconsistency -- which would read as nonsensical (more credits shown than the supposed
      // 100% max): in that case the bar is simply full (100%, "high" tier) with the balance as its own ceiling
      // instead.
      let scaleMax = Math.max(lastTopUpAmount > 0 ? lastTopUpAmount : mid, balance);
      fillEl.setAttribute("class", "creditGaugeFill creditGaugeFill--"+tier);
      let pct = hasWallet == false ? 0 : Math.max(0, Math.min(1, balance / scaleMax));
      let fillWidth = (488*pct).toFixed(1);
      fillEl.setAttribute("width", fillWidth);
      if (sheenEl != null)
       sheenEl.setAttribute("width", fillWidth);

      // "x / y credits" -- y is always shown alongside the current balance so 100% has a concrete, visible
      // meaning instead of being a mystery threshold (see scaleMax above for what y actually is).
      labelEl.textContent = hasWallet == false ? "No credits" : balance.toLocaleString()+" / "+scaleMax.toLocaleString()+" credits";
      host.dataset.creditTier = tier;
      host.dataset.creditBalance = balance;
      host.dataset.hasWallet = hasWallet;
   },

  _paintError: function(hostDivId)
   {
      let labelEl = document.getElementById(hostDivId+"_LABEL");
      if (labelEl != null)
       labelEl.textContent = "N/A";
   },

  /**
   * Opens the full Usage Dashboard (FloriaPayments.PlansDialog.UsageDashboard, via
   * {@link FloriaPayments.PlansDialog#showUsage}), pre-focused on this gauge's own product. This is the real
   * implementation of what was previously a "feature coming soon" placeholder: {@code /svc/user/credits/usage}
   * (see UserCreditsUsage.java) backs the whole dashboard -- trend, cost-breakdown pie and item-level hot
   * spots -- from a single call, so there is no separate popup/dialog owned by CreditGauge itself any more.
   */
  _showDetails: function(basePath, productId)
   {
      FloriaPayments.PlansDialog.showUsage(basePath, productId);
   }
};


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
