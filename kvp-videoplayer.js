var kvp = new (function () { // "kepe video player" namespace
////////////////////////////////////////////////////////

var infoOffDelay = this.infoOffDelay = 1; // delay in secs before info box goes off after a mouseleave
var int = this.int = 500;
var skipBy = this.skipBy = 10; // seconds to skip forward or backward
var velBy = this.velBy = 3; // x5 with every velocity increment
var autoOnDelay = this.autoOnDelay = 1; // in seconds
var autoOffDelay = this.autoOffDelay = 2.5;

var vwrap = this.vwrap = document.querySelector("#kvp-vwrap");
vwrap.tabIndex = 1;
vwrap.focus(); // this will allow it to receive key events
var v = this.v = document.querySelector("#kvp-thev");

// CREATE ELEMENTS
// outer container
var info = this.info = document.createElement("div");
info.id = "kvp-info";
// outer timeline
var tl = this.tl = document.createElement("div");
tl.id = "kvp-timeline";
// container for transient, automatic range types (buffered, played, etc) in timeline
// container is necessary for one-shot per frame reflow when creating and removing ranges
var ranges = this.ranges = document.createElement("div");
ranges.id = "kvp-ranges";
tl.appendChild(ranges);
// playhead
var ph = this.ph = document.createElement("div");
ph.id = "kvp-playhead";
tl.appendChild(ph);
info.appendChild(tl);
// video title
var vt = this.vt = document.createElement("div");
vt.id = "kvp-video-title";
vt.innerText = v.getAttribute("data-title");
info.appendChild(vt);
// time info
var ti = this.ti = document.createElement("div");
ti.id = "kvp-time-info";
// textual display for current time
var cur = this.cur = document.createElement("div");
ti.appendChild(cur);
// textual display for duration
var dur = this.dur = document.createElement("div");
ti.appendChild(dur);
// finally:
info.appendChild(ti);
vwrap.appendChild(info);

// initialize some values
// these will need to be reset anytime the window or video size changes
tl.rect = tl.getBoundingClientRect();
ph.rect = ph.getBoundingClientRect();


// RETRIEVE AND DISPLAY TIMES

// some utility functions
function zeroFill(num, fillTo) {
  num = String(num);
  while(fillTo - num.length) {
    num = "0" + num;
  }
  return num;
}

function formatTime(secs) {

  var h = Math.floor(secs / 3600);
  var m = Math.floor((secs / 60) - ((h * 3600) / 60));
  var s = secs - (h * 3600) - (m * 60);

  return zeroFill(h, 2) + ":" + zeroFill(m, 2) + ":" + zeroFill(s, 2);
}
//  initialize some values
cur.innerText = formatTime(0);


// seek object schema
var seek = this.seek = {
  init: 0, // timestamp of when action was initialized
  paused: v.paused,
  vel: 0, // basically 'play'
  auto: false
};


// frequency info for each main loop section
var freq = {
  ranges: {every: 250, last: null},
  playhead: {every: 250, last: null},
  autoseek: {every: 500, last: null}
};
// main animation loop for updating timeline and whatever else
function mainAnimLoop(timestamp) {

  // create and update range
  if (!freq.ranges.last || ((timestamp - freq.ranges.last) >= freq.ranges.every)) {
  
    freq.ranges.last = timestamp;
  
    var c = ranges;
    ranges = this.ranges = document.createElement('div');
    ranges.id = 'kvp-ranges';
  
    ["buffered", "played"].forEach(function (rangeType) {
  
      for (var i = 0; i < v[rangeType].length; i++) {
  
        var r = document.createElement('div');
        r.className = 'kvp-' + rangeType;
        var s = v[rangeType].start(i) / v.duration;
        var e = v[rangeType].end(i) / v.duration;
        r.style.left = tl.rect.width * s + "px";
        r.style.width = tl.rect.width * (e - s) + "px";
        ranges.appendChild(r);
      }
    });
    tl.replaceChild(ranges, c);
  }
  
  // play progress
  if (!freq.playhead.last || ((timestamp - freq.playhead.last) >= freq.playhead.every)) {
  
    freq.playhead.last = timestamp;
  
    if (v.currentTime != v.lastTime) {
      cur.innerText = formatTime(Math.floor(v.currentTime));
      if (!ph.dragging) ph.style.left = tl.rect.width * (v.currentTime / v.duration) - (ph.rect.width / 2) + "px";
      v.lastTime = v.currentTime;
    }
  }

  // handle seek
  if (!freq.autoseek.last || ((timestamp - freq.autoseek.last) >= freq.autoseek.every)) {
  
    freq.autoseek.last = timestamp;
    
    if (seek.auto) {
      v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seek.vel));
    }
  }
  window.requestAnimationFrame(mainAnimLoop.bind(this));
}
window.requestAnimationFrame(mainAnimLoop.bind(this));


