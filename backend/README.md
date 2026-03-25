# LinguistFeed Backend

LinguistFeed is an AI-powered reading platform for English learners. This backend provides the API for the Flutter frontend.

## Features

- User registration and authentication
- RSS feed ingestion
- Article scraping and simplification
- AI-powered text simplification to CEFR levels
- Quiz generation
- Progress tracking
- Background job for content updates

## Architecture

The backend follows a modular architecture:

```
backend/
├── server.js             # Main entry point
├── routes/               # API route handlers
│   ├── auth.js           # Authentication routes
│   ├── articles.js       # Article routes
│   ├── quiz.js           # Quiz routes
│   └── progress.js       # Progress tracking routes
├── services/             # Business logic
│   ├── rssService.js     # RSS feed handling
│   ├── scraperService.js # Web scraping
│   ├── aiService.js      # AI integration
│   ├── articleService.js # Article processing
│   ├── quizService.js    # Quiz management
│   ├── authService.js    # Authentication
│   └── schedulerService.js # Background jobs
├── database/             # Database layer
│   ├── db.js             # Database connection
│   └── schema.sql        # Database schema
├── utils/                # Utility functions
│   └── textCleaner.js    # Text processing
└── middleware/           # Express middleware
    └── auth.js           # JWT authentication
```

## Database Schema

The system uses SQLite with the following tables:

- `users`: User accounts with CEFR levels
- `interests`: Topics of interest
- `user_interests`: Junction table for user interests
- `articles`: Original articles from RSS feeds
- `simplified_articles`: Simplified versions at different CEFR levels
- `quizzes`: Comprehension quizzes for articles
- `attempts`: User quiz attempts and scores

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
cd backend
npm install
```

3. Create a `.env` file with your OpenRouter API key:

```
***REDACTED***=your_api_key_here
```

4. Start the server:

```bash
npm start
```

The server will run on http://localhost:3001 by default.

## API Endpoints

### Authentication

- `POST /register` - Register a new user
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "level": "B1"
  }
  ```

- `POST /login` - Login and get JWT token
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

### Articles

- `GET /daily-reading` - Get a personalized article for the user
- `GET /articles` - List articles (with optional level filter)
- `GET /articles/:id` - Get a specific article

### Quizzes

- `POST /submit-answer` - Submit a quiz answer
  ```json
  {
    "quiz_id": 3,
    "selected_option": 1
  }
  ```
- `GET /quizzes/:id` - Get a specific quiz
- `GET /quizzes/article/:articleId` - Get quizzes for an article
- `GET /quizzes/level/:level` - Get quizzes for a CEFR level

### Progress

- `GET /progress/:userId` - Get user progress summary
- `GET /progress/stats` - Get detailed statistics
- `GET /progress/history` - Get reading history
- `GET /progress/level-recommendation` - Get CEFR level recommendation

### Legacy Endpoints (maintained for compatibility)

- `POST /scrape` - Scrape an article from a URL
  ```json
  {
    "url": "https://example.com/article"
  }
  ```

- `POST /simplify` - Simplify text to a CEFR level
  ```json
  {
    "text": "Article text to simplify",
    "level": "B1"
  }
  ```

## Background Jobs

The system automatically fetches new articles from RSS feeds every 6 hours and processes them for all CEFR levels. This keeps the content fresh and ensures there's always reading material available for users.

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Protected endpoints require an Authorization header:

```
Authorization: Bearer your_jwt_token
```

## Example API Requests

### Register a new user

```bash
curl -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","level":"B1"}'
```

### Login

```bash
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Get daily reading

```bash
curl -X GET http://localhost:3001/daily-reading \
  -H "Authorization: Bearer your_jwt_token"
```

### Submit a quiz answer

```bash
curl -X POST http://localhost:3001/submit-answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token" \
  -d '{"quiz_id":3,"selected_option":1}'
```

### Get user progress

```bash
curl -X GET http://localhost:3001/progress/1 \
  -H "Authorization: Bearer your_jwt_token"
```

## Development

To run the server in development mode with auto-restart:

```bash
npm run dev
```

## Files Created/Modified

### Created Files

- `database/db.js`
- `database/schema.sql`
- `middleware/auth.js`
- `routes/auth.js`
- `routes/articles.js`
- `routes/quiz.js`
- `routes/progress.js`
- `services/rssService.js`
- `services/scraperService.js`
- `services/aiService.js`
- `services/articleService.js`
- `services/quizService.js`
- `services/authService.js`
- `services/schedulerService.js`
- `utils/textCleaner.js`
- `README.md`

### Modified Files

- `server.js` - Refactored to use the new modular architecture

## License

This project is licensed under the MIT License.