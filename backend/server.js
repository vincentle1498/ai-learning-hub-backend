const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB Connection (using MongoDB Atlas free tier)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-learning-hub';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Simple Schema Definitions
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  created: { type: Date, default: Date.now }
});

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: String,
  tech: [String],
  author: String,
  authorId: String,
  files: Array,
  likes: { type: Number, default: 0 },
  stars: { type: Number, default: 0 },
  created: { type: Date, default: Date.now }
});

const DiscussionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: String,
  category: String,
  tags: [String],
  author: String,
  authorId: String,
  replies: { type: Number, default: 0 },
  repliesData: Array,
  created: { type: Date, default: Date.now }
});

const LessonSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  content: String,
  category: String,
  difficulty: String,
  duration: Number,
  author: String,
  authorId: String,
  created: { type: Date, default: Date.now }
});

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  category: String,
  maxParticipants: Number,
  owner: String,
  ownerId: String,
  participants: [String],
  isPrivate: Boolean,
  enableVoice: Boolean,
  enableScreen: Boolean,
  created: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', UserSchema);
const Project = mongoose.model('Project', ProjectSchema);
const Discussion = mongoose.model('Discussion', DiscussionSchema);
const Lesson = mongoose.model('Lesson', LessonSchema);
const Room = mongoose.model('Room', RoomSchema);

// ============= API ROUTES =============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Learning Hub API is running' });
});

// ----------- USER ROUTES -----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create user (in production, hash password!)
    const user = new User({ username, email, password });
    await user.save();
    
    res.json({ 
      success: true, 
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({ 
      success: true, 
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------- PROJECT ROUTES -----------
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ created: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const project = new Project(req.body);
    await project.save();
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------- DISCUSSION ROUTES -----------
app.get('/api/discussions', async (req, res) => {
  try {
    const discussions = await Discussion.find().sort({ created: -1 });
    res.json(discussions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/discussions', async (req, res) => {
  try {
    const discussion = new Discussion(req.body);
    await discussion.save();
    res.json(discussion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/discussions/:id/reply', async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    discussion.repliesData.push(req.body);
    discussion.replies = discussion.repliesData.length;
    await discussion.save();
    res.json(discussion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------- LESSON ROUTES -----------
app.get('/api/lessons', async (req, res) => {
  try {
    const lessons = await Lesson.find().sort({ created: -1 });
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lessons', async (req, res) => {
  try {
    const lesson = new Lesson(req.body);
    await lesson.save();
    res.json(lesson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------- ROOM ROUTES -----------
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ created: -1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const room = new Room(req.body);
    await room.save();
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rooms/:id/join', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room.participants.includes(req.body.username)) {
      room.participants.push(req.body.username);
      await room.save();
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});