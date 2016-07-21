//functions.js
//============
//
//Exports all of the custom functions required by the Discord bot.

'use strict';

module.exports = {

  getVideoId: (v) => {
    let searchToken = "?v=";
	  var i = v.indexOf(searchToken);

	  if(i == -1) {
		  searchToken = "&v=";
		  i = v.indexOf(searchToken);
	  }

	  if(i == -1) {
		  searchToken = "youtu.be/";
		  i = v.indexOf(searchToken);
	  }

	  if(i != -1) {
		  var substr = v.substring(i + searchToken.length);
		  var j = substr.indexOf("&");

		  if(j == -1) {
			  j = substr.indexOf("?");
		  }

		  if(j == -1) {
			  return substr;
		  } else {
			  return substr.substring(0,j);
		  }
	  }

	  return v;
  }

}
