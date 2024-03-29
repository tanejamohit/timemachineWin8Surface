// Class containing various (static) generic utility methods.
//
// Dependencies: None
//
// Copyright 2011 Carnegie Mellon University. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification, are
// permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of
//    conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list
//    of conditions and the following disclaimer in the documentation and/or other materials
//    provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY CARNEGIE MELLON UNIVERSITY ''AS IS'' AND ANY EXPRESS OR IMPLIED
// WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL CARNEGIE MELLON UNIVERSITY OR
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
// ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
// NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
// ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// The views and conclusions contained in the software and documentation are those of the
// authors and should not be interpreted as representing official policies, either expressed
// or implied, of Carnegie Mellon University.
//
// Authors:
// Chris Bartley (bartley@cmu.edu)
// Paul Dille (pdille@andrew.cmu.edu)
// Randy Sargent (randy.sargent@cs.cmu.edu)

//
// VERIFY NAMESPACE
//
// Create the global symbol "org" if it doesn't exist.  Throw an error if it does exist but is not an object.
var org;

if (!org) {
  org = {};
} else {
  if (typeof org != "object") {
    var orgExistsMessage = "Error: failed to create org namespace: org already exists and is not an object";
    alert(orgExistsMessage);
    throw new Error(orgExistsMessage);
  }
}

// Repeat the creation and type-checking for the next level
if (!org.gigapan) {
  org.gigapan = {};
} else {
  if (typeof org.gigapan != "object") {
    var orgGigapanExistsMessage = "Error: failed to create org.gigapan namespace: org.gigapan already exists and is not an object";
    alert(orgGigapanExistsMessage);
    throw new Error(orgGigapanExistsMessage);
  }
}
//

