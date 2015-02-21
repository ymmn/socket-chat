// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;

// command types enum
var COIN_FLIP = -19292;
var NORMAL_TEXT = -2343;
var OBNOXIOUS = -23343;
var MISSPELL = -24443;

var misspellSentence = function(sentence) {
  var MISSPELL_AGGRESSIVENESS = 0.4; // higher is more aggressive
  return sentence.split(/\W+/).map(function(word) {
    var len = word.length;
    if (len < 2) {
      return word;
    }

    // shuffle the middle of the word
    var mid = word.substr(1, len - 2);
    mid = mid.split('').sort(function(){return MISSPELL_AGGRESSIVENESS-Math.random();}).join('');

    return word[0] + mid + word[len -1];
  }).join(' ');
};

var getCommandType = function (msg) {
  if (msg === '/flipcoin') {
    return COIN_FLIP;
  } else if (msg === '/obnoxious') {
    return OBNOXIOUS;
  } else if (msg === '/misspell') {
    return MISSPELL;
  } else {
    return NORMAL_TEXT;
  }
};

var doCoinFlip = function () {
  var flipResult = 'Heads';
  if (Math.random() < 0.5) {
    flipResult = 'Tails';
  }
  return 'flips coin: gets ' + flipResult + '!';
};

var toggleObnoxiousMode = function (socket) {
  socket.obnoxiousMode = !socket.obnoxiousMode;
  return 'toggles /obnoxious mode';
};

var toggleMisspellMode = function (socket) {
  socket.misspellMode = !socket.misspellMode;
  return 'toggles /misspell mode';
};

var getText = function(socket, msg) {
  if (socket.obnoxiousMode) {
    msg = msg + ', ay?';
  }
  if (socket.misspellMode) {
    msg = misspellSentence(msg);
  }
  return msg;
};

var interpretCommand = function (socket, msg) {
  var username = socket.username;
  var commandType = getCommandType(msg);
  var output = {
    username: 'System',
    message: 'User @' + username + ' ' // to be completed by command
  };

  if (commandType === COIN_FLIP) {
    output.message += doCoinFlip();
  } else if (commandType === OBNOXIOUS) {
    output.message += toggleObnoxiousMode(socket);
  } else if (commandType === MISSPELL) {
    output.message += toggleMisspellMode(socket);
  } else {
    // must be regular text
    output = {
      username: username,
      message: getText(socket, msg)
    };
  }

  return output;
};

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    var commandOutput = interpretCommand(socket, data);
    socket.broadcast.emit('new message', commandOutput);
    // emit to original user as well
    socket.emit('new message', commandOutput);
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
