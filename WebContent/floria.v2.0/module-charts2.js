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

import { FloriaDOM  } from "./module-dom.js";
import { FloriaText } from "./module-text.js";
import { ChartTheme } from "./module-charttheme.js";
import { FloriaAjax }  from "./module-ajax.js";
import { FloriaTooltipDialog }  from "./module-dialog.js";

import { Chart, Tooltip , registerables } from "/static/jslibs/chartjs-4.4.3/chart.js";
import ChartDataLabels  from "/static/jslibs/chartjs-plugin-datalabels-2.2.0/chartjs-plugin-datalabels.esm.js";

import {map,tileLayer,geoJson, circleMarker, Icon, marker,latLng, latLngBounds,control,DomUtil,Control,DomEvent} from "/static/jslibs/leaflet/leaflet-src.esm.js";

FloriaDOM.injectCSSLink("FLORIA_CSS_ANCHOR", true, new URL("./module-charts2.css", import.meta.url).href);
FloriaDOM.injectCSSLink("FLORIA_CSS_ANCHOR", true, "/static/jslibs/leaflet/leaflet.css");

export var FloriaCharts2 = { ColorSchemes : ChartTheme.colorSchemes, ChartJS: Chart };
Chart.register(...registerables);
Chart.register([ChartDataLabels, Tooltip]);

Tooltip.positioners.cursor = function(chartElements, coordinates) {
   return { x: coordinates.x+(this.xAlign=="left"?-20:+20), y: coordinates.y+10 };
 };


FloriaCharts2.CHOROPLETH_TYPES = { "state" : "states"
                                  ,"county":"counties"
                                  ,"zipcode":"zipcodes"
};


// Tiny inline-SVG renderer for a dataset's Chart.js `pointStyle`, used by the custom
// external tooltip below so a series with a non-default point shape (e.g. 'triangle',
// 'star', 'rect', 'rectRot') keeps that shape visible in its tooltip swatch too, instead of
// always falling back to a plain colored square/circle block. Any pointStyle not explicitly
// handled here (including the default 'circle', and thin styles like 'cross'/'line'/'dash')
// falls back to the original plain color block, so existing callers are unaffected.
//
// NOTE: fill/stroke are set via an inline `style="..."`, NOT plain `fill="..."`/`stroke="..."`
// presentation attributes. SVG presentation attributes sit at the BOTTOM of the CSS cascade —
// lower priority than even a bare element-type selector — so any page happening to define a
// global rule like `rect { fill: transparent; }` (elsewhere in this codebase, left over from
// unrelated D3 chart styling, this is a real, existing rule) would silently win over
// `fill="..."` and make the shape invisible. Inline style always wins over a plain selector.
const _POINTSTYLE_SVG_PATHS = {
   rect    : (bg, bd) => `<rect x="1" y="1" width="10" height="10" style="fill:${bg};stroke:${bd};"/>`
  ,rectRot : (bg, bd) => `<rect x="1.8" y="1.8" width="8.4" height="8.4" style="fill:${bg};stroke:${bd};" transform="rotate(45 6 6)"/>`
  ,triangle: (bg, bd) => `<polygon points="6,1 11,10.5 1,10.5" style="fill:${bg};stroke:${bd};"/>`
  ,star    : (bg, bd) => `<polygon points="6,0.5 7.35,4.14 11.23,4.3 8.19,6.71 9.23,10.45 6,8.3 2.77,10.45 3.81,6.71 0.77,4.3 4.65,4.14" style="fill:${bg};stroke:${bd};"/>`
};
function _pointStyleTooltipSwatchHTML(pointStyle, bg, bd)
 {
   // A dataset's pointStyle can also be an HTMLCanvasElement/HTMLImageElement (Chart.js
   // supports this natively for the actual chart/legend point rendering — see drawPoint()/
   // drawPointLegend() — as an escape hatch for shapes Chart.js can't draw natively, e.g. a
   // TRUE filled star, since Chart.js's own 'star' pointStyle is just a stroked asterisk).
   // Render that image verbatim (via its own data URL) so the tooltip swatch matches
   // whatever custom shape is actually drawn on the chart/legend for that series.
   if (pointStyle != null && typeof pointStyle.toDataURL === 'function')
    return '<img src="'+pointStyle.toDataURL()+'" width="12" height="12" style="display:inline-block;vertical-align:middle;">';
   let pathFunc = _POINTSTYLE_SVG_PATHS[pointStyle];
   if (pathFunc == null)
    return '<SPAN class="chartTooltipColorBlock" style="background-color:'+bg+'; border-color:'+bd+'"></SPAN>';
   return '<svg width="12" height="12" viewBox="0 0 12 12" style="display:inline-block;vertical-align:middle;">'+pathFunc(bg, bd)+'</svg>';
 }


function tagDatasetChoroplethColor(dataset, quantiles)
 {
   let minValue = Number.MAX_SAFE_INTEGER;
   let maxValue = Number.MIN_SAFE_INTEGER;
   for (let i = 0; i < dataset.length; ++i)
    {
      let val = dataset[i].value;
      if (val > maxValue)
       maxValue = val;
      if (val < minValue)
       minValue = val;
    }
   let quantileSize = (maxValue-minValue)/quantiles;
   for (let i = 0; i < dataset.length; ++i)
    {
      let ds = dataset[i];
      let h=Math.floor(quantiles-((ds.value-minValue)/quantileSize))*100/quantiles;
      if (quantiles<0)
            h=Math.floor((ds.value-minValue)/quantileSize)*100/quantiles
      ds.fillColor = "hsl("+h+", 100%, 50%)";
    }
 }

/**
  containerDivId: Div to use for painting map
  latitude: initial latitude of map center
  longitude: initial longitude of map center
  zoomlevel: initial zoom level (1=world, 5=USA-size, 10=large city)
 */
