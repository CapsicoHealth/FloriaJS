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
       FloriaLogin.PopupLogin.dlgHandle = new FloriaDialog("DLG_POPUPLOGIN");

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
          FloriaLogin.PopupLogin.dlgHandle = new FloriaDialog("DLG_POPUPLOGIN");
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
        FloriaLogin.PopupLogin.dlgHandle = new FloriaDialog("DLG_POPUPLOGIN");
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
       FloriaLogin.PopupLogin.dlgHandle = new FloriaDialog("DLG_POPUPLOGIN");
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
    * Opens the "Plans / Billing" dialog. The actual UI (pricing table, currency selectors, cart/checkout, and
    * billing history) lives in {@link FloriaPayments.PlansDialog}, which owns its own dialog instance rather
    * than sharing this login/session popup: it's rarely-used code (sign-up, upgrade, top-up), so it's cheap to
    * give it its own modal, and it keeps module-payments.js free of any compile-time dependency on this file.
    * This wrapper only exists so existing call sites (app front-ends calling
    * {@code FloriaLogin.PopupLogin.pickPlan()}) keep working unchanged.
    */
   pickPlan: function(genericPlanOnly=false)
    {
      FloriaPayments.PlansDialog.pickPlan(FloriaLogin.Account.basePath, genericPlanOnly);
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
     FloriaLogin.Account.dlgHandle = new FloriaDialog("DLG_POPUP_ACCOUNT");

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
 * Manages the "Your Organizations" popup: lists organizations the current user created or has
 * ACL access to (in two separate sections), and lets the user create/update organizations they
 * own or administer, soft/hard-delete/restore organizations they own (OWNER only), and manage the
 * ACL list of an organization (ADMIN/OWNER only, enforced server-side). Modeled after the Project
 * management UI pattern used in CapsicoWebDynamic's app-shell.js / project-manage.js, using
 * FloriaDialog/FloriaTabs/FloriaTable the same way.
 */
FloriaLogin.PopupOrganizations = {
  dlgHandle      : null,  // list dialog
  manageDlgHandle: null,  // manage (info/ACL tabs) dialog

  // Role definitions (must match OrganizationACL_Data values on the backend). Owner is implicit
  // (the creator) and is never itself grantable/selectable here.
  ROLES: [ { value: "A", label: "Admin"  }
         , { value: "W", label: "Writer" }
         , { value: "R", label: "Reader" }
         ],

  _me: function()
    {
      return window.currentUser?.person?.userRefnum ?? null;
    },

  /** Entry point: shows the list of organizations the user created or has access to. */
  show: function()
    {
      if (FloriaLogin.PopupOrganizations.dlgHandle == null)
       FloriaLogin.PopupOrganizations.dlgHandle = new FloriaDialog("DLG_POPUP_ORGANIZATIONS");
      FloriaLogin.PopupOrganizations.dlgHandle.show("Your Organizations", null, 0.62, 0.78, function(contentDivId) {
          FloriaLogin.PopupOrganizations._renderList(contentDivId);
        });
    },

  _renderList: async function(contentDivId)
    {
      let host = document.getElementById(contentDivId);
      if (host == null)
       return;
      host.innerHTML = '<div class="florgWrap"><br><br><center><img src="/static/img/progress.gif" height="40px"></center></div>';

      let orgs;
      try {
        orgs = await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/list", "GET"
                                            ,"Could not load your organizations. Please try again.", null, null, null, 15000);
      } catch (e) {
        return;
      }
      if (Array.isArray(orgs) == false)
       orgs = [];

      let me     = FloriaLogin.PopupOrganizations._me();
      let mine   = orgs.filter(function(o) { return o.creatorRefnum == me; });
      let shared = orgs.filter(function(o) { return o.creatorRefnum != me; });

      host.innerHTML =
          '<div class="florgWrap">'
        +   '<div class="florgToolbar"><button id="florgNewBtn" class="florgBtn florgBtnPrimary" type="button">+ New Organization</button></div>'
        +   '<div class="florgSection"><h3>Organizations You Created</h3><div id="florgMineHost"></div></div>'
        +   '<div class="florgSection"><h3>Organizations Shared With You</h3><div id="florgSharedHost"></div></div>'
        + '</div>'
        ;

      FloriaDOM.addEvent("florgNewBtn", "click", function() { FloriaLogin.PopupOrganizations._openEditForm(null); }, null, true);

      FloriaLogin.PopupOrganizations._paintOrgList("florgMineHost"  , mine  , true , "You haven't created any organizations yet.");
      FloriaLogin.PopupOrganizations._paintOrgList("florgSharedHost", shared, false, "No organizations have been shared with you yet.");
    },

  _paintOrgList: function(hostId, list, isMine, emptyMsg)
    {
      let host = document.getElementById(hostId);
      if (host == null)
       return;
      if (list.length == 0)
       {
         host.innerHTML = '<div class="florgEmpty">'+emptyMsg+'</div>';
         return;
       }

      let str = '<table class="florgTable"><tr><th>Organization</th><th>Description</th><th>Status</th><th>Last Updated</th></tr>';
      for (let i = 0; i < list.length; ++i)
       {
         let o = list[i];
         let lastUpdated = FloriaDate.parseDateTime(o.lastUpdated);
         str+= '<tr data-refnum="'+o.refnum+'">'
             +   '<td class="florgLink" data-action="manage">'+_floriaLoginEsc(o.title)+'</td>'
             +   '<td>'+_floriaLoginEsc(o.description||"")+'</td>'
             +   '<td>'+(o.status=="AC"?"Active":o.status=="AR"?"Archived":_floriaLoginEsc(o.status))+'</td>'
             +   '<td>'+(lastUpdated==null?"":lastUpdated.printFriendly(true, true))+'</td>'
             + '</tr>'
             ;
       }
      str+='</table>';
      host.innerHTML = str;

      FloriaDOM.addEvent(hostId, "click", function(e, event, target) {
          if (target.nodeName != "BUTTON" && target.dataset.action == null)
           return;
          let tr = FloriaDOM.getAncestorNode(target, "TR", "refnum");
          if (tr == null)
           return;
          let refnum = 1*tr.dataset.refnum;
          let o = list.find(function(x) { return x.refnum == refnum; });
          if (o == null)
           return;
          let action = target.dataset.action;
          if (action == "manage")
           FloriaLogin.PopupOrganizations._openManage(o);
        }, null, true);
    },

  /**
   * Opens a create/update form. `org` is null for a brand new organization, or an existing
   * organization record to update (used both from the "+ New Organization" button and from the
   * Manage dialog's "Organization Info" tab).
   */
  _openEditForm: function(org)
    {
      let createDlg = new FloriaDialog("DLG_POPUP_ORGANIZATION_EDIT");
      let isNew = org == null;
      createDlg.show(isNew==true?"New Organization":"Update Organization", null, 0.45, 0.5, function(contentDivId) {
          document.getElementById(contentDivId).innerHTML = `
            <div class="florgForm">
              <div>
                <label>Organization Title <span class="florgReq">*</span></label>
                <input id="florgEditTitle" type="text" maxlength="1024" value="${_floriaLoginEsc(org?.title)}" placeholder="e.g. Acme Health Systems">
              </div>
              <div>
                <label>Description</label>
                <textarea id="florgEditDesc" rows="4" maxlength="4096" placeholder="Optional free-text description">${_floriaLoginEsc(org?.description||"")}</textarea>
              </div>
              <div id="florgEditErr" class="florgError" style="display:none;"></div>
              <div class="florgActions">
                <button id="florgEditCancel" class="florgBtn" type="button">Cancel</button>
                <button id="florgEditSave" class="florgBtn florgBtnPrimary" type="button">${isNew==true?"Create Organization":"Save Changes"}</button>
              </div>
            </div>
          `;

          document.getElementById("florgEditCancel").addEventListener("click", function() { createDlg.hide(true); });

          document.getElementById("florgEditSave").addEventListener("click", async function() {
              let title = (document.getElementById("florgEditTitle").value||"").trim();
              let desc  = (document.getElementById("florgEditDesc" ).value||"").trim();
              let errEl = document.getElementById("florgEditErr");
              if (title == "")
               {
                 errEl.textContent = "An organization title is required.";
                 errEl.style.display = "block";
                 return;
               }
              errEl.style.display = "none";

              let btn = document.getElementById("florgEditSave");
              btn.disabled = true;
              btn.textContent = "Saving…";
              try {
                let params = { title: title, description: desc };
                if (isNew == false)
                 params.refnum = org.refnum;
                await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/create", "POST"
                          ,"Could not save the organization. Please try again.", null, null, params, 15000);
                createDlg.hide(false);
                if (FloriaLogin.PopupOrganizations.dlgHandle != null)
                 FloriaLogin.PopupOrganizations._renderList(FloriaLogin.PopupOrganizations.dlgHandle.getId());
              } catch (e) {
                btn.disabled = false;
                btn.textContent = isNew==true?"Create Organization":"Save Changes";
              }
            });
        });
    },

  /** Opens the "Manage Organization" dialog (Organization Info + Access Control tabs). */
  _openManage: function(org)
    {
      if (FloriaLogin.PopupOrganizations.manageDlgHandle == null)
       FloriaLogin.PopupOrganizations.manageDlgHandle = new FloriaDialog("DLG_POPUP_ORGANIZATION_MANAGE");
      let isMine = org.creatorRefnum == FloriaLogin.PopupOrganizations._me();
      FloriaLogin.PopupOrganizations.manageDlgHandle.show("Manage Organization", null, 0.64, 0.8, function(contentDivId) {
          let tabs = new FloriaTabs(contentDivId, [
              { label: "Organization Info"   , onSelectHandler: function(panelId, first) { if (first==true) FloriaLogin.PopupOrganizations._renderInfoPanel(panelId, org, isMine); } }
             ,{ label: "Access Control"      , onSelectHandler: function(panelId, first) { if (first==true) FloriaLogin.PopupOrganizations._renderAccessPanel(panelId, org); } }
             ,{ label: "Manage Invitations"  , onSelectHandler: function(panelId, first) { if (first==true) FloriaLogin.PopupOrganizations._renderInvitesPanel(panelId, org); } }
            ], null, null, null, "modern");
          // Stashed so the Access Control tab's "Invite people to get started" CTA (see
          // _loadAclTable's empty-state below) can programmatically switch over to the Manage
          // Invitations tab and auto-open its "+ Invite a new user" form.
          FloriaLogin.PopupOrganizations._manageTabsControl = tabs;
          tabs.show(0);
        });
    },

  _renderInfoPanel: function(panelId, org, isMine)
    {
      let panel = document.getElementById(panelId);
      if (panel == null)
       return;
      let isDeleted = org.deleted != null;
      panel.innerHTML = `
        <div class="florgForm">
          <div>
            <label>Organization Title <span class="florgReq">*</span></label>
            <input id="florgMgrTitle" type="text" maxlength="1024" value="${_floriaLoginEsc(org.title)}">
          </div>
          <div>
            <label>Description</label>
            <textarea id="florgMgrDesc" rows="4" maxlength="4096">${_floriaLoginEsc(org.description||"")}</textarea>
          </div>
          <div id="florgMgrErr" class="florgError" style="display:none;"></div>
          <div class="florgActions">
            <button id="florgMgrSave" class="florgBtn florgBtnPrimary" type="button">Save Changes</button>
          </div>
          <div id="florgMgrBanner" class="florgBanner" style="display:none;"></div>
          ${isMine!=true?"":
             '<hr class="florgHr">'
            +'<div class="florgDangerZone"><h4>Danger Zone</h4>'
            +(isDeleted==false
               ? '<p>Archiving hides this organization from lists. You can restore it later, or permanently delete it afterwards.</p>'
                +'<button id="florgMgrDeleteSoft" class="florgBtn florgBtnDanger" type="button">Archive / Delete</button>'
               : '<p>This organization is currently archived/deleted.</p>'
                +'<button id="florgMgrUndelete" class="florgBtn" type="button">Restore</button>'
                +'<button id="florgMgrDeleteHard" class="florgBtn florgBtnDanger" type="button">Delete Permanently</button>'
              )
            +'<hr class="florgHr">'
            +'<p>Transferring ownership hands full control of this organization to another Admin. You will be downgraded to the "Admin" role, since an organization can only have one Owner.</p>'
            +'<button id="florgMgrTransferBtn" class="florgBtn florgBtnDanger" type="button">Transfer Ownership</button>'
            +'<div id="florgTransferHost" style="display:none;"></div>'
            +'</div>'
          }
        </div>
      `;

      document.getElementById("florgMgrSave").addEventListener("click", async function() {
          let title = (document.getElementById("florgMgrTitle").value||"").trim();
          let desc  = (document.getElementById("florgMgrDesc" ).value||"").trim();
          let errEl = document.getElementById("florgMgrErr");
          if (title == "")
           {
             errEl.textContent = "An organization title is required.";
             errEl.style.display = "block";
             return;
           }
          errEl.style.display = "none";

          let btn = document.getElementById("florgMgrSave");
          btn.disabled = true;
          btn.textContent = "Saving…";
          try {
            let updated = await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/create", "POST"
                      ,"Could not save the organization. Please try again.", null, null
                      ,{ refnum: org.refnum, title: title, description: desc }, 15000);
            org.title = updated.title;
            org.description = updated.description;
            let banner = document.getElementById("florgMgrBanner");
            if (banner != null)
             {
               banner.textContent = "Changes saved.";
               banner.style.display = "block";
               setTimeout(function() { if (banner != null) banner.style.display = "none"; }, 2500);
             }
            if (FloriaLogin.PopupOrganizations.dlgHandle != null)
             FloriaLogin.PopupOrganizations._renderList(FloriaLogin.PopupOrganizations.dlgHandle.getId());
          } catch (e) {
          } finally {
            btn.disabled = false;
            btn.textContent = "Save Changes";
          }
        });

      if (isMine == true)
       {
         let softBtn = document.getElementById("florgMgrDeleteSoft");
         if (softBtn != null)
          softBtn.addEventListener("click", function() { FloriaLogin.PopupOrganizations._doDelete(org, "soft"); });
         let undelBtn = document.getElementById("florgMgrUndelete");
         if (undelBtn != null)
          undelBtn.addEventListener("click", function() { FloriaLogin.PopupOrganizations._doDelete(org, "undelete"); });
         let hardBtn = document.getElementById("florgMgrDeleteHard");
         if (hardBtn != null)
          hardBtn.addEventListener("click", function() { FloriaLogin.PopupOrganizations._doDelete(org, "hard"); });
         let transferBtn = document.getElementById("florgMgrTransferBtn");
         if (transferBtn != null)
          transferBtn.addEventListener("click", function() { FloriaLogin.PopupOrganizations._toggleTransferOwnershipForm(org); });
       }
    },

  /**
   * Toggles the inline "Transfer Ownership" form open/closed inside the Organization Info tab's Danger
   * Zone. Lets the current owner pick any existing ADMIN member of the organization to become the new
   * owner; on confirm, the caller is downgraded to "Admin" since only one Owner can exist per organization.
   */
  _toggleTransferOwnershipForm: async function(org)
    {
      let host = document.getElementById("florgTransferHost");
      let btn  = document.getElementById("florgMgrTransferBtn");
      if (host == null)
       return;

      if (host.style.display != "none")
       {
         host.style.display = "none";
         host.innerHTML = "";
         if (btn != null)
          btn.style.display = "";
         return;
       }

      if (btn != null)
       btn.style.display = "none";
      host.style.display = "block";
      host.innerHTML = '<div class="florgTransferForm"><center><img src="/static/img/progress.gif" height="30px"></center></div>';

      let acls;
      try {
        acls = await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/acl/list?organizationRefnum="+org.refnum+"&orderBy=id"
                                            ,"GET", "Could not load the list of Admin members. Please try again.", null, null, null, 15000);
        if (Array.isArray(acls) == false)
         acls = [];
      } catch (e) {
        host.innerHTML = '<p class="florgError">Failed to load the list of Admin members.</p>';
        return;
      }

      let admins = acls.filter(function(a) { return a.role == "A"; });
      if (admins.length == 0)
       {
         host.innerHTML = '<div class="florgTransferForm"><p class="florgEmpty">There are no other Admin members to transfer ownership to yet. Promote a member to Admin on the Access Control tab first.</p>'
                         +   '<div class="florgActions"><button id="florgTransferCancel" class="florgBtn" type="button">Close</button></div>'
                         + '</div>';
         document.getElementById("florgTransferCancel").addEventListener("click", function() {
             host.style.display = "none";
             host.innerHTML = "";
             if (btn != null)
              btn.style.display = "";
           });
         return;
       }

      let opts = admins.map(function(a) { return '<option value="'+a.userRefnum+'">'+_floriaLoginEsc(a.userId)+'</option>'; }).join("");
      host.innerHTML = `
        <div class="florgTransferForm">
          <div class="florgInviteField">
            <label>New Owner <span class="florgReq">*</span></label>
            <select id="florgTransferSel" class="florgAclRoleSel">${opts}</select>
          </div>
          <div class="florgBanner florgBannerWarning">
            Warning: transferring ownership will downgrade your own role to "Admin". There can be only one Owner per organization.
          </div>
          <div id="florgTransferErr" class="florgError" style="display:none;"></div>
          <div class="florgActions">
            <button id="florgTransferCancel" class="florgBtn" type="button">Cancel</button>
            <button id="florgTransferConfirm" class="florgBtn florgBtnDanger" type="button">Transfer Ownership</button>
          </div>
        </div>
      `;

      document.getElementById("florgTransferCancel").addEventListener("click", function() {
          host.style.display = "none";
          host.innerHTML = "";
          if (btn != null)
           btn.style.display = "";
        });

      document.getElementById("florgTransferConfirm").addEventListener("click", async function() {
          let sel = document.getElementById("florgTransferSel");
          let newOwnerUserRefnum = 1*sel.value;
          let errEl = document.getElementById("florgTransferErr");
          errEl.style.display = "none";

          let confirmBtn = document.getElementById("florgTransferConfirm");
          confirmBtn.disabled = true;
          confirmBtn.textContent = "Transferring…";
          try {
            await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/transferOwnership", "POST"
                      ,"Could not transfer ownership. Please try again.", null, null
                      ,{ organizationRefnum: org.refnum, newOwnerUserRefnum: newOwnerUserRefnum }, 15000);
            if (FloriaLogin.PopupOrganizations.manageDlgHandle != null)
             FloriaLogin.PopupOrganizations.manageDlgHandle.hide(false);
            if (FloriaLogin.PopupOrganizations.dlgHandle != null)
             FloriaLogin.PopupOrganizations._renderList(FloriaLogin.PopupOrganizations.dlgHandle.getId());
          } catch (e) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Transfer Ownership";
          }
        });
    },

  /** Soft/hard-deletes or restores an organization (OWNER-only per OrganizationDelete.java's server-side ACL check). */
  _doDelete: function(org, mode)
    {
      let msg = mode=="hard"     ? "Permanently delete '"+_floriaLoginEsc(org.title)+"'? This cannot be undone."
              : mode=="undelete" ? "Restore '"+_floriaLoginEsc(org.title)+"'?"
              :                    "Archive/delete '"+_floriaLoginEsc(org.title)+"'? You can restore it later, or permanently delete it afterwards."
              ;
      new FloriaAlertSimple(msg, null, mode=="undelete"?"Restore":"Delete", "Cancel", async function() {
          try {
            await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/delete", "POST"
                      ,"Could not update the organization. Please try again.", null, null
                      ,{ refnum: org.refnum, deleteMode: mode }, 15000);
            if (FloriaLogin.PopupOrganizations.manageDlgHandle != null && FloriaLogin.PopupOrganizations.manageDlgHandle.isVisible() == true)
             FloriaLogin.PopupOrganizations.manageDlgHandle.hide(false);
            if (FloriaLogin.PopupOrganizations.dlgHandle != null)
             FloriaLogin.PopupOrganizations._renderList(FloriaLogin.PopupOrganizations.dlgHandle.getId());
          } catch (e) {
          }
        }).show();
    },

  // ── Access Control tab ──────────────────────────────────────────────────────

  /**
   * Renders the Access Control tab: focused purely on existing organization members -- lets an
   * Admin/Owner change a member's role or revoke their access altogether. Inviting new users lives
   * on the separate "Manage Invitations" tab (see _renderInvitesPanel below).
   */
  _renderAccessPanel: function(panelId, org)
    {
      let panel = document.getElementById(panelId);
      if (panel == null)
       return;
      panel.innerHTML = `
        <div class="florgForm florgAclForm">
          <div id="florgAclTblHost" class="florgAclTableHost"></div>
        </div>
      `;

      FloriaLogin.PopupOrganizations._loadAclTable(org);
    },


  // ── Manage Invitations tab ──────────────────────────────────────────────────

  /** Status definitions (must match OrganizationInvite_Data status values on the backend). */
  INVITE_STATUSES: [ { value: "PE", label: "Pending"   }
                    , { value: "AC", label: "Accepted"  }
                    , { value: "DC", label: "Declined"  }
                    , { value: "CN", label: "Cancelled" }
                    , { value: "EX", label: "Expired"   }
                    ],

  _renderInvitesPanel: function(panelId, org)
    {
      let panel = document.getElementById(panelId);
      if (panel == null)
       return;
      let statusOpts = '<option value="">All statuses</option>'
                      + FloriaLogin.PopupOrganizations.INVITE_STATUSES.map(function(s) { return '<option value="'+s.value+'">'+s.label+'</option>'; }).join("");
      panel.innerHTML = `
        <div class="florgForm florgAclForm">
          <div id="florgInvSeats" class="florgSeats"></div>
          <div class="florgInvToolbar">
            <button id="florgInviteBtn" class="florgBtn florgBtnPrimary" type="button">+ Invite a new user</button>
          </div>
          <div id="florgInviteInline" style="display:none;"></div>
          <div class="florgInvTableCard">
            <div class="florgInvTableCardToolbar">
              <label for="florgInvStatusFilter">Filter by status:</label>
              <select id="florgInvStatusFilter" class="florgAclRoleSel">${statusOpts}</select>
            </div>
            <div id="florgInvTblHost" class="florgAclTableHost"></div>
          </div>
        </div>
      `;

      document.getElementById("florgInviteBtn").addEventListener("click", function() {
          FloriaLogin.PopupOrganizations._toggleInviteForm(org, null);
        });
      document.getElementById("florgInvStatusFilter").addEventListener("change", function() {
          FloriaLogin.PopupOrganizations._applyInviteStatusFilter();
        });

      FloriaLogin.PopupOrganizations._loadSeatsBanner(org);
      FloriaLogin.PopupOrganizations._loadInvitesTable(org);
    },

  /** Fetches and paints the "seats used / available" banner based on the owner's promo code, if any. */
  async _loadSeatsBanner(org)
    {
      let host = document.getElementById("florgInvSeats");
      if (host == null)
       return;
      try {
        let usage = await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/promoCodeUsage?organizationRefnum="+org.refnum
                                                  ,"GET", null, null, null, null, 15000);
        host = document.getElementById("florgInvSeats");
        if (host == null)
         return;
        if (usage == null || usage.unlimited == true)
         {
           host.innerHTML = '<span class="florgSeatsUnlimited">Unlimited seats available for new (not-yet-registered) invitees.</span>';
           return;
         }
        let remaining = Math.max(0, usage.maxUsers - usage.count);
        host.innerHTML = '<span class="'+(usage.reached==true?"florgSeatsFull":"florgSeatsOk")+'">'
                        +   usage.count+' of '+usage.maxUsers+' seats used under promo code "'+_floriaLoginEsc(usage.promoCode)+'"'
                        +   (usage.reached==true ? ' &mdash; no seats remaining for new invitees.' : ' &mdash; '+remaining+' seat'+(remaining==1?"":"s")+' remaining.')
                        + '</span>';
      } catch (e) {
        // Non-fatal: simply don't show a seats banner if the check fails.
        host = document.getElementById("florgInvSeats");
        if (host != null)
         host.innerHTML = "";
      }
    },

  /**
   * Toggles an inline "Invite a new user" / "Edit & Resend invitation" form open/closed right
   * inside the Manage Invitations panel (pushing the invite table down below it). When `editInvite`
   * is supplied (an existing pending invite row), the form is pre-filled and submitting cancels the
   * old invite before creating a new one with the updated email/role (an "update and resend").
   */
  _toggleInviteForm: function(org, editInvite)
    {
      let host = document.getElementById("florgInviteInline");
      let btn  = document.getElementById("florgInviteBtn");
      if (host == null)
       return;

      if (host.style.display != "none" && editInvite == null)
       {
         host.style.display = "none";
         host.innerHTML = "";
         if (btn != null)
          btn.style.display = "";
         return;
       }

      if (btn != null)
       btn.style.display = "none";
      host.style.display = "block";
      // Default role for new invites is "Reader" (least-privileged) -- an existing pending invite being
      // edited/resent keeps whatever role it already had.
      let defaultRole = editInvite!=null ? editInvite.role : "R";
      let roleOpts = FloriaLogin.PopupOrganizations.ROLES.map(function(r) { return '<option value="'+r.value+'"'+(defaultRole==r.value?" selected":"")+'>'+r.label+'</option>'; }).join("");
      host.innerHTML = `
        <div class="florgInviteInline">
          <div class="florgInviteRow">
            <div class="florgInviteField">
              <label>First Name <span class="florgReq">*</span></label>
              <input id="florgInviteFName" type="text" maxlength="256" placeholder="First name" value="${_floriaLoginEsc(editInvite?.inviteeNameFirst||"")}">
            </div>
            <div class="florgInviteField">
              <label>Last Name <span class="florgReq">*</span></label>
              <input id="florgInviteLName" type="text" maxlength="256" placeholder="Last name" value="${_floriaLoginEsc(editInvite?.inviteeNameLast||"")}">
            </div>
          </div>
          <div class="florgInviteRow">
            <div class="florgInviteField">
              <label>Email Address <span class="florgReq">*</span></label>
              <input id="florgInviteEmail" type="email" maxlength="256" placeholder="name@example.com" value="${_floriaLoginEsc(editInvite?.inviteeEmail||"")}">
            </div>
            <div class="florgInviteField">
              <label>Role <span class="florgReq">*</span></label>
              <select id="florgInviteRole" class="florgAclRoleSel">${roleOpts}</select>
            </div>
          </div>
          <div id="florgInviteErr" class="florgError" style="display:none;"></div>
          <div class="florgActions">
            <button id="florgInviteCancel" class="florgBtn" type="button">Cancel</button>
            <button id="florgInviteSend" class="florgBtn florgBtnPrimary" type="button">${editInvite!=null?"Update &amp; Resend":"Send Invite"}</button>
          </div>
        </div>
      `;

      document.getElementById("florgInviteCancel").addEventListener("click", function() {
          host.style.display = "none";
          host.innerHTML = "";
          if (btn != null)
           btn.style.display = "";
        });

      document.getElementById("florgInviteSend").addEventListener("click", async function() {
          let fName = (document.getElementById("florgInviteFName").value||"").trim();
          let lName = (document.getElementById("florgInviteLName").value||"").trim();
          let email = (document.getElementById("florgInviteEmail").value||"").trim();
          let role  = document.getElementById("florgInviteRole").value;
          let errEl = document.getElementById("florgInviteErr");
          if (fName == "" || lName == "")
           {
             errEl.textContent = "First and last name are required.";
             errEl.style.display = "block";
             return;
           }
          if (email == "")
           {
             errEl.textContent = "An email address is required.";
             errEl.style.display = "block";
             return;
           }
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) == false)
           {
             errEl.textContent = "Please enter a valid email address.";
             errEl.style.display = "block";
             return;
           }
          errEl.style.display = "none";

          let sendBtn = document.getElementById("florgInviteSend");
          sendBtn.disabled = true;
          sendBtn.textContent = editInvite!=null?"Updating…":"Sending…";
          try {
            if (editInvite != null)
             await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/invite/update", "POST"
                       ,"Could not cancel the previous invitation. Please try again.", null, null
                       ,{ action: "cancel", refnum: editInvite.refnum }, 15000);

            await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/invite/create", "POST"
                      ,"Could not send the invitation. Please try again.", null, null
                      ,{ organizationRefnum: org.refnum, inviteeEmail: email, nameFirst: fName, nameLast: lName, role: role }, 15000);

            host.style.display = "none";
            host.innerHTML = "";
            if (btn != null)
             btn.style.display = "";
            FloriaLogin.PopupOrganizations._loadSeatsBanner(org);
            FloriaLogin.PopupOrganizations._loadInvitesTable(org);
          } catch (e) {
            sendBtn.disabled = false;
            sendBtn.textContent = editInvite!=null?"Update & Resend":"Send Invite";
          }
        });
    },

  _inviteStatusLabel: function(v)
    {
      let s = FloriaLogin.PopupOrganizations.INVITE_STATUSES.find(function(x){return x.value==v;});
      return s==null?v:s.label;
    },

  _applyInviteStatusFilter: function()
    {
      let sel = document.getElementById("florgInvStatusFilter");
      let filterVal = sel==null?"":sel.value;
      let all = FloriaLogin.PopupOrganizations._invitesCache || [];
      let filtered = filterVal==""?all:all.filter(function(i) { return i.status == filterVal; });
      if (FloriaLogin.PopupOrganizations._invitesTable != null)
       FloriaLogin.PopupOrganizations._invitesTable.setData(filtered);
    },

  async _loadInvitesTable(org)
    {
      let host = document.getElementById("florgInvTblHost");
      if (host == null)
       return;

      let invites;
      try {
        invites = await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/invite/list?organizationRefnum="+org.refnum
                                                ,"GET", "Could not load the invitations. Please try again.", null, null, null, 15000);
        if (Array.isArray(invites) == false)
         invites = [];
      } catch (e) {
        host.innerHTML = '<p class="florgError">Failed to load invitations.</p>';
        return;
      }

      FloriaLogin.PopupOrganizations._invitesCache = invites;

      let roleLabel = function(v) { let r = FloriaLogin.PopupOrganizations.ROLES.find(function(x){return x.value==v;}); return r==null?v:r.label; };

      let columns = [
          { field: "inviteeEmail" , label: "Email"       , type: "string"  , wrap: "nowrap", sortable: true, preSorted: "asc" }
         ,{ field: "inviteeNameFirst", label: "Name"      , type: "string"  , wrap: "nowrap", sortable: true
           , renderer: function(row) { return _floriaLoginEsc(((row.inviteeNameFirst||"")+" "+(row.inviteeNameLast||"")).trim()); }
           }
         ,{ field: "role"         , label: "Role"         , type: "string"  , wrap: "clip", minWidth: "90px", sortable: true
           , renderer: function(row) { return roleLabel(row.role); }
           }
         ,{ field: "status"       , label: "Status"       , type: "string"  , wrap: "clip", minWidth: "100px", sortable: true
           , renderer: function(row) { return '<span class="florgInvStatus florgInvStatus-'+row.status+'">'+FloriaLogin.PopupOrganizations._inviteStatusLabel(row.status)+'</span>'; }
           }
         ,{ field: "inviterId"    , label: "Invited By"  , type: "string"  , wrap: "nowrap", sortable: true }
         ,{ field: "created"      , label: "Invited On"  , type: "datetime", wrap: "nowrap", sortable: true }
         ,{ field: "refnum"       , label: ""             , wrap: "clip", minWidth: "160px"
           , renderer: function(row) {
               if (row.status != "PE")
                return "";
               return '<button class="florgBtn florgBtnSmall florgInvEditBtn" data-refnum="'+row.refnum+'" type="button">Edit &amp; Resend</button>'
                    + '<button class="florgBtn florgBtnSmall florgBtnDanger florgInvCancelBtn" data-refnum="'+row.refnum+'" type="button">Cancel</button>';
             }
           }
        ];

      host.innerHTML = "";
      let sel = document.getElementById("florgInvStatusFilter");
      let filterVal = sel==null?"":sel.value;
      let initialData = filterVal==""?invites:invites.filter(function(i) { return i.status == filterVal; });
      FloriaLogin.PopupOrganizations._invitesTable = new FloriaTable("florgInvTblHost", columns, initialData, false, false, false);
      FloriaLogin.PopupOrganizations._invitesTable.render();

      host.addEventListener("click", async function(e) {
          let target = e.target;
          if (target == null || target.nodeName != "BUTTON")
           return;
          let refnum = 1*target.dataset.refnum;
          let invite = invites.find(function(i) { return i.refnum == refnum; });
          if (invite == null)
           return;
          if (target.classList.contains("florgInvEditBtn") == true)
           {
             FloriaLogin.PopupOrganizations._toggleInviteForm(org, invite);
             return;
           }
          if (target.classList.contains("florgInvCancelBtn") == true)
           {
             target.disabled = true;
             target.textContent = "Cancelling…";
             try {
               await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/invite/update", "POST"
                         ,"Could not cancel the invitation. Please try again.", null, null
                         ,{ action: "cancel", refnum: refnum }, 15000);
               FloriaLogin.PopupOrganizations._loadSeatsBanner(org);
               FloriaLogin.PopupOrganizations._loadInvitesTable(org);
             } catch (e2) {
               target.disabled = false;
               target.textContent = "Cancel";
             }
           }
        }, true);
    },

  async _loadAclTable(org)
    {
      let host = document.getElementById("florgAclTblHost");
      if (host == null)
       return;

      let acls;
      try {
        acls = await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/acl/list?organizationRefnum="+org.refnum+"&orderBy=id"
                                            ,"GET", "Could not load the access list. Please try again.", null, null, null, 15000);
        if (Array.isArray(acls) == false)
         acls = [];
      } catch (e) {
        host.innerHTML = '<p class="florgError">Failed to load access list.</p>';
        return;
      }

      if (acls.length == 0)
       {
         host.innerHTML = '<div class="florgEmpty">'
                         +   '<p>No additional members yet.</p>'
                         +   '<button id="florgAclGetStartedBtn" class="florgBtn florgBtnPrimary" type="button">Invite people to get started</button>'
                         + '</div>';
         let btn = document.getElementById("florgAclGetStartedBtn");
         if (btn != null)
          btn.addEventListener("click", function() {
              // Switch over to the "Manage Invitations" tab (index 2), which lazily renders itself
              // synchronously on first select, then "click" its "+ Invite a new user" button so the
              // invite form is immediately open and ready to fill in.
              if (FloriaLogin.PopupOrganizations._manageTabsControl != null)
               FloriaLogin.PopupOrganizations._manageTabsControl.select(2);
              let inviteBtn = document.getElementById("florgInviteBtn");
              if (inviteBtn != null)
               inviteBtn.click();
            });
         return;
       }

      let roleLabel = function(v) { let r = FloriaLogin.PopupOrganizations.ROLES.find(function(x){return x.value==v;}); return r==null?v:r.label; };

      let columns = [
          { field: "userId"     , label: "User"        , type: "string"  , wrap: "nowrap", sortable: true, preSorted: "asc" }
         ,{ field: "role"       , label: "Role"         , type: "string"  , wrap: "clip", minWidth: "110px", sortable: true
           , renderer: function(row) {
               let opts = FloriaLogin.PopupOrganizations.ROLES.map(function(r) { return '<option value="'+r.value+'"'+(row.role==r.value?" selected":"")+'>'+r.label+'</option>'; }).join("");
               return '<select class="florgAclRoleSel" data-refnum="'+row.refnum+'">'+opts+'</select>';
             }
           }
         ,{ field: "grantedById", label: "Granted By"  , type: "string"  , wrap: "nowrap", sortable: true }
         ,{ field: "lastUpdated", label: "Last Updated", type: "datetime", wrap: "nowrap", sortable: true }
         ,{ field: "refnum"     , label: ""             , wrap: "clip", minWidth: "90px"
           , renderer: function(row) { return '<button class="florgAclRevokeBtn" data-refnum="'+row.refnum+'" title="Revoke access">✕ Revoke</button>'; }
           }
        ];

      host.innerHTML = "";
      new FloriaTable("florgAclTblHost", columns, acls, false, false, false).render();

      host.querySelectorAll(".florgAclRoleSel").forEach(function(sel) {
          sel.addEventListener("change", async function() {
              let refnum = 1*sel.dataset.refnum;
              let row = acls.find(function(a) { return a.refnum == refnum; });
              if (row == null)
               return;
              let oldVal = sel.dataset.currentRole || row.role;
              sel.dataset.currentRole = sel.value;
              try {
                await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/acl/create", "POST"
                          ,"Could not update the role. Please try again.", null, null
                          ,{ organizationRefnum: org.refnum, userRefnum: row.userRefnum, role: sel.value }, 15000);
              } catch (e) {
                sel.value = oldVal;
              }
            });
        });

      host.querySelectorAll(".florgAclRevokeBtn").forEach(function(btn) {
          btn.addEventListener("click", async function() {
              let refnum = 1*btn.dataset.refnum;
              btn.disabled = true;
              btn.textContent = "Revoking…";
              try {
                await FloriaAjax.ajaxUrlAsync("/"+FloriaLogin.PopupLogin.basePath+"/svc/wanda/organizations/acl/delete", "POST"
                          ,"Could not revoke access. Please try again.", null, null
                          ,{ organizationRefnum: org.refnum, refnum: refnum }, 15000);
                await FloriaLogin.PopupOrganizations._loadAclTable(org);
              } catch (e) {
                btn.disabled = false;
                btn.textContent = "✕ Revoke";
              }
            });
        });
    }
};



