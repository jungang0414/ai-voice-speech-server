# NodeJS server

後端伺服器

## 使用技術

#### Express

[官網](https://expressjs.com/)

Node.js網頁應用程式框架，建立可以擴展且靈活的網頁和應用程式。
可以建立各種功能的網站和Web應用

#### cors
- 跨來源資源共享(Cross-Origin Resource Sharing, CORS)
[MDN](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/CORS)

允許伺服器指示瀏覽器從除本身以外的任何來源加載資源。
簡單來說就是: 從別的網域存取資料

會需要跨域存取是受到[同源政策](https://developer.mozilla.org/zh-TW/docs/Web/Security/Same-origin_policy)的影響，簡單來說就是當A網域要向B網域存取資料，必須要經過B網域的允許才可以存取資料。

#### firebase-admin SDK

[官網](https://firebase.google.com/docs/admin/setup?hl=zh-tw)
使用的功能如下

- 以完整管理員權限讀取及寫入即時資料庫資料。
Database: 當使用者於前端與後端溝通時，將後端抓取的資料寫入資料庫 Firebase Database 中。

#### dotenv

[官網](https://www.npmjs.com/package/dotenv)

協助設定環境變數的npm套件，避免未來上線後將自身密鑰公開出去。

#### Gemini AI

- 參考資料
[官網](https://ai.google.dev/)
[Google AI for Developers](https://ai.google.dev/api?_gl=1*1fabdu8*_ga*MTcwNDk3NTM3Ny4xNzI0MjExODgz*_ga_P1DBVKWT6V*MTcyNDgzNjgzMS41LjEuMTcyNDgzNjg3NS4xNi4wLjE0MDA1MzE3NzE.&hl=zh-tw&lang=node#set-up-api-key)

- 安裝 Gemini API SDK 套件
```
npm install @google/generative-ai
```

- 初始化&設定API金鑰 
```
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
```