const fs = require('fs');

var hash={};
var tag={};
var taglist=["<sup>",""]
function escapeHtml(text) {
    try{
    var regexp=/\&(.+?)\;/g;
 	var matches = [...text.matchAll(regexp)];
        for(var i=0;i<matches.length;i++)
        {
        output=matches[i][1];  
        hash["&"+output+";"]=true;
        } 
    }
    catch(e){}


var mm={
  '&nbsp;': " ",
  '&reg;': "®",
  '&amp;': "&",
  '&eacute;': "é",
  '&ndash;': "–",
  '&egrave;': "",
  '&deg;': "°",
  '&rsquo;': "'",
  '&sup2;': "",
  '&trade;': "™",
  '&ograve;': "",
  '&euml;': "ë",
  '&Eacute;': "é",
  '&pound;': "£",
  '&atilde;': "ã",
  '&copy;': "©",
  '&ouml;': "Ö",
  '&agrave;': "À",
  '&lsquo;': "",
  '&uuml;': "ü"
}    
    try{
    var regexp=/(<.+?>)/g;
 	var matches = [...text.matchAll(regexp)];
        for(var i=0;i<matches.length;i++)
        {
        output=matches[i][1];  
        hash[output]=true;
        mm[output]="";
        } 
    }
    catch(e){}




for(var key in mm)
//for(var i=0;i<mm.length;i++)
{
    for(var i=0;i<20;i++)
    {
        text=text.replace(key,mm[key])
    }
}
    return text;
}

function csv_item(val)
{
	val=val+"";
	if(val)
	{
		return '"'+val.replace(/"/g,'""')+'",';
	}
	else
	{
		return '"",';
	}
}
function csv_item2(val)
{
	val=val+"";
	if(val)
	{
		return '"'+val.replace(/"/g,'""')+'"';
	}
	else
	{
		return '""';
	}
}

var folder_name="data";
const files = fs.readdirSync(folder_name);
var csv="identifier,product name, price,old_price,discount, stock, brand,category, item number, option number, ean, image url, url\n";

var state = JSON.parse(fs.readFileSync("urls.json",{ encoding: 'utf8', flag: 'r' }));
console.log(state.length);
for(var i=0;i<state.length;i++)
{
    if(state[i].product_id=="1600956507")
    {
        console.log(i);
    }
}
var option_hash={};
var error=0;
for(var i=0;i<files.length;i++)
{
    var num=parseInt(files[i].replace(".json",""));
    if(i%1000==0)
    {
        console.log(i+" - "+error);
    }
    try{
    var html = fs.readFileSync(folder_name+"/"+files[i],{ encoding: 'utf8', flag: 'r' });
    html=JSON.parse(html);

    //var regexp = /<script>window.__product_body_initial_state__=(.+?),window./g;
    var regexp = /<script>window.__product_body_initial_state__=(.+?),window/g;
	var matches = [...html.matchAll(regexp)];
    output=matches[0][1];
    //console.log(output);
    //var data=JSON.parse(output)
    eval("var data="+output);
    //console.log(data);
    fs.writeFileSync("sample.json", JSON.stringify(data));
    for(var j=0;j<data.skus.length;j++)
    {
        var item=data.skus[j];

        for(var key in item.options)
        {
            if(option_hash[key])
            {

            }
            else
            {
                //console.log(key+" - "+state[num].url);
                option_hash[key]=true;
            }
        }
        var options=[escapeHtml(data.name)];

        for(var key in item.options)
        {
            options.push(escapeHtml(item.options[key]));
        }
        csv+=csv_item(data.productId+"-"+item.option); //identifier
        //console.log(data.productId+"-"+item.itemNumber);
        //break;
        csv+=csv_item(data.brand+" "+options.join(" - "));
        var current=0;
        var previous=0;
        try{
            csv+=csv_item(item.price.amount.current.replace("£",""));
            try{
            current=parseInt(item.price.amount.current.replace("£",""))
            }catch(e){}
        }catch(e){
            //console.log(item);
            csv+=csv_item("");
        }
        try{
            if(item.price.amount.previous)
            {
                csv+=csv_item(item.price.amount.previous.replace("£",""));
                try{
                previous=parseInt(item.price.amount.previous.replace("£",""))
                }catch(e){}
            }
            else
            {
                csv+=csv_item("");
            }
        }
        catch(e){
            csv+=csv_item("");
        }

        try{
            if(! isNaN(parseInt(((previous-current)/previous)*100)))
            {
                csv+=csv_item(parseInt(((previous-current)/previous)*100));
            }
            else
            {
                csv+=csv_item(0);    
            }
        }catch(e)
        {
            csv+=csv_item(0);
        }
        if(item.stock.primary=="Out of stock")
        {
            //csv+=csv_item("Out of stock");
            csv+=csv_item("0");
        }
        else
        {
            //csv+=csv_item("In stock");
            csv+=csv_item("1");
        }
        

        //csv+=csv_item(options.join(","));

        csv+=csv_item(data.brand);

        //category
        csv+=csv_item(state[num].cat);

        csv+=csv_item(item.itemNumber);

        csv+=csv_item(item.option);
        if(item.ean)
        {
        csv+=csv_item(item.ean);
        }
        else
        {
            csv+=csv_item("");
        }
        if(item.images && item.images.length>0)
        {
            csv+=csv_item("https://media.very.co.uk/i/very/"+item.images[0].identifier);
        }
        else
        {
            if(data.images && data.images.length>0)
            {
                csv+=csv_item("https://media.very.co.uk/i/very/"+data.images[0].identifier);
            }
            else
            {
                console.log("image problem: "+"https://www.very.co.uk"+state[num].url);
                csv+=csv_item("");   
                break;
            } 
        }
        csv+=csv_item2("https://www.very.co.uk"+state[num].url);

        csv+="\n";
    }
    }catch(e)
    {
        console.log("https://www.very.co.uk"+state[num].url)
        console.log(e);
        error++;
        fs,fs.unlinkSync(folder_name+"/"+files[i])
    }
    if(i>10)
    {
        //break;
    }
    if(state[num].product_id=="1600956507")
    {
        console.log("this is data not found:"+num);
        //break;
    }
    if(i>100)
    {
        //break;
    }
    //break;
}

console.log(option_hash);
console.log("error: "+error);
console.log(hash);
fs.writeFileSync("very2.csv", '\ufeff'+csv, 'utf8');

//console.log(csv);

