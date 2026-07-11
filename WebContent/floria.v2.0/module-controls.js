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

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Radio buttons and check boxes and dropdowns and...
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import { FloriaDOM } from "./module-dom.js";
import { FloriaText } from "./module-text.js";

  
function defaultEdgeFunc()
 {
   return "";
 }


function tableEdgeFunc(columnsCount, classNames)
 { 
    if (classNames == null)
     classNames = "";
    if (columnsCount == null)
     columnsCount = 4;
    var width=Math.floor(100/columnsCount)+"%";
    return function(i, before, count, tdExtras, doWrap)
     {
        if (doWrap == true)
         return columnsCount - i%columnsCount;
        if (tdExtras == null)
         tdExtras = "";
        if (i == null && before == null) // This is a forced break
         return '</TR>';

        if (before == true)
         return i == 0                    ? '<TABLE align="left" border="0px" cellpadding="0px" cellspacing="0px" width="98%" class="'+classNames+'"><TR><TD width="'+width+'" '+tdExtras+'>' 
              : i!=0 && i%columnsCount==0 ? '<TR valign="top"><TD width="'+width+'" '+tdExtras+'>'
                                          : '<TD width="'+width+'" '+tdExtras+'>' ;
        else if (i == count-1)
          {
            var Str = '</TD>';
            while (i % columnsCount != columnsCount-1)
              {
                Str+='<TD width="'+width+'">&nbsp;</TD>';
                ++i;
              }
            return Str+'</TR></TABLE>\n';
          }
        else
         return i % columnsCount == columnsCount-1 ? '</TD></TR>' : '</TD>';
      };
};

function makeRelIds(elementId)
 {
   var isArray = Array.isArray(elementId); 
   var formId = isArray == false ? null : elementId[0];
   if (isArray == true)
    elementId = elementId[1];
   return {formId: formId, elementId: elementId, fullId: formId+'_'+elementId};
 }

var Radio = {
  header : function(Values, Before, After)
    {
      var Str = '';
      for (var i = 0; i < Values.length; ++i)
        Str += Before + Values[i][1] + After + '\n';
      return Str;
    },
  gen : function(ContainerId, elementId, Values, edgeFunc, onChange, Default, Mode, noLabels, readOnly)
    {
      if (edgeFunc == null)
       edgeFunc = defaultEdgeFunc;
      if (Default != null && Default.indexOfSE != null)
        Default = Default.length == 0 ? null : Default[0];
      var Ids = makeRelIds(elementId);
      var Str = '<INPUT id="'+Ids.fullId+'" name="' + Ids.elementId + '"'
      if (Default != null)
        Str += ' value="' + Default + '"';
      Str += ' type="hidden">';
      if (readOnly != true)
       {
         var totalValidElements = 0;
         for (var i = 0; i < Values.length; ++i)
          if (Values[i] != null)
           ++totalValidElements;
         var counter = 0;
         var cells = 0;
         for (var i = 0; i < Values.length; ++i)
          {
            var v = Values[i];
            if (v != null)
             {
               var fullId = Ids.fullId+'_'+counter;
               Str += edgeFunc(cells, true, totalValidElements) 
                   + '<A id="RADIO_'+fullId+'" class="Radio_' + (Default == v[0] ? 'ON' : 'OFF')
                   + '" title="' + (v.length > 2 && v[2]!=null?v[2]:v[1]) 
                   + '" href="javascript:Radio.click([\'' + Ids.formId + '\',\'' + Ids.elementId + '\'], \'' + v[0] + '\', \'RADIO_' + fullId
                   + '\', ' + onChange + ',' + Mode + ');' + '">' + (noLabels == true ? '&nbsp;' : v[1]) + '</A>' 
                   + edgeFunc(cells, false, totalValidElements) + '\n';
               ++counter;
               ++cells;
             }
            else
             {
               Str+=edgeFunc(null, null, totalValidElements);
               var x = edgeFunc(cells, null, totalValidElements, null, true); // advance to first cell of next row.
               totalValidElements+=x;
               cells += x;
             }
          }
       }
      else 
        for (var i = 0; i < Values.length; ++i)
          {
            var v = Values[i];
            if (Default != v[0])
              continue;
            var fullId = Ids.fullId+'_'+i;
            Str += '<B>'+v[1]+'<B>';
          }
      if (ContainerId == null)
        return Str;
      FloriaDOM.setInnerHTML(ContainerId, Str);
    },
  click : function(elementId, Value, TriggerId, onChange, Mode)
    {
      var Ids = makeRelIds(elementId);
      var e = document.getElementById(Ids.fullId);
      if (e == null)
        return;
      if (e.value == Value && Mode == null)
       {
         e.value = '';
         var t = document.getElementById(TriggerId);
         t.className = t.className.split("_")[0] + "_OFF";
       }
      else
       {
         e.value = Value;
         var t = document.getElementById(TriggerId);
         var ClassName = t.className.split("_")[0];
         t.className = ClassName + "_ON";
         ClassName = ClassName + "_OFF";
         for (var i = 0; i < 100; ++i)
          {
            var r = document.getElementById("RADIO_" + Ids.fullId + "_" + i);
            if (r == null)
             break;
            if (r.className == t.className && r != t)
             {
               r.className = ClassName;
               break;
             }
          }
       }
      if (onChange != null)
       onChange(Ids.fullId, e.value);
      else if (e.form != null)
        FloriaDOM.fireEvent(e.form, "change");         
    },
  get : function(elementId)
    {
      var Ids = makeRelIds(elementId);
      var e = document.getElementById(Ids.fullId);
      return e == null || FloriaText.TextUtil.isNullOrEmpty(e.value) ? null : e.value;
    }
};

