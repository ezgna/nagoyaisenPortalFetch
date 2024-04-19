// import 'dotenv/config';
import { firestore, bucket } from './firebaseAdminInit.js';

async function addTestData() {
  const sessionsRef = firestore.collection('sessions');
  const sessionDocRef = await sessionsRef.add({
    expires: Date.now() - 1000, // 現在時刻より前のタイムスタンプ
    name: "Test Session"
  });

  const file = bucket.file(`sessions/${sessionDocRef.id}/test.txt`);
  const contents = 'This is a test file';
  await file.save(contents, {
    metadata: {
      contentType: 'text/plain',
    },
  });
}

addTestData().then(
    () => console.log('Test data added successfully.')
).catch(
    err => console.error('Failed to add test data:', err)
);