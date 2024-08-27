const express = require("express");
const app = express();
const cors = require("cors");
// cors預設所有跨域的請求都接受
app.use(cors());

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
    fetch(url)
        .then((res) => res.json())
        .then((data) => res.send(data))
        .catch((error) => {
            res.status(500).send(error);
        });
})

app.listen(3000, console.log(`running on ${3000}`));