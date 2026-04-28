const db = require('./database/db');

async function run() {
  const before = await db.get(
    "SELECT COUNT(1) as c FROM articles WHERE is_manual = 1 AND assigned_to_user_id IS NULL AND LOWER(topic) != 'classroom'"
  );
  await db.run(
    "UPDATE articles SET topic = 'classroom' WHERE is_manual = 1 AND assigned_to_user_id IS NULL AND LOWER(topic) != 'classroom'"
  );
  const after = await db.get(
    "SELECT COUNT(1) as c FROM articles WHERE is_manual = 1 AND assigned_to_user_id IS NULL AND LOWER(topic) != 'classroom'"
  );
  console.log('updated_general_manual_topics', Number(before?.c || 0) - Number(after?.c || 0));
  console.log('remaining_non_classroom_general_manual', Number(after?.c || 0));
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