//////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////
//
// UTILITIES
//
//////////////////////////////////////////////////////////////////////////////////////////////////////



 
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Password UI
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function PasswordUI(elementId){
  var element = document.getElementById(elementId);
  if (element == null)
   {
     console.error("Unable to find element with ID = "+elementId+".");
     return;
   }
  var passwordRules = window.passwordRules || [];
  this.passwordRules = passwordRules;
  var str = "<TABLE>";
  for (var i = 0; i < this.passwordRules.length; ++i)
   {
     var pr = this.passwordRules[i];
     str+="<TR class=\"passwordRules\"><TD colspan=\"1\" data-index=\""+i+"\" class=\"error\">"+pr.description+"</TD></TR>";
   }
  str+="</TABLE>";
  FloriaDOM.appendInnerHTML(element.parentNode, str);
  // Gotta re-get the element since it was overwritten by the previous statement, creating a new DOM.
  this.element = document.getElementById(elementId); 
  this.element.addEventListener("keyup", function(){
    var password = this.value;
    var domRules = document.getElementsByClassName("passwordRules");
    for(var i=0;i<domRules.length;i++){
      var item = domRules[i];
      var childEle = item.querySelector('td');
      var index = parseInt(childEle.getAttribute('data-index'));
      if (index == null || isNaN(index) == true)
        continue;
      var passwordRule = passwordRules[index];
      var regexp = new RegExp(passwordRule.rule);
      childEle.classList.remove("success", "error");
      if(regexp.test(password))
        {
          childEle.classList.add("success");
        }
      else
        {
          childEle.classList.add("error");
        }
    }
  });
  this.isValid = function(){
    var password = this.element.value;
    var flag = true;
    for(var i=0;i<this.passwordRules.length;i++){
      var item = this.passwordRules[i];
      var regexp = new RegExp(item.rule);
      flag = regexp.test(password)
      if(!flag){
        break;
      }
    }
    return flag
  }
}



