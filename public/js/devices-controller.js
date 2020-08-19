import * as fetcher from "./fetcher.js";
import * as errorHandler from "./error-handler.js";
import * as view from "./devices-view.js";

let sortedDevices;

$(document).ready(function() {

    // device search bar listeners.
    $("#deviceSearch").keyup(function() {
        view.filterDevices(sortedDevices);
    });

    $(document).keydown(function(k) {
        const code = k.keyCode;

        if (code === 27) $("input").blur();

        // break if searchbar or modal is focused
        if ($("#deviceSearch").is(":focus") || $(".modal").is(":visible")) return;

        const isMod = (code === 8 || code === 13); // backspace or enter
        const isAlphaNum = ((code >= 48 && code <= 90) || code === 32);
        const isNumpad = (code >= 96 && code <= 111);

        if (isMod || isAlphaNum || isNumpad) {
            $("#deviceSearch").focus(); // if key is backspace, 
        }
    });

    $(".cancelSearch").click(function(){
        $("#deviceSearch").val("");
        view.filterDevices(sortedDevices);
    });

    $(".filters .btn-link").click(function(){
        const filterDiv = $(".filters .select");

        if(!filterDiv.hasClass("d-flex")){
            filterDiv.addClass("d-flex");
        }
        else if(filterDiv.hasClass("fadeInDown")) {
            filterDiv.removeClass("fadeInDown");
            filterDiv.addClass("fadeOutDown");
        }
        else {
            filterDiv.removeClass("fadeOutDown");
            filterDiv.addClass("fadeInDown");
        }
    })

    $("#errors").click(function(){
        sortOnErrors(sortedDevices);
        view.drawDevices(sortedDevices);     
    });

    $("#alpha").click(function(){
        sortDevices(sortedDevices);
        view.drawDevices(sortedDevices);     
    });

    $("#sort-devices").change(function(){

        if($("#sort-devices option:selected").val() === "errors"){
            sortOnErrors(sortedDevices);
            $("#sortOptionDiv").addClass("text-primary font-weight-bold");
        } else {
            sortDevices(sortedDevices);
            $("#sortOptionDiv").removeClass("text-primary font-weight-bold");
        }
        view.drawDevices(sortedDevices);
        view.filterDevices(sortedDevices);
    });

    $("#filter-status").change(function(){
        view.filterDevices(sortedDevices);

        if($("#filter-status option:selected").val() === ""){
            $("#statusFilterDiv").removeClass("text-primary font-weight-bold");
        } else {
            $("#statusFilterDiv").addClass("text-primary font-weight-bold");
        }
    });

    $("#filter-device").change(function(){
        view.filterDevices(sortedDevices);

        if($("#filter-device option:selected").val() === ""){
            $("#routerFilterDiv").removeClass("text-primary font-weight-bold");
        } else {
            $("#routerFilterDiv").addClass("text-primary font-weight-bold");
        }
    });

    // modal for device details.
    $(document).on("click", ".device", function() {
        const deviceId = $(this).attr("id");

        for (let device of sortedDevices){
            if (device.id === deviceId){
                view.showDeviceModal(device);
                break;
            }
        }
    });

    init();
    
    // keep ewon connection alive; setInterval keeps repeating.
    const interval = 300000; // in ms
    setInterval(() => fetcher.keepAliveEwon(), interval);
});

