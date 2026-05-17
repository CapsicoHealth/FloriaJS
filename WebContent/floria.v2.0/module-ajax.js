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

'use strict';

import { FloriaDOM } from "./module-dom.js";
import { FloriaLogin } from "./module-login.js";


const TypedArray = Object.getPrototypeOf(Uint8Array);

export var FloriaAjax = {

ajaxUrl: function(url, method, errorMsg, successFunc, errorFunc, postContents, timeout, handleAs, multipart)
  {
    let formData = null;
    if (postContents != null)
     {
        if (method != 'POST')
         return FloriaDOM.alertThrow("Error: you cannot post data in a non POST ajax request");
        
        if (typeof postContents == "string")
         formData = postContents;
        else if (postContents instanceof FormData)
         formData = postContents;
        else if (multipart == true)
         {
//           (FloriaDOM.isObject(postContents) == true ? FloriaDOM.makeUrlParams(postContents) : postContents);
           formData = new FormData();
           var props = Object.keys(postContents);
           for (var i = 0; i < props.length; ++i)
            {
              let d = postContents[props[i]];
              if (Array.isArray(d) == true || d instanceof TypedArray || d instanceof FileList)
               for (let j = 0; j < d.length; ++j)
                formData.append(props[i], d[j]);
              else
               formData.append(props[i], postContents[props[i]])
            }
         }
        else
         formData = FloriaDOM.makeUrlParams(postContents);

     }
    if (handleAs==null)
     handleAs="json";
         
    // Is this used at all anymore?????
    if (handleAs != 'json' && handleAs != 'jsonX' && handleAs != 'jsonRAW')
     {
       alert("FloriaAjax.ajaxUrl called with handleAs: '"+handleAs+"'. Check console logs for stack trace.\n\nThis was deprecated!");
       console.trace();
       return;
     }
    
    let xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.timeout = timeout;
    if (multipart != true)
     {
       if (typeof formData == "string")
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=UTF-8;');
       else
        xhr.setRequestHeader("Content-type", "application/"+handleAs+"; charset=UTF-8;");
     }
    if (handleAs=='json' || handleAs=='jsonRAW')
     xhr.responseType = 'json';
    else if (handleAs=='jsonX')
     xhr.responseType = 'text';
    
    xhr.onload = function() {
      try
        {
          if (xhr.getResponseHeader("x-wanda-canceler") == "1")
            alert("FYI THAT YOU CANCELED ANOTHER REQUEST!\n\nYou (or another user on the same account) was running a request you interrupted.");

          let data = handleAs=='jsonX' ? FloriaDOM.jsonParseWithComments(xhr.response) : xhr.response;
          if ((handleAs != 'jsonRAW' && data?.code != 200) || xhr.status != 200)
           return xhr.onerror({code: data?.code||xhr.status, message : data?.msg||xhr.statusText, errors: data?.errors, type: data?.type });
          if (data == null)
            throw ("An error occurred: no data for " + FloriaDOM.truncateUrl(url));
          if (handleAs != 'jsonRAW' && (data.code == null || 'data' in data == false))
            throw ("An error occurred: invalid JSON data for " + FloriaDOM.truncateUrl(url)+". Expecting WANDA server-formated response with 'code' and 'data' sub-elements.");

          if (data.perfMessage != null)
           setTimeout(function(){ alert(data.perfMessage); }, 10);
          if (successFunc != null)
           successFunc(handleAs=='jsonRAW' ? data : data.data);   
        }
      catch (e)
        {
          FloriaDOM.alertException(e, "Caught exception in AjaxRequest.ajaxUrl.onload()\nUrl:"+url+"\nFrom: "+successFunc+"\nError: ", true);
        }
    };
    xhr.onerror = function(error) { // only triggers if the request couldn't be made at all
      try
        {
          console.error("FloriaAjax.ajaxUrl: Error ", error);
          if (error != null && error.status||error.code == 401 && FloriaLogin.PopupLogin.isAuthPassthrough(url) == false)
           {
//             return alert("NO ACL!");
             return FloriaLogin.PopupLogin.show(true, function() { FloriaAjax.ajaxUrl(url, method, errorMsg, successFunc, errorFunc, postContents, timeout, handleAs) });
           }
          else
            {
              if (error?.type == 'CANCELED')
                alert("YOUR REQUEST WAS CANCELED!\n\nYou (or another person using the same account) have just invoked the same data from another browser window.");
              else if (error?.type == 'DEADLOCKED')
                alert("YOUR REQUEST DEADLOCKED!\nA database issue has occurred that caused your request to deadlock with another request.");

              var errCode = error.code||error.status;
              var msg = error == null ? null
                : error.message != null && error.message != "" ? error.message 
                : error.msg != null && error.msg != "" ? error.msg
                : errCode != null ? "Server returned status="+errCode
                : "Cannot reach the server";
              if (errorMsg != null)
                {
                  var Str = errorMsg;
                  if (msg != null)
                   Str+="\n"+msg;
                  if (error.errors != null && error.errors.length != 0)
                   for (var i = 0; i < error.errors.length; ++i)
                    Str+="\n  - "+error.errors[i].p+': '+error.errors[i].m;
                  FloriaDOM.alertConsole(Str);
                }
              if (errorFunc != null)
               errorFunc(errCode, msg, error.errors, error.type);
            }
        }
      catch (e)
        {
          FloriaDOM.alertException(e, "Caught exception in ajaxUrl.error()\nUrl:"+url+"\nFrom: "+errorFunc+"\nError: ", true);
        }
    };
    xhr.ontimeout = function() {
      alert("TIMEOUT!");
    };
    xhr.send(formData);
  },
  
// Async wrapper for ajaxUrl using Promises
ajaxUrlAsync: function(url, method, errorMsg, successFunc, errorFunc, postContents, timeout, handleAs, multipart) {
    return new Promise((resolve, reject) => {
      FloriaAjax.ajaxUrl(url, method, errorMsg, function(data) {
          if (typeof successFunc === 'function')
           successFunc(data);
          resolve(data);
        }, function(errCode, msg, errors, type) {
          if (typeof errorFunc === 'function')
           {
             let res = errorFunc(errCode, msg, errors, type);
             if (res != null)
              return resolve(res);
           }
          reject({ errCode, msg, errors, type });
        }, postContents, timeout, handleAs, multipart);
    });
  },
  
  
ajaxUrlMulti: function(AjaxInfos, Func)
  {
    var results=[];
    var createNestedFunc = function(ajaxInfo, previousF)
     {
       return function(data) { if (data != null) results.push(data); FloriaAjax.ajaxUrl(ajaxInfo.url, "GET", ajaxInfo.error, previousF, previousF); };
     }
    var f = function(data) { if (data != null) results.push(data); Func(results); };
    for (var i = AjaxInfos.length-1; i >= 0; --i)
     f = createNestedFunc(AjaxInfos[i], f);
    setTimeout(f, 1);
  },
    
  
// Launches a Url using the regular AjaxUrl facility but expects it to take some time before it returns (long running Job).
// While the job is running, launches a secondary Polling URL, with a handler and an interval check in seconds. The PollHandler
// function takes the result from the PollUrl and is expected to return the next PollUrl. If PollUrl is given NULL, an error
// occurred.
ajaxUrlLongRunningJob: function(Url, ErrorMsg, SuccessFunc, ErrorFunc, PostContents, TimeoutSecs, PollUrl, PollHandler, PollIntervalSecs, canTimeout)
  {
    var done = false;
    var loop = function() {
      FloriaAjax.ajaxUrl(PollUrl, "GET", null
                        ,function(data) {
                            if (data != null)
                             {
                               PollUrl = PollHandler(data);
                               if (done == false && PollUrl != null)
                                setTimeout(loop, PollIntervalSecs*1000);
                             }
                            else if (done == false)
                             {
                               PollHandler(null);
                             }
                          }
                        ,function(data) {
                            PollHandler(null);
                          }
                        );
     };
    FloriaAjax.ajaxUrl(Url, "GET", ErrorMsg, function(data) {
         done = true;
//         alert("done!!!!");
         SuccessFunc(data);
      }, ErrorFunc, PostContents, TimeoutSecs*1000);
    setTimeout(loop, 1000);
  },
  
jsonSyncFetch: async function(url, strict, raw, noThrow)
  {
    try {
      const response = await fetch(url);
      if (response.ok == false)
       {
         if (response.status == 401 && FloriaLogin.PopupLogin.isAuthPassthrough(url) == false)
          return alert("Your session timed out. Please refresh this page to continue.");
  //        return FloriaLogin.PopupLogin.show(true, function() { FloriaAjax.jsonSyncFetch(url, strict, raw, noThrow) });
  
         let msg = "The json URL '"+url+"' could not be fetched: "+response.status+" "+response.statusText;
         if (noThrow == true)
          return;
         throw msg;
       }
      const json = strict == true ? await response.json()
                                  : FloriaDOM.jsonParseWithComments(await response.text())
                                  ;
      return raw == true || json.data == null ? json : json.data;
     }
    catch (e)
     {
       if (noThrow == true)
        return;
       throw e;
     }
  },

txtSyncFetch: async function(url, noThrow)
  {
    const response = await fetch(url, { method: 'GET', credentials: 'include' });
    if (response.ok == false)
     {
       let msg = "The json URL '"+url+"' could not be fetched: "+response.status+" "+response.statusText;
       console.error(msg);
       if (noThrow == true)
        return;
       throw msg;
     }
    return await response.text();
  }

};