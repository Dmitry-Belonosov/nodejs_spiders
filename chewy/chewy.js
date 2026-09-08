const fs = require('fs');
var http = require("http");
const url = require('url');



var files=[{name:"6-18-2026.csv",status:"running"},{name:"6-17-2026.csv",status:"complete"},{name:"6-16-2026.csv",status:"complete"},{name:"6-15-2026.csv",status:"complete"},{name:"6-14-2026.csv",status:"complete"},{name:"6-13-2026.csv",status:"complete"},{name:"6-12-2026.csv",status:"complete"},{name:"6-11-2026.csv",status:"complete"},{name:"6-10-2026.csv",status:"complete"},{name:"6-9-2026.csv",status:"complete"},{name:"6-8-2026.csv",status:"complete"},{name:"6-7-2026.csv",status:"complete"},{name:"6-6-2026.csv",status:"complete"},{name:"6-5-2026.csv",status:"complete"},{name:"6-4-2026.csv",status:"complete"},{name:"6-3-2026.csv",status:"complete"},{name:"6-2-2026.csv",status:"complete"},{name:"6-1-2026.csv",status:"complete"},{name:"5-31-2026.csv",status:"complete"},{name:"5-30-2026.csv",status:"complete"},{name:"5-29-2026.csv",status:"complete"},{name:"5-28-2026.csv",status:"complete"},{name:"5-27-2026.csv",status:"complete"},{name:"5-26-2026.csv",status:"complete"},{name:"5-25-2026.csv",status:"complete"},{name:"5-24-2026.csv",status:"complete"},{name:"5-23-2026.csv",status:"complete"},{name:"5-22-2026.csv",status:"complete"},{name:"5-21-2026.csv",status:"complete"},{name:"5-20-2026.csv",status:"complete"},{name:"5-19-2026.csv",status:"complete"},{name:"5-18-2026.csv",status:"complete"},{name:"5-17-2026.csv",status:"complete"},{name:"5-16-2026.csv",status:"complete"},{name:"5-15-2026.csv",status:"complete"},{name:"5-14-2026.csv",status:"complete"},{name:"5-13-2026.csv",status:"complete"},{name:"5-12-2026.csv",status:"complete"},{name:"5-11-2026.csv",status:"complete"},{name:"5-10-2026.csv",status:"complete"},{name:"5-9-2026.csv",status:"complete"},{name:"5-8-2026.csv",status:"complete"},{name:"5-7-2026.csv",status:"complete"},{name:"5-6-2026.csv",status:"complete"},{name:"5-5-2026.csv",status:"complete"},{name:"5-4-2026.csv",status:"complete"},{name:"5-3-2026.csv",status:"complete"},{name:"5-2-2026.csv",status:"complete"},{name:"5-1-2026.csv",status:"complete"},{name:"4-30-2026.csv",status:"complete"},{name:"4-29-2026.csv",status:"complete"},{name:"4-28-2026.csv",status:"complete"},{name:"4-27-2026.csv",status:"complete"},{name:"4-26-2026.csv",status:"complete"},{name:"4-25-2026.csv",status:"complete"},{name:"4-24-2026.csv",status:"complete"},{name:"4-23-2026.csv",status:"complete"},{name:"4-22-2026.csv",status:"complete"},{name:"4-21-2026.csv",status:"complete"},{name:"4-20-2026.csv",status:"complete"},{name:"4-19-2026.csv",status:"complete"},{name:"4-18-2026.csv",status:"complete"},{name:"4-17-2026.csv",status:"complete"},{name:"4-16-2026.csv",status:"complete"},{name:"4-15-2026.csv",status:"complete"},{name:"4-14-2026.csv",status:"complete"},{name:"4-13-2026.csv",status:"complete"},{name:"4-12-2026.csv",status:"complete"},{name:"4-11-2026.csv",status:"complete"},{name:"4-10-2026.csv",status:"complete"},{name:"4-9-2026.csv",status:"complete"},{name:"4-8-2026.csv",status:"complete"},{name:"4-7-2026.csv",status:"complete"},{name:"4-6-2026.csv",status:"complete"},{name:"4-5-2026.csv",status:"complete"},{name:"4-4-2026.csv",status:"complete"},{name:"4-3-2026.csv",status:"complete"},{name:"4-2-2026.csv",status:"complete"},{name:"4-1-2026.csv",status:"complete"},{name:"3-31-2026.csv",status:"complete"},{name:"3-30-2026.csv",status:"complete"},{name:"3-29-2026.csv",status:"complete"},{name:"3-28-2026.csv",status:"complete"},{name:"3-27-2026.csv",status:"complete"},{name:"3-26-2026.csv",status:"complete"},{name:"3-25-2026.csv",status:"complete"},{name:"3-24-2026.csv",status:"complete"},{name:"3-23-2026.csv",status:"complete"},{name:"3-22-2026.csv",status:"complete"},{name:"3-21-2026.csv",status:"complete"},{name:"3-20-2026.csv",status:"complete"},{name:"3-19-2026.csv",status:"complete"},{name:"3-18-2026.csv",status:"complete"},{name:"3-17-2026.csv",status:"complete"},{name:"3-16-2026.csv",status:"complete"},{name:"3-15-2026.csv",status:"complete"},{name:"3-14-2026.csv",status:"complete"},{name:"3-13-2026.csv",status:"complete"},{name:"3-12-2026.csv",status:"complete"}];


