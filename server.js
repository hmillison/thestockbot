// server.js

// BASE SETUP
// =============================================================================

// call the packages we need
var express       = require('express');    // call express
var app           = express();         // define our app using express
var bodyParser    = require('body-parser');
var request       = require('request');
var YQL           = require('yql');
var server_token  = ''; // replace null here with your Inbox server_token
var yahoo_appId   = ''; // replace null here with your Yahoo AppId

if (!server_token) { throw new Error('please enter your Inbox server_token'); };
if (!yahoo_appId) { throw new Error('please enter your Yahoo AppId'); };

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;    // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();        // get an instance of the express Router

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
  res.json({ message: 'hooray! this is the weather bot!' });
});

router.post('/message', function(req, res) {
  if (req.body.type == 12) {
    sendMessage('Hey! Send me the name of any city in the world and I will respond with the weather!',req.body.sender.username);
  };
  if (req.body.type == 21) {
    getWOEIDForCity(req.body.data.text, function(error, woeid, name) {
      if (error) {
        sendMessage("Sorry, we don't know this city.",req.body.sender.username);
      } else {
        if (error) {
          sendMessage("Sorry, we don't know this city.",req.body.sender.username);
        } else {
          getWeatherForWOEID(woeid, function(error, weather) {
            sendMessage('the weather is ' + weather.text + ' and ' + weather.temp + '\xB0F in ' + name,req.body.sender.username);
          });
        }
      }
    });
  };
  res.json(200,{reply:true});
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);

function sendMessage(message_text, username) {
  var options = {
    url: 'https://devs.inboxtheapp.com/message',
    headers: {
        'Authorization': 'bearer ' + server_token
    },
    json: {
      to: username,
      text: message_text
    }
  };
  function callback(error, response, body) {};
  request.post(options,callback);
};

function getWOEIDForCity(city, func) {
  var options = {
    url: 'http://where.yahooapis.com/v1/places.q('+city+')',
    headers: {
        'Accept': 'application/json'
    },
    qs: {
      appid: yahoo_appId
    }
  };
  function callback(error, response, body) {
    json = JSON.parse(body);
    console.log(body);
    console.log(response.statusCode);
    console.log(error);
    if (response.statusCode != 200 ||  error || !json.places.place) {
      func('error',null,null);
    } else {
      func(null,json.places.place[0].woeid, json.places.place[0].name);
    }
  }
  request.get(options,callback);
};

function getWeatherForWOEID(woeid, func) {
  var options = {
    url: 'http://query.yahooapis.com/v1/public/yql',
    headers: {
        'Accept': 'application/json'
    },
    qs: {
      appid: yahoo_appId,
      q: 'select item.condition from weather.forecast where woeid = ' + woeid
    }
  };
  function callback(error, response, body) {
    json = JSON.parse(body);
    console.log(error);
    if (response.statusCode != 200 || error) {
      func('error',null);
    } else {
      func(null,json.query.results.channel.item.condition);
    }
  }
  request.get(options,callback);
};
