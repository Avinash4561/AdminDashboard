//this function will dynamically create list times elememts <li> and appends warnings or errors to it 
function myfunction(warning, string1) {
    //will remove all the li elements created before
    $("#para").empty();
    var modal = document.getElementById('myModal for warnings and logs');
    var warn = '';

    //this loop will count the number of warning and create the required number of list elements and attaches the warnings 
    for (var i = 0; i < warning.length; i++) {
        warn = warning[i];

        //creating list element
        var node = document.createElement("LI");
        var textnode = document.createTextNode(warn);
        node.appendChild(textnode);
        document.getElementById("para").appendChild(node);
    }
    document.getElementById("modelhead").innerHTML = string1;

    // appending all the list elements to the div tag    
    document.getElementById("para").appendChild(node);
    modal.style.display = "block";

    // When the user clicks on <span> (x), close the modal
    span.onclick = function () {
        modal.style.display = "none";
    }

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}

//this function will close the model box when clicked on close option
function buttonfunction() {
    var modal = document.getElementById('myModal');
    modal.style.display = "none";
}

function error() {
    warning = JSON.stringify(errors);
    string1 = "ERROR";
    myfunction(warning, string1);
}






