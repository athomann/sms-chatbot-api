
var https = require('https'),
    http = require('http'),
    util = require('util'),
    self = this,
    fs = require('fs'),
    events = require('events');

function init() {
  var phoneBot = new PhoneChatBot({
    username: '',
    password: '',
    botuser: '',
    botpassword: ''
  });

  setInterval(function(){
    phoneBot.getMessages();
  }, 1000);

}

var PhoneChatBot = function(options) {
  this.username = options.username;
  this.password = options.password;
  this.botuser = options.botuser;
  this.botpassword = options.botpassword;
  this.data = '';
};

PhoneChatBot.prototype.getMessages = function() {
  var options = {
    host: 'v1.api.phone.com',
    port: 443,
    path: '/sms',
    headers: {
      'Connection': 'keep-alive',
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + new Buffer(this.username + ':' + this.password).toString('base64')
    }
  };

  self = this;

  this.connection = https.get(options, function(res){
    self.data = '';

    res.on('data', function(chunk) {
      self.data += chunk;
    });

    res.on('end', function() {
      var parsedJson = JSON.parse(self.data);

      if (fs.readFileSync('./sms_log.json').length === 0) {
        self.createJsonFile(parsedJson);
      } else {
        self.sendBotMessage(parsedJson);
      }
    });
    res.on('error', function(e) {
      console.log('Got error: ' + e.message);
    });

  });

};

PhoneChatBot.prototype.createJsonFile = function(json) {
  var self = this,
      outputFilename = 'sms_log.json',
      incomingArray= [];

  for (var key in json) {
    var value = json[key].data;
    for(var i = 0; i < value.length; i++) {
      if (value[i].type === "incoming") {
        incomingArray.push(value[i]);
      }
    }
  }

  fs.writeFile(outputFilename, JSON.stringify(incomingArray), function(err) {
    if (err) {
      console.log(err);
    } else {
      if (fs.readFileSync('./sms_log.json').length !== 0) {
        self.sendBotMessage(json, incomingArray);
        console.log(incomingArray);
      }
    }
  });
};

PhoneChatBot.prototype.sendBotMessage = function(json, incomingArray) {
  var parsedLog = JSON.parse(fs.readFileSync('./sms_log.json')),
      newMessage = json.response.data[0].message,
      smsType = json.response.data[0].type,
      smsSender = json.response.data[0].from,
      newId = json.response.data[0].resource_id;
      loggedID = parsedJson[0].resource_id;

  if (newId !== loggedID && smsType === 'incoming') {
    console.log("User: " + newMessage);
    this.retrieveBotResponse(newMessage, smsSender);
    this.createJsonFile(json);
  }
};

PhoneChatBot.prototype.retrieveBotResponse = function(message, sender) {
  var self = this;
  this.message = encodeURI(message.split(" ").join("+"));
  var options = {
    method: 'GET',
    host: 'botlibre.com',
    path: '/rest/botlibre/form-chat?instance=165&user=' + this.botuser + '&password=' + this.botpassword + '&message=' + this.message
  };

  this.connection = http.get(options, function(res){
    var body = "";

    res.on('data', function(data) {
      body += data;
    });

    res.on('end', function() {
      var message = body.substring(body.indexOf("<message>") + 9, body.indexOf("</message>"));
      console.log("ChatBot: " + message);
      self.sendBotResponse(message, sender);
    });
    res.on('error', function(e) {
      console.log("Got error: " + e.message);
    });
  });
};

PhoneChatBot.prototype.sendBotResponse = function(message, sender) {
  var date = new Date();
  date = date.toJSON();

  this.message = message;
  this.sender = sender;

  var jsonObject = JSON.stringify({
    "from": "+" + this.number,
    "to": "+" + this.sender,
    "message": this.message,
    "schedule_start": date,
    "schedule_expire": "2015-01-01T10:37:00-07:00"
  });

  var options = {
    method : 'POST',
    host: 'v1.api.phone.com',
    port: 443,
    path: '/sms',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonObject, 'utf8'),
      'Authorization':'Basic ' + new Buffer(this.username + ':' + this.password).toString('base64')
    }
  };

  var reqPost = https.request(options, function(res) {
      // console.log("statusCode: ", res.statusCode);

      res.on('data', function(d) {
          console.info('POST result:\n');
          process.stdout.write(d);
          console.info('\n\nPOST completed');
      });
  });

  reqPost.write(jsonObject);
  reqPost.end();
  reqPost.on('error', function(e) {
      console.error(e);
  });
};

init();
