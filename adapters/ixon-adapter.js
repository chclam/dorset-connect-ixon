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

async function getPermissions(sessionKey){
    href = linkDict["UserPermissions"];
    href = href.replace("{publicId}", "me");

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
async function getSession(username, password, expiresIn) {
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
    let authenticationString = new Buffer.from(`${username}::${password}`);
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
    const params = "?fields=name,publicId,activeVpnSession,servers,dataMonitors,dataReports";
    const devicesUri = linkDict["Agent"].replace("/{publicId}", params);
    const requestData = {
        uri: devicesUri,
        method: "GET",
        headers: {
            "Accept": "application/json",
            "IXapi-Application": applicationId,
            "IXapi-Version": "1",
            "Authorization": `Bearer ${sessionKey}`,
            "User-Agent": null
        }
    };
    
    try {
        let jsonResponse = await requestPromise(requestData);
        jsonResponse = JSON.parse(jsonResponse);
        return formatDevices(jsonResponse.data);
    }
    catch (e){
        throw "Device retrieval failed.";
    }
}



function formatDevices(jsonData){
    const ixons = [];

    for (let ixon of jsonData){
        const device = new classes.Device(ixon.publicId, ixon.name, false, "ixon");

        if (ixon.activeVpnSession !== null) device.isOnline = true;
        // set up vnc links
        for (let vnc of ixon.servers){
            const vncObject = {
                name: vnc.name,
                url: encodeURI(`https://connect.ixon.cloud/agents/${ixon.publicId}/Web-Access/VNC/${vnc.publicId}`)
            }
            device.vncLinks.push(vncObject);
        }
        for (let monitor of ixon.dataMonitors){
            const dataMonitor = {
                name: monitor.name,
                url: encodeURI(`https://connect.ixon.cloud/agents/${ixon.publicId}/data-monitors/${monitor.publicId}`)
            }
            device.dataMonitors.push(dataMonitor);
        }
        for (let report of ixon.dataReports){
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

async function deleteSession(sessionKey){

    if (sessionKey === undefined) return Promise.resolve("session key is undefined");

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
async function checkSession(sessionKey){

    if (sessionKey === undefined) return Promise.resolve(false);

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

// Initial call to get link list after server start.
getLinkList();

module.exports = {getLinkList, getSession, getDevices, deleteSession, checkSession, getAdapterName, getPermissions, getUserData};