var Dropdown = {
  gen : function(ContainerId, elementId, Values, firstEmpty, onChange, Default, Multiple, size)
    {
      var Ids = makeRelIds(elementId);
      var Str = '<SELECT id="'+Ids.fullId+'" name="' + Ids.elementId + '"';
      if (onChange != null)
        Str += ' onChange="' + onChange + '"';
      if (Multiple == true)
       {
         Str += ' multiple';
         if (size == null)
          size = Values.length >= 10 ? 10 : Values.length;
         else if (size > Values.length)
          size = Values.length;
         Str+= ' size="'+size+'"';
       }
      Str += '>';
      if (firstEmpty == true)
        Str += '<OPTION value=""></OPTION>';
      for (var i = 0; i < Values.length; ++i)
       {
         var v = Values[i];
         Str += '<OPTION ' + (Default == v[0] ? 'selected' : '') + ' value="' + v[0] + '">' + v[1] + '</OPTION>';
       }
      Str += '</SELECT>';
      if (ContainerId == null)
        return Str;
      FloriaDOM.setInnerHTML(ContainerId, Str);
    },
  get : function(elementId)
    {
      var Ids = makeRelIds(elementId);
      var e = document.getElementById(Ids.fullId);
      if (e.multiple == true)
        {
        var a = [];
        for (var i = 0; i < e.options.length; ++i)
         if (e.options[i].selected==true)
          a.push(e.options[i].value);
        return a;
        }
       else
        return e.selectedIndex == -1 ? null : e.options[e.selectedIndex].value;
    },
  set : function(elementId, Value)
    {
      var Ids = makeRelIds(elementId);
      var e = FloriaDOM.getElement(Ids.fullId, "Cannot find element "+Ids.fullId+".");
      var o = e.options;
      for (var i = 0; i < o.length; ++i)
        if (o[i].value == Value || o[i].label == Value || o[i].text == Value)
        {
          e.selectedIndex = i;
          return;
        }
    }
};

