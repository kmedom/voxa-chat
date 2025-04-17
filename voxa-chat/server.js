const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

// 健康檢查端點
app.get('/health', (req, res) => res.status(200).send('OK'));

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', (roomId) => {
    try {
      socket.join(roomId);
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(socket.id);
      socket.to(roomId).emit('user-joined', socket.id);
      io.to(roomId).emit('room-status', { userCount: rooms.get(roomId).size });
      console.log(`Client ${socket.id} joined room ${roomId}`);
    } catch (e) {
      console.error('Join room error:', e);
      socket.emit('error', '無法加入房間，請稍後再試。');
    }
  });

  socket.on('send-message', ({ roomId, message }) => {
    try {
      socket.to(roomId).emit('receive-message', { message, sender: socket.id });
    } catch (e) {
      console.error('Send message error:', e);
    }
  });

  socket.on('typing', (roomId) => {
    try {
      socket.to(roomId).emit('typing', socket.id);
    } catch (e) {
      console.error('Typing event error:', e);
    }
  });

  socket.on('leave-room', (roomId) => {
    try {
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(socket.id);
        socket.to(roomId).emit('user-left', socket.id);
        io.to(roomId).emit('room-status', { userCount: rooms.get(roomId).size });
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
      socket.leave(roomId);
      console.log(`Client ${socket.id} left room ${roomId}`);
    } catch (e) {
      console.error('Leave room error:', e);
    }
  });

  socket.on('terminate-room', (roomId) => {
    try {
      if (rooms.has(roomId)) {
        io.to(roomId).emit('room-terminated');
        rooms.delete(roomId);
        console.log(`Room ${roomId} terminated`);
      }
      socket.leave(roomId);
    } catch (e) {
      console.error('Terminate room error:', e);
    }
  });

  socket.on('get-room-status', (roomId) => {
    try {
      const userCount = rooms.has(roomId) ? rooms.get(roomId).size : 0;
      socket.emit('room-status', { userCount });
    } catch (e) {
      console.error('Get room status error:', e);
    }
  });

  socket.on('disconnect', () => {
    try {
      rooms.forEach((users, roomId) => {
        if (users.has(socket.id)) {
          users.delete(socket.id);
          socket.to(roomId).emit('user-left', socket.id);
          io.to(roomId).emit('room-status', { userCount: users.size });
          if (users.size === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} deleted (empty)`);
          }
        }
      });
      console.log('Client disconnected:', socket.id);
    } console.log('Disconnect error:', e);
    }
  });
});

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    console.log(`Socket.IO version: ${require('socket.io').version}`);
    console.log(`Express version: ${require('express').version}`);
  }).on('error', (e) => {
    console.error('Server start error:', e);
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${port} is in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    }
  });
}

const PORT = process.env.PORT || 3000;
startServer(PORT);