var dfiles=[];
function update()
{
  dfiles=[];
  //dir view
  var rfiles=fs.readdirSync("result");
  
  for(var i=0;i<rfiles.length;i++)
  {
    var sclean=rfiles[i].replace(".csv","");
    var parts=sclean.split("-");
    var month=parseInt(parts[0]);
    var day=parseInt(parts[1]);
    var year=parseInt(parts[2]);
    dfiles.push({"name":rfiles[i],"status":"complete","date":new Date(year,(month-1),day,0,0,0,0)})
  }
  
  dfiles.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  var lastDate=new Date(dfiles[0].date.getTime());
  lastDate.setDate(lastDate.getDate()+1);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
  
  dfiles=[{"name":formatter.format(lastDate).replace(/\//g, '-'),"status":"running","date":lastDate},...dfiles];
}




http.createServer(async function(request, response){
  var requestUrl = url.parse(request.url);
  var path = requestUrl.pathname;
  var parts = path.split("/");
  if(parts[1]=="monitor")
  {
    var html = fs.readFileSync("progress.html",{ encoding: 'utf8', flag: 'r' }); 
    var content="";
    for(var i=0;i<files.length;i++)
    {
      var item=files[i];
      content+="<tr>";
      content+="<td>"+item.name.replace(".csv","")+"</td>";
      if(item.status=="running")
      {
          content+="<td style='color:red'>"+item.status+"</td>";
      }
      else if(item.status=="complete")
      {
          content+="<td style='color:green'>"+item.status+"</td>";
      }
      else
      {
        content+="<td style='color:blue'>"+item.status+"</td>";
      }
      
      if(item.status=="complete")
      {
        content+="<td><a href='http://37.27.205.50:6868/download/"+item.name+"' target='_black'>Download</a></td>";
      }      
      content+="</tr>";
    }
    
    html=html.replace("---table---",content);
    response.writeHead(200,  { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*" });
    response.end(html, "utf-8");
  }
  if(parts[1]=="monitor2")
  {
    //update();
    var html = fs.readFileSync("progress.html",{ encoding: 'utf8', flag: 'r' }); 
    var content="";
    for(var i=0;i<dfiles.length;i++)
    {
      var item=dfiles[i];
      content+="<tr>";
      content+="<td>"+item.name.replace(".csv","")+"</td>";
      if(item.status=="running")
      {
          content+="<td style='color:red'>"+item.status+"</td>";
      }
      else if(item.status=="complete")
      {
          content+="<td style='color:green'>"+item.status+"</td>";
      }
      else
      {
        content+="<td style='color:blue'>"+item.status+"</td>";
      }
      
      if(item.status=="complete")
      {
        content+="<td><a href='http://37.27.205.50:6868/download/"+item.name+"' target='_black'>Download</a></td>";
      }      
      content+="</tr>";
    }
    
    html=html.replace("---table---",content);
    response.writeHead(200,  { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*" });
    response.end(html, "utf-8");
  }
  else if(parts[1]=="download")
  {
    try{
      var file=parts[2];
      const readStream = fs.createReadStream('result/'+file);
      response.writeHead(200,{'Content-type': 'application/csv'});
      readStream.pipe(response);
    }catch(e){}
  }

}).listen(6868);