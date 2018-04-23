let fs = require('fs');
function getFiles(fileLocation) {
    var done = false;
    var count = 0;
    var fileNames = [];
    fs.readdir(fileLocation, (err, files) => {
        if(files){
        files.forEach(file => {
            fileNames.push(file);
            count = count + 1;
        })
        done = true;
    }
    done = true;

    });
    require('deasync').loopWhile(function () {
        return !done;
    });
    return fileNames;
}

module.exports.getFileNames = getFiles;