'use strict';

// Module imports
var log = require('npmlog-ts')
  , hue = require("node-hue-api")
  , lightState = hue.lightState
  , HueApi = require("node-hue-api").HueApi
  , Light = require('./light')
;

const  commandLineArgs = require('command-line-args')
     , getUsage = require('command-line-usage')
     , async = require('async')
     , express = require('express')
     , http = require('http')
     , bodyParser = require('body-parser')
     , util = require('util')
     , _ = require('lodash')
;

// Initialize input arguments
const sections = [
  {
    header: 'IoT Racing - Philips Hue Wrapper',
    content: 'Wrapper to control Philips Hue Lights'
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'huebridge',
        typeLabel: '[underline]{IP address or hostname}',
        alias: 'h',
        type: String,
        description: 'HUE Bridge fixed IP address or hostbname'
      },
      {
        name: 'timeout',
        typeLabel: '[underline]{Timeout in milliseconds}',
        alias: 't',
        type: Number,
        description: 'Communications timeout.'
      },
      {
        name: 'verbose',
        alias: 'v',
        description: 'Enable verbose logging.'
      }
    ]
  }
]

const optionDefinitions = [
  { name: 'verbose', alias: 'v', type: Boolean },
  { name: 'huebridge', alias: 'h', type: String, defaultOption: false },
  { name: 'timeout', alias: 't', type:Number }
]
var options = undefined;
try {
  options = commandLineArgs(optionDefinitions);
} catch (e) {
  console.log(getUsage(sections));
  console.log(e.message);
  process.exit(-1);
}

const timeout = options.timeout ? options.timeout : 10000;

log.level     = options.verbose ? 'verbose' : 'info';
log.timestamp = true;
const PROCESS = 'PROCESS';
const HUE     = 'HUE';

// Instantiate classes & servers
var app    = express()
  , router = express.Router()
  , server = http.createServer(app)
;

// ************************************************************************
// Main code STARTS HERE !!
// ************************************************************************

// Main handlers registration - BEGIN
// Main error handler
process.on('uncaughtException', function (err) {
  log.error(PROCESS, "Uncaught Exception: " + err);
  log.error(PROCESS, "Uncaught Exception: " + err.stack);
});
// Detect CTRL-C
process.on('SIGINT', function() {
  log.info(PROCESS, "Caught interrupt signal");
  log.info(PROCESS, "Exiting gracefully");
  process.exit(2);
});
// Main handlers registration - END

// REST engine initial setup
const PORT    = 3378;
const URI     = '/hue';
const STATUS  = '/status/:id?';
const LIGHTOP = '/:id/:op/:color?';
const PING    = '/ping';
const RESET   = '/reset';

// Methods:
// GET:
// /hue : help
// /hue/:id : return status of the light with id {id}
//
// PUT:
// /hue/:id/:op/:color : OP: ON|OFF|BLINK|BLINKONCE ; COLOR: RED|GREEN|BLUE

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// HUE vars and cons
var   HUEHOST = _.noop();
var   hueapi  = _.noop();
const HUEAPP  = 'IoT_Racing#oraclespainpresales';
const HUEUSER = '2waMvHlSkmMUar9urA9E8z1yfVtqINvxdU9Wbafa';
var   LIGHTS  = [];
const ALL     = 'ALL';

// Light states
const brightness = 100;
const saturation = 255;
const hueRED     = 0;
const hueGREEN   = 25500;
const hueBLUE    = 46920;
const hueYELLOW  = 12750;
const ON         = 'ON';
const OFF        = 'OFF';
const BLINK      = 'BLINK';
const BLINKONCE  = 'BLINKONCE';
var sON          = lightState.create().turnOn().bri(brightness).sat(saturation);
var sOFF         = lightState.create().turnOff();
var sBLINK       = lightState.create().alert('select');
//const OPS        = [ { op:ON, f: changeStatus, state: sON }, { op: 'OFF', f: changeStatus, state: sOFF }, { op:'BLINK', f:blink, state: sBLINK } ];
const COLORS     = [ { color: 'RED', hue: hueRED }, { color: 'GREEN', hue: hueGREEN }, { color: 'BLUE', hue: hueBLUE }, { color: 'YELLOW', hue: hueYELLOW } ];

