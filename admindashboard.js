let http = require("http");
let https = require('https');
let path = require("path");
let express = require("express");
let bodyParser = require("body-parser");
let session = require('express-session');
let usersettings = require('./controllers/request.js')
let consts = require("./config/consts.js");
let api_key = consts.mailAPIKey;
let domain = consts.mailDomain;
let mailgun = require('mailgun-js')({ apiKey: api_key, domain: domain });
let mailID = usersettings.email;
let del = require('./controllers/deleteFiles.js');
let api = express.Router();
let moment = require('moment-timezone');
let csvReadAndWrite = require("./controllers/csvReadAndWrite.js");
let fileExists = require("./controllers/fileExists.js");
let fs = require("fs");
let logCSVWriter = require("csv-write-stream");
let warningCSVWriter = require("csv-write-stream");
let getFiles = require('./controllers/getFiles.js');
var xl = require('./controllers/Excel');
// create express app 
var app = express();

// set up the view engine
app.set("views", path.resolve(__dirname, "views")); // path to views

app.set("view engine", "ejs"); // specify our view engine

// specify various resources and apply them to our application
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/'));

app.use(express.static('admindashboard/admindashboard_assets'));  // works for views in root view folder
app.use(express.static('/storage/'));

app.use(express.static(__dirname + '/storage/'));
app.use(express.static(__dirname + '/admindashboard_assets/'));  // works for views in root view folder
//app.use(express.static(__dirname + '/storage/'));

var value = "*";
var SelectedTimeInterval;
var email;
var zone;
var minutes = "00";
var hours = "0-23";

