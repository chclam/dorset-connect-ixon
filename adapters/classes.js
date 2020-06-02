class Device {
	constructor (id, name, isOnline, routerType){
	    this.id = id;
	    this.name = name;
	    this.isOnline = isOnline;
	    this.routerType = routerType;
	    this.vncLinks = [];
	    this.dataMonitors = [];
	    this.dataReports = [];
	}
}

module.exports = {Device};