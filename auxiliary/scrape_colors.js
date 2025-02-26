//Stealing from: https://mokole.com/palette.html



function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getit(num)
{
    let colors = [
        [],
        ["#0000ff"]
    ]

    for(let i = 2; i < num; i++)
    {

        let input = document.getElementById("n");
        input.value = i.toString();
    
        submit_form();

        while(true)
        {
            await sleep(1000);

            if(document.getElementsByClassName("media")[0])
            {
                break;
            }
        }

        let med = document.getElementsByClassName("media")[0];
        let xout = med.getElementsByClassName("delete")[0];

        let newcol = [];
        for (let box of med.getElementsByClassName("box"))
        {
            newcol.push(box.style.backgroundColor);
        }
        colors.push(newcol);

        xout.onclick();
    }

    let data = JSON.stringify(colors);

    download(data, "colors.json", "text/json")
}

function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}