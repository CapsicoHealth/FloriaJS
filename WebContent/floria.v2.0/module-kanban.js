"use strict";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[char]);
}

function readPath(object, path) {
  return String(path).split(".").reduce((value, key) => value == null ? undefined : value[key], object);
}

/**
 * A reusable Kanban board. Lane definitions use { id, title, splitLanes? }, where
 * splitLanes are { id, title } sections rendered inside that lane.
 *
 * Options: getCardId, getLane, filterable, sortOptions, initialSort,
 * renderCard, canDrop, onMove, and onFilterChange.
 */
export class FloriaKanban {
  constructor(parentDiv, lanes, options = {}) {
    this.parent = typeof parentDiv === "string" ? document.getElementById(parentDiv) : parentDiv;
    if (!this.parent) throw new Error("FloriaKanban requires a parent element.");
    this.lanes = Array.isArray(lanes) ? lanes.slice() : [];
    this.options = options;
    this.cards = new Map();
    this.locations = new Map();
    this.filterText = "";
    this.sortBy = options.initialSort || options.sortOptions?.[0]?.id || "";
    this.pending = new Set();
    this.draggedId = null;
    this.parent.innerHTML = '<div class="floria-kanban" tabindex="-1"></div>';
    this.root = this.parent.querySelector(".floria-kanban");
    this._bindEvents();
    this.render();
  }

  _id(card) {
    const value = this.options.getCardId ? this.options.getCardId(card) : card?.id ?? card?.refnum;
    if (value == null) throw new Error("Every Kanban card must have an id or refnum.");
    return String(value);
  }

  _location(card) {
    const value = this.options.getLane ? this.options.getLane(card) : { laneId: card?.laneId, splitId: card?.splitId };
    return typeof value === "string" ? { laneId: value, splitId: null } : {
      laneId: value?.laneId == null ? null : String(value.laneId),
      splitId: value?.splitId == null ? null : String(value.splitId),
    };
  }

  _lane(laneId) {
    return this.lanes.find((lane) => String(lane.id) === String(laneId));
  }

  setCards(cards = []) {
    this.cards.clear();
    this.locations.clear();
    cards.forEach((card) => {
      const id = this._id(card);
      const location = this._location(card);
      if (location.laneId && this._lane(location.laneId)) {
        this.cards.set(id, card);
        this.locations.set(id, location);
      }
    });
    this.render();
    return this;
  }

  addCard(card, laneId, splitId = null) {
    const id = this._id(card);
    const lane = this._lane(laneId);
    if (!lane) throw new Error(`Unknown Kanban lane: ${laneId}`);
    if (splitId != null && !(lane.splitLanes || []).some((split) => String(split.id) === String(splitId)))
      throw new Error(`Unknown split lane ${splitId} in ${laneId}.`);
    const previous = this.locations.get(id);
    this.cards.set(id, card);
    const to = { laneId: String(laneId), splitId: splitId == null ? null : String(splitId) };
    this.locations.set(id, to);
    this._refreshZones(previous, to);
    return this;
  }

  removeCard(cardOrId) {
    const id = typeof cardOrId === "object" && cardOrId !== null ? this._id(cardOrId) : String(cardOrId);
    const previous = this.locations.get(id);
    const removed = this.cards.delete(id);
    this.locations.delete(id);
    this._refreshZones(previous);
    return removed;
  }

  updateCard(card, laneId, splitId = null) {
    const id = this._id(card);
    if (!this.cards.has(id)) return this.addCard(card, laneId, splitId);
    const previous = this.locations.get(id);
    this.cards.set(id, card);
    const to = laneId != null
      ? { laneId: String(laneId), splitId: splitId == null ? null : String(splitId) }
      : this._location(card);
    this.locations.set(id, to);
    this._refreshZones(previous, to);
    return this;
  }

