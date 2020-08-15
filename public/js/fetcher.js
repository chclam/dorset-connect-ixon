async function retrieveServerData(path){
    if (typeof(path) !== "string") throw TypeError("path must be a string");

    return new Promise((resolve, reject) => {
         $.ajax({
              url: `${window.location.protocol}//${window.location.hostname}:${window.location.port}/${path}`,
                  success: (jsonData) => {
                     resolve(jsonData.data);
                 },
                 error: (error) => {
                     reject(error);
                 }
       });
    });
}

export async function getIxonUserData(){
    return await retrieveServerData("devices/ixon/user");
}

export async function getSqlErrors(){
    return await retrieveServerData("devices/ixon/recentErrors");
}

export async function getIxons(){
    return await retrieveServerData("devices/ixon");
}

export async function getEwons(){
    return await retrieveServerData("devices/ewon");
}

export async function keepAliveEwon(){
    await retrieveServerData("devices/ewon/alive");
}

