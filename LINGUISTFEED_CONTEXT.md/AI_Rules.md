# AI_RULES.md

Rules for any AI agent working on the LinguistFeed project.

These rules are designed to prevent breaking the application and reduce debugging time.

---

# Rule 1: Do not modify files that are not requested

Only modify the specific file requested by the user.

Do NOT refactor other files.
Do NOT rename variables globally.
Do NOT reorganize the project structure.

If changes to other files are required, explain first.

---

# Rule 2: Preserve existing functionality

Before modifying code, understand what the file currently does.

Your changes must NOT break:

* the scheduler
* database queries
* API endpoints
* scraping pipeline

If unsure, ask before modifying.

---

# Rule 3: Never invent database fields

Only use fields that exist in the database schema.

Current schema:

articles

* id
* url
* title
* topic
* content
* created_at

daily_articles

* id
* date
* topic
* article_id

Do NOT invent new fields without confirmation.

---

# Rule 4: Respect the pipeline architecture

The correct pipeline is:

RSS feed
→ schedulerService
→ scraperService
→ articles table
→ daily_articles table
→ /daily-reading endpoint
→ Flutter frontend

Never bypass this pipeline.

---

# Rule 5: Avoid duplicate article insertion

Before inserting an article, always check:

SELECT id FROM articles WHERE url = ?

Do not allow duplicates.

---

# Rule 6: Always use async/await

Do not introduce callbacks or promise chains if the file uses async/await.

Maintain consistency.

---

# Rule 7: Preserve logging

Do not remove console logs unless requested.

Logs are important for debugging the pipeline.

---

# Rule 8: Return complete files

When modifying a file, return the COMPLETE corrected file.

Do not return fragments.

---

# Rule 9: Explain changes

After providing code, explain:

1. What the problem was
2. What was changed
3. Why the fix works

---

# Rule 10: Prefer minimal changes

Fix the smallest possible amount of code needed to solve the problem.

Avoid large refactors unless explicitly requested.

---

# Rule 11: Never silently change variable names

Do not rename variables unless required to fix a bug.

---

# Rule 12: Keep the backend stable

The scheduler and database pipeline are critical.

Do not modify them unless explicitly asked.

---

# Rule 13: Assume the developer is AI-assisted

The developer relies on AI guidance.

Provide clear explanations and avoid unnecessary complexity.

---

# When starting work

Before making any modification:

1. Read LINGUISTFEED_CONTEXT.md
2. Follow AI_RULES.md
3. Then proceed with the task.