  /**
   * Moves a card to another lane/split without repainting the board: only the source and destination
   * drop zones (and the lane counts) are re-rendered. An updated card object may be supplied.
   */
  moveCard(cardOrId, laneId, splitId = null, updatedCard = null) {
    const id = typeof cardOrId === "object" && cardOrId !== null ? this._id(cardOrId) : String(cardOrId);
    if (!this.cards.has(id)) return false;
    const lane = this._lane(laneId);
    if (!lane) throw new Error(`Unknown Kanban lane: ${laneId}`);
    if (splitId != null && !(lane.splitLanes || []).some((split) => String(split.id) === String(splitId)))
      throw new Error(`Unknown split lane ${splitId} in ${laneId}.`);
    const from = this.locations.get(id);
    const to = { laneId: String(laneId), splitId: splitId == null ? null : String(splitId) };
    if (updatedCard) this.cards.set(id, updatedCard);
    this.locations.set(id, to);
    this._refreshZones(from, to);
    return true;
  }

  /** Re-renders only the given drop zones (locations are { laneId, splitId }) and their counts. */
  _refreshZones(...locations) {
    const seen = new Set();
    locations.filter(Boolean).forEach((loc) => {
      const key = `${loc.laneId}|${loc.splitId ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      const lane = this._lane(loc.laneId);
      if (!lane) return;
      const laneEl = Array.from(this.root.querySelectorAll(".fkb-lane")).find((el) => el.dataset.lane === String(lane.id));
      if (!laneEl) return this.render();
      const split = loc.splitId == null ? null : (lane.splitLanes || []).find((item) => String(item.id) === loc.splitId) ?? null;
      const zone = Array.from(laneEl.querySelectorAll(".fkb-dropzone"))
        .find((el) => (el.dataset.splitId ?? null) === (split ? String(split.id) : null));
      if (!zone) return this.render();
      zone.outerHTML = this._dropzone(lane, split);
      this._refreshCounts(lane, laneEl);
    });
  }

  _refreshCounts(lane, laneEl) {
    const splits = lane.splitLanes || [];
    const laneCount = splits.length
      ? splits.reduce((sum, split) => sum + this._cardsAt(lane.id, split.id).length, 0)
      : this._cardsAt(lane.id).length;
    const laneCountEl = laneEl.querySelector(".fkb-lane-head .fkb-count");
    if (laneCountEl) laneCountEl.textContent = laneCount;
    splits.forEach((split) => {
      const section = Array.from(laneEl.querySelectorAll(".fkb-split")).find((el) => el.dataset.split === String(split.id));
      const countEl = section?.querySelector(".fkb-split-head .fkb-count");
      if (countEl) countEl.textContent = this._cardsAt(lane.id, split.id).length;
    });
  }

  _cardElement(id) {
    return Array.from(this.root.querySelectorAll(".fkb-card")).find((el) => el.dataset.cardId === String(id)) ?? null;
  }

  _setPending(id, busy) {
    if (busy) this.pending.add(id); else this.pending.delete(id);
    const el = this._cardElement(id);
    if (!el) return;
    el.classList.toggle("is-pending", busy);
    if (busy) el.setAttribute("draggable", "false");
  }

  getCards(laneId = null, splitId = null) {
    return Array.from(this.cards.entries())
      .filter(([id]) => laneId == null || (this.locations.get(id)?.laneId === String(laneId)
        && (splitId == null || this.locations.get(id)?.splitId === String(splitId))))
      .map(([, card]) => card);
  }

  setFilter(value) {
    this.filterText = String(value ?? "");
    this.render();
    return this;
  }

  setSort(sortId) {
    if ((this.options.sortOptions || []).some((option) => option.id === sortId)) {
      this.sortBy = sortId;
      this.render();
    }
    return this;
  }

  _matchesFilter(card) {
    if (!this.filterText.trim()) return true;
    const fields = this.options.filterable || [];
    const needle = this.filterText.trim().toLocaleLowerCase();
    return fields.some((field) => {
      const value = typeof field === "function" ? field(card) : readPath(card, field);
      return value != null && String(value).toLocaleLowerCase().includes(needle);
    });
  }

  _cardsAt(laneId, splitId = null) {
    const rows = Array.from(this.cards.entries())
      .filter(([id]) => {
        const location = this.locations.get(id);
        return location?.laneId === String(laneId)
          && (splitId == null ? location.splitId == null : location.splitId === String(splitId));
      })
      .map(([id, card]) => ({ id, card }))
      .filter(({ card }) => this._matchesFilter(card));
    const sorter = (this.options.sortOptions || []).find((option) => option.id === this.sortBy);
    if (sorter?.compare) rows.sort((a, b) => sorter.compare(a.card, b.card));
    return rows;
  }

  _cardHtml(id, card, lane, split) {
    const renderer = lane.renderCard || this.options.renderCard;
    const body = renderer ? renderer(card, { lane, split, board: this }) : escapeHtml(card?.title ?? id);
    const busy = this.pending.has(id);
    const draggable = !busy && this._canMoveFrom(id, card);
    return `<article class="fkb-card${busy ? " is-pending" : ""}" draggable="${draggable}"
      data-card-id="${escapeHtml(id)}" aria-grabbed="false">${body}</article>`;
  }

  _canMoveFrom(id, card) {
    const from = this.locations.get(id);
    if (!from) return false;
    return this.lanes.some((lane) => {
      const splits = lane.splitLanes || [];
      const destinations = splits.length
        ? splits.map((split) => ({ laneId: String(lane.id), splitId: String(split.id) }))
        : [{ laneId: String(lane.id), splitId: null }];
      return destinations.some((to) => (to.laneId !== from.laneId || to.splitId !== from.splitId)
        && this._canDrop(card, from, to));
    });
  }

  _dropzone(lane, split = null) {
    const cards = this._cardsAt(lane.id, split?.id);
    const contents = cards.length
      ? cards.map(({ id, card }) => this._cardHtml(id, card, lane, split)).join("")
      : `<div class="fkb-empty">${escapeHtml(split?.emptyText || lane.emptyText || "No cards")}</div>`;
    return `<div class="fkb-dropzone" data-lane-id="${escapeHtml(lane.id)}"${split ? ` data-split-id="${escapeHtml(split.id)}"` : ""}>${contents}</div>`;
  }

  _laneHtml(lane) {
    const splits = lane.splitLanes || [];
    const body = splits.length
      ? `<div class="fkb-splits">${splits.map((split) => `<section class="fkb-split" data-split="${escapeHtml(split.id)}"><header class="fkb-split-head"><span>${escapeHtml(split.title || split.id)}</span><span class="fkb-count">${this._cardsAt(lane.id, split.id).length}</span></header>${this._dropzone(lane, split)}</section>`).join("")}</div>`
      : this._dropzone(lane);
    const count = splits.length
      ? splits.reduce((sum, split) => sum + this._cardsAt(lane.id, split.id).length, 0)
      : this._cardsAt(lane.id).length;
    return `<section class="fkb-lane${lane.className ? ` ${escapeHtml(lane.className)}` : ""}" data-lane="${escapeHtml(lane.id)}">
      <header class="fkb-lane-head"><h2>${escapeHtml(lane.title || lane.id)}</h2><span class="fkb-count">${count}</span></header>${body}</section>`;
  }

  render() {
    const fields = this.options.sortOptions || [];
    const filter = this.options.showFilter === false ? "" : `<div class="fkb-filter"><input type="search" data-kanban-filter aria-label="Filter cards" placeholder="${escapeHtml(this.options.filterPlaceholder || "Filter cards…")}" value="${escapeHtml(this.filterText)}"></div>`;
    const sort = fields.length > 0 ? `<div class="fkb-sort"><select data-kanban-sort aria-label="Sort cards">${fields.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === this.sortBy ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></div>` : "";
    this.root.innerHTML = `<div class="fkb-toolbar">${filter}${sort}</div><div class="fkb-lanes">${this.lanes.map((lane) => this._laneHtml(lane)).join("")}</div>`;
    return this;
  }

  _canDrop(card, from, to) {
    if (!this._lane(to.laneId)) return false;
    const lane = this._lane(to.laneId);
    if (to.splitId != null && !(lane.splitLanes || []).some((split) => String(split.id) === to.splitId)) return false;
    const split = (lane.splitLanes || []).find((item) => String(item.id) === to.splitId);
    const canDrop = split?.canDrop || lane.canDrop || this.options.canDrop;
    return canDrop ? canDrop(card, from, to, this) !== false : from.laneId !== to.laneId || from.splitId !== to.splitId;
  }

  async _move(id, to) {
    const card = this.cards.get(id);
    const from = this.locations.get(id);
    if (!card || !from || this.pending.has(id) || (from.laneId === to.laneId && from.splitId === to.splitId) || !this._canDrop(card, from, to)) return;
    // Optimistic move: the card lands in the destination right away, shown as "in flight" (pending),
    // until onMove confirms. On failure it jumps back to the source lane.
    const target = { laneId: to.laneId, splitId: to.splitId };
    this.pending.add(id);
    this.locations.set(id, target);
    this._refreshZones(from, target);
    let ok = false;
    try {
      const destinationLane = this._lane(to.laneId);
      const destinationSplit = (destinationLane.splitLanes || []).find((split) => String(split.id) === to.splitId);
      const onMove = destinationSplit?.onMove || destinationLane.onMove || this.options.onMove;
      ok = (onMove ? await onMove(card, from, to, this) : true) !== false;
    } catch (error) {
      this.options.onMoveError?.(error, card, from, to);
    } finally {
      this.pending.delete(id);
      // Roll back only if the card is still where we optimistically put it (a resync may have placed it elsewhere).
      const current = this.locations.get(id);
      if (!ok && this.cards.has(id) && current && current.laneId === target.laneId && current.splitId === target.splitId)
        this.locations.set(id, from);
      // Only the source and destination zones are re-rendered; the rest of the board is untouched.
      this._refreshZones(from, target);
    }
  }

  _bindEvents() {
    this.root.addEventListener("input", (event) => {
      if (!event.target.matches("[data-kanban-filter]")) return;
      this.filterText = event.target.value;
      this.options.onFilterChange?.(this.filterText, this);
      this.render();
      const input = this.root.querySelector("[data-kanban-filter]");
      input?.focus();
      input?.setSelectionRange(this.filterText.length, this.filterText.length);
    });
    this.root.addEventListener("change", (event) => {
      if (event.target.matches("[data-kanban-sort]")) this.setSort(event.target.value);
    });
    this.root.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".fkb-card");
      if (!card || card.getAttribute("draggable") !== "true") return event.preventDefault();
      this.draggedId = card.dataset.cardId;
      card.setAttribute("aria-grabbed", "true");
      event.dataTransfer?.setData("text/plain", this.draggedId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    this.root.addEventListener("dragend", () => {
      this.draggedId = null;
      this.root.querySelectorAll(".is-drag-over").forEach((element) => element.classList.remove("is-drag-over"));
      this.root.querySelectorAll('[aria-grabbed="true"]').forEach((element) => element.setAttribute("aria-grabbed", "false"));
    });
    this.root.addEventListener("dragover", (event) => {
      const zone = event.target.closest(".fkb-dropzone");
      const id = this.draggedId || event.dataTransfer?.getData("text/plain");
      const from = this.locations.get(id);
      if (!zone || !from || !this._canDrop(this.cards.get(id), from, { laneId: zone.dataset.laneId, splitId: zone.dataset.splitId || null })) return;
      event.preventDefault();
      event.dataTransfer && (event.dataTransfer.dropEffect = "move");
      zone.classList.add("is-drag-over");
    });
    this.root.addEventListener("dragleave", (event) => {
      const zone = event.target.closest(".fkb-dropzone");
      if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove("is-drag-over");
    });
    this.root.addEventListener("drop", (event) => {
      const zone = event.target.closest(".fkb-dropzone");
      const id = this.draggedId || event.dataTransfer?.getData("text/plain");
      if (!zone || !id) return;
      const from = this.locations.get(id);
      const to = { laneId: zone.dataset.laneId, splitId: zone.dataset.splitId || null };
      if (!from || !this._canDrop(this.cards.get(id), from, to)) return;
      event.preventDefault();
      void this._move(id, to);
    });
  }

  destroy() {
    this.root.remove();
    this.cards.clear();
    this.locations.clear();
  }
}

export const FloriaKanbanBoard = FloriaKanban;