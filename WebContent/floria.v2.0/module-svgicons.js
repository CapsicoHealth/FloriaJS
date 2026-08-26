/* ===========================================================================
 * Copyright (C) 2025 CapsicoHealth Inc.
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

// Define SVG as a function or template literal for "plug & play"
export const FloriaSVGIcons = { };

// Neutral Blue variable for consistency across enterprise apps
FloriaSVGIcons.COLORS = {
  neutralBlue: "#5Aa0f2"
 ,successGreen: "#10B981" // Often used for 'public' in enterprise
 ,gray: "#6B7280"         // Neutral for secondary assets
 ,primary: "#3B82F6"      // Standard user blue
 ,warningOrange: "#F97316" // Warm red/orange for empty/warning states
};


FloriaSVGIcons.ICONS = { };

// Generic wrapper to keep your paths clean and reusable
const svgWrapper = (content, title, color=FloriaSVGIcons.COLORS.neutralBlue, size = "1.1em", fill="none") => `
  <svg ${size==null?'':`width="${size}" height="${size}"`} viewBox="0 0 24 24" fill="${fill}" 
       ${color==null?'':`stroke="${color}"`} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${title ? `<title>${title}</title>` : ''}
    ${content}
  </svg>`;

// USER (Individual ownership)
FloriaSVGIcons.ICONS.USER = (title, color, size) => svgWrapper(`
  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
  <circle cx="12" cy="7" r="4"></circle>
`, title, color, size);

// GROUP (Internal Public / Shared)
FloriaSVGIcons.ICONS.GROUP = (title, color=FloriaSVGIcons.COLORS.successGreen, size) => svgWrapper(`
  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
  <circle cx="9" cy="7" r="4"></circle>
  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
`, title, color, size);


FloriaSVGIcons.ICONS.UNLOCKED = (title, color=FloriaSVGIcons.COLORS.successGreen, size) => svgWrapper(`
  <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
`, title, color, size);

FloriaSVGIcons.ICONS.LOCKED = (title, color, size) => svgWrapper(`
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
`, title, color, size);

// EMPTY (X in circle for empty states)
FloriaSVGIcons.ICONS.EMPTY = (title, color=FloriaSVGIcons.COLORS.warningOrange, size) => svgWrapper(`
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="15" y1="9" x2="9" y2="15"></line>
  <line x1="9" y1="9" x2="15" y2="15"></line>
`, title, color, size);


FloriaSVGIcons.ICONS.RIGHT_ARROW = (title, color=FloriaSVGIcons.COLORS.primary, size) => svgWrapper(`
  <path d="M4 10h12M12 6l4 4-4 4"></path>
`, title, color, size);


FloriaSVGIcons.ICONS.DOC = (title, color=FloriaSVGIcons.COLORS.primary, size) => svgWrapper(`
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
`, title, color, size);

FloriaSVGIcons.ICONS.BOOKMARK = (title, color=FloriaSVGIcons.COLORS.primary, size) => svgWrapper(`
  <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
`, title, color, size);


FloriaSVGIcons.ICONS.BOOKMARK_FILLED = (title, color=FloriaSVGIcons.COLORS.primary, size, fill=FloriaSVGIcons.COLORS.successGreen) => svgWrapper(`
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
`, title, color, size, fill);

// DOCLIBRARY (document folder — document library / management)
FloriaSVGIcons.ICONS.DOCLIBRARY = (title, color=FloriaSVGIcons.COLORS.primary, size) => svgWrapper(`
  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
`, title, color, size);

// UPLOAD (flat tray line + up arrow — classic "upload" visual)
FloriaSVGIcons.ICONS.UPLOAD = (title, color=FloriaSVGIcons.COLORS.primary, size) => svgWrapper(`
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="17 8 12 3 7 8"/>
  <line x1="12" y1="3" x2="12" y2="15"/>
`, title, color, size);

// DASHBOARD (rising trend line with data points on axes — activity / processing dashboard)
FloriaSVGIcons.ICONS.DASHBOARD = (title, color=FloriaSVGIcons.COLORS.gray, size) => svgWrapper(`
  <path d="M3 3v18h18"/>
  <polyline points="6 16 10.5 11 14 13.5 20 6"/>
  <circle cx="6" cy="16" r="1.1" fill="${color}"/>
  <circle cx="10.5" cy="11" r="1.1" fill="${color}"/>
  <circle cx="14" cy="13.5" r="1.1" fill="${color}"/>
  <circle cx="20" cy="6" r="1.1" fill="${color}"/>
`, title, color, size);

// STETHOSCOPE (a doctor's stethoscope — used to represent a clinical/healthcare "encounter",
// far more recognizable at small icon sizes than a literal physician-and-patient illustration)
FloriaSVGIcons.ICONS.STETHOSCOPE = (title, color=FloriaSVGIcons.COLORS.gray, size) => svgWrapper(`
  <path d="M11 2v2"/>
  <path d="M5 2v2"/>
  <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/>
  <path d="M8 15a6 6 0 0 0 12 0v-3"/>
  <circle cx="20" cy="10" r="2"/>
`, title, color, size);
