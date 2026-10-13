'use strict';
let _pause   = () => {};
let _resume  = () => {};
let _resumed = false;
let _busy    = false;

function register(pause, resume) { _pause = pause; _resume = resume; }

function pauseCLI()  {
  _busy    = true;
  _resumed = false;
  _pause();
}

function resumeCLI() {
  _busy    = false;
  _resumed = true;
  _resume();
}

function isBusy() { return _busy; }

function wasResumed() {
  const v = _resumed;
  _resumed = false;
  return v;
}

module.exports = { register, pauseCLI, resumeCLI, isBusy, wasResumed };
