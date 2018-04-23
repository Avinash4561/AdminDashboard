let express = require('express');
let api = express.Router();
let https = require('https');
let session = require('express-session');
let mailgun = require('mailgun-js');
let moment = require('moment-timezone');
let sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./model/testDB.db');
let csvReadAndWrite = require("./csvReadAndWrite.js");
let getFiles = require('./getFiles.js');
let request = require('request');
let consts = require('../config/consts.js');

api.get('/canvas_status', function (req, res) {
    request.get({
        url: "http://status.instructure.com/",
        json: true
    }, function (error, response, responseBody) {
        if (error) {
            return res.status(404).send({ message: "Something went wrong" });
        } else {
            if (responseBody && responseBody.components && responseBody.components.length) {
                res.status(200).send({ status: responseBody.components[0].status })
            } else {
                return res.status(404).send({ message: "Something went wrong" });
            }

        }
    });
});

api.get('/update_settings', function (req, res) {
    console.log(req.query.timeZone);
    var server = require("../admindashboard");
    server.restart(req);
    db.serialize(function () {
        db.run("UPDATE SETTINGS SET timeZone = ?,timeInterval = ?,emailId = ?", [req.query.timeZone, req.query.timeInterval, req.query.emailId], function (row) {
            res.redirect('/admindashboard/request');
        });
    });    
});

api.all('/', function (req, res) {
    console.log("**** Welcome to Canvas AdminDashboard ****");

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

    let date = new Date();

    Interval = consts.defaultTimeInterval;
    zone = consts.defaultZone;
    EmailId = consts.defaultEmailId;

    db.serialize(function () {
        //db.run("DROP TABLE SETTINGS");
        //db.run("INSERT INTO SETTINGS VALUES (?,?,?)",[consts.defaultZone, consts.defaultTimeInterval, consts.defaultEmailId]);
        db.each("SELECT * FROM SETTINGS", function (err, row) {
            if (!row) {                
                db.run("INSERT INTO SETTINGS VALUES (?,?,?)",
                    [consts.defaultZone, consts.defaultTimeInterval, consts.defaultEmailId], function (row) {
                        Interval = consts.defaultTimeInterval;
                        zone = consts.defaultZone;
                        EmailId = consts.defaultEmailId;
                        module.exports.timeInterval = consts.defaultTimeInterval;
                        module.exports.timeZone = consts.defaultZone;
                        module.exports.email = consts.defaultEmailId;
                    });
            } else {
                Interval = row.timeInterval;
                zone = row.timeZone;
                EmailId = row.emailId;
                module.exports.timeInterval = row.timeInterval;
                module.exports.timeZone = row.timeZone;
                module.exports.email = row.emailId;
            }
        });
    });

    //db.close();
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

            let logFilesLoction = "./admindashboard_assets/logFiles/";
            let userFilesLocatiion = "./admindashboard_assets/warningFiles/users/";
            let enrollmentFilesLocation = "./admindashboard_assets/warningFiles/enrollments/";
            let courseFilesLocation = "./admindashboard_assets/warningFiles/courses/";
            let sectionFilesLocation = "./admindashboard_assets/warningFiles/sections/";
            let logFiles = [];
            let userFiles = [];
            let enrollmentFiles = [];
            let courseFiles = [];
            let sectionFiles = [];
            logFiles = getFiles.getFileNames(logFilesLoction);
            userFiles = getFiles.getFileNames(userFilesLocatiion);
            enrollmentFiles = getFiles.getFileNames(enrollmentFilesLocation);
            courseFiles = getFiles.getFileNames(courseFilesLocation);
            sectionFiles = getFiles.getFileNames(sectionFilesLocation);

            var rses = String(enrollments);

            res.render("index", {
                time: time, fail: fail,
                enrollmentsname: enrollments, courses: courses,
                users: users, section: status, recordCount: recordCount,
                errors: errors, startdate: startdate, enddate: enddate,
                file: file, filewarning: filewarning, 
                timeintervaldisplay: Interval, zonedisplay: zone, emailDisplay: EmailId,
                logLink: logFiles,
                userWarningsLink: userFiles, courseWarningsLink: courseFiles,
                sectionWarningsLink: sectionFiles, enrollmentWarningsLink: enrollmentFiles,
                baseURI: consts.clientHost

            });
            // res.send(time);
        });
    }
    var tempReq2 = https.request(options2, callback2);
    tempReq2.end();

});

module.exports = api;
