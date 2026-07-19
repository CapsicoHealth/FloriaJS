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

import { FloriaCollections } from "./module-collections.js";

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// String extensions
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if (!String.prototype.trim)
  String.prototype.trim = function()
  {
    return this.replace(TextUtil.REGEX_TRIM, "");
  };

if (!String.prototype.endsWith)
  String.prototype.endsWith = function(str)
  {
    return this.match(str + "$") != null;
  };

if (!String.prototype.startsWith)
  String.prototype.startsWith = function(str)
  {
    return this.match("^" + str) == str;
  };

if (!String.prototype.hashValue)
String.prototype.hashValue = function()
 { // taken from https://github.com/darkskyapp/string-hash/blob/master/index.js
    var hash = 5381;
    var i    = str.length;
    while(i)
      hash = (hash * 33) ^ str.charCodeAt(--i)
  
    /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
     * integers. Since we want the results to be always positive, convert the
     * signed int to an unsigned by doing an unsigned bitshift. */
    return hash >>> 0;
 }

if (!String.prototype.isEmpty)
  String.prototype.isEmpty = function()
  {
    for (var i = 0; i < this.length; ++i)
    {
      var c = this[i];
      if (c != ' ' && c != '\t' && c != '\n' && c != '\r')
        return false;
    }
    return true;
  };

if (!String.prototype.printFuncParam)
  String.prototype.printFuncParam = function()
  {
    return this.replace(TextUtil.REGEX_SL, "\\\\").replace(TextUtil.REGEX_DQ, "&quot;").replace(TextUtil.REGEX_SQ, "\\\'");
  };

if (!String.prototype.printHtmlAttrValue)
  String.prototype.printHtmlAttrValue = function()
  {
    return this.replace(TextUtil.REGEX_SL, "\\\\").replace(TextUtil.REGEX_DQ, "&quot;");
  };

if (!String.prototype.highlight)
  String.prototype.highlight = function(Regex, ClassName)
  {
    return this.replace(Regex, '<SPAN class="' + ClassName + '">$1</SPAN>');
  }
if (!String.prototype.getMatchList)
  String.prototype.getMatchList = function(Regex)
    {
      var MatchList = new FloriaCollections.SortedStringArray();
      while (true)
       {
         var Matches = Regex.exec(this);
         if (Matches == null)
          break;
         MatchList.add(Matches[1]);
       }
      return MatchList.A;
    }

if (!String.prototype.capitalizeAll)
  String.prototype.capitalizeAll = function()
    {
      return this.toLowerCase().replace(/\b\w/g, function(char) { return char.toUpperCase()});
    }
    
if (!String.prototype.capitalizeFirstLetter)
 String.prototype.capitalizeFirstLetter = function()
    {
      if (this.length == 0)
       return this;
      return this.trim().charAt(0).toUpperCase() + this.slice(1);
    }

