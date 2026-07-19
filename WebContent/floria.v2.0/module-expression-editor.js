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

import { FloriaDOM                                            } from "./module-dom.js";
import { FloriaText                                           } from "./module-text.js";
import { FloriaTabs, FloriaTooltipDialog, FloriaAlertSimple   } from "./module-dialog.js";
import { FloriaFactories                                      } from "./module-factories.js";

FloriaDOM.injectCSSLink("FLORIA_CSS_ANCHOR", true, new URL("./module-expression-editor.css", import.meta.url).pathname);

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FloriaExpressionEditor
//
// A generic point-and-click editor (+ read-only preview) for an AND/OR/NOT/nested boolean expression
// tree over an arbitrary, caller-supplied vocabulary of "variables" and "functions". The component only
// ever produces/consumes the generic JSON tree below — it has no knowledge of, or dependency on, how any
// backend later interprets/compiles that tree (that is entirely out of scope for this component).
//
// JSON tree shape (an array of "items", evaluated as a left-to-right fold):
//   [ {                        "expr": { "var":"...", "f":"...", "vals":["..."] } }
//    ,{ "op":"and"|"or"        ,"expr": { ... } }
//    ,{ "op":"and"|"or", "not":true, "sub": [ ...same shape recursively... ] }
//   ]
//   . the first item is the base value (any "op" it carries is ignored)
//   . each subsequent item supplies "op" combining its own value with the running accumulated result
//   . an item's value comes from either "expr" (a leaf test) or "sub" (a nested array, evaluated with
//     this same fold rule, then treated as one grouped/parenthesized value)
//   . "not":true on an item negates that item's own value (leaf or whole nested group)
//
// Constructor config:
//   {
//     vars       : [ { name, label, picker, pickerParams } ... ]   – REQUIRED, the selectable "var"
//                                              vocabulary. "picker"/"pickerParams" are OPTIONAL per
//                                              entry: when present, "picker" names a component
//                                              registered with FloriaFactories.PickerRegistry (same
//                                              convention as RULE_CODE_TYPES in
//                                              module-cohorts-sub-builder.js — e.g. 'DxCode',
//                                              'DrgCode', 'HCPCSCode', 'PrcCode') and "pickerParams"
//                                              is passed straight through as that Picker's params.
//                                              Whenever a leaf's "var" matches such an entry, the
//                                              Editor tab renders that Picker (a "Pick" link +
//                                              selected-values box) instead of the plain chip/
//                                              text-input UI, letting users pick codes instead of
//                                              typing them. Any var WITHOUT a "picker" (or the whole
//                                              editor in readOnly mode) always falls back to the
//                                              plain string chip/text-input UI.
//     functions  : [ { name, label } ... ]   – REQUIRED, the selectable "f" vocabulary
//     initialTree: [...]                     – optional, a tree in the shape above (default: [])
//     readOnly   : boolean                   – optional, hides add/delete/move controls (default: false)
//     showTabJSON: boolean                   – optional, shows a "JSON" tab (the raw tree, for
//                                              developers/integrators) alongside Editor/Preview
//                                              (default: false — hidden, since end users have no
//                                              business seeing/copying raw JSON)
//     initialTab : number|string             – optional, which tab is active on first render:
//                                              either a numeric index (0-based, same tabs order as
//                                              rendered — "Editor","Preview", and "JSON" only if
//                                              showTabJSON is true) or a tab's label as a
//                                              case-insensitive string (e.g. "Preview") — handy
//                                              when the caller already knows there's data worth
//                                              previewing rather than defaulting into the (empty)
//                                              Editor tab (default: 0, the "Editor" tab)
//     onChange   : function(tree)            – optional, called after every mutation
//     domain     : { relate(exprA, exprB) }  – optional, pluggable domain module for the tautology/
//                                              contradiction checker. relate() is only ever called for
//                                              two leaves sharing the same "var", and should return
//                                              "implies" (exprA true => exprB true), "exclusive"
//                                              (exprA and exprB can never both be true), or null/anything
//                                              else (no known relationship). Without a domain module the
//                                              checker still catches purely *structural* issues (the same
//                                              leaf repeated both plain and negated somewhere in the tree).
//     descriptionLookup: async function(entries) – optional, and DELIBERATELY the only bridge between this
//                                              reusable framework and any application-layer "what does this
//                                              code actually mean" lookup (e.g. CohortHelpers.buildCodesDictionary
//                                              in module-cohort-helpers.js) — Floria itself has no business
//                                              knowing about medical codes, so it never fetches descriptions
//                                              on its own. `entries` is an array of
//                                              [ { var:"xxx", values:[ {val:"aaa", descr:null}, ... ] }, ... ]
//                                              — one entry per var, containing only the codes NOT YET in this
//                                              instance's own cache (deduplicated across the whole tree — a
//                                              code used twice under the same var is only ever asked for
//                                              once). The handler must fill in each value's "descr" (in
//                                              place) and resolve its returned Promise when done; whatever
//                                              it leaves behind (including leaving "descr" null for a code it
//                                              can't describe) is cached forever, so the same var/code pair
//                                              is never looked up again even if later removed and re-added
//                                              to the expression. Only called when the Preview tab is shown
//                                              AND at least one new/uncached code is present. Vars that never
//                                              resolve any description at all (e.g. free-text vars, or a
//                                              "like" prefix pattern instead of a discrete code) simply keep
//                                              rendering their flat, quoted values list, unchanged.
//   }
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ── Small internal helpers (not exported) ─────────────────────────────────────────────────────────────

function _esc(str)
 {
   if (str == null)
    return '';
   return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
 }

function _labelFor(list, name)
 {
   if (list == null)
    return name;
   for (var i = 0; i < list.length; ++i)
    if (list[i].name === name)
     return list[i].label != null ? list[i].label : list[i].name;
   return name == null ? '(none)' : name + ' (?)';
 }

// Returns the full {name,label,picker,pickerParams} vars-vocabulary entry for a given var name (or
// null if not found/no vars configured) — used to decide whether a leaf's values UI should render
// a custom Picker (see _renderLeaf/_mountPendingPickers) instead of the plain chip/text-input.
function _varMeta(list, name)
 {
   if (list == null)
    return null;
   for (var i = 0; i < list.length; ++i)
    if (list[i].name === name)
     return list[i];
   return null;
 }

// JSON.stringify's own pretty-printing puts every array element on its own line, even for a short
// "vals" array of a handful of plain strings — needlessly bloating the JSON view with a vertical
// wall of one-item-per-line noise. Rather than hand-rolling a custom JSON serializer just to
// control this, this is the well-known "stringify then collapse" trick: run the normal
// JSON.stringify(obj, null, 2) first, then a single regex collapses any array that contains ONLY
// scalars (i.e. no nested "{"/"[" — so no objects/arrays inside, which structural arrays like
// "sub" or the top-level tree itself always have at least one of) back onto a single line, e.g.
// "vals": [\n  "a",\n  "b"\n] → "vals": ["a", "b"]. Leaves every other array/object untouched.
function _compactScalarArrays(jsonStr)
 {
   return jsonStr.replace(/\[\n\s*([^{}\[\]]+?)\n\s*\]/g, function(match, inner) {
     return '[' + inner.replace(/\s*\n\s*/g, ' ').trim() + ']';
   });
 }

// Same "stringify then collapse" trick as _compactScalarArrays above, but for OBJECTS: collapses
// any object that itself contains no further nested object (only scalar fields and/or an
// already-inlined array — "[" / "]" are fine, just no more "{" / "}") back onto a single line. In
// this tree shape that's exactly a leaf's "expr": {"var":...,"f":...,"vals":[...]} object — so
// applying this AFTER _compactScalarArrays (which inlines "vals" first) prints a whole leaf
// condition on one compact line, while structural objects that DO have further nesting (a rule
// item wrapping "expr", a "sub" array, the top-level tree) are left alone.
function _compactLeafObjects(jsonStr)
 {
   return jsonStr.replace(/\{\n\s*([^{}]+?)\n\s*\}/g, function(match, inner) {
     return '{ ' + inner.replace(/\s*\n\s*/g, ' ').trim() + ' }';
   });
 }

// Combines both collapse passes above into the one compaction step callers actually need.
function _compactJson(jsonStr)
 {
   return _compactLeafObjects(_compactScalarArrays(jsonStr));
 }

