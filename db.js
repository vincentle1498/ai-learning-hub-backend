const { MongoClient } = require('mongodb');
require('dotenv').config();

let db = null;
let client = null;

// Use file-based DB on Render if MongoDB fails
const useFileDB = process.env.USE_FILE_DB === 'true';

const connectDB = async () => {
  // If forced to use file DB or on Render with connection issues
  if (useFileDB || (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI)) {
    const fileDB = require('./db-file');
    return await fileDB.connectDB();
  }
  try {
    if (db) return db;
    
    let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-learning-hub';
    
    // Ensure the connection string includes the database name
    if (uri.includes('mongodb.net/') && !uri.includes('mongodb.net/ai-learning-hub')) {
      uri = uri.replace('mongodb.net/', 'mongodb.net/ai-learning-hub');
    }
    
    // Log connection attempt (hide password)
    const sanitizedUri = uri.replace(/:([^@]+)@/, ':****@');
    console.log('🔄 Attempting to connect to MongoDB:', sanitizedUri);
    console.log('📍 Node version:', process.version);
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    
    // MongoDB Atlas connection options for Node 18
    let options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4 // Force IPv4
    };
    
    // For Render deployment, bypass SSL issues
    if (process.env.NODE_ENV === 'production' && process.env.RENDER) {
      // Try connecting without explicit TLS settings
      console.log('🔐 Using Render-compatible connection settings');
      
      // If the URI uses mongodb+srv, let the driver handle TLS automatically
      if (!uri.startsWith('mongodb+srv://')) {
        options.tls = true;
        options.tlsAllowInvalidCertificates = true;
      }
    } else {
      // Non-Render environments
      options.tls = true;
    }
    
    client = new MongoClient(uri, options);
    
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');
    
    db = client.db();
    
    // Create indexes for better performance
    await createIndexes();
    
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Fallback to file-based DB on Render
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Falling back to file-based database...');
      const fileDB = require('./db-file');
      db = await fileDB.connectDB();
      return db;
    }
    
    if (error.code) console.error('Error code:', error.code);
    if (error.codeName) console.error('Code name:', error.codeName);
    console.error('Full error:', error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    // User indexes
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ apiKey: 1 }, { sparse: true });
    
    // Project indexes
    await db.collection('projects').createIndex({ created: -1 });
    await db.collection('projects').createIndex({ userId: 1 });
    
    // Discussion indexes
    await db.collection('discussions').createIndex({ created: -1 });
    
    // Lesson indexes
    await db.collection('lessons').createIndex({ created: -1 });
    
    // Room indexes
    await db.collection('rooms').createIndex({ created: -1 });
    await db.collection('rooms').createIndex({ status: 1 });
    
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('Index creation error:', error);
  }
};

const getDB = () => {
  if (useFileDB || (process.env.NODE_ENV === 'production' && !client)) {
    const fileDB = require('./db-file');
    return fileDB.getDB();
  }
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
};

const closeDB = async () => {
  if (client) {
    await client.close();
    db = null;
    client = null;
    console.log('📴 MongoDB connection closed');
  }
};

module.exports = {
  connectDB,
  getDB,
  closeDB
};