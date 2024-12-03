const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const fs = require("fs");
const io = require('socket.io')(server, { cors: { origin: '*'},pingInterval: 5000 });

app.use(express.static('src'));

const videoRouter = require('./routers/videoRouter');

app.use('/video', videoRouter);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/www/home.html');
});

app.get('/api', (req, res) => {
  res.sendFile(__dirname + '/www/api.html');
});

app.get('/player', (req, res) => {
  res.sendFile(__dirname + '/www/play-page.html');
});

var masterTime = 0;
const users = {};
const rooms = {};

io.on('connection', (socket) => {
  console.log('Yeni bir kullanıcı bağlandı.', socket.id);
  
  // Odaya katılma işlemi
  socket.on('joinRoom', (roomName) => {
    socket.join(roomName);
    if (!rooms[roomName]) {
      rooms[roomName] = 1;
    } else {
      rooms[roomName]++;
    }
    io.to(roomName).emit('userCount', rooms[roomName]);
    io.to(roomName).emit('roomMessage',`${user.name} izleme kayfine ortak geldi.`);
  });

   // Odadan ayrılma işlemi
  socket.on('leaveRoom', (roomName) => {
    socket.leave(roomName);
    if (rooms[roomName]) {
      rooms[roomName]--;
      io.to(roomName).emit('userCount', rooms[roomName]);
      io.to(roomName).emit('roomMessage',`${user.name} hayatının hatasını yaptı ve odadan ayrıldı.`);
    }
  });

  socket.on('videoEvent', (event, currentTime) => {
    // log('Got video event:', room, event, 'from: ', socket.id, volume, currentTime);
    masterTime = currentTime;
    socket.broadcast.emit('videoEvent', event, currentTime);
  });

  socket.on('chat-message', (msg, name) => {
    socket.broadcast.emit('chat-message', msg, name);
  });

  socket.on('loginn', (name) => {
    console.log('a user connected', name);
    users[socket.id] = name;
    socket.emit('loginn', users);
  });

  socket.on('disconnect', () => {
    //console.log('user disconnected');
    console.log('user ' + users[socket.id] + ' disconnected');
    // remove saved socket from users object
    delete users[socket.id];
    socket.emit('loginn', users);
  });

});

server.listen(3000, () => {
  console.log('listening on *:3000');
});