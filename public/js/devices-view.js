// append devices to div: deviceList.
export function drawDevices(devices){

    for (let i = 0; i < devices.length; i++){
        // device object must contain: {string name, String id, String routerType, bool isOnline, list links}
        const deviceDiv = $(
            `<a class="device p-0 list-group-item list-group-item-action flex-column align-items-start ${devices[i].routerType}" id="${devices[i].id}">
                <div class="d-flex w-100 justify-content-between align-items-center"> 
                    <h6 class="font-weight-normal deviceName m-3">${formatDeviceStatusBall(devices[i].isOnline)} ${devices[i].name}</h6>
                    <small class="routerType mr-4">${devices[i].routerType}</small>
                </div>
            </a>`
            );

        $(".deviceList").append(deviceDiv);
    }
}

function formatDeviceStatusBall(isOnline){
    return `<b class='bullet ${isOnline ? "online" : "offline"} mr-2'>&#9679</b>`;
}

export function drawUserSession(username, email, permissions){
    const userType = (permissions.agents_access_all ? "Toegang tot Ewon en Ixon" : "Reguliere Gebruiker");
    
    $(".user-session .name").text(username);
    $(".user-session .email").text(email);
    $(".user-session .userType").text(userType);
}

// = device view with links and dashboardlinks.
export function showDeviceModal(device){
 

    // list row format in device modal.
    function formatDeviceLink(name, link, isDashboard=false){
        const icon = 
            `<i class="material-icons mr-2">
                ${isDashboard ? "dashboard" : "screen_share"}
            </i>`;
        return $(
            `<a class="deviceLink font-weight-normal list-group-item list-group-item-action d-flex flex-row left justify-content-between 
            align-items-center border-bottom-0" target="_blank" ${link === null ? null : `href=${link}`}>
                <div class=" d-flex justify-content-center">
                    ${icon}${name}
                </div>
                <i class="material-icons">
                    arrow_right
                </i>
            </a>`);
    }

    $("#deviceModal .deviceName").text(device.name);
    $("#deviceModal .deviceName").append(formatDeviceStatusBall(device.isOnline));
    $(".linkList").empty();
    $(".dashboardList").empty();
    $(".vncHeader").show();
    // hide dashboardHeader
    $(".dashboardHeader").removeClass("d-flex");
    $(".dashboardHeader").addClass("d-none");


    // vnc links
    // Display "error message" if there are no links available.
    if (device.links.length === 0) {
        const message = $(
            `<div class='text-center px-5 pt-3 pb-5'>
                <i class="material-icons mb-2 md-36">
                    info
                </i>
            <h6>Er zijn geen apparaten beschikbaar.</h6>`);

        $(".vncHeader").hide();
        $(".linkList").append(message);
    } 
    else {
        for (let deviceLink of device.links){
            $(".linkList").append(formatDeviceLink(deviceLink.name, deviceLink.url));
        }
    }
    // data monitors (actual dashboards)
    if (device.dataMonitors.length > 0 || device.dataReports.length > 0) {
        // show dashboardHeader
        $(".dashboardHeader").removeClass("d-none");
        $(".dashboardHeader").addClass("d-flex");

        for (let dataMonitor of device.dataMonitors){
            $(".dashboardList").append(formatDeviceLink(dataMonitor.name, dataMonitor.url, true));
        }
        for (let dataReport of device.dataReports){
            $(".dashboardList").append(formatDeviceLink(dataReport.name, dataReport.url, true));
        }
    }
    $("#deviceModal").modal("show");
}


// filter devices based on search query and radio buttons for device filter
// called on every query change or scope filter change.
// The function is now based on the information on view. 
export function filterDevices(devices){
    let query = $("#deviceSearch").val();
    query = query.toLowerCase();
    query = query.trim();

    if (query.length === 0){
        $(".cancelSearch").hide();
    } else {
        $(".cancelSearch").show();
    }

    // filter on device selector (all, ixon, ewon)
    let deviceFilter = $("#filter-device option:selected").val();
    if (deviceFilter.length > 0) deviceFilter = `.${deviceFilter}`;

    // filter on status (all, online, offline)
    let filterStatus = $("#filter-status option:selected").val();
    let filterSetOnline = null;
    if (filterStatus === "online"){
        filterSetOnline = true;
    } else if (filterStatus === "offline"){
        filterSetOnline = false;
    }

    $(".device").hide();
    // show only filtered devices (ixon, ewon, all)
    $(`.device${deviceFilter}`).show();

    for (let device of devices){
        const name = device.name.toLowerCase();
        // hide devices for which the query is not a substring in the device name.
        if (!name.includes(query)){
            $(`#${device.id}`).hide();
            continue;
        }
        // filter on online status
        if (filterSetOnline !== null && (filterSetOnline !== device.isOnline)){
            $(`#${device.id}`).hide(); // hide device if filter and status do not match.
        }
    }

    // show message when no devices are shown.
    if (!$(".device").is(":visible")){
        $("#noDevices").removeClass("d-none");
    } else {
        $("#noDevices").addClass("d-none");
    }
}

