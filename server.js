var admin = require("firebase-admin");
require('dotenv').config();
const express = require("express");
const app = express();
const cors = require("cors");
const fs = require('fs');
const path = require('path');
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
    databaseURL: "https://ai-voice-speech.firebaseio.com",
    storageBucket: "ai-voice-speech.appspot.com"
})

const db = admin.firestore();
const storage = admin.storage();

// Gemini API
const { GoogleGenerativeAI } = require("@google/generative-ai");
//Api-key 
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

// Azure Speech
var sdk = require("microsoft-cognitiveservices-speech-sdk");

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

app.post('/api/v1/createVoice', async (req, res) => {
    const { title, text } = req.body;

    if (!title) {
        return res.status(400).json({ error: "Title is required" })
    }

    //AI Speech SDK

    try {
        const audioFile = `${title}.wav`
        // 設定金鑰、區域
        const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.SPEECH_CONFIG_API_KEY, process.env.SPEECH_CONFIG_ROGIN);
        const audioConfig = sdk.AudioConfig.fromAudioFileOutput(audioFile);

        //使用的聲音模型
        speechConfig.speechSynthesisVoiceName = "zh-TW-YunJheNeural";

        //創建語音合成模型
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

        //啟動語音合成模型
        synthesizer.speakTextAsync(text,
            function (result) {
                if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                    console.log("finished.");

                    // 將生成的音源檔案上傳至 Firebase Storage
                    // 生成音源檔案的路徑
                    const uploadPath = path.join(__dirname, audioFile); // __dirname: 表示目前執行的腳本所在目錄

                    fs.access(uploadPath, fs.constants.F_OK, async (err) => {
                        if (err) {
                            console.log("檔案不存在: ", err);
                            res.status(500).json({ error: "找不到檔案" })
                            return;
                        }

                        //等待上傳至Storage
                        await storage.bucket().upload(uploadPath, {
                            destination: `audio/${audioFile}`,
                            metadata: {
                                contentType: "auido/wav",
                            },
                        });

                        const file = storage.bucket().file(`audio/${audioFile}`);
                        const [url] = await file.getSignedUrl({
                            action: "read",
                            expires: "03-09-2025"
                        });

                        fs.unlinkSync(uploadPath);

                        res.json({ message: "文字合成音源成功" })
                    });
                } else {
                    console.error("Speech synthesis canceled, " + result.errorDetails +
                        "\nDid you set the speech resource key and region values?");
                    res.status(500).json({ error: 'Speech synthesis failed', details: result.errorDetails });
                }
                synthesizer.close();
            },
            function (err) {
                console.trace("err - " + err);
                synthesizer.close();
                res.status(500).json({ error: 'Speech synthesis error', details: err });
            });
        console.log("合成音源: " + audioFile);
    } catch (error) {
        console.error("Error saving text:", error);
        res.status(500).json("Error saving text");
    }
})

app.listen(3000, console.log(`running on ${3000}`));