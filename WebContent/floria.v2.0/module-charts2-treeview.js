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

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { sankey, sankeyLinkHorizontal } from "https://cdn.jsdelivr.net/npm/d3-sankey@0.12/+esm";

/**
 * Conversation Visualization Module
 * Renders multi-agent conversation flows in two different visualizations:
 * 1. Sankey Flow - Best for shallow conversations (depth <= 3)
 * 2. Collapsible Tree - Best for deep nested conversations, with interactive controls
 *    - Node spacing options (compact, normal, spread)
 *    - Expand/Collapse All functionality
 *    - Collapsible control panel
 */

export class TreeView {
  constructor(containerId, conversationData) {
    this.containerId = containerId;
    this.conversationData = conversationData;
    this.currentView = null;
    this.container = null;
    this.width = 0;
    this.height = 0;
    
    // Color scales for duration heat map
    this.durationColorScale = null;
    this.maxDuration = 0;
    
    // Calculate conversation depth and auto-select default view based on depth
//    this.depth = this._calculateDepth(conversationData.conversation);
//    this.defaultView = this.depth <= 3 ? 'sankey' : 'tree';
    this.defaultView = 'tree';
  }

  /**
   * Initialize and render the visualization
   */
  init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error(`Container with id '${this.containerId}' not found`);
      return;
    }

    // Get dimensions
    this._updateDimensions();

    // Calculate duration statistics for color mapping
    this._calculateDurationStats();

    // Create UI structure
    this._createUI();

    // Render default view
    this.render(this.defaultView);
    
    // Add resize listener
    window.addEventListener('resize', () => this._handleResize());
  }

  /**
   * Update dimensions from container
   */
  _updateDimensions() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
  }

  /**
   * Handle window resize
   */
  _handleResize() {
    this._updateDimensions();
    if (this.currentView) {
      this.render(this.currentView);
    }
  }

  /**
   * Calculate maximum depth of conversation tree
   */
  _calculateDepth(conversation, depth = 1) {
    let maxDepth = depth;
    if (conversation.events) {
      conversation.events.forEach(event => {
        if (event.type === 'agent_call' && event.conversation) {
          maxDepth = Math.max(maxDepth, this._calculateDepth(event.conversation, depth + 1));
        }
      });
    }
    return maxDepth;
  }

  /**
   * Calculate duration statistics for color scale
   */
  _calculateDurationStats() {
    const durations = [];
    
    const collectDurations = (conversation) => {
      if (conversation.usage && conversation.usage.total_tokens) {
        durations.push(conversation.usage.total_tokens);
      }
      if (conversation.events) {
        conversation.events.forEach(event => {
          if (event.conversation) {
            collectDurations(event.conversation);
          }
        });
      }
    };
    
    collectDurations(this.conversationData.conversation);
    
    this.maxDuration = Math.max(...durations, 1);
    
    // Create color scale: green (fast) -> yellow -> red (slow)
    this.durationColorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([this.maxDuration, 0]); // Reversed so high values are red
  }

  /**
   * Get color for a given token count
   */
  _getColorForTokens(tokens) {
    return this.durationColorScale(tokens || 0);
  }

  /**
   * Create UI structure with view toggle buttons
   */
  _createUI() {
    this.container.innerHTML = '';
    
    // Create control bar
    const controlBar = document.createElement('div');
    controlBar.className = 'convo-viz-controls';
    controlBar.style.cssText = `
      display: flex;
      justify-content: right;
      gap: 10px;
      padding: 10px;
//      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
    `;
    
    // Create view buttons
    const views = [
      { id: 'tree', label: 'Tree View', icon: '⊞' }
     ,{ id: 'sankey', label: 'Flow View', icon: '→' }
    ];
    
    views.forEach(view => {
      const button = document.createElement('button');
      button.className = 'convo-viz-btn';
      button.dataset.view = view.id;
      button.innerHTML = `${view.icon} ${view.label}`;
      button.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #ccc;
        background: white;
        cursor: pointer;
        border-radius: 4px;
        font-size: 14px;
        transition: all 0.2s;
      `;
      button.addEventListener('click', () => this.render(view.id));
      button.addEventListener('mouseenter', () => {
        if (this.currentView !== view.id) {
          button.style.background = '#f0f0f0';
        }
      });
      button.addEventListener('mouseleave', () => {
        if (this.currentView !== view.id) {
          button.style.background = 'white';
        }
      });
      controlBar.appendChild(button);
    });
    
    // Create visualization container
    const vizContainer = document.createElement('div');
    vizContainer.className = 'convo-viz-container';
    vizContainer.id = this.containerId + '-viz';
    vizContainer.style.cssText = `
      width: 100%;
      height: calc(100% - 60px);
      overflow: auto;
      position: relative;
    `;
    
    this.container.appendChild(controlBar);
    this.container.appendChild(vizContainer);
  }

  /**
   * Render the specified view
   */
  render(viewType) {
    this.currentView = viewType;
    
    // Update button states
    const buttons = this.container.querySelectorAll('.convo-viz-btn');
    buttons.forEach(btn => {
      if (btn.dataset.view === viewType) {
        btn.style.background = '#007bff';
        btn.style.color = 'white';
        btn.style.borderColor = '#007bff';
      } else {
        btn.style.background = 'white';
        btn.style.color = 'black';
        btn.style.borderColor = '#ccc';
      }
    });
    
    // Clear previous visualization
    const vizContainer = document.getElementById(this.containerId + '-viz');
    vizContainer.innerHTML = '';
    
    // Render selected view
    switch (viewType) {
      case 'sankey':
        this._renderSankey(vizContainer);
        break;
      case 'tree':
        this._renderTree(vizContainer);
        break;
      default:
        console.warn('Unknown view type:', viewType);
        this._renderSankey(vizContainer);
    }
  }

  /**
   * Render Sankey flow diagram
   */
  _renderSankey(container) {
    const margin = { top: 20, right: 150, bottom: 20, left: 150 };
    const width = Math.max(800, container.offsetWidth) - margin.left - margin.right;
    const height = Math.max(600, container.offsetHeight) - margin.top - margin.bottom;

    // Build nodes and links from conversation data
    const { nodes, links } = this._buildSankeyData();

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create sankey layout
    const sankeyLayout = sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[0, 0], [width, height]]);

    const graph = sankeyLayout({
      nodes: nodes.map(d => Object.assign({}, d)),
      links: links.map(d => Object.assign({}, d))
    });

    // Add links
    svg.append('g')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => this._getColorForTokens(d.tokens))
      .attr('stroke-width', d => Math.max(1, d.value))
      .attr('fill', 'none')
      .attr('opacity', 0.5)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8);
        this._showTooltip(event, d, 'link');
      }.bind(this))
      .on('mouseout', function(event, d) {
        d3.select(this).attr('opacity', 0.5);
        this._hideTooltip();
      }.bind(this));

    // Add nodes
    svg.append('g')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('height', d => d.y1 - d.y0)
      .attr('width', d => d.x1 - d.x0)
      .attr('fill', d => d.type === 'agent' ? '#4285f4' : '#34a853')
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .on('mouseover', function(event, d) {
        this._showTooltip(event, d, 'node');
      }.bind(this))
      .on('mouseout', function(event, d) {
        this._hideTooltip();
      }.bind(this));

    // Add node labels
    svg.append('g')
      .selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
      .text(d => d.name)
      .style('font-size', '12px')
      .style('font-weight', d => d.type === 'agent' ? 'bold' : 'normal');
  }

  /**
   * Build Sankey data structure from conversation
   */
  _buildSankeyData() {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    let nodeIndex = 0;

    const getOrCreateNode = (name, type, data = {}) => {
      const key = `${name}-${type}`;
      if (!nodeMap.has(key)) {
        const node = { 
          id: nodeIndex++, 
          name, 
          type,
          ...data
        };
        nodes.push(node);
        nodeMap.set(key, node);
      }
      return nodeMap.get(key);
    };

    const processConversation = (conversation, parentNode = null, depth = 0) => {
      const agentName = conversation.agent?.title || 'Agent';
      const agentNode = getOrCreateNode(
        agentName, 
        'agent',
        {
          model: conversation.agent?.model,
          provider: conversation.agent?.provider,
          tokens: conversation.usage?.total_tokens || 0,
          cost: conversation.usage?.estimated_cost || 0
        }
      );

      // Link from parent to this agent
      if (parentNode) {
        links.push({
          source: parentNode.id,
          target: agentNode.id,
          value: Math.sqrt(conversation.usage?.total_tokens || 1) / 2,
          tokens: conversation.usage?.total_tokens || 0,
          type: 'agent_call'
        });
      }

      // Process events
      if (conversation.events) {
        conversation.events.forEach((event, idx) => {
          if (event.type === 'tool_call') {
            const toolNode = getOrCreateNode(
              event.name || `Tool ${idx}`,
              'tool',
              { toolName: event.name }
            );
            links.push({
              source: agentNode.id,
              target: toolNode.id,
              value: 2,
              tokens: 0,
              type: 'tool_call'
            });
          } else if (event.type === 'agent_call' && event.conversation) {
            processConversation(event.conversation, agentNode, depth + 1);
          }
        });
      }

      return agentNode;
    };

    // Start with root prompt node
    const rootNode = getOrCreateNode('User Prompt', 'prompt', {
      prompt: this.conversationData.conversation.prompt
    });
    processConversation(this.conversationData.conversation, rootNode);

    return { nodes, links };
  }

  /**
   * Render collapsible tree diagram
   */
  _renderTree(container) {
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };
    const width = Math.max(800, container.offsetWidth) - margin.left - margin.right;
    const height = Math.max(600, container.offsetHeight) - margin.top - margin.bottom;

    // Spacing settings (stored on instance for control panel)
    this.treeSpacing = this.treeSpacing || 'spread'; // 'compact', 'normal', 'spread'
    
    // Spacing configurations
    const spacingConfigs = {
      'compact': { horizontal: 120, vertical: 80 },
      'normal': { horizontal: 200, vertical: 100 },
      'spread': { horizontal: 300, vertical: 120 }
    };

    // Build tree data
    const treeData = this._buildTreeData();

    // Create control panel container (absolutely positioned)
    const controlPanel = d3.select(container)
      .append('div')
      .style('position', 'absolute')
      .style('top', '10px')
      .style('right', '10px')
      .style('z-index', '1000')
      .style('background', 'white')
      .style('border', '1px solid #ccc')
      .style('border-radius', '4px')
      .style('padding', '0')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
      .style('font-size', '11px');

    // Control panel header (collapsible)
    const panelHeader = controlPanel
      .append('div')
      .style('padding', '8px 10px')
      .style('background', '#f8f9fa')
      .style('border-bottom', '1px solid #ddd')
      .style('cursor', 'pointer')
      .style('font-weight', 'bold')
      .style('font-size', '11px')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'space-between')
      .on('click', () => {
        const isHidden = panelBody.style('display') === 'none';
        panelBody.style('display', isHidden ? 'block' : 'none');
        panelToggle.text(isHidden ? '▼' : '▶');
      });

    panelHeader.append('span').text('Tree Controls');
    const panelToggle = panelHeader.append('span').text('▼').style('margin-left', '5px');

    // Control panel body
    const panelBody = controlPanel
      .append('div')
      .style('padding', '8px 10px')
      .style('min-width', '160px');

    // Spacing section
    panelBody.append('div')
      .style('font-weight', 'bold')
      .style('margin-bottom', '5px')
      .style('font-size', '11px')
      .text('Node Spacing');

    const spacingButtons = panelBody
      .append('div')
      .style('display', 'grid')
      .style('grid-template-columns', '1fr 1fr 1fr')
      .style('gap', '4px')
      .style('margin-bottom', '10px');

    ['compact', 'normal', 'spread'].forEach(spacing => {
      const button = spacingButtons
        .append('button')
        .text(spacing.charAt(0).toUpperCase() + spacing.slice(1))
        .style('padding', '5px 4px')
        .style('background', this.treeSpacing === spacing ? '#e8f4e8' : 'white')
        .style('border', '1px solid #ccc')
        .style('border-radius', '3px')
        .style('cursor', 'pointer')
        .style('font-size', '10px')
        .style('font-weight', this.treeSpacing === spacing ? 'bold' : 'normal')
        .on('click', () => {
          this.treeSpacing = spacing;
          this.render('tree'); // Re-render with new spacing
        })
        .on('mouseover', function() {
          if (this.__data__ !== spacing) {
            d3.select(this).style('background', '#f0f0f0');
          }
        })
        .on('mouseout', function() {
          d3.select(this).style('background', 
            this.__data__ === spacing ? '#e8f4e8' : 'white');
        });
      button.node().__data__ = spacing;
    });

    // Actions section
    panelBody.append('div')
      .style('font-weight', 'bold')
      .style('margin-bottom', '5px')
      .style('margin-top', '8px')
      .style('border-top', '1px solid #eee')
      .style('padding-top', '8px')
      .style('font-size', '11px')
      .text('Actions');

    const actionsGrid = panelBody
      .append('div')
      .style('display', 'grid')
      .style('grid-template-columns', '1fr 1fr')
      .style('gap', '4px');

    // Expand All button
    actionsGrid.append('button')
      .text('⊞ Expand All')
      .style('padding', '5px 4px')
      .style('background', 'white')
      .style('border', '1px solid #ccc')
      .style('border-radius', '3px')
      .style('cursor', 'pointer')
      .style('font-size', '10px')
      .on('click', () => expandAll(root))
      .on('mouseover', function() {
        d3.select(this).style('background', '#f0f0f0');
      })
      .on('mouseout', function() {
        d3.select(this).style('background', 'white');
      });

    // Collapse All button
    actionsGrid.append('button')
      .text('⊟ Collapse All')
      .style('padding', '5px 4px')
      .style('background', 'white')
      .style('border', '1px solid #ccc')
      .style('border-radius', '3px')
      .style('cursor', 'pointer')
      .style('font-size', '10px')
      .on('click', () => collapseAll(root))
      .on('mouseover', function() {
        d3.select(this).style('background', '#f0f0f0');
      })
      .on('mouseout', function() {
        d3.select(this).style('background', 'white');
      });

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get current spacing config
    const config = spacingConfigs[this.treeSpacing];

    // Create tree layout with dynamic spacing
    const treeLayout = d3.tree().size([height, width]);
    
    // Adjust node separation based on spacing setting
    treeLayout.separation((a, b) => {
      const baseSeparation = a.parent === b.parent ? 1 : 2;
      const spacingMultiplier = {
        'compact': 0.7,
        'normal': 1.0,
        'spread': 1.5
      }[this.treeSpacing];
      return baseSeparation * spacingMultiplier;
    });

    const root = d3.hierarchy(treeData);
    root.x0 = height / 2;
    root.y0 = 0;

    // Collapse children initially for deep trees
    if (this.depth > 3) {
      root.children.forEach(collapse);
    }

    function collapse(d) {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    }

    function expandAll(d) {
      if (d._children) {
        d.children = d._children;
        d._children = null;
      }
      if (d.children) {
        d.children.forEach(expandAll);
      }
      update(d);
    }

    function collapseAll(d) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
        d._children.forEach(collapseAll);
      }
      update(d);
    }

    let i = 0;
    const duration = 750;

    const update = (source) => {
      const treeData = treeLayout(root);
      const nodes = treeData.descendants();
      const links = treeData.descendants().slice(1);

      // Normalize for fixed-depth with current spacing config
      nodes.forEach(d => d.y = d.depth * config.horizontal);

      // Update nodes
      const node = g.selectAll('g.node')
        .data(nodes, d => d.id || (d.id = ++i));

      // Enter new nodes
      const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${source.y0},${source.x0})`)
        .on('click', (event, d) => {
          if (d.children) {
            d._children = d.children;
            d.children = null;
          } else {
            d.children = d._children;
            d._children = null;
          }
          update(d);
        });

      // Add circles
      nodeEnter.append('circle')
        .attr('r', 1e-6)
        .style('fill', d => d._children ? this._getColorForTokens(d.data.tokens) : '#fff')
        .style('stroke', d => this._getColorForTokens(d.data.tokens))
        .style('stroke-width', '3px')
        .style('cursor', 'pointer');

      // Add labels
      nodeEnter.append('text')
        .attr('dy', '.35em')
        .attr('x', d => d.children || d._children ? -13 : 13)
        .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
        .text(d => d.data.name)
        .style('font-size', '12px')
        .style('fill-opacity', 1e-6);

      // Transition nodes to their new position
      const nodeUpdate = nodeEnter.merge(node);

      nodeUpdate.transition()
        .duration(duration)
        .attr('transform', d => `translate(${d.y},${d.x})`);

      nodeUpdate.select('circle')
        .attr('r', d => Math.max(5, Math.sqrt(d.data.tokens || 1)))
        .style('fill', d => d._children ? this._getColorForTokens(d.data.tokens) : '#fff')
        .style('stroke', d => this._getColorForTokens(d.data.tokens));

      nodeUpdate.select('text')
        .style('fill-opacity', 1);

      // Exit old nodes
      const nodeExit = node.exit().transition()
        .duration(duration)
        .attr('transform', d => `translate(${source.y},${source.x})`)
        .remove();

      nodeExit.select('circle')
        .attr('r', 1e-6);

      nodeExit.select('text')
        .style('fill-opacity', 1e-6);

      // Update links
      const link = g.selectAll('path.link')
        .data(links, d => d.id);

      const linkEnter = link.enter().insert('path', 'g')
        .attr('class', 'link')
        .attr('d', d => {
          const o = { x: source.x0, y: source.y0 };
          return diagonal(o, o);
        })
        .style('fill', 'none')
        .style('stroke', '#ccc')
        .style('stroke-width', '2px');

      const linkUpdate = linkEnter.merge(link);

      linkUpdate.transition()
        .duration(duration)
        .attr('d', d => diagonal(d, d.parent))
        .style('stroke', d => this._getColorForTokens(d.data.tokens));

      link.exit().transition()
        .duration(duration)
        .attr('d', d => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();

      // Store old positions
      nodes.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
      });

      function diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
      }
    };

    update(root);
  }

  /**
   * Build tree data structure from conversation
   */
  _buildTreeData() {
    const processConversation = (conversation, name = 'Conversation') => {
      const node = {
        name: name,
        type: conversation.agent ? 'agent' : 'prompt',
        tokens: conversation.usage?.total_tokens || 0,
        cost: conversation.usage?.estimated_cost || 0,
        children: []
      };

      if (conversation.agent) {
        node.name = conversation.agent.title || 'Agent';
        node.model = conversation.agent.model;
        node.provider = conversation.agent.provider;
      }

      if (conversation.events) {
        conversation.events.forEach((event, idx) => {
          if (event.type === 'tool_call') {
            node.children.push({
              name: event.name || `Tool ${idx}`,
              type: 'tool',
              tokens: 0,
              children: []
            });
          } else if (event.type === 'agent_call' && event.conversation) {
            node.children.push(processConversation(
              event.conversation,
              event.name || event.conversation.agent?.title || 'Sub-Agent'
            ));
          }
        });
      }

      return node;
    };

    const root = {
      name: 'User: ' + (this.conversationData.conversation.prompt?.substring(0, 30) || 'Prompt') + '...',
      type: 'prompt',
      tokens: 0,
      children: [processConversation(this.conversationData.conversation)]
    };

    return root;
  }

  /**
   * Show tooltip
   */
  _showTooltip(event, data, type) {
    // Create tooltip if it doesn't exist
    let tooltip = document.getElementById('convo-viz-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'convo-viz-tooltip';
      tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        z-index: 10000;
        max-width: 300px;
        line-height: 1.4;
      `;
      document.body.appendChild(tooltip);
    }

    let html = '';
    if (type === 'node') {
      html = `<strong>${data.name}</strong><br/>`;
      if (data.type === 'agent') {
        html += `Type: Agent<br/>`;
        if (data.model) html += `Model: ${data.model}<br/>`;
        if (data.provider) html += `Provider: ${data.provider}<br/>`;
      } else {
        html += `Type: ${data.type}<br/>`;
      }
      if (data.tokens) html += `Tokens: ${data.tokens.toLocaleString()}<br/>`;
      if (data.cost) html += `Cost: $${data.cost.toFixed(4)}`;
    } else if (type === 'link') {
      html = `<strong>Connection</strong><br/>`;
      html += `Type: ${data.type}<br/>`;
      if (data.tokens) html += `Tokens: ${data.tokens.toLocaleString()}`;
    }

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
  }

  /**
   * Hide tooltip
   */
  _hideTooltip() {
    const tooltip = document.getElementById('convo-viz-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    window.removeEventListener('resize', this._handleResize);
    const tooltip = document.getElementById('convo-viz-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }
}

/**
 * Helper function to create and initialize visualizer
 */
export function createTreeView(containerId, conversationData) {
  const visualizer = new TreeView(containerId, conversationData);
  visualizer.init();
  return visualizer;
}
