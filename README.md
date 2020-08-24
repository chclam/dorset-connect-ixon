# dorset-connect-ixon

Introduction
---
Dorset Connect allows you to access all your Ixon and Ewon devices in one list. Gain access to all your devices by simply signing in with your Ixon account. 

Access to Ixon and Ewon devices.
---
Access to the Ewon devices is gained by providing your sign-in information for Ewon (among other relevant information) in the config file: adapters/adapter-config.json.

Users are granted access to all devices only if the Ixon account has the permission to "Access to all devices" on the Ixon platform. 
You can verify this for your Ixon account in Users/{Username}/Permissions on the https://connect.ixon.cloud.

Deployment
---
Dorset Connect requires Node-JS. For deployment, install all NPM-dependencies using the shell script: install-npm-dependencies.sh and execute "npm run dev" on the root of the project. 
