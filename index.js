const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Redis = require('ioredis');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://whisper-room-j0x0z9qyg-mskothari07s-projects.vercel.app/', 
    methods: ['GET', 'POST']
  }
});


const redis = new Redis(process.env.REDIS_URL); 

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('create-session', async (sessionId) => {
    await redis.sadd(`session:${sessionId}`, socket.id);
    socket.join(sessionId);
    console.log('Session created:', sessionId);
  });

  socket.on('join-session', async ({ sessionId, user }) => {
    const sessionExists = await redis.exists(`session:${sessionId}`);
    if (sessionExists) {
      await redis.sadd(`session:${sessionId}`, socket.id);
      socket.join(sessionId);
      console.log(`User ${user} joined session: ${sessionId}`);
    } else {
      console.log('Invalid session ID');
    }
  });

  socket.on('send-message', async ({ sessionId, user, message }) => {
    const sockets = await redis.smembers(`session:${sessionId}`);
    if (sockets.length > 0) {
      io.to(sessionId).emit('receive-message', { sessionId, user, message });
    }
  });

  socket.on('delete-session', async (sessionId) => {
    io.to(sessionId).emit('session-deleted');
    const sockets = await redis.smembers(`session:${sessionId}`);
    sockets.forEach((socketId) => {
      const clientSocket = io.sockets.sockets.get(socketId);
      if (clientSocket) {
        clientSocket.leave(sessionId);
      }
    });
  
    // Delete the session from Redis
    await redis.del(`session:${sessionId}`);
  });

  socket.on('disconnect', async () => {
    const keys = await redis.keys('session:*');
    for (const key of keys) {
      await redis.srem(key, socket.id);
    }
  })
});

server.listen(process.env.PORT, () => {
  console.log('Server running on port 4000');
});
