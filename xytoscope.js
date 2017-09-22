function xytoscope(vwrap, settings) { // 'kepe video player' namespace
////////////////////////////////////////////////////////
var uiOffDelay = this.uiOffDelay = settings.uiOffDelay || 1; // delay in secs before ui box goes off after a mouseleave
var skipBy = this.skipBy = settings.skipBy || 10; // seconds to skip forward or backward
var velBy = this.velBy = settings.velBy || 3; // factor to multiply seek velocity by at each increment
var autoOnDelay = this.autoOnDelay = settings.autoOnDelay || 1; // in seconds
var autoOffDelay = this.autoOffDelay = settings.autoOffDelay || 2.5;

this.vwrap = vwrap;
vwrap.tabIndex = 1;
vwrap.focus(); // this will allow it to receive key events
var v = this.v = vwrap.querySelector('video');

// CREATE ELEMENTS
// outer container
var ui = this.ui = document.createElement('div');
ui.className = 'xyt-ui';
ui.innerHTML = '\
<div class="xyt-timeline">\
  <div class="xyt-ranges"></div>\
  <div class="xyt-playhead"></div>\
</div>\
<div class="xyt-video-title"></div>\
<div class="xyt-add-highlight-button"></div>\
<div class="xyt-time-info">\
  <div class="xyt-current-time"></div>\
  <div class="xyt-duration"></div>\
</div>\
<div class="xyt-highlight-edit">\
  <div>\
    <textarea class="xyt-highlight-edit-note" placeholder="Leave your note here."></textarea>\
  </div>\
  <div>\
    <input class="xyt-highlight-edit-start" type="text" placeholder="start time">\
    <input class="xyt-highlight-edit-end" type="text" placeholder="end time">\
  </div>\
  <div>\
    <div class="xyt-highlight-edit-save">SAVE</div>\
    <div class="xyt-highlight-edit-discard">DISCARD</div>\
    <div class="xyt-highlight-edit-cancel">CANCEL</div>\
  </div>\
</div>\
'.replace(/>[\s\t\n]*([^<>\s\t\n]+(?:\s+[^<>\s\t\n]+)*)?[\s\t\n]*</g, '>$1<');


vwrap.appendChild(ui);
var tl = this.tl = ui.querySelector('.xyt-timeline');
var ranges = this.ranges = ui.querySelector('.xyt-ranges');
var ph = this.ph = ui.querySelector('.xyt-playhead');
ph.w = ph.getBoundingClientRect().width;
var vt = this.vt = ui.querySelector('.xyt-video-title');
var ti = this.ti = ui.querySelector('.xyt-time-info');
var cur = this.cur = ui.querySelector('.xyt-current-time');
var dur = this.dur = ui.querySelector('.xyt-duration');
var hledit = this.hledit = ui.querySelector('.xyt-highlight-edit');
hledit.note = hledit.querySelector('.xyt-highlight-edit-note');
hledit.start = hledit.querySelector('.xyt-highlight-edit-start');
hledit.end = hledit.querySelector('.xyt-highlight-edit-end');
hledit.save = hledit.querySelector('.xyt-highlight-edit-save');
hledit.discard = hledit.querySelector('.xyt-highlight-edit-discard');
hledit.cancel = hledit.querySelector('.xyt-highlight-edit-cancel');


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
  ranges.className = 'xyt-ranges';

  ['buffered', 'played'].forEach(function (rangeType) {

    for (var i = 0; i < v[rangeType].length; i++) {

      var r = document.createElement('div');
      r.className = 'xyt-' + rangeType;
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
var autoseek = this.autoseek = {
  init: 0, // timestamp of when action was initialized
  paused: v.paused,
  vel: 0
};

// autoseek - it's alive!
anim.addToFrame(function () {

  if (autoseek.vel) {
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + autoseek.vel));
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

    // we have to store the dir for use in the keyup event
    autoseek.dir = /left/i.test(e.key) ? -1 : 1;

    // initialize new seek
    if (!autoseek.vel && !autoseek.init) {
      autoseek.init = Date.now();
      autoseek.paused = v.paused;
    }

    // turn on auto seek
    if (!autoseek.vel && autoseek.init &&
       (Date.now() - autoseek.init) >= (autoOnDelay * 1000)) {
      autoseek.vel = autoseek.dir;
      if (!v.paused) v.pause();
    }

    // shift seek velocity
    else if (autoseek.vel && !autoseek.init) {
      autoseek.init = Date.now();
      // (dir * autoseek.vel): different signs = negative product
      // so if the product is negative, the vector has changed
      // if vector has changed, (1 / velBy) inverts the factor shifting the velocity backward
      // parseInt prevents fractional values
      // '|| -seek.vel' prevents vel from ever hitting 0 and instead flips the sign
      autoseek.vel = parseInt(autoseek.vel * (((autoseek.dir * autoseek.vel) > 0) ? velBy : (1 / velBy))) || -autoseek.vel;
    }

  }
});

vwrap.addEventListener('keyup', function (e) {

  // play/pause on keyup so it doesn't keep repeating, as it would on a keydown
  if (/\s/.test(e.key)) { // play/pause
    if (autoseek.vel) { // clear seek if one is in progress
      autoseek.init = 0;
      autoseek.vel = 0;
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

    if (!autoseek.vel) {
      v.currentTime += dir * skipBy;
    }

    if (autoseek.vel && autoseek.init &&
       ((Date.now() - autoseek.init) >= (autoOffDelay * 1000))) {
      autoseek.vel = 0;
      autoseek.paused || v.play();
    }
    // make sure the button being released is the same
    // as the one currently affecting the velocity
    if ((dir * autoseek.dir) > 0) {
      autoseek.init = 0;
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


// show/hide ui
vwrap.addEventListener('mouseenter', function (e) {
  clearTimeout(ui.timeout);
  ui.className = ui.className.replace(/\soff|\son|$/, ' on');
});
vwrap.addEventListener('mouseleave', function (e) {

  ui.timeout = setTimeout(function () {
    ui.className = ui.className.replace(/\son|\soff|$/, ' off');
  }, uiOffDelay * 1000);
});


// END xyt VIDEO PLAYER CLASS /////////////////
}

document.addEventListener('DOMContentLoaded', function (e) {
    var vs = document.querySelectorAll('[data-xytoscope]');
    [].forEach.call(vs, function (item) {
      try {
        var settings = JSON.parse(item.getAttribute('data-xytoscope'));
      }
      catch (e) {
        return;
      }
      item.querySelector('video').addEventListener('loadeddata', function(e) {
        (window.xyt = window.xyt || []).push(new xytoscope(item, settings));
      });
    });
});
