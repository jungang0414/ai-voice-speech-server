var admin = require("firebase-admin");
require('dotenv').config();
const express = require("express");
const app = express();
const cors = require("cors");
// cors預設所有跨域的請求都接受
app.use(cors());
app.use(express.json());

//firebase-admin 私密金鑰設置
var serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY)
} catch (error) {
    console.log("Failed private key: Error: ", error);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ai-voice-speech.firebaseio.com"
})

const db = admin.firestore();

// Gemini API
const { GoogleGenerativeAI } = require("@google/generative-ai");
//Api-key 
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

app.get("/", function (req, res) {
    try {
        console.log("Request successful");
        res.send("Request successful");
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
})

app.get("/api/v1/AllNews", async (req, res) => {
    //今天日期
    const today = new Date().toISOString().replaceAll("-", "/").split("T")[0]
    const url = `https://www.taichung.gov.tw/umbraco/Export/ExportDataApi/GetData?contentId=9962&startDate=${today}&endDate=${today}&rows=500&dateAlias=`
    // const url = "https://jsonplaceholder.typicode.com/posts/1"

    const dbCollection = db.collection('taichungNews');
    fetch(url)
        .then((res) => res.json())
        .then(async (data) => {
            const newsData = data.Children;

            for (const item of newsData) {
                const id = item.Id;
                const name = item.Name || "沒抓到標題的標題";
                const url = item.Url;
                const modifyDate = item.ModifyDate;
                const cleanedContent = item.Properties[6].value.replace(
                    /<\/?[^>]+(>|$)/g,
                    ""
                );

                const q = await dbCollection.where('id', '==', id).get();
                //確認有無相同資料，並加入新的資料
                if (q.empty) {
                    await dbCollection.add({
                        id: id,
                        name: name,
                        content: cleanedContent,
                        modifyDate: modifyDate,
                        url: url
                    });
                }
            }
            res.json({ message: "資料寫入成功" })
        })
        .catch((error) => {
            res.status(500).send(error);
            console.log(error);
        });
})

app.get("/api/v1/singleNews", async (req, res) => {
    const today = new Date().toISOString().replaceAll("-", "/").split("T")[0]

    const url = `https://www.taichung.gov.tw/umbraco/Export/ExportDataApi/GetData?contentId=9962&startDate=${today}&endDate=${today}&rows=500&dateAlias=`;

    fetch(url)
        .then((res) => res.json())
        .then(async (data) => {
            const newsData = data.Children[0];

            const newsCollection = db.collection("singleNews");

            //Gemini AI model
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: "請使用繁體中文改寫文章內容，請摘要內容的重點並將字數限制在100個字以內。"
            });

            const id = newsData.Id;
            const name = newsData.Name || "最新一則文章";
            const modifyDate = newsData.ModifyDate;
            const content = newsData.Properties[6].value;
            const cleanedContent = newsData.Properties[6].value.replace(
                /<\/?[^>]+(>|$)/g,
                ""
            );

            // 提示詞 & 正規化後的新聞內容素材
            const prompt = `${cleanedContent}`

            const result = await model.generateContent(prompt);
            const aiResponse = await result.response;
            const text = aiResponse.text(); //儲存AI 處理完後的文章

            const q = await newsCollection.where('id', '==', id).get();
            if (q.empty) {
                //如果沒有相同數據，則加入
                await newsCollection.add({
                    id: id,
                    name: name,
                    content: content,
                    cleanedContent: text,
                    modifyDate: modifyDate,
                })
            } else {
                console.log("Item already exists in Firestore:", id);
            }
            res.json({ message: "資料寫入成功" })
        }).catch((error) => {
            res.status(500).send(error);
            console.log(error);
        })
})


app.listen(3000, console.log(`running on ${3000}`));