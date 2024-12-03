var express = require("express");
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server, { cors: { origin: '*'},pingInterval: 5000 });

app.use(express.static('www'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/client.html');
});

var master = "";
var masterLat = 0;
var playing = false;
var masterPos = 0;

io.on('connection', function(socket) {
    console.log("client bağlandı");
  if(master == "") {

    master = socket.id;
    console.log(master);

    socket.on("latency", function(lat) {
      masterLat = lat;
    });

    socket.on("pos", function(pos) {
      socket.broadcast.emit("updatePos", pos + masterLat);
      masterPos = pos + masterLat;
    });

    socket.on("play",function() {
        console.log("playing");
      socket.broadcast.emit("play");
      playing = true;
    });

    socket.on("pause",function() {
      socket.broadcast.emit("pause");
      playing = false;
    });

    socket.on("disconnect",function() {
        socket.emit("masterdisconnect"); //Add some graceful "Stream ended" code
    });

    socket.broadcast.emit("master");
    console.log("master");
  }else {

    socket.on("disconnect",function() {
      io.emit("clients",20);      
    });

    socket.emit("updatePos", masterPos);

    if(playing)
      socket.emit("play");
  }

  io.emit("clients", 20);
});
console.log("Listening on port 8080");
server.listen(8080);