var http = require("http");
const fs = require('fs');
const url = require('url');

const dataDir = "data";
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

var data_raw = fs.readFileSync("urls.json", { encoding: 'utf8', flag: 'r' });
var data = JSON.parse(data_raw);

var state = [];

for (var i = 0; i < data.length; i++) {
    state.push({ "time": 0, "status": "pending", data: data[i] });
}

console.log("state: " + state.length);
var base_index = 0;

http.createServer(async function(request, response){
    var requestUrl = url.parse(request.url);
    var path = requestUrl.pathname;
    var parts = path.split("/");
    if(parts[1]=="get")
    {
        var found=false;
        var dd=new Date().getTime();
        var no_pending=true;
		var items=[];
        for(var i=base_index;i<state.length;i++)
        {
            var dif=dd-state[i].time;

            if(state[i].status=="pending")
            {
                no_pending=false;
            }
            if(no_pending)
            {
                base_index=i;
            }

            if(dif>1000*30)
            //if(dif>0)
            {
                //console.log(state[i].status);
                if(state[i].status=="pending")
                {
                    
                    if(fs.existsSync("data/"+i+".json"))
                    {
                        state[i].status="complete";
                    }
                    else
                    {
                        state[i].time=dd;//-30000;
                        found=true;
						
						items.push({ind:i,data:state[i].data});
                        response.writeHead(200,  { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    	                response.end(JSON.stringify({ind:i,data:state[i].data}), "utf-8"); 
                        break;
                    }
                }                           
            }
        }        

        if(!found)
        {
            response.writeHead(200,  { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    	    response.end(JSON.stringify({}), "utf-8");
        }
    } 
    else if(parts[1]=="save")
    {
        if(request.method == 'POST')
		{
            var body = '';
            request.on('data', function (data) {
                body += data; 
            });
            request.on('end', async function () {
                var data=body;
                var items=JSON.parse(data);             
                //console.log(obj);
				//for(var i=0;i<items.length;i++)
				{
					//console.log(items[i]);
					var obj=items;
					var ind=obj.ind;
					var data=obj.html;
					if(obj.html)
					{
						state[ind].status="complete";
						fs.writeFileSync("data/"+ind+".json", JSON.stringify(data));
					}
				}
                response.writeHead(200,  { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
                response.end("ok");                
            });
        }
        else
        {
			response.writeHead(200,  { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
		    response.end(JSON.stringify({"success":true}), "utf-8");            
        }
    }   
    else if(parts[1]=="status")
    {
        var total=0;
        for(var i=0;i<state.length;i++)
        {
            if(state[i].status=="complete")
            {
                total++;
            }
        }
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.end(JSON.stringify({total:state.length,progress:total}));          
    }
}).listen(5050);