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
var parseString = require('xml2js').parseString;
var unirest = require('unirest');
var fs = require('fs'),
  request = require('request');
var cloudinary = require('cloudinary');
cloudinary.config({
  cloud_name: 'dmgnfmx2k',
  api_key: '575228484496572',
  api_secret: 'rzRTAYYR-LAua5PDm_xXlsvAMLI'
});

var loadBase64Image = function(url, callback) {
  // Required 'request' module
  var request = require('request');

  // Make request to our image url
  request({
    url: url,
    encoding: null
  }, function(err, res, body) {
    if (!err && res.statusCode == 200) {
      // So as encoding set to null then request body became Buffer object
      var base64prefix = 'data:' + res.headers['content-type'] + ';base64,',
        image = body.toString('base64');
      if (typeof callback == 'function') {
        callback(image, base64prefix);
      }
    } else {
      throw new Error('Can not download image');
    }
  });
};

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
  } else if (req.body.data.text != undefined) {
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
              getStockDetails(symbol, function(result){
              var result = result.StockQuote;
              var message = result.Name + " (" + result.Symbol + ") ";
              message += "\n $" + result.LastPrice;
              if (result.Change > 0) {
                message += " UP ";
              } else {
                message += " DOWN ";
              }
              message += result.Change + " (" + Number(result.ChangePercent).toFixed(2) + "%) \n";

              message += "High: $" + result.High + "\nLow: $" + result.Low + "\nsend 'more' for recent news stories";
              sendMessage(message, req.body.sender.username);
          
            });
          }
          });
        }
      });
    }
  } else {
    sendMessage("That's an image! Please try again!", req.body.sender.username);
    //  


  }


  // sendMessage('hello world', req.body.sender.username);
  res.json(200, {
    reply: true
  });
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

function topNewsMessage(msg, user) {
  request("http://api.nytimes.com/svc/search/v2/articlesearch.json?q=" + encodeURIComponent(msg) + "&api-key=f763beead7843cc4f910d29de71dc278:1:22349521", function(error, response, body) {
    output = "I could not find news for that. Please try again!";
    if (!error) {
      var json = JSON.parse(body);
      output = "Most recent news for " + msg.toUpperCase() + " \n ";
      var arr = [];
      for (var i = 0; i < json.response.docs.length; i++) {
        var newsline = json.response.docs[i].headline.print_headline;
        if (newsline != null && (json.response.docs[i].news_desk == "Business" || json.response.docs[i].section_name == "Business Day") && arr.indexOf(newsline) == -1) {
          arr.push(newsline);
          output += arr.length + ": " + newsline + " - " + json.response.docs[i].web_url + " \n";
        }

      }
      if (arr.length == 0) {
        output = "I could not find news for that. Please try again!";
      }
    }
    sendMessage(output, user);

  });
}

function getStockDetails(ticker, callback) {
  request('http://dev.markitondemand.com/Api/v2/Quote?symbol=' + encodeURIComponent(ticker),
    function(error, response, body) {
      parseString(body, function(err, result) {
        console.log(result);
        callback(result);
      });
    });

};

function isEmpty(ob) {
  for (var i in ob) {
    return false;
  }
  return true;
}

function imageRecog(img) {
  cloudinary.uploader.upload(img, function(returned) {
    console.log(returned.url);
    unirest.post("https://camfind.p.mashape.com/image_requests")
      .header("X-Mashape-Key", "9jDfMEJDCbmshgtbd0t7s6zd2ZGVp1hu4A9jsnpWi9zQqfIlCr")
      .field("focus[x]", "480")
      .field("focus[y]", "640")
      .field("image_request[altitude]", "27.912109375")
      .field("image_request[language]", "en")
      .field("image_request[latitude]", "35.8714220766008")
      .field("image_request[locale]", "en_US")
      .field("image_request[longitude]", "14.3583203002251")
      .field("image_request[remote_image_url]", returned.url)
      .end(function(result) {
        var that = this;
        that.result = result;
        setTimeout(function(result) {

          var result = JSON.parse(that.result.raw_body);
          console.log(result);
          console.log('https://camfind.p.mashape.com/image_responses/' + result.token);
          unirest.get("https://camfind.p.mashape.com/image_responses/" + result.token)
            .header("X-Mashape-Key", "9jDfMEJDCbmshgtbd0t7s6zd2ZGVp1hu4A9jsnpWi9zQqfIlCr")
            .end(function(result) {

              console.log(result.status, result.headers, result.body);

            });

        }, 15000);
      });

  });

}