var TextUtil = {
  REGEX_DQ : /\"/g
 ,REGEX_SQ : /\'/g
 ,REGEX_SL : /\\/g
 ,REGEX_SPACES : /\s/g
 ,REGEX_TRIM : /^\s+|\s+$/g
 ,REGEX_NL : /\s*(\r\n|(\n?)<\s*\/?\s*BR\s*>|\n|\\n)\s*/g
 ,spanNA   : '<SPAN class="NA"></SPAN>'
 ,printFuncParam : function(Str)
   {
     return Str == null ? "" 
          : typeof Str == "string" ? Str.printFuncParam()
          : Str;
   }
 ,isNullOrEmpty : function(Str)
   {
     return  Str == null ? true 
           : Array.isArray(Str) == true && Str.length == 0 ? true 
           : typeof Str == "string" ? Str.isEmpty() 
           : false; // Must be some object... Should test if object has no properties? Maybe a deep test? Performance issues here perhaps.
   }
 ,print : function(val, def, maxCount, sep)
   {
     if (TextUtil.isNullOrEmpty(def) == true)
      def = TextUtil.spanNA;
     if (Array.isArray(val) == false)
      return TextUtil.isNullOrEmpty(val) == true ? def : (maxCount != null && val.length > maxCount ? val.substring(0, maxCount)+"..." : val);
     if (maxCount == null || maxCount < 2 || maxCount > val.length)
      maxCount = val.length;
     if (sep == null)
      sep = ", ";
     var Str = "";
     for (var i = 0; i < maxCount; ++i)
      {
        if (TextUtil.isNullOrEmpty(val[i]) == true)
         continue;
        if (Str.length != 0)
         Str+=sep;
        Str+=val[i];
      }
     if (maxCount < val.length && Str.length > 0)
      Str+="...";
     return Str.length==0?def:Str;
   }
 ,replaceNewLinesWithBreaks : function(Str, paragraphIndent)
   {
     var indent = paragraphIndent == false ? "" : "&nbsp;&nbsp;&nbsp;";
     return Str == null ? "" : indent+Str.replaceAll(TextUtil.REGEX_NL, "\n<BR>"+indent);
   }
  ,replaceNewLinesWithParagraphs : function(Str)
   {
     return Str == null ? "" : "<P>"+Str.replaceAll(TextUtil.REGEX_NL, "</P>\n<P>")+"</P>";
   }
 ,replaceNewLinesWithSpaces : function(Str)
   {
     return Str == null ? "" : Str.replace(TextUtil.REGEX_NL, " ");
   }
 ,replaceNewLinesWithCommas : function(Str)
   {
     return Str == null ? "" : Str.replace(TextUtil.REGEX_NL, ", ");
   }
 ,replaceSpacesWithNBSPs : function(Str)
   {
     return Str == null ? "" : Str.replace(StringProcessor.REGEX_SPACES, "&nbsp;");
   }
 ,REGEX_DictMatch : /\[\^([^\^]*)``\^\]/g
 ,dictionaryMatchHighlight : function(Str, ClassName)
   {
     return Str == null ? "" : Str.highlight(TextUtil.REGEX_DictMatch, ClassName);
   }
 ,printHtmlAttrValue: function(Str)
   {
     return Str == null ? "" : Str.printHtmlAttrValue();
   }
 ,printJsonWithHighlights: function(obj)
   {
     if (typeof obj != 'string')
      obj = JSON.stringify(obj, undefined, 2);
      
     obj = obj.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     return obj.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'json_number';
        if (/^"/.test(match))
         if (/:$/.test(match))
          cls = 'json_key';
         else
          cls = 'json_string';
        else if (/true|false/.test(match))
         cls = 'json_boolean';
        else if (/null/.test(match))
         cls = 'json_null';
        return '<span class="' + cls + '">' + match + '</span>';
      });
   }
 ,escapeRegExpChars: function(str)
   {
     return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
   }
 ,getSemanticCheckbox: function(status, classNamePrefix)
   {
     if (classNamePrefix == null)
      classNamePrefix="semanticCheckbox";

     return status ==  0 ? '<B class="'+classNamePrefix+'None">&#9744;</B>'
           :status ==  1 ? '<B class="'+classNamePrefix+'Yes" >&#9745;</B>'
           :status == -1 ? '<B class="'+classNamePrefix+'No"  >&#9746;</B>'
           :TextUtil.spanNA;
   }
 ,getBooleanCheckbox: function(status, fontSize)
   {
     return status ==  0 ? '<B style="color:red  ;font-size:'+(fontSize==null?"120%":fontSize)+';">&#9746;</B>'
           :status ==  1 ? '<B style="color:green;font-size:'+(fontSize==null?"120%":fontSize)+';">&#9745;</B>'
           :TextUtil.spanNA;
   }
 ,multiple: function(base, count)
   {
     let str = '';
     for (let i = 0; i < count; ++i)
      str+=base;
     return str;
   }
 ,toSha256: async function(str)
   {
     // Encode the string as a Uint8Array and generate a SHA-256 hash
     const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
     // Convert the hash to a 64-bit integer
     const hashArray = new Uint8Array(hashBuffer);
     let hashInt = BigInt(0);
     for (let i = 0; i < 8; i++) // Use the first 8 bytes for a 64-bit integer
       hashInt = (hashInt << BigInt(8)) | BigInt(hashArray[i]);
     return hashInt;
   }
 ,_HTML_PATTERN_REGEX: /<(?!br\b|hr\b)([a-z][\w-]*)\b[^>]*>.*?<\/\1>|<(?!br\b|hr\b)[a-z][\w-]*\s*\/?>|&[a-z]+;/i
 ,isHtmlContent: function(content)
   {
     return TextUtil._HTML_PATTERN_REGEX.test(content);
   }
 ,escapeHTML: function(str)
   {
     const div = document.createElement('div');
     div.textContent = str;
     return div.innerHTML;
   }
 ,formatPhone: function(raw)
   {
     if (raw == null) return '—';
     const digits = raw.replace(/\D/g, '');
     if (digits.length === 10)
      return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6);
     if (digits.length === 11 && digits[0] === '1')
      return '(' + digits.slice(1,4) + ') ' + digits.slice(4,7) + '-' + digits.slice(7);
     return raw;
   }
 };


  var NumberUtil = {
    leadingZero1: function(X)
      {
        return X >= 10 || X <= -10 ? X 
             : X >= 0 ? "0"+X 
             : "-0"+(-X);
      },
    leadingZero2: function(X)
      {
        return X >= 100 || X <= -100 ? X 
             : X > -100 && X <= -10 ? "-0"+(-X)
             : X > -10 && X < 0 ? "-00"+(-X) 
             : X >= 0 && X < 10 ? "00"+X
             : "0"+X;
      },
    leadingZero3: function(X)
      {
        return X >=  1000 || X <= -1000 ? X 
             : X >  -1000 && X <=  -100 ?   "-0"+(-X) 
             : X >   -100 && X <=   -10 ?  "-00"+(-X)
             : X >    -10 && X <      0 ? "-000"+(-X) 
             : X >=     0 && X <     10 ?  "000"+X
             : X >=    10 && X <    100 ?   "00"+X
             : "0"+X;
      },
    leadingZero4: function(X)
      {
        return X >=  10000 || X <= -10000 ? X 
             : X >  -10000 && X <=  -1000 ? "-0"+(-X) 
             : X >  -1000  && X <=  -100  ? "-00"+(-X) 
             : X >   -100  && X <=   -10  ? "-000"+(-X)
             : X >    -10  && X <      0  ? "-0000"+(-X) 
             : X >=     0  && X <     10  ? "0000"+X
             : X >=    10  && X <    100  ? "000"+X
             : X >=   100  && X <   1000  ? "00"+X
             : "0"+X;
      },
    leadingZeroes: function(intValue, maxDigits)
      {
        return String(intValue).padStart(maxDigits, '0');
      },
      
    printWith0Dec : function(n)
    {
      return Math.round(n);
    },
    printWith1Dec : function(n)
    {
      return Math.round(n * 10) / 10.0;
    },
    printWith2Dec : function(n)
    {
      return Math.round(n * 100) / 100.0;
    },
    printWith3Dec : function(n)
    {
      return Math.round(n * 1000) / 1000.0;
    },
    printWith4Dec : function(n)
    {
      return Math.round(n * 10000) / 10000.0;
    },
    printPercentWith0Dec : function(Total, Sub, inverse)
    {
      return NumberUtil.printWith0Dec(inverse==true?100 - 100.0 * ((Sub * 1.0) / (Total * 1.0)) : 100.0 * ((Sub * 1.0) / (Total * 1.0)));
    },
    printPercentWith1Dec : function(Total, Sub)
    {
      return NumberUtil.printWith1Dec(100.0 * ((Sub * 1.0) / (Total * 1.0)));
    },
    printPercentWith2Dec : function(Total, Sub)
    {
      return NumberUtil.printWith2Dec(100.0 * ((Sub * 1.0) / (Total * 1.0)));
    },
    printPercentWith3Dec : function(Total, Sub)
    {
      return NumberUtil.printWith3Dec(100.0 * ((Sub * 1.0) / (Total * 1.0)));
    },
    printPerformancePerSecondWith1Dec : function(DurationMillis, Count)
    {
      return NumberUtil.printWith1Dec(1000.0 * Count / DurationMillis);
    },
    printPerformancePerSecondWith2Dec : function(DurationMillis, Count)
    {
      return NumberUtil.printWith2Dec(1000.0 * Count / DurationMillis);
    },
    printPerformancePerMillisWith1Dec : function(DurationMillis, Count)
    {
      return NumberUtil.printWith1Dec(1.0 * Count / DurationMillis);
    },
    printPerformancePerMillisWith2Dec : function(DurationMillis, Count)
    {
      return NumberUtil.printWith2Dec(1.0 * Count / DurationMillis);
    },
    printWithThousands : function(n)
    {
      return n == null ? "N/A" : n.toLocaleString();
    },
    printWithThousands0Dec : function(n)
    {
      return n == null ? "N/A" : Math.round(n).toLocaleString();
    },
    printWithThousands1Dec : function(n)
    {
      return n == null ? "N/A" : NumberUtil.printWith1Dec(n).toLocaleString();
    },
    printWithThousands2Dec : function(n)
    {
      return n == null ? "N/A" : NumberUtil.printWith2Dec(n).toLocaleString();
    },
    printWithThousands3Dec : function(n)
    {
      return n == null ? "N/A" : NumberUtil.printWith3Dec(n).toLocaleString();
    },
    printWithThousands4Dec : function(n)
    {
      return n == null ? "N/A" : NumberUtil.printWith4Dec(n).toLocaleString();
    },
    printDuration : function(millis)
    {
      var hours = Math.floor(millis /(1000.0*60*60));
      millis = millis - hours*60*60*1000;
      var minutes = Math.floor(millis/(1000.0*60));
      millis = millis - minutes*60*1000;
      var seconds = Math.floor(millis/(1000.0));

      var Str = "";
      if (hours >= 1)
        Str+= hours+"h";
      if (minutes >= 1)
        Str+= " "+minutes+"mn";
      if (seconds >= 1)
        Str+= " "+seconds+"s";
      if (Str == "")
        {
          millis = millis - seconds*1000;
          Str+=millis+" ms";
        }
      
      return Str;
    },
   printDataSize: function(bytes)
    {
      return bytes < 1024           ? NumberUtil.printWithThousands0Dec(bytes)+' B'
           : bytes < 1024*1024      ? NumberUtil.printWithThousands2Dec(bytes/1024.0)+' KB'
           : bytes < 1024*1024*1024 ? NumberUtil.printWithThousands2Dec(bytes/(1024.0*1024.0))+' MB'
           : NumberUtil.printWithThousands2Dec(bytes/(1024.0*1024.0*1024.0))+' GB'
    }
  }

  var MetricUtil = {
    printWithMetric : function(num, digits) {
       num = +num;
         var si = [
        { value: 1E18, symbol: "E" },
        { value: 1E15, symbol: "P" },
        { value: 1E12, symbol: "T" },
        { value: 1E9,  symbol: "G" },
        { value: 1E6,  symbol: "M" },
        { value: 1E3,  symbol: "K" },
        { value: 1,  symbol: "" }
      ], i;
      for (i = 0; i < si.length; i++) {
        if (num >= si[i].value) {
          return (num / si[i].value).toFixed(digits).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1") + si[i].symbol;
        }
      }
//      console.log("num: "+num+"; typeof: "+ (typeof num));
      return num.toFixed(digits).toString();
    },
    printWithCurrencyMetric : function(num, digits, curr='$') {
     num = +num;
     var si = [
       { value: 1E12, symbol: "T" },
       { value: 1E9,  symbol: "B" },
       { value: 1E6,  symbol: "M" },
       { value: 1E3,  symbol: "K" },
       { value: 1,  symbol: "" }
     ], i;
     for (i = 0; i < si.length; i++) {
       if (num >= si[i].value) {
         return curr+(num / si[i].value).toFixed(digits).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1") + si[i].symbol;
       }
     }
//     console.log("num: "+num);
     return curr+num.toFixed(digits).toString();
   }
  }

