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


app.listen(3000, console.log(`running on ${3000}`));