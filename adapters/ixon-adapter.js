const requestPromise = require("request-promise");
const SHA256 = require("crypto-js/sha256");
const config = require("./adapter-config");
const classes = require("./classes.js");

const applicationId = config.ixon.applicationId;
const companyId = config.ixon.companyId;

const linkDict = {};
let linkListChecksum;

function getAdapterName(){
    return "ixon";
}

// initial request to ixon for linklist to the api.
// returns rels for api requests in urls.  
async function getLinkList() {
    const requestData = {
        uri: config.ixon.url,
        method: "GET",
        headers: {
            "Accept": "application/json",
            "IXapi-Application": applicationId,
            "IXapi-Version": "1",
            "User-Agent": null
        }
    };

    //initial call to ixon for discovery link list. 
    try {
        const linkList = await requestPromise(requestData);
        updateLinkList(linkList);
    }
    catch (e) {
        console.error(e);
        throw "Initial server call to Ixon failed.";
    }
}

async function getPermissions(sessionKey=""){
    href = linkDict["UserPermissions"];
    href = href.replace("{publicId}", "me");

    if (sessionKey.length === 0) {
        throw "Sessionkey must not be empty";
    }

    try {
        const requestData = {
            uri: href,
            method: "GET",
            headers: {
                "Accept": "application/json",
                "IXapi-Application": applicationId,
                "IXapi-Version": "1",
                "User-Agent": null,
                // company code for dorset
                "IXapi-Company": companyId, 
                "Authorization": `Bearer ${sessionKey}` 
            }
        };
        let sessionData = await requestPromise(requestData);
        sessionData = JSON.parse(sessionData);
        return sessionData.data;
    }
    catch(error) {
        console.log(error);
    }
}

// expiresIn = in seconds.
async function getSession(username, password, expiresIn, twoFactorAuthentication="") {
    const requestData = {
        uri: linkDict["AccessTokenList"] + "?fields=secretId,publicId",
        method: "POST",
        headers: {
            "Accept": "application/json",
            "IXapi-Application": applicationId,
            "IXapi-Version": "1",
            "User-Agent": null
        },
        form: {
            "expiresIn": expiresIn
        }
    };
    // Encode authentication string.
    let authenticationString = new Buffer.from(`${username}:${twoFactorAuthentication}:${password}`);
    authenticationString = authenticationString.toString("base64");
    requestData.headers.Authorization = `Basic ${authenticationString}`;

    try {
        let sessionData = await requestPromise(requestData);
        sessionData = JSON.parse(sessionData);
        return sessionData.data.secretId;
    }
    catch (e) {
        // log error in separate file.
        throw "Sign in failed.";
    }
}

async function getUserData(sessionKey){
    let devicesUri = linkDict["User"];
    devicesUri = devicesUri.replace("{publicId}", "me");
    devicesUri += "?fields=emailAddress,fullName,language,permissions.*";
    const requestData = {
        uri: devicesUri,
        method: "GET",
        headers: {
            "Accept": "application/json",
            "IXapi-Application": applicationId,
            "IXapi-Version": "1",
            "Authorization": `Bearer ${sessionKey}`,
            "IXapi-Company": companyId, 
            "User-Agent": null
        }
    };
    
    try {
        let data = await requestPromise(requestData);
        data = JSON.parse(data);
        delete data.data.links;   
        return JSON.stringify(data.data);
    }
    catch (e){
        throw "User data retrieval failed.";
    }
}

async function getDevices(sessionKey){
    const params = "?fields=name,publicId,activeVpnSession,devices.*,servers.*,dataMonitors,dataReports";
    const devicesUri = linkDict["AgentList"] + params;
    const requestData = {
        uri: devicesUri,
        method: "GET",
        headers: {
            "Accept": "application/json",
            "IXapi-Application": applicationId,
	        "IXapi-Company": companyId,
            "IXapi-Version": "1",
            "Authorization": `Bearer ${sessionKey}`,
            "User-Agent": null
        }
    };
    
    try {
        let jsonResponse = await requestPromise(requestData);
        jsonResponse = JSON.parse(jsonResponse);
        return jsonResponse.data;
    }
    catch (e){
        throw "Device retrieval failed.";
    }
}


