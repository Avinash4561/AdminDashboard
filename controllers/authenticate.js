const express = require('express');
const api = express.Router();

// all the constants are saved on this file ... 
var consts = require('../config/consts');

api.all('/', function (req, res) {
	console.log()
	console.log('req body' + JSON.stringify(req.body.roles))
	var roleString = req.body.roles;
	let role = roleString.substring(roleString.indexOf("lis/") + 4)
	if (role == 'Administrator') {
		res.redirect('/admindashboard/request')
	}
	else {
		res.render('unauthorize')
	}

})

module.exports = api;