// REST stuff - BEGIN
router.put(LIGHTOP, function(req, res) {
  log.verbose(PROCESS, "LIGHTOP: %j", req.params);
  // Let's parse the incoming parameters
  var lightId = req.params.id;
  var lightOp = req.params.op;
  var lightColor = req.params.color; // This one is optional for OFF op
  var l = (lightId !== ALL) ? _.find(LIGHTS, { name: lightId }) : ALL;
  var color = _.noop();
  if (lightColor) {
    color = _.find(COLORS, { color: lightColor });
    if (!color) {
      // COLOR not valid
      res.status(400).send("Color '" + lightColor + "' is not valid");
      return;
    }
  }
  if (!l) {
    // Light id not registered
    res.status(400).send("Light Id '" + lightId + "' is not registered in current Hue Bridge");
    return;
  }

  if ( lightOp !== OFF && !color) {
    res.status(400).send("Missing color");
    return;
  }

  if (l !== ALL) {
    if (lightOp === ON) {
      l.light.on(color.hue)
      .then((err) =>  {
        if (err) {
          log.verbose(HUE, err);
          res.status(400).send(err);
        } else {
          res.status(204).send();
        }
      })
      .catch((err) => {
        log.verbose(HUE, err);
        res.status(500).send(err);
      });
    } else if (lightOp === OFF) {
      l.light.off()
      .then((err) =>  {
        if (err) {
          log.verbose(HUE, err);
          res.status(400).send(err);
        } else {
          res.status(204).send();
        }
      })
      .catch((err) => {
        log.verbose(HUE, err);
        res.status(500).send(err);
      });
    } else if (lightOp === BLINK) {
      l.light.blink(color.hue)
      .then((err) =>  {
        if (err) {
          log.verbose(HUE, err);
          res.status(400).send(err);
        } else {
          res.status(204).send();
        }
      })
      .catch((err) => {
        log.verbose(HUE, err);
        res.status(500).send(err);
      });
    } else if (lightOp === BLINKONCE) {
      l.light.blinkonce(color.hue)
      .then((err) =>  {
        if (err) {
          log.verbose(HUE, err);
          res.status(400).send(err);
        } else {
          res.status(204).send();
        }
      })
      .catch((err) => {
        log.verbose(HUE, err);
        res.status(500).send(err);
      });
    } else {
      res.status(400).send("Operation '" + lightOp + "' is not valid");
    }
  } else {
    async.each(LIGHTS, (_l) => {
      if (lightOp === ON) {
        _l.light.on(color.hue);
      } else if (lightOp === OFF) {
        _l.light.off();
      } else if (lightOp === BLINK) {
        _l.light.blink(color.hue);
      } else if (lightOp === BLINKONCE) {
        _l.light.blinkonce(color.hue);
      } else {
        res.status(400).send("Operation '" + lightOp + "' is not valid");
      }
    });
    res.status(204).send();
  }
});

router.get(STATUS, function(req, res) {
  log.verbose(PROCESS, "STATUS: %j", req.params);
  var status = 500;
  var response = _.noop();
  if ( req.params.id) {
    // Requested status for a specific light
    var l = _.find(LIGHTS, { name: req.params.id });
    if (l) {
      response = l.light.get();
      status = 200;
    } else {
      status = 404;
    }
  } else {
    // Requested status for the whole platform
    response =  {
      bridge: {
        ip: HUEHOST,
        user: HUEUSER
      },
      lights: []
    }
    _.each(LIGHTS, (l) => {
      response.lights.push(l.light.get());
    });
    status = 200;
  }
  res.status(status).send(response);
});

router.get(PING, function(req, res) {
  log.verbose(PROCESS, "PING");
  var status = 500;
  var response = _.noop();
  if (!hueapi) {
      response = "API unavailable";
      log.error(HUE, response);
      res.status(status).send(response);
  } else {
      hueapi.getFullState(function(err, config) {
        if (err) {
          log.error(HUE, err.message);
          response = err.message;
        } else {
          status = 200;
          response = config;
        }
        res.status(status).send(response);
      });
  }
});

router.post(RESET, function(req, res) {
  log.verbose(PROCESS, "RESET");
  init(() => {
    res.status(204).send();
  });
});

router.get('/', function(req, res) {
  log.verbose(PROCESS, "HELP: %j", req.params);
  res.status(204).send();
});

app.use(URI, router);
// REST stuff - END

// Initialization code
function init(done) {
  async.series([
    function(callback) {
      LIGHTS  = []; // This might be called upon a RESET request
      HUEHOST = _.noop();
      hueapi  = _.noop();
      callback(null);
    },
    function(callback) {
      log.verbose(HUE, "Looking for Hue Bridges...");
      if (options.huebridge) {
        log.info(HUE, "Hue Bridge manually set at " + options.huebridge);
        HUEHOST = options.huebridge;
        hueapi = new HueApi(HUEHOST, HUEUSER, timeout);
        callback(null);
      } else {
        hue.nupnpSearch(function(err, result) {
          if (err) { callback(err); return; }
          if (result.length == 1) {
            log.verbose(HUE, "Hue Bridge Found[%s] with IP address: %s", result[0].id, result[0].ipaddress);
            HUEHOST = result[0].ipaddress;
            hueapi = new HueApi(HUEHOST, HUEUSER);
            callback(null);
          } else {
            log.error(HUE, "No Hues found.");
            callback(null);
          }
        });
      }
    },
    function(callback) {
      // Retrieve available lights
      if (hueapi) {
        log.verbose(HUE, "Looking for registered lights...");
        hueapi.lights(function(err, l) {
          if (err) {
            log.error(HUE, "Error getting registered lights: " + err.message);
            callback(null);
            return;
          }
          _.each(l.lights, (light) => {
            LIGHTS.push( {
              name: light.name,
              light: new Light(hueapi, {
                id: light.id,
                name: light.name,
                reachable: light.state.reachable,
                color: undefined
              }, (light.state.on) ? ON : OFF, log)
            } );
            log.verbose(HUE, "id: %s, name: %s, online: %s, status: %s", light.id, light.name, light.state.reachable, (light.state.on) ? ON : OFF);
          });
          callback(null);
        });
      } else {
        callback(null);
      }
    },
    function(callback) {
      done();
    }
  ],
  // optional callback
  function(err, results) {
    if (err) log.error(PROCESS, err.message);
    done();
  });
}

init(() => {
  // All OK, start the REST server
  server.listen(PORT, function() {
    log.info(PROCESS, "REST server running on http://localhost:" + PORT + URI);
  });
});
