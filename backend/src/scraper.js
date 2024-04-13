import puppeteer from 'puppeteer';
import https from 'https';
import { uploadStream } from '../firebase/firebaseAdminInit.js';


async function login(username, password) {
  let browser = null;
  let loginSuccess = false;
  try {
    browser = await puppeteer.launch({headless: true});

    const page = await browser.newPage();
    await page.goto('https://portal.nkz.ac.jp/portal/login.do', { waitUntil: 'networkidle0' });

    const loginSuccessPromise = page.waitForResponse(response => 
      response.url().includes('/portal/login.do') && response.status() === 302
    );

    const loginErrorPromise = page.waitForResponse(response => 
      response.url().endsWith('/portal/img/design01/under_l_red.png') && response.status() === 200
    ).then(() => {
      throw "Your password or username is invalid";
    });

    await page.type('#userId', username);
    await page.type('#password', password);
    console.log("Clicking login button...");
    await page.click('#loginButton');

    await Promise.race([loginSuccessPromise, loginErrorPromise]);

    console.log("Login successful");
    loginSuccess = true;
    const isenCookies = await page.cookies();
    return { isLoggedIn: true, browser, page, isenCookies };

  } catch (error) {
    console.error("Login failed:", error);
    return { isLoggedIn: false };
  } finally {
    if (browser && !loginSuccess) {
      await browser.close();
    }
  }
}

async function scrapeContent(browser, page, isenCookies, sessionId) {
  let allDetails = [];

  for (let i = 0; i <= 9; i++) {
    const linkId = `#link_${i}`;

    await page.waitForSelector(linkId, { visible: true });
    // await page.click(linkId);
    await page.evaluate((linkId) => {
      document.querySelector(linkId).click();
    }, linkId);
    console.log(`Open the content page for ${linkId}`);
    await page.waitForSelector('#oaprfloatclose', { visible: true });

    // ここでページの詳細を収集
    const rawDetails = await page.evaluate(() => {

      let data = {
        sender: "",
        title: "",
        message: "",
        attachment: "",
        datetime: ""
      };
      
      // .labelクラスを持つ全ての要素を取得
      const labels = document.querySelectorAll('.label');
      
      labels.forEach(label => {
        // labelの次の兄弟要素（.line_y_label）を飛ばし、その次の兄弟要素（目的の.item）を取得
        const nextItem = label.nextElementSibling ? label.nextElementSibling.nextElementSibling : null;

        if (nextItem && nextItem.classList.contains('item')) {
          // ラベルのテキスト内容に応じてdataオブジェクトに情報を保存
          const labelMappings = {
            "送信者": "sender",
            "タイトル": "title",
            "本文": "message",
            "添付ファイル": "attachment",
            "掲示期間": "datetime"
          };
        
          const labelKey = label.textContent.trim();

          if (labelMappings.hasOwnProperty(labelKey)) {

            if (labelKey === "添付ファイル") {
              const name = nextItem.querySelector('a').textContent.trim();
              const hrefValue = nextItem.querySelector('a').getAttribute('href');
              const match = hrefValue.match(/'(.+?)'/);
              const link = match ? match[1] : null;
              if (link && name) {
                data[labelMappings[labelKey]] = {
                  name: name,
                  link: link
                };
              } else {
                console.error("Failed to extract download information for attachment:", fileName);
              }
            } else {
              data[labelMappings[labelKey]] = nextItem.innerHTML.trim();
            }
          }
        }
      });

      return data;
    });



    // const cookies = await page.cookies();

    if (rawDetails.attachment && rawDetails.attachment.link) {
        const baseUrl = 'https://portal.nkz.ac.jp/portal/'
        const relativeUrl = rawDetails.attachment.link.replace('./', '');
        const absoluteUrl = baseUrl + relativeUrl;
        const destinationPath = `${rawDetails.attachment.name}`; // 保存先のパスを適切に設定
        const publicUrl = await downloadAndUploadFile(absoluteUrl, destinationPath, isenCookies, sessionId);
        rawDetails.attachment.link = publicUrl;
    }




    const details = {
      sender: rawDetails.sender,
      title: cleanHtmlAndWhitespace(rawDetails.title),
      message: cleanHtmlAndWhitespace(rawDetails.message),
      attachment: rawDetails.attachment,
      datetime: cleanDateTime(rawDetails.datetime)
    }

    allDetails.push(details);
    await page.evaluate(() => {
      document.querySelector('#oaprfloatclose').click();
    });
    await page.waitForSelector('#logout', { visible: true });
  }

  console.log("All contents are scraped");
  await browser.close();
  return allDetails;
}

function cleanHtmlAndWhitespace(text) {
  // HTMLタグを取り除く
  const noHtml = text.replace(/<[^>]*>/g, '');
  // HTMLエンティティの&nbsp;を空白に置き換える
  let cleanText = noHtml.replace(/&nbsp;/g, ' ');
  // 連続する空白を一つの空白に置き換え、文字列の先頭と末尾の空白を取り除く
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  return cleanText;
}

function cleanDateTime(datetime) {
  // \nで文字列を分割し、最初の部分を取得
  const cleanedDatetime = datetime.split('\n')[0].trim();
  return cleanedDatetime;
}

import fs from 'fs';

const ca = fs.readFileSync('./certificates/complete-chain.pem');

const agent = new https.Agent({
  ca: ca
});

async function downloadAndUploadFile(url, destination, isenCookies, sessionId) {
  const fetch = (await import('node-fetch')).default;
  const isenCookie = isenCookies.find(cookie => cookie.name === 'JSESSIONID');
  if (!isenCookie) {
    throw new Error('Failed to get JSESSIONID cookie');
  }

  const headers = {
    'Cookie': `JSESSIONID=${isenCookie.value}`,
  };

  const response = await fetch(url, {
    headers,
    agent
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const stream = response.body;

  try {
    const publicUrl = await uploadStream(stream, destination, sessionId);
    console.log(`File is available at ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error('Error uploading file or saving to database:', error);
    throw error;
  }
}

async function checkForTopContent(isenCookies) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // isenCookiesをページに設定
  await page.setCookie(...isenCookies);

  // ログインが必要なページにアクセス
  await page.goto('https://portal.nkz.ac.jp/portal/top.do', { waitUntil: 'networkidle0' });
  
  // link_0が表示されるまで待機
  await page.waitForSelector('#link_0', { visible: true });

  // link_0の内部テキストを取得し、cleanHtmlAndWhitespace関数で整形
  const rawText = await page.evaluate(() => document.querySelector('#link_0').innerText);
  const cleanedText = cleanHtmlAndWhitespace(rawText);

  // console.log(cleanedText);

  return { topContent: cleanedText, browser, page };
}

async function checkCookiesValidity(isenCookies) {
  try {
    const response = await axios.get('https://portal.nkz.ac.jp/portal/top.do', {
      headers: {
        'Cookie': `JSESSIONID=${isenCookies.JSESSIONID}`
      }
    });
    return response.status === 200;
  } catch (error) {
    console.error('Failed to validate cookies with axios', error);
    return false;
  }
}

export { login, scrapeContent, checkForTopContent, checkCookiesValidity };
