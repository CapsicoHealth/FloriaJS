/* ===========================================================================
 * Copyright (C) 2026 CapsicoHealth Inc.
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

// Reusable "manage Organizations" / "manage Projects" popups, built on FloriaDialog/FloriaTabs/
// FloriaTable, so that any app can drop in the same tabbed Info + Access Control (+ app-specific
// extras) dialog without reimplementing the ACL table / role dropdowns / revoke wiring each time.
//
// This module is meant to be DYNAMICALLY imported (`await import(...)`) by call sites, not
// statically imported, since it is only ever needed once a user actually opens one of these
// dialogs. `FloriaLogin.PopupOrganizations` (module-login.js) does exactly that, and simply
// delegates to `FloriaOrgs.PopupOrganizations` below for backward compatibility.
//
// FloriaOrgs.PopupOrganizations and FloriaOrgs.PopupProjects are DELIBERATELY separate, parallel
// entry points (not one generalized "entity" API) -- Organizations and Projects are similar but
// each has its own quirks (Organizations have Invitations + Ownership Transfer; Projects have an
// appScope/organizationRefnum + an inline user-picker for granting access instead of invites), so
// each namespace owns its own show()/_openManage()/panel-rendering methods, sharing only tiny
// private helpers (escaping, role-select rendering) at the bottom of this file.

import { FloriaDOM      } from "./module-dom.js";
import { FloriaDialog, FloriaTabs, FloriaAlertSimple } from "./module-dialog.js";
import { FloriaAjax     } from "./module-ajax.js";
import { FloriaDate     } from "./module-date.js";
import { FloriaTable    } from "./module-tables.js";

export var FloriaOrgs = { };

window.FloriaOrgs = FloriaOrgs;

// Base path prefix for all `/svc/wanda/...` calls below (e.g. "/web", or "" if the app is mounted
// at the root). Callers should set this once, up front, e.g.:
//   FloriaOrgs.basePath = FloriaLogin.PopupLogin.basePath;  // reuse module-login.js's own basePath
// or simply leave it as "" if the app's services live at the domain root.
FloriaOrgs.basePath = "";

// Small local HTML-escape helper (module-scoped, not exported) shared by both popups below.
function _esc(str)
 {
   if (str == null)
    return "";
   return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
 }

function _svc(path)
 {
   return "/" + (FloriaOrgs.basePath || "").replace(/^\/|\/$/g, "") + path;
 }


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaOrgs.PopupOrganizations
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Manages the "Your Organizations" popup: lists organizations the current user created or has
 * ACL access to (in two separate sections), and lets the user create/update organizations they
 * own or administer, soft/hard-delete/restore organizations they own (OWNER only), and manage the
 * ACL list of an organization (ADMIN/OWNER only, enforced server-side).
 */