FloriaCharts2.geoChart = function(containerDivId, latitude,longitude,zoomlevel)
{
   this._containerDivId = containerDivId;
   this._latlng=[latitude,longitude]
   this._zoomlevel=zoomlevel;
   this._map = map(this._containerDivId);
   this.setView= function(latlng,zoomlevel){
       this._map.setView(latlng, zoomlevel);
    }
    this._minLatLng =  [5000,5000];
    this._maxLatLng =  [-5000,-5000];
    var control=null;
    var legend=null;
   this.draw=function(){
        this.setView(this._latlng,this._zoomlevel);
        tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 100,
            id: 'mapbox.light'
        }).addTo(this._map);
        // Belt-and-suspenders for the same 0x0-container-at-init issue handled in addChoropleth:
        // a caller that never loads a choropleth dataset (so fitMap() is never reached) would
        // otherwise be stuck with whatever bogus size Leaflet captured at construction time.
        var that = this;
        requestAnimationFrame(function() { that._map.invalidateSize(false); });
    }
    this.addResetView= function() {
        if (control!=null)
            control.remove();
        control = new Control({
            position: 'topleft',
            title: 'Reset map view',
        });
        var that=this;
        control.onAdd = function(map) {
            this._map = map;
            this._resetMapContainer = DomUtil.create("div", "leaflet-control-resetview leaflet-bar leaflet-control");
            this._link = DomUtil.create("a", "leaflet-bar-part leaflet-bar-part-single", this._resetMapContainer);
           // this._link.title = this.title;
            this._link.href = "#";
            this._link.setAttribute("role", "button");
            this._icon = DomUtil.create("span", "leaflet-control-resetview-icon", this._link);

                //var azoom = DomUtil.create('a','resetzoom');
                //azoom.innerHTML =`<img style='width:30px;height:30px' class="leaflet-bar leaflet-control" src="/static/img/refresh.svg"/>`;
                DomEvent
                    .disableClickPropagation(this._resetMapContainer)
                    .addListener(this._resetMapContainer, 'click', function() {
                       var southWest = new latLng(that._minLatLng);
                       var northEast = new latLng(that._maxLatLng);
                       map.fitBounds(new latLngBounds(southWest, northEast))                        
                    },this._resetMapContainer);
                return this._resetMapContainer;
            };
        control.onRemove=function(){
            }
        control.addTo(this._map);
        }
   var defaultTooltipHandlerFunc = function(curFeature)
    {
      let str="";
      let p = curFeature.properties;
      if (p != null)
       {
         str='<B>Country: </B>'+p.cr+'<BR>'
            +'<B>State: </B>'+(p.ste_name || p?.s?.[1])+'<BR>'
            ;
         let county = p.coty_name || p?.cn?.[1];
         if (county != null)
          str+='<B>County: </B>'+county+'<BR>';
         let zip = p.zc;
         if (zip != null)
          str+='<B>Zipcode: </B> '+zip+'<BR>';
         let val = curFeature?.data?.value;
         if (val != null)
          str+='<B>Count: </B> '+val+'<BR>';
        }
       return str;
    }
   this._tooltipHandlerFunc=defaultTooltipHandlerFunc;
   this.setTooltipHandlerFunc = function(tooltipHandlerFunc)
    {
      this._tooltipHandlerFunc = tooltipHandlerFunc || defaultTooltipHandlerFunc;
    };

   // Optional click-through hook (e.g. Quick Insights' "click a state to drill into its
   // counties"). Called with (feature) for whichever choropleth area was clicked; the caller
   // is responsible for checking feature.data (only set for areas present in the dataset) if
   // it only wants to react to areas that actually carry a value.
   this._clickHandlerFunc = null;
   this.setClickHandlerFunc = function(clickHandlerFunc)
    {
      this._clickHandlerFunc = clickHandlerFunc || null;
    };

   this.getStateName = function(feature)
    {
      return feature.properties.ste_name||feature.properties?.s?.[1];
    };
   this.getStateCode = function(feature)
    {
      return feature.properties.ste_name||feature.properties?.s?.[0];
    }
    
   this.addMarker= function(dataset,markerType,markerColor){
        geoJson(dataset,{
        pointToLayer:function(feature,latlng){
            let curFeature=JSON.parse(JSON.stringify(feature))
            let str=setTooltip(curFeature)
            if (markerType=="Circle")
                return circleMarker(latlng,{color:markerColor?markerColor:"blue",radius:2}).bindTooltip(str);
            else{
                let icon= new Icon({
                      iconUrl: `/static/img/marker-icon-${markerColor?markerColor:"blue"}.png`,
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                    })
                 return marker(latlng,{icon:icon}).bindTooltip(str);
               }
            }
        }).addTo(this._map);
      }
      
    this._mergeAndcalculateBounds = function(areaMap, dataset, datasetType)
     {
        var minLat =  5000;
        var minLong = 5000;
        var maxLat =  -5000;
        var maxLong =  -5000;
        var minVal=Number.MAX_VALUE;
        var maxVal=Number.MIN_VALUE;
        var states = new Set();
        
        for (let i = 0; i < areaMap.features.length; ++i)
         {
           let f = areaMap.features[i];
           let ds=null;
           if (datasetType=="zipcodes")
             ds = dataset.getSE(f.properties.zc, "code");
           else if (datasetType=="counties")
             ds = dataset.getSE(f.properties['cn'][0], "code");
           else if (datasetType=="states")
             {
               ds = dataset.getSE(f.properties.stc, "code");
               if (ds != null)
                states.add(f.properties.stc);
             }
           if (ds != null)
            {
              f.data = ds;
              if (ds.value < minVal) minVal = ds.value;
              if (ds.value > maxVal) maxVal = ds.value;
              let lat = f.properties.latlng[0];
              let lng = f.properties.latlng[1];
              if (minLat  > lat)  minLat  = lat;
              if (minLong > lng)  minLong = lng;
              if (maxLat  < lat)  maxLat  = lat;
              if (maxLong < lng)  maxLong = lng;
            }
         }
        this._minLatLng=[minLat,minLong];
        this._maxLatLng=[maxLat,maxLong];
        //console.log("this._minLatLng: ", this._minLatLng, " ("+minLatSt+","+minLongSt+"); this._maxLatLng: ", this._maxLatLng+" ("+maxLatSt+","+maxLongSt+"); states: ", new Array(...states).sort());
        return {bounds:{ southWest:{lat: minLat, lng: minLong}
                        ,northEast:{lat: maxLat, lng: maxLong}
                       },
                counts:{
                    minVal,maxVal
                }
               };
     }
     
    /** Expects a "bounds" variable with the following structure:
           { southWest:{lat: val, lng: val}
            ,northEast:{lat: val, lng: val}
           }
     */
    this.fitMap = function(geoBounds)
     {
       var southWest = new latLng(geoBounds.southWest.lat, geoBounds.southWest.lng);
       var northEast = new latLng(geoBounds.northEast.lat, geoBounds.northEast.lng);
       this._map.flyToBounds(new latLngBounds(southWest, northEast),{ 'animate':false,'noMoveStart':true,'duration':0 });
       
     }
    this._addLegend =function(quantiles,counts){
        if (legend!=null)
            legend.remove()
        legend = new Control({position: 'bottomright'});
        legend.onAdd = function (map) {
           let quantileSize = (counts.maxVal-counts.minVal)/quantiles;
            var div = DomUtil.create('div', 'info legend');
            if (Math.abs(quantileSize)<1){
                div.innerHTML +=
            '<i style="background:' + "hsl("+100+", 100%, 50%)" + '"></i> ' +
            (counts.minVal) + '&ndash;' + counts.maxVal+ '<br>';
            }
            else{
                 // Loop through OUR OWN `quantiles` bands (NOT a hardcoded 4/5), using the exact
                 // same quantileSize/hue formula as tagDatasetChoroplethColor above. Previously this
                 // hardcoded a fixed 4-step "diff" (range/4) regardless of the `quantiles` the caller
                 // actually asked for, while the hue itself was computed against quantileSize
                 // (range/quantiles). Those two only happened to agree when quantiles===5; for any
                 // other value (or even 5, exactly, due to rounding) the bucket boundaries and the
                 // hues desynced, skipping hues and even going negative/out of the 0-100 range —
                 // which is exactly the nonsensical legend reported (80,60,20,0,-20: skips 40,
                 // dips negative).
                let n = Math.round(Math.abs(quantiles));
                for (var i = 0; i<n; i++) {
                    let lo = counts.minVal + i*quantileSize;
                    let hi = counts.minVal + (i+1)*quantileSize;
                    let h = Math.floor(quantiles-(i+0.5))*100/quantiles;
                    if (quantiles<0)
                        h=Math.floor(i+0.5)*100/quantiles;
                    div.innerHTML +=
                '<i style="background:' + "hsl("+h+", 100%, 50%)" + '"></i> ' +
                Math.round(lo) + (i<n-1 ? '&ndash;' + Math.round(hi) + '<br>' : '+');
                  }
            }
            return div;
        };
        legend.addTo(this._map);
    }
    this.addChoropleth=function(dataset, quantiles, country, states, countycodes, type)
     {
        if (country==null || type ==null)
            return;
        tagDatasetChoroplethColor(dataset, quantiles);
        function styleFunc(feature)
          {
            return {fillColor: feature.data?.fillColor || "rgba(255, 255, 255, .2)",
                    weight: 2,
                    opacity: 0.6,
                    color: 'white',
                    dashArray: '3',
                    fillOpacity: 0.5
                   };
          }
        let data={features:[]};
        let that = this;
        let urls=[];
        if (states==null || states.length==0)
            urls.push(`/static/floria.v2.0/geo-data/${country}/${country}_${type}.json`);
        else if (states.length==1 && countycodes!=null &&  countycodes.length>0){
            let state=states[0]
            for (let i=0;i<countycodes.length;i++){
                let county=countycodes[i]
                urls.push(`/static/floria.v2.0/geo-data/${country}/${state}/zipcodes/${county}_countycode.json`);
            }
        }
        else if (countycodes==null ||countycodes.length==0){
            for (let i=0;i<states.length;i++){
                let state=states[i]
                urls.push(`/static/floria.v2.0/geo-data/${country}/${state}/${state}_${type}.json`);
            }
        }
        else
            return alert("Error: Cannot select multiple states and multiple counties at same time");
        let count=0;
        for (let i=0;i<urls.length;i++){
                let url=urls[i]
                FloriaAjax.ajaxUrl(url, "GET", "Cannot get map areas information", function(areaMap)
                 {
                    data.features = data.features.concat(areaMap.features);
                    count+=1;
                    if (states==null || count==states.length){  
                        var result = that._mergeAndcalculateBounds(data, dataset, type);
                       // When resetting the map, e.g., to another location, we have to clear previous layers.
                       that._map.eachLayer( function(layer) {
                         if ( layer.myTag &&  layer.myTag === that._containerDivId)
                          that._map.removeLayer(layer);
                       });
                       geoJson(data, {style: styleFunc
                                ,onEachFeature: function (feature, layer) { // called for every layer for every feature.
                                   layer.myTag = that._containerDivId;
                                   layer.bindTooltip(feature?.data?.tooltip || that._tooltipHandlerFunc(feature) || defaultTooltipHandlerFunc(feature));
                                   if (that._clickHandlerFunc != null)
                                    layer.on('click', function() { that._clickHandlerFunc(feature); });
                                }}).addTo(that._map);
               
                       // Leaflet computes its internal pixel origin from the container's size at the
                       // moment the map was created (see FloriaCharts2.geoChart above). When that
                       // container is inserted and sized by CSS grid/flex in the very same synchronous
                       // tick (as every Quick Insights mini-dashboard does), the browser has not
                       // necessarily reflowed yet, so Leaflet can see a 0x0 (or stale) container and
                       // ends up rendering a fully-zoomed-out "whole world" view no matter what zoom/
                       // fitBounds is requested afterwards. invalidateSize() forces Leaflet to re-read
                       // the container's real, laid-out size right before we fit to the data's bounds.
                       that._map.invalidateSize(false);
                       that.fitMap(result.bounds);
                       that._addLegend(quantiles,result.counts)
                    }
             }, null, null, null, "jsonRAW");
        }
    }
}


