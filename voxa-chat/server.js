const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://voxa-chat.onrender.com',
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 10000;

app.get('/health', (req, res) => res.send('OK'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join-room', ({ roomId, key }, callback) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);
    callback();
  });
  socket.on('send-message', ({ roomId, message }) => {
    socket.to(roomId).emit('receive-message', { message, sender: socket.id });
  });
  socket.on('typing', (roomId) => {
    socket.to(roomId).emit('typing', socket.id);
  });
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', socket.id);
  });
  socket.on('terminate-room', (roomId) => {
    io.in(roomId).emit('room-terminated');
    io.in(roomId).socketsLeave(roomId);
  });
  socket.on('get-room-status', (roomId) => {
    const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    socket.emit('room-status', { userCount });
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
