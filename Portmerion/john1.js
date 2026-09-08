const fs = require('fs');
var Client = require('ssh2').Client;
const Papa = require('papaparse');
const axios = require('axios');
const config = require('./config');

// Credentials come from Portmerion/.env, never from this file.
var agents = config.proxyAgents();

function get_header(){
    return {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "bn,bn-BD;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "max-age=0",
        "priority": "u=0, i",
        "sec-ch-ua": "\"Not;A=Brand\";v=\"99\", \"Google Chrome\";v=\"139\", \"Chromium\";v=\"139\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "accept-encoding": "gzip, deflate, br",
        "x-api-key": config.apiKey(),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
    }
}


var connSettings = config.sftpSettings();

function parse(callback)
{
    var match_str=fs.readFileSync("axios1.csv", "utf-8");
    var results=Papa.parse(match_str, {header: true}).data;
    var id_hash={};
    var ids=[];
    for(var i=0;i<results.length;i++)
    {
        var url=results[i].URL;
        var pp=url.split("/");
        var p=pp[pp.length-1];
        if(p[0]=='p')
        {
            var prod=p.replace("p","");
            if(!id_hash[prod])
            {
                id_hash[prod]=true;
                ids.push(prod);
            }
        }
        else
        {
            console.log(url);
        }

    }
    //console.log(results);
    callback(ids);
}

function download_urls(callback)
{
    var conn = new Client();
    conn.on('ready', function() {
        console.log('Client :: ready');

        var sftp_folder="John Lewis/AO - UK/Matched Export/AO - UK - Johnlewis - Matched.csv";
        var local_folder="axios1.csv";
        conn.sftp(function(err, sftp) {
            sftp.fastGet(sftp_folder, local_folder, {}, function(err) {
                if (err) throw err;
                console.log('File downloaded successfully');
                conn.end();
				parse(function(ids){
                    callback(ids);
                })
				
            });
        });
    }).connect(connSettings);    
}

function upload_result()
{
    var conn = new Client();
    conn.on('ready', function() {
        console.log('Client :: ready');
        var sftp_folder="John Lewis/AO - UK/Matched/"+filename;
        var local_folder="result1.csv";
        conn.sftp(function(err, sftp) {
            sftp.fastPut(local_folder,sftp_folder , {}, function(err) {
                if (err) throw err;
                console.log('File downloaded successfully');
				//build_url();
				conn.end();
            });
        });
    }).connect(connSettings);
}

