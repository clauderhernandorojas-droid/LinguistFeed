/**
 * Métricas unificadas basadas en answer_events + user_flashcards.
 * Una sola fuente de verdad para dashboard del alumno y vista del profesor.
 */
const db = require('../database/db');

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

/**
 * Racha máxima de días consecutivos con al menos una respuesta válida (answer_events).
 */
function maxConsecutiveDaysFromDates(dayStrings) {
  if (!dayStrings || dayStrings.length === 0) return 0;
  let streak = 1;
  let maxStreak = 1;
  for (let i = 1; i < dayStrings.length; i++) {
    const prev = new Date(dayStrings[i - 1].day + 'T12:00:00');
    const curr = new Date(dayStrings[i].day + 'T12:00:00');
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 1;
    }
  }
  return maxStreak;
}

/**
 * @param {number} userId
 * @param {{ windowDays?: number }} [options] windowDays por defecto 30; usa answer_events con counted_for_stats=1
 * @returns {Promise<object>}
 */
async function buildStatsV2(userId, options = {}) {
  const windowDays = Math.min(Math.max(parseInt(String(options.windowDays ?? 30), 10) || 30, 1), 365);
  const windowModifier = `-${windowDays} days`;

  const base = await db.get(
    `SELECT
       COUNT(*) AS total_answers,
       COALESCE(SUM(is_correct), 0) AS correct_answers,
       COUNT(DISTINCT article_id) AS articles_completed,
       COUNT(DISTINCT DATE(answered_at)) AS active_days_window
     FROM answer_events
     WHERE user_id = ?
       AND counted_for_stats = 1
       AND datetime(answered_at) >= datetime('now', ?)`,
    [userId, windowModifier]
  );

  const streakRows = await db.all(
    `
    SELECT DATE(answered_at) AS day
    FROM answer_events
    WHERE user_id = ? AND counted_for_stats = 1
    GROUP BY DATE(answered_at)
    ORDER BY day ASC
    `,
    [userId]
  );

  const vocab = await db.get(
    'SELECT COUNT(*) AS count FROM user_flashcards WHERE user_id = ?',
    [userId]
  );

  const pref = await db.get(
    'SELECT weekly_reading_goal_minutes FROM user_preferences WHERE user_id = ?',
    [userId]
  );
  const readingGoalMinutesRaw = parseInt(String(pref?.weekly_reading_goal_minutes ?? 60), 10);
  const readingGoalMinutes = Number.isInteger(readingGoalMinutesRaw)
    ? Math.min(Math.max(readingGoalMinutesRaw, 15), 600)
    : 60;

  const weeklyReadingRow = await db.get(
    `SELECT COALESCE(SUM(response_time_ms), 0) AS total_ms
     FROM answer_events
     WHERE user_id = ?
       AND counted_for_stats = 1
       AND response_time_ms IS NOT NULL
       AND datetime(answered_at) >= datetime('now', '-7 days')`,
    [userId]
  );

  const totalAnswers = Number(base?.total_answers || 0);
  const correctAnswers = Number(base?.correct_answers || 0);
  const articlesCompleted = Number(base?.articles_completed || 0);
  const activeDaysWindow = Number(base?.active_days_window || 0);
  const vocabularyLearned = Number(vocab?.count || 0);
  const streak = maxConsecutiveDaysFromDates(streakRows);
  const weeklyReadingMinutes = round1((Number(weeklyReadingRow?.total_ms || 0) / 60000));
  const weeklyProgressPctRaw =
    readingGoalMinutes > 0 ? (weeklyReadingMinutes / readingGoalMinutes) * 100 : 0;
  const weeklyProgressPct = round1(Math.min(Math.max(weeklyProgressPctRaw, 0), 100));
  const weeklyRemainingMinutes = Math.max(round1(readingGoalMinutes - weeklyReadingMinutes), 0);

  const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
  const consistencyScore = Math.min(activeDaysWindow / 20, 1) * 100;
  const completionScore = Math.min(articlesCompleted / 12, 1) * 100;
  const overallScore = accuracy * 0.7 + consistencyScore * 0.2 + completionScore * 0.1;

  return {
    userId,
    windowDays,
    activity: {
      totalAnswers,
      correctAnswers,
      articlesCompleted,
      activeDaysWindow,
      streakMaxConsecutiveDays: streak
    },
    scores: {
      accuracy: round1(accuracy),
      consistencyScore: round1(consistencyScore),
      completionScore: round1(completionScore),
      overallScore: round1(overallScore)
    },
    dashboard: {
      articlesRead: articlesCompleted,
      quizzesTaken: totalAnswers,
      vocabularyLearned,
      streak
    },
    weeklyGoals: {
      readingMinutes: {
        goal: readingGoalMinutes,
        current: weeklyReadingMinutes,
        progressPct: weeklyProgressPct,
        remaining: weeklyRemainingMinutes
      }
    },
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildStatsV2,
  round1
};
