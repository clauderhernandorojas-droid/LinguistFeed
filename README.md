# LinguistFeed

LinguistFeed is a Flutter Web application that simplifies text from external websites and adapts it to different language proficiency levels using the Gemini API.

## Architecture

The application follows a client-server architecture:

- **Flutter Web (Frontend)**: Handles the user interface and communicates with the backend.
- **Node.js Express (Backend)**: Performs web scraping and communicates with the Gemini API.

This architecture solves CORS issues that occur when trying to scrape websites directly from a browser.

## Setup Instructions

### 1. Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the backend directory with your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Start the backend server:
   ```
   npm start
   ```

   The server will run on http://localhost:3000 with the following endpoints:
   - POST /scrape - Scrapes a webpage and extracts text
   - POST /simplify - Simplifies text using the Gemini API

### 2. Frontend Setup

1. Install Flutter dependencies:
   ```
   flutter pub get
   ```

2. Run the Flutter web application:
   ```
   flutter run -d chrome
   ```

## How It Works

1. The user enters a URL in the Flutter application.
2. The Flutter app sends the URL to the backend's `/scrape` endpoint.
3. The backend scrapes the webpage, extracts the text, and returns it to the Flutter app.
4. The user selects a language level (A1-C2) and clicks "Graduar con IA".
5. The Flutter app sends the text and selected level to the backend's `/simplify` endpoint.
6. The backend calls the Gemini API to simplify the text and returns the result to the Flutter app.
7. The Flutter app displays the simplified text, a quiz, and a grammar note.

## API Endpoints

### POST /scrape

**Request:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "text": "full extracted article text"
}
```

### POST /simplify

**Request:**
```json
{
  "text": "...",
  "level": "B1"
}
```

**Response:**
```json
{
  "textoSimplificado": "...",
  "quiz": {
    "pregunta": "...",
    "opciones": ["A", "B", "C"],
    "respuestaCorrectaIndice": 0,
    "pista": "..."
  },
  "notaGramatical": "..."
}
```

## Troubleshooting

- If you encounter CORS issues, make sure the backend server is running and the Flutter app is connecting to the correct URL.
- If the Gemini API calls fail, check that your API key is correctly set in the `.env` file.
- For scraping issues, check the website's robots.txt file to ensure scraping is allowed.