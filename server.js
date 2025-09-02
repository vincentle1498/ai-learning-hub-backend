console.log('🚀 Starting AI Learning Hub Simple Backend...');

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

console.log('✅ Express loaded - SIMPLE BACKEND');

// CORS - Allow your Netlify domains
app.use(cors({
  origin: ['https://ai-learning-hubs.netlify.app', 'https://ailearninghubs.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

console.log('✅ Middleware configured');

// Simple in-memory storage - NO DATABASE REQUIRED
let users = [
  {
    id: 'system',
    username: 'System',
    email: 'system@ailearninghub.com',
    password: 'system', // In real app, this would be hashed
    created: new Date().toISOString()
  }
];

let discussions = [
  {
    id: 'welcome_simple',
    title: 'Simple Backend is Working!',
    content: 'This discussion proves the simple backend deployment was successful! All users can now see and interact with shared content.',
    author: 'System',
    authorId: 'system',
    category: 'general',
    tags: ['system', 'working'],
    created: new Date().toISOString(),
    replies: 0,
    repliesData: []
  }
];

let projects = [];
let lessons = [];
let rooms = [];

console.log('✅ Data initialized - IN MEMORY STORAGE');

// Root endpoint
app.get('/', (req, res) => {
  console.log('📍 Root endpoint accessed');
  res.json({
    status: 'SUCCESS',
    message: 'AI Learning Hub Simple Backend is running!',
    version: 'simple-v1.0',
    server_type: 'in-memory-backend',
    timestamp: new Date().toISOString(),
    data_counts: {
      discussions: discussions.length,
      projects: projects.length,
      lessons: lessons.length,
      rooms: rooms.length
    }
  });
});

// Health endpoint  
app.get('/api/health', (req, res) => {
  console.log('📍 Health endpoint accessed');
  res.json({
    status: 'OK',
    message: 'AI Learning Hub API is running',
    version: 'simple-v1.0',
    server_type: 'in-memory-backend',
    discussions_count: discussions.length,
    projects_count: projects.length,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('📍 Test endpoint accessed');
  res.json({
    test: 'SUCCESS',
    message: 'Simple backend deployment successful!',
    version: 'simple-v1.0',
    discussions_available: discussions.length > 0,
    cross_user_sharing: 'ACTIVE'
  });
});

// =============== USER AUTHENTICATION ===============
app.post('/api/auth/register', (req, res) => {
  console.log('📍 POST /api/auth/register');
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Check if username already exists
    const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
      console.log('❌ Username already taken:', username);
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Check if email already exists
    const existingEmail = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingEmail) {
      console.log('❌ Email already registered:', email);
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Create new user
    const newUser = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: password, // In real app, this would be hashed
      created: new Date().toISOString()
    };
    
    users.push(newUser);
    console.log('✅ User registered:', newUser.username);
    
    // Return user without password
    const { password: _, ...userResponse } = newUser;
    res.json({ 
      success: true, 
      message: 'User registered successfully',
      user: userResponse 
    });
  } catch (error) {
    console.error('❌ Error registering user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  console.log('📍 POST /api/auth/login');
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user by username or email
    const user = users.find(u => 
      u.username.toLowerCase() === username.toLowerCase() || 
      u.email.toLowerCase() === username.toLowerCase()
    );
    
    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Check password
    if (user.password !== password) {
      console.log('❌ Invalid password for user:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    console.log('✅ User logged in:', user.username);
    
    // Return user without password
    const { password: _, ...userResponse } = user;
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: userResponse 
    });
  } catch (error) {
    console.error('❌ Error logging in user:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============== DISCUSSIONS ===============
app.get('/api/discussions', (req, res) => {
  console.log('📍 GET /api/discussions - returning', discussions.length, 'discussions');
  res.json(discussions);
});

app.post('/api/discussions', (req, res) => {
  console.log('📍 POST /api/discussions - creating discussion');
  try {
    const discussion = {
      id: 'disc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      ...req.body,
      created: new Date().toISOString(),
      replies: 0,
      repliesData: []
    };
    
    discussions.unshift(discussion);
    console.log('✅ Created discussion:', discussion.title, 'by', discussion.author);
    res.json(discussion);
  } catch (error) {
    console.error('❌ Error creating discussion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/discussions/:id', (req, res) => {
  console.log('📍 DELETE /api/discussions/' + req.params.id);
  try {
    const index = discussions.findIndex(d => d.id === req.params.id);
    
    if (index === -1) {
      console.log('❌ Discussion not found:', req.params.id);
      return res.status(404).json({ error: 'Discussion not found' });
    }
    
    // Basic ownership check
    const discussion = discussions[index];
    const { userId } = req.body || {};
    
    console.log('🔍 Delete request - Discussion author:', discussion.authorId, 'Requester:', userId);
    
    if (discussion.authorId !== userId && discussion.author !== userId) {
      console.log('❌ Unauthorized delete attempt');
      return res.status(403).json({ error: 'Unauthorized - can only delete own discussions' });
    }
    
    // Delete the discussion
    const deleted = discussions.splice(index, 1)[0];
    console.log('✅ Deleted discussion:', deleted.title);
    res.json({ success: true, message: 'Discussion deleted successfully', discussion: deleted });
  } catch (error) {
    console.error('❌ Error deleting discussion:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============== PROJECTS ===============
app.get('/api/projects', (req, res) => {
  console.log('📍 GET /api/projects');
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  console.log('📍 POST /api/projects');
  try {
    const project = {
      id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      ...req.body,
      created: new Date().toISOString(),
      likes: 0,
      stars: 0
    };
    
    projects.unshift(project);
    console.log('✅ Created project:', project.title);
    res.json(project);
  } catch (error) {
    console.error('❌ Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============== LESSONS ===============
app.get('/api/lessons', (req, res) => {
  console.log('📍 GET /api/lessons');
  res.json(lessons);
});

app.post('/api/lessons', (req, res) => {
  console.log('📍 POST /api/lessons');
  try {
    const lesson = {
      id: 'lesson_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      ...req.body,
      created: new Date().toISOString()
    };
    
    lessons.unshift(lesson);
    console.log('✅ Created lesson:', lesson.title);
    res.json(lesson);
  } catch (error) {
    console.error('❌ Error creating lesson:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============== ROOMS ===============
app.get('/api/rooms', (req, res) => {
  console.log('📍 GET /api/rooms');
  res.json(rooms);
});

app.post('/api/rooms', (req, res) => {
  console.log('📍 POST /api/rooms');
  try {
    const room = {
      id: 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      ...req.body,
      created: new Date().toISOString(),
      participants: []
    };
    
    rooms.unshift(room);
    console.log('✅ Created room:', room.name);
    res.json(room);
  } catch (error) {
    console.error('❌ Error creating room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Catch all other routes
app.use((req, res) => {
  console.log('📍 Unknown route accessed:', req.path);
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.path,
    available_endpoints: ['/api/health', '/api/test', '/api/discussions', '/api/projects', '/api/lessons', '/api/rooms']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('🚨 Error:', err);
  res.status(500).json({ error: 'Server error' });
});

// Start server
app.listen(PORT, () => {
  console.log('🎉 AI Learning Hub Simple Backend running on port', PORT);
  console.log('🌐 Version: simple-v1.0');
  console.log('📊 Initial data counts:');
  console.log('   - Discussions:', discussions.length);
  console.log('   - Projects:', projects.length);
  console.log('   - Lessons:', lessons.length);
  console.log('   - Rooms:', rooms.length);
});

console.log('🏁 Simple Backend setup complete - NO DATABASE DEPENDENCIES!');