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

import { FloriaDOM      } from "./module-dom.js";
import { FloriaDialog, FloriaTabs, FloriaAlert, FloriaAlertSimple } from "./module-dialog.js";
import { FloriaAjax     } from "./module-ajax.js";
import { FloriaForms    } from "./module-forms2.js";
import { FloriaDate     } from "./module-date.js";
import { FloriaText     } from "./module-text.js";
import { FloriaControls } from "./module-controls.js";
import { FloriaPayments } from "./module-payments.js";
import { FloriaTable    } from "./module-tables.js";

export var FloriaLogin = { };

window.FloriaLogin = FloriaLogin;

var cacheBuster = new Date().getTime();

FloriaDOM.injectCSSLink("FLORIA_CSS_ANCHOR", true, new URL("./module-login.css?ts="+cacheBuster, import.meta.url).href);

// Small local HTML-escape helper (module-scoped, not exported) used by PopupOrganizations below.
function _floriaLoginEsc(str)
 {
   if (str == null)
    return "";
   return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
 }


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaLogin PopupLogin
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
FloriaLogin.PopupLogin = {
  loginUrl  : null,
  logoutUrl : null,
  isAuthPassthrough: function(path)
    {
      var authPassthroughs = window.authPassthroughs || [];
      var bool = false;
      authPassthroughs.some(function(authPassthrough)
          {
            bool = path.indexOf(authPassthrough) != -1;
            return bool;
          })
      return bool;
    },
  setUrls : function(basePath, login, logout, help)
    {
      FloriaLogin.PopupLogin.basePath = basePath;
      FloriaLogin.PopupLogin.loginUrl = login;
      FloriaLogin.PopupLogin.logoutUrl = "/"+basePath+"/"+logout;
      FloriaLogin.PopupLogin.helpUrl = help;
    },
  loggedIn : false,
  dlgHandle: null,
  showError: function(code, msg, errors)
  {
    var element = FloriaDOM.getElement("MESSAGES", null);
    msg = msg.replaceAll("\n", "<BR>");
    if(element == null)
      {
        alert(msg+"\n\n"+errors.join("\n"));
      }
    else
      {
        var HTML = '<span style="color: red !important;">'+msg+"</span>";
        if(errors != null && errors.length != 0 && errors instanceof Array)
          {
            HTML += '<ul style="color: red !important;">';
            errors.forEach(function(error)
                {
                  HTML += "<li>"+error.p+': '+error.m+"</li>";
                })
           HTML += "</ul>";
          }
        FloriaDOM.setInnerHTML("MESSAGES", HTML);
      }
  },
  init: function(elementIdBase)
    {
      // Data Masking
      let c = FloriaDOM.getCookie("DATAMASKING");
      if (c != null)
       {
         let e = document.getElementById(elementIdBase+"DataMasking");
         if (e != null)
          e.checked = true;
       }

      // RememberMe
      c = FloriaDOM.getCookie("REMEMBERME");
      if (c != null)
       {
         let e = document.getElementById(elementIdBase+"RememberMe");
         if (e != null)
          e.checked = true;
         // Email
         e = document.getElementById(elementIdBase+"Email");
         if (e != null)
          { 
            e.value=c;
            e = document.getElementById(elementIdBase+"Password");
            if (e != null)
             e.focus();
          }
        }
      else
        {
          let e = document.getElementById(elementIdBase+"Email");
          if (e != null)
           e.focus();
        }

      c = FloriaDOM.getCookie("IMPERSONATION");
      if (c != null)
       {
         let e = document.getElementById(elementIdBase+"EmailImpersonation");
         if (e != null)
          e.value=c;
       }      
    },
   createPopup : function(onSuccessFunc, errorMessage, title, url, width, height, Contents, includePromoCode=false)
    {
      width = width || 0.8;
      height = height || 0.66;
      
      if (Contents == null && url == null)
        FloriaDOM.alertThrow(errorMessage);
      if (FloriaLogin.PopupLogin.dlgHandle == null)
       FloriaLogin.PopupLogin.dlgHandle = new FloriaDialog("DLG_POPUPLOGIN", { skin: false });

      this._onSuccessFunc = onSuccessFunc;
//      if (onSuccessFunc != null)
//       FloriaLogin.PopupLogin.dlgHandle.setOnHide(onSuccessFunc);
      // There seems to be an issue sometimes with caching of HTML pages... So we are doing these shenanigans.
      if (url != null)
       {
         if (url.indexOf("?") == -1)
          url += "?";
         url+="&ts="+cacheBuster;
       }

      if (includePromoCode == false)
       FloriaLogin.PopupLogin.dlgHandle.setOnLoad(function() { 
           FloriaLogin.PopupLogin.dlgHandle.setOnLoad(null);
           let e = document.getElementById("signup-promoCode");
           if (e != null)
            {
              e = e.parentNode.parentNode;
              e.style.display = "none";
              e = e.nextElementSibling;
              if (e != null)
               e.style.display = "none";
            }
         });
      FloriaLogin.PopupLogin.dlgHandle.show(title, url, width, height, Contents);
    },
  hide : function()
   {
     FloriaLogin.PopupLogin.dlgHandle.hide();
   },
  show : function(Timeout, onSuccessFunc, titleMsg)
    {
      titleMsg = titleMsg || (Timeout == true ? "Your session has timed out: please login again" : "Please login")
      this.createPopup(onSuccessFunc, "The default url for the popup Login panel has not been set"
                ,titleMsg
                ,FloriaLogin.PopupLogin.loginUrl);
    },
  signIn : function(elementIdBase)
    {
      var Email = FloriaDOM.getElement(elementIdBase+"Email", "Please enter a username and password").value;
      var Pswd = FloriaDOM.getElement(elementIdBase+"Password", "Please enter a password").value;
      var EmailImpersonation = document.getElementById(elementIdBase+"EmailImpersonation");
      if (EmailImpersonation != null)
       EmailImpersonation = EmailImpersonation.value;

      var e = document.getElementById(elementIdBase+"RememberMe");
      var v = e == null ? false : e.checked;
      if (v == true)
       FloriaDOM.setCookie("REMEMBERME", Email, 30);
      else
       FloriaDOM.removeCookie("REMEMBERME");

      var e = document.getElementById(elementIdBase+"DataMasking");
      var v = e == null ? false : e.checked;
      if (v == true)
       FloriaDOM.setCookie("DATAMASKING", 1, 30);
      else
       FloriaDOM.removeCookie("DATAMASKING");

      let butt = document.getElementById(elementIdBase+"SignInButton");
      butt.disabled = true;
      FloriaDOM.addCSS(butt, "formButtonBusy");
      let params = { email: Email, pswd: Pswd, dataMasking: (v==true?1:0) };
      if (FloriaText.isNoE(EmailImpersonation) == false)
       {
         params.emailImpersonation = EmailImpersonation;
         FloriaDOM.setCookie("IMPERSONATION", EmailImpersonation, 1);
       }
      else
        {
          FloriaDOM.removeCookie("IMPERSONATION");
        }
      FloriaAjax.ajaxUrl("/"+FloriaLogin.PopupLogin.basePath+"/svc/Login?"+FloriaDOM.makeUrlParams(params), "POST", null
                        ,function(data) {
                              FloriaDOM.removeCSS(butt, "formButtonBusy");
                              butt.disabled = false;
                              FloriaLogin.PopupLogin.signInOK(data);
                         }
                        ,function(code, msg, errors) {
                              FloriaDOM.removeCSS(butt, "formButtonBusy");
                              butt.disabled = false;
                              FloriaLogin.PopupLogin.signInErr(code, msg, errors);
                         });
      return false;
    },
  signInOK : function(data)
    {
      var tenants = data.tenants
      if(tenants != null)
        {
          FloriaLogin.PopupLogin.tenantsSelect(data.tenants);
          return;
        }
      var eulaUrl = data.eulaUrl;
      if (eulaUrl != null)
        {
          FloriaLogin.PopupLogin.eula(data);
          return;
        }

       if (data.pickPlan == true)
        {
           FloriaLogin.PopupLogin.pickPlan();
           return;
        }
        
      FloriaLogin.PopupLogin.loggedIn = true;
      if (FloriaLogin.PopupLogin.dlgHandle != null)
       {
          FloriaLogin.PopupLogin.dlgHandle.hide();
          if (FloriaLogin.PopupLogin._onSuccessFunc != null)
           {
             // A handler was supplied (e.g. an interrupted-session-resume flow triggered from deep within some
             // other feature, such as the Organizations invite popup). Let it resume/retry whatever it was doing
             // and do NOT force a full page reload -- that would tear down its in-flight state/UI, even though
             // we may currently be sitting on the home page's pathname.
             FloriaLogin.PopupLogin._onSuccessFunc();
             return;
           }
       }
      // No handler to resume: this was a direct sign-in (e.g. from a login form embedded in the home page).
      // If we are already on the home page, reload it cleanly (strips all NVPs); otherwise leave navigation to the caller.
      if (window.location.pathname === '/web/apps/home.jsp')
        window.location.href = '/web/apps/home.jsp';
    },
  signInErr : function(code, msg, errors)
    {
      if (code == 403)
        {
          FloriaLogin.PopupLogin.dlgHandle.show("Your password has expired", null, .75, .25, '<BR><CENTER><H2>You should receive an email shortly with instructions to reset your password.</H2></CENTER>');
        }
      else
        {
          FloriaLogin.PopupLogin.showError(code, msg, errors);
        }
    },
  logout : function()
    {
      FloriaAjax.ajaxUrl("/"+FloriaLogin.PopupLogin.basePath+"/svc/Logout", "GET", "Cannot logout", FloriaLogin.PopupLogin.logoutOK, FloriaLogin.PopupLogin.logoutErr);
    },
  logoutOK: function(data)
   {
      FloriaLogin.PopupLogin.loggedIn = false;
      if (currentUser.user.loginType == 'LO')
       document.location.href=FloriaLogin.PopupLogin.logoutUrl;
      else
       {
         if (FloriaLogin.PopupLogin.dlgHandle == null)
          FloriaLogin.PopupLogin.dlgHandle = new FloriaDialog("DLG_POPUPLOGIN", { skin: false });
         FloriaLogin.PopupLogin.dlgHandle.setCloseable(false);
         let str = '<BR><CENTER><H2>You have been logged out.</H2><BR>Please close this tab.<BR></CENTER>'
         FloriaLogin.PopupLogin.dlgHandle.show("Logout", null, .5, .3, str);
       }
   },
  logoutErr: function(data)
   {
      alert("Error logging out!");
   },
  help : async function()
    {
       let [helpHtml, ticketFormDef] = await Promise.all([FloriaAjax.txtSyncFetch(FloriaLogin.PopupLogin.helpUrl+"?ts="+cacheBuster)
                                                         ,FloriaAjax.jsonSyncFetch("/static/js/admin/TicketFormDef.json?ts="+cacheBuster)
                                                         ]);

       if (FloriaLogin.PopupLogin.dlgHandle == null)
        FloriaLogin.PopupLogin.dlgHandle = new FloriaDialog("DLG_POPUPLOGIN", { skin: false });
       if (FloriaLogin.PopupLogin.loggedIn == false)
        return FloriaLogin.PopupLogin.dlgHandle.show("Quick Help", null, .6, .9, helpHtml);

       FloriaLogin.PopupLogin.dlgHandle.show("Quick Help", null, .6, .9, function(cntId) {
          document.getElementById(cntId).innerHTML='<DIV id="'+cntId+'_TABS" style="position: absolute; width: 100%; top: 0px; bottom: 0px; padding-top: 10px;"></DIV>';
          let tabs = [ {label:"Ask For Help", onSelectHandler:function(cntId, firstRender) {
                           if (firstRender != true)
                            return;
                           let f = new FloriaForms(cntId, {}, ticketFormDef, 1
                                         , function(data, update) {
                                              if (update==false)
                                               return;
                                              FloriaAjax.ajaxUrl("/web/svc/admin/ticket/create?"+FloriaDOM.makeUrlParams(data), "POST", "Getting help failed", function() {
                                                 tabControl.select(2);
                                               }, function() {
                                                 f.reactivateSubmit();
                                               });
                                            }
                                           , null, true, false, false, null, false, true);
                           f.setVerticalLayout(true);
                           f.paint(0);
                       }}
                      ,{label:"Help History", onSelectHandler:function(cntId, firstRender) {
                          FloriaAjax.ajaxUrl("/web/svc/admin/ticket/list?ts="+new Date().getTime(), "GET", "Getting your help history failed", function(data) {
                            if (data == null || data.length == 0)
                             return document.getElementById(cntId).innerHTML = "No help history available at this time";
                       
                            let str = '<TABLE class="tableLayout stickyHeader"><TR><TH align="left">Date</TH><TH align="left">Subject</TH></TR>';
                            for (let i = 0; i < data.length; ++i)
                              {
                                let t = data[i];
                                if (t == null)
                                 continue;
                                let lastUpdated = FloriaDate.parseDateTime(t.lastUpdated);
                                let lastAnswered = FloriaDate.parseDateTime(t.lastAnswered);
                                lastUpdated = lastUpdated == null ? 'N/A' : lastUpdated.printFriendly(true, true);
                                str+=`<TR valign="top" data-refnum="${t.refnum}">
                                         <TD nowrap width="1px">
                                         ${t.lastAnswered == null
                                              ? lastUpdated
                                              +'<BR><IMG src="/static/img/workflow.colored.none.gif" height="20px"> Awaiting answer...'
                                              : t.lastCreatorRefnum == t.creatorRefnum
                                              ? lastAnswered.printFriendly(true, true)
                                               +'<BR><IMG src="/static/img/workflow.in-process.gif" height="20px"> Awaiting follow-up...'
                                              : lastAnswered.printFriendly(true, true)
                                               +'<BR><IMG src="/static/img/workflow.colored.success.gif" height="20px"> Answered by '+t.lastCreatorId
                                          }
                                         </TD>
                                         <TD>${t.subject}</TD>
                                      </TR>
                                     `;
                              }
                             str+='</TABLE><BR><BR>';
                             FloriaDOM.setInnerHTML(cntId, str, null, 5);
                             FloriaDOM.addEvent(cntId, "click", async function(e, event, target) {
                                target = FloriaDOM.getAncestorNode(target, "TR", "refnum");
                                if (target == null)
                                 return;
                                let t = data.getSE(target.dataset.refnum, "refnum");
                                const CapsicoTickets = await import("/static/js/admin/tickets.js");
                                CapsicoTickets.popup(t, function() { tabControl.select(2); });
                              }, null, true);
                          }, function() {
                            f.reactivateSubmit();
                          });
                       }}
                      ,{label:"Browser Tips", onSelectHandler:function(cntId, firstRender) {
                                                if (firstRender != true)
                                                 return;
                                                document.getElementById(cntId).innerHTML = helpHtml;
                       }}
                   ];
          let tabControl = new FloriaTabs(cntId+"_TABS", tabs);
          tabControl.show();
        });
    },
  PickTenant: function(TenantId)
    {
      FloriaAjax.ajaxUrl("/"+FloriaLogin.PopupLogin.basePath+"/svc/Login?tenantUserRefnum=" + TenantId, "POST", "Cannot login", FloriaLogin.PopupLogin.signInOK, FloriaLogin.PopupLogin.signInErr);
      return false;
    },
  tenantsSelect : function(tenants)
    {
    var html = "<DIV class=\"fullCenter capsicoLogo\" style=\"max-height: 80%;overflow: auto;margin-top: 3%\">"
              +"<TABLE cellspacing=\"10px\" border=\"0px\" style=\"font-size:125%; color:black; margin: 0px;padding-bottom:8px\">"
              +"<TR><TD colspan=\"3\">You have successfully logged in and you have access to the following systems.</TD></TR>"
              +"<TR><TD colspan=\"3\">Please select one..</TD></TR>"
              ;
    var tds = []
    var i,j,temparray,chunk = 3;
    for(i=0; i<tenants.length;i++)
      {
        var tenant = tenants[i];
        var element  = "<td style=\"border-radius: 5px; border: 1px solid grey;\">" +
            "<A style=\"text-align: center; padding: 35px; display: block;\" href=\"#\" onclick=\"FloriaLogin.PopupLogin.PickTenant("+tenant.tenantUserRefnum+");\">"+tenant.name+"</A>" +
            "</td>";
        tds.push(element);
        if((i+1) % 3 == 0)
          {
            html += "<tr>"+tds.join("")+"</tr>";
            tds = [];
          }
      }
    if(tds.length > 0)
      html += "<tr>"+tds.join("")+"</tr>";

    html += "</TABLE></DIV>";

    FloriaLogin.PopupLogin.dlgHandle.setTitle("Select A System");
    FloriaLogin.PopupLogin.dlgHandle.setContent(html);
    },
    
   eula: async function(data, justShow)
    {
      let eulaHtml = await FloriaAjax.txtSyncFetch(data.eulaUrl+"?ts="+cacheBuster);
      if (justShow != true)
       eulaHtml+='<HR/><CENTER><FORM id="EULA_FORM" onSubmit="return FloriaLogin.PopupLogin.acceptEula(\'EULA_FORM\');">'
                +'<input type="hidden" name="tenantUserRefnum" value="'+data.tenantUserRefnum+'">'
                +'<input type="hidden" name="eulaToken" value="'+encodeURIComponent(data.eulaToken)+'">'
     //            +'Sign your name: <ineulaput type="text" name="name"><BR>'
                +'I accept this EULA: <input type="checkbox" name="accept" value="1" width="50%"><BR><BR>'
                +'<BUTTON id="login-Eula" class="buttonLogin inForm" type="submit" title="Submit">Submit</BUTTON><BR><BR>'
                ;
      if (FloriaLogin.PopupLogin.dlgHandle == null)
       FloriaLogin.PopupLogin.dlgHandle = new FloriaDialog("DLG_POPUPLOGIN", { skin: false });
      FloriaLogin.PopupLogin.dlgHandle.show("End User License Agreement", null, .6, .9, eulaHtml);
    },
   acceptEula: function(formId)
    {
      var f = document.getElementById(formId);
      var tenantUserRefnum = f.tenantUserRefnum.value;
      var eulaToken = f.eulaToken.value;
      var accept = f.accept.checked == true ? 1 : 0;
      FloriaAjax.ajaxUrl("/"+FloriaLogin.PopupLogin.basePath+"/svc/Login?tenantUserRefnum=" + tenantUserRefnum + "&eulaToken=" + eulaToken + "&accept=" + accept, "POST", null, FloriaLogin.PopupLogin.signInOK, FloriaLogin.PopupLogin.eulaFail);
      return false;
    },
   eulaFail: function(data)
    {
      alert("You must accept the EULA before continuing.");
    },
    
   /**
    * Opens the "Plans / Billing" dialog. The actual UI (pricing table, currency selectors, cart/checkout,
    * Usage dashboard, and billing history) lives in {@link FloriaPayments.PlansDialog}, which owns its own
    * dialog instance rather than sharing this login/session popup: it's rarely-used code (sign-up, upgrade,
    * top-up), so it's cheap to give it its own modal, and it keeps module-payments.js free of any
    * compile-time dependency on this file. This wrapper only exists so existing call sites (app front-ends
    * calling {@code FloriaLogin.PopupLogin.pickPlan()}) keep working unchanged.
    *
    * @param genericPlanOnly see {@link FloriaPayments.PlansDialog#pickPlan}.
    * @param initialTab optional case-insensitive tab to open on instead of the usual default: "usage",
    *        "plans", or "billing". See {@link FloriaPayments.PlansDialog#pickPlan} for the full semantics,
    *        including the smart zero-activity fallback to "plans" when "usage" is requested. The header
    *        account menu's "Plans / Billing" entry (see main.js's populateListMenu) requests "usage".
    */
   pickPlan: function(genericPlanOnly=false, initialTab=null)
    {
      FloriaPayments.PlansDialog.pickPlan(FloriaLogin.Account.basePath, genericPlanOnly, null, initialTab);
    },
   /**
    * Opens the credit top-up popup for a product. See {@link FloriaPayments.PlansDialog#topUpCredits}.
    *
    * @param productId the paymentSystemProductId of the metered product, e.g. "CAPSICO-AGENTIC-01"
    * @param onComplete optional callback invoked after a successful top-up. Supply one to resume whatever the
    *        user was doing; without it the page reloads, which would discard any results already on screen.
    */
   topUpCredits: function(productId, onComplete)
    {
      FloriaPayments.PlansDialog.topUpCredits(FloriaLogin.Account.basePath, productId, onComplete);
    }
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaLogin.PopupSignup PopupSignup
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
FloriaLogin.PopupSignup = {
  Token : null,
  Url: null,
  ElementIdBase: null,
  setUrls : function(basePath, Url, Token)
   {
     FloriaLogin.PopupSignup.basePath = basePath;
     FloriaLogin.PopupSignup.Url = Url;
     FloriaLogin.PopupSignup.Token = Token;
   },
  init: function(elementIdBase, guest)
   {
     FloriaLogin.PopupSignup.guest = guest;
     FloriaLogin.PopupSignup.ElementIdBase = elementIdBase;
     this.passwordUI = new PasswordUI(elementIdBase+"password");
     
     if (guest != true)
      FloriaLogin.PopupSignup.getTokenDetails();

     let email = FloriaDOM.localStorageGet("REGISTRATION_EMAIL")?.email?.trim();
     if (email?.length > 0)
      {
        FloriaDOM.setValue(elementIdBase+"email", email);
        FloriaDOM.setCookie("REMEMBERME", email, 30);
      }
     FloriaDOM.localStorageRemove("REGISTRATION_EMAIL");        
   },
  show: function(onSuccessFunc, includePromoCode) 
   {
     FloriaLogin.PopupLogin.createPopup(onSuccessFunc, "The default url for the popup Signup has not been set"
         ,"Sign Up"
         ,FloriaLogin.PopupSignup.Url, 0.7, 0.8, null, includePromoCode);
   },
  getTokenDetails: function() 
   {
     FloriaAjax.ajaxUrl("/"+FloriaLogin.PopupSignup.basePath+"/svc/user/token?token="+FloriaLogin.PopupSignup.Token, "GET", null, FloriaLogin.PopupSignup.TokenDetailsOK, FloriaLogin.PopupSignup.TokenDetailsErr);
   },
  signUp : function(elementIdBase)
   {
     try {
         if (FloriaLogin.PopupSignup.guest == true)
          {
            let params = {};
            params.promoCode = FloriaDOM.getElement(elementIdBase+"promoCode").value;
            params.email = FloriaDOM.getElement(elementIdBase+"email", "Your email is a mandatory field").value;
            FloriaDOM.localStorageSet("REGISTRATION_EMAIL", { email: params.email });
            params.fName = FloriaDOM.getElement(elementIdBase+"fName", "Your first name is a mandatory field").value;
            params.lName = FloriaDOM.getElement(elementIdBase+"lName", "Your last name is a mandatory field").value;
            FloriaAjax.ajaxUrl("/"+FloriaLogin.PopupSignup.basePath+"/svc/user/guest/registration?"+FloriaDOM.makeUrlParams(params), "POST", null, FloriaLogin.PopupSignup.signUpGuestOK, FloriaLogin.PopupSignup.signUpErr);
            return false;
          }
       
         if(!this.passwordUI.isValid())
          return false;
    
         let params = {};
         params.email = FloriaDOM.getElement(elementIdBase+"email", "Email").value;
         FloriaDOM.localStorageSet("REGISTRATION_EMAIL", params.email);
         params.token = FloriaLogin.PopupSignup.Token;
         params.password = FloriaDOM.getElement(elementIdBase+"password", "Please enter a password").value;
         params.company = FloriaDOM.getElement(elementIdBase+"company").value;
         params.title = FloriaDOM.getElement(elementIdBase+"title").value;
         params.phone = FloriaDOM.getElement(elementIdBase+"phone").value;
         params.country = FloriaDOM.getElement("null_"+elementIdBase+"country").value;
         params.stateProv = FloriaDOM.getElement(elementIdBase+"stateProv").value;
    
         let confirmPswd = FloriaDOM.getElement(elementIdBase+"confirmPassword", "Confirm password").value;
         if(params.password != confirmPswd)
          return FloriaLogin.PopupLogin.showError(400, "Password and confirmation password do not match", null);
         
         FloriaAjax.ajaxUrl("/"+FloriaLogin.PopupSignup.basePath+"/svc/user/onboarding?"+FloriaDOM.makeUrlParams(params), "POST", null, FloriaLogin.PopupSignup.signUpOK, FloriaLogin.PopupSignup.signUpErr);
     } catch(e) {
        console.error("An error occurred: ", e);
        alert("An error occurred:\n"+e);
     }
     return false;
   },
  TokenDetailsOK: function(user)
   {
     let elementIdBase = FloriaLogin.PopupSignup.ElementIdBase;
     let e = document.getElementById(elementIdBase+"email");
     if (e == null)
      setTimeout(function() { FloriaLogin.PopupSignup.TokenDetailsOK(user); }, 25);

//     document.getElementById(elementIdBase+"email").value = user.email;
     document.getElementById(elementIdBase+"fName").value = user.nameFirst;
     document.getElementById(elementIdBase+"lName").value = user.nameLast;
   },
  TokenDetailsErr: function(code, msg, errors)
   {
     FloriaLogin.PopupLogin.createPopup(null, null, "Registration Confirmation Failure", null, .5, .5, "<BR><CENTER><H2>The link to complete your registration has either expired,<BR> or been replaced with a newer request in your inbox.<BR>Please try registering again.</H2></CENTER></BR>");
   },
  signUpOK : function(data)
   {
     alert("You have successfully registered.\nPlease login now and complete your account setup.");
     FloriaLogin.PopupLogin.show();
   },
  signUpGuestOK : function(data)
   {
     FloriaLogin.PopupLogin.createPopup(null, null, "Registration Request Confirmed", null, .5, .5, "<BR><CENTER><H2>An email from notifications@capsicohealth.com<BR>is on its way to you to complete your<BR>registration process.<BR><BR>You can close this browser tab/window.</H2></CENTER></BR>");
   },
  signUpErr : function(code, msg, errors)
   {
     FloriaLogin.PopupLogin.showError(code, msg, errors);
   }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaLogin Forgot password
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
FloriaLogin.ForgotPswd = {
  Url  : null,
  Email: null,
  setUrls : function(basePath, url)
  { 
    FloriaLogin.ForgotPswd.basePath = basePath;
    FloriaLogin.ForgotPswd.Url = url;
  },
  init: function(elementIdBase)
  {
  },
  show : function(onSuccessFunc, popUpTitle)
  {
    var popUpTitle = popUpTitle || "Reset your password";
    FloriaLogin.PopupLogin.createPopup(onSuccessFunc, "The default url for the popup Forgot password panel has not been set"
                ,popUpTitle
                ,FloriaLogin.ForgotPswd.Url);
  },
  forgot : function(elementIdBase)
  {
    var Email = FloriaDOM.getElement(elementIdBase+"Email", "Please enter your registered email id").value;
    if(Email.length > 0)
      {
        FloriaLogin.ForgotPswd.Email = Email;
        FloriaAjax.ajaxUrl("/"+FloriaLogin.ForgotPswd.basePath+"/svc/user/forgotPswd?email=" + encodeURIComponent(Email), "POST", null, FloriaLogin.ForgotPswd.OK, FloriaLogin.ForgotPswd.Err);
      }
    else
      {
        alert("Please enter an email address");
      }
    return false;
  },
  OK : function(data)
  {
     FloriaLogin.PopupLogin.createPopup(null, null, "Password Reset Request Confirmed", null, .5, .5, "<BR><CENTER><H2>An email from notifications@capsicohealth.com<BR>is on its way to you to reset your password.<BR><BR>You can close this browser tab/window.</H2></CENTER></BR>");
  },
  Err : function(code, msg, errors)
  {
    FloriaLogin.PopupLogin.showError(code, msg, errors);
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaLogin Set password
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
FloriaLogin.SetPassword = {
  Url  : null,
  Token: null,
  passwordUI: null,
  setUrls : function(basePath, Url, token)
  { 
    FloriaLogin.SetPassword.basePath = basePath;
    FloriaLogin.SetPassword.Url = Url;
    if(token != null)
      {
        FloriaLogin.SetPassword.Token = token;
      }
  },
  init: function(elementIdBase)
  {
    this.passwordUI = new PasswordUI(elementIdBase+"password");
    var tokenDOM = FloriaDOM.getElement(elementIdBase+"token", "Password reset code");
    tokenDOM.value = FloriaLogin.SetPassword.Token || "";
    var Email = FloriaDOM.getElement(elementIdBase+"email", "Please enter your registered email id");
    Email.value = FloriaLogin.ForgotPswd.Email;
  },
  show : function(onSuccessFunc, popUpTitle)
  {
    popUpTitle = popUpTitle || "Reset your password";
    FloriaLogin.PopupLogin.createPopup(onSuccessFunc, "The default url for the popup Set password panel has not been set"
            ,popUpTitle
            ,FloriaLogin.SetPassword.Url);

  },
  setPassword : function(elementIdBase)
  {
    var email = FloriaDOM.getElement(elementIdBase+"email", "Please enter your registered email id").value;
    var password = FloriaDOM.getElement(elementIdBase+"password", "password").value;
    var confirmPswd = FloriaDOM.getElement(elementIdBase+"confirmPassword", "confirm password").value;
    var token = FloriaDOM.getElement(elementIdBase+"token", "Password reset code").value;
    if(token.length == 0 )
      {
        alert("Please enter the password reset code");
        return false;
      }
    if(email.length == 0 )
      {
        alert("Please enter an email address");
        return false;
      }
    if(!this.passwordUI.isValid())
      {
        alert("Your password doesn't match the rules'");
        return false;
      }
    if(password == confirmPswd)
      {
        FloriaAjax.ajaxUrl("/"+FloriaLogin.SetPassword.basePath+"/svc/user/setPswd?email=" + encodeURIComponent(email)+"&token="+encodeURIComponent(token)+"&password="+encodeURIComponent(password)
                , "POST", null, FloriaLogin.SetPassword.OK, FloriaLogin.SetPassword.Err);
      }
    else
      {
        alert("Your password doesn't match the rules'");
        return false;
      }
    return false;
  },
  OK : function(data)
  {
    alert("Your password was reset. Now please login.");
    window.location.href = FloriaDOM.getUrlPath();
  },
  Err : function(code, msg, errors)
  {
    FloriaLogin.PopupLogin.showError(code, msg, errors);
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaLogin Account
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
FloriaLogin.Account = {
  Url  : null,
  passwordUI: null,
  setUrls : function(basePath, accountUrl, token)
  { 
    FloriaLogin.Account.basePath = basePath;
    FloriaLogin.Account.Url = accountUrl;
  },
  show: function()
  {
    if (FloriaLogin.Account.dlgHandle == null)
     FloriaLogin.Account.dlgHandle = new FloriaDialog("DLG_POPUP_ACCOUNT", { skin: false });

    FloriaLogin.Account.dlgHandle.show("Account Details", FloriaLogin.Account.Url+"?ts="+cacheBuster, 0.75, 0.9);
  },
  eula: async function()
  {
    let data = await FloriaAjax.jsonSyncFetch("/web/svc/user/eula", true, false);
    if (data?.eulaUrl != null)
     return FloriaLogin.PopupLogin.eula(data, true);
    new FloriaAlert("No additional terms available at this time.", 0.5, 0.10).show();
  },
  init: async function(formId)
  {
    this._form = document.getElementById(formId);
    this.passwordUI = new PasswordUI(this._form.elements["newPassword"]);
//    console.log("currentUser: ", currentUser);
    if (currentUser?.person != null)
     {
       FloriaDOM.setValue(this._form.elements["nameFirst"], currentUser.person.nameFirst);
       FloriaDOM.setValue(this._form.elements["nameLast" ], currentUser.person.nameLast );
       FloriaDOM.setValue(this._form.elements["phone"    ], currentUser.person.telMobile);
       FloriaDOM.setValue(this._form.elements["address1" ], currentUser.person.address1 );
       FloriaDOM.setValue(this._form.elements["city"     ], currentUser.person.city     );
       FloriaDOM.setValue(this._form.elements["stateProv"], currentUser.person.stateProv);
       FloriaDOM.setValue(this._form.elements["zipPostal"], currentUser.person.zipPostal);
       if (document.getElementById(formId+"-COUNTRY_COMBO") != null)
        {
          let countries = await FloriaAjax.jsonSyncFetch("/static/floria.v2.0/geo-data/countries.json", false, true);
          let countryNames = countries.map(country => [country.countryNameShort]);
          FloriaControls.ComboBox(formId+"-COUNTRY_COMBO", this._form.id+"-country", countryNames, "Pick a country (optional)", currentUser.person.country);
        }
       FloriaDOM.setValue(this._form.elements["company"  ], currentUser.person.company  );
       FloriaDOM.setValue(this._form.elements["profTitle"], currentUser.person.profTitle);
     }
    if (currentUser?.user != null)
     {
       FloriaDOM.setValue(this._form.elements["email"], currentUser.user.email);
     }

    let str = '<DIV style="padding-left: 3vw; font-size: 75%;">'
               +'<B>Id</B>: '+ FloriaText.print(currentUser?.person?.userRefnum)+'<BR>'
               +'<B>Environment</B>: '+ FloriaText.print(currentUser?.user?.loginDomain)+'<BR>'
               +'<B>Orgnization</B>: '+ FloriaText.print(currentUser?.person?.orgId)+'<BR>'
               +'</DIV>'
             ;
    FloriaDOM.setInnerHTML(this._form.id+"-SYSTEM", str);
  },
  update: function()
  {
    try {
        let currentPassword = FloriaDOM.getElement(this._form.elements["currentPassword"], "ERROR: The current-password field cannot be found!").value;
        if (currentPassword.length == 0)
         {
           alert("For security, please enter your current password to make any changes.");
           return false;
         }
        let newPassword        = FloriaDOM.getElement(this._form.elements["newPassword"       ], "ERROR: The new-password field cannot be found!"        ).value;
        let newPasswordConfirm = FloriaDOM.getElement(this._form.elements["newPasswordConfirm"], "ERROR: The new-password-confirm field cannot be found!").value;
        if (newPassword.length > 0)
         {
           if (this.passwordUI.isValid() == false)
            {
              alert("Your password doesn't meet the system's requirements.");
              return false;
            }
           if(newPassword != newPasswordConfirm)
            {
              alert("Your password and confirmation password do not match.");
              return false;
            }
         }

        let params = {};
        params.currentPassword = currentPassword;
        if (newPassword?.length > 0)
         params.newPassword = newPassword;
        params.email     = FloriaDOM.getElement(this._form.elements["email"    ], "email"    ).value;
        params.nameFirst = FloriaDOM.getElement(this._form.elements["nameFirst"], "nameFirst").value;
        params.nameLast  = FloriaDOM.getElement(this._form.elements["nameLast" ], "nameLast" ).value;
        params.company   = FloriaDOM.getElement(this._form.elements["company"  ], "company"  ).value;
        params.profTitle = FloriaDOM.getElement(this._form.elements["profTitle"], "profTitle").value;
        params.phone     = FloriaDOM.getElement(this._form.elements["phone"    ], "phone"    ).value;
        params.address1  = FloriaDOM.getElement(this._form.elements["address1" ], "address1" ).value;
        params.city      = FloriaDOM.getElement(this._form.elements["city"     ], "city"     ).value;
        params.stateProv = FloriaDOM.getElement(this._form.elements["stateProv"], "stateProv").value;
        params.zipPostal = FloriaDOM.getElement(this._form.elements["zipPostal"], "zipPostal").value;
        params.country   = FloriaDOM.getElement("null_"+this._form.id+"-country", "country"  ).value;

        FloriaAjax.ajaxUrl("/"+FloriaLogin.Account.basePath+"/svc/user/account/update?"+FloriaDOM.makeUrlParams(params) , "POST", null, FloriaLogin.Account.OK, FloriaLogin.Account.Err);
        
     } catch(e) {
        console.error("An error occurred: ", e);
        alert("An error occurred:\n"+e);
     }
    return false;
  },
  OK: function(data)
  {
    FloriaLogin.Account.dlgHandle.hide();
  },
  Err: function(code, msg, errors, type)
  {
    FloriaLogin.PopupLogin.showError(code, msg, errors, FloriaLogin.Account._form);
  }
}

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaLogin Verifications
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
FloriaLogin.Verifications = {
  token: null,
  reloadPage: function()
   {
     window.location.href = window.homePagePath;
   }
 ,EmailVerification: function(basePath, token)
   {
     FloriaAjax.ajaxUrl("/"+basePath+"/svc/Verifications?action=emailVerification&token="+encodeURIComponent(token), "POST", null, FloriaLogin.Verifications.OK, FloriaLogin.Verifications.Err);
   }
 ,OK: function(data)
   {
     alert("Successfully Verified")
     FloriaLogin.Verifications.reloadPage();
   }
 ,Err: function(code, msg, errors)
   {
     FloriaLogin.PopupLogin.showError(code, msg, errors);
   }
};


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaLogin.PopupOrganizations
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Thin delegate to `FloriaOrgs.PopupOrganizations` (module-organizations.js), kept here under its
 * original name for backward compatibility with existing call sites (`FloriaLogin.PopupOrganizations.show()`).
 * The actual implementation -- along with the parallel `FloriaOrgs.PopupProjects` used by
 * CapSensa/Flow Studio -- now lives in module-organizations.js, which is DYNAMICALLY imported here
 * on first use so it isn't loaded on pages that never open this popup.
 */
FloriaLogin.PopupOrganizations = {
  /** Entry point: shows the list of organizations the user created or has access to. */
  show: async function(options)
    {
      let { FloriaOrgs } = await import(new URL("./module-organizations.js", import.meta.url).href);
      FloriaOrgs.basePath = FloriaLogin.PopupLogin.basePath;
      FloriaOrgs.PopupOrganizations.show(options);
    }
};


