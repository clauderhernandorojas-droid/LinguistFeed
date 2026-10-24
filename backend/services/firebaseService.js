/**
 * firebaseService.js - Servicio de integración directa con Firebase Admin y Cloud Firestore para Lexispelling
 */

const fs = require('fs');
const path = require('path');

let admin = null;
let appModule = null;
let firestoreModule = null;
let authModule = null;

try {
  admin = require('firebase-admin');
  appModule = require('firebase-admin/app');
} catch (_) {}

function getFirestoreModule() {
  if (!firestoreModule) {
    try {
      firestoreModule = require('firebase-admin/firestore');
    } catch (e) {
      console.warn('⚠️ [Firebase] Módulo @google-cloud/firestore no disponible:', e.message);
      return null;
    }
  }
  return firestoreModule;
}

function getAuthModule() {
  if (!authModule) {
    try {
      authModule = require('firebase-admin/auth');
    } catch (_) {
      return null;
    }
  }
  return authModule;
}

const FieldValue = {
  serverTimestamp: () => {
    const fsMod = getFirestoreModule();
    return fsMod ? fsMod.FieldValue.serverTimestamp() : new Date().toISOString();
  },
  increment: (val) => {
    const fsMod = getFirestoreModule();
    return fsMod ? fsMod.FieldValue.increment(val) : val;
  }
};

let firestoreInstance = null;
let appInstance = null;

/**
 * Resuelve la ruta del archivo de credenciales de cuenta de servicio.
 */
function resolveServiceAccountPath() {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.resolve(__dirname, '../../serviceAccountKey.json'), // Raíz del proyecto desde /backend/services
    path.resolve(__dirname, '../serviceAccountKey.json'),    // Desde /backend
    path.resolve(process.cwd(), 'serviceAccountKey.json'),   // Directorio de ejecución
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Inicializa Firebase Admin y conecta con la instancia de Cloud Firestore y Firebase Auth.
 */
function initFirebase() {
  if (firestoreInstance && appInstance) {
    return firestoreInstance;
  }

  if (!appModule) {
    appModule = require('firebase-admin/app');
  }
  const { initializeApp, getApps, cert } = appModule;

  const fsMod = getFirestoreModule();
  if (!fsMod) {
    throw new Error("El módulo '@google-cloud/firestore' no está disponible en este entorno.");
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    appInstance = existingApps[0];
  } else {
    const keyPath = resolveServiceAccountPath();
    if (!keyPath) {
      throw new Error(
        "No se encontró el archivo de credenciales 'serviceAccountKey.json'. Asegúrate de que exista en la raíz del proyecto."
      );
    }

    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    appInstance = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || 'lexispelling',
    });
  }

  // Asegura compatibilidad con la sintaxis admin.auth() requerida
  const authMod = getAuthModule();
  if (authMod && admin) {
    admin.auth = (app = appInstance) => authMod.getAuth(app);
  }
  firestoreInstance = fsMod.getFirestore(appInstance);
  console.log(`🔥 [Firebase] Conectado a Cloud Firestore y Firebase Auth (Proyecto: ${appInstance.options.projectId || 'lexispelling'})`);
  return firestoreInstance;
}

/**
 * Resuelve el UID real de Firebase a partir del correo electrónico usando admin.auth().getUserByEmail.
 * Si el usuario no existe en Firebase Auth (auth/user-not-found), retorna null de forma segura.
 *
 * @param {string} userEmail Correo electrónico a buscar
 * @returns {Promise<string|null>} Firebase UID o null si no existe
 */
async function resolveFirebaseUidByEmail(userEmail) {
  if (!userEmail || typeof userEmail !== 'string') return null;
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail) return null;

  initFirebase();
  try {
    const userRecord = await admin.auth().getUserByEmail(cleanEmail);
    if (userRecord && userRecord.uid) {
      console.log(`👤 [Firebase Auth] Usuario resuelto: ${cleanEmail} -> UID: ${userRecord.uid}`);
      return userRecord.uid;
    }
    return null;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.warn(`⚠️ [Firebase Auth] Correo no registrado en Firebase Auth: ${cleanEmail}`);
      return null;
    }
    console.error(`⚠️ [Firebase Auth] Error al consultar getUserByEmail (${cleanEmail}):`, err.message);
    return null;
  }
}

