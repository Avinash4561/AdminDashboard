const fs = require('fs');
const path = require('path');
const fileNames = require('./getFiles.js');
let directory = ["./admindashboard_assets/logFiles/", "./admindashboard_assets/warningFiles/users/",
    "./admindashboard_assets/warningFiles/courses/", "./admindashboard_assets/warningFiles/sections/",
    "./admindashboard_assets/warningFiles/enrollments/"];

function deleteFiles() {
    var done;
    var date = new Date();
    var day = date.getDay();
    var month = date.getMonth();
    var fileAge = 0;
    var filePath;
    var done = true;

    for (var index = 0; index < directory.length; index++) {
        filePath = fileNames.getFileNames(directory[index]);
        for(var counter = 0; counter < filePath.length; counter++){
            done = false;
            fs.stat(directory[index] + filePath[counter], function (err, stat) {
                try{                 
                        fileAge = Math.abs(stat.birthtime.getDate() - day);
                        if ((fileAge == 0 && stat.birthtime.getDate().getMonth() != date.getMonth()) ||
                            (fileAge <= 3 && stat.birthtime.getDate().getMonth() != date.getMonth())) {
                            fs.unlink(directory[index] + filePath[counter],(err) => {
                                if (err) throw err;
                              });
                            }
                    }
                    catch(err){
                        console.log('No birthtime');
                    }
                    done = true;

            
        });
        require('deasync').loopWhile(function () {
            return !done;
        });
    }
    }
}
module.exports.deleteFiles = deleteFiles;
