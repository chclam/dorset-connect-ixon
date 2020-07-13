const requestPromise = require("request-promise");
const config = require("./adapter-config");
const classes = require("./classes.js");
const { json } = require("express");
const Device = classes.Device;

const host = "https://m2web.talk2m.com/t2mapi";
const t2mAccount = config.ewon.account;
const developerId = config.ewon.developerId;

function getAdapterName(){
    return "ewon";
}

async function getSession(username, password){
    const requestData = {
        uri: `${host}/login`,
        method: "POST",
        form: {
            "t2maccount": t2mAccount,
            "t2musername": username,
            "t2mpassword": password,
            "t2mdeveloperid": developerId
        }
    }
    try {
        const jsonData = await requestPromise(requestData);
        const parsedData = JSON.parse(jsonData);
        return parsedData.t2msession;
    }
    catch(e) {
        console.error("error:", e);
        throw "ewon sign in failed";
    }
}

async function getDevices(sessionKey){
    const requestData = {
        uri: `${host}/getewons`,
        method: "POST",
        form: {
            "t2msession": sessionKey,
            "t2mdeveloperid": developerId
        }
    }

    try {
        let jsonResponse = await requestPromise(requestData);
        jsonResponse = JSON.parse(jsonResponse);
        return formatDevices(jsonResponse.ewons);
    }
    catch(e) {
        throw "ewon device request failed";
    }
}

function formatDevices(jsonData){
    const ewons = [];
    
    for (let ewon of jsonData){
        
        const device = new Device(ewon.id.toString(), ewon.name, false, "ewon");

        if (ewon.status === "online") device.isOnline = true;

        if (ewon.lanDevices.length > 0) {
            
            for (let lanDevice of ewon.lanDevices){
                let url = null;

                if (device.isOnline){
                    url = encodeURI(`https://${ewon.m2webServer}/${t2mAccount}/${ewon.name}/vnc/${lanDevice.ip}:${lanDevice.port}`);
                }

                const deviceLink = {
                    name: lanDevice.name,
                    url: url
                }

                device.links.push(deviceLink);
            }
        }
        ewons.push(device);
    }
    return ewons;
}

async function deleteSession(sessionKey){

    if (sessionKey === undefined) return Promise.resolve("session key is undefined");

    const requestData = {
        uri: `${host}/logout`,
        method: "POST",
        form: {
            "t2maccount": t2mAccount,
            "t2msession": sessionKey,
            "t2mdeveloperid": developerId
        }
    }

    try {
        await requestPromise(requestData);
        return Promise.resolve();
    }
    catch(e) {
        // console.error(e);
        return Promise.reject(new Error("ewon session deletion failed"));
    }
}


// get account info with given sessionkey from the client.
// Receives an error if sessionkey is invalid. The function will then
// resolve either false or true based on the validity of the sessionkey.
async function checkSession(sessionKey){

    if (sessionKey === undefined) return Promise.resolve(false);

    const requestData = {
        uri: `${host}/getaccountinfo`,
        method: "POST",
        form: {
            "t2maccount": t2mAccount,
            "t2msession": sessionKey,
            "t2mdeveloperid": developerId
        }
    }

    try {
        const response = await requestPromise(requestData);
        if(JSON.parse(response).success == false) throw Error("Check session error.");
        return Promise.resolve(true);
    }
    catch(e) {
        return Promise.resolve(false);
    }
}

module.exports = {getSession, getDevices, deleteSession, checkSession, getAdapterName, formatDevices};
