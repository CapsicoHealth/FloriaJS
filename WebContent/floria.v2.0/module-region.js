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

// ─────────────────────────────────────────────────────────────────────────────
// FloriaRegion — a tiny, platform-wide "which geography am I demoing?" switch.
// ─────────────────────────────────────────────────────────────────────────────
// Two ways to change it, both by design (no visible UI control -- see the header note on
// _installHiddenToggle below):
//
//   1. A "?region=EU" (or "region=USA") URL query parameter. Applying it is a ONE-TIME
//      action: the very first page load that carries the parameter persists the choice to
//      localStorage and then strips the parameter back out of the address bar (via
//      history.replaceState), so the URL itself doesn't look like what's "in control" going
//      forward, and a plain bookmark/refresh doesn't silently reset anything. This makes it
//      trivial to email/Slack someone a link that flips their browser into EU demo mode, or for
//      a presenter to bounce back and forth between tabs/links during a live demo.
//   2. A hidden keyboard shortcut (Ctrl+Alt+Shift+R) that cycles the region and reloads --
//      see _installHiddenToggle.
//
// Persisted under one localStorage key, platform-wide (not scoped to any one app), so the
// choice follows the user across every Capsico app sharing this FloriaJS install. Default is
// "USA" -- an absent/corrupt localStorage value, or any value that isn't a known region, is
// always treated as "USA", never as an error.
export const FloriaRegion = {};

const LS_KEY        = "floria:region";
const VALID_REGIONS = ["USA", "EU"];
const DEFAULT_REGION = "USA";

FloriaRegion.getRegion = function()
 {
   try {
     const v = window.localStorage.getItem(LS_KEY);
     return VALID_REGIONS.indexOf(v) >= 0 ? v : DEFAULT_REGION;
   } catch (e) { return DEFAULT_REGION; }
 };

FloriaRegion.setRegion = function(region)
 {
   if (VALID_REGIONS.indexOf(region) < 0) return;
   try { window.localStorage.setItem(LS_KEY, region); } catch (e) { /* private-mode/quota: no-op */ }
 };

FloriaRegion.isEU = function() { return FloriaRegion.getRegion() === "EU"; };

// ── 1. URL override, applied once then scrubbed from the address bar ──────────────────────
function _applyUrlOverride()
 {
   const url    = new URL(window.location.href);
   const region = url.searchParams.get("region");
   if (region == null) return;
   const normalized = region.toUpperCase();
   if (VALID_REGIONS.indexOf(normalized) < 0) return;
   FloriaRegion.setRegion(normalized);
   url.searchParams.delete("region");
   history.replaceState(null, "", url.toString());
 }

// ── 2. Hidden keyboard shortcut ─────────────────────────────────────────────────────────────
// Deliberately NOT a visible button anywhere in the UI: this exists for internal
// demos/screenshots/testing, not as an end-user-facing feature, so it stays undiscoverable
// short of someone being told the combo (or reading this file). Reloads immediately after
// switching so every already-rendered panel (map, KPIs, etc.) picks up the new region cleanly
// rather than trying to hot-swap state in a dozen already-open views.
function _installHiddenToggle()
 {
   window.addEventListener("keydown", function(e) {
     if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === "R" || e.key === "r"))
      {
        const next = FloriaRegion.isEU() ? "USA" : "EU";
        FloriaRegion.setRegion(next);
        console.log("[FloriaRegion] switched to " + next + " -- reloading...");
        window.location.reload();
      }
   });
 }

// Self-initializing: any page that imports this module (even just for the side effect) gets
// both behaviors for free, with no per-app wiring required beyond the import itself.
_applyUrlOverride();
_installHiddenToggle();