// path semantics: an array of indices, e.g. [2,1] means tree[2].sub[1]. Each successive index after the
// first is reached by walking through the PREVIOUS item's ".sub" array.
function _resolveContainer(root, path)
 {
   var list = root;
   for (var i = 0; i < path.length; ++i)
    list = list[path[i]].sub;
   return list;
 }

function _resolveItem(root, path)
 {
   var list = root;
   for (var i = 0; i < path.length - 1; ++i)
    list = list[path[i]].sub;
   var index = path[path.length - 1];
   return { list: list, index: index, item: list[index] };
 }

function _normalizeList(list)
 {
   if (!Array.isArray(list))
    return;
   for (var i = 0; i < list.length; ++i)
    {
      var item = list[i];
      if (i === 0)
       delete item.op;
      else if (item.op !== 'and' && item.op !== 'or')
       item.op = 'and';
      if (item.sub != null)
       _normalizeList(item.sub);
    }
 }

// ── Tautology / contradiction analysis (pure function, no DOM — usable standalone) ────────────────────

function _atomKeyOf(expr)
 {
   var vals = Array.isArray(expr.vals) ? expr.vals.map(String).slice().sort() : [];
   return JSON.stringify({ v: expr.var, f: expr.f, vals: vals });
 }

function _collectAtoms(list, atomMap)
 {
   if (!Array.isArray(list))
    return;
   for (var i = 0; i < list.length; ++i)
    {
      var item = list[i];
      if (item.expr != null)
       {
         var key = _atomKeyOf(item.expr);
         if (atomMap.has(key) === false)
          atomMap.set(key, { index: atomMap.size, expr: item.expr });
       }
      else if (item.sub != null)
       _collectAtoms(item.sub, atomMap);
    }
 }

function _evalList(list, assign, atomMap)
 {
   if (!Array.isArray(list) || list.length === 0)
    return true; // an empty group imposes no restriction
   var acc = _evalItem(list[0], assign, atomMap);
   for (var i = 1; i < list.length; ++i)
    {
      var item = list[i];
      var v = _evalItem(item, assign, atomMap);
      acc = (item.op === 'or') ? (acc || v) : (acc && v);
    }
   return acc;
 }

function _evalItem(item, assign, atomMap)
 {
   var v = item.expr != null ? assign[atomMap.get(_atomKeyOf(item.expr)).index] : _evalList(item.sub, assign, atomMap);
   return item.not === true ? !v : v;
 }

// Best-effort structural hint: an atom that appears both "as-is" and negated somewhere in the tree.
// This is a helpful pointer even when the overall tree isn't a strict, provable tautology/contradiction
// (e.g., because of how the two occurrences are combined with surrounding ANDs/ORs).
function _findConflictingAtomHints(tree)
 {
   var seen = new Map();
   (function walk(list)
     {
       if (!Array.isArray(list))
        return;
       for (var i = 0; i < list.length; ++i)
        {
          var item = list[i];
          if (item.expr != null)
           {
             var key = _atomKeyOf(item.expr);
             var rec = seen.get(key) || { plain: false, negated: false, expr: item.expr };
             if (item.not === true) rec.negated = true; else rec.plain = true;
             seen.set(key, rec);
           }
          else if (item.sub != null)
           walk(item.sub);
        }
     })(tree);
   var hints = [];
   seen.forEach(function(rec) { if (rec.plain === true && rec.negated === true) hints.push(rec.expr); });
   return hints;
 }

function _buildDomainConstraints(atomMap, domain)
 {
   var constraints = [];
   if (domain == null || typeof domain.relate !== 'function')
    return constraints;
   var atoms = Array.from(atomMap.values());
   for (var i = 0; i < atoms.length; ++i)
    for (var j = 0; j < atoms.length; ++j)
     {
       if (i === j || atoms[i].expr.var !== atoms[j].expr.var)
        continue;
       var rel = null;
       try { rel = domain.relate(atoms[i].expr, atoms[j].expr); } catch (e) { console.error("FloriaExpressionEditor: domain.relate() threw", e); }
       if (rel === 'implies')
        constraints.push({ type: 'implies', from: i, to: j });
       else if (rel === 'exclusive')
        constraints.push({ type: 'exclusive', a: i, b: j });
     }
   return constraints;
 }

function _assignmentConsistent(assign, constraints)
 {
   for (var i = 0; i < constraints.length; ++i)
    {
      var c = constraints[i];
      if (c.type === 'implies' && assign[c.from] === true && assign[c.to] === false)
       return false;
      if (c.type === 'exclusive' && assign[c.a] === true && assign[c.b] === true)
       return false;
    }
   return true;
 }

/** Analyzes an expression tree for tautologies/contradictions.
 *  @param {Array}  tree   – the expression tree (see module header for shape)
 *  @param {Object} domain – optional pluggable domain module, see constructor config docs
 *  @returns {{empty:boolean, tautology:boolean, contradiction:boolean, tooComplex:boolean, undetermined:boolean, atomCount:number, hints:Array}}
 */
export function analyzeExpressionTree(tree, domain)
 {
   var atomMap = new Map();
   _collectAtoms(tree, atomMap);
   var hints = _findConflictingAtomHints(tree);
   var n = atomMap.size;
   if (n === 0)
    return { empty: true, tautology: false, contradiction: false, tooComplex: false, undetermined: false, atomCount: 0, hints: hints };
   if (n > 20) // brute-force truth table is 2^n; cap to keep this instantaneous in the browser
    return { empty: false, tautology: false, contradiction: false, tooComplex: true, undetermined: false, atomCount: n, hints: hints };

   var constraints = _buildDomainConstraints(atomMap, domain);
   var everTrue = false, everFalse = false, anyConsistent = false;
   var total = 1 << n;
   for (var mask = 0; mask < total; ++mask)
    {
      var assign = [];
      for (var b = 0; b < n; ++b)
       assign.push(((mask >> b) & 1) === 1);
      if (_assignmentConsistent(assign, constraints) === false)
       continue;
      anyConsistent = true;
      if (_evalList(tree, assign, atomMap) === true) everTrue  = true;
      else                                            everFalse = true;
      if (everTrue === true && everFalse === true)
       break;
    }
   if (anyConsistent === false) // pathological: the domain's own constraints are self-contradictory
    return { empty: false, tautology: false, contradiction: false, tooComplex: false, undetermined: true, atomCount: n, hints: hints };
   return { empty: false, tautology: everTrue === true && everFalse === false, contradiction: everFalse === true && everTrue === false, tooComplex: false, undetermined: false, atomCount: n, hints: hints };
 }

// ── Pretty-print (plain-text / syntax-colored / rich-clipboard) rendering of an expression tree ───────
// Pure functions (no DOM, no `this`) so they can be reused both by the component's own Preview tab
// AND by any external caller (e.g. a page's own "live output" panel) that wants the same readable
// rendering instead of dumping raw JSON at end users — see formatExpressionAsHtml/AsText/AsRichHtml
// below. Every renderer function here takes a `mode` of:
//   'plain' – bare text, no markup at all (logging, "Copy as text" plain-text fallback)
//   'html'  – syntax-colored via the .fee-tok-* CSS classes from module-expression-editor.css,
//             for dropping into this page's own innerHTML (relies on that stylesheet being loaded)
//   'rich'  – same coloring as 'html', but with each token's style INLINED (style="...") instead
//             of relying on any external stylesheet, indentation/alignment expressed via
//             non-breaking spaces, and lines joined with <br> instead of "\n" — see
//             formatExpressionAsRichHtml for why: this is what actually survives being pasted, as
//             rich text, into an external app (email client, Word, Google Docs, etc.) that has no
//             idea our CSS classes exist and would otherwise collapse plain runs of whitespace.

function _indentStr(depth, mode) { return FloriaText.multiple(mode === 'rich' ? '&nbsp;&nbsp;' : '  ', depth); }
function _padStr(count, mode) { return FloriaText.multiple(mode === 'rich' ? '&nbsp;' : ' ', count); }

