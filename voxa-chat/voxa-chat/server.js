const express = require('express');
     const http = require('http');
     const { Server } = require('socket.io');
     const crypto = require('crypto');

     const app = express();
     const server = http.createServer(app);
     const io = new Server(server, {
       cors: {
         origin: '*',
         methods: ['GET', 'POST']
       }
     });

     // Health check endpoint
     app.get('/health', (req, res) => {
       res.status(200).send('OK');
     });

     // Serve static files (optional, for testing)
     app.use(express.static('public'));

     const rooms = new Map(); // Store room data
     const SENSITIVE_WORDS = ['violence', 'hate', 'adult']; // Example sensitive words

     function encryptMessage(message, key) {
       const cipher = crypto.createCipher('aes-256-cbc', key);
       let encrypted = cipher.update(message, 'utf8', 'hex');
       encrypted += cipher.final('hex');
       return encrypted;
     }

     function decryptMessage(encrypted, key) {
       try {
         const decipher = crypto.createDecipher('aes-256-cbc', key);
         let decrypted = decipher.update(encrypted, 'hex', 'utf8');
         decrypted += decipher.final('utf8');
         return decrypted;
       } catch (e) {
         return null;
       }
     }

     function isSensitive(content) {
       return SENSITIVE_WORDS.some(word => content.toLowerCase().includes(word));
     }

     io.on('connection', (socket) => {
       console.log('User connected:', socket.id);

       socket.on('join-room', ({ roomId, key }, callback) => {
         let room = rooms.get(roomId);
         if (!room) {
           room = { users: new Set(), key, messages: [] };
           rooms.set(roomId, room);
         } else if (room.key !== key) {
           return callback({ error: 'Invalid key' });
         }

         room.users.add(socket.id);
         socket.join(roomId);
         socket.roomId = roomId;

         const userCount = room.users.size;
         io.to(roomId).emit('room-update', {
           roomId,
           userCount,
           title: `voxa room (${userCount} 人線上)`
         });

         room.messages.forEach(({ encrypted, sender }) => {
           const decrypted = decryptMessage(encrypted, key);
           if (decrypted) {
             socket.emit('receive-message', { message: decrypted, sender });
           }
         });

         callback({ success: true });
       });

       socket.on('send-message', ({ message }, callback) => {
         const roomId = socket.roomId;
         const room = rooms.get(roomId);
         if (!room) return callback({ error: 'Room not found' });

         if (isSensitive(message)) {
           return callback({ error: 'Message contains sensitive content' });
         }

         const encrypted = encryptMessage(message, room.key);
         room.messages.push({ encrypted, sender: socket.id });

         io.to(roomId).emit('receive-message', {
           message,
           sender: socket.id
         });

         callback({ success: true });
       });

       socket.on('disconnect', (e) => {
         console.log('Disconnect error:', e);
         const roomId = socket.roomId;
         const room = rooms.get(roomId);
         if (room) {
           room.users.delete(socket.id);
           const userCount = room.users.size;
           io.to(roomId).emit('room-update', {
             roomId,
             userCount,
             title: `voxa room (${userCount} 人線上)`
           });
           if (userCount === 0) {
             rooms.delete(roomId);
           }
         }
       });
     });

     const PORT = process.env.PORT || 3000;
     server.listen(PORT, () => {
       console.log(`Server running on port ${PORT}`);
       console.log(`Socket.IO version: ${require('socket.io').version}`);
       console.log(`Express version: ${require('express').version}`);
     });