/*
// CSS HEX
--jordy-blue: #7ab0f6ff;
--turquoise: #75dbb8ff;
--chefchaouen-blue: #4c8adbff;
--non-photo-blue: #96d6e1ff;
--thulian-pink: #e87dabff;
--tropical-indigo: #9e94f6ff;

// SCSS Gradient
$gradient-top: linear-gradient(0deg, #7ab0f6ff, #75dbb8ff, #4c8adbff, #96d6e1ff, #e87dabff, #9e94f6ff);
$gradient-right: linear-gradient(90deg, #7ab0f6ff, #75dbb8ff, #4c8adbff, #96d6e1ff, #e87dabff, #9e94f6ff);
$gradient-bottom: linear-gradient(180deg, #7ab0f6ff, #75dbb8ff, #4c8adbff, #96d6e1ff, #e87dabff, #9e94f6ff);
$gradient-left: linear-gradient(270deg, #7ab0f6ff, #75dbb8ff, #4c8adbff, #96d6e1ff, #e87dabff, #9e94f6ff);
$gradient-top-right: linear-gradient(45deg, #7ab0f6ff, #75dbb8ff, #4c8adbff, #96d6e1ff, #e87dabff, #9e94f6ff);
$gradient-bottom-right: linear-gradient(135deg, #7ab0f6ff, #75dbb8ff, #4c8adbff, #96d6e1ff, #e87dabff, #9e94f6ff);
$gradient-top-left: linear-gradient(225deg, #7ab0f6ff, #75dbb8ff, #4c8adbff, #96d6e1ff, #e87dabff, #9e94f6ff);
$gradient-bottom-left: linear-gradient(315deg, #7ab0f6ff, #75dbb8ff, #4c8adbff, #96d6e1ff, #e87dabff, #9e94f6ff);
$gradient-radial: radial-gradient(#7ab0f6ff, #75dbb8ff, #4c8adbff, #96d6e1ff, #e87dabff, #9e94f6ff);
*/
