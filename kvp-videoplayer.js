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
// container for buffered ranges in timeline
var buf = this.buf = document.createElement("div");
// ranges of buffered segments in timeline
buf.id = "kvp-buffered-ranges";
tl.appendChild(buf);
// ranges of played segments in timeline
var played = this.played = document.createElement("div");
played.id = "kvp-played-ranges";
tl.appendChild(played);
// ranges of highlighted segments in timeline
var highlights = this.highlights = document.createElement("div");
highlights.id = "kvp-highlight-ranges";
tl.appendChild(highlights);
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


var mainInt = setInterval(function () {

  // update timeline

  // buffered ranges
  for (var i = 0; i < v.buffered.length; i++) {
    // go through any possible ranges that already exist
    // if the current one shares a start time with an existing one, do not create new
    var rgs = buf.querySelectorAll(".kvp-buffered");
    var exists = function () {
      for (var j in rgs) {
        if (rgs[j].s == v.buffered.start(i)) return rgs[j];
      }
      return null;
    }();
    var r = function () {
      if (exists) return exists;
      var d = document.createElement("div");
      d.className = "kvp-buffered";
      buf.appendChild(d);
      return d;
    }();
    r.s = v.buffered.start(i);
    r.e = v.buffered.end(i);
    var s = r.s / v.duration;
    var e = r.e / v.duration;
    r.style.left = tl.rect.width * s + "px";
    r.style.width = tl.rect.width * (e - s) + "px";
  }

  // play progress
  if (v.currentTime != v.lastTime) { // careful references v.lastTime before it's been declared. May cause problems in strict mode
    cur.innerText = formatTime(Math.floor(v.currentTime));
    if (!ph.dragging) ph.style.left = (tl.rect.width - ph.rect.width) * (v.currentTime / v.duration) + "px";
    v.lastTime = v.currentTime;
  }

  // handle seek
  if (seek.auto) {
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seek.vel));
  }
}, int);



v.addEventListener("timeupdate", function (e) {
  /*
    Do not use timeupdate event since it's dispatched too fast and with inconsistent timing,
    which is dependent on system load and other factors.
    Instead update timeline and related elements through much slower interval above.
  */
});

v.addEventListener("durationchange", function (e) {
  dur.innerText = formatTime(Math.floor(v.duration));
});


// CONTROLS

// navigation:
// spacebar will play/pause
// l/r arrow keys to skip ahead and back 10 seconds
// hold l/r for 1+ sec to auto-seek
// hitting l/r while in auto-seek will increase/decrease seek velocity
// home/end will go to beginning and end
// pageup/pagedown will scrub chapter markers
// mousewheel to scrub chapter markers; left or middle mouse button to apply, right button or esc key to cancel

/*
ideas:
localStorage for storing user-based placeholders in video.
Fragment identifier (#) addresses for linking to specific time/placeholder, idk.
Maybe pageup/pagedown will cycle through them.
Then, if video has chapter markers, up/down to cycle through them.

localStorage for highlights
pageUp/pageDown cycles through highlights

double-clicking playhead will copy the current location into the clipboard or fill out any focused text field with that value.


*/

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
    v.currentTime = v.duration * (ph.offsetLeft / (tl.rect.width - ph.rect.width));
  }
  if (ph.dragging && e.type == 'mousemove') {
    ph.style.left = (tl.rect.width - ph.rect.width) * Math.max(0, Math.min(1, (e.clientX - tl.rect.left - ph.cursorX) / (tl.rect.width - ph.rect.width))) + "px";
  }
  if (e.type == 'click') {
    //console.log(e.target);
    v.currentTime = v.duration * ((e.clientX - tl.rect.left) / tl.rect.width);
  }
}


window.addEventListener('mousedown', timelineInput);
window.addEventListener('mouseup', timelineInput);
window.addEventListener('mousemove', timelineInput);
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