function init(){
    /* 
    draw sign in error alerts
    */
    const urlParams = new URLSearchParams(window.location.search).get("ewonsignin");
   
    if(urlParams !== null){
        const errorParams = urlParams.split(",");

        const errorMsgs = {
            "failed": "Aanmelding bij Ewon mislukt.",
            "invalidCompany": "U heeft geen toegangsrechten tot dit bedrijf."
        }
    
        for (let param of errorParams){
            if (param in errorMsgs){
                console.log(param);
                errorHandler.signInDevice(errorMsgs[param]);
            }
        }
    }

    // draw user signed-in sessions (the top right signed in statuses in the page).
    fetcher.getIxonUserData()
      .then(data => {
        data = JSON.parse(data);
        view.drawUserSession(data.fullName, data.emailAddress, data.permissions);
      })
      .catch(e => {
          throw "retrieval userdata failed.";
      });

    // make ajax-requests for ixon and ewon devices to middleware server
    const ixonPromise = fetcher.getIxons()
        .then(devices => {
            return Promise.resolve(devices);
        })
        .catch(e => {
            console.log(e)
            errorHandler.ixonRequest(e);
            return Promise.resolve([]);
        });

     const ewonPromise = fetcher.getEwons()
        .then(devices => {
            return Promise.resolve(devices);
        })
        .catch(e => {
            errorHandler.ewonRequest(e);
            return Promise.resolve([]);
        });

     const mySqlPromise = fetcher.getSqlErrors()
        .then(devices => {
            return Promise.resolve(devices);
        })
        .catch(e => {
            // IMPORTANTTTTT
            errorHandler.numberErrorsRequest(e);
            return Promise.resolve([]);
        });

    // show on page as soon as either device type is loaded.
    Promise.all([ixonPromise, ewonPromise, mySqlPromise])
        .then(([ixonDevices, ewonDevices, mySqlErrors]) => {

            // if both are not loaded.
            if (ixonDevices.length === 0 && ewonDevices.length === 0){
                throw "no session retrieved";
            } 

            // sort devices by online status and lexicographical order.
            sortedDevices = ixonDevices.concat(ewonDevices);

            mergeErrorData(sortedDevices, mySqlErrors);

            sortDevices(sortedDevices);
            view.drawDevices(sortedDevices);

            $(".deviceSpinner").hide();
            $("#deviceListDiv").removeClass("d-none");
        })
        .catch((e) => {
            console.error(e);
        });
}

function mergeErrorData(devices, errorList){
    // merge mySqlErrors with ixonDevices
    // copy relevant data from errorList to a dict for more efficient look up.

    if (errorList.length === 0) return devices;

    const deviceErrors = {}
    
    for (const row of errorList){
        const aId = row.agentId;

        if (!(aId in deviceErrors)){
            deviceErrors[aId] = 0;   
        }

        // accumulate errors of all devices to its agentId
        deviceErrors[aId] += row.numberOfErrors;   
    }

    for (const i in devices){
        const agentId = devices[i]["id"];

        if (!(agentId in deviceErrors)) {
            devices[i]["recentErrors"] = null;
            continue;
        }
        devices[i]["recentErrors"] = deviceErrors[agentId];
    }
}

function quickSort(devices, low, high, sortOn="alphabetical") {
    // var low and high refer to the range that needs to be sorted.

    // guard predicates for sort options
    const sortPreds = {
        "alphabetical": (device, pivot) => device.name < pivot.name,
        "errors": (device, pivot) => (device.recentErrors === 0 && pivot.recentErrors === null) || (device.recentErrors > pivot.recentErrors)
    }

    if (!(sortOn in sortPreds)) {
        throw ("Provided sort option not available.");
    }

    function partition(devices, low, high){
        const pivot = devices[high];
        let i = low;

        for (let j = low; j < high; j++){
            const x = devices[i];
            const sortPred = sortPreds[sortOn];

            if (sortPred(devices[j], pivot)) {
                devices[i] = devices[j];
                devices[j] = x;
                i++;
            }
        }
        let temp = devices[i];
        devices[i] = devices[high];
        devices[high] = temp;
        return i;
    }

    if (low < high){
        const p = partition(devices, low, high);
        quickSort(devices, low, p - 1, sortOn);
        quickSort(devices, p + 1, high, sortOn);
    }
}

 function sortOnErrors(devices){
    quickSort(devices, 0, devices.length - 1, "errors");
}

function sortDevices(devices){
    // sort devices by online status and lexicographical order
    // "partition" the devices by online status.
    function partitionOnline(devices){
        let pivot = 0; // divider between on- and offline devices.
        let i = 0;

        while (i < devices.length){
            const x = devices[i];

            // place device in the "online partition" if online.
            if(x.isOnline){
                devices[i] = devices[pivot];
                devices[pivot] = x;
                pivot++;
            }  // else leave device in "offline partition"
            i++;
        }
        // returns deviceList and the index that divides on- and offline.
        return pivot;
    }
 
    const pivot = partitionOnline(devices);
    // sort the online and offline devices separately by lexicographical order.
    quickSort(devices, 0, pivot - 1);
    quickSort(devices, pivot, devices.length - 1);
}