FloriaCharts2.getData = function()
{
   this.getData= function(country,state,county,type){
        var url;
        if ( state!=null)
            if (county!=null)
                url=`/static/floria.v2.0/geo-data/${country}/${state}/zipcodes/${county}_countycode.json`;
            else
                url=`/static/floria.v2.0/geo-data/${country}/${state}/${state}_${type}.json`;
        else
            url=`/static/json/geo-data/${country}/${country}_states.json`;
        return fetch(url).then(d=>{
            return  d.json()
            }).then(data=>{
                return data['features'].map(({type,geometry,...rest}) => ({...rest.properties}))
        }).catch(err=>{
            return err
        })
      } 
    this.populateData= function(DivId, data,type){
        var Element = document.getElementById(DivId);
        Element.length=0;   
        Element.options[0] = new Option('Select ','');
        Element.selectedIndex = 0;
        if (data.length>0){
            for (var i=0; i<data.length; i++) {
                if (type=="states")
                    Element.options[Element.length] = new Option(data[i]['s']?.[1],data[i]?.['stc']);
                else if (type=="counties")
                    Element.options[Element.length] = new Option(data[i]['cn']?.[1],data[i]['cn']?.[0]);
                else
                    Element.options[Element.length] = new Option(data[i]['zc'],data[i]['zc']);
            }
        }

    }
}


