# AI_TASKS.md

This file contains the active development tasks for the LinguistFeed project.

Any AI agent assisting development should read this file after:

LINGUISTFEED_CONTEXT.md
PROJECT_STRUCTURE.md
AI_RULES.md
DEBUGGING_GUIDE.md

Then select or assist with the next relevant task.

---

# Current Project Status

The backend architecture is mostly implemented:

* RSS feed ingestion ✔
* Scheduler ✔
* Scraper ✔
* Database storage ✔
* API endpoints ✔

The project is currently in the **pipeline stabilization and frontend integration phase**.

---

# High Priority Tasks

## Task 1 – Fix /daily-reading content retrieval

Goal:
Ensure the `/daily-reading` endpoint returns real article content.

Checks required:

1. `daily_articles.article_id` must reference `articles.id`
2. Database lookup must use:

SELECT * FROM articles WHERE id = ?

Expected result:

API returns:

{
"topic": "technology",
"title": "...",
"content": "..."
}

Status:
IN PROGRESS

---

## Task 2 – Validate scraping pipeline

Goal:
Ensure scraped articles contain:

* title
* full text content

Validation steps:

1. Scrape several URLs
2. Confirm content length > 500 characters
3. Confirm title is not empty

If content extraction fails, update `scraperService.js`.

Status:
PENDING

---

## Task 3 – Improve article storage structure

Goal:
Ensure articles are stored cleanly in the database.

Possible improvements:

* store paragraphs separately
* normalize topics
* add article source field

Status:
PENDING

---

# Medium Priority Tasks

## Task 4 – AI simplification pipeline

Goal:
Use OpenRouter AI to generate simplified versions of articles.

Process:

original article
→ AI simplification
→ simplified_articles table

Levels:

A1
A2
B1
B2
C1
C2

Status:
PARTIALLY IMPLEMENTED

---

## Task 5 – Vocabulary extraction

Goal:
Automatically generate vocabulary lists for each article.

Each entry should include:

word
definition
example sentence

Status:
PLANNED

---

## Task 6 – Quiz generation

Goal:
Generate comprehension questions.

Each quiz should include:

question
3 answer options
correct answer
hint

Status:
PLANNED

---

# Frontend Tasks

## Task 7 – Flutter article display

Goal:
Display the daily article in the frontend.

UI elements:

title
paragraphs
vocabulary list
quiz section

Status:
IN PROGRESS

---

# Performance Improvements

Future improvements may include:

* caching RSS results
* avoiding repeated scraping
* storing article summaries
* limiting scheduler workload

Status:
FUTURE

---

# Development Guidelines

AI agents should:

1. Read project documentation files
2. Identify the relevant task in this file
3. Make minimal changes required
4. Explain the solution clearly

---

# Project Goal

Deliver a working MVP where users can:

1. Open the app
2. Read a daily article
3. Learn new vocabulary
4. Answer a comprehension quiz

All content should be generated automatically from real news sources.

Actualización para tu AI_TASKS.md:

Task 1 & 7: ¡Casi terminadas! El lector ya filtra por ID y el frontend está listo para recibir el Quiz. Solo falta conectar la generación de IA al pipeline del scheduler.