/*
Do not use timeupdate event since it's dispatched too fast and with inconsistent timing,
which is dependent on system load and other factors.
Instead update timeline and related elements through much slower interval above.
    
v.addEventListener("timeupdate", function (e) {});
*/

v.addEventListener("durationchange", function (e) {
  dur.innerText = formatTime(Math.floor(v.duration));
});


vwrap.addEventListener("keydown", function (e) {

  e.preventDefault(); // prevents arrow keys from scrolling page and whatever else
  // The fact that this handler is attached to vwrap and not window means that it will not preventDefault when vwrap loses focus.

  if (/left|right/i.test(e.key)) {

    var dir = /left/i.test(e.key) ? -1 : 1;

    // initialize new seek
    if (!seek.vel) {
      seek.init = Date.now();
      seek.paused = v.paused;
      seek.vel = dir;
      seek.auto = false;
    }

    // turn on auto seek
    else if (!seek.auto && seek.init) {
      // time in seconds between now and init time
      seek.auto = (Date.now() - seek.init) >= (autoOnDelay * 1000);
      if (seek.auto && !v.paused) v.pause();
    }

    // shift seek velocity
    else if (seek.auto && !seek.init) {
      seek.init = Date.now(); // begin new timer
      // increment/decrement velocity
      // (dir * seek.vel) < 0 because negative * positive will always be negative
      // and vice versa, so if the product is negative, the vector has changed
      seek.vel *= (((dir * seek.vel) > 0) ? velBy : (1 / velBy));
      // (1 / velBy) inverts the number and shifts the velocity
    }

  }
});

vwrap.addEventListener("keyup", function (e) {

  // play/pause on keyup so it doesn't keep repeating, as it would on a keydown
  if (/\s/.test(e.key)) { // play/pause
    if (seek.vel) { // clear seek if one is in progress
      seek.init = 0;
      seek.vel = 0;
      seek.auto = false;
    }
    v[v.paused ? "play" : "pause"]();
  }
  else if (/home/i.test(e.key)) v.currentTime = 0;
  else if (/end/i.test(e.key)) v.currentTime = v.duration;
  // chapter markers
  else if (/pageup|arrowup/i.test(e.key));
  else if (/pagedown|arrowdown/i.test(e.key));
  else if (/left|right/i.test(e.key)) {

    var dir = /left/i.test(e.key) ? -1 : 1;

    if (!seek.auto) {
      seek.init = 0;
      v.currentTime += dir * skipBy;
    }
    else if (seek.auto && seek.init &&
          ((Date.now() - seek.init) >= (autoOffDelay * 1000))) {
      // reset all
      seek.init = 0;
      seek.vel = 0;
      seek.auto = false;
      seek.paused || v.play();
    }
    else if (seek.auto && seek.init) {
      seek.init = 0;
    }
  }
});

function timelineInput(e) {

  if ((e.target == ph) && (e.type == 'mousedown')) {
    ph.dragging = true;
    ph.cursorX = e.offsetX;
  }
  if (ph.dragging && (e.type == 'mouseup')) {
    ph.dragging = false;
    v.currentTime = v.duration * ((ph.offsetLeft + (ph.rect.width / 2)) / tl.rect.width);
  }
  if (ph.dragging && e.type == 'mousemove') {
    ph.style.left = Math.max(-ph.rect.width / 2, Math.min(tl.rect.width - (ph.rect.width / 2), e.clientX - tl.rect.left - ph.cursorX)) + "px";
  }
  if (e.type == 'click') {
    v.currentTime = v.duration * ((e.clientX - tl.rect.left) / tl.rect.width);
  }
}


window.addEventListener('mousedown', timelineInput);
window.addEventListener('mouseup', timelineInput);
window.addEventListener('mousemove', function (e) {
  if (!ph.dragging) return;
  // throttle mousemove events to refresh rate
  ph.moved = ('moved' in ph) ? ph.moved : true;
  if (ph.moved) {
    ph.moved = false;
    window.requestAnimationFrame(function () {
      timelineInput(e);
      ph.moved = true;
    });
  }
});
tl.addEventListener('click', timelineInput);
ph.addEventListener('dblclick', timelineInput);


// FOCUS SETTING
vwrap.addEventListener("mouseenter", function (e) {
  clearTimeout(info.timeout);
  info.className = "on";
});
vwrap.addEventListener("mouseleave", function (e) {

  info.timeout = setTimeout(function () {
    info.className = "off";
  }, infoOffDelay * 1000);
});

//////////////////////////////////////////////
})();// end kvp namespace/object and start'r up