// Inline-style equivalents of the .fee-tok-* CSS classes (module-expression-editor.css), tuned for
// a plain/white background rather than that stylesheet's dark .fee-pretty container — this is what
// 'rich' mode actually pastes into an arbitrary external app, which will almost never also be
// sitting on a dark background.
var _PP_RICH_STYLE = {
   var  : 'color:#0369a1'
  ,func : 'color:#6d28d9'
  ,str  : 'color:#15803d'
  ,kw   : 'color:#b91c1c;font-weight:700'
  ,punc : 'color:#4b5563'
  ,cmt  : 'color:#6b7280;font-style:italic'
  ,descr: 'color:#6b7280'
 };

// Wraps `text` in the right markup for one "token" (a keyword, a punctuation mark, a var/func
// name, a string literal, ...) per `mode` — bare text for 'plain', a classed <span> for 'html', or
// a <span style="..."> for 'rich'. `title`, if given, becomes a native title="" tooltip (both HTML
// modes only — plain text obviously can't carry one).
function _ppTok(mode, tok, text, title)
 {
   if (mode === 'plain')
    return text;
   var titleAttr = title ? ' title="'+_esc(title)+'"' : '';
   return mode === 'rich'
     ? '<span style="'+_PP_RICH_STYLE[tok]+'"'+titleAttr+'>'+text+'</span>'
     : '<span class="fee-tok-'+tok+'"'+titleAttr+'>'+text+'</span>';
 }

// Raw (unpadded) "AND "/"OR "/"AND NOT "/"OR NOT "/"" prefix for one item — kept separate from
// the padding/rendering below so _ppList can precompute every sibling's prefix up front and work
// out how much padding each one needs (see _ppList).
function _ppPrefix(item, isFirst)
 {
   var prefix = isFirst === true ? '' : (item.op === 'or' ? 'OR ' : 'AND ');
   if (item.not === true)
    prefix += 'NOT ';
   return prefix;
 }

function _ppList(list, depth, vars, functions, mode, dict)
 {
   if (!Array.isArray(list) || list.length === 0)
    return [_indentStr(depth, mode)+_ppTok(mode, 'cmt', '// no conditions')];

   // Right-pad every sibling's AND/OR/NOT prefix (with spaces, or &nbsp; in 'rich' mode — see
   // _padStr) to the width of the widest one in THIS list, so every leaf's variable name — and
   // every nested group's opening "(" — lines up in the same column regardless of whether its own
   // line starts with nothing, "AND", "OR", or a trailing "NOT". Scoped to one list (one level of
   // siblings) at a time; each nested group recurses into its own call to _ppList and computes its
   // own independent padding.
   var prefixes = list.map(function(item, i) { return _ppPrefix(item, i === 0); });
   var padWidth = prefixes.reduce(function(m, p) { return Math.max(m, p.length); }, 0);

   var lines = [];
   for (var i = 0; i < list.length; ++i)
    lines = lines.concat(_ppItem(list[i], prefixes[i], padWidth, depth, vars, functions, mode, dict));
   return lines;
 }

function _ppItem(item, prefix, padWidth, depth, vars, functions, mode, dict)
 {
   var indent = _indentStr(depth, mode);
   var pad = _padStr(padWidth - prefix.length, mode);
   var kw = prefix === '' ? '' : _ppTok(mode, 'kw', _esc(prefix.trim())) + (mode === 'rich' ? '&nbsp;' : ' ');
   if (item.sub != null)
    {
      var open  = _ppTok(mode, 'punc', '(');
      var close = _ppTok(mode, 'punc', ')');
      return [indent+kw+pad+open].concat(_ppList(item.sub, depth + 1, vars, functions, mode, dict)).concat([indent+close]);
    }
   return _ppLeafLines(item.expr, indent, kw, pad, padWidth, depth, vars, functions, mode, dict);
 }

// Returns one already-tokenized "code" or "code: description" line per value in expr.vals, or
// null if NONE of them have a resolvable description — the null case is the signal for
// _ppLeafLines to fall back to the plain/legacy single-line "var func [\"a\", \"b\"]" rendering.
// `dict`, if given, is a { varName: { code: description|null } } lookup (see
// FloriaExpressionEditor._descrCache) — deliberately optional/pluggable so this whole
// code-description feature stays out of the framework's own concerns otherwise (see module
// header config docs for "descriptionLookup").
function _ppLeafValueLines(expr, dict, mode)
 {
   var vals = Array.isArray(expr.vals) ? expr.vals : [];
   var varDict = dict ? dict[expr.var] : null;
   if (varDict == null)
    return null;
   var anyDescr = vals.some(function(v) { return typeof varDict[v] === 'string' && varDict[v].length > 0; });
   if (anyDescr !== true)
    return null;
   return vals.map(function(v) {
       var codeTok = _ppTok(mode, 'str', _esc(v));
       var d = varDict[v];
       if (typeof d === 'string' && d.length > 0)
        return codeTok + _ppTok(mode, 'punc', ': ') + _ppTok(mode, 'descr', _esc(d));
       return codeTok;
     });
 }

// Builds the line(s) for one leaf condition. Two shapes, chosen per-leaf (not per-var/globally —
// see module header): if `dict` resolves a description for at least one of THIS leaf's values,
// renders the richer "[code: description, ...]" block — the FIRST value inline right after the
// opening "[" (same line as the var/func), every OTHER value vertically aligned under that first
// value's column, and the closing "]" aligned with the opening "[" itself; otherwise (no dict at
// all, or none of this leaf's values have a resolved description — e.g. a "like" prefix pattern
// that isn't a real discrete code) falls back to the original flat, single-line, quoted-values
// rendering, unchanged.
function _ppLeafLines(expr, indent, kw, pad, padWidth, depth, vars, functions, mode, dict)
 {
   // Names (not labels) are the actual identifiers callers/backends deal with, so they're what's
   // shown here; the (often longer, friendlier) label is still available as a native tooltip —
   // see the "title" attributes below — for whoever needs the human-readable meaning.
   var varLabel  = _labelFor(vars, expr.var);
   var funcLabel = _labelFor(functions, expr.f);
   var varTok    = _ppTok(mode, 'var', _esc(expr.var), varLabel);
   var funcTok   = _ppTok(mode, 'func', _esc(expr.f), funcLabel);

   var valueLines = _ppLeafValueLines(expr, dict, mode);
   if (valueLines == null)
    {
      var vals = Array.isArray(expr.vals) ? expr.vals : [];
      if (mode === 'plain')
       return [indent+kw+pad + expr.var+' '+expr.f+' ['+vals.map(function(v) { return '"'+v+'"'; }).join(', ')+']'];
      var sep = _ppTok(mode, 'punc', ', ');
      var valsHtml = vals.map(function(v) { return _ppTok(mode, 'str', '"'+_esc(v)+'"'); }).join(sep);
      return [indent+kw+pad+varTok+' '+funcTok+' '+_ppTok(mode, 'punc', '[')+valsHtml+_ppTok(mode, 'punc', ']')];
    }

   // Visible/plain column width of "indent+kw+pad+var func [" — computed from PLAIN text
   // lengths only (never from the tokenized strings above, which carry HTML markup in 'html'/
   // 'rich' modes and would badly overcount). indent is always 2 visible chars per depth level
   // (see _indentStr) and kw+pad together always sum to exactly padWidth visible chars (see
   // _ppList) regardless of which sibling's own AND/OR/NOT prefix produced them — that's the
   // whole point of that padding pass, and it's what lets every leaf/group in the same sibling
   // list line up regardless of its own prefix width.
   var headLen = (depth * 2) + padWidth + expr.var.length + 1 + expr.f.length + 1 + 1; // +1s: two separating spaces + "["
   var contPad  = _padStr(headLen, mode);              // aligns every OTHER value under the first one
   var closePad = _padStr(Math.max(0, headLen - 1), mode); // "]" aligns with the opening "[" itself

   var lines = [ indent+kw+pad+varTok+' '+funcTok+' '+_ppTok(mode, 'punc', '[')+valueLines[0] ];
   for (var i = 1; i < valueLines.length; ++i)
    lines.push(contPad+valueLines[i]);
   lines.push(closePad+_ppTok(mode, 'punc', ']'));
   return lines;
 }

