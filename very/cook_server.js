var http = require("http");
const url = require('url');
var fs = require("fs");


http.createServer(async function(request, response){
	
  var requestUrl = url.parse(request.url);
  var path = requestUrl.pathname;
  var parts = path.split("/");

  if(parts[1]=="save")
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
    response.end(JSON.stringify({total:total}), "utf-8");     
  }


}).listen(5555);