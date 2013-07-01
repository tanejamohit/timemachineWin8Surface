/*
 Class for managing mobile device interactions on windows 8.

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
 Yen-Chia Hsu (legenddolphin@gmail.com)

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
    var noVideosetMsg = "The org.gigapan.timelapse.Videoset library is required by org.gigapan.timelapse.MobileDeviceInteraction_Win8";
    alert(noVideosetMsg);
    throw new Error(noVideosetMsg);
}

//
// CODE
//
(function () {
    org.gigapan.timelapse.MobileDeviceInteraction_Win8 = function (timelapse) {
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // Class variables
        //	
        var viewerDivId = timelapse.getViewerDivId();
        //DOM
        var viewerDivDOM = document.getElementById(viewerDivId);
        var $zoomSpeedSlider;
        //sensors
        var gyrometer;
        var accelerometer;
        //gyrometer readings
        var alpha = 0;
        var beta = 0;
        var gamma = 0;
        //accelerometer readings
        var ax = 0;
        var ay = 0;
        var az = 0;
        //gyrometer control parameters
        var panSpeedRatio_gyro = 0.2;
        //sensor report frequency
        var minimumReportInterval = 500;
        var reportInterval;
        //warp control
        var warpDelta_setTimeout = null;
        var warpDelta_setTimeout_Hz = 150;
        //rocker switch
        var zoomRocker_setInterval = null
        var zoomRocker_setInterval_Hz = 150;
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // Private methods
        //
        var setupUI = function () {
            //add UI
            var zoomSpeedSliderContainer = document.createElement("div");
            var zoomSpeedSlider = document.createElement("div");
            var $zoomSpeedSliderContainer = $(zoomSpeedSliderContainer);
            $zoomSpeedSlider = $(zoomSpeedSlider);
            $zoomSpeedSlider.addClass("zoomSpeedSlider");
            $zoomSpeedSliderContainer.addClass("zoomSpeedSliderContainer");
            $zoomSpeedSliderContainer.append(zoomSpeedSlider);
            $(document.body).append(zoomSpeedSliderContainer);
            $zoomSpeedSlider.slider({
                orientation: "vertical",
                value: 1,
                min: 0.99,
                max: 1.01,
                step: 0.0001,
                slide: function (e, ui) {
                }
            }).removeClass("ui-corner-all");
            $zoomSpeedSlider.children().removeClass("ui-corner-all");
            document.body.addEventListener("MSPointerUp", function () {
                $zoomSpeedSlider.slider({ value: 1 });
                if (zoomRocker_setInterval != null) {
                    stopZooming();
                }
            });
            zoomSpeedSlider.addEventListener("MSPointerDown", function () {
                if (zoomRocker_setInterval == null) {
                    keepZooming();
                }
            });
        };
        //keep zooming
        var keepZooming = function () {
            zoomRocker_setInterval = setInterval(function () {
                warpDelta_setTimeout = 1; //prevent warping from onDataChangedGyro
                timelapse.warpDelta(beta * -1 * panSpeedRatio_gyro, alpha * -1 * panSpeedRatio_gyro, $zoomSpeedSlider.slider("value"));
            }, 1000 / zoomRocker_setInterval_Hz);
        };
        //stop zooming
        var stopZooming = function () {
            clearInterval(zoomRocker_setInterval);
            zoomRocker_setInterval = null;
            warpDelta_setTimeout = null;
        };
        //initialize the gesture manager
        var initGestureManager = function () {
            var gesture = new MSGesture();
            gesture.target = viewerDivDOM;
            gesture.srcElt = viewerDivDOM;
            viewerDivDOM.gesture = gesture;
            //Expando property to capture pointer type to handle multiple pointer sources
            viewerDivDOM.gesture.pointerType = null;
            // Creating event listeners
            document.body.addEventListener("MSPointerUp", onPointerUpBody, false);
            document.body.addEventListener("MSPointerCancel", onPointerCancelBody, false);
            viewerDivDOM.addEventListener("MSPointerDown", onPointerDown, false);
            //viewerDivDOM.addEventListener("MSGestureHold", onHold, false);
            viewerDivDOM.addEventListener("MSGestureTap", onTap, false);
            viewerDivDOM.addEventListener("MSGestureChange", onGestureChange, false);
            viewerDivDOM.addEventListener("MSGestureEnd", onGestureEnd, false);
        };
        //Handler for pointer cancel on gesture element
        function onPointerCancelBody(e) {
            enableSensor();
            if (e.pointerType == e.MSPOINTER_TYPE_TOUCH) {
                e.preventDefault();
            }
        }
        //Handler for pointer up on gesture element
        function onPointerUpBody(e) {
            enableSensor();
            if (e.pointerType == e.MSPOINTER_TYPE_TOUCH) {
                e.preventDefault();
            }
        }
        //Handler for pointer down on gesture element
        function onPointerDown(e) {
            disableSensor();
            if (e.pointerType == e.MSPOINTER_TYPE_TOUCH) {
                e.preventDefault();
                if (viewerDivDOM.gesture.pointerType === null) {
                    // First contact
                    // Attaches pointer to element (e.target is the element)
                    viewerDivDOM.gesture.addPointer(e.pointerId);
                    viewerDivDOM.gesture.pointerType = e.pointerType;
                }
                else if (viewerDivDOM.gesture.pointerType === e.pointerType) {
                    // Contacts of similar type
                    // Attaches pointer to element (e.target is the element)
                    viewerDivDOM.gesture.addPointer(e.pointerId);
                }
            }
        };
        //Handler for Hold gesture on gesture elements
        function onHold(e) {
            e.preventDefault();
            if (e.pointerType == e.MSPOINTER_TYPE_TOUCH) {
                if (e.detail === e.MSGESTURE_FLAG_END) {
                    // MSGestureEnd isn't generated at the end of Hold
                    onGestureEnd(e);
                }
            }
        };
        // Handler for Tap gesture on gesture elements - Elements change color onTap
        function onTap(e) {
            e.preventDefault();
            if (e.pointerType == e.MSPOINTER_TYPE_TOUCH) {
                // MSGestureEnd isn't generated at the end of Tap
                onGestureEnd(e);
            }
        };
        // Handler for transformation on gesture elements
        function onGestureChange(e) {
            e.preventDefault();
            if (e.pointerType == e.MSPOINTER_TYPE_TOUCH) {
                var scale = e.scale;
                if (scale > 0.9999 && scale < 1.0001 ) {
                    scale = 1;
                }
                if (warpDelta_setTimeout == null) {
                    warpDelta_setTimeout = setTimeout(function () {
                        warpDelta_setTimeout = null;
                        timelapse.warpDelta(e.translationX * -1, e.translationY * -1, scale);
                    }, 1000 / warpDelta_setTimeout_Hz);
                }
            }
        };
        // Handler for gesture end for both body and elements
        function onGestureEnd(e) {
            e.preventDefault();
            if (e.pointerType == e.MSPOINTER_TYPE_TOUCH) {
                viewerDivDOM.gesture.pointerType = null;
            }
        };
        //initialize the gyrometer
        var initGyrometer = function (mode) {
            gyrometer = Windows.Devices.Sensors.Gyrometer.getDefault();
            if (gyrometer != null) {
                // Choose a report interval supported by the sensor
                minimumReportInterval = gyrometer.minimumReportInterval;
                reportInterval = minimumReportInterval > 16 ? minimumReportInterval : 16;
                gyrometer.reportInterval = reportInterval;
                // Establish the event handler
                enableGyrometer();
            }
        };
        //disable the gyrometer
        var disableGyrometer = function () {
            gyrometer.removeEventListener("readingchanged", onDataChangedGyro);
        };
        //enable the gyrometer
        var enableGyrometer = function () {
            gyrometer.addEventListener("readingchanged", onDataChangedGyro);
        };
        //read data from the gyrometer
        var onDataChangedGyro = function (e) {
            var reading = e.reading;
            alpha = reading.angularVelocityX;
            beta = reading.angularVelocityY;
            //gamma = reading.angularVelocityZ;
            if (warpDelta_setTimeout == null) {
                warpDelta_setTimeout = setTimeout(function () {
                    warpDelta_setTimeout = null;
                    timelapse.warpDelta(beta * -1 * panSpeedRatio_gyro, alpha * -1 * panSpeedRatio_gyro, $zoomSpeedSlider.slider("value"));
                }, 1000 / warpDelta_setTimeout_Hz);
            }
        };
        //initialize the accelerometer
        var initAccelerometer = function () {
            accelerometer = Windows.Devices.Sensors.Accelerometer.getDefault();
            if (accelerometer != null) {
                // Establish the report interval
                minimumReportInterval = accelerometer.minimumReportInterval;
                reportInterval = minimumReportInterval > 16 ? minimumReportInterval : 16;
                accelerometer.reportInterval = reportInterval;
                // Establish the event handler
                enableAccelerometer();
            }
        }
        //disable the accelerometer
        var disableAccelerometer = function () {
            accelerometer.removeEventListener("readingchanged", onDataChangedAcc);
        };
        //enable the accelerometer
        var enableAccelerometer = function () {
            accelerometer.addEventListener("readingchanged", onDataChangedAcc);
        };
        function onDataChangedAcc(e) {
            var reading = e.reading;
            //ax = reading.accelerationX;
            //ay = reading.accelerationY;
            az = reading.accelerationZ;
        }
        //initialize the sensor control
        var initSensor = function () {
            initGyrometer();
            //initAccelerometer();
        };
        //enable the sensor control
        var enableSensor = function () {
            enableGyrometer();
            //enableAccelerometer();
        };
        //disable the sensor control
        var disableSensor = function () {
            disableGyrometer();
            //disableAccelerometer();
        };

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // Public methods
        //

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // Constructor code
        //
        setupUI();
        initGestureManager();
        initSensor();
    };
    //end of org.gigapan.timelapse.MobileDeviceInteraction_Win8
})();
//end of (function() {