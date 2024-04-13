import express from 'express';
import cors from 'cors';
import { login, scrapeContent, checkForTopContent, checkCookiesValidity } from './scraper.js';
import { firestore } from '../firebase/firebaseAdminInit.js';
import { httpsPort, privateKeyPath, certificatePath } from '../config.js';
import fs from 'fs';
import https from 'https';
// import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import cookieParser from 'cookie-parser';
import { UnauthorizedError, InternalServerError } from '../errors.js';

const app = express();
app.use(express.json());
app.use(cors());
app.use(cookieParser());
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const certificate = fs.readFileSync(certificatePath, 'utf8');
const credentials = { key: privateKey, cert: certificate };
const httpsServer = https.createServer(credentials, app);

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { isLoggedIn, browser, page, isenCookies } = await login(username, password);
    if (!isLoggedIn) {
      // return res.status(401).json({ message: 'Unauthorized' });
      throw new UnauthorizedError("ユーザー認証に失敗しました。");
    }

    const sessionId = uuidv4();
    const sessionRef = firestore.collection('sessions').doc(sessionId);
    await sessionRef.set({
      username,
      expires: Date.now() + 86400000, // 24時間の有効期限
      isenCookies
    });

    res.cookie('sessionId', sessionId, {
      maxAge: 86400000, // 24時間の有効期限
      httpOnly: true, // JavaScriptからのアクセスを防ぐ
      secure: true, // HTTPS経由でのみクッキーを送信
      sameSite: 'strict' // CSRF攻撃保護
    });

    // スクレイピング処理
    const contents = await scrapeContent(browser, page, isenCookies, sessionId);
    const scrapedDataRef = sessionRef.collection('scrapedData').doc('latest');
    await scrapedDataRef.set({ contents });
    res.json({ message: 'login success' });

  } catch (error) {
    // カスタムエラーに基づいたエラーハンドリング
    if (error instanceof UnauthorizedError) {
      console.error('Login failed', error);
      res.status(error.statusCode).json({ message: error.message });
    // } else if (error instanceof InternalServerError) {
    //   // NotFoundErrorに対する処理（必要に応じて）NotFoundErrorはまだ置けてない。
    //   console.error('Resource not found', error);
    //   res.status(error.statusCode).json({ message: error.message });
    } else {
      // その他のエラーに対する処理ここについても深堀必要。あんま良く分かってない。
      console.error('An error occurred', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const sessionRef = firestore.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const scrapedDataRef = sessionRef.collection('scrapedData').doc('latest');
    const scrapedDataDoc = await scrapedDataRef.get();
    if (!scrapedDataDoc.exists) {
      return res.status(404).json({ message: 'No scraped data found' });
    }

    const scrapedData = scrapedDataDoc.data();
    res.json(scrapedData);

  } catch (error) {
    console.error('Error fetching data', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
      console.log('No sessionId');
      return res.status(401).json({ message: 'Unauthorized', redirectTo: '/login' });
    }

    const sessionRef = firestore.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      console.log('No sessionDoc');
      return res.status(401).json({ message: 'Unauthorized', redirectTo: '/login' });
    }

    const { isenCookies } = sessionDoc.data();
    //　もしisenCookiesが使えなくなったときにウェブアプリ側のセッションIDも無効にして、再ログインさせる。
    const isCookiesValid = await checkCookiesValidity(isenCookies);
    if (!isCookiesValid) {
      console.log('Cookies are not valid');
      return res.status(401).json({ message: 'Unauthorized', redirectTo: '/login' });
    }

    const scrapedDataRef = sessionRef.collection('scrapedData').doc('latest');
    const scrapedDataDoc = await scrapedDataRef.get();
    const data = scrapedDataDoc.data();
    if (!data || !data.contents) {
      console.log('No contents');
      return res.status(404).json({ message: 'Contents not found', redirectTo: '/login' });
    }
    const { contents } = data;

    // データベースの内容とサイトの一番上の要素が一致するかチェック
    const { topContent, browser, page } = await checkForTopContent(isenCookies);

    if (contents.length > 0 && topContent === contents[0].title) {
      console.log('No updates found');
      await browser.close();
      return res.json({ message: 'No updates found' });
    }

    console.log('Updates found');
    const newData = await scrapeContent(browser, page, isenCookies);

    await scrapedDataRef.set({ contents: newData });
    res.json({ message: 'Data refreshed successfully' });

  } catch (error) {
    console.error('Error refreshing data', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

httpsServer.listen(httpsPort, () => {
  console.log(`HTTPS Server listening at https://localhost:${httpsPort}`);
});
