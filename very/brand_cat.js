var cat=[];

$(".fuse-accordion-group__accordion a.fuse-link").each(function(){
    //console.log($(this).text().trim())
    cat.push({
        "url": $(this).attr("href"),
        "cat": "Appliances > "+$(this).text().trim()
    })
});

console.log(cat)