//using cron module to run the application as a webservice at the time interval provided.
var cron = require('cron');
let sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./model/testDB.db');
restart();
var job;
function restart(req){
  if(!req){
    SelectedTimeInterval = consts.defaultTimeInterval
    email = consts.defaultEmailId;
    zone = consts.defaultZone;
  } else {
    SelectedTimeInterval = req.query.timeInterval;
    email = req.query.emailId;
    zone = req.query.timeZone;
  }
  
  switch (SelectedTimeInterval) {
    
      case '30': minutes = "*/30";
        hours: "*";
        break;
    
      case '60': minutes = "00";
        hours = "0-23";
        break;
    
      case '120': minutes = "00";
        hours = "*/2";
        break;
    
      case '240': minutes = "00";
        hours = "*/4";
        break;
    
      case '360': minutes = "00";
        hours = "*/6";
        break;
    
      case '480': minutes = "00";
        hours = "*/8";
        break;
    }    
    
    if(job && job.running){        
        job.stop()
    }
    job = new cron.CronJob('00' + minutes + ' ' + hours + ' ' + '* * *', function () {
      var enrollments = [];	        /*to hold enrollments warnings*/
      var users = [];		            /*to hold users warnings*/
      var status = [];	            /*to hold section warnings*/
      var courses = [];	            /*to hold courses warnings*/
      var fail = false;		        /* to know it there are any errors */
      var errors = [];		        /* to hold errors*/
      var startdate;		            /*to hold start date of new files ike accounts term etc*/
      var enddate;		            /*to hold end date of new file */
      var file = '';		            /* to hold the name of the new file*/
      var filewarning = [];	        /* to hold warnings of new file */
      var coursetime = true;      	/* acts like flag for course start time*/
      var enrollmentstime = true; 	/* acts like flag for enrollments start time*/
      var usertime = true;        	/* acts like flag for user start time*/
      var sectionstime = true;	    /* acts like flag for  section time*/
      var coursewarning = true;	    /* acts like flag for course warnings*/
      var enrollmentwarning = true;	/* acts like flag for enrollments warnings*/
      var userwarning = true;	        /* acts like flag for user warnings*/
      var sectionwarning = true;	    /* acts like flag for section warnings*/
      var logFileExists = true;
      var warningsFileExists = false;
    
      var options2 = {
        host: consts.globalHost,
        path: consts.globalPath + consts.adminAccessToken

    };
    var json_data = ""; /* json_data will hold the json data*/
    var callback2 = function (response2) {
        response2.on('data', function (chunk) {
            json_data += chunk;

        });
        response2.on('end', function () {
            json_data = JSON.parse(json_data);

            for (var i = 0; i < json_data.sis_imports.length; i++) {
                var recordCount = {
                    countusers: 0,
                    countcourses: 0,
                    countenrollments: 0,
                    countsection: 0
                }

                //retreiving start and end date from JSON if there is a error
                startdate = String(json_data.sis_imports[i].started_at);
                enddate = String(json_data.sis_imports[i].ended_at);

                // this condition will execute when the 1st batch has errors, this will get all the warnings and store in errors array 
                if (json_data.sis_imports[i].workflow_state === "failed_with_messages") {

                    recordCount = {
                        countusers: json_data.sis_imports[i].data.counts.users,
                        countcourses: json_data.sis_imports[i].data.counts.courses,
                        countenrollments: json_data.sis_imports[i].data.counts.enrollments,
                        countsection: json_data.sis_imports[i].data.counts.sections
                    }

                    fail = true;

                    errors = json_data.sis_imports[i].processing_errors.slice(0);
                    break;
                }

                //If the uploaded file is not a courses users enrollements and sections file this code executes 
                if (json_data.sis_imports[i].data.supplied_batches[0] != "enrollment" && json_data.sis_imports[i].data.supplied_batches[0] != "course" && json_data.sis_imports[i].data.supplied_batches[0] != "user" && json_data.sis_imports[i].data.supplied_batches[0] != "section") {
                    // to the the new file name
                    
                    var recordCount = {
                        countusers: json_data.sis_imports[i].data.counts.users,
                        countcourses: json_data.sis_imports[i].data.counts.courses,
                        countenrollments: json_data.sis_imports[i].data.counts.enrollments,
                        countsection: json_data.sis_imports[i].data.counts.sections
                    }
                    file = json_data.sis_imports[i].data.supplied_batches;
                    //if it has warnings this contidion will execute and store warnings in filewarning array
                    if (json_data.sis_imports[i].workflow_state === "imported_with_messages")
                        if (json_data.sis_imports[i].processing_warnings != "undefined") {

                        } else {
                            filewarning = ((json_data.sis_imports[i].processing_warnings).slice(0))
                        }

                    break;
                }

                // this condition will execute when there are no warnings or errors in first bath and it will set the warnings flag of all files present in this batch
                if (json_data.sis_imports[i].workflow_state == "imported") {

                    var recordCount = {
                        countusers: json_data.sis_imports[i].data.counts.users,
                        countcourses: json_data.sis_imports[i].data.counts.courses,
                        countenrollments: json_data.sis_imports[i].data.counts.enrollments,
                        countsection: json_data.sis_imports[i].data.counts.sections
                    }
                    for (var j = 0; json_data.sis_imports[i].data.supplied_batches.length > j; j++) {
                        if (json_data.sis_imports[i].data.supplied_batches[j] == "enrollment")
                            enrollmentwarning = false;
                        if (json_data.sis_imports[i].data.supplied_batches[j] == "course") {
                            coursewarning = false

                        }
                        if (json_data.sis_imports[i].data.supplied_batches[j] == "section")
                            sectionwarning = false;
                        if (json_data.sis_imports[i].data.supplied_batches[j] == "user")
                            userwarning = false;

                    }

                }

                //If the latest batch has warnings in it this code will be executed and store the warnings in respected array
                if (json_data.sis_imports[i].workflow_state == "imported_with_messages") {

                    var recordCount = {
                        countusers: json_data.sis_imports[i].data.counts.users,
                        countcourses: json_data.sis_imports[i].data.counts.courses,
                        countenrollments: json_data.sis_imports[i].data.counts.enrollments,
                        countsection: json_data.sis_imports[i].data.counts.sections
                    }

                    //If the latest batch has only single file in it this code will be executed
                    if (json_data.sis_imports[i].data.supplied_batches.length === 1) {

                        // temp1 is the JSON object it contais data about fine name like courses or users etc    
                        var temp1 = {
                            supplied_batches: json_data.sis_imports[i].data.supplied_batches
                        }


                        if (temp1.supplied_batches == "enrollment")
                            enrollments = ((json_data.sis_imports[i].processing_warnings).slice(0));
                        if (temp1.supplied_batches == "course") {

                            courses = (json_data.sis_imports[i].processing_warnings).slice(0);
                        }
                        if (temp1.supplied_batches == "section")
                            status = (json_data.sis_imports[i].processing_warnings).slice(0)
                        if (temp1.supplied_batches == "user")
                            users = (json_data.sis_imports[i].processing_warnings).slice(0)



                    }
                    //If the uploaded batch has multiple files "else" will be executed and stores warnings in there relative array 
                    else {
                        for (j = 0; j < json_data.sis_imports[i].processing_warnings.length; j++)
                            for (k = 0; k < json_data.sis_imports[i].processing_warnings[j].length; k++)

                                if (json_data.sis_imports[i].processing_warnings.length > 0) {
                                    if (json_data.sis_imports[i].processing_warnings[j][k].includes("enrollment") ) {

                                        enrollments.push(json_data.sis_imports[i].processing_warnings[j][k + 1])

                                        k = k + 1;
                                    }
                                    if (json_data.sis_imports[i].processing_warnings[j][k].includes("courses")) {

                                        courses.push(json_data.sis_imports[i].processing_warnings[j][k + 1])

                                        k = k + 1;
                                    }
                                    if (json_data.sis_imports[i].processing_warnings[j][k].includes("users")) {
                                        users.push(json_data.sis_imports[i].processing_warnings[j][k + 1])

                                        k = k + 1;
                                    }

                                    if (json_data.sis_imports[i].processing_warnings[j][k].includes("sections")) {

                                        status.push(json_data.sis_imports[i].processing_warnings[j][k + 1])

                                        k = k + 1;
                                    }
                                }
                    }

                    // this part will set flag of any file warnings to false if they have warnings loaded into them
                    if (enrollments.length > 0)
                        enrollmentwarning = false;

                    if (status.length > 0)
                        sectionwarning = false;

                    if (users.length > 0)
                        userwarning = false;

                    if (courses.length > 0)
                        coursewarning = false;

                }

                break;
            }

            var test = '';
            var myCallback = function (data, startdate) {
                startdate = moment.tz(startdate, zone).format();
                startdate = startdate.substring(0, 10).concat(" " + startdate.substring(11, 19));
                return startdate;

            };

            var usingItNow = function (callback) {
                db.serialize(function () {
                    db.each("SELECT * FROM SETTINGS", function (err, row) {
                        zone = row.timeZone;
                        callback(zone);
                    });
                });

            };


            function start(startdate) {
                startdate = moment.tz(startdate, zone).format();
                startdate = startdate.substring(0, 10).concat(" " + startdate.substring(11, 19));
                return startdate;
            }
            module.exports.starttime = start;

            function end(enddate) {
                enddate = moment.tz(enddate, zone).format();
                enddate = enddate.substring(0, 10).concat(" " + enddate.substring(11, 19));
                return enddate;
            }
            module.exports.endtime = end;

            //These variables are used to store start and end time of four files 
            var timeenrollment = '__';
            var endenrollment = '__';
            var timecourse = '__';
            var endcourse = '__';
            var timesection = '__';
            var endsection = '__';
            var timeuser = '__';
            var enduser = '__';

            //this for loop is used to get data about start time end time and warnings from all batches 
            for (var i = 0; i < json_data.sis_imports.length; i++) {
                // if there are errors in one batch we can skip it as there is no information in it 
                if (json_data.sis_imports[i].workflow_state === "failed_with_messages")
                    continue;

                else {
                    //the number of times this loop will iterate is equal to the number of files in each batch
                    for (var j = 0; j < json_data.sis_imports[i].data.supplied_batches.length; j++) {

                        //in the below lines of code we find the file name in batch and find it start and end time and set it time flag to "false"
                        if (json_data.sis_imports[i].data.supplied_batches[j] == "enrollment" && enrollmentstime == true) {
                            var timeenrollment = start(json_data.sis_imports[i].created_at);
                            if (json_data.sis_imports[i].ended_at == null) {
                                var endenrollment = "In Progress";
                            } else {
                                endenrollment = end(json_data.sis_imports[i].ended_at);
                            }

                            enrollmentstime = false;
                        }

                        if (json_data.sis_imports[i].data.supplied_batches[j] == "course" && coursetime == true) {

                            var timecourse = start(json_data.sis_imports[i].created_at);
                            if (json_data.sis_imports[i].ended_at === null) {
                                var endcourse = "In Progress";
                            } else {
                                endcourse = end(json_data.sis_imports[i].ended_at);
                            }

                            coursetime = false;
                        }

                        if (json_data.sis_imports[i].data.supplied_batches[j] == "section" && sectionstime == true) {

                            var timesection = start(json_data.sis_imports[i].created_at);
                            if (json_data.sis_imports[i].ended_at == null) {
                                var endsection = "In Progress";
                            } else {
                                endsection = end(json_data.sis_imports[i].ended_at);
                            }

                            sectionstime = false;
                        }

                        if (json_data.sis_imports[i].data.supplied_batches[j] == "user" && usertime == true) {

                            var timeuser = start(json_data.sis_imports[i].created_at);
                            if (json_data.sis_imports[i].ended_at == null) {
                                var enduser = "In Progress";
                            } else {
                                enduser = end(json_data.sis_imports[i].ended_at);
                            }

                            usertime = false;
                        }
                    }

                    // this condition will execute and find which files are there in batch with out any warnings
                    if (json_data.sis_imports[i].workflow_state == "imported") {
                        for (var j = 0; json_data.sis_imports[i].data.supplied_batches.length > j; j++) {
                            if (json_data.sis_imports[i].data.supplied_batches[j] == "enrollment")
                                enrollmentwarning = false;
                            if (json_data.sis_imports[i].data.supplied_batches[j] == "course") {
                                coursewarning = false
                            }
                            if (json_data.sis_imports[i].data.supplied_batches[j] == "section")
                                sectionwarning = false;
                            if (json_data.sis_imports[i].data.supplied_batches[j] == "user")
                                userwarning = false;
                        }
                    }
                    else {
                        //this code is used to get warnings from previous batches 
                        if (json_data.sis_imports[i].workflow_state == "imported_with_messages") {

                            if (json_data.sis_imports[i].data.supplied_batches.length === 1) {
                                var temp1 = {
                                    importID: json_data.sis_imports[i].id,
                                    supplied_batches: json_data.sis_imports[i].data.supplied_batches
                                }

                                if (temp1.supplied_batches == "enrollment" && enrollmentwarning == true)
                                    enrollments = ((json_data.sis_imports[i].processing_warnings).slice(0));
                                if (temp1.supplied_batches == "course" && coursewarning == true) {

                                    courses = (json_data.sis_imports[i].processing_warnings).slice(0);
                                }
                                if (temp1.supplied_batches == "section" && sectionwarning == true)
                                    status = (json_data.sis_imports[i].processing_warnings).slice(0)
                                if (temp1.supplied_batches == "user" && userwarning == true)
                                    users = (json_data.sis_imports[i].processing_warnings).slice(0)
                            }

                            else {
                                if (json_data.sis_imports[i].processing_warnings === "undefined") {
                                    for (j = 0; j < json_data.sis_imports[i].processing_warnings.length; j++)
                                        for (k = 0; k < json_data.sis_imports[i].processing_warnings[j].length; k++)

                                            if (json_data.sis_imports[i].processing_warnings.length > 0) {
                                                if (json_data.sis_imports[i].processing_warnings[j][k].includes("enrollments") && enrollmentwarning == true) {
                                                    enrollments.push(json_data.sis_imports[i].processing_warnings[j][k + 1])

                                                    k = k + 1;
                                                }
                                                if (json_data.sis_imports[i].processing_warnings[j][k].includes("courses") && coursewarning == true) {
                                                    courses.push(json_data.sis_imports[i].processing_warnings[j][k + 1])

                                                    k = k + 1;
                                                }
                                                if (json_data.sis_imports[i].processing_warnings[j][k].includes("users") && userwarning == true) {
                                                    users.push(json_data.sis_imports[i].processing_warnings[j][k + 1])

                                                    k = k + 1;
                                                }
                                                if (json_data.sis_imports[i].processing_warnings[j][k].includes("sections") && sectionwarning == true) {
                                                    status.push(json_data.sis_imports[i].processing_warnings[j][k + 1])

                                                    k = k + 1;
                                                }
                                            }
                                }
                            }

                            //setting warnings flags if files have warnings in them 
                            if (enrollments.length > 0)
                                enrollmentwarning = false;

                            if (status.length > 0)
                                sectionwarning = false;

                            if (users.length > 0)
                                userwarning = false;

                            if (courses.length > 0)
                                coursewarning = false;
                        }
                    }
                }
            }

            //JSON object to hold time of all four files 
            var time = {
                timeenrollment: timeenrollment,
                endenrollment: endenrollment,
                timecourse: timecourse,
                endcourse: endcourse,
                timesection: timesection,
                endsection: endsection,
                timeuser: timeuser,
                enduser: enduser
            }
    
          //getting the system date and time
          var todays_date = new Date();
          var todays_day = todays_date.getDay();
          var current_minute = todays_date.getMinutes();
          var current_hour = todays_date.getHours();
          var stored_hour = current_hour;
    
          let date = new Date();
          let logHeader = ["CanvasID", "Started_At", "Ended_At",
            "Selected_Time_Zone", "WorkFlow_State", "Enrollments", "Courses", "Users", "Sections"];
          let usersWarningHeader = ["Warnings in Users"];
          let coursesWarningHeader = ["Warnings in courses"];
          let sectionsWarningHeader = ["Warnings in sections"];
          let enrollmentsWarningHeader = ["Warnings in enrollments"];
          let logWriter = logCSVWriter({ headers: logHeader });
          let usersWarningWriter = warningCSVWriter({ headers: usersWarningHeader });
          let coursesWarningWriter = warningCSVWriter({ headers: coursesWarningHeader });
          let sectionsWarningWriter = warningCSVWriter({ headers: sectionsWarningHeader });
          let enrollmentsWarningWriter = warningCSVWriter({ headers: enrollmentsWarningHeader });
    
          
          
          let logCanvasID = String(json_data.sis_imports[0].id);
          let logCreatedAt = String(json_data.sis_imports[0].created_at);
          let logStartedAt = String(moment.tz(String(json_data.sis_imports[0].started_at), zone).format());
          let logUpdatedAt = String(json_data.sis_imports[0].updated_at);
          let logEndedAt = String(moment.tz(String(json_data.sis_imports[0].ended_at), zone).format());
          let logWorkflowState = String(json_data.sis_imports[0].workflow_state);
          let logProgress = String(json_data.sis_imports[0].progress);
          let logEnrollments = String(json_data.sis_imports[0].data.counts.enrollments);
          let logCourses = String(json_data.sis_imports[0].data.counts.courses);
          let logUsers = String(json_data.sis_imports[0].data.counts.users);
          let logSections = String(json_data.sis_imports[0].data.counts.sections);
    
          let newLogData = [logCanvasID, logStartedAt, logEndedAt, zone, logWorkflowState,
            logEnrollments, logCourses, logUsers, logSections];
            var processing_warnings = json_data.sis_imports[0].processing_warnings;
          var processing_errors = json_data.sis_imports[0].processing_errors;
          var coursesWarnings = [];
          var sectionWarnings = [];
          var enrollmentWarnings = [];
          var userWarnings = [];
          var mailGunBody = "";

          
            if(processing_warnings!=undefined){
              for(var index = 0; index < processing_warnings.length;index++){
                var content = processing_warnings[index][0];
              if(processing_warnings[index][0].includes("courses")){
                coursesWarnings.push(processing_warnings[index][1]);
               
              }
              else if(processing_warnings[index][0].includes("sections")){
                sectionWarnings.push(processing_warnings[index][1]);
              }
              else if(processing_warnings[index][0].includes("enrollments")){
                enrollmentWarnings.push(processing_warnings[index][1]);
              }
              else if(processing_warnings[index][0].includes("users")){
                userWarnings.push(processing_warnings[index][1]);
              }
  
            }
            }
            else if(processing_errors!=undefined){
              for(var index = 0; index < processing_errors.length;index++){
            mailGunBody = processing_errors[index][1];
              }
  
            }
    
    
            let idWarnings = json_data.sis_imports[1].id;
            let newUsersWarningData = userWarnings;
            let newCoursesWarningData = coursesWarnings;
            let newSectionWarningData = sectionWarnings;
            let newEnrollmentWarningData = enrollmentWarnings;
          let logFileName = "./admindashboard_assets/logFiles/" + moment().format("MM-DD-YYYY") + "_logs.csv";
          let usersWarningsFileName = "./admindashboard_assets/warningFiles/users/" + moment().format("MM-DD-YYYY") + "_userWarnings_" + logCanvasID + ".csv";
          let coursesWarningsFileName = "./admindashboard_assets/warningFiles/courses/" + moment().format("MM-DD-YYYY") + "_coursesWarnings_" + logCanvasID + ".csv";
          let sectionsWarningsFileName = "./admindashboard_assets/warningFiles/sections/" + moment().format("MM-DD-YYYY") + "_sectionsWarnings_" + logCanvasID + ".csv";
          let enrollmentsWarningsFileName = "./admindashboard_assets/warningFiles/enrollments/" + moment().format("MM-DD-YYYY") + "_enrollmentsWarnings_" + logCanvasID + ".csv";
          
          
          
          if (fileExists.existOrNot("" + logFileName)) {
            //console.log("FIle exists :" + newLogData);
            csvReadAndWrite.writeToCSV("" + logFileName, logHeader, newLogData, false);
    
          }
          else {
            //console.log("no file : " + newLogData);
            logWriter.pipe(fs.createWriteStream("" + logFileName));
            logWriter.write(newLogData);
    
          }
          if (String(newUsersWarningData) != "") {
            mailGunBody += "User warnings : " + moment().format("MM-DD-YYYY ") +
              "_userWarnings_" + logCanvasID + ".csv" + "\n Start Time : " + logStartedAt + "\n";
            if (fileExists.existOrNot("" + usersWarningsFileName)) {
              csvReadAndWrite.writeToCSV("" + usersWarningsFileName, usersWarningHeader, newUsersWarningData, true);
            }
            else {
    
              var writeStream = fs.createWriteStream("" + usersWarningsFileName);
              usersWarningWriter.pipe(writeStream);
              usersWarningWriter.write("");
              csvReadAndWrite.writeToCSV("" + usersWarningsFileName, usersWarningHeader, newUsersWarningData, true);
            }
          }
          if (String(newSectionWarningData) != "") {
            mailGunBody += "Section warnings : " + moment().format("MM-DD-YYYY ") +
              "_sectionWarnings_" + logCanvasID + ".csv" + "\n Start Time : " + logStartedAt + "\n";
            if (fileExists.existOrNot("" + sectionsWarningsFileName)) {
              csvReadAndWrite.writeToCSV("" + sectionsWarningsFileName, sectionsWarningHeader, newSectionWarningData, true);
            }
            else {
    
              var writeStream = fs.createWriteStream("" + sectionsWarningsFileName);
              sectionsWarningWriter.pipe(writeStream);
              sectionsWarningWriter.write("");
              csvReadAndWrite.writeToCSV("" + sectionsWarningsFileName, sectionsWarningHeader, newSectionWarningData, true);
            }
          }
          if (String(newEnrollmentWarningData) != "") {
            mailGunBody += "Enrollment warnings : " + moment().format("MM-DD-YYYY ") +
              "_userWarnings_" + logCanvasID + ".csv" + "\n Start Time : " + logStartedAt + "\n";
            if (fileExists.existOrNot("" + enrollmentsWarningsFileName)) {
              csvReadAndWrite.writeToCSV("" + enrollmentsWarningsFileName, enrollmentsWarningHeader, newEnrollmentWarningData, true);
            }
            else {
    
              var writeStream = fs.createWriteStream("" + enrollmentsWarningsFileName);
              usersWarningWriter.pipe(writeStream);
              usersWarningWriter.write("");
              csvReadAndWrite.writeToCSV("" + enrollmentsWarningsFileName, enrollmentsWarningHeader, newEnrollmentWarningData, true);
            }
          }
          if (String(newCoursesWarningData) != "") {
            mailGunBody += "Course warnings : " + moment().format("MM-DD-YYYY ") +
              "_coursesWarnings_" + logCanvasID + ".csv" + "\n Start Time : " + logStartedAt + "\n";
            if (fileExists.existOrNot("" + coursesWarningsFileName)) {
              csvReadAndWrite.writeToCSV("" + coursesWarningsFileName, coursesWarningHeader, newCoursesWarningData, true);
            }
            else {
    
              var writeStream = fs.createWriteStream("" + coursesWarningsFileName);
              coursesWarningWriter.pipe(writeStream);
              coursesWarningWriter.write("");
              csvReadAndWrite.writeToCSV("" + coursesWarningsFileName, coursesWarningHeader, newCoursesWarningData, true);
            }
          }
          
          if (email != undefined) {
            var data = {
              from: consts.from,
              to: email ,
              subject: 'Canvas SIS import warnings',
              text: mailGunBody
            };
            if (mailGunBody != "") {
              mailgun.messages().send(data, function (error, body) {
                if(error){
                  console.log(error);
                }
                else{
                  console.log("Sucess");
                }
              });
            }
          }
        });
        del.deleteFiles();
      }
      var tempReq2 = https.request(options2, callback2);
      tempReq2.end();
    }, null, true, zone);
    
}
module.exports.restart = restart;

