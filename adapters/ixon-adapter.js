const requestPromise = require("request-promise");
const SHA256 = require("crypto-js/sha256");
const config = require("./adapter-config");
const classes = require("./classes.js");


const linkDict = {};
let linkListChecksum;

const ixonBaseUrl = "https://portal.ixon.cloud/portal/devices/";

function getAdapterName(){
    return "ixon";
}

function formatRequestData(uri=config.ixon.uri, method="GET", sessionKey="", form={}, body={}){
    const requestData = {
        uri: uri,
        method: method,
        headers: {
            "Accept": "application/json",
            "Api-Application": config.ixon.applicationId,
            "Api-Version": "2",
            "Api-Company": config.ixon.companyId,
            "User-Agent": null
        },
        form: JSON.stringify(form)
    };
    if (sessionKey.length > 0) requestData["headers"]["Authorization"] = `Bearer ${sessionKey}`;
    return requestData;
}

// initial request to ixon for linklist to the api.
// returns rels for api requests in urls.  
async function getLinkList() {
    const requestData = formatRequestData(config.ixon.url);

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
    if (sessionKey.length === 0) throw "Sessionkey is required.";
    let href = linkDict["RoleList"];
    href += "?fields=permissions";
    const requestData = formatRequestData(href, "GET", sessionKey);

    try {
        let roleData = await requestPromise(requestData);
        roleData = JSON.parse(roleData);
        
        // parse out permission data
        const permissions = [];
        for (let role of roleData["data"]){
            for (let perm of role["permissions"]){
                perm = perm["publicId"];
                if (!permissions.includes(perm)){
                    permissions.push(perm);
                };
            }
        }
        return permissions; 
    }
    catch(error) {
        console.log(error);
    }
}

// expiresIn = in seconds.
async function getSession(username, password, expiresIn, twoFactorAuthentication="") {
    const href = linkDict["AccessTokenList"] + "?fields=secretId,publicId";
    const requestData = formatRequestData(href, "POST", undefined, {"expiresIn": expiresIn});

    // Encode authentication string.
    let authenticationString = new Buffer.from(`${username}:${twoFactorAuthentication}:${password}`);
    authenticationString = authenticationString.toString("base64");
    requestData.headers["Authorization"] = `Basic ${authenticationString}`;

    try {
        let sessionData = await requestPromise(requestData);
        sessionData = JSON.parse(sessionData);
        return sessionData.data;
    }
    catch (e) {
        // log error in separate file.
        throw `Sign in failed: ${e}`;
    }
}

async function getUserData(sessionKey){
    let devicesUri = linkDict["MyUser"];
    devicesUri += "?fields=emailAddress,name,language";
    const requestData = formatRequestData(devicesUri, "GET", sessionKey);
    
    try {
        let data = await requestPromise(requestData);
        data = JSON.parse(data);
        return JSON.stringify(data.data);
    }
    catch (e){
        throw `User data retrieval failed. ${e}`;
    }
}

async function getDevices(sessionKey){
    const params = "?fields=name,publicId,activeVpnSession,devices.*,servers.*,dataMonitors,dataReports&page-size=500";
    const devicesUri = linkDict["AgentList"] + params;
    const requestData = formatRequestData(devicesUri, "GET", sessionKey);
    
    try {
        let jsonResponse = await requestPromise(requestData);
        jsonResponse = JSON.parse(jsonResponse);
        return jsonResponse.data;
    }
    catch (e){
        throw `Device retrieval failed. ${e}`;
    }
}

async function deleteSession(sessionKey, publicId=""){

    if (publicId.length === 0) return Promise.reject(new Error("publicId is undefined"));

    const devicesUri = linkDict["AccessTokenList"];
    
    const requestData = formatRequestData(devicesUri, "DELETE", sessionKey, {publicId: publicId});
    
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

    const href = linkDict["MyUser"];
    const requestData = formatRequestData(href, "GET", sessionKey);

    //initial call to ixon for discovery link list. 
    try {
        await requestPromise(requestData);
        return Promise.resolve(true);
    }
    catch (e) {
        return Promise.resolve(false);
    }
}


async function appendHttpServers(sessionKey, devices) {
    const httpServers = [];

    for (let device of devices){
        for (let deviceServer of device["servers"]){
            // if there are http servers and if the device is online
            if (deviceServer.type === "http" && device.activeVpnSession !== null){
                const x = {
                    "server": {
                        "publicId": deviceServer.publicId
                    },
                    "method": "http"
                }
                httpServers.push(x);
            }
        }
    }

    // Stop if there are no http servers to retrieve, i.e. no device is online
    if (httpServers.length === 0) return;

    
    const uri = linkDict["WebAccess"];
    const requestData = formatRequestData(uri, "POST", sessionKey, httpServers);

    try {
        let sessionData = await requestPromise(requestData);
        sessionData = JSON.parse(sessionData);
        sessionData = sessionData["data"];

        // append the requested links to the devices in the parameter
        let httpLinkCounter = 0;
        for (let device of devices){
            for (deviceServer of device["servers"]){
                if (deviceServer.type === "http"){
                    deviceServer["link"] = sessionData[httpLinkCounter]["url"];
                    httpLinkCounter++;
                }
            }
        }
    }
    catch (e) {
        throw `Http servers request failed. ${e}`;
    }
}


function formatDevices(deviceData){
    const ixons = [];

    try {
        for (let ixon of deviceData){
            const device = new classes.Device(ixon.publicId, ixon.name, false, "ixon");
            if (ixon.activeVpnSession !== null) device.isOnline = true;

            // set up links
            for (const server of ixon.servers){
                let url = null;

                if (device.isOnline){
                    if (server.type === "http" && ("link" in server)){
                        url = server.link;
                    }
                    else if (server.type === "vnc"){
                        url = `${ixonBaseUrl}${ixon.publicId}/web-access/vnc/${server.publicId}`;
                    }
                    url = encodeURI(url);
                }

                const linkObject = {
                    name: server.name,
                    url: url
                }
                
                device.links.push(linkObject);
            }

//            for (const monitor of ixon.dataMonitors){
//                const dataMonitor = {
//                    name: monitor.name,
//                    url: encodeURI(`https://portal.ixon.cloud/agents/${ixon.publicId}/data-monitors/${monitor.publicId}`)
//                }
//                device.dataMonitors.push(dataMonitor);
//            }

//            for (const report of ixon.dataReports){
//                const dataReport = {
//                    name: report.name,
//                    url: encodeURI(`https://portal.ixon.cloud/agents/${ixon.publicId}/data-reports/${report.publicId}`)
//                }
//                device.dataReports.push(dataReport);
//            }
            ixons.push(device);
        }
        return ixons;
    }

    catch (e) {
        console.error("Device formating failed", e);
        throw "Device retrieval failed";
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
    for (let row of jsonData.data){
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
