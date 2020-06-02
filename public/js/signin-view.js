import * as errorHandler from "./error-handler.js"

$(document).ready(function() {
	$(".ixon .signInSubmit").click(() => {

		try {
			const username = $(".ixon .username").val();
			const password = $(".ixon .password").val();
		
			if (username.length === 0 || password.length === 0){
				throw "empty credentials";
			}
			$(".ixon .spinner-border-sm").show();

		} 
		catch (e) {
			errorHandler.signInDevice();
			$(".ixon .spinner-border-sm").hide();
			return false;
		}
	});

	const urlParams = new URLSearchParams(window.location.search);

	if (urlParams.get("signin") === "failed"){
		$("#loginModal").modal("show");
		errorHandler.signInDevice();
	}
});