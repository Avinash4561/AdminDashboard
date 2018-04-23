let csv = require("fast-csv");
let fs = require("fs");
let csvWriter = require("csv-write-stream");
function csvWriteAndRead(fileName, header, newData, isWarning) {
    let writer = csvWriter({ headers: header });
    let stream = fs.createReadStream(fileName);
    var CSVData = [];
    var newDataFlag = true;
    var csvStream = csv().on("data", function (data) {
        if (newDataFlag) {
            if (isWarning) {
                CSVData.push(data);
                for (var index = 0; index < newData.length; index++) {
                    CSVData.push(newData[index]);
                }
            }
            else {
                CSVData.push(data);
                CSVData.push(newData);
            }
            newDataFlag = false;
        } else {
            CSVData.push(data);
        }
        if (isWarning) {
            for (var index = 0; index < newData.length; index++) {
            }
        }
    }).on("end", function () {
        writer.pipe(fs.createWriteStream(fileName));

        for (var arrayCSV in CSVData) {
            if (CSVData[parseInt(arrayCSV) + 1] != undefined) {
                if (isWarning) {
                    writer.write([String(CSVData[parseInt(arrayCSV) + 1])]);
                }
                else {
                    writer.write(CSVData[parseInt(arrayCSV) + 1]);

                }
            }
        }
    }
        );

    stream.pipe(csvStream);
}

module.exports.writeToCSV = csvWriteAndRead;
