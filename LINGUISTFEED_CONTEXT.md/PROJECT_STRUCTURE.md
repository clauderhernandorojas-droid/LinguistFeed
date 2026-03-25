# PROJECT_STRUCTURE.md

This document describes the folder and file structure of the LinguistFeed project.

Any AI agent working on the project must read this file before making modifications.

---

# Root Project Structure

LinguistFeed/

backend/
frontend/
AI_RULES.md
LINGUISTFEED_CONTEXT.md
PROJECT_STRUCTURE.md

---

# Backend Structure

backend/

server.js
routes/
services/
database/
middleware/

The backend is built with Node.js and Express.

The backend provides API endpoints for the Flutter frontend.

---

# Backend Entry Point

server.js

Responsibilities:

* initialize Express
* connect to SQLite database
* register API routes
* start the scheduler service
* expose backend endpoints

---

# Routes Folder

backend/routes/

Contains Express route definitions.

Example routes:

articles.js
auth.js

Key endpoint used by the frontend:

GET /daily-reading

This endpoint retrieves today's articles from the database.

---

# Services Folder

backend/services/

Contains the core application logic.

Important services:

articleService.js
schedulerService.js
scraperService.js
aiService.js

Responsibilities:

articleService

* fetches RSS feeds
* prepares article metadata

schedulerService

* runs every 6 hours
* processes RSS feeds
* scrapes article content
* stores articles in database
* registers daily articles

scraperService

* scrapes article text from URLs

aiService

* simplifies text using OpenRouter

---

# Database Folder

backend/database/

Contains the SQLite database connection.

Example file:

db.js

Responsibilities:

* connect to SQLite database
* expose db.get, db.run, db.all helpers

---

# Middleware Folder

backend/middleware/

Contains Express middleware.

Example:

auth.js

Used for authentication.

---

# Database Schema

articles table

id
url
title
topic
content
created_at

Stores full article content scraped from the web.

---

daily_articles table

id
date
topic
article_id

Stores which articles belong to each day.

article_id references articles.id.

---

# Article Processing Pipeline

RSS feed
→ articleService
→ schedulerService
→ scraperService
→ articles table
→ daily_articles table
→ /daily-reading endpoint
→ frontend

This pipeline must not be bypassed.

---

# Frontend Structure

frontend/

The frontend is a Flutter Web application.

Responsibilities:

* display daily articles
* show article paragraphs
* show vocabulary
* show quizzes
* track user progress

---

# Critical Files

The following files are critical to system stability:

services/schedulerService.js
services/articleService.js
routes/articles.js
database/db.js

These should not be modified without careful review.

---

# Development Workflow

The developer works with AI-assisted coding using:

Cursor
Claude
GPT

AI agents should:

* read LINGUISTFEED_CONTEXT.md
* follow AI_RULES.md
* understand PROJECT_STRUCTURE.md

before making any modifications.

---

# Goal of the System

The system delivers daily English reading content.

Each day users receive:

1 article per topic:

* technology
* science
* world
* culture

Each article includes:

title
content
vocabulary
quiz

The frontend consumes the API and displays the content to the learner.
