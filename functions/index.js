/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");

// import { onRequest } from "firebase-functions/v2/https";
// import { logger } from "firebase-functions/logger";

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const deleteDocumentAndSubcollections = async (docRef) => {
    // サブコレクションを取得
    const collections = await docRef.listCollections();
    for (const collection of collections) {
      // サブコレクション内のドキュメントを取得
      const docs = await collection.listDocuments();
      for (const doc of docs) {
        // 再帰的に削除
        await deleteDocumentAndSubcollections(doc);
      }
    }
    // ドキュメント自体を削除
    await docRef.delete();
};

const cleanUpStorage = async () => {
    const sessionsRef = firestore.collection('sessions');
    const snapshot = await sessionsRef.get();
    const sessionIds = new Set(snapshot.docs.map(doc => doc.id));
  
    const [files] = await bucket.getFiles({ prefix: 'sessions/' });
    const fileGroups = files.reduce((acc, file) => {
      const match = file.name.match(/sessions\/(.*?)\//);
      if (match) {
        const sessionId = match[1];
        if (!sessionIds.has(sessionId)) {
          acc.push(file);
        }
      }
      return acc;
    }, []);
  
    for (const file of fileGroups) {
      await file.delete();
      console.log(`Deleted orphaned file: ${file.name}`);
    }
  
    console.log('Cleanup of orphaned session files complete');
};

import * as functions from 'firebase-functions';
import { firestore, bucket } from './firebaseAdminInit.js';

export const deleteExpiredSessions = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const now = Date.now();
  const sessionsRef = firestore.collection('sessions');
  const snapshot = await sessionsRef.where('expires', '<=', now).get();

  for (const doc of snapshot.docs) {
    await deleteDocumentAndSubcollections(doc.ref);
  }

  cleanUpStorage();

  console.log('Expired sessions and their subcollections deleted');
});

import app from './src/server.js';

export const api = functions.https.onRequest(app);
