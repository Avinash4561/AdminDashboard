//node module to set required time-zone and display on the dashboard
var moment = require('moment-timezone');
var express = require('express');
var session = require('express-session');
var app = express();
var userSelectedZone = "";
var zone = "America/Chicago";

function starttime(startdate) {
  startdate = moment.tz(startdate, zone).format();
  startdate = startdate.substring(0, 10).concat(" " + startdate.substring(11, 19));
  return startdate;
}

function endtime(enddate) {
  enddate = moment.tz(enddate, zone).format();
  enddate = enddate.substring(0, 10).concat(" " + enddate.substring(11, 19));
  return enddate;
}

module.exports.start = starttime;
module.exports.end = endtime;