export var FloriaTextUtil = TextUtil;
export var FloriaNumberUtil = NumberUtil;
export var FloriaMetricUtil = MetricUtil;

export var FloriaText = {
    "TextUtil" : TextUtil
   ,"NumberUtil" : NumberUtil
   ,"MetricUtil" : MetricUtil
   ,"isNoE": TextUtil.isNullOrEmpty
   ,"print": TextUtil.print
   ,"printFuncParam":TextUtil.printFuncParam
   ,"printHtmlAttrValue":TextUtil.printHtmlAttrValue
   ,"replaceNewLinesWithBreaks": TextUtil.replaceNewLinesWithBreaks
   ,"replaceNewLinesWithParagraphs":TextUtil.replaceNewLinesWithParagraphs
   ,"spanNA":TextUtil.spanNA
   ,"multiple":TextUtil.multiple
   ,"toSha256": TextUtil.toSha256
   ,"isHtmlContent": TextUtil.isHtmlContent
   ,"escapeHTML":TextUtil.escapeHTML
   ,"printWithThousands": NumberUtil.printWithThousand
   ,"printWithThousands0Dec": NumberUtil.printWithThousands0Dec
   ,"printWithThousands1Dec": NumberUtil.printWithThousands1Dec
   ,"printWithThousands2Dec": NumberUtil.printWithThousands2Dec
   ,"printWithThousands3Dec": NumberUtil.printWithThousands3Dec
   ,"printWithThousands4Dec": NumberUtil.printWithThousands4Dec
   ,"printWith1Dec": NumberUtil.printWith1Dec
   ,"printWith2Dec": NumberUtil.printWith2Dec
   ,"printWith3Dec": NumberUtil.printWith3Dec
   ,"printWith4Dec": NumberUtil.printWith4Dec
   ,"printDuration": NumberUtil.printDuration
   ,"leadingZeroes": NumberUtil.leadingZeroes
   ,"formatPhone": TextUtil.formatPhone
  };
