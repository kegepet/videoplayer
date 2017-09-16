function kvp_videoplayer(vwrap) { // 'kepe video player' namespace
////////////////////////////////////////////////////////
var uiOffDelay = this.uiOffDelay = 1; // delay in secs before ui box goes off after a mouseleave
var skipBy = this.skipBy = 10; // seconds to skip forward or backward
var velBy = this.velBy = 3; // x5 with every velocity increment
var autoOnDelay = this.autoOnDelay = 1; // in seconds
var autoOffDelay = this.autoOffDelay = 2.5;

this.vwrap = vwrap;
vwrap.tabIndex = 1;
vwrap.focus(); // this will allow it to receive key events
var v = this.v = vwrap.querySelector('video');

// CREATE ELEMENTS
// outer container
var ui = this.ui = document.createElement('div');
ui.className = 'kvp-ui';
ui.innerHTML = '\
<div class="kvp-timeline">\
  <div class="kvp-ranges"></div>\
  <div class="kvp-playhead"></div>\
</div>\
<div class="kvp-video-title"></div>\
<div class="kvp-add-highlight-button"></div>\
<div class="kvp-time-info">\
  <div class="kvp-current-time"></div>\
  <div class="kvp-duration"></div>\
</div>\
<div class="kvp-highlight-edit">\
  <div>\
    <textarea class="kvp-highlight-edit-note" placeholder="Leave your note here."></textarea>\
  </div>\
  <div>\
    <input class="kvp-highlight-edit-start" type="text" placeholder="start time">\
    <input class="kvp-highlight-edit-end" type="text" placeholder="end time">\
  </div>\
  <div>\
    <div class="kvp-highlight-edit-save">SAVE</div>\
    <div class="kvp-highlight-edit-discard">DISCARD</div>\
    <div class="kvp-highlight-edit-cancel">CANCEL</div>\
  </div>\
</div>\
'.replace(/>[\s\t\n]*([^<>\s\t\n]+(?:\s+[^<>\s\t\n]+)*)?[\s\t\n]*</g, '>$1<');


vwrap.appendChild(ui);
var tl = this.tl = ui.querySelector('.kvp-timeline');
var ranges = this.ranges = ui.querySelector('.kvp-ranges');
var ph = this.ph = ui.querySelector('.kvp-playhead');
ph.w = ph.getBoundingClientRect().width;
var vt = this.vt = ui.querySelector('.kvp-video-title');
var ti = this.ti = ui.querySelector('.kvp-time-info');
var cur = this.cur = ui.querySelector('.kvp-current-time');
var dur = this.dur = ui.querySelector('.kvp-duration');
var hledit = this.hledit = ui.querySelector('.kvp-highlight-edit');
hledit.note = hledit.querySelector('.kvp-highlight-edit-note');
hledit.start = hledit.querySelector('.kvp-highlight-edit-start');
hledit.end = hledit.querySelector('.kvp-highlight-edit-end');
hledit.save = hledit.querySelector('.kvp-highlight-edit-save');
hledit.discard = hledit.querySelector('.kvp-highlight-edit-discard');
hledit.cancel = hledit.querySelector('.kvp-highlight-edit-cancel');


// reuseable utility internals

function zeroFill(num, fillTo) {
  num = String(num);
  while(fillTo - num.length) {
    num = '0' + num;
  }
  return num;
}

function formatTime(secs) {

  var h = Math.floor(secs / 3600);
  var m = Math.floor((secs / 60) - ((h * 3600) / 60));
  var s = secs - (h * 3600) - (m * 60);

  return zeroFill(h, 2) + ':' + zeroFill(m, 2) + ':' + zeroFill(s, 2);
}

// main animation loop
// call anim.addToFrame(callback, every) as needed
var anim = new (function () {

  var toAnimate = [];
  this.addToFrame = function (callback, every) {
    toAnimate.push({every: every, last: 0, callback: callback});
  }
  window.requestAnimationFrame(function (timestamp) {

    toAnimate.forEach(function (item, i) {

      if (!item.every) {
        item.callback();
        toAnimate.splice(i, 1);
        return;
      }

      if ((timestamp - item.last) >= item.every) {
        item.last = timestamp;
        item.callback();
      }
    });
    window.requestAnimationFrame(arguments.callee);
  });
})();



// playhead - it's alive!
anim.addToFrame(function () {

  if ((dur.time != v.duration) || !dur.time) {
    dur.innerText = formatTime(Math.floor(dur.time = v.duration));
  }
  if ((cur.time != v.currentTime) || !cur.time) {
    cur.innerText = formatTime(Math.floor(cur.time = v.currentTime));
    if (ph.dragging) return;
    tl.rect = tl.getBoundingClientRect();
    ph.style.left = tl.rect.width * (v.currentTime / v.duration) - (ph.w / 2) + 'px';
  }
}, 250);


// ranges - it's alive!
anim.addToFrame(function () {

  tl.rect = tl.getBoundingClientRect();
  var c = ranges;
  ranges = this.ranges = document.createElement('div');
  ranges.className = 'kvp-ranges';

  ['buffered', 'played'].forEach(function (rangeType) {

    for (var i = 0; i < v[rangeType].length; i++) {

      var r = document.createElement('div');
      r.className = 'kvp-' + rangeType;
      var s = v[rangeType].start(i) / v.duration;
      var e = v[rangeType].end(i) / v.duration;
      r.style.left = tl.rect.width * s + 'px';
      r.style.width = tl.rect.width * (e - s) + 'px';
      ranges.appendChild(r);
    }
  });
  tl.replaceChild(ranges, c);
}.bind(this), 250);


// autoseek object
var seek = this.seek = {
  init: 0, // timestamp of when action was initialized
  paused: v.paused,
  vel: 0, // basically 'play'
  auto: false
};

// autoseek - it's alive!
anim.addToFrame(function () {

  if (seek.auto) {
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seek.vel));
  }
}, 250);


