// Class for managing timelapse videosets.
//
// Supports the following events to which listeners can subscribe.  Event handlers are called with the arguments listed
// in parentheses:
// * video-added (videoId, time)
// * video-loaded-metadata (videoId, time)
// * video-made-visible (videoId, time)
// * video-deleted (video.id, currentTime, videoWhichCausedTheDelete)
//   NOTE: the videoWhichCausedTheDelete parameter may be null
// * video-garbage-collected (videoId, time)
// * stall-status-change (isStalled)
// * sync (currentTime)
//
// Dependencies:
// * org.gigapan.Util
// * jQuery (http://jquery.com/)
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
"use strict";
var org;
if (!org) {
  org = {};
} else {
  if (typeof org !== "object") {
    var orgExistsMessage = "Error: failed to create org namespace: org already exists and is not an object";
    alert(orgExistsMessage);
    throw new Error(orgExistsMessage);
  }
}

// Repeat the creation and type-checking for the next level
if (!org.gigapan) {
  org.gigapan = {};
} else {
  if (typeof org.gigapan !== "object") {
    var orgGigapanExistsMessage = "Error: failed to create org.gigapan namespace: org.gigapan already exists and is not an object";
    alert(orgGigapanExistsMessage);
    throw new Error(orgGigapanExistsMessage);
  }
}

// Repeat the creation and type-checking for the next level
if (!org.gigapan.timelapse) {
  org.gigapan.timelapse = {};
} else {
  if (typeof org.gigapan.timelapse !== "object") {
    var orgGigapanTimelapseExistsMessage = "Error: failed to create org.gigapan.timelapse namespace: org.gigapan.timelapse already exists and is not an object";
    alert(orgGigapanTimelapseExistsMessage);
    throw new Error(orgGigapanTimelapseExistsMessage);
  }
}

//
// DEPENDECIES
//

if (!org.gigapan.Util) {
  var noUtilMsg = "The org.gigapan.Util library is required by org.gigapan.timelapse.Videoset";
  alert(noUtilMsg);
  throw new Error(noUtilMsg);
}
if (!window['$']) {
  var nojQueryMsg = "The jQuery library is required by org.gigapan.timelapse.Videoset";
  alert(nojQueryMsg);
  throw new Error(nojQueryMsg);
}

//
// CODE
//

