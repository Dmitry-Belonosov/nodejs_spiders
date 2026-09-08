var http = require("http");
const url = require('url');
var fs = require("fs");
const csv = require('csv-parser');


var Client = require('ssh2').Client;

// Credentials come from the environment, never from this file. The spider
// platform passes its own .env through; for a standalone run, export them:
//   SFTP_PASSWORD=... node very_matched.js
if (!process.env.SFTP_PASSWORD && !process.env.SFTP_PASS) {
    console.error('SFTP_PASSWORD is not set — export it before running this script');
    process.exit(1);
}
var connSettings = {
    host: process.env.SFTP_HOST || 'sftp.competitormonitor.com',
    port: parseInt(process.env.SFTP_PORT || '2222', 10),
    username: process.env.SFTP_USERNAME || process.env.SFTP_USER || 'external_data',
    password: process.env.SFTP_PASSWORD || process.env.SFTP_PASS
};

function get_matched_from_sftp()
{
    var conn = new Client();
    conn.on('ready', function() {
        console.log('Client :: ready');
        var sftp_folder="Very (AO)/Very Matched.csv";
        var local_folder="Very Matched.csv";
        conn.sftp(function(err, sftp) {
            sftp.fastGet(sftp_folder, local_folder, {}, function(err) {
                if (err) throw err;
                console.log('File downloaded successfully');
            });
        });


    }).connect(connSettings);
}
setInterval(get_matched_from_sftp, 1000*60*60); // every 1 hour


function upload_matched_to_sftp()
{

}

function crawler()
{
    var state=[];
    var state_hash={};
    var results=[];

    function clear_all()
    {

    }
    function csv()
    {

    }
    function scrap(num)
    {

    }

    fs.createReadStream('Very Matched.csv')
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            console.log('Finished reading CSV:');
            //console.log(results);
            for(var i=0;i<results.length;i++)
            {
                if(state_hash[results[i].URL])
                {
                    continue;
                }
                state.push({time:0,status:"pending",data:results[i].URL});
                state_hash[results[i].URL] = true;
            }
            console.log("total url: "+results.length);
            console.log("state: "+state.length);
            scrap(0);
        });
}
crawler();



var crawler_running=false;
var crawler_file_name="";
function scheduler()
{

}

setInterval(scheduler, 1000);




http.createServer(async function(request, response){
	
  var requestUrl = url.parse(request.url);
  var path = requestUrl.pathname;
  var parts = path.split("/");


  


  if(parts[1]=="save_cook")
  {
  	if(request.method == 'POST')
	{
	    var body = '';
	    request.on('data', function (data) {
	        body += data; 
	    });
	    request.on('end', async function () {
            for(var i=1;i<=3000;i++)
            {
                if(!fs.existsSync("cook/"+i+".json"))
                {
                    fs.writeFileSync("cook/"+i+".json", body);
                    break;
                }
            }
            response.writeHead(200,  { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            response.end(JSON.stringify({}), "utf-8"); 
        });
    }
    else
    {
        response.writeHead(200,  { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        response.end(JSON.stringify({}), "utf-8"); 	
    }
  }

  else if(parts[1]=="progress")
  {
    var total=0;
    for(var i=1;i<=1000;i++)
    {
        if(fs.existsSync("cook/"+i+".json"))
        {
            total++;
        }
    }
    response.writeHead(200,  { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    response.end(JSON.stringify({total_cook:total}), "utf-8");     
  }


}).listen(7575);