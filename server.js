// Based on WeatherService by Hani Shabsigh at Inbox
// Gets Stock Prices using Bloomberg's API
// You can try this service by messaging @thestockbot on Inbox Messenger

// BASE SETUP
// =============================================================================

// setup packages
var express = require('express'); // call express
var app = express(); // define our app using express
var bodyParser = require('body-parser');
var request = require('request');
var c = require('./Console.js');
var blpapi = require('blpapi');
var parseString = require('xml2js').parseString;
var unirest = require('unirest');

// setup Inbox & Yahoo tokens, ensure they are available
var server_token = 'QnReKVWdhNF8skRxsbqWuGAhNjch6sL20XX6NI4J2Iihhu9NLRUiuIV0C4eS'; // replace null here with your Inbox server_token
if (!server_token || server_token.length == 0) {
  throw new Error('please enter your Inbox server_token');
};
//if (!yahoo_appId || yahoo_appId.length == 0) { throw new Error('please enter your Yahoo AppId'); };

// configure app to use bodyParser(), this will let us get the data from a POST
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

// set our port
var port = process.env.PORT || 8080;

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router(); // get an instance of the express Router

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
  res.json({
    message: 'Hello I am thestockbot... beep boop beep!'
  });
});


router.post('/message', function(req, res) {
  if (req.body.type == 12) {
    sendMessage('Hey! Send me the name of any US S&P 500 Company and I will respond with the stock price!', req.body.sender.username);
  } else if(req.body.data.text != undefined){
    var msg = req.body.data.text;
    if (msg.toUpperCase() == "MORE") {
      var options = {
        url: 'https://devs.inboxtheapp.com/message?chat_id=' + req.body.chat_id,
        headers: {
          'Authorization': 'bearer ' + server_token
        }
      };
      request.get(options, function(error, response, body) {
        var json = JSON.parse(body);
        for (var i = 0; i < json.length; i++) {
          if (json[i].sender.username != "thestockbot" && json[i].data.text.toUpperCase() != "MORE") {
            topNewsMessage(json[i].data.text, json[i].sender.username);
            break;
          }
        }
      });
    } else {
      request('http://dev.markitondemand.com/Api/v2/Lookup?input=' + encodeURIComponent(msg), function(error, response, body) {
        if (!error && response.statusCode == 200) {
          parseString(body, function(err, result) {
            console.log(result);
            if (result.LookupResultList === "") {
              sendMessage("I don't understand that. Please try again!", req.body.sender.username);
            } else {
              var symbol = result.LookupResultList.LookupResult[0].Symbol;
              getStockDetails(symbol, function(m) {
                c.log(m);
                if (!isEmpty(m.data.securityData[0].fieldData)) {
                  var result = m.data.securityData[0].fieldData;
                  sendMessage("The stock price for " + result.LONG_COMP_NAME + " is $" + result.PX_LAST + "\nsend 'more' for recent news stories", req.body.sender.username);
                } else {
                  sendMessage("I could not find the stock info for that. Please try again!", req.body.sender.username);
                }
              });
            }
          });
        }
      });
    }
  }
  else{
    imageRecog(req.body.data.picture);
  }

// sendMessage('hello world', req.body.sender.username);
res.json(200, {reply: true});
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
  request.post(options, callback);
};

function topNewsMessage(msg, user)
{
   request("http://api.nytimes.com/svc/search/v2/articlesearch.json?q=" + encodeURIComponent(msg) + "&api-key=f763beead7843cc4f910d29de71dc278:1:22349521", function(error, response, body) {
      if (!error) {
        var json = JSON.parse(body);
        var output = "Most recent news for " + msg.toUpperCase() + " \n ";
        var arr = [];
        for (var i = 0; i < json.response.docs.length; i++) {
          var newsline = json.response.docs[i].headline.print_headline;
          if (newsline != null && (json.response.docs[i].news_desk == "Business" || json.response.docs[i].section_name == "Business Day") && arr.indexOf(newsline) == -1){
            arr.push(newsline);
            output += arr.length + ": " + newsline + " \n";
          }
        }
      } else {
        sendMessage("I could not find news for that. Please try again!", user);
      }
      sendMessage(output, user);

      });
}

function getStockDetails(ticker, callback) {
  var session = new blpapi.Session({
    host: '10.8.8.1',
    port: 8194
  });
  var service_refdata = 1; // Unique identifier for refdata service
  var seclist = [ticker + ' US Equity'];

  session.on('SessionStarted', function(m) {
    session.openService('//blp/refdata', service_refdata);
  });

  session.on('ServiceOpened', function(m) {
     
    // Check to ensure the opened service is the refdata service
    if (m.correlations[0].value == service_refdata) {
      // Request the long-form company name for each security
      session.request('//blp/refdata', 'ReferenceDataRequest', {
        securities: seclist,
        fields: [
          'PX_LAST',
          'CIE_DES_BULK',
          'RT_PX_CHG_PCT_1D',
          'LONG_COMP_NAME',
          'TOT_COMP_AW_TO_CEO_&_EQUIV',
          'TOT_SALARIES_PAID_TO_CEO_&_EQUIV',
          'ALL_OTHER_COMP_AW_TO_CEO_&_EQUIV',
          'BOARD_SIZE',
          'NEWS_SENTIMENT'
        ]
      }, 100);
      // Request intraday tick data for each security, 10:30 - 14:30
      session.request('//blp/refdata', 'HistoricalDataRequest', {
        securities: seclist,
        fields: ['PX_LAST', 'OPEN', 'VOLUME'],
        startDate: "20120101",
        endDate: "20120301",
        periodicitySelection: "DAILY"
      }, 101);
    }
  });

  session.on('ReferenceDataResponse', function(m) {
    callback(m);
  });

  session.start();

};

function isEmpty(ob) {
  for (var i in ob) {
    return false;
  }
  return true;
}

function imageRecog(img) {
  console.log(img);
  
    unirest.post("https://camfind.p.mashape.com/image_requests")
        .header("X-Mashape-Key", "9jDfMEJDCbmshgtbd0t7s6zd2ZGVp1hu4A9jsnpWi9zQqfIlCr")
        .field("focus[x]", "480")
        .field("focus[y]", "640")
        .field("image_request[altitude]", "27.912109375")
        .field("image_request[language]", "en")
        .field("image_request[latitude]", "35.8714220766008")
        .field("image_request[locale]", "en_US")
        .field("image_request[longitude]", "14.3583203002251")
        .field("image_request[remote_image_url]", img)
        .end(function(result) {
          console.log(result);
            unirest.get("https://camfind.p.mashape.com/image_responses/" + result.token)
                .header("X-Mashape-Key", "9jDfMEJDCbmshgtbd0t7s6zd2ZGVp1hu4A9jsnpWi9zQqfIlCr")
                .end(function(result) {
                    console.log(result.body);
                });
        });
}