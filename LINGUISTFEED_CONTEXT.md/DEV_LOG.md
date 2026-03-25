# DEV_LOG.md

Development log for the LinguistFeed project.

This document records major decisions, fixes, and debugging steps during development.

Any AI agent assisting development should read this file to understand the history of the project.

---

# Project Start

Goal:
Build an English-learning platform that delivers daily reading articles based on real news sources.

Users should be able to:

1. Read a daily article
2. Learn vocabulary from the article
3. Answer comprehension questions

---

# Architecture Decision

Backend:
Node.js + Express

Database:
SQLite

Frontend:
Flutter Web

AI:
OpenRouter API for text simplification and exercise generation.

Reason:
These technologies allow rapid prototyping and AI-assisted development.

---

# RSS Pipeline Implementation

The system fetches articles from RSS feeds.

Sources:

TechCrunch → technology
ScienceDaily → science
BBC → world
The Guardian → culture

Articles are collected by `articleService`.

---

# Scheduler Implementation

`schedulerService.js` runs every 6 hours.

Responsibilities:

1. Fetch RSS feeds
2. Identify article URLs
3. Scrape article content
4. Store articles in the database
5. Register daily articles

---

# Initial Bug – Articles Stored Without Content

Problem:
Articles were initially stored only as URLs in the `daily_articles` table.

Result:
The `/daily-reading` endpoint returned:

"title": "Untitled"
"content": ""

Cause:
Article content was never scraped and inserted into the `articles` table.

---

# Fix – Scraping Pipeline Added

The scheduler was modified to:

1. Check if an article exists using the URL
2. If not:

   * scrape the article
   * store it in `articles`
3. Insert the article ID into `daily_articles`

This ensures that `/daily-reading` can retrieve full article content.

---

# Current System State

Working:

RSS ingestion
Scheduler
Article scraping
Database storage
Daily article registration
API endpoints

Still being verified:

Correct retrieval of articles in `/daily-reading`.

---

# Development Method

The project is developed with heavy AI assistance using:

Cursor
Claude
ChatGPT

AI tools are used for:

debugging
architecture guidance
code generation

---

# Debugging Strategy

Always debug in this order:

scheduler
scraper
database
API
frontend

Never start debugging from the frontend.

---

# Future Features

AI simplification of articles
Vocabulary extraction
Quiz generation
User progress tracking

---

# Logging Policy

Logging must remain active in:

schedulerService.js
articleService.js
scraperService.js

Logs are critical for debugging the article pipeline.

---

# How to Update This File

Whenever a major change occurs:

1. Describe the problem
2. Describe the solution
3. Record the affected files

This keeps the development history clear for future AI sessions and developers.
Actualización para tu DEV_LOG.md:

20 Marzo 2026: Se corrigió el redireccionamiento en la página de tópicos. El botón "Read More" ahora apunta correctamente a /reader en lugar de /article, restaurando la funcionalidad de flashcards interactiva.