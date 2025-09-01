# AI Learning Hub - Backend API

RESTful API server for the AI Learning Hub platform.

## Tech Stack
- Node.js + Express
- MongoDB (Atlas)
- bcrypt for password hashing
- UUID for API key generation
- Rate limiting for security

## Setup

1. Clone the repository:
```bash
git clone https://github.com/vincentle1498/ai-learning-hub-backend.git
cd ai-learning-hub-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Update `.env` with your MongoDB Atlas connection string and other configs.

5. Run the server:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/generate-api-key` - Generate new API key

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create project (requires auth)
- `PUT /api/projects/:id` - Update project (requires auth)
- `DELETE /api/projects/:id` - Delete project (requires auth)

### Discussions
- `GET /api/discussions` - Get discussions
- `POST /api/discussions` - Create discussion (requires auth)
- `GET /api/discussions/:id/replies` - Get replies
- `POST /api/discussions/:id/reply` - Add reply (requires auth)

### Lessons
- `GET /api/lessons` - Get lessons
- `POST /api/lessons` - Create lesson (requires auth)
- `POST /api/lessons/:id/complete` - Mark lesson complete (requires auth)

### Rooms
- `GET /api/rooms` - Get active rooms
- `POST /api/rooms` - Create room (requires auth)
- `PUT /api/rooms/:id/join` - Join room (requires auth)
- `PUT /api/rooms/:id/leave` - Leave room (requires auth)

## Authentication

All protected endpoints require an API key in the header:
```
X-API-Key: ai_hub_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Deployment

Deployed on Render.com with automatic deploys from main branch.

## Environment Variables

See `.env.example` for required environment variables.