function csv(data)
{
    console.log("csv: "+data.length);
    var csv="title,differentiators,price,old_price,promo1,promo2,promo3,lead_time,category,stock,sku,brand,image_url,url\n";

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
    for(var i=0;i<data.length;i++)
    {
        var item=data[i];
        for(var j=0;j<item.variants.length;j++)
        {
            var vari=item.variants[j];
            var title=vari.title;
            var differentiators=[];
            for(var key in vari.differentiators)
            {
                var val=vari.differentiators[key];
                if(val)
                {
                    differentiators.push(val);
                }
            }
            var price=vari.price.value;
            var old_price="";
            if(vari.price.reductionHistory.length>0)
            {
                old_price=vari.price.reductionHistory[0].value;
            }
            var promo1="";
            var promo2="";
            var promo3="";
            if(vari.messaging.length>0)
            {
                promo1=vari.messaging[0].title;
            }
            if(vari.messaging.length>1)
            {
                promo2=vari.messaging[1].title;
            }
            if(vari.messaging.length>2)
            {
                promo3=vari.messaging[2].title;
            }
            var category=[];
            for(var k=1;k<item.browsePageHierarchy.length;k++)
            {
                category.push(item.browsePageHierarchy[k].name);
            }
            var stock="";
            if(!vari.availability.availableToOrder)
            {
                stock="0";
            }
            var sku=vari.aliases.skuId;
            var brand=item.brand.name;
            var image="https://"+vari.images.primary.replace(/^\/\//g,"")
            var url="https://www.johnlewis.com"+vari.canonicalURL;
            //console.log({title,differentiators,price,category,stock,sku,brand,image,url})
            //console.log(item)
            csv+=csv_item(title);
            csv+=csv_item(differentiators.join(","));
            csv+=csv_item(price);
            csv+=csv_item(old_price);
            csv+=csv_item(promo1);
            csv+=csv_item(promo2);
            csv+=csv_item(promo3);
            csv+=csv_item("");
            csv+=csv_item(category.join(" > "));
            csv+=csv_item(stock);
            csv+=csv_item(sku);
            csv+=csv_item(brand);
            csv+=csv_item(image);
            csv+=csv_item2(url);
            csv+="\n";            
        }
    }
    fs.writeFileSync("result1.csv", '\ufeff'+csv, 'utf8');
    upload_result();
}
var proxy_index=0;
function scrap(ids,data)
{
    var headers=get_header();
    
    var cid=[];
    var temp=[];
    for(var i=0;i<ids.length;i++)
    {
        if(cid.length<50)
        {
            cid.push(ids[i])
        }
        else
        {
            temp.push(ids[i]);
        }
    }
    if(cid.length>0)
    {
        var payload="{\"variables\":{\"productIds\":"+JSON.stringify(cid)+"},\"query\":\"\\n    query getProduct($productIds: [String!]!) {\\n  productsV2(where: {pimProductIds: $productIds}) {\\n    __typename\\n    title\\n    canonicalURL\\n    browsePageHierarchy {\\n      name\\n      url\\n    }\\n    aliases {\\n      pimProductId\\n    }\\n    availability {\\n      futureAvailability {\\n        availableToOrderFromMessage\\n      }\\n      preOrder {\\n        streetDateMessage\\n      }\\n    }\\n    messaging {\\n      title\\n      type\\n      description\\n      ... on PromotionalMessage {\\n        promotionGroup\\n        promotionType\\n      }\\n    }\\n    variantPriceRange {\\n      for\\n      display {\\n        max\\n        min\\n      }\\n      reductionHistory {\\n        chronology\\n        display {\\n          max\\n          min\\n        }\\n      }\\n      value {\\n        min\\n        max\\n      }\\n      offerTypeSummary\\n    }\\n    defaultVariant {\\n      id\\n    }\\n    fulfilmentOptions {\\n      available {\\n        aliases {\\n          dmsId\\n        }\\n        shortDescription\\n        deliveryGroupId\\n      }\\n    }\\n    reviewSummary {\\n      averageRating\\n      numberOfReviews\\n    }\\n    unitOfMeasure\\n    ... on SimpleProduct {\\n      variantGroups(groupBy: {differentiator: colour}) {\\n        value\\n        messaging {\\n          title\\n          type\\n          description\\n          ... on PromotionalMessage {\\n            promotionGroup\\n            promotionType\\n          }\\n        }\\n        variantPriceRange {\\n          for\\n          display {\\n            max\\n            min\\n          }\\n          reductionHistory {\\n            chronology\\n            display {\\n              max\\n              min\\n            }\\n          }\\n          value {\\n            min\\n            max\\n          }\\n          offerTypeSummary\\n        }\\n        variants {\\n          id\\n        }\\n      }\\n      brand {\\n        name\\n      }\\n      attributes {\\n        key\\n        values\\n      }\\n      configurationRequirements {\\n        type\\n      }\\n    }\\n    ... on CompositeBundle {\\n      brand {\\n        name\\n      }\\n      attributes {\\n        key\\n        values\\n      }\\n    }\\n    variants {\\n      id\\n      title\\n      canonicalURL\\n      pdpURL {\\n        url\\n        path\\n      }\\n      availability {\\n        availableToOrder\\n        unavailableReason\\n        futureAvailability {\\n          availableToOrderFromMessage\\n        }\\n        preOrder {\\n          streetDateMessage\\n        }\\n        shipFromStore\\n      }\\n      images {\\n        primary\\n        alternatives\\n      }\\n      customerNotifiableEvents {\\n        backInStock\\n        onRelease\\n        onPreorderLaunch\\n        newlyInStock\\n      }\\n      price {\\n        for\\n        value\\n        display\\n        reductionHistory {\\n          value\\n          display\\n          chronology\\n        }\\n        offerType\\n      }\\n      ... on StockVariant {\\n        aliases {\\n          skuId\\n        }\\n        attributes {\\n          key\\n          displayName\\n          values\\n        }\\n        colourSwatch\\n        differentiators {\\n          colour\\n          size\\n          sizeHeadline\\n        }\\n        energy {\\n          rating {\\n            legacy\\n            value\\n            title\\n            description\\n          }\\n          label\\n          informationSheet\\n        }\\n        messaging {\\n          title\\n          type\\n          description\\n          ... on PromotionalMessage {\\n            promotionGroup\\n            promotionType\\n          }\\n        }\\n        pricePerUnit {\\n          quantity\\n          unitOfMeasure\\n          display\\n        }\\n        sellingRestrictions {\\n          age {\\n            minimumAge\\n            bladedArticle\\n          }\\n        }\\n        services {\\n          id\\n          __typename\\n          title\\n          ... on DeliveryService {\\n            aliases {\\n              dmsId\\n              dbsId\\n            }\\n            description\\n            price {\\n              value\\n              display\\n            }\\n          }\\n          ... on IncludedGuarantee {\\n            aliases {\\n              skuId\\n            }\\n          }\\n          ... on ExtendedWarranty {\\n            aliases {\\n              skuId\\n              mainframeProductId\\n            }\\n            price {\\n              value\\n              display\\n            }\\n            duration\\n            policyDetail\\n            tooltip\\n            purchaseDescription\\n            confirmation\\n          }\\n        }\\n      }\\n      ... on CompositeBundleVariant {\\n        __typename\\n        aliases {\\n          skuId\\n        }\\n        components {\\n          __typename\\n          variant {\\n            __typename\\n            id\\n            title\\n          }\\n        }\\n        messaging {\\n          title\\n          type\\n          description\\n          ... on PromotionalMessage {\\n            promotionGroup\\n            promotionType\\n          }\\n        }\\n      }\\n      ... on StaticBundleVariant {\\n        __typename\\n        aliases {\\n          skuId\\n          couponId\\n        }\\n        components {\\n          __typename\\n          variant {\\n            id\\n            title\\n          }\\n        }\\n        messaging {\\n          title\\n          type\\n          description\\n          ... on PromotionalMessage {\\n            promotionGroup\\n            promotionType\\n          }\\n        }\\n      }\\n    }\\n  }\\n}\\n    \"}"
        
        axios.post("https://api.johnlewis.com/catalogue/graphql",JSON.parse(payload) ,{ headers:headers,httpsAgent:agents[proxy_index] })
        .then(response => {
            console.log("response: "+response.status);
            //console.log(response.data.data.productsV2[0]);
            for(var i=0;i<response.data.data.productsV2.length;i++)
            {
                data.push(response.data.data.productsV2[i]);
            }
            ids=temp;
            console.log(ids.length+" - "+data.length);
            scrap(ids,data)

        })
        .catch(error => {
            console.log(error);
            console.log("error: "+error.status);
            proxy_index++;
            if(proxy_index>=200)
            {
                proxy_index=0;
            }
            scrap(ids,data)
        })
    }
    else
    {
        csv(data);
    }
}

function start()
{
    download_urls(function(ids){
        console.log("total ids: "+ids.length);
        scrap(ids,[]);
    });
}

//start();
//scrap();

var  filename="";
var rr=false;
var rr2=false;
var rr3=false;
setInterval(function(){
	var tt=new Date();
	var hour=tt.getHours();
	var min=tt.getMinutes();
    var day=tt.getDate();
    var month=tt.getMonth()+1;
    if(day<10)
    {
        day="0"+day;
    }
    if(month<10)
    {
        month="0"+month;
    }
	console.log(hour+" - "+min);
	if(!rr){
		if(hour==6 && min==22)
		{
			rr=true;
			filename=month+"-"+day+"-2026 8am.csv";
			start();
		}
	}
	if(!rr2){
		if(hour==11 && min==22)
		{
			rr2=true;
			filename=month+"-"+day+"-2026 1pm.csv";
			start();
		}
	}
	if(!rr3){
		if(hour==14 && min==22)
		{
			rr3=true;
			filename=month+"-"+day+"-2026 4pm.csv";
			start();
		}
	}	
    if(hour>20)
    {
        rr=false;
        rr2=false;
        rr3=false;        
    }
	
	
},30000);