/** Renders an expression tree as syntax-colored HTML (monospace, indented, with each sibling
 *  condition's variable name left-padded to line up in the same column regardless of its own
 *  AND/OR/NOT prefix — see .fee-pretty CSS), suitable for dropping straight into any container's
 *  innerHTML. Variables/functions are shown by their raw "name" (the actual identifier), with
 *  their friendlier "label" (if any) available as a native title="" tooltip. Usable standalone,
 *  without ever instantiating a FloriaExpressionEditor — e.g. for a page's own "live preview of
 *  the current onChange payload" panel, so end users are never shown raw JSON.
 *  @param {Array}  tree      – the expression tree (see module header for shape)
 *  @param {Array}  vars      – the same {name,label} vocabulary passed to the editor's config
 *  @param {Array}  functions – the same {name,label} vocabulary passed to the editor's config
 *  @param {Object} [dict]    – optional { varName: { code: description|null } } lookup (see
 *                              FloriaExpressionEditor config's "descriptionLookup"/_descrCache);
 *                              when omitted, every leaf renders with the original flat/quoted
 *                              values list.
 */
export function formatExpressionAsHtml(tree, vars, functions, dict)
 {
   return _ppList(tree || [], 0, vars || [], functions || [], 'html', dict).join('\n');
 }

/** Same as formatExpressionAsHtml, but returns plain text (no HTML markup, no title tooltips —
 *  those need real HTML) — suitable for logging/plain display, or as the text/plain fallback of a
 *  clipboard write (see formatExpressionAsRichHtml). */
export function formatExpressionAsText(tree, vars, functions, dict)
 {
   return _ppList(tree || [], 0, vars || [], functions || [], 'plain', dict).join('\n');
 }

/** Same content/coloring as formatExpressionAsHtml, but self-contained: every token's color/style
 *  is INLINED (style="...") instead of relying on the .fee-tok-* CSS classes, indentation and
 *  alignment padding are expressed with non-breaking spaces, and lines are joined with <br> rather
 *  than "\n" — plain spaces and bare newlines get silently collapsed by most rich-text paste
 *  targets (email clients, Word, Google Docs, etc.), which only look at the raw HTML they're
 *  given, not any stylesheet of ours. This is the text/html representation written to the
 *  clipboard by the Preview tab's "Copy" button (see FloriaExpressionEditor._renderPreview) so
 *  pasting it somewhere that accepts rich text keeps the same look as shown on screen, while a
 *  plain-text-only target still gets a sensible fallback (formatExpressionAsText). */
export function formatExpressionAsRichHtml(tree, vars, functions, dict)
 {
   return _ppList(tree || [], 0, vars || [], functions || [], 'rich', dict).join('<br>');
 }

// Writes BOTH a text/html and a text/plain representation to the clipboard in one shot, via the
// (widely supported, modern-browser) multi-type ClipboardItem API — the OS/browser then hands
// whichever representation the paste TARGET actually asked for: a rich-text-aware target (an
// email compose window, Word, Google Docs, Slack, ...) gets the colored/aligned `html`, while a
// plain-text-only target (a code editor, a terminal, a bare <textarea>) gets `plain`. Falls back
// to plain-text-only writeText() on anything that doesn't support it (older browsers, insecure
// contexts, etc.) so the button never just silently does nothing.
function _copyRichAndPlain(html, plain)
 {
   if (typeof window.ClipboardItem === 'function' && navigator.clipboard && typeof navigator.clipboard.write === 'function')
    {
      var item = new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' })
         ,'text/html' : new Blob([html],  { type: 'text/html'  })
        });
      navigator.clipboard.write([item]).catch(function(e) {
          console.warn("FloriaExpressionEditor: rich clipboard write failed, falling back to plain text", e);
          navigator.clipboard?.writeText(plain);
        });
      return;
    }
   navigator.clipboard?.writeText(plain);
 }

// Briefly flashes a green checkmark right next to `btnEl` (e.g. a "Copy"/"Copy JSON" button) to
// confirm the click actually did something — clipboard writes are otherwise silent/invisible.
// Reuses a single checkmark element per button (re-triggering the CSS fade-out animation on
// repeat clicks, via a reflow, rather than piling up stale elements) so mashing the button
// doesn't leave duplicates behind or need any timer bookkeeping here.
function _flashCopiedCheckmark(btnEl)
 {
   var mark = btnEl.nextElementSibling;
   if (mark == null || mark.classList.contains('fee-copied-check') !== true)
    {
      mark = document.createElement('span');
      mark.className = 'fee-copied-check';
      mark.textContent = '\u2713';
      btnEl.insertAdjacentElement('afterend', mark);
    }
   mark.classList.remove('fee-copied-check-show');
   void mark.offsetWidth; // force reflow so re-adding the class restarts the animation
   mark.classList.add('fee-copied-check-show');
 }

// ── The component ───────────────────────────────────────────────────────────────────────────────────

