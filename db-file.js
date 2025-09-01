const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// File-based database for Render deployment
class FileDB {
  constructor() {
    this.dataDir = process.env.NODE_ENV === 'production' 
      ? '/opt/render/project/src/data' 
      : path.join(__dirname, 'data');
    this.collections = {};
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log('📁 Data directory initialized:', this.dataDir);
      
      // Load existing data
      await this.loadCollections();
      
      // Create indexes
      await this.createIndexes();
      
      this.initialized = true;
      console.log('✅ File-based database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize file database:', error);
      throw error;
    }
  }

  async loadCollections() {
    const collectionNames = ['users', 'projects', 'discussions', 'lessons', 'rooms'];
    
    for (const name of collectionNames) {
      const filePath = path.join(this.dataDir, `${name}.json`);
      try {
        const data = await fs.readFile(filePath, 'utf8');
        this.collections[name] = JSON.parse(data);
        console.log(`📚 Loaded collection: ${name} (${this.collections[name].length} documents)`);
      } catch (error) {
        // If file doesn't exist, create empty collection
        this.collections[name] = [];
        await this.saveCollection(name);
        console.log(`📝 Created new collection: ${name}`);
      }
    }
  }

  async saveCollection(name) {
    const filePath = path.join(this.dataDir, `${name}.json`);
    await fs.writeFile(filePath, JSON.stringify(this.collections[name], null, 2));
  }

  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = [];
    }

    return {
      insertOne: async (doc) => {
        const document = {
          ...doc,
          _id: doc._id || crypto.randomBytes(12).toString('hex'),
          createdAt: doc.createdAt || new Date()
        };
        this.collections[name].push(document);
        await this.saveCollection(name);
        return { insertedId: document._id, acknowledged: true };
      },

      findOne: async (query) => {
        return this.collections[name].find(doc => this.matchQuery(doc, query));
      },

      find: (query = {}) => {
        const results = this.collections[name].filter(doc => this.matchQuery(doc, query));
        return {
          sort: (sortSpec) => {
            const key = Object.keys(sortSpec)[0];
            const order = sortSpec[key];
            results.sort((a, b) => {
              if (order === 1) return a[key] > b[key] ? 1 : -1;
              return a[key] < b[key] ? 1 : -1;
            });
            return {
              limit: (n) => ({
                toArray: async () => results.slice(0, n)
              }),
              toArray: async () => results
            };
          },
          limit: (n) => ({
            toArray: async () => results.slice(0, n)
          }),
          toArray: async () => results
        };
      },

      updateOne: async (query, update) => {
        const index = this.collections[name].findIndex(doc => this.matchQuery(doc, query));
        if (index === -1) {
          return { matchedCount: 0, modifiedCount: 0 };
        }

        if (update.$set) {
          Object.assign(this.collections[name][index], update.$set);
        }
        if (update.$push) {
          for (const key in update.$push) {
            if (!Array.isArray(this.collections[name][index][key])) {
              this.collections[name][index][key] = [];
            }
            this.collections[name][index][key].push(update.$push[key]);
          }
        }
        
        await this.saveCollection(name);
        return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
      },

      deleteOne: async (query) => {
        const index = this.collections[name].findIndex(doc => this.matchQuery(doc, query));
        if (index === -1) {
          return { deletedCount: 0 };
        }
        
        this.collections[name].splice(index, 1);
        await this.saveCollection(name);
        return { deletedCount: 1, acknowledged: true };
      },

      deleteMany: async (query) => {
        const before = this.collections[name].length;
        this.collections[name] = this.collections[name].filter(doc => !this.matchQuery(doc, query));
        const deleted = before - this.collections[name].length;
        await this.saveCollection(name);
        return { deletedCount: deleted, acknowledged: true };
      },

      countDocuments: async (query = {}) => {
        return this.collections[name].filter(doc => this.matchQuery(doc, query)).length;
      },

      createIndex: async () => {
        // Indexes are handled in memory for this implementation
        return { ok: 1 };
      }
    };
  }

  matchQuery(doc, query) {
    for (const key in query) {
      if (query[key] && typeof query[key] === 'object') {
        // Handle operators like $in, $regex, etc.
        if (query[key].$in && !query[key].$in.includes(doc[key])) {
          return false;
        }
        if (query[key].$regex) {
          const regex = new RegExp(query[key].$regex, query[key].$options || '');
          if (!regex.test(doc[key])) {
            return false;
          }
        }
      } else if (doc[key] !== query[key]) {
        return false;
      }
    }
    return true;
  }

  async createIndexes() {
    console.log('✅ Indexes created (in-memory)');
  }
}

// Singleton instance
let db = null;

const connectDB = async () => {
  if (db) return db;
  
  db = new FileDB();
  await db.init();
  return db;
};

const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
};

const closeDB = async () => {
  // File-based DB doesn't need explicit closing
  console.log('📴 File database connection closed');
};

module.exports = {
  connectDB,
  getDB,
  closeDB
};