FloriaOrgs.PopupOrganizations = {
  dlgHandle      : null,  // list dialog
  manageDlgHandle: null,  // manage (info/ACL/invites tabs) dialog
  _cfg           : { },   // last show()'s display config, reused by _openManage()

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

  /**
   * Entry point: shows the list of organizations the user created or has access to.
   *
   * @param {object} [options] - Optional display configuration, all purely additive/backward
   *   compatible (omit entirely for the previous defaults):
   *     dialogWidth, dialogHeight : FloriaDialog size fractions for the LIST dialog (default 0.62/0.78).
   *     manageDialogWidth/Height  : FloriaDialog size fractions for the MANAGE dialog (default 0.64/0.8).
   *     tabsSkin                  : FloriaTabs skin, e.g. "modern"/"classic" (default "modern").
   *     tabsPosition              : FloriaTabs header position: "top"/"bottom"/"left"/"right" (default "top").
   */
  show: function(options)
    {
      FloriaOrgs.PopupOrganizations._cfg = options || { };
      let cfg = FloriaOrgs.PopupOrganizations._cfg;
      // { skin: false }: "Your Organizations" is a global, account-level concept reached from the
      // same header account menu as "Your Account"/"Your EULA"/"Help" (see CapsicoWebStatic's
      // main.js's populateListMenu()) -- it must keep that same neutral/classic chrome consistently
      // across every app, not whichever per-app skin (e.g. Flow Studio's "emerald") happens to be
      // set on the current page. Unlike FloriaOrgs.PopupProjects (deliberately app-skinned, since a
      // project IS that app's own content), Organizations here are the cross-app identity/account
      // surface, so they opt out of the page's global FloriaDialog skin entirely.
      if (FloriaOrgs.PopupOrganizations.dlgHandle == null)
       FloriaOrgs.PopupOrganizations.dlgHandle = new FloriaDialog("DLG_POPUP_ORGANIZATIONS", { skin: false });
      FloriaOrgs.PopupOrganizations.dlgHandle.show("Your Organizations", null, cfg.dialogWidth ?? 0.62, cfg.dialogHeight ?? 0.78, function(contentDivId) {
          FloriaOrgs.PopupOrganizations._renderList(contentDivId);
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
        orgs = await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/list"), "GET"
                                            ,"Could not load your organizations. Please try again.", null, null, null, 15000);
      } catch (e) {
        return;
      }
      if (Array.isArray(orgs) == false)
       orgs = [];

      let me     = FloriaOrgs.PopupOrganizations._me();
      let mine   = orgs.filter(function(o) { return o.creatorRefnum == me; });
      let shared = orgs.filter(function(o) { return o.creatorRefnum != me; });

      host.innerHTML =
          '<div class="florgWrap">'
        +   '<div class="florgToolbar"><button id="florgNewBtn" class="florgBtn florgBtnPrimary" type="button">+ New Organization</button></div>'
        +   '<div class="florgSection"><h3>Organizations You Created</h3><div id="florgMineHost"></div></div>'
        +   '<div class="florgSection"><h3>Organizations Shared With You</h3><div id="florgSharedHost"></div></div>'
        + '</div>'
        ;

      FloriaDOM.addEvent("florgNewBtn", "click", function() { FloriaOrgs.PopupOrganizations._openEditForm(null); }, null, true);

      FloriaOrgs.PopupOrganizations._paintOrgList("florgMineHost"  , mine  , true , "You haven't created any organizations yet.");
      FloriaOrgs.PopupOrganizations._paintOrgList("florgSharedHost", shared, false, "No organizations have been shared with you yet.");
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
             +   '<td class="florgLink" data-action="manage">'+_esc(o.title)+'</td>'
             +   '<td>'+_esc(o.description||"")+'</td>'
             +   '<td>'+(o.status=="AC"?"Active":o.status=="AR"?"Archived":_esc(o.status))+'</td>'
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
           FloriaOrgs.PopupOrganizations._openManage(o);
        }, null, true);
    },

  /**
   * Opens a create/update form. `org` is null for a brand new organization, or an existing
   * organization record to update (used both from the "+ New Organization" button and from the
   * Manage dialog's "Organization Info" tab).
   */
  _openEditForm: function(org)
    {
      let createDlg = new FloriaDialog("DLG_POPUP_ORGANIZATION_EDIT", { skin: false }); // see "Your Organizations" skin note above
      let isNew = org == null;
      createDlg.show(isNew==true?"New Organization":"Update Organization", null, 0.45, 0.5, function(contentDivId) {
          document.getElementById(contentDivId).innerHTML = `
            <div class="florgForm">
              <div>
                <label>Organization Title <span class="florgReq">*</span></label>
                <input id="florgEditTitle" type="text" maxlength="1024" value="${_esc(org?.title)}" placeholder="e.g. Acme Health Systems">
              </div>
              <div>
                <label>Description</label>
                <textarea id="florgEditDesc" rows="4" maxlength="4096" placeholder="Optional free-text description">${_esc(org?.description||"")}</textarea>
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
                await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/create"), "POST"
                          ,"Could not save the organization. Please try again.", null, null, params, 15000);
                createDlg.hide(false);
                if (FloriaOrgs.PopupOrganizations.dlgHandle != null)
                 FloriaOrgs.PopupOrganizations._renderList(FloriaOrgs.PopupOrganizations.dlgHandle.getId());
              } catch (e) {
                btn.disabled = false;
                btn.textContent = isNew==true?"Create Organization":"Save Changes";
              }
            });
        });
    },

  /** Opens the "Manage Organization" dialog (Organization Info + Access Control + Manage Invitations tabs). */
  _openManage: function(org)
    {
      let cfg = FloriaOrgs.PopupOrganizations._cfg || { };
      if (FloriaOrgs.PopupOrganizations.manageDlgHandle == null)
       FloriaOrgs.PopupOrganizations.manageDlgHandle = new FloriaDialog("DLG_POPUP_ORGANIZATION_MANAGE", { skin: false }); // see "Your Organizations" skin note above
      let isMine = org.creatorRefnum == FloriaOrgs.PopupOrganizations._me();
      FloriaOrgs.PopupOrganizations.manageDlgHandle.show("Manage Organization", null, cfg.manageDialogWidth ?? 0.64, cfg.manageDialogHeight ?? 0.8, function(contentDivId) {
          let tabs = new FloriaTabs(contentDivId, [
              { label: "Organization Info"   , onSelectHandler: function(panelId, first) { if (first==true) FloriaOrgs.PopupOrganizations._renderInfoPanel(panelId, org, isMine); } }
             ,{ label: "Access Control"      , onSelectHandler: function(panelId, first) { if (first==true) FloriaOrgs.PopupOrganizations._renderAccessPanel(panelId, org); } }
             ,{ label: "Manage Invitations"  , onSelectHandler: function(panelId, first) { if (first==true) FloriaOrgs.PopupOrganizations._renderInvitesPanel(panelId, org); } }
            ], null, null, null, cfg.tabsSkin ?? "modern", null, cfg.tabsPosition ?? null);
          // Stashed so the Access Control tab's "Invite people to get started" CTA (see
          // _loadAclTable's empty-state below) can programmatically switch over to the Manage
          // Invitations tab and auto-open its "+ Invite a new user" form.
          FloriaOrgs.PopupOrganizations._manageTabsControl = tabs;
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
            <input id="florgMgrTitle" type="text" maxlength="1024" value="${_esc(org.title)}">
          </div>
          <div>
            <label>Description</label>
            <textarea id="florgMgrDesc" rows="4" maxlength="4096">${_esc(org.description||"")}</textarea>
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
            let updated = await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/create"), "POST"
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
            if (FloriaOrgs.PopupOrganizations.dlgHandle != null)
             FloriaOrgs.PopupOrganizations._renderList(FloriaOrgs.PopupOrganizations.dlgHandle.getId());
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
          softBtn.addEventListener("click", function() { FloriaOrgs.PopupOrganizations._doDelete(org, "soft"); });
         let undelBtn = document.getElementById("florgMgrUndelete");
         if (undelBtn != null)
          undelBtn.addEventListener("click", function() { FloriaOrgs.PopupOrganizations._doDelete(org, "undelete"); });
         let hardBtn = document.getElementById("florgMgrDeleteHard");
         if (hardBtn != null)
          hardBtn.addEventListener("click", function() { FloriaOrgs.PopupOrganizations._doDelete(org, "hard"); });
         let transferBtn = document.getElementById("florgMgrTransferBtn");
         if (transferBtn != null)
          transferBtn.addEventListener("click", function() { FloriaOrgs.PopupOrganizations._toggleTransferOwnershipForm(org); });
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
        acls = await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/acl/list?organizationRefnum="+org.refnum+"&orderBy=id")
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

      let opts = admins.map(function(a) { return '<option value="'+a.userRefnum+'">'+_esc(a.userId)+'</option>'; }).join("");
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
            await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/transferOwnership"), "POST"
                      ,"Could not transfer ownership. Please try again.", null, null
                      ,{ organizationRefnum: org.refnum, newOwnerUserRefnum: newOwnerUserRefnum }, 15000);
            if (FloriaOrgs.PopupOrganizations.manageDlgHandle != null)
             FloriaOrgs.PopupOrganizations.manageDlgHandle.hide(false);
            if (FloriaOrgs.PopupOrganizations.dlgHandle != null)
             FloriaOrgs.PopupOrganizations._renderList(FloriaOrgs.PopupOrganizations.dlgHandle.getId());
          } catch (e) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Transfer Ownership";
          }
        });
    },

  /** Soft/hard-deletes or restores an organization (OWNER-only per OrganizationDelete.java's server-side ACL check). */
  _doDelete: function(org, mode)
    {
      let msg = mode=="hard"     ? "Permanently delete '"+_esc(org.title)+"'? This cannot be undone."
              : mode=="undelete" ? "Restore '"+_esc(org.title)+"'?"
              :                    "Archive/delete '"+_esc(org.title)+"'? You can restore it later, or permanently delete it afterwards."
              ;
      new FloriaAlertSimple(msg, null, mode=="undelete"?"Restore":"Delete", "Cancel", async function() {
          try {
            await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/delete"), "POST"
                      ,"Could not update the organization. Please try again.", null, null
                      ,{ refnum: org.refnum, deleteMode: mode }, 15000);
            if (FloriaOrgs.PopupOrganizations.manageDlgHandle != null && FloriaOrgs.PopupOrganizations.manageDlgHandle.isVisible() == true)
             FloriaOrgs.PopupOrganizations.manageDlgHandle.hide(false);
            if (FloriaOrgs.PopupOrganizations.dlgHandle != null)
             FloriaOrgs.PopupOrganizations._renderList(FloriaOrgs.PopupOrganizations.dlgHandle.getId());
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

      FloriaOrgs.PopupOrganizations._loadAclTable(org);
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
                      + FloriaOrgs.PopupOrganizations.INVITE_STATUSES.map(function(s) { return '<option value="'+s.value+'">'+s.label+'</option>'; }).join("");
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
          FloriaOrgs.PopupOrganizations._toggleInviteForm(org, null);
        });
      document.getElementById("florgInvStatusFilter").addEventListener("change", function() {
          FloriaOrgs.PopupOrganizations._applyInviteStatusFilter();
        });

      FloriaOrgs.PopupOrganizations._loadSeatsBanner(org);
      FloriaOrgs.PopupOrganizations._loadInvitesTable(org);
    },

  /** Fetches and paints the "seats used / available" banner based on the owner's promo code, if any. */
  async _loadSeatsBanner(org)
    {
      let host = document.getElementById("florgInvSeats");
      if (host == null)
       return;
      try {
        let usage = await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/promoCodeUsage?organizationRefnum="+org.refnum)
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
                        +   usage.count+' of '+usage.maxUsers+' seats used under promo code "'+_esc(usage.promoCode)+'"'
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
      let roleOpts = FloriaOrgs.PopupOrganizations.ROLES.map(function(r) { return '<option value="'+r.value+'"'+(defaultRole==r.value?" selected":"")+'>'+r.label+'</option>'; }).join("");
      host.innerHTML = `
        <div class="florgInviteInline">
          <div class="florgInviteRow">
            <div class="florgInviteField">
              <label>First Name <span class="florgReq">*</span></label>
              <input id="florgInviteFName" type="text" maxlength="256" placeholder="First name" value="${_esc(editInvite?.inviteeNameFirst||"")}">
            </div>
            <div class="florgInviteField">
              <label>Last Name <span class="florgReq">*</span></label>
              <input id="florgInviteLName" type="text" maxlength="256" placeholder="Last name" value="${_esc(editInvite?.inviteeNameLast||"")}">
            </div>
          </div>
          <div class="florgInviteRow">
            <div class="florgInviteField">
              <label>Email Address <span class="florgReq">*</span></label>
              <input id="florgInviteEmail" type="email" maxlength="256" placeholder="name@example.com" value="${_esc(editInvite?.inviteeEmail||"")}">
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
             await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/invite/update"), "POST"
                       ,"Could not cancel the previous invitation. Please try again.", null, null
                       ,{ action: "cancel", refnum: editInvite.refnum }, 15000);

            await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/invite/create"), "POST"
                      ,"Could not send the invitation. Please try again.", null, null
                      ,{ organizationRefnum: org.refnum, inviteeEmail: email, nameFirst: fName, nameLast: lName, role: role }, 15000);

            host.style.display = "none";
            host.innerHTML = "";
            if (btn != null)
             btn.style.display = "";
            FloriaOrgs.PopupOrganizations._loadSeatsBanner(org);
            FloriaOrgs.PopupOrganizations._loadInvitesTable(org);
          } catch (e) {
            sendBtn.disabled = false;
            sendBtn.textContent = editInvite!=null?"Update & Resend":"Send Invite";
          }
        });
    },

  _inviteStatusLabel: function(v)
    {
      let s = FloriaOrgs.PopupOrganizations.INVITE_STATUSES.find(function(x){return x.value==v;});
      return s==null?v:s.label;
    },

  _applyInviteStatusFilter: function()
    {
      let sel = document.getElementById("florgInvStatusFilter");
      let filterVal = sel==null?"":sel.value;
      let all = FloriaOrgs.PopupOrganizations._invitesCache || [];
      let filtered = filterVal==""?all:all.filter(function(i) { return i.status == filterVal; });
      if (FloriaOrgs.PopupOrganizations._invitesTable != null)
       FloriaOrgs.PopupOrganizations._invitesTable.setData(filtered);
    },

  async _loadInvitesTable(org)
    {
      let host = document.getElementById("florgInvTblHost");
      if (host == null)
       return;

      let invites;
      try {
        invites = await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/invite/list?organizationRefnum="+org.refnum)
                                                ,"GET", "Could not load the invitations. Please try again.", null, null, null, 15000);
        if (Array.isArray(invites) == false)
         invites = [];
      } catch (e) {
        host.innerHTML = '<p class="florgError">Failed to load invitations.</p>';
        return;
      }

      FloriaOrgs.PopupOrganizations._invitesCache = invites;

      let roleLabel = function(v) { let r = FloriaOrgs.PopupOrganizations.ROLES.find(function(x){return x.value==v;}); return r==null?v:r.label; };

      let columns = [
          { field: "inviteeEmail" , label: "Email"       , type: "string"  , wrap: "nowrap", sortable: true, preSorted: "asc" }
         ,{ field: "inviteeNameFirst", label: "Name"      , type: "string"  , wrap: "nowrap", sortable: true
           , renderer: function(row) { return _esc(((row.inviteeNameFirst||"")+" "+(row.inviteeNameLast||"")).trim()); }
           }
         ,{ field: "role"         , label: "Role"         , type: "string"  , wrap: "clip", minWidth: "90px", sortable: true
           , renderer: function(row) { return roleLabel(row.role); }
           }
         ,{ field: "status"       , label: "Status"       , type: "string"  , wrap: "clip", minWidth: "100px", sortable: true
           , renderer: function(row) { return '<span class="florgInvStatus florgInvStatus-'+row.status+'">'+FloriaOrgs.PopupOrganizations._inviteStatusLabel(row.status)+'</span>'; }
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
      FloriaOrgs.PopupOrganizations._invitesTable = new FloriaTable("florgInvTblHost", columns, initialData, false, false, false);
      FloriaOrgs.PopupOrganizations._invitesTable.render();

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
             FloriaOrgs.PopupOrganizations._toggleInviteForm(org, invite);
             return;
           }
          if (target.classList.contains("florgInvCancelBtn") == true)
           {
             target.disabled = true;
             target.textContent = "Cancelling…";
             try {
               await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/invite/update"), "POST"
                         ,"Could not cancel the invitation. Please try again.", null, null
                         ,{ action: "cancel", refnum: refnum }, 15000);
               FloriaOrgs.PopupOrganizations._loadSeatsBanner(org);
               FloriaOrgs.PopupOrganizations._loadInvitesTable(org);
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
        acls = await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/acl/list?organizationRefnum="+org.refnum+"&orderBy=id")
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
              if (FloriaOrgs.PopupOrganizations._manageTabsControl != null)
               FloriaOrgs.PopupOrganizations._manageTabsControl.select(2);
              let inviteBtn = document.getElementById("florgInviteBtn");
              if (inviteBtn != null)
               inviteBtn.click();
            });
         return;
       }

      let roleLabel = function(v) { let r = FloriaOrgs.PopupOrganizations.ROLES.find(function(x){return x.value==v;}); return r==null?v:r.label; };

      let columns = [
          { field: "userId"     , label: "User"        , type: "string"  , wrap: "nowrap", sortable: true, preSorted: "asc" }
         ,{ field: "role"       , label: "Role"         , type: "string"  , wrap: "clip", minWidth: "110px", sortable: true
           , renderer: function(row) {
               let opts = FloriaOrgs.PopupOrganizations.ROLES.map(function(r) { return '<option value="'+r.value+'"'+(row.role==r.value?" selected":"")+'>'+r.label+'</option>'; }).join("");
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
                await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/acl/create"), "POST"
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
                await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/organizations/acl/delete"), "POST"
                          ,"Could not revoke access. Please try again.", null, null
                          ,{ organizationRefnum: org.refnum, refnum: refnum }, 15000);
                await FloriaOrgs.PopupOrganizations._loadAclTable(org);
              } catch (e) {
                btn.disabled = false;
                btn.textContent = "✕ Revoke";
              }
            });
        });
    }
};


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaOrgs.PopupProjects
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Manages a "Manage Project" dialog: Project Info + Access Control tabs, wired to the generic
 * `/svc/wanda/project/*` services. Unlike PopupOrganizations, granting access is done by picking an
 * existing user from an inline user-picker (no invite-by-email flow for Projects), and the danger
 * zone only offers archive/restore/delete (no ownership transfer -- a Project's creator/owner is
 * fixed). Parallel to, but intentionally separate from, PopupOrganizations above.
 */
