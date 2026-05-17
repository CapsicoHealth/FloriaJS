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

import { FloriaCharts2 } from "./module-charts2.js";
export { FloriaCharts2 };
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { createPopper } from "/static/jslibs/popperjs/popper.js";

/**
 * Renders an interactive knowledge graph using D3.js
 * 
 * @param {string} divId - The ID of the div element to render the graph in
 * @param {Array} data - Array of objects with structure: { entity1: "", entity2: "", relation: "" }
 * 
 * Expected dimensions: ~400px width × 800px height
 * Requires D3.js library to be loaded
 */
FloriaCharts2.knowledgeGraph = function(divId, data) {
    // Clear any existing SVG in the div
    const MIN_ZOOM_LEVEL = 0.15;
    const MAX_ZOOM_LEVEL = 0.75;
    const container = d3.select(`#${divId}`);
    container.selectAll("*").remove();

    /////////////////////////////////////////////////////////////////////////////////////////
    // RESET VIEW
    /////////////////////////////////////////////////////////////////////////////////////////

    function resetView() {
        // Use current container dimensions (important for fullscreen mode)
        const containerNode = container.node();
        const currentWidth = containerNode.clientWidth;
        const currentHeight = containerNode.clientHeight;

        const bounds = g.node().getBBox();
        const fullWidth = bounds.width;
        const fullHeight = bounds.height;
        const midX = bounds.x + fullWidth / 2;
        const midY = bounds.y + fullHeight / 2;

        const scale = 0.9 / Math.max(fullWidth / currentWidth, fullHeight / currentHeight);
        const translate = [currentWidth / 2 - scale * midX, currentHeight / 2 - scale * midY];

        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }
    
    function resetNodePositions() {
        // Scatter nodes to random positions around center
        nodes.forEach(n => {
            n.x = width / 2 + (Math.random() - 0.5) * width * 0.5;
            n.y = height / 2 + (Math.random() - 0.5) * height * 0.5;
            n.fx = null;
            n.fy = null;
        });

        simulation.alpha(1).restart();
    }


    // Help button with modal
    const helpButton = container
        .append("button")
        .attr("class", "help-button")
        .style("position", "absolute")
        .style("top", "4px")
        .style("left", "40px")
        .style("z-index", "1000")
        .style("padding", "4px 4px")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("font-size", "1.25rem")
        .style("cursor", "pointer")
        .style("line-height", "1")
        .style("height", "28px")
        .style("width", "28px")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .html("?")
        .attr("title", "Help")
        .on("click", showHelpModal)
        .on("mouseover", function() {
            d3.select(this).style("background", "#f0f0f0");
        })
        .on("mouseout", function() {
            d3.select(this).style("background", "white");
        });


    function showHelpModal() {
        // Create modal overlay
        const modal = d3.select("body")
            .append("div")
            .attr("class", "help-modal-overlay")
            .style("position", "fixed")
            .style("top", "0")
            .style("left", "0")
            .style("width", "100%")
            .style("height", "100%")
            .style("background", "rgba(0,0,0,0.5)")
            .style("z-index", "10001")
            .style("display", "flex")
            .style("align-items", "center")
            .style("justify-content", "center")
            .style("backdrop-filter","blur(4px)")
            .on("click", function(event) {
                if (event.target === this) {
                    modal.remove();
                }
            });

        // Create modal content
        const modalContent = modal
            .append("div")
            .style("background", "white")
            .style("border-radius", "8px")
            .style("max-width", "600px")
            .style("max-height", "80vh")
            .style("box-shadow", "0 4px 20px rgba(0,0,0,0.3)")
            .style("position", "relative")
            .style("display", "flex")
            .style("flex-direction", "column");

        // Fixed header
        const modalHeader = modalContent
            .append("div")
            .style("padding", "20px")
            .style("padding-bottom", "10px")
            .style("border-bottom", "1px solid #eee")
            .style("flex-shrink", "0");

        modalHeader.append("h2")
            .style("margin", "0")
            .style("color", "#333")
            .text("Knowledge Graph Help");

        // Close button
        modalContent
            .append("button")
            .style("position", "absolute")
            .style("top", "10px")
            .style("right", "10px")
            .style("background", "transparent")
            .style("border", "none")
            .style("font-size", "24px")
            .style("cursor", "pointer")
            .style("color", "#666")
            .html("×")
            .on("click", () => modal.remove())
            .on("mouseover", function() {
                d3.select(this).style("color", "#000");
            })
            .on("mouseout", function() {
                d3.select(this).style("color", "#666");
            });

        // Scrollable help content
        const helpContent = modalContent
            .append("div")
            .style("padding", "20px")
            .style("overflow-y", "auto")
            .style("flex", "1")
            .style("font-family", "Arial, sans-serif");
            
        let sectionStyle = 'color: #003388; font-size: 1.25rem; border-bottom: 1px solid #00338833;';



        helpContent.html(`
            <h3 style="${sectionStyle}">Navigation</h3>
            <ul style="line-height: 1.8;">
                <li><strong>Pan:</strong> Click and drag on empty space</li>
                <li><strong>Zoom:</strong> Scroll wheel or pinch gesture</li>
                <li><strong>Drag nodes:</strong> Click and drag any node to reposition</li>
                <li><strong>Fullscreen:</strong> Click ⛶ button to expand; click ⊡ to restore</li>
                <li><strong>Reset view:</strong> Click ⟲ Recenter in Graph Controls to fit all visible nodes</li>
                <li><strong>Reset positions:</strong> Click ↻ Reset Pos to scatter nodes randomly</li>
            </ul>

            <h3 style="${sectionStyle}">Node Interaction</h3>
            <ul style="line-height: 1.8;">
                <li><strong>Click node:</strong> Highlight connections at increasing depths (1→3→5→all→reset)</li>
                <li><strong>Hover node:</strong> View connected relationships in popup (300ms delay)</li>
                <li><strong>Click popup:</strong> Make it sticky with close button (✕)</li>
                <li><strong>Depth indicator:</strong> Click the depth label (top right) to cycle through connection levels</li>
                <li><strong>Node size:</strong> Larger nodes have more connections (scaled in 5 quintiles)</li>
            </ul>

            <h3 style="${sectionStyle}">Search & Filters</h3>
            <ul style="line-height: 1.8;">
                <li><strong>Search:</strong> Type in search box (top right) to filter entities</li>
                <li><strong>Search dropdown:</strong> Shows matching nodes (click to select; up to 10 shown)</li>
                <li><strong>Min Connections:</strong> Filter by connectivity threshold (custom value via input)</li>
                <li><strong>Hide Islands:</strong> Remove disconnected components below threshold</li>
                <li><strong>Spanning Tree:</strong> Show minimal connections with density control (1-5)</li>
                <li><strong>Graph spacing:</strong> Adjust node density from very sparse (1) to very dense (5)</li>
                <li><strong>Graph Controls:</strong> Click header to expand/collapse filter panel</li>
                <li><strong>Status indicator:</strong> Shows active filters in header (e.g., "all, medium")</li>
            </ul>

            <h3 style="${sectionStyle}">Export Options</h3>
            <ul style="line-height: 1.8;">
                <li><strong>CSV Export:</strong> Download graph as triplets (entity1, relation, entity2)</li>
                <li><strong>JSON-LD Export:</strong> Export as semantic web format with @context and relationships</li>
                <li><strong>Files:</strong> Named with timestamp to prevent overwrites</li>
            </ul>

            <h3 style="${sectionStyle}">Popup Features</h3>
            <ul style="line-height: 1.8;">
                <li><strong>Filter relationships:</strong> Type in filter box to narrow connection list</li>
                <li><strong>Sort options:</strong> Group by connected node or by relationship type</li>
                <li><strong>Clickable nodes:</strong> Click any node name in popup to navigate to it</li>
                <li><strong>Sticky mode:</strong> Click popup to keep it open; blue border indicates sticky state</li>
            </ul>

            <h3 style="${sectionStyle}">Display Options</h3>
            <ul style="line-height: 1.8;">
                <li><strong>Edge labels:</strong> Toggle visibility via checkbox in Graph Controls</li>
                <li><strong>Statistics:</strong> Shows visible/total node count (e.g., "45 / 120 nodes")</li>
                <li><strong>Auto-zoom:</strong> Automatically fits visible nodes when filters change</li>
            </ul>

            <p style="margin-top: 20px; font-size: 1rem; color: #666;">
                <em>Tip: All filters work together—combine connectivity, islands, and spanning tree for powerful exploration!</em>
            </p>
        `);
    }

        
    
    // Fullscreen toggle button
    let isExpanded = false;
    let originalContainerStyle = null;

    const expandButton = container
        .append("button")
        .attr("class", "expand-button")
        .style("position", "absolute")
        .style("top", "4px")
        .style("left", "10px")
        .style("z-index", "1000")
        .style("padding", "4px 4px")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("font-size", "1.25rem")
        .style("cursor", "pointer")
        .style("line-height", "1")
        .style("width", "28px")
        .style("height", "28px")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .html("⛶")
        .attr("title", "Expand to (or reset from) fullscreen")
        .on("click", toggleFullscreen)
        .on("mouseover", function() {
            d3.select(this).style("background", "#f0f0f0");
        })
        .on("mouseout", function() {
            d3.select(this).style("background", "white");
        });



        function toggleFullscreen() {
            const containerNode = container.node();

            if (!isExpanded) {
                // Save original styles
                originalContainerStyle = {
                    position: containerNode.style.position,
                    top: containerNode.style.top,
                    left: containerNode.style.left,
                    width: containerNode.style.width,
                    height: containerNode.style.height,
                    zIndex: containerNode.style.zIndex
                };

                // Apply fullscreen styles
                container
                    .style("position", "fixed")
                    .style("top", "6vh")
                    .style("left", "3vw")
                    .style("width", "92vw")
                    .style("height", "90vh")
                    .style("z-index", "9999")
                    .style("background", "#f0f7ff")
                    .style("box-shadow", "0 4px 16px rgba(0,0,0,0.3)");

                expandButton.html("⊡");
                isExpanded = true;
            } else {
                // Restore original styles
                container
                    .style("position", originalContainerStyle.position)
                    .style("top", originalContainerStyle.top)
                    .style("left", originalContainerStyle.left)
                    .style("width", originalContainerStyle.width)
                    .style("height", originalContainerStyle.height)
                    .style("z-index", originalContainerStyle.zIndex)
                    .style("background", "transparent")
                    .style("box-shadow", "none");

                expandButton.html("⛶");
                isExpanded = false;
            }

            // CRITICAL: Update global width/height variables
            width = containerNode.clientWidth;
            height = containerNode.clientHeight;

            // Update SVG viewBox
            svg.attr("viewBox", [0, 0, width, height]);

            // Recalculate all dimension-dependent values
            const minDim = Math.min(width, height);
            const newLinkDistance = Math.max(50, minDim / 5);
            const newChargeStrength = -Math.max(100, minDim / 3);

            // Reset ALL node positions to center
            nodes.forEach(n => {
                n.x = width / 2 + (Math.random() - 0.5) * 100;
                n.y = height / 2 + (Math.random() - 0.5) * 100;
                n.fx = null;
                n.fy = null;
            });

            // Update all forces with new dimensions
            simulation.force("center", d3.forceCenter(width / 2, height / 2));
            simulation.force("link").distance(newLinkDistance);
            simulation.force("charge").strength(newChargeStrength);
            simulation.force("collision").radius(Math.max(6, minDim / 50) * 2);

            // Update zoom constraints
            zoom.translateExtent([[-width * 3, -height * 3], [width * 4, height * 4]]);

            // Restart with full energy
            simulation.alpha(1).restart();

            // Wait for layout to stabilize before resetting view
            setTimeout(resetView, 2000);
        }

    


    /////////////////////////////////////////////////////////////////////////////////////////
    // Search/Filter
    /////////////////////////////////////////////////////////////////////////////////////////        
    // Search/Filter with interactive dropdown
    const searchContainer = container
        .append("div")
        .attr("class", "search-container")
        .style("position", "absolute")
        .style("top", "4px")
        .style("right", "10px")
        .style("z-index", "1000");

    const searchInput = searchContainer
        .append("input")
        .attr("type", "text")
        .attr("placeholder", "Search entities...")
        .attr("class", "search-input")
        .style("padding", "5px 10px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .on("input", function() {
            const searchTerm = this.value.toLowerCase().trim();
            filterGraph(searchTerm);
            updateSearchFeedback(searchTerm);
        })
        .on("focus", function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm) {
            updateSearchFeedback(searchTerm); // Show dropdown on focus
        }
        if (searchTerm && selectedNodeId !== null) {
            selectedNodeId = null;
            selectedNodeLevel = -1;
            updateLevelIndicator();
            filterGraph(searchTerm);
        }
    });

    // Add feedback/dropdown display
    const searchFeedback = searchContainer
        .append("div")
        .attr("class", "search-feedback")
        .style("position", "absolute")
        .style("top", "35px")
        .style("right", "0")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("padding", "0")
        .style("font-size", "12px")
        .style("min-width", "150px")
        .style("max-width", "250px")
        .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
        .style("display", "none");
    
    // Hide dropdown when clicking outside
    d3.select("body").on("click", function(event) {
        if (!searchContainer.node().contains(event.target)) {
            searchFeedback.style("display", "none");
        }
    });

    function updateSearchFeedback(searchTerm) {
        if (!searchTerm) {
            searchFeedback.style("display", "none");
            return;
        }
    
        const matchingNodes = nodes.filter(n =>
            n.label.toLowerCase().includes(searchTerm)
        );
    
        searchFeedback.selectAll("*").remove();
    
        if (matchingNodes.length === 0) {
            searchFeedback
                .style("display", "block")
                .append("div")
                .style("padding", "8px 12px")
                .style("color", "#999")
                .text("No matches");
        } else if (matchingNodes.length <= 10) {
            // Show clickable list of matching nodes
            searchFeedback.style("display", "block");
    
            matchingNodes.forEach((n, idx) => {
                searchFeedback
                    .append("div")
                    .style("padding", "8px 12px")
                    .style("cursor", "pointer")
                    .style("border-bottom", idx < matchingNodes.length - 1 ? "1px solid #eee" : "none")
                    .style("transition", "background 0.15s")
                    .text(n.label)
                    .on("mouseover", function() {
                        d3.select(this).style("background", "#f0f0f0");
                    })
                    .on("mouseout", function() {
                        d3.select(this).style("background", "white");
                    })
                    .on("click", function(event) {
                        event.stopPropagation();
                        // Clear search mode and select the node
                        filteredNodeIds = null;
                        searchFeedback.style("display", "none");
    
                        // Reset all nodes first
                        node.style("opacity", 1);
                        node.select("circle").attr("fill", d => colorScale(d.id));
                        link.style("opacity", 0.6);
                        linkLabel.style("opacity", 0.3);
    
                        // Highlight the selected node
                        highlightConnectedNodes(n.id);
                    });
            });
        } else {
            // Show count
            searchFeedback
                .style("display", "block")
                .append("div")
                .style("padding", "8px 12px")
                .style("color", "#333")
                .text(`${matchingNodes.length} matches`);
        }
    }
        
    // Add focus/blur handlers to search input
    searchInput.on("focus", function() {
        // When search input gains focus, restore search mode
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm && selectedNodeId !== null) {
            // Clear node selection and restore search results
            selectedNodeId = null;
            selectedNodeLevel = -1;
            updateLevelIndicator();
            filterGraph(searchTerm); // Re-apply search filter
        }
        updateSearchFeedback(searchTerm);
    });
    

    // Track filtered state
    let filteredNodeIds = null; // null = no filter active, Set = filtered nodes

    function filterGraph(searchTerm) {
        if (!searchTerm) {
            // Clear filter
            filteredNodeIds = null;
            node.style("opacity", 1);
            node.select("circle").attr("fill", d => colorScale(d.id));
            link.style("opacity", 0.3); // Make links subtle by default
            linkLabel.style("opacity", 0.3);
//            simulation.alpha(1).restart();
            resetView();
            return;
        }

        // Filter nodes that match the search term
        const matchingNodes = nodes.filter(n =>
            n.label.toLowerCase().includes(searchTerm)
        );
        filteredNodeIds = new Set(matchingNodes.map(n => n.id));

        // Highlight ONLY matching nodes
        node.style("opacity", d => filteredNodeIds.has(d.id) ? 1 : 0.15);
        node.select("circle")
            .attr("fill", d => filteredNodeIds.has(d.id) ? "#ff6b6b" : "#ccc"); // Bright color for matches

        // Dim ALL links and labels
        link.style("opacity", 0.1);
        linkLabel.style("opacity", 0.1);

        // Zoom to show all matching nodes
        if (filteredNodeIds.size > 0) {
            zoomToHighlighted(filteredNodeIds);
        }
    }

    // Update zoomToHighlighted to respect filtered state
    const originalZoomToHighlighted = zoomToHighlighted;
    function zoomToHighlighted(highlightedNodeIds) {
        // Only zoom if we're not in a filtered search state, or if explicitly called by search
        if (filteredNodeIds !== null && highlightedNodeIds !== filteredNodeIds) {
            return; // Prevent zoom during node selection when search is active
        }

        const highlightedNodes = nodes.filter(n => highlightedNodeIds.has(n.id));

        if (highlightedNodes.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        highlightedNodes.forEach(node => {
            minX = Math.min(minX, node.x - nodeRadius);
            minY = Math.min(minY, node.y - nodeRadius);
            maxX = Math.max(maxX, node.x + nodeRadius);
            maxY = Math.max(maxY, node.y + nodeRadius);
        });

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const padding = 1.10;
        const scale = Math.min(
            width / (boundsWidth * padding),
            height / (boundsHeight * padding),
            MAX_ZOOM_LEVEL
        );

        const translate = [
            width / 2 - scale * midX,
            height / 2 - scale * midY
        ];

        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }

    
    
    /////////////////////////////////////////////////////////////////////////////////////////
    // Node Selection
    /////////////////////////////////////////////////////////////////////////////////////////        
    let selectedNodeId = null;
    let selectedNodeLevel = -1; // Index into levels array (-1 means no selection)
    const levels = [1, 3, 5, -1, 0]; // Configurable depth levels: limited depths, full graph (-1), and reset (0)


    function highlightConnectedNodes(nodeId) {
        // Cycle through levels
        if (selectedNodeId === nodeId) {
            selectedNodeLevel = (selectedNodeLevel + 1) % levels.length;

            // If we've cycled back to reset (0), clear highlight but keep selection
            if (levels[selectedNodeLevel] === 0) {
                resetHighlight();
                return;  // Don't clear selectedNodeId/selectedNodeLevel
            }
        } else {
            // New node clicked, start at first level
            selectedNodeId = nodeId;
            selectedNodeLevel = 0;
        }

        const maxDepth = levels[selectedNodeLevel];

        // Build adjacency list for traversal
        const adjacencyList = new Map();
        nodes.forEach(n => adjacencyList.set(n.id, { outgoing: [], incoming: [] }));

        links.forEach(l => {
            const sourceId = l.source.id || l.source;
            const targetId = l.target.id || l.target;
            adjacencyList.get(sourceId).outgoing.push(targetId);
            adjacencyList.get(targetId).incoming.push(sourceId);
        });

        // BFS with depth tracking
        const connectedNodes = new Set([nodeId]);
        const queue = [{ id: nodeId, depth: 0 }];

        while (queue.length > 0) {
            const { id: current, depth } = queue.shift();

            if (maxDepth !== -1 && depth >= maxDepth) continue;

            const neighbors = adjacencyList.get(current);

            neighbors.outgoing.forEach(neighbor => {
                if (!connectedNodes.has(neighbor)) {
                    connectedNodes.add(neighbor);
                    queue.push({ id: neighbor, depth: depth + 1 });
                }
            });

            neighbors.incoming.forEach(neighbor => {
                if (!connectedNodes.has(neighbor)) {
                    connectedNodes.add(neighbor);
                    queue.push({ id: neighbor, depth: depth + 1 });
                }
            });
        }

        // Update node styles
        node.style("opacity", d => connectedNodes.has(d.id) ? 1 : 0.15);
        node.select("circle")
            .attr("fill", d => connectedNodes.has(d.id) ? colorScale(d.id) : "#ccc");

        // Update link styles
        link.style("opacity", l => {
            const sourceId = l.source.id || l.source;
            const targetId = l.target.id || l.target;
            return (connectedNodes.has(sourceId) && connectedNodes.has(targetId)) ? 1 : 0.1;
        });

        linkLabel.style("opacity", l => {
            const sourceId = l.source.id || l.source;
            const targetId = l.target.id || l.target;
            return (connectedNodes.has(sourceId) && connectedNodes.has(targetId)) ? 1 : 0.1;
        });

        updateLevelIndicator();

        // Add zoom to highlighted nodes - ALWAYS zoom when selecting
        zoomToHighlighted(connectedNodes);
    }


    function zoomToHighlighted(highlightedNodeIds) {
        const highlightedNodes = nodes.filter(n => highlightedNodeIds.has(n.id));

        if (highlightedNodes.length === 0) return;

        // Calculate bounding box of highlighted nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        highlightedNodes.forEach(node => {
            minX = Math.min(minX, node.x - nodeRadius);
            minY = Math.min(minY, node.y - nodeRadius);
            maxX = Math.max(maxX, node.x + nodeRadius);
            maxY = Math.max(maxY, node.y + nodeRadius);
        });

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        // Add padding (10%)
        const padding = 1.10;
        const scale = Math.min(
            width / (boundsWidth * padding),
            height / (boundsHeight * padding),
            MAX_ZOOM_LEVEL // Max zoom level
        );

        const translate = [
            width / 2 - scale * midX,
            height / 2 - scale * midY
        ];

        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }



    function resetHighlight() {
        node.style("opacity", 1);
        node.select("circle").attr("fill", d => colorScale(d.id));
        link.style("opacity", 1);
        linkLabel.style("opacity", 1);
        updateLevelIndicator();
    }


    // Add level indicator label with click handler
    const levelIndicator = container
        .append("div")
        .attr("class", "level-indicator")
        .style("position", "absolute")
        .style("top", "4px")
        .style("right", "240px")
        .style("padding", "5px 10px")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("display", "none")
        .style("cursor", "pointer")
        .style("transition", "all 0.2s ease")
        .attr("title", "Depth indicator - click to cycle through levels")
        .on("click", function() {
            if (selectedNodeId !== null) {
                highlightConnectedNodes(selectedNodeId);
            }
        })
        .on("mouseover", function() {
            d3.select(this)
                .style("background", "#f0f0f0")
                .style("border-color", "#999");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("background", "white")
                .style("border-color", "#ccc");
        });

    function updateLevelIndicator() {
        if (selectedNodeId === null || selectedNodeLevel === -1) {
            levelIndicator.style("display", "none");
            return;
        }

        const depthValue = levels[selectedNodeLevel];
        const depthText = depthValue === -1 ? "all" : depthValue === 0 ? "none" : depthValue;
        const nodeLabel = nodes.find(n => n.id === selectedNodeId)?.label || selectedNodeId;

        levelIndicator
            .style("display", "block")
            .html(`
                <strong>&nbsp;${nodeLabel}</strong> 
                <span style="color: #0066cc; text-decoration: underline;">depth: ${depthText}</span>
               `);
    }




    /////////////////////////////////////////////////////////////////////////////////////////
    // Main
    /////////////////////////////////////////////////////////////////////////////////////////        
    // Get actual dimensions from the container
    const containerNode = container.node();
    let width = containerNode.clientWidth || 400;
    let height = containerNode.clientHeight || 800;

    // Scale configuration based on dimensions
    const minDimension = Math.min(width, height);
    const maxDimension = Math.max(width, height);
    const nodeRadius = Math.max(6, minDimension / 50);
    const linkDistance = Math.max(50, minDimension / 5);
    const chargeStrength = -Math.max(100, minDimension / 3);

    // Create SVG
    const svg = container
        .append("svg")
        .attr("width", "100%")
        .attr("height", "97%")
        .attr("viewBox", [0, 0, width, height])
        .style("background", "#f0f7ff")
        .style("margin-top", "1.25rem")
        ;

    svg.on("click", function(event) {
        if (event.target === this) {
            selectedNodeId = null;
            selectedNodeLevel = -1;
            resetHighlight();
            hidePopper(); // Close popper when clicking whitespace
        }
    });

    
    
    
    /////////////////////////////////////////////////////////////////////////////////////////
    // Rendering the graph
    /////////////////////////////////////////////////////////////////////////////////////////        
    // Create a group for zoom/pan
    const g = svg.append("g");

    // Extract nodes and links from data
    const nodesMap = new Map();
    const links = [];

    data.forEach(item => {
        // Add entity1 if not exists
        if (!nodesMap.has(item.entity1)) {
            nodesMap.set(item.entity1, {
                id: item.entity1,
                label: item.entity1
            });
        }

        // Add entity2 if not exists
        if (!nodesMap.has(item.entity2)) {
            nodesMap.set(item.entity2, {
                id: item.entity2,
                label: item.entity2
            });
        }

        // Add link
        links.push({
            source: item.entity1,
            target: item.entity2,
            relation: item.relation
        });
    });

    const nodes = Array.from(nodesMap.values());

    // Calculate connectivity (number of connections per node)
    nodes.forEach(n => {
        n.connectivity = links.filter(l => 
            (l.source.id || l.source) === n.id || 
            (l.target.id || l.target) === n.id
        ).length;
    });
    
    // Calculate min/max connectivity for sizing
    const connectivityValues = nodes.map(n => n.connectivity);
    const minConnectivity = Math.min(...connectivityValues);
    const maxConnectivity = Math.max(...connectivityValues);
    const connectivityRange = maxConnectivity - minConnectivity;
    const nodeLabelFontSize = Math.max(9, minDimension / 35);
    // Node size range constants
    const MIN_NODE_SIZE = 10;
    const MAX_NODE_SIZE = 50;

    function getNodeRadius(connectivity) {
        if (connectivityRange === 0) return MIN_NODE_SIZE;

        const quintileSize = connectivityRange / 5;
        const quintile = Math.floor((connectivity - minConnectivity) / quintileSize);
        const clampedQuintile = Math.min(quintile, 4);

        const sizeRange = MAX_NODE_SIZE - MIN_NODE_SIZE;
        return MIN_NODE_SIZE + (clampedQuintile * (sizeRange / 4));
    }

    function getNodeLabelSize(connectivity) {
        if (connectivityRange === 0) return nodeLabelFontSize;

        const quintileSize = connectivityRange / 5;
        const quintile = Math.floor((connectivity - minConnectivity) / quintileSize);
        const clampedQuintile = Math.min(quintile, 4);

        const labelSizeRange = (MAX_NODE_SIZE - MIN_NODE_SIZE) * 0.75; // Scale label range proportionally
        return nodeLabelFontSize + (clampedQuintile * (labelSizeRange / 4));
    }
    

    // Color scale for nodes
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Create arrow markers for directed edges
    svg.append("defs").selectAll("marker")
        .data(["end"])
        .enter().append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", nodeRadius * 2.5)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#999");

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(linkDistance))
        .force("charge", d3.forceManyBody().strength(chargeStrength))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(nodeRadius * 2));

    // Create links
    const link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrowhead)");

    // Create link labels
    const linkLabelFontSize = Math.max(8, minDimension / 40);
    const linkLabel = g.append("g")
        .attr("class", "link-labels")
        .selectAll("text")
        .data(links)
        .enter().append("text")
        .attr("class", "link-label")
        .attr("font-size", `${linkLabelFontSize}px`)
        .attr("fill", "#666")
        .attr("text-anchor", "middle")
        .attr("pointer-events", "none")
        .style("user-select", "none")
        .text(d => d.relation);

    // Create nodes
    const node = g.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes)
        .enter().append("g")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
            .on("mousedown.zoom", function(event) {
                event.stopPropagation(); // Prevent zoom pan when dragging nodes
            });

    // Add circles to nodes
    node.append("circle")
        .attr("r", d => getNodeRadius(d.connectivity))
        .attr("fill", d => colorScale(d.id))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", "pointer");

    // Add labels to nodes
    const maxLabelLength = Math.max(15, Math.floor(width / 20));
    node.append("text")
        .attr("dx", d => getNodeRadius(d.connectivity) * 1.5)
        .attr("dy", d => getNodeRadius(d.connectivity) / 2)
        .attr("font-size", d => `${getNodeLabelSize(d.connectivity)}px`)
        .attr("fill", "#333")
        .style("user-select", "none")
        .text(d => {
            return d.label.length > maxLabelLength ? d.label.substring(0, maxLabelLength - 3) + "..." : d.label;
        });

    // z-order sort by connectivity
    node.sort((a, b) => a.connectivity - b.connectivity);
        
    // Highlight on hover
    node.on("mouseover", function(event, d) {
        // Use 'this' instead of event.currentTarget
        const nodeGroup = this;

        d3.select(this).select("circle")
            .attr("r", getNodeRadius(d.connectivity) * 1.5)
            .attr("stroke-width", 3);

        link.attr("stroke", l =>
            (l.source.id === d.id || l.target.id === d.id) ? "#ff6b6b" : "#999")
            .attr("stroke-width", l =>
                (l.source.id === d.id || l.target.id === d.id) ? 2.5 : 1.5);

        if (popperTimeout) clearTimeout(popperTimeout);
        popperTimeout = setTimeout(() => {
            showPopper(nodeGroup, d); // Pass 'this' directly
        }, 300);

    }).on("mouseout", function(event, d) {
        d3.select(this).select("circle")
            .attr("r", getNodeRadius(d.connectivity))
            .attr("stroke-width", 2);

        link.attr("stroke", "#999")
            .attr("stroke-width", 1.5);

        if (!isPopperSticky) {
            if (popperTimeout) clearTimeout(popperTimeout);
            popperTimeout = setTimeout(() => {
                hidePopper();
            }, 200);
        }
    }).on("click", function(event, d) {
        event.stopPropagation();

        if (filteredNodeIds !== null) {
            filteredNodeIds = null;
            node.style("opacity", 1);
            node.select("circle").attr("fill", n => colorScale(n.id));
            link.style("opacity", 0.6);
            linkLabel.style("opacity", 0.3);
        }
        highlightConnectedNodes(d.id);
    });



    // Update positions on each tick
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        linkLabel
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });



    
    
    
    /////////////////////////////////////////////////////////////////////////////////////////
    // Popper for Node Details
    /////////////////////////////////////////////////////////////////////////////////////////        

    // --- NODE POPUP WITH POPPER.JS ---
    let popperInstance = null;
    let popperElement = null;
    let isPopperSticky = false;
    let popperTimeout = null;
    let currentSortBy = "relation";

    // Create popper element
    function createPopperElement() {
        if (popperElement) return popperElement;

        // Append to document.body instead of container
        popperElement = d3.select("body")
            .append("div")
            .attr("class", "node-popper")
            .style("position", "fixed") // Changed from absolute to fixed
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("border-radius", "6px")
            .style("padding", "0")
            .style("width", "350px")
            .style("height", "600px")
            .style("max-height", "50vh")
            .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
            .style("z-index", "10000")
            .style("display", "none")
            .style("font-size", "13px")
            .on("mouseenter", function() {
                if (popperTimeout) {
                    clearTimeout(popperTimeout);
                    popperTimeout = null;
                }
            })
            .on("mouseleave", function() {
                if (!isPopperSticky) {
                    hidePopper();
                }
            })
            .on("click", function(event) {
                event.stopPropagation();
                makePopperSticky();
            });

        return popperElement;
    }

    function makePopperSticky() {
        if (isPopperSticky) return;

        isPopperSticky = true;
        popperElement
            .style("border-color", "#0066cc")
            .style("box-shadow", "0 4px 16px rgba(0,102,204,0.3)");

        // Add close button
        popperElement.select(".popper-close").style("display", "block");
    }

    function showPopper(nodeElement, d) {
        console.log("Showing popper for:", d.label); // Add this
        const element = createPopperElement();

        // Get first-degree relationships
        const relationships = [];
        links.forEach(l => {
            const sourceId = l.source.id || l.source;
            const targetId = l.target.id || l.target;

            if (sourceId === d.id) {
                const targetNode = nodes.find(n => n.id === targetId);
                relationships.push({
                    relation: l.relation,
                    target: targetNode.label,
                    direction: "outgoing"
                });
            } else if (targetId === d.id) {
                const sourceNode = nodes.find(n => n.id === sourceId);
                relationships.push({
                    relation: l.relation,
                    target: sourceNode.label,
                    direction: "incoming"
                });
            }
        });

        // Build popper content
        element.html("");

        // Header with node name and close button
        const header = element
            .append("div")
            .style("background", "#f5f5f5")
            .style("padding", "10px 12px")
            .style("border-bottom", "1px solid #ddd")
            .style("font-weight", "bold")
            .style("font-size", "1.5rem")
            .style("position", "relative");

        header.append("div")
            .style("padding-right", "24px")
            .style("overflow", "hidden")
            .style("text-overflow", "ellipsis")
            .style("white-space", "nowrap")
            .attr("title", d.label) // Native HTML tooltip
            .text(d.label);

        const closeBtn = header
            .append("div")
            .attr("class", "popper-close")
            .style("position", "absolute")
            .style("top", "8px")
            .style("right", "8px")
            .style("cursor", "pointer")
            .style("font-size", "16px")
            .style("color", "#666")
            .style("display", "none")
            .html("✕")
            .on("click", function(event) {
                event.stopPropagation();
                hidePopper();
            })
            .on("mouseenter", function() {
                d3.select(this).style("color", "#000");
            })
            .on("mouseleave", function() {
                d3.select(this).style("color", "#666");
            });

        // Filter and sort controls
        const controls = element
            .append("div")
            .style("padding", "8px 12px")
            .style("background", "#fafafa")
            .style("border-bottom", "1px solid #eee")
            .style("display", "flex")
            .style("gap", "8px")
            .style("align-items", "center");

        controls.append("input")
            .attr("type", "text")
            .attr("placeholder", "Filter...")
            .attr("class", "popper-filter")
            .style("flex", "1")
            .style("padding", "4px 8px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "3px")
            .style("font-size", "12px")
            .on("input", function() {
                updatePopperList(relationships, this.value, sortSelect.property("value"));
            });

        const sortSelect = controls.append("select")
            .style("padding", "4px 8px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "3px")
            .style("font-size", "12px")
            .on("change", function() {
                const filterValue = element.select(".popper-filter").property("value");
                updatePopperList(relationships, filterValue, this.value);
            });

        sortSelect.append("option").attr("value", "relation").text("Sort: Relation");
        sortSelect.append("option").attr("value", "target").text("Sort: Node");
        // Set the initial value from the persistent variable
        sortSelect.property("value", currentSortBy);

        // Relationships list container
        const listContainer = element
            .append("div")
            .attr("class", "popper-list")
            .style("position", "absolute")
            .style("top", "100px") // Adjust based on header + controls height
            .style("bottom", "2px")
            .style("left", "0")
            .style("right", "0")
            .style("overflow-y", "auto")
            .style("padding", "8px 12px");

        // Initial render
        updatePopperList(relationships, "", currentSortBy);
        

        function updatePopperList(rels, filterText, sortBy) {
            let filtered = rels;
            currentSortBy = sortBy;

            // Apply filter
            if (filterText) {
                const lower = filterText.toLowerCase();
                filtered = rels.filter(r =>
                    r.relation.toLowerCase().includes(lower) ||
                    r.target.toLowerCase().includes(lower)
                );
            }

            // Group and render based on sort
            listContainer.html("");

            if (filtered.length === 0) {
                listContainer.append("div")
                    .style("color", "#999")
                    .style("font-style", "italic")
                    .style("padding", "8px 0")
                    .text("No relationships found");
                return;
            }

            if (sortBy === "target") {
                // Group by target
                const grouped = new Map();
                filtered.forEach(r => {
                    if (!grouped.has(r.target)) {
                        grouped.set(r.target, []);
                    }
                    grouped.get(r.target).push(r);
                });

                // Sort targets alphabetically
                const sortedTargets = Array.from(grouped.keys()).sort();

                sortedTargets.forEach(target => {
                    const item = listContainer.append("div")
                        .style("padding", "4px 0"); // Reduced from 6px

                    item.append("div")
                        .style("font-size", "1rem")
                        .style("font-weight", "500")
                        .style("color", "#333")
                        .text(target);

                    const rels = grouped.get(target);
                    item.append("div")
                        .style("font-size", "0.9rem")
                        .style("font-weight", "500")
                        .style("color", "#666")
                        .style("margin-top", "2px")
                        .html(rels.map(r => `&nbsp;&nbsp;${r.direction === "outgoing" ? "→" : "←"} ${r.relation}`).join("<BR>"));
                });
            } else if (sortBy === "relation") {
                // Group by relation
                const grouped = new Map();
                filtered.forEach(r => {
                    if (!grouped.has(r.relation)) {
                        grouped.set(r.relation, []);
                    }
                    grouped.get(r.relation).push(r);
                });

                // Sort relations alphabetically
                const sortedRelations = Array.from(grouped.keys()).sort();

                sortedRelations.forEach(relation => {
                    const item = listContainer.append("div")
                        .style("padding", "4px 0"); // Reduced from 6px

                    item.append("div")
                        .style("font-size", "1rem")
                        .style("font-weight", "500")
                        .style("color", "#333")
                        .text(relation);

                    const rels = grouped.get(relation);
                    item.append("div")
                        .style("font-size", "0.9rem")
                        .style("color", "#666")
                        .style("margin-top", "2px")
                        .html(rels.map(r => `&nbsp;&nbsp;${r.direction === "outgoing" ? "→" : "←"} ${r.target}`).join("<BR>"));
                });
            }
        }

        // Show popper
        element.style("display", "block");

        console.log("Popper display:", element.style("display")); // Add this
        console.log("Popper element:", element.node()); // Add this

        // Create Popper instance
        if (popperInstance) {
            popperInstance.destroy();
        }

        console.log("Circle element:", nodeElement); // Add this
        console.log("Circle bounding rect:", nodeElement.getBoundingClientRect()); // Add this        

        popperInstance = createPopper(nodeElement, element.node(), {
            placement: "right",
            strategy: "fixed", // Add this line
            modifiers: [
                {
                    name: "offset",
                    options: {
                        offset: [0, 5]
                    }
                },
                {
                    name: "flip",
                    options: {
                        fallbackPlacements: ["left", "top", "bottom"]
                    }
                },
                {
                    name: "preventOverflow",
                    options: {
                        padding: 8
                    }
                }
            ]
        });
        
        // Force an immediate update and log the result
        popperInstance.update().then(() => {
            const popperRect = element.node().getBoundingClientRect();
            console.log("Popper position:", {
                top: popperRect.top,
                left: popperRect.left,
                width: popperRect.width,
                height: popperRect.height
            });
        });

    }

    function hidePopper() {
        if (popperTimeout) {
            clearTimeout(popperTimeout);
            popperTimeout = null;
        }

        if (popperElement) {
            popperElement.style("display", "none");
        }

        if (popperInstance) {
            popperInstance.destroy();
            popperInstance = null;
        }

        isPopperSticky = false;

        if (popperElement) {
            popperElement
                .style("border-color", "#ccc")
                .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)");
        }
    }

    
    
    
    /////////////////////////////////////////////////////////////////////////////////////////
    // Connectivity and Density Filters
    /////////////////////////////////////////////////////////////////////////////////////////        
    
    // Combined Density & Connectivity Filter Control
    const combinedContainer = container
        .append("div")
        .attr("class", "combined-control-container")
        .style("position", "absolute")
        .style("top", "4px")
        .style("left", "70px")
        .style("z-index", "1000")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("padding", "0px 8px")
        .style("font-size", "12px");

    // Collapsible header
    const combinedHeader = combinedContainer
        .append("div")
        .style("font-weight", "bold")
        .style("cursor", "pointer")
        .style("display", "flex")
        .style("justify-content", "space-between")
        .style("align-items", "center")
        .style("padding", "4px 8px") // Add padding here instead
        .style("height", "28px") // Match button height
        .style("box-sizing", "border-box") // Include padding in height
        .on("click", function() {
            const isCollapsed = combinedBody.style("display") === "none";
            combinedBody.style("display", isCollapsed ? "block" : "none");
            combinedTwisty.text(isCollapsed ? "▼" : "▶");
        })
        .on("mouseover", function() {
            d3.select(this).style("background", "#f0f0f0");
        })
        .on("mouseout", function() {
            d3.select(this).style("background", "transparent");
        });

    const combinedTwisty = combinedHeader
        .append("span")
        .style("margin-right", "5px")
        .text("▶");

    combinedHeader.append("span").text("Graph Controls");

    const combinedStatus = combinedHeader
        .append("span")
        .style("font-size", "10px")
        .style("color", "#666")
        .style("font-weight", "normal")
        .style("margin-left", "5px")
        .text("(all, medium)");

    // Body with both controls
    const combinedBody = combinedContainer
        .append("div")
        .style("margin-top", "5px")
        .style("display", "none");


    // --- CONNECTIVITY SECTION ---
    combinedBody.append("div")
        .style("font-weight", "bold")
        .style("margin-top", "8px")
        .style("margin-bottom", "3px")
        .style("font-size", "11px")
        .text("Connectivity");

    // Button configurations for all three sections
    const connectivityConfig = {
        text: "🔗 Min Connections",
        title: "Filter nodes by minimum connections",
        toggle: () => toggleConnectivityFilter(),
        isActive: () => connectivityFilterActive,
        inputConfig: {
            type: "number",
            min: "0",
            max: "50",
            value: "3",
            title: "Minimum connections",
            onInput: function() {
                if (connectivityFilterActive) {
                    applyConnectivityFilter(parseInt(this.value) || 0);
                    updateCombinedStatus();
                }
            }
        }
    };

    const islandConfig = {
        text: "🏝 Hide Islands",
        title: "Hide disconnected components with fewer nodes",
        toggle: () => toggleIslandFilter(),
        isActive: () => islandFilterActive,
        inputConfig: {
            type: "number",
            min: "2",
            max: "50",
            value: "10",
            title: "Minimum nodes in component",
            onInput: function() {
                if (islandFilterActive) {
                    islandThreshold = parseInt(this.value) || 5;
                    applyIslandFilter();
                }
            }
        }
    };

    const spanningConfig = {
        text: "🌳 Spanning Tree",
        title: "Show minimal spanning tree",
        toggle: () => toggleSpanningTree(),
        isActive: () => spanningTreeActive,
        inputConfig: {
            type: "number",
            min: "1",
            max: "3",
            value: "1",
            title: "Tree density: 1=minimal (N-1 edges), 5=fuller (5×N edges)",
            onInput: function() {
                if (spanningTreeActive) {
                    spanningDensity = parseInt(this.value) || 1;
                    applySpanningTree();
                }
            }
        }
    };

    // Generic function to create filter controls
    function createFilterControl(parentDiv, config) {
        const controlDiv = parentDiv
            .append("div")
            .style("margin-bottom", "8px")
            .style("display", "flex")
            .style("gap", "5px")
            .style("align-items", "center");

        const button = controlDiv.append("button")
            .attr("title", config.title)
            .style("padding", "5px 8px")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("border-radius", "3px")
            .style("cursor", "pointer")
            .style("font-size", "11px")
            .style("width", "130px")
            .style("height", "28px")
            .style("box-sizing", "border-box")
            .style("text-align", "left")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "6px")
            .on("click", config.toggle)
            .on("mouseover", function() {
                d3.select(this).style("background", "#f0f0f0");
            })
            .on("mouseout", function() {
                d3.select(this).style("background", config.isActive() ? "#e8f4e8" : "white");
            });

        // Split emoji and text into separate spans
        const parts = config.text.split(' ');
        const emoji = parts[0];
        const text = parts.slice(1).join(' ');

        button.append("span")
            .style("width", "16px")
            .style("text-align", "center")
            .style("flex-shrink", "0")
            .text(emoji);

        button.append("span")
            .style("overflow", "hidden")
            .style("text-overflow", "ellipsis")
            .style("white-space", "nowrap")
            .text(text);

        const input = controlDiv.append("input")
            .attr("type", config.inputConfig.type)
            .attr("min", config.inputConfig.min)
            .attr("max", config.inputConfig.max)
            .attr("value", config.inputConfig.value)
            .attr("title", config.inputConfig.title)
            .style("width", "60px")
            .style("height", "28px")
            .style("padding", "3px 8px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "3px")
            .style("font-size", "11px")
            .style("box-sizing", "border-box")
            .on("input", config.inputConfig.onInput);

        return { button, input };
    }


    const { button: connectivityButton, input: connectivityThresholdInput } = createFilterControl(combinedBody, connectivityConfig);

    const { button: islandButton, input: islandThresholdInput } = createFilterControl(combinedBody, islandConfig);

    const { button: spanningButton, input: spanningDensityInput } = createFilterControl(combinedBody, spanningConfig);



        

    // --- DENSITY SECTION ---
    combinedBody.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "3px")
        .style("margin-top", "8px")
        .style("border-top", "1px solid #eee")
        .style("padding-top", "8px")
        .style("font-size", "11px")
        .text("Spacing");

    const densitySlider = combinedBody
        .append("input")
        .attr("type", "range")
        .attr("min", "1")
        .attr("max", "5")
        .attr("value", "3")
        .attr("step", "1")
        .style("width", "100%")
        .style("margin-bottom", "3px")
        .on("input", function() {
            applyDensity(parseInt(this.value));
            updateCombinedStatus();
        });

    const densityText = combinedBody
        .append("div")
        .style("font-size", "10px")
        .style("color", "#666")
        .style("text-align", "center")
        .text("Medium");

        

        // --- GRAPH OPERATIONS SECTION ---
        combinedBody.append("div")
            .style("font-weight", "bold")
            .style("margin-bottom", "3px")
            .style("margin-top", "8px")
            .style("border-top", "1px solid #eee")
            .style("padding-top", "8px")
            .style("font-size", "11px")
            .text("Viewport");

        // Create 2x2 button grid
        const buttonGrid = combinedBody
            .append("div")
            .style("display", "grid")
            .style("grid-template-columns", "1fr 1fr")
            .style("gap", "5px")
            .style("margin-bottom", "5px");

        // Button configurations
        const operationButtons = [
            { text: "⟲ Recenter", title: "Reset zoom and center view", handler: resetView },
            { text: "↻ Reset Pos", title: "Scatter nodes to random positions", handler: resetNodePositions },
        ];

        // Create buttons from configuration
        operationButtons.forEach(config => {
            buttonGrid.append("button")
                .text(config.text)
                .attr("title", config.title)
                .style("padding", "5px")
                .style("background", "white")
                .style("border", "1px solid #ccc")
                .style("border-radius", "3px")
                .style("cursor", "pointer")
                .style("font-size", "11px")
                .on("click", config.handler)
                .on("mouseover", function() {
                    d3.select(this).style("background", "#f0f0f0");
                })
                .on("mouseout", function() {
                    d3.select(this).style("background", "white");
                });
        });


        
        
        

        // --- EXPORT SECTION ---
        combinedBody.append("div")
            .style("font-weight", "bold")
            .style("margin-bottom", "3px")
            .style("margin-top", "8px")
            .style("border-top", "1px solid #eee")
            .style("padding-top", "8px")
            .style("font-size", "11px")
            .text("Export");

        // Create 2-button grid for export options
        const exportGrid = combinedBody
            .append("div")
            .style("display", "grid")
            .style("grid-template-columns", "1fr 1fr")
            .style("gap", "5px")
            .style("margin-bottom", "5px");

        // CSV Export button
        exportGrid.append("button")
            .text("📄 CSV")
            .attr("title", "Export as CSV triplets (entity1, relation, entity2)")
            .style("padding", "5px")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("border-radius", "3px")
            .style("cursor", "pointer")
            .style("font-size", "11px")
            .on("click", exportToCSV)
            .on("mouseover", function() {
                d3.select(this).style("background", "#f0f0f0");
            })
            .on("mouseout", function() {
                d3.select(this).style("background", "white");
            });

        // JSON-LD Export button
        exportGrid.append("button")
            .text("📋 JSON-LD")
            .attr("title", "Export as JSON-LD (semantic web format)")
            .style("padding", "5px")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("border-radius", "3px")
            .style("cursor", "pointer")
            .style("font-size", "11px")
            .on("click", exportToJSONLD)
            .on("mouseover", function() {
                d3.select(this).style("background", "#f0f0f0");
            })
            .on("mouseout", function() {
                d3.select(this).style("background", "white");
            });

        
        
        

    // --- EDGE LABELS SECTION ---
    combinedBody.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "3px")
        .style("margin-top", "8px")
        .style("border-top", "1px solid #eee")
        .style("padding-top", "8px")
        .style("font-size", "11px")
        .text("Display Options");

    const edgeLabelCheckbox = combinedBody
        .append("div")
        .style("margin-bottom", "5px");

    edgeLabelCheckbox
        .append("input")
        .attr("type", "checkbox")
        .attr("id", "edge-label-toggle")
        .attr("checked", true)
        .style("margin-right", "5px")
        .on("change", function() {
            linkLabel.style("display", this.checked ? "block" : "none");
        });

    edgeLabelCheckbox
        .append("label")
        .attr("for", "edge-label-toggle")
        .style("font-size", "11px")
        .style("cursor", "pointer")
        .text("Show edge labels");
        

    // --- STATS SECTION ---
    const statsDisplay = combinedBody
        .append("div")
        .style("margin", "8px 0px")
        .style("font-size", "11px")
        .style("color", "#666")
        .style("border-top", "1px solid #eee")
        .style("padding-top", "5px");

    function updateCombinedStatus() {
        const parts = [];

        if (connectivityFilterActive) {
            parts.push(`conn:${connectivityThreshold}+`);
        }

        if (islandFilterActive) {
            parts.push(`islands:${islandThreshold}+`);
        }

        if (spanningTreeActive) {
            parts.push(`tree:${spanningDensity}x`);
        }

        const densityLevel = parseInt(densitySlider.property("value"));
        const densityLabels = ["", "v.sparse", "sparse", "medium", "dense", "v.dense"];
        parts.push(densityLabels[densityLevel]);

        combinedStatus.text(`(${parts.join(", ")})`);
    }

    function updateStats() {
        const visibleNodes = node.filter(function() {
            return d3.select(this).style("display") !== "none";
        }).size();

        const totalNodes = nodes.length;

        statsDisplay.html(`
            <strong style="color: #333;">${visibleNodes}</strong>
            <span style="color: #999;"> / ${totalNodes}</span> nodes
        `);
    }


    function applyDensity(level) {
        const configs = {
            1: { distance: linkDistance * 2.5, charge: chargeStrength * 2.5, collision: nodeRadius * 4, label: "Very sparse" },
            2: { distance: linkDistance * 1.5, charge: chargeStrength * 1.5, collision: nodeRadius * 3, label: "Sparse" },
            3: { distance: linkDistance, charge: chargeStrength, collision: nodeRadius * 2, label: "Medium" },
            4: { distance: linkDistance * 0.7, charge: chargeStrength * 0.7, collision: nodeRadius * 1.5, label: "Dense" },
            5: { distance: linkDistance * 0.5, charge: chargeStrength * 0.5, collision: nodeRadius * 1, label: "Very dense" }
        };

        const config = configs[level];

        // Reset node positions toward center before applying new forces
        nodes.forEach(n => {
            const dx = n.x - width / 2;
            const dy = n.y - height / 2;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Pull nodes back toward center proportionally
            if (distance > 0) {
                const pullFactor = 0.25; // Adjust this (0.1-0.5) for more/less centering
                n.x -= dx * pullFactor;
                n.y -= dy * pullFactor;
            }
        });

        simulation.force("link").distance(config.distance);
        simulation.force("charge").strength(config.charge);
        simulation.force("collision").radius(config.collision);
        // Higher alpha for bigger density changes
        simulation.alpha(0.8).restart();

        densityText.text(config.label);
    }
    


    let connectivityFilterActive = false;
    let connectivityThreshold = 3;
    let spanningDensity = 1;

    function toggleConnectivityFilter() {
        if (!connectivityFilterActive) {
            connectivityThreshold = parseInt(connectivityThresholdInput.property("value")) || 3;
            connectivityFilterActive = true;
            connectivityButton
                .text("✓ Min Connections")
                .style("background", "#e8f4e8")
                .style("font-weight", "bold");
            applyConnectivityFilter(connectivityThreshold);
        } else {
            connectivityFilterActive = false;
            connectivityButton
                .text("🔗 Min Connections")
                .style("background", "white")
                .style("font-weight", "normal");
            clearConnectivityFilter();
        }
        updateCombinedStatus();
    }

    function applyConnectivityFilter(threshold) {
        const nodesToShow = new Set();
        nodes.forEach(n => {
            if (n.connectivity >= threshold) {
                nodesToShow.add(n.id);
            }
        });

        const visibleLinks = new Set();
        links.forEach(l => {
            const sourceId = l.source.id || l.source;
            const targetId = l.target.id || l.target;
            if (nodesToShow.has(sourceId) && nodesToShow.has(targetId)) {
                visibleLinks.add(l);
            }
        });

        const enlargeLabels = nodesToShow.size < 20;

        node.style("opacity", d => nodesToShow.has(d.id) ? 1 : 0.1);
        node.select("circle")
            .attr("fill", d => nodesToShow.has(d.id) ? colorScale(d.id) : "#ddd")
            .attr("r", d => {
                if (!nodesToShow.has(d.id)) return getNodeRadius(d.connectivity) * 0.5;
                return enlargeLabels ? getNodeRadius(d.connectivity) * 1.5 : getNodeRadius(d.connectivity);
            });

        node.select("text")
            .attr("font-size", d => {
                if (!nodesToShow.has(d.id)) return `${getNodeLabelSize(d.connectivity) * 0.5}px`;
                return enlargeLabels ? `${getNodeLabelSize(d.connectivity) * 1.5}px` : `${getNodeLabelSize(d.connectivity)}px`;
            });

        link.style("opacity", l => visibleLinks.has(l) ? 0.6 : 0.05);
        linkLabel.style("opacity", l => visibleLinks.has(l) ? 0.3 : 0.05);

        updateStats();

        if (nodesToShow.size > 0) {
            setTimeout(() => zoomToHighlighted(nodesToShow), 100);
        }
    }

    function clearConnectivityFilter() {
        node.style("opacity", 1);
        node.select("circle")
            .attr("fill", d => colorScale(d.id))
            .attr("r", d => getNodeRadius(d.connectivity));
        node.select("text")
            .attr("font-size", d => `${getNodeLabelSize(d.connectivity)}px`);
        link.style("opacity", 0.6);
        linkLabel.style("opacity", 0.3);
        updateStats();
        resetView();
    }

    function applySpanningTree() {
        const sortedLinks = [...links].sort((a, b) => {
            const sumA = a.source.connectivity + a.target.connectivity;
            const sumB = b.source.connectivity + b.target.connectivity;
            return sumB - sumA;
        });

        const parent = new Map();
        nodes.forEach(n => parent.set(n.id, n.id));

        function find(x) {
            if (parent.get(x) !== x) {
                parent.set(x, find(parent.get(x)));
            }
            return parent.get(x);
        }

        const treeLinks = [];
        let edgeCount = 0;
        const targetEdges = Math.min(
            (nodes.length - 1) * spanningDensity, // Scale by density
            links.length // Don't exceed available edges
        );

        for (const link of sortedLinks) {
            if (edgeCount >= targetEdges) break;

            const rootS = find(link.source.id);
            const rootT = find(link.target.id);

            if (rootS !== rootT || spanningDensity > 1) {
                // For density > 1, allow some redundant edges (creates denser tree)
                treeLinks.push(link);
                if (rootS !== rootT) {
                    parent.set(rootS, rootT);
                }
                edgeCount++;
            }
        }

        const treeSet = new Set(treeLinks);

        link.style("opacity", l => treeSet.has(l) ? 1 : 0.02)
            .style("stroke-width", l => treeSet.has(l) ? 4 : 1)
            .style("stroke", l => treeSet.has(l) ? "#ff6b6b" : "#999");

        linkLabel.style("opacity", l => treeSet.has(l) ? 0.8 : 0.02)
            .style("font-weight", l => treeSet.has(l) ? "bold" : "normal");

        node.style("opacity", 1);
        node.select("circle")
            .attr("stroke", "#ff6b6b")
            .attr("stroke-width", 3);

        updateStats();
    }


    // Initialize stats
    updateStats();


        
   
    
    
    /////////////////////////////////////////////////////////////////////////////////////////
    // Zoom/Pan
    /////////////////////////////////////////////////////////////////////////////////////////
    // Zoom behavior with proper constraints
    const zoom = d3.zoom()
        .scaleExtent([MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL])
        .translateExtent([[-width * 3, -height * 3], [width * 4, height * 4]])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    svg.call(zoom);

    // Set initial zoom to show a reasonable area
    const initialScale = 0.25; // Start zoomed out
    const initialTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(initialScale)
        .translate(-width / 2, -height / 2);
    svg.call(zoom.transform, initialTransform);

    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    simulation.on("end", () => {
        // placeholder in case it's needed.
    });
    
    
    
    
    function exportToCSV() {
        const csvRows = ["entity1,relation,entity2"];

        links.forEach(l => {
            const source = ((l.source.label || l.source.id) + "").replace(/"/g, '""');
            const target = ((l.target.label || l.target.id) + "").replace(/"/g, '""');
            const relation = (l.relation + "").replace(/"/g, '""');
            csvRows.push(`"${source}","${relation}","${target}"`);
        });

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `knowledge-graph-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function exportToJSONLD() {
        const graph = [];

        // Create node entries
        const nodeMap = new Map();
        nodes.forEach(n => {
            const nodeObj = {
                "@id": `node:${n.id}`,
                "@type": "Entity",
                "name": n.label,
                "connectivity": n.connectivity
            };
            graph.push(nodeObj);
            nodeMap.set(n.id, nodeObj);
        });

        // Add relationships
        links.forEach(l => {
            const sourceId = l.source.id || l.source;
            const targetId = l.target.id || l.target;

            graph.push({
                "@type": "Relationship",
                "subject": `node:${sourceId}`,
                "predicate": l.relation,
                "object": `node:${targetId}`
            });
        });

        const jsonLD = {
            "@context": {
                "@vocab": "http://schema.org/",
                "node": "http://example.org/node/"
            },
            "@graph": graph
        };

        const jsonContent = JSON.stringify(jsonLD, null, 2);
        const blob = new Blob([jsonContent], { type: "application/ld+json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `knowledge-graph-${Date.now()}.jsonld`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    
    

    // Island detection and filtering
    let islandFilterActive = false;
    let islandThreshold = 5;
    let spanningTreeActive = false;

    function findConnectedComponents() {
        const parent = new Map();
        const size = new Map();

        nodes.forEach(n => {
            parent.set(n.id, n.id);
            size.set(n.id, 1);
        });

        function find(x) {
            if (parent.get(x) !== x) {
                parent.set(x, find(parent.get(x)));
            }
            return parent.get(x);
        }

        function union(x, y) {
            const rootX = find(x);
            const rootY = find(y);
            if (rootX !== rootY) {
                if (size.get(rootX) < size.get(rootY)) {
                    parent.set(rootX, rootY);
                    size.set(rootY, size.get(rootY) + size.get(rootX));
                } else {
                    parent.set(rootY, rootX);
                    size.set(rootX, size.get(rootX) + size.get(rootY));
                }
            }
        }

        links.forEach(l => {
            union(l.source.id, l.target.id);
        });

        const components = new Map();
        nodes.forEach(n => {
            const root = find(n.id);
            if (!components.has(root)) {
                components.set(root, []);
            }
            components.get(root).push(n);
        });

        return Array.from(components.values());
    }


    function toggleIslandFilter() {
        if (!islandFilterActive) {
            islandThreshold = parseInt(islandThresholdInput.property("value")) || 5;
            islandFilterActive = true;
            islandButton
                .text("✓ Hide Islands")
                .style("background", "#e8f4e8")
                .style("font-weight", "bold");
            applyIslandFilter();
        } else {
            islandFilterActive = false;
            islandButton
                .text("🏝 Hide Islands")
                .style("background", "white")
                .style("font-weight", "normal");
            clearIslandFilter();
        }
    }

    
    function applyIslandFilter() {
        const components = findConnectedComponents();
        const visibleNodes = new Set();

        components.forEach(comp => {
            if (comp.length >= islandThreshold) {
                comp.forEach(n => visibleNodes.add(n.id));
            }
        });

        node.style("display", d => visibleNodes.has(d.id) ? "block" : "none");
        link.style("display", l =>
            visibleNodes.has(l.source.id) && visibleNodes.has(l.target.id) ? "block" : "none"
        );
        linkLabel.style("display", l =>
            visibleNodes.has(l.source.id) && visibleNodes.has(l.target.id) ? "block" : "none"
        );

        const visibleLinks = links.filter(l =>
            visibleNodes.has(l.source.id) && visibleNodes.has(l.target.id)
        );
        updateStats();

        if (visibleNodes.size > 0) {
            setTimeout(() => zoomToHighlighted(visibleNodes), 100);
        }
    }

    function clearIslandFilter() {
        node.style("display", "block");
        link.style("display", "block");
        linkLabel.style("display", "block");
        updateStats();
        resetView();
    }

    function toggleSpanningTree() {
        if (!spanningTreeActive) {
            spanningTreeActive = true;
            spanningButton
                .text("✓ Spanning Tree")
                .style("background", "#e8f4e8")
                .style("font-weight", "bold");
            applySpanningTree();
        } else {
            spanningTreeActive = false;
            spanningButton
                .text("🌳 Spanning Tree")
                .style("background", "white")
                .style("font-weight", "normal");
            clearSpanningTree();
        }
    }


    function clearSpanningTree() {
        link.style("opacity", 0.6)
            .style("stroke-width", 1.5)
            .style("stroke", "#999");
        linkLabel.style("opacity", 0.3)
            .style("font-weight", "normal");
        node.style("opacity", 1);
        node.select("circle")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
        updateStats();
    }
    
    

    // Return API for external control
    return {
        simulation: simulation,
        restart: () => simulation.alpha(1).restart(),
        destroy: () => {
            simulation.stop();
            container.selectAll("*").remove();
        }
    };
}
