const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

// PostgreSQL connection for Supabase
const connectDB = async () => {
  try {
    if (pool) return pool;
    
    // Parse DATABASE_URL or use individual params
    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
    
    // Log connection attempt (hide password)
    const sanitized = connectionString.replace(/:([^@]+)@/, ':****@');
    console.log('🔄 Connecting to PostgreSQL (Supabase)...');
    console.log('📍 Connection string:', sanitized);
    
    // Parse connection string and force IPv4
    const config = {
      connectionString,
      ssl: {
        rejectUnauthorized: false // Required for Supabase
      },
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
    
    // Handle Supabase pooler connection format
    if (process.env.NODE_ENV === 'production') {
      // Check if using pooler (has .pooler.supabase.com)
      if (connectionString.includes('.pooler.supabase.com')) {
        // Pooler uses different username format: postgres.projectid
        // The connection string parser should handle this correctly
        console.log('🔄 Using Supabase pooler connection');
      } else {
        // Direct connection - extract components for IPv4
        const match = connectionString.match(/(@db\.)([^.]+)(\.supabase\.co)/);
        if (match) {
          config.host = `db.${match[2]}.supabase.co`;
          config.port = 5432;
          config.database = 'postgres';
          config.user = 'postgres';
          config.password = connectionString.match(/:([^@]+)@/)[1];
          delete config.connectionString; // Use individual params instead
        }
      }
    }
    
    pool = new Pool(config);
    
    // Test the connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    console.log('✅ Connected to PostgreSQL successfully at:', result.rows[0].now);
    
    // Create tables if they don't exist
    await createTables();
    
    return pool;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    
    // Fallback to file-based DB
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Falling back to file-based database...');
      const fileDB = require('./db-file');
      return await fileDB.connectDB();
    }
    
    throw error;
  }
};

const createTables = async () => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        technologies TEXT[],
        github_url VARCHAR(500),
        demo_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        likes INTEGER DEFAULT 0,
        stars INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0
      )
    `);
    
    // Discussions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS discussions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        content TEXT,
        category VARCHAR(100),
        tags TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        replies INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0
      )
    `);
    
    // Replies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS replies (
        id SERIAL PRIMARY KEY,
        discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Lessons table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        author_name VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content TEXT,
        difficulty VARCHAR(50),
        duration INTEGER,
        prerequisites TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        views INTEGER DEFAULT 0,
        completions INTEGER DEFAULT 0
      )
    `);
    
    // Rooms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        owner_name VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        participants TEXT[],
        max_participants INTEGER DEFAULT 10,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_discussions_created ON discussions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_lessons_created ON lessons(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
      CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
    `);
    
    console.log('✅ PostgreSQL tables and indexes created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
};

// PostgreSQL compatible getDB function
const getDB = () => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  
  // Return MongoDB-like interface for compatibility
  return {
    collection: (name) => ({
      findOne: async (query) => {
        const whereClause = buildWhereClause(query);
        const result = await pool.query(
          `SELECT * FROM ${name} WHERE ${whereClause.text} LIMIT 1`,
          whereClause.values
        );
        return result.rows[0] || null;
      },
      
      find: (query = {}) => {
        const whereClause = buildWhereClause(query);
        return {
          sort: (sortObj) => ({
            skip: (offset) => ({
              limit: (limit) => ({
                toArray: async () => {
                  const sortClause = buildSortClause(sortObj);
                  const result = await pool.query(
                    `SELECT * FROM ${name} 
                     WHERE ${whereClause.text} 
                     ORDER BY ${sortClause}
                     OFFSET $${whereClause.values.length + 1} 
                     LIMIT $${whereClause.values.length + 2}`,
                    [...whereClause.values, offset, limit]
                  );
                  return result.rows;
                }
              })
            })
          })
        };
      },
      
      insertOne: async (doc) => {
        const columns = Object.keys(doc).filter(k => k !== '_id');
        const values = columns.map(k => doc[k]);
        const placeholders = columns.map((_, i) => `$${i + 1}`);
        
        const result = await pool.query(
          `INSERT INTO ${name} (${columns.join(', ')}) 
           VALUES (${placeholders.join(', ')}) 
           RETURNING *`,
          values
        );
        
        return {
          insertedId: result.rows[0].id,
          acknowledged: true
        };
      },
      
      updateOne: async (query, update) => {
        const whereClause = buildWhereClause(query);
        const setClause = buildSetClause(update.$set || update);
        
        const result = await pool.query(
          `UPDATE ${name} 
           SET ${setClause.text} 
           WHERE ${whereClause.text} 
           RETURNING *`,
          [...setClause.values, ...whereClause.values]
        );
        
        return {
          modifiedCount: result.rowCount,
          acknowledged: true
        };
      },
      
      deleteOne: async (query) => {
        const whereClause = buildWhereClause(query);
        
        const result = await pool.query(
          `DELETE FROM ${name} WHERE ${whereClause.text}`,
          whereClause.values
        );
        
        return {
          deletedCount: result.rowCount,
          acknowledged: true
        };
      }
    })
  };
};

// Helper functions to convert MongoDB-style queries to PostgreSQL
const buildWhereClause = (query) => {
  if (!query || Object.keys(query).length === 0) {
    return { text: '1=1', values: [] };
  }
  
  const conditions = [];
  const values = [];
  let paramCount = 1;
  
  for (const [key, value] of Object.entries(query)) {
    if (key === '_id' || key === 'id') {
      conditions.push(`id = $${paramCount}`);
      values.push(value);
      paramCount++;
    } else if (key === '$or') {
      const orConditions = value.map(cond => {
        const subConditions = [];
        for (const [k, v] of Object.entries(cond)) {
          subConditions.push(`${k} = $${paramCount}`);
          values.push(v);
          paramCount++;
        }
        return `(${subConditions.join(' AND ')})`;
      });
      conditions.push(`(${orConditions.join(' OR ')})`);
    } else {
      conditions.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }
  
  return {
    text: conditions.join(' AND '),
    values
  };
};

const buildSetClause = (update) => {
  const sets = [];
  const values = [];
  let paramCount = 1;
  
  for (const [key, value] of Object.entries(update)) {
    if (key !== '_id' && key !== 'id') {
      sets.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }
  
  return {
    text: sets.join(', '),
    values
  };
};

const buildSortClause = (sortObj) => {
  if (!sortObj || Object.keys(sortObj).length === 0) {
    return 'id ASC';
  }
  
  const sorts = [];
  for (const [key, value] of Object.entries(sortObj)) {
    const column = key === 'created' ? 'created_at' : key;
    const direction = value === -1 ? 'DESC' : 'ASC';
    sorts.push(`${column} ${direction}`);
  }
  
  return sorts.join(', ');
};

const closeDB = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('📴 PostgreSQL connection closed');
  }
};

module.exports = {
  connectDB,
  getDB,
  closeDB
};