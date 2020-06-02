const express = require("express");
const router = express.Router();
const path = require("path");
const srcPath = path.join(__dirname, "public");
const config = require("./adapters/adapter-config");

const ixon = require("./adapters/ixon-adapter");
const ewon = require("./adapters/ewon-adapter");

async function getAdapterSession(username, password, adapter, expiresIn){
    return await adapter.getSession(username, password, expiresIn);
}

function setSessionCookies(res, sessionKey, adapterName, expiresIn){
    res.cookie(`${adapterName}-session`, sessionKey, {maxAge: expiresIn * 10000}); // expiresin to milliseconds
    return res;
}

async function hasValidSession(ixonSession){
    // launches a promise to check the validity of the ixon session.
    // resolves boolean value based on their validity. the functions never
    // reject due the nature of promise.all. promise.any is not implemented yet.
    return ixonSessionCheckPromise = ixon.checkSession(ixonSession)
        .then((ixonValidSession) => {
            if (ixonValidSession){
                return true;
            }
            return false;
        })
        .catch(e => console.error(e));
}

/****************
 * Sign in routes 
****************/

router.get("/", async (req, res) => {
    const iSession = req.cookies["ixon-session"];

    if (await hasValidSession(iSession)){
        res.redirect("/devices");
    } else {
        res.status(200).sendFile(path.join(srcPath, "/signin.html"));
    }
});

router.post("/signin/ixon", async (req, res) => {
    const ixon = require("./adapters/ixon-adapter");
    const ewon = require("./adapters/ewon-adapter");
    let username = req.body.username;
    let password = req.body.password;
    let ixonPermissions;
    const expiresIn = 3600; // in seconds

    try {
        await ixon.getLinkList();
        const ixonSession = await getAdapterSession(username, password, ixon, expiresIn);
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

    if (await hasValidSession(iSession)){
        res.status(200).sendFile(path.join(srcPath, "/device-list.html"));
    } else {
        res.redirect("/");
    }
});

router.get("/devices/ixon", async (req, res) => {
    try {
        const ixonSession = req.cookies["ixon-session"];
        const deviceData = await ixon.getDevices(ixonSession);

        res.status(200).json({"status": "success", "data": deviceData});
    }
    catch (e){
        res.status(401).send();
    }
});

router.get("/devices/ixon/user", async (req, res) => {
    try {
        const ixonSession = req.cookies["ixon-session"];
        const userData = await ixon.getUserData(ixonSession);

        // console.log("hoi");


        res.status(200).json({"status": "success", "data": userData});
    }
    catch (e){
        res.status(404).send(e);
    }
});

router.get("/devices/ewon", async (req, res) => {
    try {
        const ewonSession = req.cookies["ewon-session"];
        const deviceData = await ewon.getDevices(ewonSession);

        res.status(200).json({"status": "success", "data": deviceData});
    }
    catch (e){
        res.status(401).send();
    }
});

router.get("/devices/ewon/alive", async (req, res) => {
    try {
        const ewonSession = req.cookies["ewon-session"];
        const response = await ewon.checkSession(ewonSession);
        if (!response) throw new Error;
        res.status(200).json({"status": "success"});
    }
    catch (e){
        res.status(401).json({"status": "failed"});
    }
});

module.exports = router;