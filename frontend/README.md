# LinguistFeed Frontend

This is the frontend for the LinguistFeed application, an educational web app that helps ESL/EFL students improve their English by reading daily news articles and interacting with them through quizzes, flashcards, and guided reading tools.

## Project Structure

The frontend is organized into the following structure:

```
frontend/
│
├── index.html           # Landing page with login/register links
├── login.html           # User login form
├── register.html        # User registration form
├── dashboard.html       # Student dashboard showing basic stats
├── reader.html          # Displays the daily articles
├── quiz.html            # Placeholder for future comprehension quizzes
├── admin.html           # Placeholder for a future teacher/admin panel
│
├── css/
│   └── styles.css       # Shared CSS styles
│
├── js/
│   ├── api.js           # Handles communication with the backend API
│   ├── auth.js          # Handles login, logout, and session management
│   ├── reader.js        # Fetches and renders the daily article
│   └── dashboard.js     # Loads student progress (placeholder for now)
│
└── README.md            # This file
```

## How to Run Locally

Follow these steps to run the LinguistFeed application locally:

### 1. Start the Backend Server

The backend server needs to be running for the frontend to fetch articles and handle authentication.

```
cd backend
node server.js
```

The server should start and display a message like:
```
Server running on http://localhost:3001
```

### 2. Open the Frontend

You can open any of the HTML files directly in your browser:

- `index.html` - The landing page
- `login.html` - The login page
- `register.html` - The registration page
- `dashboard.html` - The student dashboard
- `reader.html` - The article reader
- `quiz.html` - The quiz page (placeholder)
- `admin.html` - The admin panel (placeholder)

For example:
```
start frontend/index.html
```

### 3. Testing the Application

#### User Flow

1. Open `index.html` in your browser
2. Click "Register" to create a new account
3. Fill in the registration form and submit
4. You will be redirected to the dashboard
5. Click "Today's Articles" to read the daily articles
6. The articles should be fetched from the backend and displayed

#### Authentication

The current implementation uses localStorage for authentication, which is suitable for development but not for production. In a real application, you would use a more secure authentication method.

- When you register or login, your user information is stored in localStorage
- Protected pages (dashboard, reader, quiz, admin) check if you're logged in
- If you're not logged in, you'll be redirected to the login page
- You can logout by clicking the "Logout" link in the navigation bar

#### API Communication

The frontend communicates with the backend through the API module (`js/api.js`). The main endpoints used are:

- `GET /daily-articles` - Fetches the daily articles
- `POST /generate-flashcard` - Generates a flashcard for a clicked word

#### Vocabulary Flashcards

The reader page includes a vocabulary flashcard feature:

1. Each word in an article is clickable
2. When a user clicks on a word, a request is sent to the backend
3. The backend generates a flashcard with:
   - Definition of the word
   - Example sentence
   - Translation
4. The flashcard is displayed in a popup
5. Users can close the popup by clicking the close button or clicking outside the popup

## Future Development

The current implementation is a basic structure that can be expanded upon. Future development could include:

- Real authentication with the backend
- Reading progress tracking
- Reading comprehension quizzes
- Enhanced flashcard system with saving and review features
- Intelligent reader tools (simplify paragraph, vocabulary help)
- Student progress analytics
- Teacher/admin dashboard
- Article recommendations by topic or level
- Classroom/group management

## Notes for Developers

- The code is written in plain HTML, CSS, and JavaScript without any frameworks
- ES6 modules are used to organize the JavaScript code
- The CSS is organized into sections for different components
- The HTML files share a common structure with navigation and footer