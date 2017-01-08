var method = Light.prototype;

var _ = require('lodash')
  , hue = require("node-hue-api")
  , lightState = hue.lightState
  , async = require("async")
;

const PROCESS = 'PROCESS';
const HUE     = 'HUE';
// Light states
const brightness = 100;
const saturation = 255;
const hueRED     = 0;
const hueGREEN   = 25500;
const hueBLUE    = 46920;
const ON         = 'ON';
const OFF        = 'OFF';
const BLINKING   = 'BLINKING';
var sON          = lightState.create().turnOn().bri(brightness).sat(saturation);
var sOFF         = lightState.create().turnOff();
var sBLINK       = lightState.create().alert('select');

function Light(hueapi, data, status, log) {
  this._hueapi = hueapi;
  this._log    = log;
  this._light  = data;
  this._status = status;
  this._blinkTimer = _.noop();
}

method.get = function() {
  return {
    id: this._light.id,
    name: this._light.name,
    reachable: this._light.reachable,
    status: this._status
  }
}

method.on = function(color) {
  var self = this;
  return new Promise((resolve, reject) => {
    self._log.verbose(HUE, "ON request for " + self._light.name + " on " + color);
    if ( !self._light.reachable) {
      resolve("Light '" + self._light.name + "' not reachable");
      return;
    }
    if ( self._status === ON && self._light.color === color) {
      resolve("Light '" + self._light.name + "' ON and already on requested color, nothing to do.");
      return;
    }
    if ( self._status === BLINKING) {
      // Stop blink before setting the color
      self._log.verbose(HUE, "Stopping blinking first...");
      clearInterval(self._blinkTimer);
      self._status = OFF;
      self._light.color = _.noop();
    }
    self._hueapi.setLightState(self._light.id, sON.hue(color))
    .then((result) => {
      self._status = ON;
      self._light.color = color;
      resolve(null);
    })
    .fail((err) => {
      reject(err);
    });
  });
}

method.off = function() {
  var self = this;
  return new Promise((resolve, reject) => {
    self._log.verbose(HUE, "OFF request for " + self._light.name);
    if ( !self._light.reachable) {
      resolve("Light '" + self._light.name + "' not reachable");
      return;
    }
    if ( self._status === OFF) {
      resolve("Light '" + self._light.name + "' already OFF, nothing to do.");
      return;
    }
    if ( self._status === BLINKING) {
      // Stop blink
      self._log.verbose(HUE, "Stopping blinking first...");
      clearInterval(self._blinkTimer);
    }
    self._hueapi.setLightState(self._light.id, sOFF)
    .then((result) => {
      self._status = OFF;
      self._light.color = _.noop();
      resolve();
    })
    .fail((err) => {
      reject(err);
    });
  });
}

method.blink = function(color) {
  var self = this;
  return new Promise((resolve, reject) => {
    self._log.verbose(HUE, "BLINK request for " + self._light.name + " on " + color);
    if ( !self._light.reachable) {
      resolve("Light '" + self._light.name + "' not reachable");
      return;
    }
    if ( self._status === BLINKING) {
      if ( self.light.color === color) {
        resolve("Light '" + self._light.name + "' already blinking onthe requested color, nothing to do.");
        return;
      } else {
        clearInterval(this._blinkTimer);
        self._status = OFF;
        self._light.color = _.noop();
      }
    }
    async.series([
      function(callback) {
        if ( self._status === ON && self._light.color !== color) {
          self.off()
          .then((result) => {
            callback(null)
          })
          .catch((err) => {
            reject(err);
            return;
          });
        } else {
          callback(null);
        }
      },
      function(callback) {
        if ( self._status === OFF) {
          self.on(color)
          .then((result) => {
            callback(null);
          })
          .catch((err) => {
            reject(err);
            return;
          });
        } else {
          callback(null);
        }
      },
      function(callback) {
        if ( self._status === ON && self._light.color === color) {
          self._blinkTimer = setInterval(() => {
            self._hueapi.setLightState(self._light.id, sBLINK)
            .fail((err) => {
              clearInterval(self._blinkTimer);
              reject(err);
            })
            .done();
          }, 1000);
          self._status = BLINKING;
          callback(null);
        } else {
          callback(null);
        }
      }
    ],
    function(err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
}

module.exports = Light;
