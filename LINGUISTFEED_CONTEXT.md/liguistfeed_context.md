# LinguistFeed – Project Context

## Project Overview

LinguistFeed is an English-learning platform that delivers daily reading articles adapted to CEFR levels (A1–C2).
Students read real news articles simplified with AI and complete vocabulary and quiz activities.

The backend fetches articles from RSS feeds, scrapes their content, stores them in a database, and serves them through an API.

---

# Tech Stack

Backend:

* Node.js
* Express
* SQLite
* node-schedule (scheduler)
* rss-parser
* OpenRouter API (AI simplification)

Frontend:

* Flutter Web

AI:

* OpenRouter (Claude / GPT models)

---

# Current Architecture

RSS feeds → Scheduler → Scraper → Database → API → Flutter frontend

Detailed pipeline:

1. RSS feeds are fetched every 6 hours

2. URLs are collected from:

   * TechCrunch (technology)
   * ScienceDaily (science)
   * BBC (world)
   * The Guardian (culture)

3. For each article:

   * Check if it exists in `articles`
   * If not:
     scrape article text
     store in `articles` table

4. Store the article in `daily_articles`
   referencing the `articles.id`

5. The `/daily-reading` endpoint retrieves today's articles
   and sends them to the frontend.

---

# Database Tables

### articles

Stores scraped article content.

Fields:

* id
* url
* title
* topic
* content
* created_at

---

### daily_articles

Stores which articles belong to each day.

Fields:

* id
* date
* topic
* article_id (references articles.id)

---

# Current Backend Endpoints

POST /register
POST /login
GET /daily-reading
POST /submit-answer
GET /progress/:userId
POST /scrape
POST /simplify

---

# Scheduler

File:
services/schedulerService.js

Runs every 6 hours.

Process:

1. Fetch RSS feeds
2. Extract article URLs
3. Check if article exists
4. Scrape article
5. Insert into articles
6. Insert into daily_articles

---

# Current Development Status

Working:

* Scheduler fetching RSS feeds
* Article scraping
* Article storage in database
* Daily article registration
* API endpoints functional

Recently fixed:

* Articles were previously stored only as URLs
* Now the scheduler scrapes and stores the full article content

---

# Current Issue Being Debugged

The `/daily-reading` endpoint is returning articles with:

"title": "Untitled"
"content": ""

Possible cause:
Mismatch between `daily_articles.article_id`
and how the endpoint queries the `articles` table.

---

# Goal of the Project

Students open the app and see:

Daily Reading

Topic: Technology
Title: AI Startup Raises Funding

Paragraph 1
Paragraph 2

Vocabulary section

Quiz question

---

# Developer Notes

The project is being developed with AI-assisted coding using:

* Cursor
* Claude
* GPT

The developer has limited traditional programming experience
and relies heavily on AI for debugging and architecture guidance.

Clarity and explicit instructions are extremely important.
