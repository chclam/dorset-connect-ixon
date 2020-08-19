export function signInDevice(message=null){
	if(message === null) message = `Aanmelding mislukt. Probeer het nogmaals.`;

	const alertObject = getAlertObject(message, true);
	$(`.devices-request-statuses`).append(alertObject);
}

export function numberErrorsRequest(e){
	if (e.status === 401){
		const alertObject = getAlertObject("Meld u aan voor toegang tot de storingsinformatie.", true);
		$(".devices-request-statuses").append(alertObject);
	}
 	if (e.status === 502){
		const alertObject = getAlertObject("Verzoek tot storingsinformatie mislukt. Probeer uw pagina te verversen.", true);
		$(".devices-request-statuses").append(alertObject);
	}
}

export function ewonRequest(e){
	if (e.status === 401){
		const alertObject = getAlertObject("Verzoek naar Ewon mislukt. Ongeldige Ewon sessie.", true);
		$(".devices-request-statuses").append(alertObject);
	}
}

export function ixonRequest(e){
	if (e.status === 401){
		const alertObject = getAlertObject("Verzoek naar Ixon mislukt; uw sessie bij Ixon is verlopen.", true);
		$(".devices-request-statuses").append(alertObject);
	}
	if (e.status === 502){
		const alertObject = getAlertObject("Er is iets mis met de server bij Ixon. Probeer het later nogmaals.", true);
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