/**
 * Genera un slug alfanumérico limpio para IDs deterministas.
 */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
}

/**
 * Sincroniza un conjunto de tarjetas/palabras hacia Cloud Firestore según la arquitectura de Lexispelling:
 * 1. Colecciones raíz: /decks/{deckId} y /words/{wordId}
 * 2. Esquema de mazo: id, userId, name, wordCount, isActive, createdAt, updatedAt
 * 3. Esquema de palabra: id, userId, deckId, deckName, word, translation, phrase, phraseTranslation, notes, isNew, isActive, source, createdAt, updatedAt
 *
 * @param {Array<Object>} cards Lista de tarjetas a sincronizar
 * @param {Object} [options] Opciones adicionales (userId, userEmail, email, deckName)
 * @returns {Promise<{
 *   success: boolean,
 *   count: number,
 *   deckNames: string[],
 *   target: string,
 *   resolvedUid: string | null,
 *   userEmail: string | null,
 *   fallbackNotice: string | null
 * }>}
 */
async function syncWordsToLexispelling(cards = [], options = {}) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return {
      success: true,
      count: 0,
      deckNames: [],
      target: 'root_collections',
      resolvedUid: null,
      userEmail: null,
      fallbackNotice: null,
    };
  }

  const db = initFirebase();

  // 1. Identificar correo candidato
  const rawEmail =
    options.userEmail ||
    options.email ||
    (typeof options.userId === 'string' && options.userId.includes('@') ? options.userId : null);
  const cleanEmail = rawEmail ? String(rawEmail).trim().toLowerCase() : null;

  // 2. Determinar si se proporcionó un UID explícito de Firebase (cadena válida no numérica y sin @)
  let resolvedUid = null;
  const isExplicitUid =
    options.userId &&
    typeof options.userId === 'string' &&
    !options.userId.includes('@') &&
    isNaN(Number(options.userId)) &&
    options.userId.trim().length >= 10;

  if (isExplicitUid) {
    resolvedUid = options.userId.trim();
  }

  // 3. Si no hay UID explícito pero tenemos correo, resolver con admin.auth().getUserByEmail
  let emailLookupAttempted = false;
  if (!resolvedUid && cleanEmail) {
    emailLookupAttempted = true;
    resolvedUid = await resolveFirebaseUidByEmail(cleanEmail);
  }

  // 4. Identificador de usuario para claves deterministas en Lexispelling
  const userKey = resolvedUid || (cleanEmail ? slugify(cleanEmail) : 'guest');
  const effectiveUserId = resolvedUid || userKey;

  let fallbackNotice = null;
  if (!resolvedUid) {
    if (cleanEmail && emailLookupAttempted) {
      fallbackNotice = `El correo '${cleanEmail}' no existe en Firebase Auth. Se asignó '${userKey}' como identificador en las colecciones raíz /words y /decks.`;
    } else {
      fallbackNotice = `No se detectó un usuario de Firebase asociado. Se asignó '${userKey}' en las colecciones raíz /words y /decks.`;
    }
  }

  const centralDeck = String(options.deckName || 'Reading Vocabulary').trim();
  const fallbackDeck = centralDeck;
  const BATCH_LIMIT = 450;
  const batchPromises = [];
  let currentBatch = db.batch();
  let operationCount = 0;
  let totalWordsProcessed = 0;
  const affectedDecks = new Set();
  const deckWordCounts = new Map();

  // Pre-calcular conteo de palabras por cada mazo presente en la sincronización
  for (const c of cards) {
    const rawWord = String(c.word || '').trim();
    if (!rawWord) continue;

    // Detectar si la tarjeta trae un mazo o procedencia de lectura específico
    const possibleArticleDeck = String(
      c._resolvedDeckName ||
      c._sourceDeckName ||
      c.deckName ||
      c.mazo ||
      ''
    ).trim();

    // Mazo destino: siempre el mazo central unificado
    const deckName = centralDeck;
    deckWordCounts.set(deckName, (deckWordCounts.get(deckName) || 0) + 1);

    // Si viene un nombre de artículo en _resolvedDeckName o similar, trasladarlo a tags
    if (
      possibleArticleDeck &&
      possibleArticleDeck !== 'General' &&
      possibleArticleDeck !== 'Reading Vocabulary' &&
      possibleArticleDeck !== centralDeck
    ) {
      if (!Array.isArray(c.tags)) {
        c.tags = c.tags ? [c.tags] : [];
      }
      if (!c.tags.includes(possibleArticleDeck)) {
        c.tags.push(possibleArticleDeck);
      }
    }
  }

  // Sincronizar palabras en la colección raíz /words/{wordId}
  for (const c of cards) {
    const rawWord = String(c.word || '').trim();
    if (!rawWord) continue;

    const possibleArticleDeck = String(
      c._resolvedDeckName ||
      c._sourceDeckName ||
      c.deckName ||
      c.mazo ||
      ''
    ).trim();

    const deckName = centralDeck;
    affectedDecks.add(deckName);

    const deckSlug = slugify(deckName);
    const wordSlug = slugify(rawWord);
    const rawTranslation = String(c.translation || c.translationWord || c.traduccionPalabra || '').trim();
    const translationSlug = slugify(rawTranslation) || 'meaning';
    const deckId = `${userKey}_${deckSlug}`;
    const wordId = `${userKey}_${deckSlug}_${wordSlug}_${translationSlug}`;

    const tags = Array.isArray(c.tags)
      ? c.tags.filter(Boolean).map((t) => String(t).trim())
      : (c.tag ? [String(c.tag).trim()] : []);

    if (
      possibleArticleDeck &&
      possibleArticleDeck !== 'General' &&
      possibleArticleDeck !== 'Reading Vocabulary' &&
      possibleArticleDeck !== centralDeck &&
      !tags.includes(possibleArticleDeck)
    ) {
      tags.push(possibleArticleDeck);
    }

    // 3. Esquema canónico de Palabra según arquitectura Lexispelling
    const canonicalCard = {
      id: wordId,
      userId: effectiveUserId,
      deckId: deckId,
      deckName: deckName,
      word: rawWord,
      translation: rawTranslation,
      phrase: String(c.phrase || c.example || c.frase || c.context || '').trim(),
      phraseTranslation: String(c.phraseTranslation || c.translationFrase || c.traduccionFrase || '').trim(),
      tags: tags,
      notes: String(
        c.notes ||
        c.nota ||
        c.note ||
        c.phonetic ||
        c.ipa ||
        (c.definition && c.definition !== 'Saved from reader' ? c.definition : '') ||
        ''
      ).trim(),
      phonetic: String(c.phonetic || c.ipa || '').trim(),
      definition: String(c.definition && c.definition !== 'Saved from reader' ? c.definition : '').trim(),
      isNew: true,
      isActive: true,
      source: 'LinguistFeed',
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (cleanEmail) {
      canonicalCard.userEmail = cleanEmail;
    }

    if (c.createdAt) {
      canonicalCard.createdAt = c.createdAt;
    } else {
      canonicalCard.createdAt = FieldValue.serverTimestamp();
    }

    // Escritura en colección raíz /words/{wordId}
    const wordDocRef = db.collection('words').doc(wordId);
    currentBatch.set(wordDocRef, canonicalCard, { merge: true });
    operationCount++;
    totalWordsProcessed++;

    if (operationCount >= BATCH_LIMIT) {
      batchPromises.push(currentBatch.commit());
      currentBatch = db.batch();
      operationCount = 0;
    }
  }

  // 2. Sincronizar mazos en la colección raíz /decks/{deckId}
  for (const dName of affectedDecks) {
    const deckSlug = slugify(dName);
    const deckId = `${userKey}_${deckSlug}`;
    const wordCount = deckWordCounts.get(dName) || 0;

    // Esquema canónico de Mazo según arquitectura Lexispelling
    const deckDoc = {
      id: deckId,
      userId: effectiveUserId,
      name: dName,
      slug: deckSlug,
      wordCount: wordCount,
      isActive: true,
      source: 'LinguistFeed',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (cleanEmail) {
      deckDoc.userEmail = cleanEmail;
    }

    // Escritura en colección raíz /decks/{deckId}
    const deckDocRef = db.collection('decks').doc(deckId);
    currentBatch.set(deckDocRef, deckDoc, { merge: true });
    operationCount++;

    if (operationCount >= BATCH_LIMIT) {
      batchPromises.push(currentBatch.commit());
      currentBatch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    batchPromises.push(currentBatch.commit());
  }

  // Esperar a que se guarden todas las palabras antes de calcular conteos y mazos
  await Promise.all(batchPromises);

  // 2. Sincronizar mazos en la colección raíz /decks/{deckId} con conteo real de palabras activas
  const deckBatchPromises = [];
  let deckBatch = db.batch();
  let deckOpCount = 0;

  for (const dName of affectedDecks) {
    const deckSlug = slugify(dName);
    const deckId = `${userKey}_${deckSlug}`;

    // Obtener la cantidad real de palabras activas asociadas a este deckId en Firestore
    let activeWordCount = 0;
    try {
      const countSnap = await db
        .collection('words')
        .where('deckId', '==', deckId)
        .where('isActive', '==', true)
        .count()
        .get();
      activeWordCount = countSnap.data().count;
    } catch (countErr) {
      console.warn(`⚠️ [Firebase] Fallo al contar palabras activas para ${deckId}:`, countErr.message);
      activeWordCount = deckWordCounts.get(dName) || 1;
    }

    const deckDocRef = db.collection('decks').doc(deckId);
    let isNewDeck = true;
    try {
      const existingDeckSnap = await deckDocRef.get();
      isNewDeck = !existingDeckSnap.exists;
    } catch (_) {}

    // Esquema canónico de Mazo según arquitectura Lexispelling
    const deckDoc = {
      id: deckId,
      userId: effectiveUserId,
      name: dName,
      slug: deckSlug,
      wordCount: activeWordCount,
      isActive: true,
      source: 'LinguistFeed',
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (cleanEmail) {
      deckDoc.userEmail = cleanEmail;
    }

    if (isNewDeck) {
      deckDoc.createdAt = FieldValue.serverTimestamp();
    }

    deckBatch.set(deckDocRef, deckDoc, { merge: true });
    deckOpCount++;

    if (deckOpCount >= BATCH_LIMIT) {
      deckBatchPromises.push(deckBatch.commit());
      deckBatch = db.batch();
      deckOpCount = 0;
    }
  }

  if (deckOpCount > 0) {
    deckBatchPromises.push(deckBatch.commit());
  }

  if (deckBatchPromises.length > 0) {
    await Promise.all(deckBatchPromises);
  }

  console.log(
    `✅ [Firebase] Sincronizadas ${totalWordsProcessed} palabras en raíz /words y ${affectedDecks.size} mazos en raíz /decks (userId: ${effectiveUserId}).`
  );

  return {
    success: true,
    count: totalWordsProcessed,
    deckNames: Array.from(affectedDecks),
    target: 'root_collections',
    resolvedUid: resolvedUid || null,
    userEmail: cleanEmail || null,
    fallbackNotice,
  };
}

/**
 * Marca una palabra como inactiva (isActive: false) en la colección raíz /words/{wordId} de Lexispelling
 * y decrementa consistentemente el wordCount del mazo asociado.
 *
 * @param {Object} wordData Datos de la palabra ({ word, deckName, wordId })
 * @param {Object} [options] Opciones ({ userId, userEmail, email })
 * @returns {Promise<{ success: boolean, wordId: string }>}
 */
async function deactivateWordInLexispelling(wordData = {}, options = {}) {
  const db = initFirebase();
  const rawEmail =
    options.userEmail ||
    options.email ||
    (typeof options.userId === 'string' && options.userId.includes('@') ? options.userId : null);
  const cleanEmail = rawEmail ? String(rawEmail).trim().toLowerCase() : null;

  let resolvedUid = null;
  const isExplicitUid =
    options.userId &&
    typeof options.userId === 'string' &&
    !options.userId.includes('@') &&
    isNaN(Number(options.userId)) &&
    options.userId.trim().length >= 10;

  if (isExplicitUid) {
    resolvedUid = options.userId.trim();
  }

  if (!resolvedUid && cleanEmail) {
    resolvedUid = await resolveFirebaseUidByEmail(cleanEmail);
  }

  const userKey = resolvedUid || (cleanEmail ? slugify(cleanEmail) : 'guest');
  const rawWord = String(wordData.word || '').trim();
  const rawTranslation = String(wordData.translation || '').trim();
  const translationSlug = slugify(rawTranslation);
  const fallbackDeckName = String(wordData.deckName || 'Reading Vocabulary').trim();
  const fallbackDeckSlug = slugify(fallbackDeckName);
  const wordSlug = slugify(rawWord);

  let wordId = wordData.wordId || null;
  if (!wordId && translationSlug) {
    wordId = `${userKey}_${fallbackDeckSlug}_${wordSlug}_${translationSlug}`;
  }

  let wordRef = null;
  let resolvedDeckId = `${userKey}_${fallbackDeckSlug}`;

  if (wordId) {
    wordRef = db.collection('words').doc(wordId);
    try {
      const existingWordSnap = await wordRef.get();
      if (existingWordSnap.exists) {
        const data = existingWordSnap.data();
        if (data && data.deckId) resolvedDeckId = data.deckId;
      }
    } catch (_) {}
  } else {
    try {
      const querySnap = await db
        .collection('words')
        .where('userId', '==', resolvedUid || userKey)
        .where('word', '==', rawWord)
        .where('isActive', '==', true)
        .limit(1)
        .get();
      if (!querySnap.empty) {
        wordRef = querySnap.docs[0].ref;
        wordId = querySnap.docs[0].id;
        const data = querySnap.docs[0].data();
        if (data && data.deckId) resolvedDeckId = data.deckId;
      } else {
        wordId = `${userKey}_${fallbackDeckSlug}_${wordSlug}`;
        wordRef = db.collection('words').doc(wordId);
      }
    } catch (_) {
      wordId = `${userKey}_${fallbackDeckSlug}_${wordSlug}`;
      wordRef = db.collection('words').doc(wordId);
    }
  }

  await wordRef.set(
    {
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`🗑️ [Firebase] Palabra '${wordId}' marcada como inactiva (isActive: false) en Firestore.`);

  // Decrementar de forma consistente el wordCount del mazo
  const deckRef = db.collection('decks').doc(resolvedDeckId);
  try {
    await deckRef.set(
      {
        wordCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Salvaguarda: asegurarse de que el contador nunca sea menor a 0
    const deckSnap = await deckRef.get();
    if (deckSnap.exists && deckSnap.data().wordCount < 0) {
      await deckRef.update({ wordCount: 0 });
    }
    console.log(`📉 [Firebase] Conteo decrementado (increment(-1)) para el mazo '${resolvedDeckId}'.`);
  } catch (deckErr) {
    console.warn(`⚠️ [Firebase] No se pudo decrementar wordCount en mazo '${resolvedDeckId}':`, deckErr.message);
  }

  return { success: true, wordId };
}

module.exports = {
  admin,
  initFirebase,
  resolveFirebaseUidByEmail,
  syncWordsToLexispelling,
  deactivateWordInLexispelling,
  slugify,
};
