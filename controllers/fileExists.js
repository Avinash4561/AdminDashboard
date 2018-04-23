let fs = require("fs");
function fileExistsOrNot(fileName) {
    if (fs.existsSync(fileName)) {
        return true;
    }
    else {
        fs.createWriteStream(fileName);
        return false;
    }
}

module.exports.existOrNot = fileExistsOrNot;