(function() {
  var UTIL = org.gigapan.Util;
  var MAX_QUEUED_VIDEO_LENGTH = 2;   // max number of videos allowed to be queued without stalling
  var DEFAULT_ERROR_THRESHOLD = UTIL.isChrome() ? 0.005 : 0.04;

  // Create a regex to extract the fragment number for split videos.  I construct the pattern this way
  // instead of "new RegExp()" for better performance (see https://developer.mozilla.org/en/JavaScript/Guide/Regular_Expressions)
  var SPLIT_VIDEO_FRAGMENT_URL_PATTERN = /_(\d+).mp4(?:\?time=[0-9]+)?$/i;

  org.gigapan.timelapse.Videoset = function(viewerDivId,videoDivId,canvasId,canvasTmpId) {
    var videoDiv = document.getElementById(videoDivId);
    var viewerDiv = document.getElementById(viewerDivId);
    var canvas = document.getElementById(canvasId);
    var canvasTmp = document.getElementById(canvasTmpId);
    var canvasContext = canvas.getContext('2d');
    var canvasTmpContext = canvasTmp.getContext('2d');
    var isStatusLoggingEnabled = false;
    var activeVideos = {};
    var inactiveVideos = {};
    var playbackRate = 1;
    var id = 0;
    var fps = 25;
    var isSplitVideo = false;
    var secondsPerFragment = 0;
    var areNativeVideoControlsVisible = false;
    var duration = 0;
    var isCacheDisabled = false;
    var advancing = false;
    var paused = true;
    var stalled = false;
    var videoStalled = false;
    var timeOffset = 0;
    var logInterval = null;
    var syncInterval = null;
    var garbageCollectionInterval = null;
    var perfInitialSeeks = 0;
    var perfTimeCorrections = [];
    var perfTimeTweaks = 0;
    var perfTimeSeeks = 0;
    var perfAdded = 0;
    var syncIntervalTime = 0.2; // in seconds
    var emulatingSyncIntervalTime = 1./12.; // in seconds
    var emulatingPlaybackRate = false;
    var leader = 0;
    var eventListeners = {};
    var largestFragment = 0;

    var mostRecentlyAddedVideo = null;

    ////////////////////////
    //
    // Public methods
    //

    this.setStatusLoggingEnabled = function(enable) {
      enable = !!enable;  // make true or false
      //UTIL.log("videoset logging status: " + enable);
      if (isStatusLoggingEnabled == enable) {
        return;
      }
      isStatusLoggingEnabled = enable;
      if (enable) {
        //logInterval = setInterval(this.writeStatusToLog, 500);
        logInterval = setInterval(allStats, 200);
      } else {
        clearInterval(logInterval);
      }
    };

    this.setNativeVideoControlsEnabled = function(enable) {
      areNativeVideoControlsVisible = !!enable;  // make true or false

      for (var videoId1 in activeVideos) {
        var v1 = activeVideos[videoId1];
        enable ? v1.setAttribute('controls', true) : v1.removeAttribute('controls');
      }

      for (var videoId2 in inactiveVideos) {
        var v2 = inactiveVideos[videoId2];
        enable ? v2.setAttribute('controls', true) : v2.removeAttribute('controls');
      }
    };

    this.setFps = function(newFps) {
      fps = newFps;
    };

    this.setDuration = function(newDuration) {
      duration = newDuration;
      setLargestFragment();
    };

    this.getFps = function() {
      return fps;
    };

    this.setLeader = function(newLeader) {
      var currentTime = _getCurrentTime();
      leader = newLeader - 0;  // subtract 0 to force this to be a number
      // Yuck.  This adds one frame to the leader to prevent sometimes showing the leader at the beginning of the video.  Don't know why this is a problem.  Happens more with Safari
      // Disabled since it confuses the player about the length of the video
      //if (leader > 0) leader += 1.0/fps;
      _seek(currentTime);
    };

    this.getLeader = function() {
      return leader;
    };

    this.setIsSplitVideo = function(isSplit) {
      isSplitVideo = isSplit;
    };

    this.setSecondsPerFragment = function(newSecondsPerFragment) {
      secondsPerFragment = newSecondsPerFragment;
      setLargestFragment();
    };

    this.getActiveVideos = function() {
      return activeVideos;
    };

    this.getInactiveVideos = function() {
      return inactiveVideos;
    };

    this.resetPerf = function() {
      perfInitialSeeks = 0;
      perfAdded = 0;
      perfTimeCorrections = [];
      perfTimeTweaks = 0;
      perfTimeSeeks = 0;
    };

    var _getFragment = function(time) {
      var frag = Math.floor(time / secondsPerFragment);
      if(time == duration)
        frag--;
      return frag;
    }

    this.getFragment = _getFragment;
    var getPerf = function() {
      var perf = "Videos added: " + perfAdded;
      perf += "; initial seeks: " + perfInitialSeeks;
      perf += "; # time correction seeks: " + perfTimeSeeks;
      perf += "; # time correction tweaks: " + perfTimeTweaks;
      perf += "; Corrections: ";
      for (var i = 0; i < perfTimeCorrections.length; i++) {
        if (i) perf += ",";
        perf += perfTimeCorrections[i].toFixed(4);
      }
      return perf;
    };



    ///////////////////////////
    // Add and remove videos
    //

    var _addVideo = function(src, geometry, video) {
      perfAdded++;
      id++;
      //Note: Safari and Chrome already let you do this
      //Left in codebase for quick toggling and in case other browsers don't have an easy way to do this
      if (isCacheDisabled) {
        src += "?nocache=" + UTIL.getCurrentTimeInSecs() + "." + id;
      }
      var videoBeingReplaced = mostRecentlyAddedVideo;
      var msg = ">>>>>>>>>> video(" + id + ") added from " + src + " at left=" + geometry.left + ",top=" + geometry.top + ", w=" + geometry.width + ",h=" + geometry.height;
      if (videoBeingReplaced != null) msg += "; replace=video(" + videoBeingReplaced.id + ")";
      UTIL.log(msg);

      var currentTime = new Date();
      if(!video)
        video = document.createElement('video');
      video.id = videoDiv.id+"_"+id;
      video.active = true;
      video.ready = false;
      if (typeof videoBeingReplaced !== 'undefined' && videoBeingReplaced != null) {
        video.idOfVideoBeingReplaced = videoBeingReplaced.id;
      }

      // Add methods getCurrentTime() and setCurrentTime() to the video.  We MUST use these methods instead of accessing
      // the currentTime property directly so that we can abstract away the time offset calculations required for split
      // videos.
      if (isSplitVideo) {
        var fragmentRegexMatch = src.match(SPLIT_VIDEO_FRAGMENT_URL_PATTERN);
        if (fragmentRegexMatch != null && fragmentRegexMatch.length == 2) {
          video.fragmentNumber = fragmentRegexMatch[1];
          video.fragmentTimeOffset = video.fragmentNumber * secondsPerFragment;
          video.getCurrentTime = function() {return this.currentTime + video.fragmentTimeOffset};
          video.setCurrentTime = function(newTime) {
            // modify the given global newTime, adjusting it for this fragment, and then
            // make sure the adjusted time is within the valid range of [0, this.duration]
            this.currentTime = Math.max(0, Math.min(this.duration, newTime - video.fragmentTimeOffset));
          };
          video.getPercentTimeRemainingInFragment = function() {
            if (this.duration == 0) {
              return 1;
            }
            return 1 - this.currentTime / this.duration;
          };
          video.getSecondsRemainingInFragment = function() {
            return this.duration - this.currentTime;
          };
        } else {
          UTIL.error("Unexpected split video URL pattern [" + src + "], could not determine fragment number!");
        }
      } else {
        video.getCurrentTime = function() {return this.currentTime};
        video.setCurrentTime = function(newTime) {this.currentTime = newTime};
      }

      //UTIL.log(getVideoSummaryAsString(video));
      if(video.src == '')
        video.setAttribute('src', src);
      //UTIL.log("set src successfully");
      if (areNativeVideoControlsVisible) {
        video.setAttribute('controls', true);
      }
      video.setAttribute('preload', 'auto');
      video.geometry = {};
      _repositionVideo(video, geometry);
      video.defaultPlaybackRate = video.playbackRate = playbackRate;
      video.style.visibility = 'hidden';
      video.style.position = 'absolute';
      activeVideos[video.id] = video;
      videoDiv.appendChild(video);
      video.addEventListener('loadedmetadata', videoLoadedMetadata, false);
      if(video.readyState >= 1)
        videoLoadedMetadata({target: video});
      video.addEventListener('seeked', videoSeeked, false);
      video.bwLastTime = UTIL.getCurrentTimeInSecs();
      video.bwLastBuf = 0;
      video.bandwidth = 0;
      var check;
      var timeout = 2000;
      check = function() {
        UTIL.log("check load for video("+video.id+")");
        UTIL.log("readyState: " + video.readyState);
        if (video.buffered.length == 0 && activeVideos[video.id] == video) {
          // Ouch.  A brand new bug in Chrome 15 (apparently) causes videos to never load
          // if they've been loaded recently and are being loaded again now.
          // It's pretty weird, but this disgusting code seems to work around the problem.
          UTIL.log("Chrome bug detected, adding cache buster");
          video.setAttribute('src', src+"?time="+(new Date().getTime()));
          video.load();
          if (advancing) {
            video.play();
          }
        }
      };
      setTimeout(check, timeout);
      publishVideoEvent(video.id, 'video-added', currentTime);

      updateStallState();

      mostRecentlyAddedVideo = video;

      video.addEventListener('playing', function(){
        if (video.drawIntervalId == null) video.drawIntervalId = setInterval(function() {drawToCanvas(video);}, 30);
      },false);

      video.addEventListener('pause', function(){
        clearInterval(video.drawIntervalId);
        video.drawIntervalId = null;
      },false);

      video.addEventListener('ended', function(){
        clearInterval(video.drawIntervalId);
        video.drawIntervalId = null;
      },false);

      return video;

    };
    this.addVideo = _addVideo;

    var _repositionVideo = function(video, geometry) {
      //UTIL.log("video(" + video.id + ") reposition to left=" + geometry.left + ",top=" + geometry.top + ", w=" + geometry.width + ",h=" + geometry.height + "; ready="+video.ready);
      video.geometry = geometry;
      drawToCanvas(video);
    };
    this.repositionVideo = _repositionVideo;

    var stopStreaming = function(video) {
      if(org.gigapan.Util.isChrome()) {
        video.src = ""; /* This is the right way to do things */
      }
      else { /* This is for Safari and IE */
        video.src = "data:video/mp4;base64";
      }
    };

    var garbageCollect = function() {
      var numInactiveVideos = 0;
      var idsOfVideosToDelete = [];
      for (var videoId in inactiveVideos) {
        numInactiveVideos++;
        var candidate = inactiveVideos[videoId];

        // TODO: is it safe to allow garbage collection for Chrome when readyState is 0?
        if ((!org.gigapan.Util.isChrome() || (candidate.readyState == 0 || candidate.readyState >= 4)) && !candidate.seeking) { // TODO: watch out! not checking readyState in non-chrome browsers might cause crashes!
          idsOfVideosToDelete[idsOfVideosToDelete.length] = candidate.id;
        }
      }

      if (numInactiveVideos == 0) {
        // shutdown the garbage collection timeout if there are no more inactive videos
        clearInterval(garbageCollectionInterval);
        garbageCollectionInterval = null;
        //UTIL.log("Stopped garbage collection");
      } else {
        for (var i = 0; i < idsOfVideosToDelete.length; i++) {
          var id = idsOfVideosToDelete[i];
          var videoElement = document.getElementById(id);
          if (videoElement) {
            // try to force browser to stop streaming the video
            stopStreaming(videoElement);
	          // TODO: Should we check that the video actually stopped streaming?
            videoDiv.removeChild(inactiveVideos[id]);
          }
          delete inactiveVideos[id];
          UTIL.log("video(" + id + ") garbage collected");
          publishVideoEvent(id, 'video-garbage-collected', new Date());
        }
     }
    };

    var _deleteVideo = function(video) {
      clearInterval(video.drawIntervalId);
      video.drawIntervalId = null;
      var msg = "video(" + video.id + ") deleted";
      var videoWhichCausedTheDelete = null;
      if (arguments.length > 1) {
        videoWhichCausedTheDelete = arguments[1];
        msg += " and replaced by video("+videoWhichCausedTheDelete.id+")";
      }
      UTIL.log(msg);
      video.active = false;
      try {
        video.pause();
      } catch(e) {
        UTIL.error(e.name + " while pausing " + video + " in deleteVideo(). Most likely you are running IE 9.");
      }
      stopStreaming(video);

      //UTIL.log(getVideoSummaryAsString(video));
      delete activeVideos[video.id];
      inactiveVideos[video.id] = video;

      updateStallState();

      var currentTime = new Date();
      var listeners = eventListeners['video-deleted'];
      if (listeners) {
        for (var i = 0; i < listeners.length; i++) {
          try {
            listeners[i](video.id, currentTime, videoWhichCausedTheDelete ? videoWhichCausedTheDelete.id : null);
          } catch(e) {
            UTIL.error(e.name + " while publishing to videoset 'video-deleted' event listener: " + e.message, e);
          }
        }
      }

      if (garbageCollectionInterval == null) {
        garbageCollectionInterval = window.setInterval(garbageCollect, 100);
        //UTIL.log("Started garbage collection");
      }
    };
    this.deleteVideo = _deleteVideo;

    ///////////////////////////
    // Time controls
    //

    var _isPaused = function() {
      return paused;
    };
    this.isPaused = _isPaused;

    var _updateVideoAdvance = function() {
      //UTIL.log("_updateVideoAdvance");
      if (!advancing && !(paused || stalled)) {
        //UTIL.log("resume advance");
        // Resume advancing
        var time = _getCurrentTime();
        advancing = true;
        _updateSyncInterval();
        _seek(time);

        for (var videoId in activeVideos) {
          UTIL.log("video(" + videoId + ") play");
          activeVideos[videoId].play();
        }
      } else if (advancing && (paused || stalled)) {
        //UTIL.log("stop advance");
        // Stop advancing
        var time = _getCurrentTime();
        advancing = false;
        _updateSyncInterval();

        for (var videoId in activeVideos) {
          UTIL.log("video(" + videoId + ") pause");
          try {
            activeVideos[videoId].pause();
          } catch(e) {
            UTIL.error(e.name + " while pausing " + activeVideos[videoId] + " in updateVideoAdvance(). Most likely you are running IE 9.");
          }
        }
        _seek(time);
      } else {
        UTIL.log("advance = " + !(paused || stalled));
      }
    };

    var _pause = function() {
      if (!paused) {
        UTIL.log("videoset pause");
        paused = true;
        _updateVideoAdvance();
        unstall();

        // notify pause listeners
        var listeners = eventListeners['videoset-pause'];
        if (listeners) {
          var adjustedTime = _getCurrentTime();
          for (var i = 0; i < listeners.length; i++) {
            try {
              listeners[i](adjustedTime);
            } catch(e) {
              UTIL.error(e.name + " while publishing to videoset 'videoset-pause' event listener: " + e.message, e);
            }
          }
        }
      }
    };
    this.pause = _pause;

    // Call this when advancing or emulatingSyncIntervalTime change
    var _updateSyncInterval = function() {
      if (syncInterval) window.clearInterval(syncInterval);
      if (advancing) {
        var intervalTime = 1000 * (emulatingSyncIntervalTime ? emulatingSyncIntervalTime : syncIntervalTime);
        UTIL.log("_updateSyncInterval: set for " + intervalTime);
        syncInterval = setInterval(sync, intervalTime);
      } else {
        UTIL.log("_updateSyncInterval: cleared");
      }
    }

    this.play = function() {
      if (paused) {
        UTIL.log("videoset play");
        paused = false;
        _updateVideoAdvance();

        // notify play listeners
        var listeners = eventListeners['videoset-play'];
        if (listeners) {
          var adjustedTime = _getCurrentTime();
          for (var i = 0; i < listeners.length; i++) {
            try {
              listeners[i](adjustedTime);
            } catch(e) {
              UTIL.error(e.name + " while publishing to videoset 'videoset-play' event listener: " + e.message, e);
            }
          }
        }
      }
    };

    this.getPlaybackRate = function() {
      return playbackRate;
    };

    var _doesBrowserSupportPlaybackRate = function(rate) {
      if (UTIL.isChrome()) return 0.0 <= rate;
      if (UTIL.isSafari()) return 0.0 == rate || (0.5 <= Math.abs(rate) && Math.abs(rate) <= 2.0);
      return true;
    };

    this.setPlaybackRate = function(rate) {
      if (rate != playbackRate) {
        var t = _getCurrentTime();
        playbackRate = rate;
        _seek(t);
        emulatingPlaybackRate = !_doesBrowserSupportPlaybackRate(rate);
        var videoRate = emulatingPlaybackRate ? 0 : rate;
        UTIL.log("*** SETTING VIDEO PLAYBACK RATE TO " + videoRate);
        for (var videoId in activeVideos) {
          activeVideos[videoId].defaultPlaybackRate = activeVideos[videoId].playbackRate = videoRate;
        }
        _updateSyncInterval();
      }
    };

    var _seek = function(new_time) {
      if (new_time > duration) {
        new_time = duration;
      }

      if (new_time != _getCurrentTime()) {
        //UTIL.log("_getCurrentTime() was " + _getCurrentTime());
        timeOffset = new_time - UTIL.getCurrentTimeInSecs() * (advancing ? playbackRate : 0);
        //UTIL.log("seek: timeOffset is " + timeOffset + ", frame " + timeOffset * fps);
        //UTIL.log("_getCurrentTime() now " + _getCurrentTime());
        sync(0.0);
      }
    };
    this.seek = _seek;

    var _getCurrentTime = function() {
      var t = timeOffset + UTIL.getCurrentTimeInSecs() * (advancing ? playbackRate : 0);
      return (t > duration) ? duration : t;
    };
    this.getCurrentTime = _getCurrentTime;

    this.addEventListener = function(eventName, listener) {
      if (eventName && listener && typeof(listener) === "function") {
        if (!eventListeners[eventName]) {
          eventListeners[eventName] = [];
        }

        eventListeners[eventName].push(listener);
      }
    };

    this.removeEventListener = function(eventName, listener) {
      if (eventName && eventListeners[eventName] && listener && typeof(listener) === "function") {
        for (var i = 0; i < eventListeners[eventName].length; i++) {
          if (listener == eventListeners[eventName][i]) {
            eventListeners[eventName].splice(i, 1);
            return;
          }
        }
      }
    };

    var publishVideoEvent = function(videoId, eventName, theTime) {
      var listeners = eventListeners[eventName];
      if (listeners) {
        for (var i = 0; i < listeners.length; i++) {
          try {
            listeners[i](videoId, theTime);
          } catch(e) {
            UTIL.error(e.name + " while publishing to videoset '" + eventName + "' event listener: " + e.message, e);
          }
        }
      }
    };

    this.isStalled = function() {
      return stalled;
    };

    //////////////////////////////////
    //
    // Private methods
    //

    // This seems to get called pretty late in the game
    var videoLoadedMetadata = function(event) {
      var video = event.target;
      publishVideoEvent(video.id, 'video-loaded-metadata', new Date());

      if (!video.active) {
        UTIL.log("video(" + video.id + ") videoLoadedMetadata after deactivation!");
        return;
      }

      _setVideoToCurrentTime(video);
      if (advancing) {
        video.play();
      }
    };

    // Given a video and a desired time, this function checks whether the desired time
    // is contained within the video.  If so, it returns null.  Otherwise, it causes
    // a new video to be loaded (which will replace the given one) and returns it.
    // This method always returns null when isSplitVideo is false.
    var _loadNewFragmentForDesiredTime = function(video, desiredTime) {

      // If we're using split video, then we need to check whether we need to replace the current video with one
      // which contains the desired time.
      if (isSplitVideo) {
        // first calculate the fragment number containing the desired time
        var desiredFragmentNumber = _getFragment(desiredTime);

        // if the desired fragment number differs from the current fragment, then we need to load in a new video,
        // and replace the current one with the new one.
        if (desiredFragmentNumber != video.fragmentNumber) {
          var fragmentSpecifier = "_" + desiredFragmentNumber + ".mp4";

          if (UTIL.isIE9()) fragmentSpecifier += "?time="+new Date().getTime();

          var url = video.src.replace(SPLIT_VIDEO_FRAGMENT_URL_PATTERN, fragmentSpecifier);
          var geometry = {
            left   : parseFloat(video.style.left) + (video.ready ? 0 : 100000),
            top    : parseFloat(video.style.top),
            width  : parseFloat(video.style.width),
            height : parseFloat(video.style.height)
          };
          // Load the new video, replacing the current one, then retry in 10 ms
          if(video.prefetchVid && video.prefetchVid.id)
            return;
          if(video.prefetchVid) {
            UTIL.log("_loadNewFragmentForDesiredTime(): PREFETCHED video available (src=[" + video.prefetchVid.src + "], tileidx=[" + video.prefetchVid.tileidx + "])");
            if(desiredFragmentNumber == video.prefetchVid.fragmentNumber)
            {
              // Make sure that, while prefetching, the view didn't change such that it would cause timelapse.js to add
              // a new video with a different tileidx.  If it did, then we need to ignore this prefetched video, and
              // fetch a new one based on mostRecentlyAddedVideo with the appropriate fragment.
              if (video.prefetchVid.tileidx != mostRecentlyAddedVideo.tileidx) {
                if (typeof mostRecentlyAddedVideo.prefetchVid === 'undefined') {
                  UTIL.log("!!!!!!!!!! PREFETCH idx [" + video.prefetchVid.tileidx + "] doesn't match current [" + mostRecentlyAddedVideo.tileidx + "], so must prefetch a new one");
                  prefetchNextVideoFragment(mostRecentlyAddedVideo);
                }
                return null;
              } else {
                var now = new Date();
                UTIL.log("Switching to prefetch video " + (now.getTime() - video.prefetchVid.someTime) + "ms after " + video.prefetchVid.someTime);
                console.assert(url == video.prefetchVid.src, "Mismatched URLs");
                var newVideo = _addVideo(url, geometry, video.prefetchVid);

                newVideo.tileidx = video.tileidx;
                return newVideo;
              }
            }
            else {
              UTIL.log("Correct video not prefetched");
            }
          }
          UTIL.log("_loadNewFragmentForDesiredTime(): Prefetched video not available.");
          if(desiredFragmentNumber <= largestFragment) {
            var newVideo = _addVideo(url, geometry);
            newVideo.tileidx = video.tileidx;
            UTIL.log("////////// Loading new fragment [" + newVideo.id + "] based on geometry of [" + video.id + "|" + video.ready + "|" + video.active + "], will retry setting time in 10 ms.  URL = [" + url + "]");
            return newVideo;
          }
          else {
            UTIL.log("REQUESTING A BAD FRAGMENT NUMBER: " + desiredFragmentNumber + " > " + largestFragment);
          }
        }
      }

      return null;
    };

    var _setVideoToCurrentTime = function(video) {
      if (video.active) {
        if (video.readyState > 0) {
          var theCurrentTime = _getCurrentTime();
          var desiredTime = null;

          // clamp desired time to duration
          if (parseFloat(theCurrentTime.toFixed(3)) >= duration) {
            desiredTime = leader + duration;
            if (UTIL.isChrome()) {
              desiredTime = desiredTime - DEFAULT_ERROR_THRESHOLD;
            }
          } else {
            desiredTime = leader + theCurrentTime;
          }

          // If we're using split video, then we need to check whether we need to replace the current video with one
          // which contains the desired time.
          if (isSplitVideo) {
            var newVideo = _loadNewFragmentForDesiredTime(video, _getCurrentTime());
            if (newVideo != null) {
              setTimeout(function() { _setVideoToCurrentTime(newVideo);}, 10);
              return;
            }
          }

          UTIL.log("@@@@@@@@@@ 2 video(" + video.id + ") _setVideoToCurrentTime; readyState=[" + video.readyState + "], seek to [" + theCurrentTime + "] which is [" + desiredTime + "]");

          // check the time ranges to see if we've loaded enough to perform a seek without causing a INDEX_SIZE_ERR: DOM Exception 1...
          var canSeek = false;
          var timeRanges = "";
          var desiredSeekTime = isSplitVideo ? desiredTime - video.fragmentTimeOffset : desiredTime;
          for (var i = 0; i < video.seekable.length; i++) {
            timeRanges += "(id=" + i + "|start=" + video.seekable.start(i) + "|end=" + video.seekable.end(i) + ")";
            if (video.seekable.start(i) <= desiredSeekTime && desiredSeekTime <= video.seekable.end(i)) {
              canSeek = true;
              break;
            }
          }

          if (canSeek) {
            perfInitialSeeks++;
            try {
              video.setCurrentTime(desiredTime);
            } catch(e) {
              UTIL.error("video(" + video.id + ") _setVideoToCurrentTime(): caught " + e.toString() + " setting currentTime to [" + desiredTime + "].  Will retry in 10 ms...");
              setTimeout(function() { _setVideoToCurrentTime(video);}, 10);
            }
          } else {
            // try again in 10 ms
            UTIL.log("video(" + video.id + ") _setVideoToCurrentTime(): can't seek to [" + desiredTime + " (" + desiredSeekTime + ")] since no valid time range found [" + timeRanges + "].  Will retry in 10 ms...");
            setTimeout(function() {_setVideoToCurrentTime(video);}, 10);
          }
        } else {
          UTIL.log("video("+video.id+") _setVideoToCurrentTime: doing nothing since video.readyState is 0");
        }
      } else {
        UTIL.log("video("+video.id+") _setVideoToCurrentTime: doing nothing since video.active is false");
      }
    };

    var _makeVideoVisible = function(video, callingFunction) {
      if (!video.active) {
        UTIL.log("video(" + video.id + ") _makeVideoVisible, but it has already been deleted, so do nothing");
        return;
      }

      video.ready = true;

      var error = video.getCurrentTime() - leader - _getCurrentTime();
      publishVideoEvent(video.id, 'video-made-visible', new Date());
      UTIL.log("video(" + video.id + ") _makeVideoVisible(" + callingFunction + "): ready=[" + video.ready + "] error=[" + error + "] " + videoStats(video));

      drawToCanvas(video);

      // Delete video which is being replaced, following the chain until we get to a null.  We do this in a timeout
      // to give the browser a chance to update the GUI so that it can render the new video positioned above.  This
      // (mostly) fixes the blanking problem we saw in Safari.
      //window.setTimeout(function() {
        var videoToDelete = activeVideos[video.idOfVideoBeingReplaced];
        var chainOfDeletes = "";
        var deletedVideoUrls = [];
        while (videoToDelete) {
          deletedVideoUrls.push(videoToDelete.src);
          var nextVideoToDelete = activeVideos[videoToDelete.idOfVideoBeingReplaced];
          delete videoToDelete.idOfVideoBeingReplaced;  // delete this to prevent multiple deletes
          chainOfDeletes += videoToDelete.id + ",";
          _deleteVideo(videoToDelete, video);
          videoToDelete = nextVideoToDelete;
        }
        UTIL.log("video(" + video.id + ") _makeVideoVisible(" + callingFunction + "): chain of deletes: " + chainOfDeletes);
      //}, 1);
    };

    var videoSeeked = function(event) {
      var video = event.target;
      if(video.active == false)
        return;

      drawToCanvas(video);

      var error = video.getCurrentTime() - leader - _getCurrentTime();

      if ((_isPaused() || videoStalled) && Math.abs(error) > DEFAULT_ERROR_THRESHOLD) {
        UTIL.log("video(" + video.id + ") videoSeeked():  readyState=[" + video.readyState + "] currentTime=[" + video.getCurrentTime() + "] error=[" + error + "] is too high, must re-seek");
        _setVideoToCurrentTime(video);
      } else {
        videoStalled = false;
        updateStallState();
        UTIL.log("video(" + video.id + ") videoSeeked():  readyState=[" + video.readyState + "] currentTime=[" + video.getCurrentTime() + "] error=[" + error + "] is acceptable");

        if (!video.ready) {
          var checkVideoReadyState = function() {
            video.isWaitingOnReadyState = true;
            if (video.readyState >= 3) {
              video.isWaitingOnReadyState = false;
              window.setTimeout(function() {
                _makeVideoVisible(video, "seek");
            },100);
            } else {
              window.setTimeout(checkVideoReadyState, 10);
            }
          };

          if (!video.isWaitingOnReadyState) {
            checkVideoReadyState();
          }
        }
      }
    };

    // Call periodically, when video is running
    this.writeStatusToLog = function() {
      var msg = "video status:";
      for (var videoId1 in activeVideos) {
        msg += " " + getVideoSummaryAsString(activeVideos[videoId1]);
      }
      for (var videoId2 in inactiveVideos) {
        msg += " " + getVideoSummaryAsString(inactiveVideos[videoId2]);
      }
      UTIL.log(msg);
    };

    var getVideoSummaryAsString = function(video) {
      var summary = video.id.toString();
      summary += ":A=" + (video.active ? "y" : "n");
      summary += ";N=" + video.networkState;
      summary += ";R=" + video.readyState;
      summary += ";P=" + (video.paused ? "y" : "n");
      summary += ";S=" + (video.seeking ? "y" : "n");
      summary += ";T=" + video.getCurrentTime().toFixed(3);
      summary += ";B=" + dumpTimerange(video.buffered);
      summary += ";P=" + dumpTimerange(video.played);
      summary += ";E=" + (video.error ? "y" : "n");
      return summary;
    };

    var dumpTimerange = function(timerange) {
      var ret = "{";
      for (var i = 0; i < timerange.length; i++) {
        ret += timerange.start(i).toFixed(3) + "-" + timerange.end(i).toFixed(3);
      }
      ret += "}";
      return ret;
    };

    var updateStallState = function() {
      if(videoStalled)
        return;
      // We stall if there are more than MAX_QUEUED_VIDEO_LENGTH videos queued, so count the number of active videos
      var numQueued = 0;
      for (var v in activeVideos) {
        numQueued++;
      }

      if (stalled && numQueued <= MAX_QUEUED_VIDEO_LENGTH) {
        unstall();
      } else if (!stalled && numQueued > MAX_QUEUED_VIDEO_LENGTH) {
        stall();
      } else if (stalled) {
        UTIL.log("Still stalled... numQueued=[" + numQueued + "]");
      }
    };

    var stall = function (isVideo) {
      if(isVideo === undefined) isVideo = false;
      if (stalled && (videoStalled || !isVideo)) {
        return;
      }
      if(!videoStalled) videoStalled = isVideo;
      if(!stalled) {
        UTIL.log("Video stalling...");
        stalled = true;
        showSpinner(viewerDivId);
        notifyStallEventListeners();
        _updateVideoAdvance();
      }
    };

    var unstall = function () {
      if (!stalled || videoStalled) {
        return;
      }
      UTIL.log("Video unstalled...");
      stalled = false;
      hideSpinner(viewerDivId);
      notifyStallEventListeners();
      _updateVideoAdvance();
    };

    var notifyStallEventListeners = function() {
      var listeners = eventListeners['stall-status-change'];
      if (listeners) {
        for (var i = 0; i < listeners.length; i++) {
          try {
            listeners[i](stalled);
          } catch(e) {
            UTIL.error(e.name + " while publishing to videoset 'stall-status-change' event listener: " + e.message, e);
          }
        }
      }
    };

    var updateVideoBandwidth = function(video) {
      var newTime = UTIL.getCurrentTimeInSecs();
      var b = video.buffered;
      var newBufferPosition = (b && b.length) ? b.end(b.length-1) : 0;
      //UTIL.log("newTime " + newTime + " video.bwLastTime " + video.bwLastTime);
      var deltaTime = newTime - video.bwLastTime;
      //UTIL.log("newBufferPosition " + newBufferPosition + " video.bwLastBuf " + video.bwLastBuf);
      var deltaBuffer = newBufferPosition - video.bwLastBuf;
      video.bwLastTime = newTime;
      video.bwLastBuf = newBufferPosition;
      video.bandwidth = (deltaTime==0) ? 0 : deltaBuffer / deltaTime;
      //UTIL.log("bandwidth is " + video.bandwidth);
    };

    var videoStats = function(video) {
      var netstates=["Empty","Idle","Loading","NoSource"];
      var readystates=["Nothing","Metadata","CurrentData", "FutureData", "EnoughData"];
      var ret="["+readystates[video.readyState]+","+netstates[video.networkState];
      if (video.seeking) ret += ",Seeking";
      ret += ",bw="+video.bandwidth.toFixed(1)+"]";
      return ret;
    };

    var allStats = function() {
      var ready = [];
      var not_ready = [];
      var inactive = [];
      for (var activeVideoId in activeVideos) {
        var activeVideo = activeVideos[activeVideoId];
        updateVideoBandwidth(activeVideo);
        (activeVideo.ready ? ready : not_ready).push("video("+activeVideo.id+")"+videoStats(activeVideo));
      }
      for (var inactiveVideoId in inactiveVideos) {
        var inactiveVideo = inactiveVideos[inactiveVideoId];
        updateVideoBandwidth(inactiveVideo);
        inactive.push("video("+inactiveVideo.id+")"+videoStats(inactiveVideo));
      }
      var msg = "NOTREADY("+not_ready.length+") " + not_ready.join(" ");
      msg += " | READY("+ready.length+") " + ready.join(" ");
      msg += " | DELETED("+inactive.length+") " + inactive.join(" ");
      UTIL.log(msg);
    };

    var prefetchNextVideoFragment = function(currentVideo) {
      var prefetchVideo = document.createElement('video');
      prefetchVideo.setAttribute('preload', 'auto');
      var fragmentRegexMatch = currentVideo.src.match(SPLIT_VIDEO_FRAGMENT_URL_PATTERN);
      prefetchVideo.fragmentNumber = parseInt(fragmentRegexMatch[1]) + 1;
      //UTIL.log("prefetchNextVideoFragment(): " + largestFragment + "/" + duration + "/" + secondsPerFragment +
      //            "/" + prefetchVideo.fragmentNumber);
      if (prefetchVideo.fragmentNumber <= largestFragment) {
        var fragmentSpecifier = "_" + prefetchVideo.fragmentNumber + ".mp4";
        if (UTIL.isIE9()) fragmentSpecifier += "?time="+new Date().getTime();
        var url = currentVideo.src.replace(SPLIT_VIDEO_FRAGMENT_URL_PATTERN, fragmentSpecifier);
        UTIL.log("Prefetching fragment [" + prefetchVideo.fragmentNumber + "], idx [" + currentVideo.tileidx + "], URL [" + url + "]");
        prefetchVideo.setAttribute('src', url);
        var now = new Date();
        prefetchVideo.someTime = now.getTime();
        prefetchVideo.tileidx = currentVideo.tileidx;
        currentVideo.prefetchVid = prefetchVideo;
      }
    };

    var sync = function(errorThreshold) {
      //UTIL.log("sync");
      if (errorThreshold == undefined) {
        errorThreshold = DEFAULT_ERROR_THRESHOLD;
      }

      var t = _getCurrentTime();
      if (t < 0) {
        _pause();
        _seek(0);
        publishSyncEvent(0);
        return;
      } else if (duration > 0 && t > duration) {
        _pause();
        _seek(duration);
        publishSyncEvent(duration);
        return;
      }
      publishSyncEvent(t);

      updateStallState();
      if (stalled) {
        return;
      }

      var ready_stats = [ [], [], [], [], [] ];
      var not_ready_stats = [ [], [], [], [], [] ];
      for (var videoId in activeVideos) {
        var video = activeVideos[videoId];
        //updateVideoBandwidth(video);
        var error = video.getCurrentTime() - leader - t;
        (video.ready ? ready_stats : not_ready_stats)[video.readyState].push(video.bandwidth.toFixed(1));
        if (isSplitVideo && video.readyState >= 1) {
          if (video.getPercentTimeRemainingInFragment() < .5 && video.prefetchVid == undefined) {
            UTIL.log("sync(" + t + "): should do prefetch here (" + video.getPercentTimeRemainingInFragment() + ")...")
            prefetchNextVideoFragment(video);
          }
        }
        if (video.readyState >= 1 && (Math.abs(error) > errorThreshold || emulatingPlaybackRate)) {  // HAVE_METADATA=1
          perfTimeCorrections.push(error);
          var rateTweak = 1 - error / syncIntervalTime;
          if (!advancing || emulatingPlaybackRate || rateTweak < .25 || rateTweak > 2) {
            perfTimeSeeks++;
            //UTIL.log("current time " + video.getCurrentTime());
            //UTIL.log("leader " + leader);
            UTIL.log("video(" + videoId + ") time correction: seeking from " + (video.getCurrentTime() - leader) + " to " + t + " (error=" + error + ", state=" + video.readyState + ")");
            // Allow manual frame stepping without stalling. If we are paused and not seeking, then there really is no reason to stall.
            // Also fixes issues of stalling uncontrollably when playing in reverse.
            if ((!advancing && video.seeking) || (advancing && !emulatingPlaybackRate))
              stall(true);
            var desiredTime = leader + t + (advancing ? playbackRate * errorThreshold * .5 : 0);  // seek ahead slightly if advancing
            try {
              var newVideo = isSplitVideo ? _loadNewFragmentForDesiredTime(video, desiredTime) : null;
              if (newVideo == null) {
                video.setCurrentTime(desiredTime);
              } else {
                UTIL.log("video(" + videoId + ") time correction: not setting time to [" + desiredTime + "] since we needed to load in a new video (" + newVideo.id + ")")
              }
            }
            catch (e) {
              // log this, but otherwise don't worry about it since sync will try again later and take care of it
              UTIL.log("video(" + video.id + ") sync(): caught " + e.toString() + " setting currentTime to [" + desiredTime + "]");
            }
          } else {
            if(isSplitVideo && video.fragmentTimeOffset + secondsPerFragment <= _getCurrentTime()) {
              _loadNewFragmentForDesiredTime(video, _getCurrentTime());
            } else {
              perfTimeTweaks++;
              UTIL.log("video(" + videoId + ") time correction: tweaking from " + (video.getCurrentTime() - leader) + " to " + t + " (error=" + error + ", rate=" + rateTweak + ", state=" + video.readyState + ")");
              // Speed or slow video so that we'll be even by the next sync interval
              video.playbackRate = playbackRate * rateTweak;
            }
          }
        } else {
          if (video.playbackRate != playbackRate) {
            video.playbackRate = playbackRate;
          }
          if (!video.ready && video.readyState >= 3) {
            window.setTimeout(function() {
              _makeVideoVisible(video, "sync");
            },100);

          }
        }
      }
    };

    var publishSyncEvent = function(t) {
      var listeners = eventListeners['sync'];
      if (listeners) {
        var adjustedTime = (t >= duration) ? duration : t;
        for (var i = 0; i < listeners.length; i++) {
          try {
            listeners[i](adjustedTime);
          } catch(e) {
            UTIL.error(e.name + " while publishing to videoset 'sync' event listener: " + e.message, e);
          }
        }
      }
    };

    var drawToCanvas = function(video) {
      if (video.active && video.ready) {
        canvasTmpContext.clearRect(0, 0, canvasTmp.width, canvasTmp.height);
        canvasTmpContext.drawImage(video,video.geometry.left,video.geometry.top,video.geometry.width,video.geometry.height);

        var imgData = canvasTmpContext.getImageData((canvasTmp.width/2)-5,0,10,canvasTmp.height);
        var len = imgData.data.length;
        var blackCounter = 0;

        // Apparently in IE 10 this is REALLY slow (and not to iterate but to actually do the array lookups)
        // So instead, we just grab a 10xvideoHeight rectangle from the center (code above) and see if that is all black.
        // If so, it's pretty safe to assume that the whole frame is black.
        for (var i = 0; i < len; i += 4) {
          if (imgData.data[i] == 0 && imgData.data[i+1] == 0 && imgData.data[i+2] == 0) {
            blackCounter++;
          } else {
            break;
          }
        }

        // Only draw if no black frame was detected
        if (blackCounter < len/4) {
          canvasContext.clearRect(0, 0, canvas.width, canvas.height);
          canvasContext.drawImage(video,video.geometry.left,video.geometry.top,video.geometry.width,video.geometry.height);
        } else {
          UTIL.log("Black video frame detected. Not drawing to canvas.");
        }
      }
    };

    function setLargestFragment() {
      largestFragment = Math.ceil(duration / secondsPerFragment) - 1;
    }
    //////////////////////////////////
    //
    // Constructor code
    //

    this.setStatusLoggingEnabled(false);
  };
})();
