const { getDB } = require('../db');

// API Key authentication middleware
const authenticateAPIKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required. Please include x-api-key header or apiKey query parameter' 
      });
    }
    
    const db = getDB();
    const user = await db.collection('users').findOne({ apiKey });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional authentication - attaches user if API key provided but doesn't require it
const optionalAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (apiKey) {
      const db = getDB();
      const user = await db.collection('users').findOne({ apiKey });
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};

module.exports = {
  authenticateAPIKey,
  optionalAuth
};