async function appendHttpServers(sessionKey, devices) {
   
    const httpServers = [];

    for (let device of devices){
        for (deviceServer of device["servers"]){
            // if there are http servers and if the device is online
            if (deviceServer.type === "http" && device.activeVpnSession !== null){
                x = {
                    "server": {
                        "publicId": deviceServer.publicId
                    },
                    "method": "http"
                }
                httpServers.push(x)
            }
        }
    }

    // Stop if there are no http servers to retrieve, i.e. no device is online
    if (httpServers.length === 0) return;

    const requestData = {
        uri: linkDict["WebAccessList"],
        method: "POST",
        headers: {
            "Accept": "application/json",
            "IXapi-Application": applicationId,
            "IXapi-Company": companyId,
            "Authorization": `Bearer ${sessionKey}`,
            "IXapi-Version": "1",
            "User-Agent": null
        },
        body: httpServers,
        json: true
    };


    try {
        let sessionData = await requestPromise(requestData);

        // append the requested links to the devices in the parameter
        let httpLinkCounter = 0;
        for (let device of devices){
            for (deviceServer of device["servers"]){
                if (deviceServer.type === "http"){
                    deviceServer["link"] = sessionData["data"][httpLinkCounter]["url"];
                    httpLinkCounter++;
                }
            }
        }
    }
    catch (e) {
        console.error(e);
        throw "Http servers request failed.";
    }
}


function formatDevices(deviceData){
    const ixons = [];

    try {
        for (let ixon of deviceData){
            const device = new classes.Device(ixon.publicId, ixon.name, false, "ixon");
            

            if (ixon.activeVpnSession !== null) {
                device.isOnline = true;
            }

            // set up links
            for (const server of ixon.servers){
                let url = null;

                if (device.isOnline){
                    if (server.type === "http" && ("link" in server)){
                        url = server.link;
                    }
                    else if (server.type === "vnc"){
                        url = `https://connect.ixon.cloud/agents/${ixon.publicId}/Web-Access/VNC/${server.publicId}`;
                    }
                    url = encodeURI(url);
                }

                const linkObject = {
                    name: server.name,
                    url: url
                }
                
                device.links.push(linkObject);
            }

            for (const monitor of ixon.dataMonitors){
                const dataMonitor = {
                    name: monitor.name,
                    url: encodeURI(`https://connect.ixon.cloud/agents/${ixon.publicId}/data-monitors/${monitor.publicId}`)
                }
                device.dataMonitors.push(dataMonitor);
            }

            for (const report of ixon.dataReports){
                const dataReport = {
                    name: report.name,
                    url: encodeURI(`https://connect.ixon.cloud/agents/${ixon.publicId}/data-reports/${report.publicId}`)
                }
                device.dataReports.push(dataReport);
            }
            ixons.push(device);
        }
        return ixons;
    }

    catch (e) {
        console.error("Device formating failed", e);
        throw "Device retrieval failed";
    }
}

async function deleteSession(sessionKey=""){

    if (sessionKey.length === 0) return Promise.resolve("session key is undefined");

    const devicesUri = linkDict["AccessTokenList"] + "/me";
    const requestData = {
        uri: devicesUri,
        method: "DELETE",
        headers: {
            "IXapi-Application": applicationId,
            "IXapi-Version": "1",
            "Authorization": `Bearer ${sessionKey}`,
            "User-Agent": null
        }
    };
    
    try {
       await requestPromise(requestData);
       return Promise.resolve();
    }
    catch (e){
        return Promise.reject(new Error("Session deletion failed for ixon."));
    }
}

// makea  basic discovery request with sessionkey. If the sessionkey 
// is expired it will receive an error from the server.
async function isValidSession(sessionKey=""){

    if (sessionKey.length === 0) return Promise.resolve(false);

    const requestData = {
        uri: "https://api.ixon.net:443/",
        method: "GET",
        headers: {
            "Accept": "application/json",
            "IXapi-Application": applicationId,
            "IXapi-Version": "1",
            "Authorization": `Bearer ${sessionKey}`,
            "User-Agent": null
        }
    };

    //initial call to ixon for discovery link list. 
    try {
        await requestPromise(requestData);
        return Promise.resolve(true);
    }
    catch (e) {
        return Promise.resolve(false);
    }
}

function updateLinkList(linkList){
    const responseListHashed = SHA256(linkList);
    const jsonData = JSON.parse(linkList);
    
    // check if the linklist contains any changes by hashing.
    if (linkListChecksum === responseListHashed) return;
    
    // rebuild linklist if the new hash differs from our saved checksum.
    linkListChecksum = responseListHashed;
    Object.keys(linkDict).forEach((id) => {
        delete linkDict[id];
    });
    for (let row of jsonData.links){
        linkDict[`${row.rel}`] = row.href;
    }
}

let initialCallSuccess = false;

while(!initialCallSuccess){
    // Initial call to get link list after server start.
    try {
        console.log("Connecting to Ixon server...");
        getLinkList();
        initialCallSuccess = true;   
        console.log("Connection to the Ixon Api success.");
    }
    catch (e) {
        console.log("Initial server call to Ixon failed. There might be something wrong with the Ixon server.", e);
        console.log("Retrying...");
    }
}


module.exports = {getLinkList, getSession, getDevices, deleteSession, isValidSession, getAdapterName, getPermissions, getUserData, appendHttpServers, formatDevices};
