# ARCHITECTURE.md

This document defines the architectural principles of the LinguistFeed project.

Any AI agent working on this codebase must follow these architectural constraints.

---

# System Goal

LinguistFeed delivers daily English reading content derived from real news sources.

The system automatically:

1. Collects articles from RSS feeds
2. Scrapes the article text
3. Stores articles in a database
4. Generates simplified versions with AI
5. Delivers a daily reading to users through an API
6. Displays the reading in a Flutter frontend

---

# High-Level Architecture

The system follows a **pipeline architecture**.

RSS Feeds
→ Article Service
→ Scheduler
→ Scraper
→ Database
→ API Layer
→ Frontend

Each component has a single responsibility.

---

# Backend Architecture

The backend is organized into layers:

Routes → Services → Database

Routes
Handle HTTP requests.

Services
Contain application logic.

Database
Handles data storage and queries.

Routes must never contain business logic.

All processing must occur in services.

---

# Service Responsibilities

articleService
Responsible for retrieving RSS articles and preparing metadata.

schedulerService
Responsible for scheduling background jobs.

scraperService
Responsible for extracting article text from web pages.

aiService
Responsible for AI-generated simplification and exercises.

Services must remain independent and focused on one responsibility.

---

# Database Architecture

SQLite is used for the MVP.

Tables:

articles
Stores scraped articles.

daily_articles
Stores which articles belong to each day.

Future tables may include:

simplified_articles
vocabulary
quizzes
user_progress

Relationships must remain simple and explicit.

---

# Data Flow

Correct data flow:

RSS → metadata
metadata → scraper
scraper → articles table
articles → daily_articles
daily_articles → API
API → frontend

No component should bypass this flow.

---

# Scheduler Design

The scheduler runs every 6 hours.

Responsibilities:

1. Fetch RSS feeds
2. Identify new articles
3. Scrape content
4. Store article
5. Register article for the day

Scheduler must remain idempotent.

Running it multiple times should not create duplicates.

---

# API Layer

The backend exposes REST endpoints.

Example:

GET /daily-reading

This endpoint returns today's articles.

API responses must be JSON.

The API layer must not perform scraping or AI processing.

It only retrieves stored data.

---

# Frontend Architecture

The frontend is a Flutter Web application.

Responsibilities:

Display daily reading content

UI components include:

title
paragraphs
vocabulary
quiz

Frontend communicates only with the backend API.

---

# Architectural Constraints

AI agents must respect the following rules:

Do not move business logic into routes.

Do not perform scraping inside API endpoints.

Do not store raw RSS data directly in daily_articles.

Do not bypass the database pipeline.

Do not create hidden side effects in services.

---

# Scalability Considerations

Future improvements may include:

Switching SQLite → PostgreSQL

Adding a background job queue

Caching RSS feeds

Parallel scraping

The architecture should remain compatible with these future upgrades.

---

# Development Philosophy

The project prioritizes:

clarity
simple pipelines
minimal dependencies
AI-assisted development

Code should be readable and easy to debug.

Complex abstractions should be avoided unless necessary.
