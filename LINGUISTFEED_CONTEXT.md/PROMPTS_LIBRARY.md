# PROMPTS_LIBRARY.md

This file stores reusable prompts used in the LinguistFeed project.

Prompts are organized by functionality so they can be reused with AI services such as OpenRouter.

Any AI agent working on this project should reuse these prompts instead of inventing new ones.

---

# Prompt – Article Simplification

Purpose:
Simplify a news article to a specific CEFR level.

Prompt:

You are an English teacher specializing in CEFR-based language learning.

Rewrite the following article so that it matches the CEFR level: {LEVEL}

Requirements:

* Keep the meaning of the article
* Use vocabulary appropriate for the level
* Use shorter sentences
* Avoid complex grammar structures beyond the level
* Keep the article engaging and natural

Return the result in JSON format:

{
"text": "...",
"paragraphs": ["paragraph 1", "paragraph 2"]
}

Article:

{ARTICLE_TEXT}

---

# Prompt – Vocabulary Extraction

Purpose:
Extract useful vocabulary words from an article.

Prompt:

You are an English language teacher.

From the following article, select 5–8 useful vocabulary words that English learners should know.

For each word provide:

* the word
* a simple definition
* an example sentence

Return the result in JSON format:

{
"vocabulary": [
{
"word": "",
"definition": "",
"example": ""
}
]
}

Article:

{ARTICLE_TEXT}

---

# Prompt – Quiz Generation

Purpose:
Generate a comprehension question.

Prompt:

You are creating reading comprehension questions for English learners.

From the article below, generate one multiple-choice question.

Requirements:

* The question must test understanding of the text
* Provide 3 answer options
* Only one option should be correct
* Include a hint to help the learner

Return the result in JSON format:

{
"quiz": {
"question": "",
"options": ["", "", ""],
"correct_index": 0,
"hint": ""
}
}

Article:

{ARTICLE_TEXT}

---

# Prompt – Grammar Note

Purpose:
Generate a short grammar explanation related to the text.

Prompt:

You are an English teacher explaining grammar to learners.

From the following article, identify one useful grammar pattern.

Explain it briefly and clearly.

Return:

{
"grammar_note": ""
}

Article:

{ARTICLE_TEXT}

---

# Prompt – Article Summary

Purpose:
Create a short summary of the article.

Prompt:

Summarize the following article in 2–3 sentences.

Keep the language simple and clear.

Return:

{
"summary": ""
}

Article:

{ARTICLE_TEXT}

---

# Guidelines for Prompts

All prompts must:

* produce structured JSON
* avoid unnecessary explanations
* keep responses short and structured
* be optimized for English learners

This ensures the backend can process the results automatically.

---

# Future Prompts

Possible additions:

* pronunciation tips
* discussion questions
* writing prompts
* conversation practice