// new CronJob('* * * * * *', function () {
//   SelectedTimeInterval = usersettings.timeInterval;
//   email = usersettings.email;
//   zone = usersettings.timeZone;

//   if(!zone){
//     zone = consts.defaultZone;
//   } 
//   if(!email){
//     email = consts.defaultEmailId;
//   }
//   if(!SelectedTimeInterval){
//     SelectedTimeInterval = consts.defaultTimeInterval;
//   }

  // switch (SelectedTimeInterval) {
    
  //     case '30': minutes = "*/2";
  //       hours: "*";
  //       break;
    
  //     case '60': minutes = "00";
  //       hours = "0-23";
  //       break;
    
  //     case '120': minutes = "00";
  //       hours = "*/2";
  //       break;
    
  //     case '240': minutes = "00";
  //       hours = "*/4";
  //       break;
    
  //     case '360': minutes = "00";
  //       hours = "*/6";
  //       break;
    
  //     case '480': minutes = "00";
  //       hours = "*/8";
  //       break;
  //   }    
//   }, null, true, zone);

// Request to this URI will be handled by this CONTROLLER..........
app.use('/admindashboard', require('./controllers/authenticate'));
app.use('/admindashboard/request', require('./controllers/request'));

// set port 
app.set('port', (process.env.PORT || 4003));
app.listen(app.set('port'), function () {
  console.log('Server started art port: ' + app.get('port'));
});