var Checkbox = {
  header : Radio.header,
  gen : function(ContainerId, elementId, Values, edgeFunc, onChange, Defaults, noLabels)
    {
      if (edgeFunc == null)
       edgeFunc = defaultEdgeFunc;
      
      if (Defaults != null && Defaults.indexOfSE == null)
        Defaults = [ Defaults ];
      
      var Ids = makeRelIds(elementId);
      var Str = '';

      var noneItem = null;
      for (var i = 0; i < Values.length; ++i)
        {
          var v = Values[i];
          if (v != null && v[3] == "1")
           {
             noneItem = i;
             break;
           }
        }

      var totalValidElements = 0;
      for (var i = 0; i < Values.length; ++i)
       if (Values[i] != null)
         ++totalValidElements;
      var counter = 0;
      var cells = 0;
      for (var i = 0; i < Values.length; ++i)
       {
         var v = Values[i];
         if (v != null)
          {
//            console.log("cells-within: "+cells);
            var match = Defaults != null && Defaults.indexOfSE(v[0]) != -1;
            var fullId = Ids.fullId + '_' + counter;
            Str += edgeFunc(cells, true, totalValidElements) 
                + '<A href="javascript:Checkbox.click([\'' + Ids.formId + '\',\'' + Ids.elementId+'_'+counter+ '\'], ' 
                + onChange + ',' + noneItem +');' + '" id="CHECKBOX_'
                + fullId + '" class="Checkbox_' + (match ? 'ON' : 'OFF') + '" title="' + (v.length > 2 && v[2]!=null?v[2]:v[1]) + '"><INPUT id="' + fullId
                + '" name="' + Ids.elementId + v[0] + '" type="hidden" value="' + (match ? '1' : '0') + '">' + (noLabels == true ? '' : v[1])
                + '</A>'
                + edgeFunc(cells, false, totalValidElements) + '\n';
            ++counter;
            ++cells;
          }
         else
          {
            Str+=edgeFunc(null, null, totalValidElements);
            var x = edgeFunc(cells, null, totalValidElements, null, true); // advance to first cell of next row.
            totalValidElements+=x;
            cells += x;
          }
       }
      if (ContainerId == null)
        return Str;
      FloriaDOM.setInnerHTML(ContainerId, Str);
    },
  flipNotNoneItems: function(fullId, grey)
   {
     var under = fullId.lastIndexOf("_");
     if (under != -1)
       {
         var rootElementId = fullId.substring(0, under);
         for (var i = 0; i < 50; ++i)
           {
             var id = rootElementId + "_" + i;
             if (id == fullId)
              continue;
             var r = FloriaDOM.getElement(id);
             if (r == null)
              break;
             r.parentNode.className = r.parentNode.className.split("_")[0] + (grey==true ? "_GREY" : "_OFF");
             r.value = 0;
           }
       }
   },
  click : function(elementId, onChange, noneItem)
    {
      var Ids = makeRelIds(elementId);
      var e = FloriaDOM.getElement(Ids.fullId);
      if (e == null)
        return;
      if (e.parentNode.className.endsWith("_GREY") == true)
       return;
      var i = Ids.fullId.lastIndexOf("_");
      if (i != -1)
       i = +Ids.fullId.substring(i+1);

      if (e.value != 0)
       {
         var c = e.parentNode.className;
         if (c.endsWith("_ON") == false)
          return;
         e.parentNode.className = c.split("_")[0] + "_OFF";
         e.value = 0;
         if (i == noneItem)
           Checkbox.flipNotNoneItems(Ids.fullId, false);
         var under = Ids.fullId.lastIndexOf("_");
         if (under != -1)
           {
             var rootElementId = Ids.fullId.substring(0, under);
             var activeCount = 0;
             for (var i = 0; i < 100; ++i)
               {
                 // we are iterating till we find nothing, so if we called FloriaDOM
                 // we'd get a warning in the logs which would be OK in this case. So
                 // let's go plain vanilla here.
                 var r = document.getElementById(rootElementId + "_" + i);
                 if (r == null)
                  break;
                 if (r.value == 1)
                  ++activeCount;
               }
             if (activeCount == 0)
               {
                 // Same argument here as per above... Plain Vanilla since mostly always expected.
                 var r = document.getElementById(rootElementId + "_" + noneItem);
                 if (r != null)
                   {
                     r.parentNode.className = r.parentNode.className.split("_")[0] + "_OFF";
                     r.value=0;
                   }
               }
           }
       }
      else
       {
         var c = e.parentNode.className;
         if (c.endsWith("_OFF") == false)
          return;
         e.parentNode.className = c.split("_")[0] + "_ON";
         e.value = 1;
         if (i == noneItem)
          Checkbox.flipNotNoneItems(Ids.fullId, true);
         else // this is not a noneItem, so we have to grey out the noneItem
           {
             var r = Ids.fullId.lastIndexOf("_");
             if (r != -1)
              {
                r = Ids.fullId.substring(0, r);
                // most expected, so plain vanilla here and no FloriaDOM.getElement as per above.
                r = document.getElementById(r + "_" + noneItem);
                if (r != null)
                  {
                    r.parentNode.className = r.parentNode.className.split("_")[0] + "_GREY";
                    r.value = 0;
                  }
              } 
           }
       }
      if (onChange != null)
       onChange(Ids.fullId, e.value);
      else if (e.form != null)
       FloriaDOM.fireEvent(e.form, "change");         
      
    },
  get : function(elementId)
    {
      var Ids = makeRelIds(elementId);
      var vals = [];
      for (var i = 0; i < 100; ++i)
      {
        var r = document.getElementById(Ids.fullId + "_" + i);
        if (r == null)
          break;
        if (r.value != 0)
         vals.push(r.name.substring(Ids.elementId.length));
      }
      return vals;
    }
};

