const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const app = express();

const publicPath = path.join(__dirname, "public");

app.use(express.json());
app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded
app.use(cookieParser());

const accountRouter = require("./routes");
// const devicesRouter = require("./routes/devices");

app.use("/", accountRouter);
app.use("/public", express.static(publicPath));
// use this for the server.
// app.listen(process.env.PORT, () => console.log("server started."));
app.listen(3000, () => console.log("server started."));