/*
FloriaCharts2.chart = function(containerDivId, title, titleFontSize, titleFontWeight, titleFontColor)
 {
   this._containerDivId = containerDivId;
   this._options = {
      responsive: true
     ,interaction: {
          intersect: false,
          mode: 'index'
      }
     ,maintainAspectRatio: false
     ,plugins: { }
    };
   if (title != null)
    this._options.plugins.title = { display: true, text:title, color:titleFontColor, font: { size: titleFontSize||28, weight: titleFontWeight } }
   this._datasets = [ ];
   
   this.setVerticalBarLine = function(vertical)
     {
       this._options.indexAxis = vertical == true ? 'y' : 'x';
       this._options.interaction = { mode: 'index', intersect: false, axis: this._options.indexAxis };
       return this;
     };
     
    this.setAxisLabels = function(xAxisLabel, yAxisLabel, fontSize, fontWeight, fontColor)
     {
       this._options.scales = {
            x: { title:{ display: true, text:xAxisLabel, color:fontColor, font:{ size: fontSize||16, weight: fontWeight } } }
           ,y: { title:{ display: true, text:yAxisLabel, color:fontColor, font:{ size: fontSize||16, weight: fontWeight } } }
       };
       return this;
     };
     
    this.setLegend = function(display, fontSize)
     {
       this._options.plugins.legend = { display: display, labels: { font: { size: fontSize||18 } } };
       return this;
     };
     
    this.setTooltips = function(titleFontSize, bodyFontSize, footerFontSize)
     {
       this._options.plugins.tooltip = { mode: 'index'
                                       , position: 'cursor'
                                       , boxPadding: 5
                                       , titleFont : { size: titleFontSize ||20 }
                                       , bodyFont  : { size: bodyFontSize  ||(titleFontSize-4)||18  }
                                       , footerFont: { size: footerFontSize||(titleFontSize-8)||14, weight: 'normal'  }
                                       , callbacks: { 
                                           footer: function (context) {
                                              let d = context[0].dataset.dataSrc[context[0].dataIndex]; 
                                              return d.tooltip;
                                           }
                                         }
                                       };
       return this;
     };

    this.addDataset = function(data, label, colorScheme, borderColor)
     {
       this._datasets.push({ label: label
                            ,axis: this._options.indexAxis
                            ,dataSrc: data
                            ,data: data.map(row => row.y)
                            ,borderWidth: 2
                            ,borderColor: borderColor||'rgb(192, 192, 192)'
                            ,backgroundColor: colorScheme||ChartTheme.colorSchemes.ClassicCyclic13
                          });
       return this;
     };
    
    this.draw = function(chartType)
     {
        FloriaDOM.addCSS(this._containerDivId, "chart-container");
        document.getElementById(containerDivId).innerHTML = '<CANVAS id="'+this._containerDivId+'_CNVS" style=""></CANVAS>';
        this._chartType = chartType;

        this._chart = new Chart(document.getElementById(this._containerDivId+'_CNVS'), {
               type: this._chartType
              ,options: this._options
              ,data: {
                  labels: this._datasets[0].dataSrc.map(row => row.x)
                 ,datasets: this._datasets
                }
           });
     };
};
*/


 





const CHART_REGISTRY = { };


