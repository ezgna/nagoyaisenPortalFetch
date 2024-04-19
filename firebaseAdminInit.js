import admin from 'firebase-admin';
import serviceAccount from './nagoyaisenportalfetch-firebase-adminsdk-mvkum-c83bed369d.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

import path from 'path';

function getContentType(filename) {
  const extname = path.extname(filename).toLowerCase();
  switch (extname) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif'
    case '.pdf':
      return 'application/pdf';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.json';
    default:
      return 'application/octet-stream';
  }
}

function generateUniqueFilename(originalFilename, sessionId) {
  const timestamp = Date.now();
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  return `sessions/${sessionId}/${basename}-${timestamp}${ext}`;
}

const firestore = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket('gs://nagoyaisenportalfetch.appspot.com');

async function uploadStream(stream, originalDestination, sessionId) {
  const destination = generateUniqueFilename(originalDestination, sessionId);
  return new Promise((resolve, reject) => {
    const file = bucket.file(destination);

    const contentType = getContentType(destination);

    const writeStream = file.createWriteStream({
      metadata: {
        contentType: contentType,
      },
    });

    stream.pipe(writeStream)
      .on('error', reject)
      .on('finish', async () => {
        console.log('File uploaded successfully');
        // アップロードが完了したら、ファイルを公開
        try {
          await file.makePublic();
          const publicUrl = file.publicUrl();
          resolve(publicUrl); // 公開URLを返す
        } catch (error) {
          reject(error);
        }
      });
  });
}

export { admin, firestore, bucket, uploadStream };