var GeneralControl = {
    get : function(elementId, optional)
     {
       var Ids = makeRelIds(elementId);
       var e = document.getElementById(Ids.fullId);
       if (e == null)
        e = document.getElementById(Ids.fullId+"_0");
       if (e != null)
        {
          if (e.tagName == "INPUT" && e.type == "hidden")
           {
             if (e.id == Ids.fullId)
              {
                var v = Radio.get([Ids.formId, Ids.elementId]);
                return FloriaText.TextUtil.isNullOrEmpty(v) == true ? [] : [v];
              }
             return Checkbox.get([Ids.formId, Ids.elementId])
           }
          else if (e.tagName == "INPUT" && (e.type=="text" || e.type=="number") || e.tagName == "TEXTAREA")
           {
             return [e.value];
           }
          else if (e.tagName == "SELECT")
           {
             var res = Dropdown.get([Ids.formId, Ids.elementId]);
             return e.multiple == false ? [res]:res;
           }
        }

       if (optional != true)
         FloriaDOM.consoleThrow("Cannot find Control element "+Ids.fullId);

       return [];
     },
    makeUrlParams: function(paramDefs)
     {
       var error = false;
       var urlParams = "";
       for (var i = 0; i < paramDefs.length; ++i)
        {
          var p = paramDefs[i];
          var val = GeneralControl.get(p.id);
          if (p.mandatory == true && (val == null || val.length == 0 || FloriaText.TextUtil.isNullOrEmpty(val[0]) == true))
           {
             var Ids = makeRelIds(p.id);
             var e = FloriaDOM.getElement(Ids.fullId);
             if (e == null)
              {
                e = FloriaDOM.getElement(Ids.fullId+"_0");
                if (e != null)
                 e = e.parentNode;
              }
             FloriaDOM.addCSSToParent(e, "ErrorMessage");
             error = true;
           }
          if (val != null)
           for (var j = 0; j < val.length; ++j)
          urlParams+="&"+p.name+"="+escape(val[j]);
        }
       return error == true ? null : urlParams;
     }
};

var Rating = {
  gen : function(ContainerId, ElementId, label, maxValue, onChange, Default)
    {
      var Str = '<INPUT id="' + ElementId + '" name="' + ElementId + '"'
      if (Default != null)
        Str += ' value="' + Default + '"';
      Str += ' type="hidden"><SPAN id="' + ElementId + '_STARS" class="RatingStars">';
  
      for (var i = 1; i <= maxValue; ++i)
      {
        var match = Default != null && i <= Default;
        Str += '<A href="javascript:Rating.click(\'' + ElementId + '\', ' + i + ', ' + maxValue + ', ' + onChange + ', \'' + onChange
            + '\');' + '"><IMG src="/static/img/star' + (match == true ? "On" : "Off") + '.gif"></A>\n';
      }
      Str += '</SPAN><SPAN class="RatingLabel">' + label + '</SPAN>';
      if (ContainerId == null)
        return Str;
      FloriaDOM.setInnerHTML(ContainerId, Str);
    },
  click : function(ElementId, v, maxValue, onChange, onChangeStr)
    {
      var e = document.getElementById(ElementId);
      if (e == null)
        return;
      e.value = v;
      var Str = "";
      for (var i = 1; i <= maxValue; ++i)
      {
        var match = i <= v;
        Str += '<A href="javascript:Rating.click(\'' + ElementId + '\', ' + i + ', ' + maxValue + ', ' + onChange + ');'
            + '"><IMG src="/static/img/star' + (match == true ? "On" : "Off") + '.gif"></A>\n';
      }
      FloriaDOM.setInnerHTML(ElementId + '_STARS', Str);
      if (onChange != null)
        onChange(ElementId);
    },
  get : function(ElementId)
    {
      var e = document.getElementById(ElementId);
      return e == null ? null : e.value;
    }
};

