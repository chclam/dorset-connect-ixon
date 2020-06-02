export function signInDevice(message=null){
	// if ($(`.devices-request-statuses`).children().length > 0) return;
	if(message === null) message = `Aanmelding mislukt. Probeer het nogmaals.`;

	const alertObject = getAlertObject(message, true);
	$(`.devices-request-statuses`).append(alertObject);
}

export function ewonRequest(e){
	if (e.status === 401){
		const alertObject = getAlertObject("Verzoek naar Ewon mislukt. Ongeldige Ewon sessie.", true);
		$(".devices-request-statuses").append(alertObject);
	}
}

export function ixonRequest(e){
	if (e.status === 401){
		const alertObject = getAlertObject("Verzoek naar Ixon mislukt. Ongeldige Ixon sessie.", true);
		$(".devices-request-statuses").append(alertObject);
	}
}

function getAlertObject(alertText, dismissable=false){
	const alertObject = $(`<div class="alert alert-danger ${dismissable ? "alert-dismissible": ""} animated fadeIn mt-3" role="alert"></div>`);
	alertObject.text(alertText);
	if (dismissable){
		// close button
		alertObject.append($(`<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span>`));	
	}
	return alertObject;
}

