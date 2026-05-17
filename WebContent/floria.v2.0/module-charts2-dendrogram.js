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
import { FloriaText } from "./module-text.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";


// Define a helper function to recursively build the hierarchical structure
function buildDendroHierarchy(node, sequence) {
    if (sequence == null || sequence.length === 0)
        return;

    const element = sequence.shift();
    const child = node.children.find((c) => c.element.value === element.value);

    if (child == null) {
        const newChild = { element: element, weight: 1, children: [] };
        node.children.push(newChild);
        buildDendroHierarchy(newChild, sequence);
    }
    else {
        child.weight += 1;
        buildDendroHierarchy(child, sequence);
    }
}

function parseDendroSequences(sequences) {
    // Initialize the root node
    const root = { name: "root", children: [] };

    // Loop through each sequence in the input array
    sequences.forEach((sequence) => {
        buildDendroHierarchy(root, sequence);
    });

    // Return the hierarchical structure (root node's children)
    return root.children[0];
}

FloriaCharts2.dendrogram = function(containerDivId, nodeClassBase, data, onNodeClickFunc) {
    let that = this;
    that._containerDivId = containerDivId;
    that._nodeClassBase = nodeClassBase;
    that._data = data;
    that._onNodeClickFunc = onNodeClickFunc;
    that._rootNode = parseDendroSequences(data);
    console.log("this._rootNode: ", that._rootNode);

    that.draw = function() {
        //      require(["jslibs/d3-7.8.4/d3.min"], function(d3) {
        let div = document.getElementById(that._containerDivId);
        let width = div.offsetWidth;
        let height = div.offsetHeight;

        // Give the data to this cluster layout:
        var root = d3.hierarchy(that._rootNode, function(d) {
            return d.children;
        });

        // Create the cluster layout:
        var cluster = d3.cluster().size([height, width - 100]); // 100 is the margin I will have on the right side
        cluster(root);

        // append the svg object to the body of the page
        var svg = d3.select("#" + that._containerDivId)
            .append("svg")
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", "translate(40,0)") // bit of margin on the left = 40
            ;

        // Add the links between nodes:
        svg.selectAll("path")
            .data(root.descendants().slice(1))
            .enter()
            .append("path")
            .attr("class", that._nodeClassBase + "_path")
            .attr("d", function(d) {
                return "M" + d.y + "," + d.x
                    // 50 and 150 are coordinates of inflexion, play with it to change links shape
                    + "C" + (d.parent.y + 25) + "," + d.x + " "
                    + (d.parent.y + 50) + "," + d.parent.x + " "
                    + d.parent.y + "," + d.parent.x
                    ;
            })
            .style("stroke-width", function(d) {
                return d.data.weight * 3;
            })
            ;

        // Add a node for each node.
        let node = svg.selectAll("g")
            .data(root.descendants())
            .enter()
            .append("g");

        node.attr("class", that._nodeClassBase + "_node")
            .attr("transform", function(d) {
                return "translate(" + d.y + "," + d.x + ")";
            })
            .append("circle")
            .append("title") // Add a title element for each circle
            .text(function(d) {
                return FloriaText.isNoE(d.data.element.title) == false ? d.data.element.title
                    : FloriaText.isNoE(d.data.element.label) == false ? d.data.element.label
                        : null; // d.data.element.value;
            })
            ;

        if (that._onNodeClickFunc != null) {
            node.on("click", function(target, nodeElement) {
                that._onNodeClickFunc(nodeElement.data.element);
            })
        }

        // Add labels
        svg.selectAll("t")
            .data(root.descendants())
            .enter()
            .append("g")
            .attr("class", that._nodeClassBase + "_label")
            .attr("transform", function(d) {
                return "translate(" + d.y + "," + d.x + ")";
            })
            .append("text")
            .text(function(d) {
                return FloriaText.isNoE(d.data.element.label) == false ? d.data.element.label : d.data.element.value;
            })
            .attr("y", -15)
            ;
        //         });
    }
};
