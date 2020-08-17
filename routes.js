const express = require("express");
const router = express.Router();
const path = require("path");
const srcPath = path.join(__dirname, "public");
const config = require("./adapters/adapter-config");

const ixon = require("./adapters/ixon-adapter");
const ewon = require("./adapters/ewon-adapter");
const mysql = require("mysql")

async function getAdapterSession(username, password, adapter, expiresIn, twoFactorAuthentication){
    if(adapter.getAdapterName() === "ixon" && twoFactorAuthentication.length > 0){
        return await adapter.getSession(username, password, expiresIn, twoFactorAuthentication=twoFactorAuthentication);
    }
    return await adapter.getSession(username, password, expiresIn);
}

function setSessionCookies(res, sessionKey, adapterName, expiresIn){
    res.cookie(`${adapterName}-session`, sessionKey, {maxAge: expiresIn * 10000}); // expiresin to milliseconds
    return res;
}


/****************
 * Sign in routes 
****************/

router.get("/", async (req, res) => {
    const iSession = req.cookies["ixon-session"];
    const validSession = await ixon.isValidSession(iSession);

    if (validSession){
        res.redirect("/devices");
    } else {
        res.status(200).sendFile(path.join(srcPath, "/signin.html"));
    }
});

router.post("/signin/ixon", async (req, res) => {
    const ixon = require("./adapters/ixon-adapter");
    const ewon = require("./adapters/ewon-adapter");
    const username = req.body.username;
    const password = req.body.password;
    const twoFactorAuthentication = req.body.twoFactorAuthentication;
    const expiresIn = 3600; // in seconds
    let ixonPermissions;

    try {
        await ixon.getLinkList();
        const ixonSession = await getAdapterSession(username, password, ixon, expiresIn, twoFactorAuthentication);
        res = setSessionCookies(res, ixonSession, ixon.getAdapterName(), expiresIn);
        ixonPermissions = await ixon.getPermissions(ixonSession);
    }
    catch (e){
        res.status(401).redirect("/?signin=failed");
    }

    // also get ewon devices if the user has access to all devices 
    try {
        if (ixonPermissions.agents_access_all){
            const ewonSession = await getAdapterSession(config.ewon.username, config.ewon.password, ewon, 60);
            res = setSessionCookies(res, ewonSession, ewon.getAdapterName(), expiresIn);
            res.redirect("/devices");
        }
    }
    catch (e){
        const params = "?ewonsignin=failed,invalidCompany";
        res.redirect("/devices" + params);
    }
});

router.get("/signout", async (req, res) => {
    const isession = req.cookies["ixon-session"];
    const esession = req.cookies["ewon-session"];

    try {
        const ixonPromise = ixon.deleteSession(isession);
        const ewonPromise = ewon.deleteSession(esession);

        Promise.all([ixonPromise, ewonPromise])
            .then(() => {
                res.redirect("/");
            })
            .catch((error) => {
                res.redirect("/devices");
            });
    }
    catch (e) {
        console.log(e);
    }
});


/****************
 * Devices routes
****************/

router.get("/devices", async (req, res) => {
    const iSession = req.cookies["ixon-session"];
    const validSession = await ixon.isValidSession(iSession);

    if (validSession){
        res.status(200).sendFile(path.join(srcPath, "/device-list.html"));
    } else {
        res.redirect("/");
    }
});

router.get("/devices/ixon", async (req, res) => {
    try {
        const ixonSession = req.cookies["ixon-session"];

        const deviceData = await ixon.getDevices(ixonSession);
        // deviceData only contains data for the vnc servers but not for
        // the http servers, appendHttpServers() retrieves these links.
        await ixon.appendHttpServers(ixonSession, deviceData);

        const formattedDevices = ixon.formatDevices(deviceData);
        res.status(200).json({"status": "success", "data": formattedDevices});
    }
    catch (e){
        res.status(401).send("Failed to fetch ixon devices.");
    }
});

router.get("/devices/ixon/user", async (req, res) => {
    try {
        const ixonSession = req.cookies["ixon-session"];
        const userData = await ixon.getUserData(ixonSession);

        res.status(200).json({"status": "success", "data": userData});
    }
    catch (e){
        res.status(404).send(e);
    }
});

router.get("/devices/ixon/recentErrors", async (req, res) => {
    // add ixon verification. i.e. access to sql iff access via ixon.
    const ixonSession = req.cookies["ixon-session"];
    const validSession = await ixon.isValidSession(ixonSession);

    if (!validSession){
        res.status(401).send("Unauthorized ");
    }

    const credentials = config.mysql;
    const con = mysql.createConnection(credentials);
    const query = "SELECT * FROM recenterrors";
   
    con.query(query, (error, results) => {
        res.status(200).send({"status": "success", "data": results});
    });
});

router.get("/devices/ewon", async (req, res) => {
    try {
        const ewonSession = req.cookies["ewon-session"];
        const deviceData = await ewon.getDevices(ewonSession);

        res.status(200).json({"status": "success", "data": deviceData});
    }
    catch (e){
        console.log(e);
        res.status(401).send(e);
    }
});

router.get("/devices/ewon/alive", async (req, res) => {
    try {
        const ewonSession = req.cookies["ewon-session"];
        const validSession = await ewon.isValidSession(ewonSession);

        if (!validSession) throw new Error;

        res.status(200).json({"status": "success"});
    }
    catch (e){
        res.status(401).json({"status": "failed"});
    }
});


module.exports = router;
