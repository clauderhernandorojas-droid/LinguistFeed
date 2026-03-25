# DEBUGGING_GUIDE.md

This guide explains how to debug the LinguistFeed system.

Any AI agent helping debug the project must follow this process before proposing solutions.

---

# System Overview

The application is composed of:

Backend:
Node.js + Express + SQLite

Frontend:
Flutter Web

External Services:
RSS feeds
Web scraping
OpenRouter AI API

---

# Article Processing Pipeline

RSS feed
→ articleService
→ schedulerService
→ scraperService
→ articles table
→ daily_articles table
→ /daily-reading endpoint
→ Flutter frontend

If something fails, the issue must be located in one of these stages.

---

# Debugging Strategy

Always debug in this order.

1. Scheduler
2. RSS feeds
3. Scraper
4. Database
5. API endpoint
6. Frontend

Never start debugging from the frontend.

---

# Step 1: Check Scheduler

Verify the scheduler is running.

Expected log:

Starting scheduler service...
Article fetching job scheduled to run every 6 hours
Running initial article fetching job

If these logs are missing, the scheduler did not start.

---

# Step 2: Check RSS Fetching

Expected logs:

Fetching RSS feed for topic: technology
Found X articles for topic: technology

If the feeds return zero articles, the RSS feed may be down.

---

# Step 3: Check Scraper

Expected logs:

Scraping article: https://example.com
Article text extracted

If scraping fails, the issue is likely inside scraperService.js.

---

# Step 4: Check Database

Run SQL queries to confirm data exists.

Check articles table:

SELECT id, url, title FROM articles;

Check daily articles:

SELECT date, topic, article_id FROM daily_articles;

Confirm that:

* article_id references a valid articles.id
* titles are not empty
* content is not empty

---

# Step 5: Check API Endpoint

Test the endpoint manually.

http://localhost:3001/daily-reading

Expected result:

{
"date": "YYYY-MM-DD",
"articles": [
{
"topic": "technology",
"title": "...",
"content": "..."
}
]
}

If titles are "Untitled", the database lookup is failing.

---

# Step 6: Check Frontend

Verify the frontend is displaying:

title
paragraphs
vocabulary
quiz

If API returns correct data but UI is empty, the issue is in Flutter.

---

# Common Problems

Problem: "Untitled" articles
Cause: daily_articles.article_id does not match articles.id

Problem: empty content
Cause: scraper failed or article was not stored

Problem: duplicate articles
Cause: missing duplicate check before insert

Problem: scheduler not running
Cause: schedulerService not initialized in server.js

---

# Debugging Rule

Never guess.

Always verify:

logs
database data
API responses

before making code changes.

---

# Logging Best Practices

Never remove logging statements in:

schedulerService.js
articleService.js
scraperService.js

Logs are essential to trace the pipeline.

---

# Quick Debug Checklist

1. Is the scheduler running?
2. Are RSS feeds returning articles?
3. Is the scraper extracting content?
4. Are articles stored in the database?
5. Are daily articles registered?
6. Does the API return correct JSON?
7. Does the frontend display the data?

Only after identifying the failing stage should code be modified.