export class FloriaExpressionEditor
 {
   /**
    * @param {string} divId  – ID of the host element (must already exist in the DOM)
    * @param {Object} config – see module header for the full shape
    */
   constructor(divId, config)
    {
      config = config || {};
      this._id          = divId;
      this._vars        = config.vars      || [];
      this._funcs       = config.functions || [];
      this._domain      = config.domain    || null;
      this._readOnly    = config.readOnly === true;
      this._onChange    = typeof config.onChange === 'function' ? config.onChange : null;
      this._tree        = FloriaDOM.clone(config.initialTree || []);
      _normalizeList(this._tree);

      // Optional application-layer code-description resolver — see module header config docs.
      // _descrCache is a persistent { varName: { code: description|null } } dictionary, built up
      // (and NEVER pruned — see config docs) across the whole lifetime of this instance as the
      // Preview tab encounters new codes; entirely empty/unused when no descriptionLookup is
      // configured, which is exactly what keeps every leaf on the original flat/quoted rendering.
      this._descriptionLookup = typeof config.descriptionLookup === 'function' ? config.descriptionLookup : null;
      this._descrCache        = {};
      this._showTabJSON       = config.showTabJSON === true;
      this._initialTab        = config.initialTab != null ? config.initialTab : 0;

      if (this._vars.length === 0)
       console.error("FloriaExpressionEditor('"+divId+"'): no 'vars' configured — the variable dropdown will be empty.");
      if (this._funcs.length === 0)
       console.error("FloriaExpressionEditor('"+divId+"'): no 'functions' configured — the function dropdown will be empty.");

      this._builderPanelId = null;
      this._builderBound   = false;
    }

   // ── Public API ─────────────────────────────────────────────────────────

   /** Mounts the Builder/Preview tabs into the host div. */
   render()
    {
      var host = document.getElementById(this._id);
      if (host == null)
       throw new Error("FloriaExpressionEditor: element #"+this._id+" not found");
      host.classList.add('fee-root');

       var that = this;
       var tabDefs = [
           { label: "Editor" , onSelectHandler: function(panelId) { that._renderBuilder(panelId); } }
          ,{ label: "Preview", onSelectHandler: function(panelId) { that._renderPreview(panelId); } }
         ];
       if (this._showTabJSON === true)
        tabDefs.push({ label: "JSON", onSelectHandler: function(panelId) { that._renderJson(panelId); } });
       this._tabs = new FloriaTabs(this._id, tabDefs);
       this._tabs.show(this._resolveInitialTabIndex(tabDefs));
    }

   // Resolves the constructor's "initialTab" config (see module header docs) — either a numeric
   // tab index (used as-is, same convention as FloriaTabs.show()'s own defaultTabId) or a tab
   // label string (case-insensitive, e.g. "Preview") — down to the numeric index FloriaTabs.show()
   // actually wants. Falls back to 0 (the "Editor" tab, unchanged default behavior) for anything
   // unrecognized (an out-of-range index, or a label that doesn't match any configured/visible
   // tab — e.g. "JSON" when showTabJSON isn't enabled), logging a console.error so a caller's typo
   // doesn't fail silently.
   _resolveInitialTabIndex(tabDefs)
    {
      var initialTab = this._initialTab;
      if (typeof initialTab === 'number')
       {
         if (initialTab >= 0 && initialTab < tabDefs.length)
          return initialTab;
         console.error("FloriaExpressionEditor('"+this._id+"'): initialTab index "+initialTab+" is out of range — defaulting to 0.");
         return 0;
       }
      if (typeof initialTab === 'string')
       {
         var idx = tabDefs.findIndex(function(t) { return t.label.toLowerCase() === initialTab.toLowerCase(); });
         if (idx !== -1)
          return idx;
         console.error("FloriaExpressionEditor('"+this._id+"'): initialTab '"+initialTab+"' does not match any tab — defaulting to 0.");
         return 0;
       }
      return 0;
    }

   /** Returns a deep-clone of the current expression tree. */
   getTree() { return FloriaDOM.clone(this._tree); }

   /** Replaces the current tree and re-renders. */
   setTree(tree)
    {
      this._tree = FloriaDOM.clone(tree || []);
      _normalizeList(this._tree);
      if (this._builderPanelId != null)
       this._renderBuilder(this._builderPanelId);
    }

   /** Runs the tautology/contradiction analysis on the current tree. See analyzeExpressionTree() above. */
   checkLogic() { return analyzeExpressionTree(this._tree, this._domain); }

   /** Validates that every leaf has a recognized var/function and at least one value.
    *  @returns {{valid:boolean, errors:Array<string>}}
    */
   validate()
    {
      var errors = [];
      var varNames  = this._vars.map(function(v)  { return v.name; });
      var funcNames = this._funcs.map(function(f) { return f.name; });
      (function walk(list, pathLabel)
        {
          if (!Array.isArray(list))
           return;
          for (var i = 0; i < list.length; ++i)
           {
             var item = list[i];
             var label = pathLabel+'['+i+']';
             if (item.expr != null)
              {
                if (varNames.indexOf(item.expr.var) === -1)
                 errors.push(label+": unknown variable '"+item.expr.var+"'");
                if (funcNames.indexOf(item.expr.f) === -1)
                 errors.push(label+": unknown function '"+item.expr.f+"'");
                if (!Array.isArray(item.expr.vals) || item.expr.vals.length === 0)
                 errors.push(label+": no values provided");
              }
             else if (item.sub != null)
              walk(item.sub, label+'.sub');
             else
              errors.push(label+": item has neither 'expr' nor 'sub'");
           }
        })(this._tree, 'root');
      return { valid: errors.length === 0, errors: errors };
    }

   // ── Mutations (all funnel through _afterMutate) ───────────────────────

   _afterMutate()
    {
      _normalizeList(this._tree);
      if (this._builderPanelId != null)
       this._renderBuilder(this._builderPanelId);
      if (this._onChange != null)
       this._onChange(this.getTree());
    }

   _addItem(containerPath, isGroup)
    {
      var container = _resolveContainer(this._tree, containerPath);
      var item = isGroup === true ? { sub: [] } : { expr: { var: this._vars[0] ? this._vars[0].name : '', f: this._funcs[0] ? this._funcs[0].name : '', vals: [] } };
      if (container.length > 0)
       item.op = 'and';
      container.push(item);
      this._afterMutate();
    }

   _deleteItem(itemPath)
    {
      // Any item — including the first ("anchor") item of a list, which carries no "op" of its
      // own (see _normalizeList) — can be deleted; if it wasn't the last remaining item in its
      // list, _afterMutate()'s _normalizeList() call takes care of stripping "op" back off
      // whichever item slides into index 0 next, same as ever.
      //
      // But deleting the LAST remaining item of a NESTED group's own "sub" list leaves that group
      // with nothing in it at all — an empty group asserts no condition whatsoever, so rather
      // than leave a dangling, confusing "no conditions in this group yet" shell sitting in the
      // tree, cascade the delete up: remove the (now-empty) group itself from ITS OWN parent
      // list, recursing so a chain of now-empty ancestor groups is cleaned up too. The top-level
      // tree itself is exempt (there's no enclosing "group" to remove) — it's perfectly fine, and
      // expected, for it to end up empty (see _renderList's/​_renderIntroBlurb's empty-state).
      var loc = _resolveItem(this._tree, itemPath);
      loc.list.splice(loc.index, 1);
      if (loc.list.length === 0 && itemPath.length > 1)
       return this._deleteItem(itemPath.slice(0, -1));
      this._afterMutate();
    }

   _moveItem(itemPath, delta)
    {
      var loc = _resolveItem(this._tree, itemPath);
      var newIndex = loc.index + delta;
      if (newIndex < 0 || newIndex >= loc.list.length)
       return;
      var tmp = loc.list[loc.index];
      loc.list[loc.index] = loc.list[newIndex];
      loc.list[newIndex] = tmp;
      this._afterMutate();
    }

   _setOp(itemPath, op)
    {
      _resolveItem(this._tree, itemPath).item.op = op;
      this._afterMutate();
    }

   _toggleNot(itemPath)
    {
      var item = _resolveItem(this._tree, itemPath).item;
      item.not = item.not !== true;
      this._afterMutate();
    }

   _setVar(itemPath, varName)
    {
      _resolveItem(this._tree, itemPath).item.expr.var = varName;
      this._afterMutate();
    }

   _setFunc(itemPath, funcName)
    {
      _resolveItem(this._tree, itemPath).item.expr.f = funcName;
      this._afterMutate();
    }

   _addValue(itemPath, val)
    {
      val = (val || '').trim();
      if (val === '')
       return;
      var expr = _resolveItem(this._tree, itemPath).item.expr;
      if (!Array.isArray(expr.vals))
       expr.vals = [];
      if (expr.vals.indexOf(val) === -1)
       expr.vals.push(val);
      _normalizeList(this._tree);
      if (this._onChange != null)
       this._onChange(this.getTree());
      this._refreshValuesUI(itemPath);
    }

   _removeValue(itemPath, valIndex)
    {
      var expr = _resolveItem(this._tree, itemPath).item.expr;
      expr.vals.splice(valIndex, 1);
      if (this._onChange != null)
       this._onChange(this.getTree());
      this._refreshValuesUI(itemPath);
    }

   // Scoped DOM refresh (values chip area only), so typing/adding values doesn't blow away the rest of
   // the builder (focus, scroll position, other rows) on every commit — the rest of the tree only needs
   // a full re-render on structural changes (add/delete/move/toggle/var/func).
   _refreshValuesUI(itemPath)
    {
      if (this._builderPanelId == null)
       return;
      var pathStr = JSON.stringify(itemPath);
      var panel = document.getElementById(this._builderPanelId);
      if (panel == null)
       return;
      var el = panel.querySelector('.fee-values[data-item-path=\''+pathStr+'\']');
      if (el == null)
       return this._renderBuilder(this._builderPanelId); // fallback: shouldn't happen, but stay safe
      var expr = _resolveItem(this._tree, itemPath).item.expr;
      el.innerHTML = this._renderValuesInner(expr);
      var inp = el.querySelector('.fee-value-input');
      if (inp != null)
       inp.focus();
    }

   // ── Builder rendering ──────────────────────────────────────────────────

   _renderBuilder(panelId)
    {
      this._builderPanelId = panelId;
      var panel = document.getElementById(panelId);
      if (panel == null)
       return;

      // Collected by _renderLeaf() below (one entry per leaf whose "var" has a custom Picker
      // configured) and mounted right after the HTML below is committed to the DOM — see
      // _mountPendingPickers().
      this._pendingPickers = [];

      var helpId = panelId+'_FEE_HELP';
      var str = '<div class="fee-toolbar">'
              +   '<span id="'+helpId+'" class="fee-help-icon">?</span>'
              + '</div>'
              + (this._tree.length === 0 && this._readOnly !== true ? this._renderIntroBlurb() : '')
              + this._renderAddButtons([])
              + this._renderList(this._tree, [])
              + '<BR><BR><BR>'
              ;
              
      panel.innerHTML = str;

      this._mountPendingPickers();

      new FloriaTooltipDialog(helpId, '<div class="fee-help-body">'+this._introBlurbContent()+'</div>');

      if (this._builderBound === true)
       return;
      this._builderBound = true;
      this._bindBuilderEvents(panel);
    }

   // Explanatory blurb shown only above an EMPTY root tree (never for a nested empty group,
   // which already has its own "No conditions in this group yet." message right below its own
   // always-visible add-buttons — see _renderList/_renderAddButtons) — a first-time user facing
   // a totally blank editor otherwise has no clue what the two buttons below even do. Also reused
   // (see _introBlurbContent) verbatim as the "?" help-icon's tooltip content (_renderBuilder), so
   // that always-available help never drifts out of sync with this empty-state explanation.
   _renderIntroBlurb()
    {
      return '<div class="fee-intro-blurb">'+this._introBlurbContent()+'</div>';
    }

   // The actual explanatory copy (no outer wrapper div) shared by both _renderIntroBlurb (wrapped
   // in .fee-intro-blurb, shown above an empty root tree) and the "?" help-icon's FloriaTooltipDialog
   // (wrapped in .fee-help-body, always available regardless of whether the tree is empty) — see
   // _renderBuilder.
   _introBlurbContent()
    {
      return '<p>This expression is currently empty. Use the buttons below to get started:</p>'
           +   '<ul>'
           +     '<li>Click <b>+ Condition</b> to test a variable against one or more values.</li>'
           +     '<li>Click <b>+ Group</b> to nest conditions and control how they combine.</li>'
           +     '<li>Add a second item to reveal the <b>AND</b>/<b>OR</b> switch that joins it to the one above.</li>'
           +     '<li>Use <b>Matching</b>/<b>Not matching</b> to negate any single condition or a whole group.</li>'
           +     '<li>Check the <b>Preview</b> tab any time for a readable view of what you have built.</li>'
           +   '</ul>';
    }

   // Renders the "+ Condition"/"+ Group" add-buttons for one container (the root tree when
   // path=[], or a nested group's "sub" otherwise). ALWAYS rendered by the caller — see
   // _renderBuilder() for the root and _renderItem()'s groupActions for a nested group — so they
   // stay visible regardless of whether that container is currently empty or already has items
   // (this used to be rendered by _renderList() itself, but ONLY in the empty-list branch, which
   // is exactly why the buttons vanished for good as soon as the first item was added).
   _renderAddButtons(containerPath)
    {
      if (this._readOnly === true)
       return '';
      var pathAttr = _esc(JSON.stringify(containerPath));
      return '<div class="fee-add-buttons">'
           +   '<button type="button" class="fee-btn" data-action="add-cond" data-container-path=\''+pathAttr+'\' title="Add a new condition, ANDed or ORed">+ Condition</button>'
           +   '<button type="button" class="fee-btn" data-action="add-group" data-container-path=\''+pathAttr+'\' title="Add a new subgroup of conditions (i.e., a sub-expression with parentheses)">+ Group</button>'
           + '</div>';
    }

   _renderList(list, path)
    {
      // NOTE: the "+ Condition"/"+ Group" add-buttons for THIS container are always rendered by
      // the caller — see _renderAddButtons(), called from _renderBuilder() for the root list and
      // from _renderItem()'s groupActions for a nested group's "sub" — regardless of whether the
      // list is currently empty or not, so they never disappear once the first item is added
      // (previously they were ONLY rendered here, in the empty branch, so they vanished for good
      // as soon as a list went from 0 to 1 item). This method now only ever renders the LIST
      // ITSELF (or an empty-state message when there's nothing in it yet).
      if (!Array.isArray(list) || list.length === 0)
       return '<div class="fee-empty-msg">'+(this._readOnly===true?'No conditions.':(path.length===0?'No conditions defined yet.':'No conditions in this group yet.'))+'</div>';
      var html = '<div class="fee-list">';
      for (var i = 0; i < list.length; ++i)
       html += this._renderItem(list[i], path.concat([i]), i === 0);
      html += '</div>';
      return html;
    }

   _renderItem(item, path, isFirst)
    {
      var pathStr = _esc(JSON.stringify(path));
      var readOnly = this._readOnly === true;

      var opHtml = '';
      if (isFirst === false)
       {
         var op = item.op === 'or' ? 'or' : 'and';
         if (readOnly === true)
          opHtml = '<span class="fee-op-toggle"><span class="fee-op-btn active">'+op.toUpperCase()+'</span></span>';
         else
          opHtml = '<span class="fee-op-toggle" data-item-path=\''+pathStr+'\'>'
                 +   '<button type="button" class="fee-op-btn'+(op==='and'?' active':'')+'" data-op="and">AND</button>'
                 +   '<button type="button" class="fee-op-btn'+(op==='or' ?' active':'')+'" data-op="or">OR</button>'
                 + '</span>';
       }

      // "Matching"/"Not matching" toggle — an iOS-style switch + dynamic label (same look & feel
      // as _ruleToggleInfo()'s Inclusion/Exclusion switch in module-cohorts-sub-builder.js), rather
      // than the old two-state button pill. Wrapped in a <label> (interactive case) so clicking
      // anywhere on the label/text — not just the tiny knob — toggles it, same as a native checkbox.
      var notOn = item.not === true;
      var notLabel = notOn === true ? 'Not matching this expression' : 'Matching this expression';
      var notHtml;
      if (readOnly === true)
       notHtml = '<span class="fee-not-toggle-wrap fee-not-readonly'+(notOn?' fee-not-on':'')+'">'
               +   '<span class="fee-switch fee-switch-disabled"><span class="fee-switch-slider'+(notOn?' fee-switch-on':'')+'"></span></span>'
               +   '<span class="fee-not-toggle-label">'+notLabel+'</span>'
               + '</span>';
      else
       notHtml = '<label class="fee-not-toggle-wrap'+(notOn?' fee-not-on':'')+'" data-item-path=\''+pathStr+'\' title="Toggle between inclusion and exclusion (i.e., NOT)">'
               +   '<span class="fee-switch">'
               +     '<input type="checkbox" class="fee-not-switch"'+(notOn?' checked':'')+'>'
               +     '<span class="fee-switch-slider"></span>'
               +   '</span>'
               +   '<span class="fee-not-toggle-label">'+notLabel+'</span>'
               + '</label>';

      // Delete is available on every item, including the first ("anchor") item of a list — see
      // _deleteItem for how deleting it (or the last remaining item of a nested group) is handled
      // structurally. Move up/down stay visible regardless (they're already safe no-ops out of
      // bounds).
      var actionsHtml = '';
      if (readOnly === false)
       actionsHtml = '<span class="fee-row-actions">'
                    +   '<button type="button" class="fee-move-btn" data-action="move-up"   data-item-path=\''+pathStr+'\' title="Move up">&#9650;</button>'
                    +   '<button type="button" class="fee-move-btn" data-action="move-down" data-item-path=\''+pathStr+'\' title="Move down">&#9660;</button>'
                    +   '<button type="button" class="fee-btn fee-btn-danger" data-action="delete" data-item-path=\''+pathStr+'\' title="Delete">&#128465;</button>'
                    + '</span>';

      var bodyHtml;
      if (item.sub != null)
       {
         var groupActions = this._renderAddButtons(path);
         bodyHtml = '<div class="fee-group">'+groupActions+this._renderList(item.sub, path)+'</div>';
       }
      else
       bodyHtml = this._renderLeaf(item.expr, pathStr);

      return '<div class="fee-row">'
           +   '<div class="fee-row-head">'+opHtml+notHtml+actionsHtml+'</div>'
           +   bodyHtml
           + '</div>';
    }

   _renderLeaf(expr, pathStr)
    {
      var readOnly = this._readOnly === true;
      var varOptions = this._vars.map(function(v) { return '<option value="'+_esc(v.name)+'"'+(expr.var===v.name?' selected':'')+'>'+_esc(v.label||v.name)+'</option>'; }).join('');
      var funcOptions = this._funcs.map(function(f) { return '<option value="'+_esc(f.name)+'"'+(expr.f===f.name?' selected':'')+'>'+_esc(f.label||f.name)+'</option>'; }).join('');
      var varSelect  = '<select class="fee-select fee-var-select"  data-item-path=\''+pathStr+'\''+(readOnly?' disabled':'')+'>'+(varOptions ||'<option value="">(no variables configured)</option>')+'</select>';
      var funcSelect = '<select class="fee-select fee-func-select" data-item-path=\''+pathStr+'\''+(readOnly?' disabled':'')+'>'+(funcOptions||'<option value="">(no functions configured)</option>')+'</select>';
      var pathAttr = pathStr.replace(/"/g, '&quot;');

      // If the leaf's currently-selected var has a custom Picker configured (see module header
      // config docs / _varMeta), render a live Picker widget instead of the plain chip/text-input
      // — deferred: the div is just a mount point here, actually populated by
      // FloriaFactories.PickerRegistry.render() in _mountPendingPickers() once this HTML is in the
      // DOM. Never used in readOnly mode (a Picker is an editing widget, not a display one) — the
      // Preview/JSON tabs (and this leaf, if readOnly) always use the plain chip rendering, which
      // is also the fallback for any var with no "picker" configured at all.
      var varMeta   = _varMeta(this._vars, expr.var);
      var pickerCfg = (readOnly !== true && varMeta != null && varMeta.picker) ? varMeta : null;

      var valuesDiv;
      if (pickerCfg != null)
       {
         var pickerElId = this._pickerElementId(pathStr);
         this._pendingPickers.push({
             pathStr     : pathStr,
             elementId   : pickerElId,
             pickerName  : pickerCfg.picker,
             pickerParams: pickerCfg.pickerParams || {},
             values      : Array.isArray(expr.vals) ? expr.vals.slice() : []
           });
         valuesDiv = '<div class="fee-values fee-values-picker" data-item-path=\''+pathAttr+'\' id="'+pickerElId+'"></div>';
       }
      else
       valuesDiv = '<div class="fee-values" data-item-path=\''+pathAttr+'\'>'+this._renderValuesInner(expr)+'</div>';

      return '<div class="fee-leaf">'+varSelect+funcSelect+valuesDiv+'</div>';
    }

   // Stable, DOM-id-safe identifier for a leaf's Picker mount point, derived from its JSON path
   // (e.g. "[2,1]") — also used afterwards to look up that Picker's hidden "<id>_value" field (see
   // _mountPendingPickers) once the user has picked/removed values.
   _pickerElementId(pathStr)
    {
      return this._id+'_FEEPICK_'+pathStr.replace(/[^\w]/g, '_');
    }

   // Instantiates a FloriaFactories.PickerRegistry Picker for every leaf collected into
   // this._pendingPickers during the _renderList/_renderItem/_renderLeaf pass just committed to the
   // DOM (see _renderBuilder). Mirrors the exact same pickerDefs shape/convention as
   // module-cohorts-sub-builder.js's _setupRulesEditor._showForm (name:'value', multi:true, values
   // as plain code-string arrays — PickerRegistry wraps them into {value,descr} internally).
   _mountPendingPickers()
    {
      var pending = this._pendingPickers || [];
      if (pending.length === 0)
       return;

      var that = this;
      var pickerDefs = pending.map(function(p) {
          return { pickerName: p.pickerName, elementId: p.elementId, name: 'value', multi: true, params: p.pickerParams, values: p.values };
        });

      // PickerRegistry's onChange callback carries no arguments identifying WHICH picker changed
      // (see module-factories.js PickerRegistry.render — the same callback is wired to every
      // picker._onChange), so on any change we re-sync ALL pending pickers' hidden "<id>_value"
      // fields (``-joined codes — same convention read by module-cohorts-sub-builder.js's rule-form
      // save handler) back into the tree. Cheap: an expression editor only ever has a handful of
      // leaves visible at once.
      FloriaFactories.PickerRegistry.render(pickerDefs, false, null, function() {
          pending.forEach(function(p) {
              var hidEl = document.getElementById(p.elementId+'_value');
              var raw   = hidEl ? hidEl.value : '';
              var vals  = raw ? raw.split('``').map(function(s) { return s.trim(); }).filter(Boolean) : [];
              that._setValuesFromPicker(JSON.parse(p.pathStr), vals);
            });
        });
    }

   // Bulk-replaces a leaf's expr.vals from a Picker's current selection. Unlike _addValue/
   // _removeValue (the plain chip UI's mutators), this deliberately does NOT trigger a full
   // _renderBuilder() — the Picker widget has already repainted its own "Pick"/selected-values box
   // in place, so tearing down and remounting every Picker on this same panel on every single
   // add/remove click would be wasteful and would fight with the Picker's own dialog lifecycle.
   _setValuesFromPicker(itemPath, vals)
    {
      var expr = _resolveItem(this._tree, itemPath).item.expr;
      var before = JSON.stringify(expr.vals || []);
      expr.vals = vals;
      _normalizeList(this._tree);
      if (before !== JSON.stringify(vals) && this._onChange != null)
       this._onChange(this.getTree());
    }

   _renderValuesInner(expr)
    {
      var vals = Array.isArray(expr.vals) ? expr.vals : [];
      var chips = vals.map(function(v, i) {
          return '<span class="fee-chip">'+_esc(v)+(this._readOnly===true?'':'<button type="button" class="fee-chip-x" data-vidx="'+i+'" title="Remove">&times;</button>')+'</span>';
        }, this).join('');
      var input = this._readOnly === true ? '' : '<input type="text" class="fee-value-input" placeholder="Add value…">';
      return chips + input;
    }

   // ── Event delegation (bound once per panel instance) ───────────────────

   _bindBuilderEvents(panel)
    {
      var that = this;

      panel.addEventListener('click', function(e) {
          var btn;

          if ((btn = e.target.closest('[data-action="add-cond"]')) != null)
           return that._addItem(JSON.parse(btn.dataset.containerPath), false);
          if ((btn = e.target.closest('[data-action="add-group"]')) != null)
           return that._addItem(JSON.parse(btn.dataset.containerPath), true);
          if ((btn = e.target.closest('[data-action="delete"]')) != null)
           {
             var delPath = JSON.parse(btn.dataset.itemPath);
             var delLoc  = _resolveItem(that._tree, delPath);
             var kind = delLoc.item.sub != null ? 'group' : 'condition';
             // Deleting the only remaining item of a NESTED group's own "sub" list cascades into
             // deleting that group itself (see _deleteItem) — flag this up front rather than
             // leaving the user surprised by an entire group disappearing.
             var cascades = delLoc.list.length === 1 && delPath.length > 1;
             var msg = cascades === true
                 ? 'This is the only remaining item in its group — deleting it will also delete the enclosing group. This cannot be undone.'
                 : 'This cannot be undone.';
             new FloriaAlertSimple('Delete this '+kind+'?', msg, 'Delete', 'Cancel', function() {
                 that._deleteItem(delPath);
               }).show();
             return;
           }
          if ((btn = e.target.closest('[data-action="move-up"]')) != null)
           return that._moveItem(JSON.parse(btn.dataset.itemPath), -1);
          if ((btn = e.target.closest('[data-action="move-down"]')) != null)
           return that._moveItem(JSON.parse(btn.dataset.itemPath), 1);
          if ((btn = e.target.closest('.fee-op-btn')) != null && btn.disabled !== true)
           {
             var wrap = e.target.closest('.fee-op-toggle');
             if (wrap != null && wrap.dataset.itemPath != null)
              return that._setOp(JSON.parse(wrap.dataset.itemPath), btn.dataset.op);
           }
          if ((btn = e.target.closest('.fee-chip-x')) != null)
           {
             var valuesEl = e.target.closest('.fee-values');
             if (valuesEl != null)
              return that._removeValue(JSON.parse(valuesEl.dataset.itemPath), parseInt(btn.dataset.vidx, 10));
           }
        });

      panel.addEventListener('change', function(e) {
          if (e.target.classList.contains('fee-var-select'))
           return that._setVar(JSON.parse(e.target.dataset.itemPath), e.target.value);
          if (e.target.classList.contains('fee-func-select'))
           return that._setFunc(JSON.parse(e.target.dataset.itemPath), e.target.value);
          if (e.target.classList.contains('fee-not-switch'))
           {
             var notWrap = e.target.closest('.fee-not-toggle-wrap');
             if (notWrap != null && notWrap.dataset.itemPath != null)
              return that._toggleNot(JSON.parse(notWrap.dataset.itemPath));
           }
        });

      function commitValueInput(inputEl)
       {
         var valuesEl = inputEl.closest('.fee-values');
         if (valuesEl == null)
          return;
         that._addValue(JSON.parse(valuesEl.dataset.itemPath), inputEl.value);
       }

      panel.addEventListener('keydown', function(e) {
          if (e.target.classList.contains('fee-value-input') !== true)
           return;
          if (e.key === 'Enter' || e.key === ',')
           {
             e.preventDefault();
             commitValueInput(e.target);
             e.target.value = '';
           }
        });

      panel.addEventListener('blur', function(e) {
          if (e.target.classList == null || e.target.classList.contains('fee-value-input') !== true)
           return;
          if (e.target.value.trim() !== '')
           commitValueInput(e.target);
        }, true);

      panel.addEventListener('paste', function(e) {
          if (e.target.classList == null || e.target.classList.contains('fee-value-input') !== true)
           return;
          var text = (e.clipboardData || window.clipboardData).getData('text');
          if (text.indexOf(',') === -1)
           return; // let the default paste happen for single values
          e.preventDefault();
          var valuesEl = e.target.closest('.fee-values');
          if (valuesEl == null)
           return;
          var itemPath = JSON.parse(valuesEl.dataset.itemPath);
          text.split(',').forEach(function(v) { that._addValue(itemPath, v); });
        });
    }

   // ── Preview rendering (human-readable, syntax-colored — no JSON) ───────

   // Walks the current tree and returns the entries[] shape described in the module header's
   // "descriptionLookup" config docs, containing ONLY var/code pairs not already present in
   // this._descrCache — i.e. exactly the bulk lookup request that needs to go out, deduplicated
   // both within a single var (a code repeated across several leaves is only listed once) and
   // against everything already cached from a previous Preview visit.
   _collectPendingDescrLookups()
    {
      var cache = this._descrCache;
      var pendingByVar = {}; // varName -> Set of codes needing lookup

      (function walk(list)
        {
          if (!Array.isArray(list))
           return;
          for (var i = 0; i < list.length; ++i)
           {
             var item = list[i];
             if (item.expr != null)
              {
                var v = item.expr.var;
                var vals = Array.isArray(item.expr.vals) ? item.expr.vals : [];
                var already = cache[v];
                for (var j = 0; j < vals.length; ++j)
                 {
                   var code = vals[j];
                   if (already == null || Object.prototype.hasOwnProperty.call(already, code) === false)
                    {
                      if (pendingByVar[v] == null) pendingByVar[v] = new Set();
                      pendingByVar[v].add(code);
                    }
                 }
              }
             else if (item.sub != null)
              walk(item.sub);
           }
        })(this._tree);

      var pending = [];
      Object.keys(pendingByVar).forEach(function(v) {
          pending.push({ var: v, values: Array.from(pendingByVar[v]).map(function(val) { return { val: val, descr: null }; }) });
        });
      return pending;
    }

   // Merges a resolved (post-descriptionLookup) entries[] back into the persistent _descrCache —
   // called with the SAME array object passed to the handler, which is expected to have mutated
   // each value's "descr" in place. Every requested code is cached regardless of outcome
   // (including a code the handler couldn't describe, cached as null) so it is never re-requested
   // — see the module header config docs' caching contract.
   _mergeResolvedDescriptions(entries)
    {
      var cache = this._descrCache;
      (entries || []).forEach(function(entry) {
          var bucket = cache[entry.var] || (cache[entry.var] = {});
          (entry.values || []).forEach(function(v) {
              bucket[v.val] = v.descr != null ? v.descr : null;
            });
        });
    }

   _renderPreview(panelId)
    {
      var panel = document.getElementById(panelId);
      if (panel == null)
       return;

      var that = this;

      // Only await/lookup when there's an actual resolver AND at least one new/uncached code —
      // avoids both a pointless server round-trip and a distracting "Loading…" flash on every
      // single visit to this tab once everything is already cached.
      var pending = this._descriptionLookup != null ? this._collectPendingDescrLookups() : [];
      if (pending.length === 0)
       return this._paintPreview(panelId);

      panel.innerHTML = '<div class="fee-empty-msg">Loading code descriptions…</div>';
      Promise.resolve()
        .then(function() { return that._descriptionLookup(pending); })
        .catch(function(e) { console.error("FloriaExpressionEditor: descriptionLookup handler threw", e); })
        .then(function() {
            that._mergeResolvedDescriptions(pending);
            // The user may have switched away from Preview (or torn down the component) while
            // the lookup was in flight — only paint if this exact panel is still in the DOM.
            if (document.getElementById(panelId) != null)
             that._paintPreview(panelId);
          });
    }

   _paintPreview(panelId)
    {
      var panel = document.getElementById(panelId);
      if (panel == null)
       return;

      var analysis = analyzeExpressionTree(this._tree, this._domain);
      var str = '<div class="fee-preview-toolbar">'
              +   '<button type="button" class="fee-btn" id="'+panelId+'_COPY_TEXT" title="Copies a rich-text version (same colors/alignment as shown here) for pasting into email/docs/etc., plus a plain-text fallback for anything that only accepts plain text">Copy</button>'
              + '</div>';

//      str += this._renderLogicWarnings(analysis, panelId);

      str += '<div class="fee-section-label">Expression</div>';
      str += this._tree.length === 0
           ? '<div class="fee-empty-msg">No conditions defined.</div>'
           : '<div class="fee-pretty">'+formatExpressionAsHtml(this._tree, this._vars, this._funcs, this._descrCache)+'</div>';

      panel.innerHTML = str;

      var textStr = formatExpressionAsText(this._tree, this._vars, this._funcs, this._descrCache);
      var richStr = formatExpressionAsRichHtml(this._tree, this._vars, this._funcs, this._descrCache);
      var copyBtn = document.getElementById(panelId+'_COPY_TEXT');
      copyBtn.addEventListener('click', function() { _copyRichAndPlain(richStr, textStr); _flashCopiedCheckmark(copyBtn); });
    }

   // ── JSON rendering (raw tree, for developers/integrators) ──────────────

   _renderJson(panelId)
    {
      var panel = document.getElementById(panelId);
      if (panel == null)
       return;

      var str = '<div class="fee-preview-toolbar">'
              +   '<button type="button" class="fee-btn" id="'+panelId+'_COPY_JSON">Copy</button>'
              + '</div>';
      var jsonStr = _compactJson(JSON.stringify(this._tree, null, 2));
      str += '<div class="fee-section-label">Raw JSON</div>';
      str += '<div class="fee-json">'+FloriaText.TextUtil.printJsonWithHighlights(jsonStr)+'</div>';

      panel.innerHTML = str;

      var copyJsonBtn = document.getElementById(panelId+'_COPY_JSON');
      copyJsonBtn.addEventListener('click', function() { navigator.clipboard?.writeText(jsonStr); _flashCopiedCheckmark(copyJsonBtn); });
    }
   _renderLogicWarnings(analysis, panelId)
    {
      var str = '';
      if (analysis.contradiction === true)
       {
         var icoC = panelId+'_FEE_ICO_CONTRA';
         str += '<div class="fee-warning fee-warning-contradiction"><span id="'+icoC+'" class="fee-info-icon">!</span>'
              + '<span>This expression can <b>never be TRUE</b> — it is a contradiction.</span></div>';
         new FloriaTooltipDialog(icoC, '<div class="fee-tooltip-body">Every combination of the underlying conditions was tried and none of them satisfy the whole expression. Double-check for a condition being required (AND) alongside its own negation (Not matching), directly or through a nested group.</div>');
       }
      if (analysis.tautology === true)
       {
         var icoT = panelId+'_FEE_ICO_TAUT';
         str += '<div class="fee-warning fee-warning-tautology"><span id="'+icoT+'" class="fee-info-icon">!</span>'
              + '<span>This expression is <b>always TRUE</b> regardless of the data — it may not be filtering anything.</span></div>';
         new FloriaTooltipDialog(icoT, '<div class="fee-tooltip-body">Every combination of the underlying conditions was tried and all of them satisfy the whole expression. This often happens with an OR of a condition and its own negation (Not matching), directly or through a nested group.</div>');
       }
      if (analysis.tooComplex === true)
       str += '<div class="fee-warning fee-warning-info">Expression has '+analysis.atomCount+' distinct conditions — automatic logic-check skipped above 20.</div>';
      if (analysis.undetermined === true)
       str += '<div class="fee-warning fee-warning-info">Logic-check could not be completed (the configured domain rules appear contradictory).</div>';
      if (analysis.hints.length > 0)
       {
         str += '<div class="fee-warning fee-warning-info"><span>The following condition(s) appear both as-is and negated (Not matching) elsewhere in the expression — double-check the intent:'
              + '<ul class="fee-hint-list">'
              + analysis.hints.map(function(h) { return '<li>'+_esc(_labelFor(this._vars, h.var))+' '+_esc(_labelFor(this._funcs, h.f))+' ['+(h.vals||[]).map(_esc).join(', ')+']</li>'; }, this).join('')
              + '</ul></span></div>';
       }
      if (analysis.empty !== true && analysis.contradiction !== true && analysis.tautology !== true && analysis.tooComplex !== true && analysis.undetermined !== true && analysis.hints.length === 0)
       str += '<div class="fee-warning fee-warning-ok">No tautology or contradiction detected.</div>';
      return str;
    }
  }

