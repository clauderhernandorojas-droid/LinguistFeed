# LinguistFeed Architectural Analysis

## 1. Project Overview

LinguistFeed is a language learning application designed to help users improve their language skills through reading articles tailored to their proficiency level. The application follows a microservices architecture with a clear separation between frontend and backend components.

## 2. System Architecture

### Frontend Components (Flutter App)

The frontend is built using Flutter, a cross-platform UI toolkit:

- **Main Entry Point**: `lib/main.dart` serves as the entry point for the Flutter application.
- **State Management**: Uses Flutter Riverpod for state management.
- **Navigation**: Implements Go Router for navigation between screens.
- **UI Components**:
  - `LoginScreen`: Entry point for user authentication.
  - `StudentFeedScreen`: Displays available articles with filtering options.
  - `DailyReadingScreen`: Shows the content of a selected article.

### Backend Components (Node.js Services)

The backend is built with Node.js and Express, organized into several services:

- **API Server**: `server.js` is the main entry point that initializes the Express application and connects to the database.
- **Authentication Service**: `authService.js` handles user registration, login, and token verification.
- **Article Service**: `articleService.js` manages the article pipeline, including storage and retrieval.
- **Quiz Service**: `quizService.js` handles quiz generation, storage, and user attempts.
- **AI Service**: `aiService.js` interfaces with OpenRouter API to simplify articles and generate quizzes.
- **RSS Service**: `rssService.js` fetches articles from various RSS feeds.
- **Scraper Service**: `scraperService.js` extracts content from web pages.
- **Scheduler Service**: `schedulerService.js` manages background jobs for article fetching.

### Database Layer (SQLite)

The application uses SQLite for data storage:

- **Database Connection**: `db.js` provides a connection to the SQLite database and helper functions.
- **Schema**: `schema.sql` defines the database structure with tables for users, articles, quizzes, etc.
- **Initialization**: `init-db.js` initializes the database with the latest schema.

### API Endpoints

The backend exposes several API endpoints organized into route files:

- **Authentication Routes** (`auth.js`):
  - `/register`: Register a new user
  - `/login`: Login a user
  - `/profile`: Get user profile
  - `/profile/level`: Update user's CEFR level
  - `/profile/interests`: Manage user interests

- **Article Routes** (`articles.js`):
  - `/daily-reading`: Get a daily reading article
  - `/articles`: Get a list of articles
  - `/articles/:id`: Get a specific article
  - `/scrape`: Scrape an article from a URL
  - `/simplify`: Simplify text using AI

- **Quiz Routes** (`quiz.js`):
  - `/quizzes/:id`: Get a specific quiz
  - `/quizzes/article/:articleId`: Get quizzes for a specific article
  - `/quizzes/level/:level`: Get quizzes for a specific CEFR level
  - `/submit-answer`: Submit an answer to a quiz
  - `/attempts`: Get quiz attempts for the current user

- **Progress Routes** (`progress.js`):
  - `/progress/:userId`: Get progress for a user
  - `/progress/stats`: Get statistics for the current user
  - `/progress/history`: Get reading history for the current user
  - `/progress/level-recommendation`: Get a level recommendation for the user

## 3. Data Flow

### Article Ingestion Pipeline

1. **RSS Feed Fetching**:
   - The `rssService` fetches articles from configured RSS feeds.
   - It extracts article URLs and metadata (title, source, category).

2. **Web Scraping**:
   - The `scraperService` extracts the main content from each article URL.
   - It cleans the text using the `textCleaner` utility.

3. **AI Processing**:
   - The `aiService` simplifies the article text to different CEFR levels (A1-C2).
   - It extracts vocabulary words with definitions and examples.
   - It generates comprehension quizzes for each article.

4. **Storage**:
   - The `articleService` stores the original article, simplified versions, vocabulary, and quizzes in the database.

5. **Scheduled Updates**:
   - The `schedulerService` runs the article ingestion pipeline every 6 hours.
   - It processes articles for different CEFR levels.

### User Reading Flow

1. User logs in through the `LoginScreen`.
2. User browses available articles in the `StudentFeedScreen`.
3. User selects an article and chooses a reading level.
4. The app fetches the simplified article, vocabulary, and quiz from the backend.
5. User reads the article in the `DailyReadingScreen`.
6. User completes the quiz, and the attempt is recorded.
7. User's progress and statistics are updated.

## 4. Data Models

### Core Data Models

1. **User**:
   - ID, email, password hash, CEFR level, creation date
   - Associated with interests and quiz attempts

2. **Article**:
   - ID, title, source, URL, topic, original text, creation date
   - Associated with simplified versions, vocabulary, and quizzes

3. **Simplified Article**:
   - ID, article ID, CEFR level, simplified text
   - Each article can have multiple simplified versions for different levels

4. **Vocabulary**:
   - ID, article ID, CEFR level, word, definition, example
   - Associated with specific articles and levels

5. **Quiz**:
   - ID, article ID, CEFR level, question, options, correct index, hint
   - Each article can have multiple quizzes for different levels

6. **Attempt**:
   - ID, user ID, quiz ID, selected option, correctness, completion date
   - Records user's quiz attempts

7. **Interest**:
   - ID, name
   - Users can have multiple interests to personalize content

## 5. Authentication System

The application implements JWT-based authentication:

- **Registration**: Users register with email, password, and CEFR level.
- **Login**: Users login with email and password to receive a JWT token.
- **Token Verification**: The `authenticate` middleware verifies the JWT token for protected routes.
- **User Profile**: Users can update their CEFR level and manage their interests.

## 6. Gamification and Progress Tracking

The application includes several features for gamification and progress tracking:

- **Quiz Attempts**: Users complete quizzes to test their comprehension.
- **Progress Statistics**: Users can view their quiz success rate and articles read.
- **Level Recommendation**: The system recommends CEFR level changes based on quiz performance.
- **Reading History**: Users can view their reading history.

## 7. AI Integration

The application integrates with AI services through the OpenRouter API:

- **Text Simplification**: Simplifies articles to different CEFR levels.
- **Vocabulary Extraction**: Extracts important vocabulary words with definitions and examples.
- **Quiz Generation**: Generates comprehension quizzes for articles.

## 8. Scheduled Tasks

The application includes a scheduler for background tasks:

- **Article Fetching**: Fetches and processes new articles every 6 hours.
- **Initial Population**: Runs an initial article fetching job on startup.

## 9. Future Development Opportunities

Based on the codebase analysis, several areas for future development are apparent:

- **Teacher Interface**: The current implementation focuses on the student experience, with a teacher interface planned for future development.
- **Mobile App Integration**: The Flutter frontend is prepared for cross-platform deployment.
- **Enhanced Gamification**: The progress tracking system could be expanded with badges, streaks, and rewards.
- **Content Personalization**: The interest-based article recommendation could be enhanced with machine learning.
- **Social Features**: Adding social features like sharing progress or collaborative learning.