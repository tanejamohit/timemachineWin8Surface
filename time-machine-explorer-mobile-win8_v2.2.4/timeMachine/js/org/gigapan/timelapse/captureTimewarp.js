/*
 Class for capturing a timewarp on Windows8 Surface tablet

 Dependencies:
 * org.gigapan.timelapse.Timelapse
 * jQuery (http://jquery.com/)

 Copyright 2013 Carnegie Mellon University. All rights reserved.

 Redistribution and use in source and binary forms, with or without modification, are
 permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice, this list of
 conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright notice, this list
 of conditions and the following disclaimer in the documentation and/or other materials
 provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY CARNEGIE MELLON UNIVERSITY ''AS IS'' AND ANY EXPRESS OR IMPLIED
 WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL CARNEGIE MELLON UNIVERSITY OR
 CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 The views and conclusions contained in the software and documentation are those of the
 authors and should not be interpreted as representing official policies, either expressed
 or implied, of Carnegie Mellon University.

 Authors:
 
 VERIFY NAMESPACE

 Create the global symbol "org" if it doesn't exist.  Throw an error if it does exist but is not an object.
 */"use strict";

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

// Repeat the creation and type-checking for the next level
if (!org.gigapan.timelapse) {
    org.gigapan.timelapse = {};
} else {
    if (typeof org.gigapan.timelapse != "object") {
        var orgGigapanTimelapseExistsMessage = "Error: failed to create org.gigapan.timelapse namespace: org.gigapan.timelapse already exists and is not an object";
        alert(orgGigapanTimelapseExistsMessage);
        throw new Error(orgGigapanTimelapseExistsMessage);
    }
}

//
// DEPENDECIES
//
if (!org.gigapan.timelapse.Timelapse) {
    var noTimelapseMsg = "The org.gigapan.timelapse.Videoset library is required by org.gigapan.timelapse.captureTimewarp";
    alert(noTimelapseMsg);
    throw new Error(noTimelapseMsg);
}

//
// CODE
//
(function () {
    org.gigapan.timelapse.captureTimewarp = function (timelapse) {
        //////////////////////////////////////////////////////////////
        //
        // Class Variables
        //
        var isTimeWarpAutomatic = true;
        var curView;
        var curViewNumber = 0;
        var timer;
        var snaplapse;
        var captureInterval = 100;
        var viewerDivId;
        var isRecording = false;
        var isPlaying = false;
        var isEventListenerAdded = false;
        

        var startRecording = function () {
            timer = setInterval(saveViewToTimeWarp,captureInterval);
        }

        var stopRecording = function () {
            clearInterval(timer);
        }

        var saveViewToTimeWarp = function () {
            snaplapse = timelapse.getSnaplapse();
            var originalBoundingBox = timelapse.getBoundingBoxForCurrentView();
            var BLwidth = parseInt($("#recordbox").css("borderLeftWidth"),10);
            var width = parseInt($("#recordbox").css("width"),10);
            var BBwidth = parseInt($("#recordbox").css("borderBottomWidth"),10);
            var height = parseInt($("#recordbox").css("height"),10);
            var modifiedBoundingBox = originalBoundingBox;
            modifiedBoundingBox.xmin += (originalBoundingBox.xmax - originalBoundingBox.xmin) * ((BLwidth) / (width + 2 * BLwidth));
            modifiedBoundingBox.xmax -= (originalBoundingBox.xmax - originalBoundingBox.xmin) * ((BLwidth) / (width + 2 * BLwidth));
            modifiedBoundingBox.ymin += (originalBoundingBox.ymax - originalBoundingBox.ymin) * ((BBwidth) / (height + 2 * BBwidth));
            modifiedBoundingBox.ymax -= (originalBoundingBox.ymax - originalBoundingBox.ymin) * ((BBwidth) / (height + 2 * BBwidth));

            snaplapse.recordKeyframe(curViewNumber,
                org.gigapan.timelapse.Snaplapse.normalizeTime(timelapse.getCurrentTime()),
                modifiedBoundingBox,
                null,
                false,
                captureInterval/1000.0,
                false);
            curViewNumber++;
        }

        var setupUI = function () {
            viewerDivId = timelapse.getViewerDivId();
            $("#" + viewerDivId + " .savewarp").bind("click", saveTimeWarp);

            $("#" + viewerDivId + " .playwarp").bind("click", function () {
                if (isRecording) { return; }
                if (isPlaying) {
                    snaplapse.stop();
                }
                else {
                    if(snaplapse == null) { return; }
                    snaplapse.play();
                    isPlaying = true;
                    // Show the pause button
                    $(this).toggleClass("playRecordedWarp");
                    $(this).toggleClass("stopWarp");

                    // If the event listener for stop of snaplapse hasn't been added yet
                    if (!isEventListenerAdded) {
                        snaplapse.addEventListener('stop', function () {
                            isPlaying = false;
                            // Show the play button
                            $("#" + viewerDivId + " .playwarp").toggleClass("playRecordedWarp");
                            $("#" + viewerDivId + " .playwarp").toggleClass("stopWarp");
                        });
                        isEventListenerAdded = true;
                    }
                }
            });

            $("#" + viewerDivId + " .recordwarp").bind("click", function () {
                if (isPlaying) { return; }
                if (isRecording) {
                    stopRecording();
                    timelapse.pause();
                    isRecording = false;
                    // Show UI to play the timewarp just recorded
                    $(this).toggleClass("record");
                    $(this).toggleClass("stopRecord");
                    $("#recordbox").hide();
                }
                else {
                    // Clear time warp before recording the next one
                    snaplapse = timelapse.getSnaplapse();
                    snaplapse.clearSnaplapse();
                    curViewNumber = 0;
                    $(this).toggleClass("record");
                    $(this).toggleClass("stopRecord");
                    startRecording();
                    isRecording = true;
                    $("#recordbox").show();
                }
            });

            $("#recordbox").hide();
        }

        var saveTimeWarp = function () {
            Windows.Storage.KnownFolders.documentsLibrary.createFileAsync(displayTime() + " TimeWarp.json", Windows.Storage.CreationCollisionOption.replaceExisting).done(
                function (file) {
                    snaplapse = timelapse.getSnaplapse();
                    Windows.Storage.FileIO.writeTextAsync(file, snaplapse.getAsJSON());
                });
        }

        var displayTime = function() {
            var str = "";

            var currentTime = new Date()
            var hours = currentTime.getHours()
            var minutes = currentTime.getMinutes()
            var seconds = currentTime.getSeconds()

            if (minutes < 10) {
                minutes = "0" + minutes
            }
            if (seconds < 10) {
                seconds = "0" + seconds
            }
            str += hours + "-" + minutes + "-" + seconds + " ";
            if(hours > 11){
                str += "PM"
            } else {
                str += "AM"
            }
            return str;
        }

        setupUI();
    };
})();