FloriaOrgs.PopupProjects = {
  manageDlgHandle   : null,  // manage (info/ACL tabs) dialog
  userPickerDlg     : null,
  _cachedOrgUsers   : null,  // fetched once per page session
  _cfg              : { },

  // Role definitions (must match ProjectACL_Data values on the backend). Owner is implicit
  // (the creator) and is never itself grantable/selectable in the ACL table or user-picker.
  ROLES: [ { value: "O", label: "Owner"  }
         , { value: "R", label: "Reader" }
         , { value: "W", label: "Writer" }
         , { value: "A", label: "Admin"  }
         ],

  _me: function()
    {
      return window.currentUser?.person?.userRefnum ?? null;
    },

  /**
   * Opens the "Manage Project" dialog for the given project.
   *
   * @param {object}   project    - The full project record (refnum, title, description, area, appScope, ...).
   * @param {object}   [options]  - { appScope, organizationRefnum, onUpdated, userListUrl,
   *                                  dialogWidth, dialogHeight, tabsSkin, tabsPosition }
   *     appScope           : required for saving Project Info (matches Project_Data.appScope).
   *     organizationRefnum : optional, only if this app's projects are scoped under an Organization.
   *     onUpdated          : optional callback(updatedProject) fired after a successful Info save.
   *     userListUrl        : endpoint used by the "Grant Access" user-picker (default `${basePath}/svc/org/user-list`).
   *     dialogWidth/Height : FloriaDialog size fractions (default 0.62/0.78).
   *     tabsSkin           : FloriaTabs skin (default "modern").
   *     tabsPosition       : FloriaTabs header position: "top"/"bottom"/"left"/"right" (default "top").
   */
  show: function(project, options)
    {
      FloriaOrgs.PopupProjects._cfg = options || { };
      let cfg = FloriaOrgs.PopupProjects._cfg;
      if (FloriaOrgs.PopupProjects.manageDlgHandle == null)
       FloriaOrgs.PopupProjects.manageDlgHandle = new FloriaDialog("DLG_POPUP_PROJECT_MANAGE");
      FloriaOrgs.PopupProjects.manageDlgHandle.show("Manage Project", null, cfg.dialogWidth ?? 0.62, cfg.dialogHeight ?? 0.78, function(contentDivId) {
          FloriaOrgs.PopupProjects._renderManageShell(contentDivId, project, cfg);
        });
    },

  _renderManageShell: function(contentDivId, project, cfg)
    {
      let tabs = new FloriaTabs(contentDivId, [
          { label: "Project Info"    , onSelectHandler: function(panelId, first) { if (first==true) FloriaOrgs.PopupProjects._renderInfoPanel(panelId, project, cfg); } }
         ,{ label: "Access Control"  , onSelectHandler: function(panelId, first) { if (first==true) FloriaOrgs.PopupProjects._renderAccessPanel(panelId, project, cfg); } }
        ], null, null, null, cfg.tabsSkin ?? "modern", null, cfg.tabsPosition ?? null);
      tabs.show(0);
    },

  // ── Tab 1: Project Info ───────────────────────────────────────────────────

  _renderInfoPanel: function(panelId, project, cfg)
    {
      let panel = document.getElementById(panelId);
      if (panel == null)
       return;
      let isMine = project.creatorRefnum == FloriaOrgs.PopupProjects._me();
      let isDeleted = project.deleted != null;
      panel.innerHTML = `
        <div class="florgForm">
          <div>
            <label>Project Title <span class="florgReq">*</span></label>
            <input id="florgPrjTitle" type="text" maxlength="1024" value="${_esc(project.title)}" placeholder="e.g. NSCLC Launch 2026">
          </div>
          <div>
            <label>Description</label>
            <textarea id="florgPrjDesc" rows="4" maxlength="4096" placeholder="Optional free-text description">${_esc(project.description||"")}</textarea>
          </div>
          <div>
            <label>Area</label>
            <input id="florgPrjArea" type="text" maxlength="256" value="${_esc(project.area||"")}" placeholder="e.g. Compliance, Claims, Pharmacovigilance…">
          </div>
          <div id="florgPrjErr" class="florgError" style="display:none;"></div>
          <div class="florgActions">
            <button id="florgPrjSave" class="florgBtn florgBtnPrimary" type="button">Save Changes</button>
          </div>
          <div id="florgPrjBanner" class="florgBanner" style="display:none;"></div>
          ${isMine!=true?"":
             '<hr class="florgHr">'
            +'<div class="florgDangerZone"><h4>Danger Zone</h4>'
            +(isDeleted==false
               ? '<p>Archiving hides this project from lists. You can restore it later, or permanently delete it afterwards.</p>'
                +'<button id="florgPrjDeleteSoft" class="florgBtn florgBtnDanger" type="button">Archive / Delete</button>'
               : '<p>This project is currently archived/deleted.</p>'
                +'<button id="florgPrjUndelete" class="florgBtn" type="button">Restore</button>'
                +'<button id="florgPrjDeleteHard" class="florgBtn florgBtnDanger" type="button">Delete Permanently</button>'
              )
            +'</div>'
          }
        </div>
      `;

      document.getElementById("florgPrjSave").addEventListener("click", async function() {
          let title = (document.getElementById("florgPrjTitle").value||"").trim();
          let desc  = (document.getElementById("florgPrjDesc" ).value||"").trim();
          let area  = (document.getElementById("florgPrjArea" ).value||"").trim();
          let errEl = document.getElementById("florgPrjErr");
          if (title == "")
           {
             errEl.textContent = "A project title is required.";
             errEl.style.display = "block";
             return;
           }
          errEl.style.display = "none";

          let btn = document.getElementById("florgPrjSave");
          btn.disabled = true;
          btn.textContent = "Saving…";
          try {
            let params = { refnum: project.refnum, appScope: cfg.appScope, title: title, description: desc, area: area };
            if (cfg.organizationRefnum != null)
             params.organizationRefnum = cfg.organizationRefnum;
            let updated = await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/project/create"), "POST"
                      ,"Could not save project changes. Please try again.", null, null, params, 15000);
            project.title = updated.title;
            project.description = updated.description;
            project.area = updated.area;
            let banner = document.getElementById("florgPrjBanner");
            if (banner != null)
             {
               banner.textContent = "Changes saved.";
               banner.style.display = "block";
               setTimeout(function() { if (banner != null) banner.style.display = "none"; }, 2500);
             }
            if (typeof cfg.onUpdated == "function")
             cfg.onUpdated(updated);
          } catch (e) {
          } finally {
            btn.disabled = false;
            btn.textContent = "Save Changes";
          }
        });

      if (isMine == true)
       {
         let softBtn = document.getElementById("florgPrjDeleteSoft");
         if (softBtn != null)
          softBtn.addEventListener("click", function() { FloriaOrgs.PopupProjects._doDelete(project, "soft", cfg); });
         let undelBtn = document.getElementById("florgPrjUndelete");
         if (undelBtn != null)
          undelBtn.addEventListener("click", function() { FloriaOrgs.PopupProjects._doDelete(project, "undelete", cfg); });
         let hardBtn = document.getElementById("florgPrjDeleteHard");
         if (hardBtn != null)
          hardBtn.addEventListener("click", function() { FloriaOrgs.PopupProjects._doDelete(project, "hard", cfg); });
       }
    },

  /** Soft/hard-deletes or restores a project (OWNER-only per ProjectDelete.java's server-side ACL check). */
  _doDelete: function(project, mode, cfg)
    {
      let msg = mode=="hard"     ? "Permanently delete '"+_esc(project.title)+"'? This cannot be undone."
              : mode=="undelete" ? "Restore '"+_esc(project.title)+"'?"
              :                    "Archive/delete '"+_esc(project.title)+"'? You can restore it later, or permanently delete it afterwards."
              ;
      new FloriaAlertSimple(msg, null, mode=="undelete"?"Restore":"Delete", "Cancel", async function() {
          try {
            await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/project/delete"), "POST"
                      ,"Could not update the project. Please try again.", null, null
                      ,{ refnum: project.refnum, deleteMode: mode }, 15000);
            if (FloriaOrgs.PopupProjects.manageDlgHandle != null && FloriaOrgs.PopupProjects.manageDlgHandle.isVisible() == true)
             FloriaOrgs.PopupProjects.manageDlgHandle.hide(false);
            if (typeof cfg?.onUpdated == "function")
             cfg.onUpdated(project);
          } catch (e) {
          }
        }).show();
    },

  // ── Tab 2: Access Control ─────────────────────────────────────────────────

  _renderAccessPanel: function(panelId, project, cfg)
    {
      let panel = document.getElementById(panelId);
      if (panel == null)
       return;
      panel.innerHTML = `
        <div class="florgForm florgAclForm">
          <div class="florgActions">
            <button id="florgPrjAclGrantBtn" class="florgBtn florgBtnPrimary" type="button">+ Grant Access</button>
          </div>
          <div id="florgAclTblHost" class="florgAclTableHost"></div>
        </div>
      `;

      document.getElementById("florgPrjAclGrantBtn").addEventListener("click", function() {
          FloriaOrgs.PopupProjects._openUserPicker(project, cfg, function() { FloriaOrgs.PopupProjects._loadAclTable(project); });
        });

      FloriaOrgs.PopupProjects._loadAclTable(project);
    },

  /**
   * Opens a FloriaDialog with a FloriaTable listing all org users. Clicking a selectable row
   * expands an inline role selector + Confirm button directly inside the name cell. On confirm,
   * the ACL is saved and the dialog closes.
   */
  _openUserPicker: async function(project, cfg, onGranted)
    {
      if (FloriaOrgs.PopupProjects._cachedOrgUsers == null)
       {
         try {
           let url = cfg?.userListUrl || _svc("/svc/org/user-list");
           FloriaOrgs.PopupProjects._cachedOrgUsers = await FloriaAjax.ajaxUrlAsync(url, "GET"
                     ,"Could not load the user list. Please try again.", null, null, null, 15000);
           if (Array.isArray(FloriaOrgs.PopupProjects._cachedOrgUsers) == false)
            FloriaOrgs.PopupProjects._cachedOrgUsers = [];
         } catch (e) {
           FloriaOrgs.PopupProjects._cachedOrgUsers = [];
           return;
         }
       }

      if (FloriaOrgs.PopupProjects.userPickerDlg == null)
       FloriaOrgs.PopupProjects.userPickerDlg = new FloriaDialog("DLG_POPUP_PROJECT_USER_PICKER");

      FloriaOrgs.PopupProjects.userPickerDlg.show("Grant Access — Select a User", null, 0.55, 0.8, function(contentDivId) {
          document.getElementById(contentDivId).innerHTML = '<div class="florgUserPickerWrap" id="florgUserPickerTbl"></div>';

          // Track which row is currently expanded.
          let expandedRefnum = null;

          let roleOpts = FloriaOrgs.PopupProjects.ROLES.filter(function(r) { return r.value != "O"; })
                            .map(function(r) { return '<option value="'+r.value+'">'+r.label+'</option>'; }).join("");

          function collapseExpanded()
            {
              if (expandedRefnum == null)
               return;
              let prev = document.getElementById("florgPickExpand-"+expandedRefnum);
              if (prev != null)
               prev.remove();
              expandedRefnum = null;
            }

          let columns = [
              { field: "nameLast", label: "Name", type: "string", wrap: "nowrap", sortable: true, preSorted: "asc"
               , clickable: function(row) { return row.isActive === true && row.isLocked === false; }
               , onClickHandler: function(row) {
                   let same = expandedRefnum === row.refnum;
                   collapseExpanded();
                   if (same == true)
                    return;
                   expandedRefnum = row.refnum;
                   let nameCell = document.getElementById("florgPickName-"+row.refnum);
                   if (nameCell == null)
                    return;
                   let exp = document.createElement("div");
                   exp.className = "florgPickExpand";
                   exp.id = "florgPickExpand-"+row.refnum;
                   exp.innerHTML = '<select class="florgPickRoleSel">'+roleOpts+'</select>'
                                 + '<button class="florgPickConfirmBtn florgBtn florgBtnPrimary" type="button">Confirm</button>'
                                 + '<span class="florgPickExpErr florgError" style="display:none;"></span>';
                   nameCell.appendChild(exp);

                   exp.querySelector(".florgPickConfirmBtn").addEventListener("click", async function(e) {
                       e.stopPropagation();
                       let role    = exp.querySelector(".florgPickRoleSel").value;
                       let btn     = exp.querySelector(".florgPickConfirmBtn");
                       let errSpan = exp.querySelector(".florgPickExpErr");
                       btn.disabled = true;
                       btn.textContent = "Saving…";
                       try {
                         await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/project/acl/create"), "POST"
                                   ,"Could not grant access. Please try again.", null, null
                                   ,{ projectRefnum: project.refnum, userRefnum: row.refnum, role: role }, 15000);
                         FloriaOrgs.PopupProjects.userPickerDlg.hide(false);
                         if (typeof onGranted == "function")
                          onGranted();
                       } catch (e2) {
                         btn.disabled = false;
                         btn.textContent = "Confirm";
                         errSpan.textContent = "Save failed. Please try again.";
                         errSpan.style.display = "inline";
                       }
                     });
                   exp.querySelector(".florgPickRoleSel").addEventListener("click", function(e) { e.stopPropagation(); });
                 }
               , renderer: function(row) {
                   let name = _esc(((row.nameFirst||"")+" "+(row.nameLast||"")).trim());
                   let selectable = row.isActive === true && row.isLocked === false;
                   let reason = row.isLocked === true ? "Account is locked" : "User has not activated their account yet";
                   return '<span id="florgPickName-'+row.refnum+'">'+(selectable==true?name:'<span style="color:var(--muted-fg);" title="'+reason+'">'+name+'</span>')+'</span>';
                 }
               }
             ,{ field: "email", label: "Email", type: "string", wrap: "nowrap", sortable: true }
             ,{ field: "isActive", label: "Available", wrap: "clip", minWidth: "90px", align: "center", sortable: true
               , renderer: function(row) { return row.isActive === true && row.isLocked === false ? "Yes" : "No"; }
               , _sortOverride: function(row) { return row.isActive === true && row.isLocked === false ? 0 : 1; }
               }
            ];

          new FloriaTable("florgUserPickerTbl", columns, FloriaOrgs.PopupProjects._cachedOrgUsers, true, false, true).render();
        });
    },

  // ── ACL table load & wire ─────────────────────────────────────────────────

  _loadAclTable: async function(project)
    {
      let host = document.getElementById("florgAclTblHost");
      if (host == null)
       return;

      let acls;
      try {
        acls = await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/project/acl/list?projectRefnum="+project.refnum+"&orderBy=id")
                                            ,"GET", "Could not load the access list. Please try again.", null, null, null, 15000);
        if (Array.isArray(acls) == false)
         acls = [];
      } catch (e) {
        host.innerHTML = '<p class="florgError">Failed to load access list.</p>';
        return;
      }

      if (acls.length == 0)
       {
         host.innerHTML = '<div class="florgEmpty"><p>No additional members yet. Use "Grant Access" above to add one.</p></div>';
         return;
       }

      let roleLabel = function(v) { let r = FloriaOrgs.PopupProjects.ROLES.find(function(x){return x.value==v;}); return r==null?v:r.label; };

      let columns = [
          { field: "userId"     , label: "User"        , type: "string"  , wrap: "nowrap", sortable: true, preSorted: "asc" }
         ,{ field: "role"       , label: "Role"         , type: "string"  , wrap: "clip", minWidth: "100px", sortable: true
           , renderer: function(row) {
               let opts = FloriaOrgs.PopupProjects.ROLES.filter(function(r) { return r.value != "O"; })
                             .map(function(r) { return '<option value="'+r.value+'"'+(row.role==r.value?" selected":"")+'>'+r.label+'</option>'; }).join("");
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
                await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/project/acl/create"), "POST"
                          ,"Could not update the role. Please try again.", null, null
                          ,{ projectRefnum: project.refnum, userRefnum: row.userRefnum, role: sel.value }, 15000);
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
                await FloriaAjax.ajaxUrlAsync(_svc("/svc/wanda/project/acl/delete"), "POST"
                          ,"Could not revoke access. Please try again.", null, null
                          ,{ projectRefnum: project.refnum, refnum: refnum }, 15000);
                await FloriaOrgs.PopupProjects._loadAclTable(project);
              } catch (e) {
                btn.disabled = false;
                btn.textContent = "✕ Revoke";
              }
            });
        });
    }
};