var Ranking = {
  gen : function(ContainerId, ElementId, Values, onChange, Defaults)
  {
    if (Defaults != null && typeof Defaults == "string")
     Defaults = Defaults.split(",");
    if (Defaults != null && typeof Defaults == "Array" && Defaults.length > 0)
      {
        for (var i = 0; i < Defaults.length; ++i)
           if (Values.getSE(Defaults[i], 0) == null)
            {
              Defaults = null;
              break;
            }
      }
    else
     Defaults = null;

    if (Defaults == null)
     {
       Defaults = [];
       for (var i = 0; i < Values.length; ++i)
        Defaults.push(Values[i][0]);
     }

    var Str = '<INPUT id="' + ElementId + '" name="' + ElementId + '" value="' + Defaults + '" type="hidden">'
             +'<SPAN id="' + ElementId + '_RANKING" class="Ranking">';
    for (var i = 0; i < Defaults.length; ++i)
    {
      var v = Values.getSE(Defaults[i], 0, "Cannot locate option XXX");
      var Prev = '<A href="javascript:Checkbox.click(\'' + ElementId + '\', '+i+', -1, ' + onChange + ');' + '"><IMG class="left" src="/static/img/arrow-left.gif"></A>';
      var Next = '<A href="javascript:Checkbox.click(\'' + ElementId + '\', '+i+',  1, ' + onChange + ');' + '"><IMG class="right" src="/static/img/arrow-right.gif"></A>';
      Str += (i==0?'':Prev) + '<SPAN id="'+ElementId+'_'+v[0]+'">'+v[1]+'</SPAN>' + (i==Values.length-1?'':Next) + '\n';
    }
    Str+='</SPAN>';
    if (ContainerId == null)
      return Str;
    FloriaDOM.setInnerHTML(ContainerId, Str);
  },
  click : function(ElementId, i, direction, onChange)
  {
    var e = document.getElementById(ElementId);
    //childNode[4].parentNode.insertBefore(childNode[4], childNode[3]);
    if (e == null)
      return;
    if (e.value != 0)
    {
      e.parentNode.className = e.parentNode.className.split("_")[0] + "_OFF";
      e.value = 0;
    }
    else
    {
      e.parentNode.className = e.parentNode.className.split("_")[0] + "_ON";
      e.value = 1;
    }
    if (onChange != null)
      onChange(ElementId);
  },
  get : function(ElementId)
  {
    var vals = [];
    for (var i = 0; i < 20; ++i)
    {
      var r = document.getElementById(ElementId + "_" + i);
      if (r == null)
        break;
      if (r.value != 0)
       vals.push(r.name.substring(ElementId.length));
    }
    return vals;
  }
};





