// API Configuration
const API_URL = window.API_URL || 'https://ai-learning-hub-backend.onrender.com/api';
// For local testing: const API_URL = 'http://localhost:5000/api';

// API Helper Functions
const ApiService = {
  // Get stored API key
  getApiKey() {
    const user = JSON.parse(localStorage.getItem('aiHub_currentUser') || '{}');
    return user.apiKey || null;
  },

  // Generic fetch wrapper
  async request(endpoint, options = {}) {
    try {
      const apiKey = this.getApiKey();
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      // Add API key if available
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers,
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      // Fallback to localStorage if API fails
      return null;
    }
  },

  // Authentication
  async register(username, email, password) {
    const result = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
    
    if (result && result.success) {
      localStorage.setItem('aiHub_currentUser', JSON.stringify(result.user));
      return result.user;
    }
    return null;
  },

  async login(username, password) {
    const result = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    if (result && result.success) {
      localStorage.setItem('aiHub_currentUser', JSON.stringify(result.user));
      return result.user;
    }
    return null;
  },

  // Projects
  async getProjects() {
    const projects = await this.request('/projects');
    if (projects) {
      localStorage.setItem('aiHub_projects', JSON.stringify(projects));
      return projects;
    }
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem('aiHub_projects') || '[]');
  },

  async createProject(projectData) {
    const project = await this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
    
    if (project) {
      // Update localStorage cache
      const projects = JSON.parse(localStorage.getItem('aiHub_projects') || '[]');
      projects.unshift(project);
      localStorage.setItem('aiHub_projects', JSON.stringify(projects));
      return project;
    }
    return null;
  },

  async updateProject(id, updates) {
    return await this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async deleteProject(id) {
    return await this.request(`/projects/${id}`, {
      method: 'DELETE'
    });
  },

  // Discussions
  async getDiscussions() {
    const discussions = await this.request('/discussions');
    if (discussions) {
      localStorage.setItem('aiHub_discussions', JSON.stringify(discussions));
      return discussions;
    }
    return JSON.parse(localStorage.getItem('aiHub_discussions') || '[]');
  },

  async createDiscussion(discussionData) {
    const discussion = await this.request('/discussions', {
      method: 'POST',
      body: JSON.stringify(discussionData)
    });
    
    if (discussion) {
      const discussions = JSON.parse(localStorage.getItem('aiHub_discussions') || '[]');
      discussions.unshift(discussion);
      localStorage.setItem('aiHub_discussions', JSON.stringify(discussions));
      return discussion;
    }
    return null;
  },

  async addReply(discussionId, replyData) {
    return await this.request(`/discussions/${discussionId}/reply`, {
      method: 'POST',
      body: JSON.stringify(replyData)
    });
  },

  // Lessons
  async getLessons() {
    const lessons = await this.request('/lessons');
    if (lessons) {
      localStorage.setItem('aiHub_lessons', JSON.stringify(lessons));
      return lessons;
    }
    return JSON.parse(localStorage.getItem('aiHub_lessons') || '[]');
  },

  async createLesson(lessonData) {
    const lesson = await this.request('/lessons', {
      method: 'POST',
      body: JSON.stringify(lessonData)
    });
    
    if (lesson) {
      const lessons = JSON.parse(localStorage.getItem('aiHub_lessons') || '[]');
      lessons.unshift(lesson);
      localStorage.setItem('aiHub_lessons', JSON.stringify(lessons));
      return lesson;
    }
    return null;
  },

  // Rooms
  async getRooms() {
    const rooms = await this.request('/rooms');
    if (rooms) {
      localStorage.setItem('aiHub_rooms', JSON.stringify(rooms));
      return rooms;
    }
    return JSON.parse(localStorage.getItem('aiHub_rooms') || '[]');
  },

  async createRoom(roomData) {
    const room = await this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify(roomData)
    });
    
    if (room) {
      const rooms = JSON.parse(localStorage.getItem('aiHub_rooms') || '[]');
      rooms.unshift(room);
      localStorage.setItem('aiHub_rooms', JSON.stringify(rooms));
      return room;
    }
    return null;
  },

  async joinRoom(roomId, username) {
    return await this.request(`/rooms/${roomId}/join`, {
      method: 'PUT',
      body: JSON.stringify({ username })
    });
  }
};

// Update existing functions to use API
async function loadAppDataWithAPI() {
  // Try to load from API first, fallback to localStorage
  APP_STATE.projects = await ApiService.getProjects();
  APP_STATE.discussions = await ApiService.getDiscussions();
  APP_STATE.lessons = await ApiService.getLessons();
  APP_STATE.rooms = await ApiService.getRooms();
  
  // Render the data
  if (APP_STATE.currentPage === 'projects') renderProjects();
  if (APP_STATE.currentPage === 'discussions') renderDiscussions();
  if (APP_STATE.currentPage === 'lessons') renderLessons();
  if (APP_STATE.currentPage === 'collaborate') renderRooms();
}

// Override the existing createProject function
const originalCreateProject = window.createProject;
window.createProject = async function(event) {
  event.preventDefault();
  
  const title = document.getElementById('project-title').value.trim();
  const category = document.getElementById('project-category').value;
  const description = document.getElementById('project-description').value.trim();
  const tech = document.getElementById('project-tech').value.split(',').map(t => t.trim()).filter(t => t);
  const docs = document.getElementById('project-docs').value;
  
  if (!validateProjectInput(title, description)) {
    return;
  }
  
  const projectData = {
    title: sanitizeInput(title),
    category,
    description: sanitizeInput(description),
    tech,
    documentation: docs,
    files: uploadedFiles.project || [],
    author: APP_STATE.currentUser.username,
    authorId: APP_STATE.currentUser.id
  };
  
  // Try API first
  const newProject = await ApiService.createProject(projectData);
  
  if (!newProject) {
    // Fallback to original localStorage method
    originalCreateProject(event);
    return;
  }
  
  closeModal();
  renderProjects();
  showToast('Project created successfully!', 'success');
};

// Add this script to your index.html before the closing </body> tag:
// <script src="api-integration.js"></script>