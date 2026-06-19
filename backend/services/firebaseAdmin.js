const fs = require('fs');
const path = require('path');

const admin = require('firebase-admin');

function createFirebaseError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function parseServiceAccountJson(rawJson) {
  try {
    return JSON.parse(rawJson);
  } catch (_error) {
    throw createFirebaseError(500, 'Firebase service account JSON is not valid.');
  }
}

function readServiceAccount(firebaseConfig) {
  if (firebaseConfig.serviceAccountJson) {
    return parseServiceAccountJson(firebaseConfig.serviceAccountJson);
  }

  if (!firebaseConfig.serviceAccountPath) {
    return null;
  }

  const accountPath = path.resolve(firebaseConfig.serviceAccountPath);

  try {
    const rawJson = fs.readFileSync(accountPath, 'utf8');
    return parseServiceAccountJson(rawJson);
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createFirebaseError(500, `Firebase service account file could not be read: ${accountPath}`);
  }
}

function getFirebaseAdmin(firebaseConfig) {
  if (admin.apps.length) {
    return admin;
  }

  const serviceAccount = readServiceAccount(firebaseConfig);

  if (!serviceAccount) {
    throw createFirebaseError(
      501,
      'Firebase Google login is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: firebaseConfig.projectId || serviceAccount.project_id
  });

  return admin;
}

async function verifyFirebaseIdToken(idToken, firebaseConfig) {
  const firebaseAdmin = getFirebaseAdmin(firebaseConfig);
  return firebaseAdmin.auth().verifyIdToken(idToken);
}

module.exports = {
  verifyFirebaseIdToken
};