function ComboBox(divId, elementId, values, placeholder, defaultValue, onChangeFunc, selectOnly=false)
 {
   let options = '';
   let defaultValueStr = null;
   if (defaultValue != null)
    defaultValue = defaultValue.toLowerCase();

   for (let i = 0; i < values.length; ++i)
    {
      let v = values[i];
      if (defaultValue == (""+v[0]).toLowerCase())
       defaultValueStr = selectOnly==true ? (v[1]||v[0]) : v.length>=2 ? v[1] : v[0];
      let title = v.length>=3 && v[2]!=null ? ' title="\n'+FloriaText.TextUtil.printHtmlAttrValue(v[2])+'"' : '';
      options+='  <LI data-value="'+v[0]+'" '+title+'>'+(v[1]||v[0])+'</LI>\n';
    }
      
   let Ids = makeRelIds(elementId);
   let str = '<SPAN class="floriaCombo">'
               +'<INPUT id="'+Ids.fullId+'" name="'+Ids.elementId+'" type="hidden" '+(defaultValue == null ? '' : ' value="'+FloriaText.TextUtil.printHtmlAttrValue(defaultValue)+'"')+'>\n'
               +(selectOnly==true?
                     '<SPAN contenteditable="'+(!selectOnly)+'" id="'+Ids.fullId+'_INPUT" onchange="event.stopPropagation(); return false;">'
                         +(defaultValueStr == null ? '' : defaultValueStr)
                    +'</SPAN>\n'
                   : 
                     '<INPUT id="'+Ids.fullId+'_INPUT" type="text" onchange="event.stopPropagation(); return false;"'
                         +'placeholder="'+(placeholder||'')+'"'
                         +(defaultValueStr == null ? '' : ' value="'+FloriaText.TextUtil.printHtmlAttrValue(defaultValueStr)+'"')
                    +'>\n'
                 )
               +'<UL id="'+Ids.fullId+'_OPTIONS" style="display:none;">\n'
               +options
               +'</UL></SPAN>\n'
            ;
   
   document.getElementById(divId).innerHTML = str;
   let valueElement = document.getElementById(Ids.fullId);
   let inputElement = document.getElementById(Ids.fullId+'_INPUT');
   let optionsDiv = document.getElementById(Ids.fullId+'_OPTIONS');

   let repaint = function()
    {
      valueElement.value = "";
      let val = (selectOnly==true ? inputElement.innerHTML : inputElement.value).trim().toLowerCase();
      val = new RegExp(".*"+FloriaText.TextUtil.escapeRegExpChars(val).replaceAll(/\s+/g, ".*")+".*");
      for (let i = 0; i < optionsDiv.children.length; ++i)
       {
         let li = optionsDiv.children[i];
         li.style.display= li.innerText.toLowerCase().search(val) >= 0 ? "" : "none";
       }
    };

   FloriaDOM.addEvent(inputElement, 'keyup', function() {
       repaint();
    }, 100, true);

   FloriaDOM.addEvent(inputElement, selectOnly==true?'click':'focus', function(e, event, target) {
//       let pos = FloriaDOM.getPos(inputElement);
//       console.log("pos: ", pos, "; inputElement.clientHeight: ", inputElement.clientHeight, "; inputElement.clientWidth: ", inputElement.clientWidth, ";");
//       optionsDiv.style.left = "5px"; // pos.left+"px";
//       optionsDiv.style.top  = "0px"; //(pos.top+inputElement.clientHeight)+"px";
       optionsDiv.style.width =  (inputElement.clientWidth-10)+"px";
       optionsDiv.style.display="";
    }, null, true);

   FloriaDOM.addEvent(inputElement, 'blur', function() {
       optionsDiv.style.display="none";
    }, 200, true);

   FloriaDOM.addEvent(optionsDiv, 'click', function(e, event, target) {
       optionsDiv.style.display="none";
       let val = target.dataset.value;
       if (val == null)
        return;
       valueElement.value = val;
       if (selectOnly == true)
        inputElement.innerHTML = target.innerHTML;
       else
        inputElement.value = target.innerText;
       if (onChangeFunc != null)
        {
//          console.log("COMBO --> call onChangeFunc")
          onChangeFunc(valueElement, val);
        }
       else
        {
//          console.log("COMBO --> call change on form if exists")
          let f = inputElement.closest("form");
          if (f != null)
           {
//             console.log("COMBO --> calling change on form")
             FloriaDOM.fireEvent(f, "change");
           }
          else
           {
//             console.log("COMBO --> could not find nearest form, so no onchange called!!")
           }
        }
    }, null, true);
    
    this.getValue = function()
     {
       return valueElement.value;
     }
    this.setValue = function(val)
     {
       if (val == null || val == valueElement.value)
        return;
       for (let i = 0; i < optionsDiv.children.length; ++i)
        {
          let o = optionsDiv.children[i];
          if (o.dataset.value == val)
           return FloriaDOM.fireEvent(o, 'click');
        }
     }
 }





window.Radio = Radio;
window.Dropdown = Dropdown;
window.Checkbox = Checkbox;
window.Rating = Rating;

export var FloriaControls = { "Radio": Radio
                            , "Dropdown": Dropdown
                            , "ComboBox": ComboBox
                            , "Checkbox": Checkbox
                            , "GeneralControl": GeneralControl
                            , "Rating": Rating
                            , "Ranking": Ranking
                            , "TableEdgeFunc": tableEdgeFunc
                            };