FloriaCharts2.Chart = function(divId)
 {
   this._divId = divId;
   this._datasets = [];
   this._datasetsByKey = {}; // opt-in keyed-dataset registry — see registerDataset()/buildScatterDataset() below
   this._title = null;
   this._xAxis = null;
   this._yAxis = null;
   this._clickHandler = null;
   this._tooltip = null;
   this._legend = null;
   this._chart = null;
   
   this.setTitle = function(title, fontSpec /*weight, style, size, family*/, position)
    {
      this._title = { display: title != null
                     ,text: title
                     ,position: position || 'top' // 'top', 'bottom', 'left', 'right'
                     ,font: { weight: fontSpec?.weight, style: fontSpec?.style, size: fontSpec?.size, family: fontSpec?.family } 
                    };
      return this;
    }
    
   this.setCommonColorTemplate = function(visualSpecs /*backgroundColor, backgroundColorFaded, borderColor, borderColorFaded, borderWidth, radius*/
                                         ,visualSpecsHover /*backgroundColor, backgroundColorFaded, borderColor, borderWidth, radius*/
                                         )
     {
       this._commonVisualSpecs = visualSpecs;
       this._commonVisualSpecsHover = visualSpecsHover;
       return this;
     }

   this.setInteractionMode = function(mode /*'index','nearest','dataset','point','x','y'*/, intersect)
    {
      this._interaction = { mode: mode || 'index', intersect: intersect === true };
      return this;
    }

   this.setSecondaryYAxis = function(title
                                    ,fontSpec /*weight, style, size, family*/
                                    ,labelFunc /*f(value, index, ticks)*/
                                    ,min, max
                                    )
    {
      this._y1Axis = {
         position: 'right'
        ,grid: { drawOnChartArea: false } // avoid double grid lines
        ,title: { display: title != null
                , text: title
                , font: { weight: fontSpec?.weight, style: fontSpec?.style, size: fontSpec?.size, family: fontSpec?.family }
                }
        ,ticks: labelFunc == null ? { includeBounds: true }
                                  : { includeBounds: true
                                     ,callback: function(value, index, ticks) { return labelFunc(value, index, ticks); }
                                    }
        ,min: min
        ,max: max
       };
      return this;
    }

   // Pure object construction — no registration into this._datasets. Extracted out of
   // _addDataset (unchanged below) so the new opt-in keyed API (buildScatterDataset /
   // registerDataset / setDatasetVisibility / reorderDatasets, further below) can construct
   // and cache dataset objects externally without affecting existing addScatter/addBar/...
   // behavior at all.
   this._buildDatasetObject=function(chartType, dataset
                            ,labels /*labelFull, labelSimple*/
                            ,visualSpecs /*backgroundColor, backgroundColorFaded, borderColor, borderColorFaded, borderWidth, radius, pointStyle*/
                            ,visualSpecsHover /*backgroundColor, backgroundColorFaded, borderColor, borderWidth, radius*/
                            ,yAxisID /*'y' (default) or 'y1' (secondary)*/
                            )
    {
      visualSpecs = FloriaDOM.mergeProperies(this._commonVisualSpecs, visualSpecs);
      visualSpecsHover = FloriaDOM.mergeProperies(this._commonVisualSpecsHover, visualSpecsHover);
      return { type: chartType
                 ,data: dataset
                 ,label: labels.labelFull, labelSimple: labels.labelSimple || labels.labelFull
                 ,yAxisID: yAxisID || 'y'
                          
                 ,backgroundColor: visualSpecs.backgroundColor
                 ,backgroundColorInitial: visualSpecs.backgroundColor
                 ,backgroundColorFaded: visualSpecs.backgroundColorFaded
                 ,borderColor: visualSpecs.borderColor
                 ,borderColorInitial: visualSpecs.borderColor
                 ,borderColorFaded: visualSpecs.borderColorFaded
                 ,borderWidth: visualSpecs.borderWidth
                 ,radius: visualSpecs.radius
                 // Optional per-dataset point shape (Chart.js pointStyle: 'circle', 'rect',
                 // 'rectRot', 'triangle', 'star', ...) — a second, independent visual channel
                 // callers can use (alongside color) to keep many concurrently-drawn small
                 // series distinguishable. Left undefined (→ Chart.js default 'circle') when
                 // not supplied, so existing callers are entirely unaffected.
                 ,pointStyle: visualSpecs.pointStyle
                          
                 ,hoverBackgroundColor: visualSpecsHover.backgroundColor
                 ,hoverBackgroundColorInitial: visualSpecsHover.backgroundColor
                 ,hoverBackgroundColorFaded: visualSpecsHover.backgroundColorFaded
                 ,hoverBorderColor: visualSpecsHover.borderColor
                 ,hoverBorderColorInitial: visualSpecsHover.borderColor
                 ,hoverBorderColorFaded: visualSpecsHover.borderColorFaded
                 ,hoverBorderWidth: visualSpecsHover.borderWidth
                 ,hoverRadius: visualSpecsHover.radius
                 ,hitRadius: visualSpecsHover.radius
                };
    }

   this._addDataset=function(chartType, dataset
                            ,labels /*labelFull, labelSimple*/
                            ,visualSpecs /*backgroundColor, backgroundColorFaded, borderColor, borderColorFaded, borderWidth, radius*/
                            ,visualSpecsHover /*backgroundColor, backgroundColorFaded, borderColor, borderWidth, radius*/
                            ,yAxisID /*'y' (default) or 'y1' (secondary)*/
                            )
    {
      let ds = this._buildDatasetObject(chartType, dataset, labels, visualSpecs, visualSpecsHover, yAxisID);
      this._datasets.push(ds);
      return ds;
    }

   ////////////////////////////////////////////////////////////////////////////////////////////
   // Opt-in incremental / keyed dataset API (additive — does not alter any existing method's
   // behavior; existing callers of addScatter/addBar/addLine/.../draw() are wholly unaffected).
   //
   // Purpose: on repeated draw() calls for the SAME chart (e.g. toggling a checkbox), Chart.js
   // can only reuse its internal per-dataset parse/element/animation caches when the dataset
   // OBJECT (and, ideally, its .data array) keeps the same identity across updates. Rebuilding
   // brand-new dataset objects every render (as addScatter/addBar/etc. always do) defeats that
   // and forces a full re-parse + re-resolve of every point on every update. These methods let a
   // caller build a dataset once, cache the object itself externally (keyed by something stable
   // like a record's refnum), and reuse/refresh/show/hide/reorder it across many draw() calls.
   ////////////////////////////////////////////////////////////////////////////////////////////

   /** Builds a 'bubble' (scatter) dataset object without registering it — caller owns/caches it. */
   this.buildScatterDataset = function(dataset, labels, visualSpecs, visualSpecsHover)
    {
      return this._buildDatasetObject('bubble', dataset, labels, visualSpecs, visualSpecsHover);
    }

   /** Registers a (possibly externally-cached/reused) dataset object under `key` on THIS chart
       instance, so it participates in the next draw()/reorderDatasets()/setDatasetVisibility(). */
   this.registerDataset = function(key, ds)
    {
      this._datasetsByKey[key] = ds;
      if (this._datasets.indexOf(ds) < 0)
       this._datasets.push(ds);
      return ds;
    }

   /** Cheaply shows/hides an already-registered dataset (by key) without rebuilding it.
       Uses Chart.js's own setDatasetVisibility() on the live chart instance when one already
       exists for this div, so previously-drawn datasets don't need a full rebuild just to be
       hidden/shown again. */
   this.setDatasetVisibility = function(key, visible)
    {
      let ds = this._datasetsByKey[key];
      if (ds == null)
       return this;
      ds.hidden = !visible; // honored the first time this dataset object is ever parsed
      let liveChart = CHART_REGISTRY[this._divId];
      if (liveChart != null)
       {
         let idx = liveChart.data.datasets.indexOf(ds);
         if (idx >= 0)
          liveChart.setDatasetVisibility(idx, visible);
       }
      return this;
    }

   /** Reorders the datasets that will be handed to Chart.js on the next draw() call, matched by
       key. Purely a z-order (and, incidentally, legend order) concern — does not change any
       dataset's identity, content, or color. Any dataset not present in orderedKeys (e.g. added
       via the classic addScatter/addBar/... calls) is appended at the end, preserving its
       relative order, so mixed usage never silently drops a series. */
   this.reorderDatasets = function(orderedKeys)
    {
      let ordered = [];
      for (let i = 0; i < orderedKeys.length; ++i)
       {
         let ds = this._datasetsByKey[orderedKeys[i]];
         if (ds != null && ordered.indexOf(ds) < 0)
          ordered.push(ds);
       }
      for (let i = 0; i < this._datasets.length; ++i)
       if (ordered.indexOf(this._datasets[i]) < 0)
        ordered.push(this._datasets[i]);
      this._datasets = ordered;
      return this;
    }

   this.addScatter=function(dataset
                           ,labels /*labelFull, labelSimple*/
                           ,visualSpecs /*backgroundColor, backgroundColorFaded, borderColor, borderColorFaded, borderWidth, radius*/
                           ,visualSpecsHover /*backgroundColor, backgroundColorFaded, borderColor, borderWidth, radius*/
                           )
    {
      this._addDataset ('bubble', dataset, labels, visualSpecs, visualSpecsHover);
      return this;
    }

   this.addBar=function(dataset
                       ,labels /*labelFull, labelSimple*/
                       ,visualSpecs /*backgroundColor, backgroundColorFaded, borderColor, borderColorFaded, borderWidth, radius*/
                       ,visualSpecsHover /*backgroundColor, backgroundColorFaded, borderColor, borderWidth, radius*/
                       ,barThickness
                       ,yAxisID /*'y' (default) or 'y1' (secondary)*/
                       )
    {
      dataset = this._addDataset ('bar', dataset, labels, visualSpecs, visualSpecsHover, yAxisID);
      dataset.barThickness = barThickness || 25;
      return this;
    }    

   this.addLine=function(dataset
                        ,labels /*labelFull, labelSimple*/
                        ,visualSpecs /*backgroundColor, backgroundColorFaded, borderColor, borderColorFaded, borderWidth, radius, pointBorderWidth */
                        ,visualSpecsHover /*backgroundColor, backgroundColorFaded, borderColor, borderWidth, radius, pointBorderWidth */
                        ,yAxisID /*'y' (default) or 'y1' (secondary)*/
                        )
    {
      dataset = this._addDataset ('line', dataset, labels, visualSpecs, visualSpecsHover, yAxisID);
      dataset.pointBorderWidth = visualSpecs?.pointBorderWidth;
      dataset.hoverPointBorderWidth = visualSpecsHover?.pointBorderWidth;
      return this;
    }    
    
   this.addPie=function(dataset
                       ,labels /*labelFull, labelSimple*/
                       ,visualSpecs /*backgroundColor, backgroundColorFaded, borderColor, borderColorFaded, borderWidth, radius*/
                       ,visualSpecsHover /*backgroundColor, backgroundColorFaded, borderColor, borderWidth, radius*/
                       )
    {
      for (let i = 0; i < this._datasets.length; ++i)
       if (this._datasets[i].type != 'pie')
        return FloriaDOM.consoleThrow("FloriaCharts2.Chart.addPie called when other non-pie datasets exist: 'pie' dataserts cannot be mixed with others.");
      this._addDataset ('pie', dataset, labels, visualSpecs, visualSpecsHover);
      return this;
    }

   this.addPolar=function(dataset
                         ,labels /*labelFull, labelSimple*/
                         ,visualSpecs /*backgroundColor, backgroundColorFaded, borderColor, borderColorFaded, borderWidth, radius*/
                         ,visualSpecsHover /*backgroundColor, backgroundColorFaded, borderColor, borderWidth, radius*/
                         )
    {
      for (let i = 0; i < this._datasets.length; ++i)
       if (this._datasets[i].type != 'polarArea')
        return FloriaDOM.consoleThrow("FloriaCharts2.Chart.addPolar called when other non-polar datasets exist: 'polarArea' dataserts cannot be mixed with others.");
      this._addDataset ('polarArea', dataset, labels, visualSpecs, visualSpecsHover);
      return this;
    }

   this.addRadar=function(dataset
                         ,labels /*labelFull, labelSimple*/
                         ,visualSpecs /*backgroundColor, backgroundColorFaded, borderColor, borderColorFaded, borderWidth, radius*/
                         ,visualSpecsHover /*backgroundColor, backgroundColorFaded, borderColor, borderWidth, radius*/
                         )
    {
      for (let i = 0; i < this._datasets.length; ++i)
       if (this._datasets[i].type != 'radar')
        return FloriaDOM.consoleThrow("FloriaCharts2.Chart.addPolar called when other non-polar datasets exist: 'polarArea' dataserts cannot be mixed with others.");
      this._addDataset ('radar', dataset, labels, visualSpecs, visualSpecsHover);
      return this;
    }

   this.setPiePolarRadarLabels=function(labels)
    {
      this._piePolarRadarLabels = labels;
    }
    
   this.setPieAttributes = function(doughnutCutout, arc)
    {
      if (doughnutCutout == null && arc == null)
       return FloriaDOM.consoleThrow("FloriaCharts2.Chart.setPieAttributes called with both doughnutCutout and arc as null!");
      for (let i = 0; i < this._datasets.length; ++i)
       if (this._datasets[i].type != 'pie')
        return FloriaDOM.consoleThrow("FloriaCharts2.Chart.setPieAttributes called when there are no 'pie' datasets!");

      this._pieAttrs = { cutout: doughnutCutout > 0 ? doughnutCutout : null
                        ,circumference: arc == true ? 180 : null
                        ,rotation: arc == true ? -90 : null
                      };
      return this;
    }
    
   this.setFancyLabeling = function(showLabel, showValue, showPct, pctPrecision)
    {
      if (showLabel || showValue || showPct)
       this._fancyLabels = {showLabel, showValue, showPct, pctPrecision};
      else
       this._fancyLabels = null;
       
      return this;
    }
    
   this.setAxis=function(type, title
                         ,fontSpec /*weight, style, size, family*/
                         ,labelFunc /*f(value, index, ticks)*/
                         ,min, max
                         ,vertical
                         ,scaleType /*'linear' | 'category' | 'time' | 'logarithmic' | ... — Chart.js scale
                                      type override. Chart.js's own per-chart-type default (e.g. a 'line'
                                      chart defaults its X scale to 'category') otherwise applies, which
                                      silently mis-positions numeric {x,y} point data — a 'category' scale
                                      places points by looking their x up in a top-level `labels` array
                                      (which this component never sets), so with no match every point
                                      collapses onto the same first tick instead of spreading out by year.
                                      Pass 'linear' explicitly whenever x is a real number (e.g. a year). */
                         )
    {
      let axis = {
         title: { display: title!=null
                , text: title
                , font: { weight: fontSpec?.weight, style: fontSpec?.style, size: fontSpec?.size, family: fontSpec?.family } 
                }
        ,ticks: labelFunc == null ? { includeBounds: true }
                                  : { includeBounds: true
                                     ,callback: function(value, index, ticks) { return labelFunc(value, index, ticks); }
                                    }
        ,min: min
        ,max: max
        ,vertical: vertical
        ,type: scaleType || undefined
       };
     if (type == 'X')
      this._xAxis = axis;
     else if (type == 'Y')
      this._yAxis = axis;
     else if (type == 'R')
      this._rAxis = axis;
     else
      return FloriaDOM.consoleThrow("FloriaCharts2.Chart.setAxis called with type='"+type+"': must be 'X', 'Y' or 'R'");
     if (this._xAxis?.vertical == true && this._yAxis?.vertical == true)
      return FloriaDOM.consoleThrow("FloriaCharts2.Chart.setAxis called with both the xAxis and yAxis having vertical=true. Only one is allowed, or none.");
     if (this._rAxis?.vertical == true)
      return FloriaDOM.consoleThrow("FloriaCharts2.Chart.setAxis called with the rAxis having vertical=true, which is nonsensical.");

     return this;
    }

   this.setClickHandler=function(handlerFunc /*f(dataElement)*/)
    {
      this._clickHandler = function(evt, item, legend)
       {
         let c = evt.chart;
         var pt = c.getElementsAtEventForMode(evt, c.options.interaction.mode, c.options.interaction.intersect);
         if (pt != null && pt.length > 0)
          {
            pt = pt[0];
            let dataElement = c.config.data.datasets[pt.datasetIndex].data[pt.index];
            handlerFunc(dataElement);
          }
       }
      return this;
    }

   this.setTooltip = function(xAlign, yAlign, tooltipPainterFunc, param1, param2, param3, param4)
    {
      if (tooltipPainterFunc == null)
       tooltipPainterFunc = function(idx, data, label) { let d = data[idx]; return d.x != null ? '<TR><TD></TD><TD>'+d.x+'</TD><TD>'+d.y+'</TD></TR>' : '<TR><TD></TD><TD>'+label+'</TD><TD>'+d+'</TD></TR>'; };
      let tooltipFunc = function(context) {
         // Tooltip Element
         const {chart, tooltip} = context;
         let tooltipEl = document.getElementById('FLORIA_CHART_TOOLTIP');
         if (tooltipEl == null)
          {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'FLORIA_CHART_TOOLTIP';
            tooltipEl.className="chartTooltip";
            document.body.appendChild(tooltipEl);
//            chart.canvas.parentNode.appendChild(tooltipEl);
          }
        
         // Hide if no tooltip
         if (tooltip.opacity === 0)
           return tooltipEl.style.opacity = 0;
        
         // table
         let str='';
         if (tooltip?.dataPoints?.length > 0)
          {
            for (let i = 0; i < tooltip.dataPoints.length; ++i)
             {
               let p = tooltip.dataPoints[i];
               const colors = tooltip.labelColors[i];
               const data = p.dataset.data[p.dataIndex];
               let customTolltipStr = tooltipPainterFunc(p.dataIndex, p.dataset.data, p.label, i, param1, param2, param3, param4);
               if (customTolltipStr == null)
                continue;
               str+='<TR><TD>'+_pointStyleTooltipSwatchHTML(p.dataset.pointStyle, colors.backgroundColor, colors.borderColor)+'</TD>'
                       +'<TD colspan="2"><B font-size="120%">'+p.dataset.labelSimple+'</B></TD>'
                       +customTolltipStr
                   +'</TR>'
                   ;
             }
            if (str=='')
             return;
            tooltipEl.innerHTML = '<TABLE>'+str+'</TABLE>';
          }
    
         tooltipEl.style.opacity = 1;
//         console.log("chart.canvas.getBoundingClientRect(): ", chart.canvas.getBoundingClientRect());
//         console.log("chart.canvas.offsetst: ", [chart.canvas.offsetLeft, chart.canvas.offsetTop]);
         const { left: positionX, top: positionY } = chart.canvas.getBoundingClientRect();
         tooltipEl.style.left = (positionX + tooltip.caretX) + 'px';
         tooltipEl.style.top = (positionY + tooltip.caretY) + 'px';
       };
       
      this._tooltip = {
         enabled: tooltipFunc==null
        ,position: 'cursor'
        ,xAlign: xAlign
        ,yAlign: yAlign
        ,external: tooltipFunc
       };
      return this;
    }
    
   this.setLegendBehavior = function(active, usePointStyle)
    {
      if (active == false)
       return this._legend = null;
       
      this._legend = {
         // Opt-in only (usePointStyle === true): draw each legend swatch using the dataset's
         // own pointStyle (circle/rect/triangle/star/rectRot/...) instead of the classic plain
         // color box, so a series with a non-default shape (see buildScatterDataset's
         // `pointStyle` visualSpec) is recognizable by shape in the legend too, not just by
         // color. Left out entirely (undefined) when not requested, which preserves Chart.js's
         // default (plain color box) legend rendering exactly as before for every existing
         // caller of setLegendBehavior(true) that doesn't ask for this.
         labels: usePointStyle === true ? { usePointStyle: true, pointStyleWidth: 10 } : undefined
        ,onClick: function (evt, item, legend) {
             if (legend.chart.data.datasets.length == 1)
              return;
             const c = legend.chart;
             const index = item.datasetIndex;
             const ds = c.data.datasets[index];
             if (c.isDatasetVisible(index) == false)
              {
                legend.chart.show(index);
//                ds.backgroundColor = ds.backgroundColorInitial;
//                ds.borderColor = ds.borderColorInitial;
              }
//             else if (ds.backgroundColor != ds.backgroundColorFaded)
//              {
//                ds.backgroundColor = ds.backgroundColorFaded;
//                ds.borderColor = ds.borderColorFaded;
//              }
             else
              legend.chart.hide(index);
              
             legend.chart.update();
          }
       };
      return this;
    };
    
   this.setSelectOptions = function(options, onChangeFunc)
    {
      if ((options == null || options.length == 0) && onChangeFunc != null)
       return FloriaDOM.consoleThrow("FloriaCharts2.Chart.setSelectOptions called with an options handler function, but no options.");
      if (options != null && options.length > 0 && onChangeFunc == null)
       return FloriaDOM.consoleThrow("FloriaCharts2.Chart.setSelectOptions called with options, but no options handler function.");
      this._selectOptions = options;
      this._selectOnChange = onChangeFunc;
    }
   this.setChartOptions = function(options, selectedChartOption, onChangeFunc)
    {
      if ((options == null || options.length == 0) && onChangeFunc != null)
       return console.error("FloriaCharts2.Chart.setChartOptions called with an options handler function, but no options.");
      if (options != null && options.length > 0 && onChangeFunc == null)
       return console.error("FloriaCharts2.Chart.setChartOptions called with options, but no options handler function.");
      this._chartOptions = options;
      this._selectedChartOption = selectedChartOption;
      this._chartOnChange = onChangeFunc;
    }
   this.setActions = function(actions, actionsFunc)
    {
      if ((actions == null || actions.length == 0) && actionsFunc != null)
       return FloriaDOM.consoleThrow("FloriaCharts2.Chart.setSelectOptions called with an action handler function, but no actions.");
      if (actions != null && actions.length > 0 && actionsFunc == null)
       return FloriaDOM.consoleThrow("FloriaCharts2.Chart.setSelectOptions called with actions, but no actions handler function.");
      this._actions = actions;
      this._actionsFunc = actionsFunc;
    }

   this.draw=function(padding)
    {
      let config = {
         data: { datasets: this._datasets }
        ,options: {
            responsive: true
           ,animation: {  duration: 500, }
           ,maintainAspectRatio: false
           ,interaction: this._interaction || { mode: 'nearest', intersect: true }
           ,scales: {
             }
           ,onClick: this._clickHandler
           ,plugins: {
               title: this._title
              ,tooltip: this._tooltip
              ,legend: this._legend
             }
          }
       }
      if (this._xAxis != null)
       config.options.scales.x = this._xAxis;
      if (this._yAxis != null)
       config.options.scales.y = this._yAxis;
      if (this._y1Axis != null)
       config.options.scales.y1 = this._y1Axis;
      if (this._rAxis != null)
       config.options.scales.r = this._rAxis;

      if (this._pieAttrs != null)
       {
         config.options.cutout = this._pieAttrs.cutout
         config.options.circumference = this._pieAttrs.circumference
         config.options.rotation = this._pieAttrs.rotation
       }
       
      if (this._piePolarRadarLabels != null)
       config.data.labels = this._piePolarRadarLabels;
       
      if (this._fancyLabels != null)
       {
         let datalabels = {
                color:'#444'
               ,padding: 0
               ,textAlign: 'center'
               ,labels: { }
          };

        if (this._fancyLabels.showLabel)
         datalabels.labels.index = {
             align: 'end'
            ,anchor: 'end'
            ,offset: 10
            ,display: 'auto'
            ,font: { weight: 'bold', size:14 }
            ,formatter: function(value, context) {
                return context.chart.data.labels[context.dataIndex];
             }
         };
        if (this._fancyLabels.showValue)
         datalabels.labels.name = {
             align: 'top'
            ,font: { weight: 'bold', size:14 }
            ,formatter: function(value, context) {
                return FloriaText.NumberUtil.printWithThousands0Dec(value);
             }
         };
        if (this._fancyLabels.showPct)
         datalabels.labels.value = {
             align: 'middle'
            ,font: { weight: 'normal', size:12 }
            ,formatter: function(value, context) {
                let sum=0;
                for (let i = 0; i < context.dataset.data.length; ++i)
                 sum+=context.dataset.data[i];
                return FloriaText.NumberUtil.printWith1Dec(100.0*value/sum)+'%';
             }
         };
        config.options.plugins.datalabels = datalabels;
       }
      else
       config.options.plugins.datalabels = { formatter: function() { return ''; } };

      if (padding != null)
       config.options.layout = { padding: padding }; 
       
      if (config.options.scales.x?.vertical == true)
       config.options.indexAxis = 'y';

      this._chart = CHART_REGISTRY[this._divId];
      let e = document.getElementById(this._divId);
      if (this._chart != null && document.getElementById(this._divId+'_CNVS') != null)
       {
         config.options.animation.duration = 0;
         this._chart.config.data = config.data;
         this._chart.config.options = config.options;
         this._chart.update();
       }
      else
       {
         config.options.animation.duration = 500;
         let that = this;
         setTimeout(function() {
            let str = '<DIV class="chartControls">';
            if (that._selectOptions != null)
             {
               str+='<SELECT id="'+that._divId+'_SELECT">';
               for (let i = 0; i < that._selectOptions.length; ++i)
                str+='<OPTION value="'+that._selectOptions[i].val+'" '+(i==0?'selected':'')+'>'+that._selectOptions[i].label+'</OPTION>';
               str+='</SELECT>';
             }
            if (that._chartOptions?.length > 0)
             {
               let option = that._chartOptions.getSE(that._selectedChartOption, "val");
               str+='&nbsp;&nbsp;&nbsp;<SPAN id="'+that._divId+'_CHART_TYPES" style="cursor:pointer;">'+option.svgIcon+'</SPAN>';
             }
            str+= '</DIV>'
                 +'<DIV id="'+that._divId+'_ACTIONS" class="chartActions">'
                 ;
            if (that._actions != null)
             {
               for (let i = 0; i < that._actions.length; ++i)
                str+='<IMG id="'+that._divId+'_ACTIONS_'+that._actions[i].id+'" data-id="'+that._actions[i].id+'" src="'+that._actions[i].img+'" title="'+that._actions[i].title+'">';
             }
            str+= '</DIV>'
                 +'<CANVAS id="'+that._divId+'_CNVS" style=""></CANVAS>'
                 ;
            e.innerHTML = str;
            
            if (that._chartOptions?.length > 0)
             {
               let chartTypeMarkup = function()
                {
                  let str = '<TABLE class="tableLayout rowHighlightable">';
                  for (let i = 0; i < that._chartOptions.length; ++i)
                   str+='<TR data-charttype="'+that._chartOptions[i].val+'"><TD class="'+(that._chartOptions[i].val==that._selectedChartOption?"menuItem selected" : "menuItem")+'">'
                         +that._chartOptions[i].svgIcon+'&nbsp;&nbsp;'+that._chartOptions[i].label
                       +'</TD></TR>';
                  str+='</TABLE>';
                  return str;
                }
               var dropDown = new FloriaTooltipDialog(that._divId+"_CHART_TYPES", chartTypeMarkup(), null, null, "chartTypeMenu");
               FloriaDOM.addEvent(dropDown.getTooltipDiv(), "click", function(e, event, target) {
                 target = target.closest('TR');
                 if (target == null)
                  return;
                 let option = target.dataset.charttype;
                 if (option != null && option != that._selectedChartOption)
                  {
                    option = that._chartOptions.getSE(option, "val");
                    document.getElementById(that._divId+'_CHART_TYPES').innerHTML = option.svgIcon;
                    that._selectedChartOption = option.val;
                    dropDown.setContents(chartTypeMarkup());
                    that._chartOnChange(option);
                  }
               });               
             }

            that._chart = new FloriaCharts2.ChartJS(document.getElementById(that._divId+'_CNVS'), config);
            CHART_REGISTRY[that._divId] = that._chart;
            if (that._selectOptions != null)
             FloriaDOM.addEvent(that._divId+"_SELECT", "change", function(e, event, target) {
                let v = e.value;
                let o = v == null ? that._selectOptions[0]
                                  : that._selectOptions.getSE(v, "val");
                that._selectOnChange(o);
             }, null, true);
            if (that._actions != null)
             FloriaDOM.addEvent(that._divId+"_ACTIONS", "click", function(e, event, target) {
                if (target.nodeName.toUpperCase() != 'IMG')
                 return;
                that._actionsFunc(that._actions.getSE(target.dataset.id, "id"));
             }, null, true);
          }, 1);
       }
    }
    
   this.destroy=function()
    {
      if (this._chart != null)
       {
         this._chart.destroy();
         delete CHART_REGISTRY[this._divId];
       }
    }    
};

