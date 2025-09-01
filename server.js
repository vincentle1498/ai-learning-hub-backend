require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { ObjectId } = require('mongodb');

const { connectDB, getDB } = require('./db');
const { authenticateAPIKey, optionalAuth } = require('./middleware/auth');
const {
  validateRegister,
  validateLogin,
  validateProject,
  validateDiscussion,
  validateReply,
  validateLesson,
  validateRoom
} = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // limit auth attempts
  message: 'Too many authentication attempts, please try again later.'
});

// Middleware
app.use(cors({
  origin: [
    'https://ailearninghubs.netlify.app',
    'https://ai-learning-hub-frontend.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use('/api', limiter);
app.use('/api/auth', authLimiter);

// ============= API ROUTES =============

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'AI Learning Hub Backend API is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: {
        register: '/api/auth/register',
        login: '/api/auth/login',
        generateApiKey: '/api/auth/generate-api-key'
      },
      projects: '/api/projects',
      discussions: '/api/discussions',
      lessons: '/api/lessons',
      rooms: '/api/rooms'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API is healthy',
    uptime: process.uptime(),
    database: 'MongoDB connected'
  });
});

// ----------- USER/AUTH ROUTES -----------
app.post('/api/auth/register', validateRegister, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const db = getDB();
    
    // Check if user exists
    const existingUser = await db.collection('users').findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate API key
    const apiKey = `ai_hub_${uuidv4()}`;
    
    // Create user
    const user = {
      username,
      email,
      password: hashedPassword,
      apiKey,
      created: new Date(),
      lastActive: new Date()
    };
    
    const result = await db.collection('users').insertOne(user);
    
    res.json({ 
      success: true, 
      user: { 
        id: result.insertedId, 
        username: user.username, 
        email: user.email,
        apiKey: user.apiKey // Return API key on registration
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getDB();
    
    const user = await db.collection('users').findOne({ username });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last active
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastActive: new Date() } }
    );
    
    res.json({ 
      success: true, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        apiKey: user.apiKey
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Generate new API key (requires existing API key)
app.post('/api/auth/generate-api-key', authenticateAPIKey, async (req, res) => {
  try {
    const db = getDB();
    const newApiKey = `ai_hub_${uuidv4()}`;
    
    await db.collection('users').updateOne(
      { _id: req.user._id },
      { $set: { apiKey: newApiKey, lastActive: new Date() } }
    );
    
    res.json({ 
      success: true,
      apiKey: newApiKey
    });
  } catch (error) {
    console.error('API key generation error:', error);
    res.status(500).json({ error: 'Failed to generate new API key' });
  }
});

// ----------- PROJECT ROUTES -----------
app.get('/api/projects', optionalAuth, async (req, res) => {
  try {
    const db = getDB();
    const { category, userId, limit = 20, offset = 0 } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (userId) query.userId = userId;
    
    const projects = await db.collection('projects')
      .find(query)
      .sort({ created: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .toArray();
    
    res.json(projects);
  } catch (error) {
    console.error('Fetch projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/projects', authenticateAPIKey, validateProject, async (req, res) => {
  try {
    const db = getDB();
    const project = {
      ...req.body,
      userId: req.user._id,
      username: req.user.username,
      created: new Date(),
      updated: new Date(),
      likes: 0,
      stars: 0,
      views: 0
    };
    
    const result = await db.collection('projects').insertOne(project);
    project._id = result.insertedId;
    
    res.json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.put('/api/projects/:id', authenticateAPIKey, validateProject, async (req, res) => {
  try {
    const db = getDB();
    const projectId = new ObjectId(req.params.id);
    
    // Check ownership
    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this project' });
    }
    
    const update = {
      ...req.body,
      updated: new Date()
    };
    
    delete update._id; // Remove _id from update
    
    await db.collection('projects').updateOne(
      { _id: projectId },
      { $set: update }
    );
    
    const updatedProject = await db.collection('projects').findOne({ _id: projectId });
    res.json(updatedProject);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', authenticateAPIKey, async (req, res) => {
  try {
    const db = getDB();
    const projectId = new ObjectId(req.params.id);
    
    // Check ownership
    const project = await db.collection('projects').findOne({ _id: projectId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this project' });
    }
    
    await db.collection('projects').deleteOne({ _id: projectId });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Project interaction endpoints
app.post('/api/projects/:id/like', authenticateAPIKey, async (req, res) => {
  try {
    const db = getDB();
    const projectId = new ObjectId(req.params.id);
    
    await db.collection('projects').updateOne(
      { _id: projectId },
      { $inc: { likes: 1 } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Like project error:', error);
    res.status(500).json({ error: 'Failed to like project' });
  }
});

app.post('/api/projects/:id/star', authenticateAPIKey, async (req, res) => {
  try {
    const db = getDB();
    const projectId = new ObjectId(req.params.id);
    
    await db.collection('projects').updateOne(
      { _id: projectId },
      { $inc: { stars: 1 } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Star project error:', error);
    res.status(500).json({ error: 'Failed to star project' });
  }
});

// ----------- DISCUSSION ROUTES -----------
app.get('/api/discussions', optionalAuth, async (req, res) => {
  try {
    const db = getDB();
    const { category, limit = 20, offset = 0 } = req.query;
    
    const query = {};
    if (category) query.category = category;
    
    const discussions = await db.collection('discussions')
      .find(query)
      .sort({ created: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .toArray();
    
    res.json(discussions);
  } catch (error) {
    console.error('Fetch discussions error:', error);
    res.status(500).json({ error: 'Failed to fetch discussions' });
  }
});

app.post('/api/discussions', authenticateAPIKey, validateDiscussion, async (req, res) => {
  try {
    const db = getDB();
    const discussion = {
      ...req.body,
      userId: req.user._id,
      username: req.user.username,
      created: new Date(),
      updated: new Date(),
      replies: 0,
      views: 0
    };
    
    const result = await db.collection('discussions').insertOne(discussion);
    discussion._id = result.insertedId;
    
    res.json(discussion);
  } catch (error) {
    console.error('Create discussion error:', error);
    res.status(500).json({ error: 'Failed to create discussion' });
  }
});

app.get('/api/discussions/:id/replies', async (req, res) => {
  try {
    const db = getDB();
    const discussionId = new ObjectId(req.params.id);
    
    const replies = await db.collection('replies')
      .find({ discussionId })
      .sort({ created: 1 })
      .toArray();
    
    res.json(replies);
  } catch (error) {
    console.error('Fetch replies error:', error);
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

app.post('/api/discussions/:id/reply', authenticateAPIKey, validateReply, async (req, res) => {
  try {
    const db = getDB();
    const discussionId = new ObjectId(req.params.id);
    
    const reply = {
      ...req.body,
      discussionId,
      userId: req.user._id,
      username: req.user.username,
      created: new Date()
    };
    
    const result = await db.collection('replies').insertOne(reply);
    reply._id = result.insertedId;
    
    // Update reply count
    await db.collection('discussions').updateOne(
      { _id: discussionId },
      { 
        $inc: { replies: 1 },
        $set: { updated: new Date() }
      }
    );
    
    res.json(reply);
  } catch (error) {
    console.error('Create reply error:', error);
    res.status(500).json({ error: 'Failed to create reply' });
  }
});

// ----------- LESSON ROUTES -----------
app.get('/api/lessons', optionalAuth, async (req, res) => {
  try {
    const db = getDB();
    const { difficulty, limit = 20, offset = 0 } = req.query;
    
    const query = {};
    if (difficulty) query.difficulty = difficulty;
    
    const lessons = await db.collection('lessons')
      .find(query)
      .sort({ created: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .toArray();
    
    res.json(lessons);
  } catch (error) {
    console.error('Fetch lessons error:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

app.post('/api/lessons', authenticateAPIKey, validateLesson, async (req, res) => {
  try {
    const db = getDB();
    const lesson = {
      ...req.body,
      authorId: req.user._id,
      authorName: req.user.username,
      created: new Date(),
      updated: new Date(),
      views: 0,
      completions: 0
    };
    
    const result = await db.collection('lessons').insertOne(lesson);
    lesson._id = result.insertedId;
    
    res.json(lesson);
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

app.post('/api/lessons/:id/complete', authenticateAPIKey, async (req, res) => {
  try {
    const db = getDB();
    const lessonId = new ObjectId(req.params.id);
    
    await db.collection('lessons').updateOne(
      { _id: lessonId },
      { $inc: { completions: 1 } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Complete lesson error:', error);
    res.status(500).json({ error: 'Failed to mark lesson as complete' });
  }
});

// ----------- ROOM ROUTES -----------
app.get('/api/rooms', optionalAuth, async (req, res) => {
  try {
    const db = getDB();
    const { status = 'active', limit = 20, offset = 0 } = req.query;
    
    const rooms = await db.collection('rooms')
      .find({ status })
      .sort({ created: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .toArray();
    
    res.json(rooms);
  } catch (error) {
    console.error('Fetch rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.post('/api/rooms', authenticateAPIKey, validateRoom, async (req, res) => {
  try {
    const db = getDB();
    const room = {
      ...req.body,
      ownerId: req.user._id,
      ownerName: req.user.username,
      participants: [req.user.username],
      created: new Date(),
      status: 'active',
      maxParticipants: req.body.maxParticipants || 10
    };
    
    const result = await db.collection('rooms').insertOne(room);
    room._id = result.insertedId;
    
    res.json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.put('/api/rooms/:id/join', authenticateAPIKey, async (req, res) => {
  try {
    const db = getDB();
    const roomId = new ObjectId(req.params.id);
    
    const room = await db.collection('rooms').findOne({ _id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (room.participants.length >= room.maxParticipants) {
      return res.status(400).json({ error: 'Room is full' });
    }
    
    if (!room.participants.includes(req.user.username)) {
      await db.collection('rooms').updateOne(
        { _id: roomId },
        { $push: { participants: req.user.username } }
      );
    }
    
    const updatedRoom = await db.collection('rooms').findOne({ _id: roomId });
    res.json(updatedRoom);
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

app.put('/api/rooms/:id/leave', authenticateAPIKey, async (req, res) => {
  try {
    const db = getDB();
    const roomId = new ObjectId(req.params.id);
    
    await db.collection('rooms').updateOne(
      { _id: roomId },
      { $pull: { participants: req.user.username } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

app.put('/api/rooms/:id/close', authenticateAPIKey, async (req, res) => {
  try {
    const db = getDB();
    const roomId = new ObjectId(req.params.id);
    
    const room = await db.collection('rooms').findOne({ _id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (room.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only room owner can close the room' });
    }
    
    await db.collection('rooms').updateOne(
      { _id: roomId },
      { $set: { status: 'closed' } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Close room error:', error);
    res.status(500).json({ error: 'Failed to close room' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server with MongoDB connection
const startServer = async () => {
  try {
    // Check for MongoDB URI
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️  WARNING: MONGODB_URI not found in environment variables');
      console.log('📝 Using default MongoDB URI (localhost)');
    } else {
      console.log('✅ MONGODB_URI environment variable found');
    }
    
    // Add NODE_TLS_REJECT_UNAUTHORIZED workaround for SSL issues
    if (process.env.NODE_ENV === 'production') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      console.log('🔓 SSL validation bypassed for production (Render deployment)');
    }
    
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Visit: http://localhost:${PORT}`);
      console.log(`📦 API documentation available at: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  const { closeDB } = require('./db');
  await closeDB();
  process.exit(0);
});