//
// CODE
//
(function() {
  var isChromeCached;
  var areLogging = true;
  var isChromeUserAgent = navigator.userAgent.match(/Chrome/) != null;
  var isSafariUserAgent = navigator.userAgent.match(/Safari/) != null  && !isChromeUserAgent;  // the Chrome user agent actually has the word "Safari" in it too!
  var isMSIEUserAgent = navigator.userAgent.match(/MSIE/) != null;
  var matchIEVersion = navigator.userAgent.match(/MSIE\s([\d]+)/);
  var isFirefoxUserAgent = navigator.userAgent.match(/Firefox/) != null;

  //0 == none
  //1 == errors only
  //2 == verbose (everything)
  var loggingLevel = 1;

  org.gigapan.Util = function() { };

  org.gigapan.Util.browserSupported = function() {
    var v = document.createElement('video');
    // Check if video tag is supported and the browser supports H.264
    return !!(v.canPlayType && v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"').replace(/no/, ''));
  };

  org.gigapan.Util.isChrome = function() {
    return isChromeUserAgent;
  };

  org.gigapan.Util.isSafari = function() {
    return isSafariUserAgent;
  };

  org.gigapan.Util.isIE = function() {
    return isMSIEUserAgent;
  };

  org.gigapan.Util.isFirefox = function() {
    return isFirefoxUserAgent;
  };

  org.gigapan.Util.isIE9 = function() {
    return (isMSIEUserAgent && matchIEVersion[1] == 9);
  };

  org.gigapan.Util.isNumber = function(n) {
    // code taken from http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric
    return !isNaN(parseFloat(n)) && isFinite(n);
  };

  org.gigapan.Util.log = function(str, logType) {
    if (typeof(console) == 'undefined' || console == null) return;
    var now = (new Date()).getTime();
    if (loggingLevel >= 2 || (loggingLevel == 1 && logType && logType == 1)) {
      console.log(org.gigapan.Util.convertTimeToMinsSecsString(now) + ": " + str);
    }
  };

  org.gigapan.Util.error = function(str) {
    org.gigapan.Util.log('*ERROR: ' + str, 1);
  };

  org.gigapan.Util.convertTimeToMinsSecsString = function(t) {
    var mins = ("0" + Math.floor((t / 60000) % 60)).substr(-2);
    var secs = ("0" + ((t / 1000) % 60).toFixed(3)).substr(-6);
    return mins + ":" + secs;
  };

  org.gigapan.Util.dumpObject = function(obj) {
    if (typeof obj != 'object') {
      return obj;
    }
    var ret = '{';
    for (var property in obj) {
      if (ret != '{') {
        ret += ',';
      }
      ret += property + ':' + obj[property];
    }
    ret += '}';
    return ret;
  };

  org.gigapan.Util.getCurrentTimeInSecs = function() {
    return .001 * (new Date()).getTime();
  };

  org.gigapan.Util.formatTime = function(theTime, willShowMillis, willShowHours) {
    var t = parseFloat(theTime.toFixed(3));
    var hours = Math.floor(t / 3600);
    var minutes = Math.floor(t / 60) - (hours * 60);
    var seconds = Math.floor(t - (hours * 3600) - (minutes * 60));
    var millis = Math.floor(parseFloat((t - Math.floor(t)).toFixed(2)) * 100);

    var hoursStr = '' + hours;
    var minutesStr = '' + minutes;
    var secondsStr = '' + seconds;
    var millisStr = '' + millis;
    if (hours < 10) {
      hoursStr = "0" + hoursStr;
    }
    if (minutes < 10) {
      minutesStr = "0" + minutesStr;
    }
    if (seconds < 10) {
      secondsStr = "0" + secondsStr;
    }
    if (millis < 10) {
      millisStr = "0" + millisStr;
    }

    return (willShowHours ? hoursStr + ':' : '') +
            minutesStr + ":" +
            secondsStr +
            (willShowMillis ? "." + millisStr : '');
  };

  org.gigapan.Util.isChrome = function() {
    if (isChromeCached != undefined) {
      return isChromeCached;
    }
    return isChromeCached = (navigator.userAgent.indexOf("Chrome") >= 0);
  };

  // wrapper for ajax calls
  org.gigapan.Util.ajax = function(dataType, url, callback) {
    if (typeof(cached_ajax) != "undefined") {
      // We are on file url or using cached ajax to get around
      // cross domain security policies
      if (typeof(cached_ajax[url]) == "undefined") {
        // TODO: deprecate *.json for *.js
        // left here for backwards compatibility
        url = url.replace(/js$/,".json")
        if (typeof(cached_ajax[url]) == "undefined") {
          org.gigapan.Util.error("Error loading file from file URL [" + url + "]");
          return;
        }
      }
      callback(cached_ajax[url]);
    } else {
      // We are not on file url or we are utilizing the Chrome
      // --allow-file-access-from-files param and can do normal ajax calls
      $.ajax({
        dataType: dataType,
        url: url,
        success: function (data) {
          if (data) callback(data);
        }, error: function () {
          // TODO: deprecate *.json for *.js
          // left here for backwards compatibility
          if (dataType == "script") {
            url = url.replace(".js",".json");
            $.ajax({
              dataType: "json",
              url: url,
              success: function (data) {
                if (data) callback(data);
              }, error: function () {
                org.gigapan.Util.error("Error loading file from URL [" + url + "]");
                return;
              }
            });
          } else {
            org.gigapan.Util.error("Error loading file from URL [" + url + "]");
            return;
          }
        }
      });
    }
  }

  org.gigapan.Util.htmlForTextWithEmbeddedNewlines = function(text) {
    if (text === undefined) return;
    var htmls = [];
    var lines = text.split(/\n/);
    var className = "";
    for (var i = 0 ; i < lines.length ; i++) {
      if (i == 0) className = "captureTimeMain";
      else className = "captureTimeSub"+i;
      htmls.push(
        jQuery(document.createElement('div')).html("<div class=\""+className+"\">"+lines[i]).html()+"</div>"
      );
    }
    return htmls.join("");
  }

  org.gigapan.Util.unpackVars = function(str) {
    var keyvals = str.split('&');
    var vars = {};

    if (keyvals.length == 1 && keyvals[0] == "") return null;

    for (var i = 0; i < keyvals.length; i++) {
      var keyval = keyvals[i].split('=');
      vars[keyval[0]] = keyval[1];
    }
    return vars;
  }

  org.gigapan.Util.getQueryVars = function() {
    return org.gigapan.Util.unpackVars(window.location.search.slice(1));
  }

  org.gigapan.Util.getHashVars = function() {
    return org.gigapan.Util.unpackVars(window.location.hash.slice(1));
  }

  org.gigapan.Util.onQueryChange = function() {
    if (org.gigapan.Util.getQueryVars().v != undefined) {
      if (org.gigapan.Util.getQueryVars().t != undefined) {
        setViewAndTime(org.gigapan.Util.getQueryVars().v, org.gigapan.Util.getQueryVars().t);
      } else {
        setView(org.gigapan.Util.getQueryVars().v);
      }
    }
  };

  org.gigapan.Util.onHashChange = function() {
    if ((org.gigapan.Util.getHashVars().v != undefined) &&
       (org.gigapan.Util.getHashVars().t != undefined)) {
      setViewAndTime(org.gigapan.Util.getHashVars().v, org.gigapan.Util.getHashVars().t);
    } else if (org.gigapan.Util.getHashVars().v != undefined) {
      setView(org.gigapan.Util.getHashVars().v);
    } else if (org.gigapan.Util.getHashVars().t != undefined) {
      setTime(org.gigapan.Util.getHashVars().t);
    }
  };

  org.gigapan.Util.queryAndHash = function(query, hash) {
    if (window.location.search != query) {
      window.location.href =
        window.location.href.slice(0, window.location.href.indexOf('?')) + query + hash;
    } else {
      window.location.hash = hash;
      org.gigapan.Util.onHashChange();
    }
  };

})();