/*
Leaving this bit in just for future reference:
The functionality of these two events seems better handled
by just polling regularly through the main loop.
'timeupdate' is dispatched too frequently and inconsistently.
'durationchange' seems problematic in that it sometimes
doesn't dispatch at all (or maybe too soon),
especially when running locally. I could put this code in a
'DOMContentLoaded' or window 'load' event, but, again,
the main loop works fine, it's running anyway, and
it's synced to the refresh rate.

v.addEventListener('timeupdate', function (e) {});
v.addEventListener('durationchange', function (e) {});
*/

vwrap.addEventListener('keydown', function (e) {

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
      // (1 / velBy) inverts the number and shifts the velocity
      // the || -seek.vel prevents it from ever getting to a fraction or 0, and instead flips it
      // so the next step backward from 1 is -1 and vice versa
      seek.vel = parseInt(seek.vel * ((dir * seek.vel) > 0) ? velBy : (1 / velBy)) || -seek.vel;
    }

  }
});

vwrap.addEventListener('keyup', function (e) {

  // play/pause on keyup so it doesn't keep repeating, as it would on a keydown
  if (/\s/.test(e.key)) { // play/pause
    if (seek.vel) { // clear seek if one is in progress
      seek.init = 0;
      seek.vel = 0;
      seek.auto = false;
    }
    v[v.paused ? 'play' : 'pause']();
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

  if (tl.contains(e.target) && (e.type == 'mousedown')) {
    ph.dragging = true;
    tl.rect = tl.getBoundingClientRect();
    if (e.target == ph) {
      ph.cursorX = e.offsetX;
    }
    else {
      ph.cursorX = ph.w / 2;
      ph.style.left = e.clientX - tl.rect.left - ph.cursorX + "px";
      v.currentTime = v.duration * ((e.clientX - tl.rect.left) / tl.rect.width);
    }
  }
  else if (ph.dragging && (e.type == 'mouseup')) {
    ph.dragging = false;
    v.currentTime = v.duration * ((ph.offsetLeft + (ph.w / 2)) / tl.rect.width);
  }
  else if (ph.dragging && (e.type == 'mousemove')) {
    ph.style.left = Math.max(-ph.w / 2, Math.min(tl.rect.width - (ph.w / 2), e.clientX - tl.rect.left - ph.cursorX)) + 'px';
  }
}


window.addEventListener('mousedown', timelineInput);
window.addEventListener('mouseup', timelineInput);
window.addEventListener('mousemove', function (e) {
  if (!ph.dragging) return;
  // throttle mousemove events to refresh rate
  if (!('moved' in ph)) ph.moved = true;
  if (!ph.moved) return;
  ph.moved = false;
  window.requestAnimationFrame(function () {
    timelineInput(e);
    ph.moved = true;
  });
});


// control panel/timeline visibility
vwrap.addEventListener('mouseenter', function (e) {
  clearTimeout(ui.timeout);
  ui.className = ui.className.replace(/\soff|\son|$/, ' on');
});
vwrap.addEventListener('mouseleave', function (e) {

  ui.timeout = setTimeout(function () {
    ui.className = ui.className.replace(/\son|\soff|$/, ' off');
  }, uiOffDelay * 1000);
});


// END KVP VIDEO PLAYER CLASS /////////////////
}

window.addEventListener('load', function (e) {
  //setTimeout(function () {
    this.kvp = new kvp_videoplayer(document.querySelector('.kvp-vwrap'));
  //}, 100);
}.bind(this));
