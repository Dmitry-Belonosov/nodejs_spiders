var all_urls=[];

var cat1=[
    {
        "url": "/browse/home-and-garden/shop-by-room--bedroom",
        "cat": "Home & Garden > Bedroom"
    },
    {
        "url": "/browse/home-and-garden/shop-by-room--living-room",
        "cat": "Home & Garden > Living Room"
    },
    {
        "url": "/browse/home-and-garden/shop-by-room--garden",
        "cat": "Home & Garden > Garden"
    },
    {
        "url": "/browse/home-and-garden/shop-by-room--kitchen",
        "cat": "Home & Garden > Kitchen"
    },
    {
        "url": "/browse/home-and-garden/shop-by-room--bathroom",
        "cat": "Home & Garden > Bathroom"
    },
    {
        "url": "/browse/home-and-garden/shop-by-room--dining-room",
        "cat": "Home & Garden > Dining Room"
    },
    {
        "url": "/browse/shop-by-room--kids-bedroom",
        "cat": "Home & Garden > Kids Bedroom"
    },
    {
        "url": "/browse/home-and-garden/shop-by-room--office",
        "cat": "Home & Garden > Office"
    },
    {
        "url": "/browse/shop-by-room--nursery",
        "cat": "Home & Garden > Nursery"
    },
    {
        "url": "/browse/home-beds",
        "cat": "Home & Garden > Beds"
    },
    {
        "url": "/browse/home-mattresses",
        "cat": "Home & Garden > Mattresses"
    },
    {
        "url": "/browse/home-headboards",
        "cat": "Home & Garden > Headboards"
    },
    {
        "url": "/browse/home-wardrobes",
        "cat": "Home & Garden > Wardrobes"
    },
    {
        "url": "/browse/home-chest-of-drawers",
        "cat": "Home & Garden > Chest of Drawers"
    },
    {
        "url": "/browse/home-bedside-tables",
        "cat": "Home & Garden > Bedside Tables"
    },
    {
        "url": "/browse/home-bedroom-furniture-sets",
        "cat": "Home & Garden > Bedroom Furniture Sets"
    },
    {
        "url": "/browse/home-dressing-tables",
        "cat": "Home & Garden > Dressing Tables"
    },
    {
        "url": "/browse/home-storage-ottomans",
        "cat": "Home & Garden > Ottomans"
    },
    {
        "url": "/browse/home-bedding-bed-linen",
        "cat": "Home & Garden > Bed Linen"
    },
    {
        "url": "/browse/home-bedding-duvets-and-pillows",
        "cat": "Home & Garden > Duvets & Pillows"
    },
    {
        "url": "/browse/home-bedding-protectors-and-toppers",
        "cat": "Home & Garden > Protectors & Toppers"
    },
    {
        "url": "/browse/home-bedding-bedspread-and-blankets",
        "cat": "Home & Garden > Bedspread & Blankets"
    },
    {
        "url": "/browse/home-sofas-armchairs-and-footstools",
        "cat": "Home & Garden > Sofas, Armchairs & Footstools"
    },
    {
        "url": "/browse/home-sofas-armchairs-and-footstools/sofa-type--all-sofas",
        "cat": "Home & Garden > All Sofas"
    },
    {
        "url": "/browse/home-sofas-armchairs-and-footstools/sofa-type--all-chairs",
        "cat": "Home & Garden > All Chairs"
    },
    {
        "url": "/browse/home-sofas-armchairs-and-footstools/sofa-type--sofa-sets",
        "cat": "Home & Garden > Sofa Sets"
    },
    {
        "url": "/browse/home-tv-stands",
        "cat": "Home & Garden > TV Stands"
    },
    {
        "url": "/browse/home-coffee-tables-and-side-tables",
        "cat": "Home & Garden > Coffee Tables & Side Tables"
    },
    {
        "url": "/browse/home-sideboards-and-console-tables",
        "cat": "Home & Garden > Sideboards & Console Tables"
    },
    {
        "url": "/browse/home-cabinets-and-cupboards",
        "cat": "Home & Garden > Cabinets & Cupboards"
    },
    {
        "url": "/browse/home-dining-tables-and-chairs",
        "cat": "Home & Garden > Dining Tables & Chairs"
    },
    {
        "url": "/browse/home-bar-stools",
        "cat": "Home & Garden > Bar Stools"
    },
    {
        "url": "/browse/home-drinks-trollies",
        "cat": "Home & Garden > Drinks Trolley"
    },
    {
        "url": "/browse/home-bathroom-cabinets",
        "cat": "Home & Garden > Bathroom Cabinets"
    },
    {
        "url": "/browse/home-bathroom-undersink-units",
        "cat": "Home & Garden > Bathroom Undersink Units"
    },
    {
        "url": "/browse/home-bathroom-essentials",
        "cat": "Home & Garden > Bathroom Essentials"
    },
    {
        "url": "/browse/home-showers-and-fittings",
        "cat": "Home & Garden > Showers & Fittings"
    },
    {
        "url": "/browse/home-office-chairs",
        "cat": "Home & Garden > Office Chairs"
    },
    {
        "url": "/browse/home-desks",
        "cat": "Home & Garden > Desks"
    },
    {
        "url": "/browse/home-bookcases-and-shelving",
        "cat": "Home & Garden > Bookcases, Shelving & Storage Units"
    },
    {
        "url": "/browse/home-storage-and-organisation",
        "cat": "Home & Garden > Storage Boxes & Organisation"
    },
    {
        "url": "/browse/home-radiator-covers",
        "cat": "Home & Garden > Radiator Covers"
    },
    {
        "url": "/browse/home-hallway-benches-and-shoe-storage",
        "cat": "Home & Garden > Hallway Benches & Shoe Storage"
    },
    {
        "url": "/browse/home-cookware",
        "cat": "Home & Garden > Cookware"
    },
    {
        "url": "/browse/home-bakeware",
        "cat": "Home & Garden > Bakeware"
    },
    {
        "url": "/browse/home-tableware",
        "cat": "Home & Garden > Tableware"
    },
    {
        "url": "/browse/home-drinkware",
        "cat": "Home & Garden > Drinkware"
    },
    {
        "url": "/browse/home-picnicware",
        "cat": "Home & Garden > Picnicware"
    },
    {
        "url": "/browse/home-kitchen-storage",
        "cat": "Home & Garden > Kitchen Storage"
    },
    {
        "url": "/browse/home-accessories",
        "cat": "Home & Garden > Home Accessories"
    },
    {
        "url": "/browse/home-wall-art",
        "cat": "Home & Garden > Wall Art"
    },
    {
        "url": "/browse/home-lighting",
        "cat": "Home & Garden > Lighting"
    },
    {
        "url": "/browse/home-curtains-and-blinds",
        "cat": "Home & Garden > Curtains & Blinds"
    },
    {
        "url": "/browse/home-cushions-and-throws",
        "cat": "Home & Garden > Cushions & Throws"
    },
    {
        "url": "/browse/home-rugs",
        "cat": "Home & Garden > Rugs"
    },
    {
        "url": "/browse/home-christmas-decorations",
        "cat": "Home & Garden > Christmas Decorations"
    },
    {
        "url": "/browse/home-seasonal-decorations",
        "cat": "Home & Garden > Seasonal Decorations"
    },
    {
        "url": "/browse/home-laundry-and-utility",
        "cat": "Home & Garden > Laundry & Utility"
    },
    {
        "url": "/browse/diy-power-tools",
        "cat": "Home & Garden > Power Tools"
    },
    {
        "url": "/browse/diy-hand-tools",
        "cat": "Home & Garden > Hand Tools"
    },
    {
        "url": "/browse/diy-diy-equipment",
        "cat": "Home & Garden > DIY Equipment"
    },
    {
        "url": "/browse/diy-paint",
        "cat": "Home & Garden > Paint"
    },
    {
        "url": "/browse/diy-wallpaper",
        "cat": "Home & Garden > Wallpaper"
    },
    {
        "url": "/browse/diy-vinyl-wrap",
        "cat": "Home & Garden > Vinyl Wrap"
    },
    {
        "url": "/browse/diy-decorative-wall-panels",
        "cat": "Home & Garden > Decorative Wall Panels"
    },
    {
        "url": "/browse/diy-tiling-and-flooring",
        "cat": "Home & Garden > Tiling & Flooring"
    },
    {
        "url": "/browse/diy-decorating-tools-and-supplies",
        "cat": "Home & Garden > Decorating Tools & Supplies"
    },
    {
        "url": "/browse/diy-hardware-and-fixtures",
        "cat": "Home & Garden > Hardware & Fixtures"
    },
    {
        "url": "/browse/home-petcare",
        "cat": "Home & Garden > All Petcare"
    },
    {
        "url": "/browse/home-petcare/animal--dog",
        "cat": "Home & Garden > Dogs"
    },
    {
        "url": "/browse/home-petcare/animal--cat",
        "cat": "Home & Garden > Cats"
    },
    {
        "url": "/browse/home-petcare/animal--small-pet",
        "cat": "Home & Garden > Small Pets"
    },
    {
        "url": "/browse/garden-furniture",
        "cat": "Home & Garden > Garden Furniture"
    },
    {
        "url": "/browse/garden-buildings",
        "cat": "Home & Garden > Garden Buildings"
    },
    {
        "url": "/browse/garden-tools",
        "cat": "Home & Garden > Garden Tools"
    },
    {
        "url": "/browse/garden-landscaping",
        "cat": "Home & Garden > Garden Landscaping"
    },
    {
        "url": "/browse/garden-decor",
        "cat": "Home & Garden > Garden Decor"
    },
    {
        "url": "/browse/garden-planting-and-growing",
        "cat": "Home & Garden > Planting & Growing"
    },
    {
        "url": "/browse/garden-bbqs-and-outdoor-cooking",
        "cat": "Home & Garden > BBQ's & Outdoor Cooking"
    },
    {
        "url": "/browse/garden-heating",
        "cat": "Home & Garden > Garden Heating"
    },
    {
        "url": "/browse/garden-hot-tubs-and-spas",
        "cat": "Home & Garden > Hot Tubs & Spas"
    },
    {
        "url": "/browse/brand--the-very-collection?tab=5",
        "cat": "Home & Garden > The Very Collection"
    },
    {
        "url": "/browse/home-and-garden/brand--silentnight",
        "cat": "Home & Garden > Silentnight"
    },
    {
        "url": "/browse/home-and-garden/brand--gallery-direct",
        "cat": "Home & Garden > Gallery Direct"
    },
    {
        "url": "/browse/home-and-garden/brand--tefal",
        "cat": "Home & Garden > Tefal"
    },
    {
        "url": "/browse/home-and-garden/brand--michelle-keegan-home",
        "cat": "Home & Garden > Michelle Keegan Home"
    },
    {
        "url": "/browse/home-and-garden/brand--le-creuset?numProducts=96",
        "cat": "Home & Garden > Le Creuset"
    },
    {
        "url": "/browse/home-and-garden/brand--catherine-lansfield",
        "cat": "Home & Garden > Catherine Lansfield"
    }
];


var cat11=[
    {
        "url": "/browse/home-and-garden/brand--abigail-ahern?uf=brand",
        "cat": "Appliances > Abigail Ahern"
    },
    {
        "url": "/browse/home-and-garden/brand--addis?uf=brand",
        "cat": "Appliances > Addis"
    },
    {
        "url": "/browse/home-and-garden/brand--aden-plus-anais?uf=brand",
        "cat": "Appliances > aden + anais"
    },
    {
        "url": "/browse/home-and-garden/brand--adhoc?uf=brand",
        "cat": "Appliances > adhoc"
    },
    {
        "url": "/promo/adidas/home-and-garden",
        "cat": "Appliances > adidas"
    },
    {
        "url": "/browse/home-and-garden/brand--adidas-terrex?uf=brand",
        "cat": "Appliances > adidas Terrex"
    },
    {
        "url": "/browse/home-and-garden/brand--airsprung?uf=brand",
        "cat": "Appliances > Airsprung"
    },
    {
        "url": "/browse/home-and-garden/brand--alphason?uf=brand",
        "cat": "Appliances > Alphason"
    },
    {
        "url": "/browse/home-and-garden/brand--animology?uf=brand",
        "cat": "Appliances > Animology"
    },
    {
        "url": "/browse/home-and-garden/brand--appletree?uf=brand",
        "cat": "Appliances > Appletree"
    },
    {
        "url": "/browse/home-and-garden/brand--aqualona?uf=brand",
        "cat": "Appliances > AQUALONA"
    },
    {
        "url": "/browse/home-and-garden/brand--aromadog?uf=brand",
        "cat": "Appliances > Aromadog"
    },
    {
        "url": "/browse/home-and-garden/brand--arsenal?uf=brand",
        "cat": "Appliances > Arsenal"
    },
    {
        "url": "/browse/home-and-garden/brand--art-for-the-home?uf=brand",
        "cat": "Appliances > Art For The Home"
    },
    {
        "url": "/browse/home-and-garden/brand--artesa?uf=brand",
        "cat": "Appliances > Artesa"
    },
    {
        "url": "/browse/home-and-garden/brand--arthouse?uf=brand",
        "cat": "Appliances > ARTHOUSE"
    },
    {
        "url": "/browse/home-and-garden/brand--as-creation?uf=brand",
        "cat": "Appliances > AS Creation"
    },
    {
        "url": "/browse/home-and-garden/brand--asiatic?uf=brand",
        "cat": "Appliances > Asiatic"
    },
    {
        "url": "/browse/home-and-garden/brand--aspire?uf=brand",
        "cat": "Appliances > Aspire"
    },
    {
        "url": "/browse/home-and-garden/brand--aura?uf=brand",
        "cat": "Appliances > Aura"
    },
    {
        "url": "/browse/home-and-garden/brand--avf?uf=brand",
        "cat": "Appliances > AVF"
    },
    {
        "url": "/browse/home-and-garden/brand--babymore?uf=brand",
        "cat": "Appliances > Babymore"
    },
    {
        "url": "/browse/home-and-garden/brand--bahco?uf=brand",
        "cat": "Appliances > Bahco"
    },
    {
        "url": "/browse/home-and-garden/brand--bambi?uf=brand",
        "cat": "Appliances > Bambi"
    },
    {
        "url": "/browse/home-and-garden/brand--banbury-and-co?uf=brand",
        "cat": "Appliances > Banbury & Co"
    },
    {
        "url": "/browse/home-and-garden/brand--barbary-and-oak?uf=brand",
        "cat": "Appliances > Barbary & Oak"
    },
    {
        "url": "/browse/home-and-garden/brand--barbie?uf=brand",
        "cat": "Appliances > Barbie"
    },
    {
        "url": "/browse/home-and-garden/brand--barbour?uf=brand",
        "cat": "Appliances > Barbour"
    },
    {
        "url": "/browse/home-and-garden/brand--barcraft?uf=brand",
        "cat": "Appliances > BarCraft"
    },
    {
        "url": "/browse/home-and-garden/brand--bark?uf=brand",
        "cat": "Appliances > Bark"
    },
    {
        "url": "/browse/home-and-garden/brand--bark-x-crufts?uf=brand",
        "cat": "Appliances > Bark x Crufts"
    },
    {
        "url": "/browse/home-and-garden/brand--bath-vida?uf=brand",
        "cat": "Appliances > Bath Vida"
    },
    {
        "url": "/browse/home-and-garden/brand--batman?uf=brand",
        "cat": "Appliances > Batman"
    },
    {
        "url": "/browse/home-and-garden/brand--beau-and-elliot?uf=brand",
        "cat": "Appliances > BEAU & ELLIOT"
    },
    {
        "url": "/browse/home-and-garden/brand--bedeck-of-belfast?uf=brand",
        "cat": "Appliances > Bedeck of Belfast"
    },
    {
        "url": "/browse/home-and-garden/brand--bedlam?uf=brand",
        "cat": "Appliances > Bedlam"
    },
    {
        "url": "/browse/home-and-garden/brand--beldray?uf=brand",
        "cat": "Appliances > Beldray"
    },
    {
        "url": "/browse/home-and-garden/brand--belkin?uf=brand",
        "cat": "Appliances > Belkin"
    },
    {
        "url": "/browse/home-and-garden/brand--belle-and-boo?uf=brand",
        "cat": "Appliances > Belle & Boo"
    },
    {
        "url": "/browse/home-and-garden/brand--bestway?uf=brand",
        "cat": "Appliances > Bestway"
    },
    {
        "url": "/browse/home-and-garden/brand--bhs?uf=brand",
        "cat": "Appliances > BHS"
    },
    {
        "url": "/browse/home-and-garden/brand--bianca?uf=brand",
        "cat": "Appliances > Bianca"
    },
    {
        "url": "/browse/home-and-garden/brand--biorb?uf=brand",
        "cat": "Appliances > Biorb"
    },
    {
        "url": "/browse/home-and-garden/brand--birdbuddy?uf=brand",
        "cat": "Appliances > Birdbuddy"
    },
    {
        "url": "/browse/home-and-garden/brand--birlea?uf=brand",
        "cat": "Appliances > Birlea"
    },
    {
        "url": "/browse/home-and-garden/brand--black-and-decker?uf=brand",
        "cat": "Appliances > Black & Decker"
    },
    {
        "url": "/browse/home-and-garden/brand--black-plus-blum?uf=brand",
        "cat": "Appliances > black plus blum"
    },
    {
        "url": "/browse/home-and-garden/brand--blackstone?uf=brand",
        "cat": "Appliances > Blackstone"
    },
    {
        "url": "/browse/home-and-garden/brand--bluebellgray?uf=brand",
        "cat": "Appliances > Bluebellgray"
    },
    {
        "url": "/browse/home-and-garden/brand--bluey?uf=brand",
        "cat": "Appliances > Bluey"
    },
    {
        "url": "/browse/home-and-garden/brand--bosch?uf=brand",
        "cat": "Appliances > Bosch"
    },
    {
        "url": "/browse/home-and-garden/brand--boutique?uf=brand",
        "cat": "Appliances > Boutique"
    },
    {
        "url": "/browse/home-and-garden/brand--brabantia?uf=brand",
        "cat": "Appliances > Brabantia"
    },
    {
        "url": "/browse/home-and-garden/brand--brazen?uf=brand",
        "cat": "Appliances > BraZen"
    },
    {
        "url": "/browse/home-and-garden/brand--brita?uf=brand",
        "cat": "Appliances > Brita"
    },
    {
        "url": "/browse/home-and-garden/brand--bugalugs?uf=brand",
        "cat": "Appliances > Bugalugs"
    },
    {
        "url": "/browse/home-and-garden/brand--call-of-duty?uf=brand",
        "cat": "Appliances > Call of Duty"
    },
    {
        "url": "/browse/home-and-garden/brand--campingaz?uf=brand",
        "cat": "Appliances > CAMPINGAZ"
    },
    {
        "url": "/browse/home-and-garden/brand--canopia-by-palram?uf=brand",
        "cat": "Appliances > Canopia by Palram"
    },
    {
        "url": "/browse/home-and-garden/brand--care-bears?uf=brand",
        "cat": "Appliances > Care Bears"
    },
    {
        "url": "/browse/home-and-garden/brand--carmen?uf=brand",
        "cat": "Appliances > Carmen"
    },
    {
        "url": "/browse/home-and-garden/brand--cat-in-the-hat?uf=brand",
        "cat": "Appliances > Cat in the Hat"
    },
    {
        "url": "/browse/home-and-garden/brand--cath-kidston?uf=brand",
        "cat": "Appliances > Cath Kidston"
    },
    {
        "url": "/browse/home-and-garden/brand--catherine-lansfield?uf=brand",
        "cat": "Appliances > Catherine Lansfield"
    },
    {
        "url": "/browse/home-and-garden/brand--catit?uf=brand",
        "cat": "Appliances > Catit"
    },
    {
        "url": "/browse/home-and-garden/brand--char-broil?uf=brand",
        "cat": "Appliances > Char-Broil"
    },
    {
        "url": "/browse/home-and-garden/brand--chelsea?uf=brand",
        "cat": "Appliances > Chelsea"
    },
    {
        "url": "/browse/home-and-garden/brand--chelsea-peers?uf=brand",
        "cat": "Appliances > CHELSEA PEERS"
    },
    {
        "url": "/browse/home-and-garden/brand--cheshire-mouldings?uf=brand",
        "cat": "Appliances > Cheshire Mouldings"
    },
    {
        "url": "/browse/home-and-garden/brand--chicco?uf=brand",
        "cat": "Appliances > Chicco"
    },
    {
        "url": "/browse/home-and-garden/brand--chilly-s?uf=brand",
        "cat": "Appliances > Chilly's"
    },
    {
        "url": "/browse/home-and-garden/brand--circulon?uf=brand",
        "cat": "Appliances > Circulon"
    },
    {
        "url": "/browse/home-and-garden/brand--clair-de-lune?uf=brand",
        "cat": "Appliances > Clair De Lune"
    },
    {
        "url": "/browse/home-and-garden/brand--clearwater?uf=brand",
        "cat": "Appliances > Clearwater"
    },
    {
        "url": "/browse/home-and-garden/brand--cocopup?uf=brand",
        "cat": "Appliances > Cocopup"
    },
    {
        "url": "/browse/home-and-garden/brand--cole-and-mason?uf=brand",
        "cat": "Appliances > Cole & Mason"
    },
    {
        "url": "/browse/home-and-garden/brand--contour?uf=brand",
        "cat": "Appliances > Contour"
    },
    {
        "url": "/browse/home-and-garden/brand--cooper-and-grey?uf=brand",
        "cat": "Appliances > Cooper & Grey"
    },
    {
        "url": "/browse/home-and-garden/brand--copenhagen-home?uf=brand",
        "cat": "Appliances > Copenhagen Home"
    },
    {
        "url": "/browse/home-and-garden/brand--corsair?uf=brand",
        "cat": "Appliances > CORSAIR"
    },
    {
        "url": "/browse/home-and-garden/brand--cosi?uf=brand",
        "cat": "Appliances > COSI"
    },
    {
        "url": "/browse/home-and-garden/brand--cosmoliving-by-cosmopolitan?uf=brand",
        "cat": "Appliances > CosmoLiving by Cosmopolitan"
    },
    {
        "url": "/browse/home-and-garden/brand--country-living?uf=brand",
        "cat": "Appliances > Country Living"
    },
    {
        "url": "/browse/home-and-garden/brand--creative-tops?uf=brand",
        "cat": "Appliances > Creative Tops"
    },
    {
        "url": "/browse/home-and-garden/brand--crown?uf=brand",
        "cat": "Appliances > Crown"
    },
    {
        "url": "/browse/home-and-garden/brand--croydex?uf=brand",
        "cat": "Appliances > Croydex"
    },
    {
        "url": "/browse/home-and-garden/brand--cuddleco?uf=brand",
        "cat": "Appliances > CuddleCo"
    },
    {
        "url": "/browse/home-and-garden/brand--culinare?uf=brand",
        "cat": "Appliances > culinare"
    },
    {
        "url": "/browse/home-and-garden/brand--cuprinol?uf=brand",
        "cat": "Appliances > Cuprinol"
    },
    {
        "url": "/browse/home-and-garden/brand--curtina?uf=brand",
        "cat": "Appliances > Curtina"
    },
    {
        "url": "/browse/home-and-garden/brand--d-c-fix?uf=brand",
        "cat": "Appliances > D-C-Fix"
    },
    {
        "url": "/browse/home-and-garden/brand--daewoo?uf=brand",
        "cat": "Appliances > Daewoo"
    },
    {
        "url": "/browse/home-and-garden/brand--danish-design?uf=brand",
        "cat": "Appliances > Danish Design"
    },
    {
        "url": "/browse/home-and-garden/brand--decathlon?uf=brand",
        "cat": "Appliances > Decathlon"
    },
    {
        "url": "/browse/home-and-garden/brand--decortie?uf=brand",
        "cat": "Appliances > Decortie"
    },
    {
        "url": "/browse/home-and-garden/brand--design-id?uf=brand",
        "cat": "Appliances > Design ID"
    },
    {
        "url": "/browse/home-and-garden/brand--designers-guild?uf=brand",
        "cat": "Appliances > Designers Guild"
    },
    {
        "url": "/browse/home-and-garden/brand--deyongs?uf=brand",
        "cat": "Appliances > Deyongs"
    },
    {
        "url": "/promo/disney/home-and-garden",
        "cat": "Appliances > Disney"
    },
    {
        "url": "/browse/home-and-garden/brand--disney-cars?uf=brand",
        "cat": "Appliances > Disney Cars"
    },
    {
        "url": "/browse/home-and-garden/brand--disney-cinderella?uf=brand",
        "cat": "Appliances > Disney Cinderella"
    },
    {
        "url": "/browse/home-and-garden/brand--disney-frozen?uf=brand",
        "cat": "Appliances > Disney Frozen"
    },
    {
        "url": "/browse/home-and-garden/brand--disney-moana?uf=brand",
        "cat": "Appliances > Disney Moana"
    },
    {
        "url": "/browse/home-and-garden/brand--disney-moana-2?uf=brand",
        "cat": "Appliances > Disney Moana 2"
    },
    {
        "url": "/browse/home-and-garden/brand--disney-princess?uf=brand",
        "cat": "Appliances > Disney Princess"
    },
    {
        "url": "/browse/home-and-garden/brand--disney-stitch?uf=brand",
        "cat": "Appliances > Disney Stitch"
    },
    {
        "url": "/browse/home-and-garden/brand--diy-sheds?uf=brand",
        "cat": "Appliances > DIY Sheds"
    },
    {
        "url": "/browse/home-and-garden/brand--doctor-who?uf=brand",
        "cat": "Appliances > Doctor Who"
    },
    {
        "url": "/browse/home-and-garden/brand--dojo?uf=brand",
        "cat": "Appliances > dojo"
    },
    {
        "url": "/browse/home-and-garden/brand--doog?uf=brand",
        "cat": "Appliances > Doog"
    },
    {
        "url": "/browse/home-and-garden/brand--dora-the-explorer?uf=brand",
        "cat": "Appliances > Dora the Explorer"
    },
    {
        "url": "/browse/home-and-garden/brand--dorel-home?uf=brand",
        "cat": "Appliances > Dorel Home"
    },
    {
        "url": "/browse/home-and-garden/brand--dormeo?uf=brand",
        "cat": "Appliances > Dormeo"
    },
    {
        "url": "/browse/home-and-garden/brand--dream-paws?uf=brand",
        "cat": "Appliances > Dream Paws"
    },
    {
        "url": "/browse/home-and-garden/brand--dreambaby?uf=brand",
        "cat": "Appliances > Dreambaby"
    },
    {
        "url": "/browse/home-and-garden/brand--dreamland?uf=brand",
        "cat": "Appliances > Dreamland"
    },
    {
        "url": "/browse/home-and-garden/brand--dreams-and-drapes?uf=brand",
        "cat": "Appliances > Dreams & Drapes"
    },
    {
        "url": "/browse/home-and-garden/brand--dremel?uf=brand",
        "cat": "Appliances > Dremel"
    },
    {
        "url": "/browse/home-and-garden/brand--drift-home?uf=brand",
        "cat": "Appliances > Drift Home"
    },
    {
        "url": "/browse/home-and-garden/brand--dulux?uf=brand",
        "cat": "Appliances > Dulux"
    },
    {
        "url": "/browse/home-and-garden/brand--dunlopillo?uf=brand",
        "cat": "Appliances > Dunlopillo"
    },
    {
        "url": "/browse/home-and-garden/brand--duracell?uf=brand",
        "cat": "Appliances > Duracell"
    },
    {
        "url": "/browse/home-and-garden/brand--dusk?uf=brand",
        "cat": "Appliances > Dusk"
    },
    {
        "url": "/browse/home-and-garden/brand--east-coast?uf=brand",
        "cat": "Appliances > East Coast"
    },
    {
        "url": "/browse/home-and-garden/brand--ecovacs?uf=brand",
        "cat": "Appliances > Ecovacs"
    },
    {
        "url": "/browse/home-and-garden/brand--eglo?uf=brand",
        "cat": "Appliances > Eglo"
    },
    {
        "url": "/browse/home-and-garden/brand--einhell?uf=brand",
        "cat": "Appliances > Einhell"
    },
    {
        "url": "/browse/home-and-garden/brand--eko?uf=brand",
        "cat": "Appliances > EKO"
    },
    {
        "url": "/browse/home-and-garden/brand--eleanor-bowmer?uf=brand",
        "cat": "Appliances > Eleanor Bowmer"
    },
    {
        "url": "/browse/home-and-garden/brand--emma?uf=brand",
        "cat": "Appliances > Emma"
    },
    {
        "url": "/browse/home-and-garden/brand--emma-bridgewater?uf=brand",
        "cat": "Appliances > Emma Bridgewater"
    },
    {
        "url": "/browse/home-and-garden/brand--enders?uf=brand",
        "cat": "Appliances > Enders"
    },
    {
        "url": "/browse/home-and-garden/brand--england?uf=brand",
        "cat": "Appliances > England"
    },
    {
        "url": "/browse/home-and-garden/brand--envy?uf=brand",
        "cat": "Appliances > Envy"
    },
    {
        "url": "/browse/home-and-garden/brand--esselle?uf=brand",
        "cat": "Appliances > Esselle"
    },
    {
        "url": "/browse/home-and-garden/brand--eufy?uf=brand",
        "cat": "Appliances > Eufy"
    },
    {
        "url": "/browse/home-and-garden/brand--everyday?uf=brand",
        "cat": "Appliances > Everyday"
    },
    {
        "url": "/browse/home-and-garden/brand--evolution?uf=brand",
        "cat": "Appliances > EVOLUTION"
    },
    {
        "url": "/browse/home-and-garden/brand--f1-mercedes?uf=brand",
        "cat": "Appliances > F1 Mercedes"
    },
    {
        "url": "/browse/home-and-garden/brand--f1-red-bull?uf=brand",
        "cat": "Appliances > F1 Red Bull"
    },
    {
        "url": "/browse/home-and-garden/brand--faberware?uf=brand",
        "cat": "Appliances > Faberware"
    },
    {
        "url": "/browse/home-and-garden/brand--faithfull?uf=brand",
        "cat": "Appliances > Faithfull"
    },
    {
        "url": "/browse/home-and-garden/brand--fancy-feeds?uf=brand",
        "cat": "Appliances > Fancy Feeds"
    },
    {
        "url": "/browse/home-and-garden/brand--fatface?uf=brand",
        "cat": "Appliances > FatFace"
    },
    {
        "url": "/browse/home-and-garden/brand--fine-decor?uf=brand",
        "cat": "Appliances > Fine Decor"
    },
    {
        "url": "/browse/home-and-garden/brand--flex?uf=brand",
        "cat": "Appliances > Flex"
    },
    {
        "url": "/browse/home-and-garden/brand--flexi?uf=brand",
        "cat": "Appliances > Flexi"
    },
    {
        "url": "/browse/home-and-garden/brand--floor-pops?uf=brand",
        "cat": "Appliances > Floor Pops"
    },
    {
        "url": "/browse/home-and-garden/brand--flymo?uf=brand",
        "cat": "Appliances > Flymo"
    },
    {
        "url": "/browse/home-and-garden/brand--forgefix?uf=brand",
        "cat": "Appliances > ForgeFix"
    },
    {
        "url": "/browse/home-and-garden/brand--fortnite?uf=brand",
        "cat": "Appliances > Fortnite"
    },
    {
        "url": "/browse/home-and-garden/brand--french-connection?uf=brand",
        "cat": "Appliances > French Connection"
    },
    {
        "url": "/browse/home-and-garden/brand--fresco?uf=brand",
        "cat": "Appliances > Fresco"
    },
    {
        "url": "/browse/home-and-garden/brand--friends?uf=brand",
        "cat": "Appliances > Friends"
    },
    {
        "url": "/browse/home-and-garden/brand--furn?uf=brand",
        "cat": "Appliances > Furn"
    },
    {
        "url": "/browse/home-and-garden/brand--fusion?uf=brand",
        "cat": "Appliances > Fusion"
    },
    {
        "url": "/browse/home-and-garden/brand--gabbys-dollhouse?uf=brand",
        "cat": "Appliances > Gabby's Dollhouse"
    },
    {
        "url": "/browse/home-and-garden/brand--gallery?uf=brand",
        "cat": "Appliances > Gallery"
    },
    {
        "url": "/browse/home-and-garden/brand--gallery-direct?uf=brand",
        "cat": "Appliances > Gallery Direct"
    },
    {
        "url": "/browse/home-and-garden/brand--gardena?uf=brand",
        "cat": "Appliances > Gardena"
    },
    {
        "url": "/browse/home-and-garden/brand--gefu?uf=brand",
        "cat": "Appliances > gefu"
    },
    {
        "url": "/browse/home-and-garden/brand--george-foreman?uf=brand",
        "cat": "Appliances > George Foreman"
    },
    {
        "url": "/browse/home-and-garden/brand--gfw?uf=brand",
        "cat": "Appliances > GFW"
    },
    {
        "url": "/browse/home-and-garden/brand--glamhaus?uf=brand",
        "cat": "Appliances > Glamhaus"
    },
    {
        "url": "/browse/home-and-garden/brand--globel?uf=brand",
        "cat": "Appliances > Globel"
    },
    {
        "url": "/browse/home-and-garden/brand--glow?uf=brand",
        "cat": "Appliances > Glow"
    },
    {
        "url": "/browse/home-and-garden/brand--good-food?uf=brand",
        "cat": "Appliances > Good Food by Tower"
    },
    {
        "url": "/browse/home-and-garden/brand--good-food-by-tower?uf=brand",
        "cat": "Appliances > Good Food by Tower"
    },
    {
        "url": "/browse/home-and-garden/brand--greenpan?uf=brand",
        "cat": "Appliances > GreenPan"
    },
    {
        "url": "/browse/home-and-garden/brand--gym-plus-coffee?uf=brand",
        "cat": "Appliances > Gym + Coffee"
    },
    {
        "url": "/browse/home-and-garden/brand--harlequin?uf=brand",
        "cat": "Appliances > Harlequin"
    },
    {
        "url": "/browse/home-and-garden/brand--harrington-s?uf=brand",
        "cat": "Appliances > Harrington S"
    },
    {
        "url": "/browse/home-and-garden/brand--harris?uf=brand",
        "cat": "Appliances > Harris"
    },
    {
        "url": "/browse/home-and-garden/brand--harry-potter?uf=brand",
        "cat": "Appliances > Harry Potter"
    },
    {
        "url": "/browse/home-and-garden/brand--hatchwells?uf=brand",
        "cat": "Appliances > hatchwells"
    },
    {
        "url": "/browse/home-and-garden/brand--hauck?uf=brand",
        "cat": "Appliances > Hauck"
    },
    {
        "url": "/browse/home-and-garden/brand--havanna?uf=brand",
        "cat": "Appliances > HAVANNA"
    },
    {
        "url": "/browse/home-and-garden/brand--heat-holders?uf=brand",
        "cat": "Appliances > Heat Holders"
    },
    {
        "url": "/browse/home-and-garden/brand--heaven-sends?uf=brand",
        "cat": "Appliances > Heaven Sends"
    },
    {
        "url": "/browse/home-and-garden/brand--helena-springfield?uf=brand",
        "cat": "Appliances > Helena Springfield"
    },
    {
        "url": "/browse/home-and-garden/brand--hello-kitty?uf=brand",
        "cat": "Appliances > Hello Kitty"
    },
    {
        "url": "/browse/home-and-garden/brand--hestia?uf=brand",
        "cat": "Appliances > Hestia"
    },
    {
        "url": "/browse/home-and-garden/brand--heya-home?uf=brand",
        "cat": "Appliances > Heya Home"
    },
    {
        "url": "/browse/home-and-garden/brand--hilka?uf=brand",
        "cat": "Appliances > Hilka"
    },
    {
        "url": "/browse/home-and-garden/brand--hoem?uf=brand",
        "cat": "Appliances > HOEM"
    },
    {
        "url": "/browse/home-and-garden/brand--holden-decor?uf=brand",
        "cat": "Appliances > Holden Decor"
    },
    {
        "url": "/browse/home-and-garden/brand--home-vida?uf=brand",
        "cat": "Appliances > Home Vida"
    },
    {
        "url": "/browse/home-and-garden/brand--homemaker?uf=brand",
        "cat": "Appliances > Homemaker"
    },
    {
        "url": "/browse/home-and-garden/brand--hometime?uf=brand",
        "cat": "Appliances > Hometime"
    },
    {
        "url": "/browse/home-and-garden/brand--hot-wheels?uf=brand",
        "cat": "Appliances > Hot Wheels"
    },
    {
        "url": "/browse/home-and-garden/brand--hultafors?uf=brand",
        "cat": "Appliances > Hultafors"
    },
    {
        "url": "/browse/home-and-garden/brand--hydro-flask?uf=brand",
        "cat": "Appliances > Hydro Flask"
    },
    {
        "url": "/browse/home-and-garden/brand--hyperion?uf=brand",
        "cat": "Appliances > Hyperion"
    },
    {
        "url": "/browse/home-and-garden/brand--icon-beanbags?uf=brand",
        "cat": "Appliances > Icon Beanbags"
    },
    {
        "url": "/browse/home-and-garden/brand--inhome?uf=brand",
        "cat": "Appliances > InHome"
    },
    {
        "url": "/browse/home-and-garden/brand--interiors-by-premier?uf=brand",
        "cat": "Appliances > Interiors By Premier"
    },
    {
        "url": "/browse/home-and-garden/brand--interval?uf=brand",
        "cat": "Appliances > Interval"
    },
    {
        "url": "/browse/home-and-garden/brand--intex?uf=brand",
        "cat": "Appliances > Intex"
    },
    {
        "url": "/browse/home-and-garden/brand--iquties?uf=brand",
        "cat": "Appliances > iQuties"
    },
    {
        "url": "/browse/home-and-garden/brand--iron-man?uf=brand",
        "cat": "Appliances > Iron Man"
    },
    {
        "url": "/browse/home-and-garden/brand--james-wellbeloved?uf=brand",
        "cat": "Appliances > James Wellbeloved"
    },
    {
        "url": "/browse/home-and-garden/brand--jamie-oliver?uf=brand",
        "cat": "Appliances > Jamie Oliver"
    },
    {
        "url": "/browse/home-and-garden/brand--jaws?uf=brand",
        "cat": "Appliances > Jaws"
    },
    {
        "url": "/browse/home-and-garden/brand--jaybe?uf=brand",
        "cat": "Appliances > Jaybe"
    },
    {
        "url": "/browse/home-and-garden/brand--jml?uf=brand",
        "cat": "Appliances > JML"
    },
    {
        "url": "/browse/home-and-garden/brand--joseph-joseph?uf=brand",
        "cat": "Appliances > Joseph Joseph"
    },
    {
        "url": "/browse/home-and-garden/brand--joules?uf=brand",
        "cat": "Appliances > Joules"
    },
    {
        "url": "/browse/home-and-garden/brand--jual?uf=brand",
        "cat": "Appliances > Jual"
    },
    {
        "url": "/browse/home-and-garden/brand--julian-bowen?uf=brand",
        "cat": "Appliances > Julian Bowen"
    },
    {
        "url": "/browse/home-and-garden/brand--julian-mcdonald?uf=brand",
        "cat": "Appliances > Julian McDonald"
    },
    {
        "url": "/browse/home-and-garden/brand--julius-k9?uf=brand",
        "cat": "Appliances > Julius K9"
    },
    {
        "url": "/browse/home-and-garden/brand--k-pop-demon-hunters?uf=brand",
        "cat": "Appliances > K-Pop Demon Hunters"
    },
    {
        "url": "/browse/home-and-garden/brand--kaikoo?uf=brand",
        "cat": "Appliances > KAIKOO"
    },
    {
        "url": "/browse/home-and-garden/brand--kapro?uf=brand",
        "cat": "Appliances > Kapro"
    },
    {
        "url": "/browse/home-and-garden/brand--karcher?uf=brand",
        "cat": "Appliances > Karcher"
    },
    {
        "url": "/browse/home-and-garden/brand--katie-loxton?uf=brand",
        "cat": "Appliances > Katie Loxton"
    },
    {
        "url": "/browse/home-and-garden/brand--kaytee?uf=brand",
        "cat": "Appliances > Kaytee"
    },
    {
        "url": "/browse/home-and-garden/brand--ken-hom?uf=brand",
        "cat": "Appliances > Ken Hom"
    },
    {
        "url": "/browse/home-and-garden/brand--keter?uf=brand",
        "cat": "Appliances > Keter"
    },
    {
        "url": "/browse/home-and-garden/brand--kids?uf=brand",
        "cat": "Appliances > Kids"
    },
    {
        "url": "/browse/home-and-garden/brand--kilner?uf=brand",
        "cat": "Appliances > KILNER"
    },
    {
        "url": "/browse/home-and-garden/brand--kitchenaid?uf=brand",
        "cat": "Appliances > KitchenAid"
    },
    {
        "url": "/browse/home-and-garden/brand--kitchencraft?uf=brand",
        "cat": "Appliances > KitchenCraft"
    },
    {
        "url": "/browse/home-and-garden/brand--kiwi-walker?uf=brand",
        "cat": "Appliances > Kiwi Walker"
    },
    {
        "url": "/browse/home-and-garden/brand--komar?uf=brand",
        "cat": "Appliances > Komar"
    },
    {
        "url": "/browse/home-and-garden/brand--kong?uf=brand",
        "cat": "Appliances > Kong"
    },
    {
        "url": "/browse/home-and-garden/brand--land-and-shore?uf=brand",
        "cat": "Appliances > Land & Shore"
    },
    {
        "url": "/browse/home-and-garden/brand--laura-ashley?uf=brand",
        "cat": "Appliances > Laura Ashley"
    },
    {
        "url": "/browse/home-and-garden/brand--laurence-llewelyn-bowen?uf=brand",
        "cat": "Appliances > Laurence Llewelyn-Bowen"
    },
    {
        "url": "/browse/home-and-garden/brand--lay-z-spa?uf=brand",
        "cat": "Appliances > Lay-Z-Spa"
    },
    {
        "url": "/browse/home-and-garden/brand--le-creuset?uf=brand",
        "cat": "Appliances > Le Creuset"
    },
    {
        "url": "/promo/lego/home-and-garden",
        "cat": "Appliances > LEGO"
    },
    {
        "url": "/browse/home-and-garden/brand--liberty-house?uf=brand",
        "cat": "Appliances > Liberty House"
    },
    {
        "url": "/browse/home-and-garden/brand--lifeventure?uf=brand",
        "cat": "Appliances > Lifeventure"
    },
    {
        "url": "/browse/home-and-garden/brand--lighthouse?uf=brand",
        "cat": "Appliances > Lighthouse"
    },
    {
        "url": "/browse/home-and-garden/brand--lights4fun?uf=brand",
        "cat": "Appliances > Lights4Fun"
    },
    {
        "url": "/browse/home-and-garden/brand--lilo-and-stitch?uf=brand",
        "cat": "Appliances > Lilo & Stitch"
    },
    {
        "url": "/browse/home-and-garden/brand--litter-robot?uf=brand",
        "cat": "Appliances > Litter Robot"
    },
    {
        "url": "/browse/home-and-garden/brand--little-acorns?uf=brand",
        "cat": "Appliances > Little Acorns"
    },
    {
        "url": "/browse/home-and-garden/brand--little-bianca?uf=brand",
        "cat": "Appliances > Little Bianca"
    },
    {
        "url": "/browse/home-and-garden/brand--liverpool-fc?uf=brand",
        "cat": "Appliances > Liverpool FC"
    },
    {
        "url": "/browse/home-and-garden/brand--living-and-home?uf=brand",
        "cat": "Appliances > Living and Home"
    },
    {
        "url": "/browse/home-and-garden/brand--lobster-creek?uf=brand",
        "cat": "Appliances > Lobster Creek"
    },
    {
        "url": "/browse/home-and-garden/brand--lock-and-lock?uf=brand",
        "cat": "Appliances > Lock and Lock"
    },
    {
        "url": "/browse/home-and-garden/brand--lords-and-labradors?uf=brand",
        "cat": "Appliances > Lord and Labradors"
    },
    {
        "url": "/browse/home-and-garden/brand--lord-of-the-rings?uf=brand",
        "cat": "Appliances > Lord of the Rings"
    },
    {
        "url": "/browse/home-and-garden/brand--love-abode?uf=brand",
        "cat": "Appliances > Love Abode"
    },
    {
        "url": "/browse/home-and-garden/brand--lpd-furniture?uf=brand",
        "cat": "Appliances > LPD Furniture"
    },
    {
        "url": "/browse/home-and-garden/brand--lpd-home?uf=brand",
        "cat": "Appliances > LPD Home"
    },
    {
        "url": "/browse/home-and-garden/brand--luvanto?uf=brand",
        "cat": "Appliances > Luvanto"
    },
    {
        "url": "/browse/home-and-garden/brand--m-pets?uf=brand",
        "cat": "Appliances > M Pets"
    },
    {
        "url": "/browse/home-and-garden/brand--made-by-zen?uf=brand",
        "cat": "Appliances > Made by Zen"
    },
    {
        "url": "/browse/home-and-garden/brand--makita?uf=brand",
        "cat": "Appliances > Makita"
    },
    {
        "url": "/browse/home-and-garden/brand--mamas-and-papas?uf=brand",
        "cat": "Appliances > Mamas & Papas"
    },
    {
        "url": "/browse/home-and-garden/brand--manchester-city?uf=brand",
        "cat": "Appliances > Manchester City"
    },
    {
        "url": "/browse/home-and-garden/brand--manchester-united?uf=brand",
        "cat": "Appliances > Manchester United"
    },
    {
        "url": "/browse/home-and-garden/brand--marshaltown?uf=brand",
        "cat": "Appliances > Marshaltown"
    },
    {
        "url": "/browse/home-and-garden/brand--marvel?uf=brand",
        "cat": "Appliances > Marvel"
    },
    {
        "url": "/browse/home-and-garden/brand--marvel-avengers?uf=brand",
        "cat": "Appliances > Marvel Avengers"
    },
    {
        "url": "/browse/home-and-garden/brand--marvel-comics?uf=brand",
        "cat": "Appliances > marvel comics"
    },
    {
        "url": "/browse/home-and-garden/brand--marvel-spiderman?uf=brand",
        "cat": "Appliances > Marvel Spiderman"
    },
    {
        "url": "/browse/home-and-garden/brand--mason-cash?uf=brand",
        "cat": "Appliances > Mason Cash"
    },
    {
        "url": "/browse/home-and-garden/brand--masterclass?uf=brand",
        "cat": "Appliances > MasterClass"
    },
    {
        "url": "/browse/home-and-garden/brand--matthew-williamson?uf=brand",
        "cat": "Appliances > Matthew Williamson"
    },
    {
        "url": "/browse/home-and-garden/brand--maxwell-and-williams?uf=brand",
        "cat": "Appliances > Maxwell & Williams"
    },
    {
        "url": "/browse/home-and-garden/brand--me-to-you?uf=brand",
        "cat": "Appliances > Me To You"
    },
    {
        "url": "/browse/home-and-garden/brand--meater?uf=brand",
        "cat": "Appliances > meater"
    },
    {
        "url": "/browse/home-and-garden/brand--menkind?uf=brand",
        "cat": "Appliances > MenKind"
    },
    {
        "url": "/browse/home-and-garden/brand--mercia?uf=brand",
        "cat": "Appliances > MERCIA"
    },
    {
        "url": "/browse/home-and-garden/brand--metabo?uf=brand",
        "cat": "Appliances > Metabo"
    },
    {
        "url": "/browse/home-and-garden/brand--meyer?uf=brand",
        "cat": "Appliances > MEYER"
    },
    {
        "url": "/promo/michelle-keegan/home-and-garden",
        "cat": "Appliances > Michelle Keegan"
    },
    {
        "url": "/browse/home-and-garden/brand--michelle-keegan-home?uf=brand",
        "cat": "Appliances > Michelle Keegan Home"
    },
    {
        "url": "/browse/home-and-garden/brand--mickey-mouse?uf=brand",
        "cat": "Appliances > Mickey Mouse"
    },
    {
        "url": "/browse/home-and-garden/brand--miffy?uf=brand",
        "cat": "Appliances > Miffy"
    },
    {
        "url": "/browse/home-and-garden/brand--mikasa?uf=brand",
        "cat": "Appliances > Mikasa"
    },
    {
        "url": "/browse/home-and-garden/brand--minecraft?uf=brand",
        "cat": "Appliances > Minecraft"
    },
    {
        "url": "/browse/home-and-garden/brand--minions?uf=brand",
        "cat": "Appliances > Minions"
    },
    {
        "url": "/browse/home-and-garden/brand--minky?uf=brand",
        "cat": "Appliances > Minky"
    },
    {
        "url": "/browse/home-and-garden/brand--minnie-mouse?uf=brand",
        "cat": "Appliances > Minnie Mouse"
    },
    {
        "url": "/browse/home-and-garden/brand--monster-chocs?uf=brand",
        "cat": "Appliances > Monster Chocs"
    },
    {
        "url": "/browse/home-and-garden/brand--morphy-richards?uf=brand",
        "cat": "Appliances > Morphy Richards"
    },
    {
        "url": "/browse/home-and-garden/brand--morris-and-co?uf=brand",
        "cat": "Appliances > Morris & Co"
    },
    {
        "url": "/browse/home-and-garden/brand--mountfield?uf=brand",
        "cat": "Appliances > Mountfield"
    },
    {
        "url": "/browse/home-and-garden/brand--my-child?uf=brand",
        "cat": "Appliances > My Child"
    },
    {
        "url": "/browse/home-and-garden/brand--my-little-pony?uf=brand",
        "cat": "Appliances > My Little Pony"
    },
    {
        "url": "/browse/home-and-garden/brand--my-nature?uf=brand",
        "cat": "Appliances > My Nature"
    },
    {
        "url": "/browse/home-and-garden/brand--mylek?uf=brand",
        "cat": "Appliances > Mylek"
    },
    {
        "url": "/browse/home-and-garden/brand--n-gage?uf=brand",
        "cat": "Appliances > n gage"
    },
    {
        "url": "/browse/home-and-garden/brand--nba?uf=brand",
        "cat": "Appliances > NBA"
    },
    {
        "url": "/browse/home-and-garden/brand--neakasa?uf=brand",
        "cat": "Appliances > Neakasa"
    },
    {
        "url": "/browse/home-and-garden/brand--netflix?uf=brand",
        "cat": "Appliances > Netflix"
    },
    {
        "url": "/browse/home-and-garden/brand--night-lark?uf=brand",
        "cat": "Appliances > Night Lark"
    },
    {
        "url": "/browse/home-and-garden/brand--nightmare-before-christmas?uf=brand",
        "cat": "Appliances > Nightmare Before Christmas"
    },
    {
        "url": "/browse/home-and-garden/brand--nike?uf=brand",
        "cat": "Appliances > Nike"
    },
    {
        "url": "/browse/home-and-garden/brand--nike-max-fusion?uf=brand",
        "cat": "Appliances > Nike Max Fusion"
    },
    {
        "url": "/browse/home-and-garden/brand--nina-ottosson?uf=brand",
        "cat": "Appliances > Nina Ottosson"
    },
    {
        "url": "/browse/home-and-garden/brand--ninja?uf=brand",
        "cat": "Appliances > NINJA"
    },
    {
        "url": "/promo/nintendo/home-and-garden",
        "cat": "Appliances > Nintendo"
    },
    {
        "url": "/browse/home-and-garden/brand--nordlux?uf=brand",
        "cat": "Appliances > nordlux"
    },
    {
        "url": "/browse/home-and-garden/brand--novogratz?uf=brand",
        "cat": "Appliances > Novogratz"
    },
    {
        "url": "/browse/home-and-garden/brand--numskull?uf=brand",
        "cat": "Appliances > Numskull"
    },
    {
        "url": "/browse/home-and-garden/brand--nuwallpaper?uf=brand",
        "cat": "Appliances > NuWallpaper"
    },
    {
        "url": "/browse/home-and-garden/brand--nylabone?uf=brand",
        "cat": "Appliances > Nylabone"
    },
    {
        "url": "/browse/home-and-garden/brand--obaby?uf=brand",
        "cat": "Appliances > Obaby"
    },
    {
        "url": "/browse/home-and-garden/brand--one-call?uf=brand",
        "cat": "Appliances > One Call"
    },
    {
        "url": "/browse/home-and-garden/brand--orla-kiely?uf=brand",
        "cat": "Appliances > Orla Kiely"
    },
    {
        "url": "/browse/home-and-garden/brand--oti?uf=brand",
        "cat": "Appliances > oti"
    },
    {
        "url": "/browse/home-and-garden/brand--our-house?uf=brand",
        "cat": "Appliances > Our House"
    },
    {
        "url": "/browse/home-and-garden/brand--outsunny?uf=brand",
        "cat": "Appliances > OutSunny"
    },
    {
        "url": "/browse/home-and-garden/brand--oxo?uf=brand",
        "cat": "Appliances > OXO"
    },
    {
        "url": "/browse/home-and-garden/brand--pacific?uf=brand",
        "cat": "Appliances > Pacific"
    },
    {
        "url": "/browse/home-and-garden/brand--pacific-lifestyle?uf=brand",
        "cat": "Appliances > Pacific Lifestyle"
    },
    {
        "url": "/browse/home-and-garden/brand--paddington-bear?uf=brand",
        "cat": "Appliances > Paddington Bear"
    },
    {
        "url": "/browse/home-and-garden/brand--palram?uf=brand",
        "cat": "Appliances > Palram"
    },
    {
        "url": "/browse/home-and-garden/brand--panacea?uf=brand",
        "cat": "Appliances > panacea"
    },
    {
        "url": "/browse/home-and-garden/brand--panda?uf=brand",
        "cat": "Appliances > panda"
    },
    {
        "url": "/browse/home-and-garden/brand--panda-london?uf=brand",
        "cat": "Appliances > Panda London"
    },
    {
        "url": "/browse/home-and-garden/brand--paoletti?uf=brand",
        "cat": "Appliances > Paoletti"
    },
    {
        "url": "/browse/home-and-garden/brand--paw-patrol?uf=brand",
        "cat": "Appliances > Paw Patrol"
    },
    {
        "url": "/browse/home-and-garden/brand--pawhut?uf=brand",
        "cat": "Appliances > PawHut"
    },
    {
        "url": "/browse/home-and-garden/brand--peppa-pig?uf=brand",
        "cat": "Appliances > Peppa Pig"
    },
    {
        "url": "/browse/home-and-garden/brand--pet-brands?uf=brand",
        "cat": "Appliances > Pet Brands"
    },
    {
        "url": "/browse/home-and-garden/brand--pet-gear?uf=brand",
        "cat": "Appliances > Pet Gear"
    },
    {
        "url": "/browse/home-and-garden/brand--petcube?uf=brand",
        "cat": "Appliances > Petcube"
    },
    {
        "url": "/browse/home-and-garden/brand--peter-rabbit?uf=brand",
        "cat": "Appliances > Peter Rabbit"
    },
    {
        "url": "/browse/home-and-garden/brand--petkit?uf=brand",
        "cat": "Appliances > PetKit"
    },
    {
        "url": "/browse/home-and-garden/brand--petlibro?uf=brand",
        "cat": "Appliances > Petlibro"
    },
    {
        "url": "/browse/home-and-garden/brand--petsentials?uf=brand",
        "cat": "Appliances > Petsentials"
    },
    {
        "url": "/browse/home-and-garden/brand--philips-hue?uf=brand",
        "cat": "Appliances > Philips Hue"
    },
    {
        "url": "/browse/home-and-garden/brand--philips-wiz?uf=brand",
        "cat": "Appliances > Philips WiZ"
    },
    {
        "url": "/browse/home-and-garden/brand--pimpernel?uf=brand",
        "cat": "Appliances > pimpernel"
    },
    {
        "url": "/browse/home-and-garden/brand--pineapple-elephant?uf=brand",
        "cat": "Appliances > Pineapple Elephant"
    },
    {
        "url": "/browse/home-and-garden/brand--pit-boss?uf=brand",
        "cat": "Appliances > pit boss"
    },
    {
        "url": "/promo/playstation/home-and-garden",
        "cat": "Appliances > Playstation"
    },
    {
        "url": "/browse/home-and-garden/brand--pokemon?uf=brand",
        "cat": "Appliances > Pokemon"
    },
    {
        "url": "/browse/home-and-garden/brand--portmeirion?uf=brand",
        "cat": "Appliances > Portmeirion"
    },
    {
        "url": "/browse/home-and-garden/brand--premier-housewares?uf=brand",
        "cat": "Appliances > Premier Housewares"
    },
    {
        "url": "/browse/home-and-garden/brand--pressure-king-pro?uf=brand",
        "cat": "Appliances > Pressure King Pro"
    },
    {
        "url": "/browse/home-and-garden/brand--prestige?uf=brand",
        "cat": "Appliances > Prestige"
    },
    {
        "url": "/browse/home-and-garden/brand--price-and-kensington?uf=brand",
        "cat": "Appliances > Price & Kensington"
    },
    {
        "url": "/browse/home-and-garden/brand--purdy?uf=brand",
        "cat": "Appliances > Purdy"
    },
    {
        "url": "/browse/home-and-garden/brand--purflo?uf=brand",
        "cat": "Appliances > PurFlo"
    },
    {
        "url": "/browse/home-and-garden/brand--pusheen?uf=brand",
        "cat": "Appliances > Pusheen"
    },
    {
        "url": "/browse/home-and-garden/brand--pyrex?uf=brand",
        "cat": "Appliances > Pyrex"
    },
    {
        "url": "/browse/home-and-garden/brand--quiksilver?uf=brand",
        "cat": "Appliances > Quiksilver"
    },
    {
        "url": "/browse/home-and-garden/brand--rac?uf=brand",
        "cat": "Appliances > RAC"
    },
    {
        "url": "/browse/home-and-garden/brand--radiant?uf=brand",
        "cat": "Appliances > Radiant"
    },
    {
        "url": "/browse/home-and-garden/brand--rasch?uf=brand",
        "cat": "Appliances > Rasch"
    },
    {
        "url": "/browse/home-and-garden/brand--ravenhead?uf=brand",
        "cat": "Appliances > Ravenhead"
    },
    {
        "url": "/browse/home-and-garden/brand--razer?uf=brand",
        "cat": "Appliances > Razer"
    },
    {
        "url": "/browse/home-and-garden/brand--rcr?uf=brand",
        "cat": "Appliances > RCR"
    },
    {
        "url": "/browse/home-and-garden/brand--red5?uf=brand",
        "cat": "Appliances > RED5"
    },
    {
        "url": "/browse/home-and-garden/brand--regatta?uf=brand",
        "cat": "Appliances > Regatta"
    },
    {
        "url": "/browse/home-and-garden/brand--rhs?uf=brand",
        "cat": "Appliances > RHS"
    },
    {
        "url": "/browse/home-and-garden/brand--rhs-x-catherine-lansfield?uf=brand",
        "cat": "Appliances > RHS X Catherine Lansfield"
    },
    {
        "url": "/browse/home-and-garden/brand--riva-home?uf=brand",
        "cat": "Appliances > Riva Home"
    },
    {
        "url": "/browse/home-and-garden/brand--ronhill?uf=brand",
        "cat": "Appliances > Ronhill"
    },
    {
        "url": "/browse/home-and-garden/brand--ronseal?uf=brand",
        "cat": "Appliances > Ronseal"
    },
    {
        "url": "/browse/home-and-garden/brand--rosewood?uf=brand",
        "cat": "Appliances > Rosewood"
    },
    {
        "url": "/browse/home-and-garden/brand--rosewood-x-battersea?uf=brand",
        "cat": "Appliances > Rosewood X Battersea"
    },
    {
        "url": "/browse/home-and-garden/brand--roughneck?uf=brand",
        "cat": "Appliances > Roughneck"
    },
    {
        "url": "/browse/home-and-garden/brand--rowlinson?uf=brand",
        "cat": "Appliances > Rowlinson"
    },
    {
        "url": "/browse/home-and-garden/brand--roxy?uf=brand",
        "cat": "Appliances > Roxy"
    },
    {
        "url": "/browse/home-and-garden/brand--royal-worcester?uf=brand",
        "cat": "Appliances > ROYAL WORCESTER"
    },
    {
        "url": "/browse/home-and-garden/brand--royalcraft?uf=brand",
        "cat": "Appliances > royalcraft"
    },
    {
        "url": "/browse/home-and-garden/brand--rucomfy?uf=brand",
        "cat": "Appliances > rucomfy"
    },
    {
        "url": "/browse/home-and-garden/brand--russell-hobbs?uf=brand",
        "cat": "Appliances > Russell Hobbs"
    },
    {
        "url": "/browse/home-and-garden/brand--rust-oleum?uf=brand",
        "cat": "Appliances > Rust-Oleum"
    },
    {
        "url": "/browse/home-and-garden/brand--ryobi?uf=brand",
        "cat": "Appliances > RYOBI"
    },
    {
        "url": "/browse/home-and-garden/brand--salomon?uf=brand",
        "cat": "Appliances > Salomon"
    },
    {
        "url": "/browse/home-and-garden/brand--salter?uf=brand",
        "cat": "Appliances > Salter"
    },
    {
        "url": "/browse/home-and-garden/brand--sam-faiers-little-knightleys?uf=brand",
        "cat": "Appliances > Sam Faiers Little Knightleys"
    },
    {
        "url": "/browse/home-and-garden/brand--sara-miller?uf=brand",
        "cat": "Appliances > Sara Miller"
    },
    {
        "url": "/browse/home-and-garden/brand--sassy-b?uf=brand",
        "cat": "Appliances > Sassy B"
    },
    {
        "url": "/browse/home-and-garden/brand--scottish-everlasting?uf=brand",
        "cat": "Appliances > scottish everlasting"
    },
    {
        "url": "/browse/home-and-garden/brand--scottish-everlastings?uf=brand",
        "cat": "Appliances > Scottish Everlastings"
    },
    {
        "url": "/browse/home-and-garden/brand--scoville?uf=brand",
        "cat": "Appliances > scoville"
    },
    {
        "url": "/browse/home-and-garden/brand--scruffs?uf=brand",
        "cat": "Appliances > Scruffs"
    },
    {
        "url": "/browse/home-and-garden/brand--sealy?uf=brand",
        "cat": "Appliances > Sealy"
    },
    {
        "url": "/browse/home-and-garden/brand--serene?uf=brand",
        "cat": "Appliances > Serene"
    },
    {
        "url": "/browse/home-and-garden/brand--shabby-chic?uf=brand",
        "cat": "Appliances > shabby chic"
    },
    {
        "url": "/browse/home-and-garden/brand--shabby-chic-by-rachel-ashwell?uf=brand",
        "cat": "Appliances > shabby chic by rachel ashwell"
    },
    {
        "url": "/browse/home-and-garden/brand--shark?uf=brand",
        "cat": "Appliances > Shark"
    },
    {
        "url": "/browse/home-and-garden/brand--shire-beds?uf=brand",
        "cat": "Appliances > Shire Beds"
    },
    {
        "url": "/browse/home-and-garden/brand--showerdrape?uf=brand",
        "cat": "Appliances > Showerdrape"
    },
    {
        "url": "/browse/home-and-garden/brand--shrek?uf=brand",
        "cat": "Appliances > Shrek"
    },
    {
        "url": "/browse/home-and-garden/brand--silentnight?uf=brand",
        "cat": "Appliances > Silentnight"
    },
    {
        "url": "/browse/home-and-garden/brand--silver-cross?uf=brand",
        "cat": "Appliances > Silver Cross"
    },
    {
        "url": "/browse/home-and-garden/brand--simba?uf=brand",
        "cat": "Appliances > Simba"
    },
    {
        "url": "/browse/home-and-garden/brand--sleepeezee?uf=brand",
        "cat": "Appliances > sleepeezee"
    },
    {
        "url": "/browse/home-and-garden/brand--sleepsoul?uf=brand",
        "cat": "Appliances > SleepSoul"
    },
    {
        "url": "/browse/home-and-garden/brand--slumberdown?uf=brand",
        "cat": "Appliances > Slumberdown"
    },
    {
        "url": "/browse/home-and-garden/brand--smart-garden?uf=brand",
        "cat": "Appliances > Smart Garden"
    },
    {
        "url": "/browse/home-and-garden/brand--smart-solar?uf=brand",
        "cat": "Appliances > Smart Solar"
    },
    {
        "url": "/browse/home-and-garden/brand--smeg?uf=brand",
        "cat": "Appliances > Smeg"
    },
    {
        "url": "/browse/home-and-garden/brand--snug?uf=brand",
        "cat": "Appliances > Snug"
    },
    {
        "url": "/browse/home-and-garden/brand--snuggledown-of-norway?uf=brand",
        "cat": "Appliances > Snuggledown of Norway"
    },
    {
        "url": "/browse/home-and-garden/brand--snuz?uf=brand",
        "cat": "Appliances > Snuz"
    },
    {
        "url": "/browse/home-and-garden/brand--sodastream?uf=brand",
        "cat": "Appliances > SodaStream"
    },
    {
        "url": "/browse/home-and-garden/brand--soiree?uf=brand",
        "cat": "Appliances > Soiree"
    },
    {
        "url": "/browse/home-and-garden/brand--sonic-the-hedgehog?uf=brand",
        "cat": "Appliances > Sonic the Hedgehog"
    },
    {
        "url": "/browse/home-and-garden/brand--sophie-allport?uf=brand",
        "cat": "Appliances > Sophie Allport"
    },
    {
        "url": "/browse/home-and-garden/brand--spiderman?uf=brand",
        "cat": "Appliances > Spiderman"
    },
    {
        "url": "/browse/home-and-garden/brand--spode?uf=brand",
        "cat": "Appliances > Spode"
    },
    {
        "url": "/browse/home-and-garden/brand--spongebob-squarepants?uf=brand",
        "cat": "Appliances > Spongebob Squarepants"
    },
    {
        "url": "/browse/home-and-garden/brand--squishmallows?uf=brand",
        "cat": "Appliances > Squishmallows"
    },
    {
        "url": "/browse/home-and-garden/brand--stanley?uf=brand",
        "cat": "Appliances > Stanley"
    },
    {
        "url": "/browse/home-and-garden/brand--stanley-1913?uf=brand",
        "cat": "Appliances > Stanley 1913"
    },
    {
        "url": "/browse/home-and-garden/brand--stanley-fatmax?uf=brand",
        "cat": "Appliances > Stanley FatMax"
    },
    {
        "url": "/browse/home-and-garden/brand--star-wars?uf=brand",
        "cat": "Appliances > Star Wars"
    },
    {
        "url": "/browse/home-and-garden/brand--stoneglow?uf=brand",
        "cat": "Appliances > Stoneglow"
    },
    {
        "url": "/browse/home-and-garden/brand--stranger-things?uf=brand",
        "cat": "Appliances > Stranger Things"
    },
    {
        "url": "/browse/home-and-garden/brand--streetwize?uf=brand",
        "cat": "Appliances > Streetwize"
    },
    {
        "url": "/browse/home-and-garden/brand--streetwize-accessories?uf=brand",
        "cat": "Appliances > Streetwize Accessories"
    },
    {
        "url": "/browse/home-and-garden/brand--sublime?uf=brand",
        "cat": "Appliances > Sublime"
    },
    {
        "url": "/browse/home-and-garden/brand--navigate?uf=brand",
        "cat": "Appliances > Summerhouse by Navigate"
    },
    {
        "url": "/browse/home-and-garden/brand--summerhouse-by-navigate?uf=brand",
        "cat": "Appliances > Summerhouse by Navigate"
    },
    {
        "url": "/browse/home-and-garden/brand--suncast?uf=brand",
        "cat": "Appliances > Suncast"
    },
    {
        "url": "/browse/home-and-garden/brand--super-mario?uf=brand",
        "cat": "Appliances > Super Mario"
    },
    {
        "url": "/browse/home-and-garden/brand--superfresco?uf=brand",
        "cat": "Appliances > Superfresco"
    },
    {
        "url": "/browse/home-and-garden/brand--superfresco-easy?uf=brand",
        "cat": "Appliances > Superfresco Easy"
    },
    {
        "url": "/browse/home-and-garden/brand--superfresco-paintable?uf=brand",
        "cat": "Appliances > Superfresco Paintable"
    },
    {
        "url": "/browse/home-and-garden/brand--superman?uf=brand",
        "cat": "Appliances > Superman"
    },
    {
        "url": "/browse/home-and-garden/brand--sur-la-table?uf=brand",
        "cat": "Appliances > Sur La Table"
    },
    {
        "url": "/browse/home-and-garden/brand--swan?uf=brand",
        "cat": "Appliances > Swan"
    },
    {
        "url": "/browse/home-and-garden/brand--sweaty-betty?uf=brand",
        "cat": "Appliances > Sweaty Betty"
    },
    {
        "url": "/browse/home-and-garden/brand--swift?uf=brand",
        "cat": "Appliances > SWIFT"
    },
    {
        "url": "/browse/home-and-garden/brand--tavo?uf=brand",
        "cat": "Appliances > Tavo"
    },
    {
        "url": "/browse/home-and-garden/brand--teamson-home?uf=brand",
        "cat": "Appliances > Teamson Home"
    },
    {
        "url": "/browse/home-and-garden/brand--teamson-kids?uf=brand",
        "cat": "Appliances > Teamson Kids"
    },
    {
        "url": "/promo/ted-baker/home-and-garden",
        "cat": "Appliances > Ted Baker"
    },
    {
        "url": "/browse/home-and-garden/brand--tefal?uf=brand",
        "cat": "Appliances > Tefal"
    },
    {
        "url": "/browse/home-and-garden/brand--the-aromatherapy-co?uf=brand",
        "cat": "Appliances > The Aromatherapy Co."
    },
    {
        "url": "/browse/home-and-garden/brand--the-art-group?uf=brand",
        "cat": "Appliances > The Art Group"
    },
    {
        "url": "/browse/home-and-garden/brand--the-fine-bedding-company?uf=brand",
        "cat": "Appliances > The Fine Bedding Company"
    },
    {
        "url": "/browse/home-and-garden/brand--the-gruffalo?uf=brand",
        "cat": "Appliances > The Gruffalo"
    },
    {
        "url": "/browse/home-and-garden/brand--the-lyndon-co?uf=brand",
        "cat": "Appliances > The Lyndon Co"
    },
    {
        "url": "/browse/home-and-garden/brand--the-personalised-memento-company?uf=brand",
        "cat": "Appliances > The Personalised Memento Company"
    },
    {
        "url": "/browse/home-and-garden/brand--the-very-collection?uf=brand",
        "cat": "Appliances > The Very Collection"
    },
    {
        "url": "/browse/home-and-garden/brand--the-very-hungry-caterpillar?uf=brand",
        "cat": "Appliances > The Very Hungry Caterpillar"
    },
    {
        "url": "/browse/home-and-garden/brand--their-nibs?uf=brand",
        "cat": "Appliances > Their Nibs"
    },
    {
        "url": "/browse/home-and-garden/brand--thermos?uf=brand",
        "cat": "Appliances > Thermos"
    },
    {
        "url": "/browse/home-and-garden/brand--tommee-tippee?uf=brand",
        "cat": "Appliances > Tommee Tippee"
    },
    {
        "url": "/browse/home-and-garden/brand--tottenham-hotspur-fc?uf=brand",
        "cat": "Appliances > Tottenham Hotspur FC"
    },
    {
        "url": "/browse/home-and-garden/brand--tower?uf=brand",
        "cat": "Appliances > Tower"
    },
    {
        "url": "/browse/home-and-garden/brand--toy-story?uf=brand",
        "cat": "Appliances > Toy Story"
    },
    {
        "url": "/browse/home-and-garden/brand--tp-link?uf=brand",
        "cat": "Appliances > TP Link"
    },
    {
        "url": "/browse/home-and-garden/brand--traeger?uf=brand",
        "cat": "Appliances > traeger"
    },
    {
        "url": "/browse/home-and-garden/brand--triton?uf=brand",
        "cat": "Appliances > Triton"
    },
    {
        "url": "/browse/home-and-garden/brand--trust?uf=brand",
        "cat": "Appliances > Trust"
    },
    {
        "url": "/browse/home-and-garden/brand--tutti-bambini?uf=brand",
        "cat": "Appliances > Tutti Bambini"
    },
    {
        "url": "/browse/home-and-garden/brand--typhoon?uf=brand",
        "cat": "Appliances > Typhoon"
    },
    {
        "url": "/browse/home-and-garden/brand--valuelights?uf=brand",
        "cat": "Appliances > ValueLights"
    },
    {
        "url": "/browse/home-and-garden/brand--vango?uf=brand",
        "cat": "Appliances > Vango"
    },
    {
        "url": "/browse/home-and-garden/brand--velcro?uf=brand",
        "cat": "Appliances > Velcro"
    },
    {
        "url": "/browse/home-and-garden/brand--versace?uf=brand",
        "cat": "Appliances > VERSACE"
    },
    {
        "url": "/browse/home-and-garden/brand--very-home?uf=brand",
        "cat": "Appliances > Very Home"
    },
    {
        "url": "/browse/home-and-garden/brand--vida-designs?uf=brand",
        "cat": "Appliances > Vida Designs"
    },
    {
        "url": "/browse/home-and-garden/brand--vileda?uf=brand",
        "cat": "Appliances > Vileda"
    },
    {
        "url": "/browse/home-and-garden/brand--viners?uf=brand",
        "cat": "Appliances > Viners"
    },
    {
        "url": "/browse/home-and-garden/brand--vonhaus?uf=brand",
        "cat": "Appliances > Vonhaus"
    },
    {
        "url": "/browse/home-and-garden/brand--vonshef?uf=brand",
        "cat": "Appliances > VonShef"
    },
    {
        "url": "/browse/home-and-garden/brand--vox?uf=brand",
        "cat": "Appliances > VOX"
    },
    {
        "url": "/browse/home-and-garden/brand--voyage?uf=brand",
        "cat": "Appliances > Voyage"
    },
    {
        "url": "/browse/home-and-garden/brand--vymura?uf=brand",
        "cat": "Appliances > Vymura"
    },
    {
        "url": "/browse/home-and-garden/brand--wagner?uf=brand",
        "cat": "Appliances > Wagner"
    },
    {
        "url": "/browse/home-and-garden/brand--wags?uf=brand",
        "cat": "Appliances > Wags"
    },
    {
        "url": "/browse/home-and-garden/brand--wall-doctor?uf=brand",
        "cat": "Appliances > Wall Doctor"
    },
    {
        "url": "/browse/home-and-garden/brand--walplus?uf=brand",
        "cat": "Appliances > Walplus"
    },
    {
        "url": "/browse/home-and-garden/brand--waterside?uf=brand",
        "cat": "Appliances > WATERSIDE"
    },
    {
        "url": "/browse/home-and-garden/brand--weber?uf=brand",
        "cat": "Appliances > Weber"
    },
    {
        "url": "/browse/home-and-garden/brand--wednesday?uf=brand",
        "cat": "Appliances > Wednesday"
    },
    {
        "url": "/browse/home-and-garden/brand--werner?uf=brand",
        "cat": "Appliances > Werner"
    },
    {
        "url": "/browse/home-and-garden/brand--west-ham-united?uf=brand",
        "cat": "Appliances > West Ham United"
    },
    {
        "url": "/browse/home-and-garden/brand--wham?uf=brand",
        "cat": "Appliances > Wham"
    },
    {
        "url": "/browse/home-and-garden/brand--whitefurze?uf=brand",
        "cat": "Appliances > whitefurze"
    },
    {
        "url": "/browse/home-and-garden/brand--wicked?uf=brand",
        "cat": "Appliances > Wicked"
    },
    {
        "url": "/browse/home-and-garden/brand--william-morris-at-home?uf=brand",
        "cat": "Appliances > William Morris at Home"
    },
    {
        "url": "/browse/home-and-garden/brand--wilsonart?uf=brand",
        "cat": "Appliances > wilsonart"
    },
    {
        "url": "/browse/home-and-garden/brand--winnie-the-pooh?uf=brand",
        "cat": "Appliances > Winnie The Pooh"
    },
    {
        "url": "/browse/home-and-garden/brand--withings?uf=brand",
        "cat": "Appliances > Withings"
    },
    {
        "url": "/browse/home-and-garden/brand--woodwick?uf=brand",
        "cat": "Appliances > WoodWick"
    },
    {
        "url": "/browse/home-and-garden/brand--worx?uf=brand",
        "cat": "Appliances > Worx"
    },
    {
        "url": "/browse/home-and-garden/brand--wylder?uf=brand",
        "cat": "Appliances > Wylder"
    },
    {
        "url": "/browse/home-and-garden/brand--x-rocker?uf=brand",
        "cat": "Appliances > X Rocker"
    },
    {
        "url": "/promo/xbox/home-and-garden",
        "cat": "Appliances > Xbox"
    },
    {
        "url": "/browse/home-and-garden/brand--xr-living?uf=brand",
        "cat": "Appliances > XR Living"
    },
    {
        "url": "/browse/home-and-garden/brand--yankee-candle?uf=brand",
        "cat": "Appliances > Yankee Candle"
    },
    {
        "url": "/browse/home-and-garden/brand--yard?uf=brand",
        "cat": "Appliances > Yard"
    },
    {
        "url": "/browse/home-and-garden/brand--yard-force?uf=brand",
        "cat": "Appliances > Yard Force"
    },
    {
        "url": "/browse/home-and-garden/brand--yardmaster?uf=brand",
        "cat": "Appliances > Yardmaster"
    },
    {
        "url": "/browse/home-and-garden/brand--yeowww?uf=brand",
        "cat": "Appliances > Yeowww!"
    },
    {
        "url": "/browse/home-and-garden/brand--you-garden?uf=brand",
        "cat": "Appliances > You Garden"
    },
    {
        "url": "/browse/home-and-garden/brand--yvonne-ellen?uf=brand",
        "cat": "Appliances > Yvonne Ellen"
    },
    {
        "url": "/browse/home-and-garden/brand--zanussi?uf=brand",
        "cat": "Appliances > Zanussi"
    },
    {
        "url": "/browse/home-and-garden/brand--zinc?uf=brand",
        "cat": "Appliances > Zinc"
    },
    {
        "url": "/browse/home-and-garden/brand--zinsser?uf=brand",
        "cat": "Appliances > Zinsser"
    },
    {
        "url": "/browse/home-and-garden/brand--zog?uf=brand",
        "cat": "Appliances > Zog"
    },
    {
        "url": "/browse/home-and-garden/brand--zoon?uf=brand",
        "cat": "Appliances > Zoon"
    },
    {
        "url": "/browse/home-and-garden/brand--zyliss?uf=brand",
        "cat": "Appliances > zyliss"
    }
];

var cat2=[
    {
        "url": "/browse/appliances-washing-machines",
        "cat": "Appliances > Washing Machines"
    },
    {
        "url": "/browse/appliances-tumble-dryers",
        "cat": "Appliances > Tumble Dryers"
    },
    {
        "url": "/browse/appliances-washer-dryers",
        "cat": "Appliances > Washer Dryers"
    },
    {
        "url": "/browse/appliances-irons",
        "cat": "Appliances > Irons"
    },
    {
        "url": "/browse/appliances-cookers",
        "cat": "Appliances > Cookers"
    },
    {
        "url": "/browse/appliances-cooker-hoods",
        "cat": "Appliances > Cooker Hoods"
    },
    {
        "url": "/browse/appliances-hobs",
        "cat": "Appliances > Hobs"
    },
    {
        "url": "/browse/appliances-ovens",
        "cat": "Appliances > Ovens"
    },
    {
        "url": "/browse/appliances-dishwashers",
        "cat": "Appliances > Dishwashers"
    },
    {
        "url": "/browse/appliances-fridge-freezers",
        "cat": "Appliances > Fridge Freezers"
    },
    {
        "url": "/browse/appliances-fridges",
        "cat": "Appliances > Fridges"
    },
    {
        "url": "/browse/appliances-freezers",
        "cat": "Appliances > Freezers"
    },
    {
        "url": "/browse/appliances-wine-coolers",
        "cat": "Appliances > Wine Coolers"
    },
    {
        "url": "/browse/appliances-vacuum-cleaners",
        "cat": "Appliances > Vacuum Cleaners"
    },
    {
        "url": "/browse/appliances-steam-cleaners",
        "cat": "Appliances > Steam Cleaners"
    },
    {
        "url": "/browse/appliances-carpet-cleaners",
        "cat": "Appliances > Carpet Cleaners"
    },
    {
        "url": "/browse/appliances-hard-floor-cleaners",
        "cat": "Appliances > Hard Floor Cleaners"
    },
    {
        "url": "/browse/appliances-floorcare-accessories-and-solutions",
        "cat": "Appliances > Floorcare Accessories & Solutions"
    },
    {
        "url": "/browse/appliances-heaters",
        "cat": "Appliances > Heaters"
    },
    {
        "url": "/browse/appliances-fires",
        "cat": "Appliances > Fires"
    },
    {
        "url": "/browse/appliances-fans",
        "cat": "Appliances > Fans"
    },
    {
        "url": "/browse/appliances-air-conditioning",
        "cat": "Appliances > Air Conditioning"
    },
    {
        "url": "/browse/appliances-dehumidifiers",
        "cat": "Appliances > Dehumidifiers"
    },
    {
        "url": "/browse/appliances-air-purifiers",
        "cat": "Appliances > Air Purifiers"
    },
    {
        "url": "/browse/appliances-kettles-and-toasters",
        "cat": "Appliances > Kettles & Toasters"
    },
    {
        "url": "/browse/appliances-coffee-machines",
        "cat": "Appliances > Coffee Machines"
    },
    {
        "url": "/browse/appliances-microwaves",
        "cat": "Appliances > Microwaves"
    },
    {
        "url": "/browse/appliances-cooking-appliances",
        "cat": "Appliances > Cooking Appliances"
    },
    {
        "url": "/browse/appliances-food-preparation",
        "cat": "Appliances > Food Preparation"
    },
    {
        "url": "/browse/appliances-cooking-appliances-air-fryers",
        "cat": "Appliances > Air Fryers"
    },
    {
        "url": "/browse/brand--samsung",
        "cat": "Appliances > Samsung"
    },
    {
        "url": "/browse/brand--ninja",
        "cat": "Appliances > Ninja"
    },
    {
        "url": "/browse/brand--shark",
        "cat": "Appliances > Shark"
    },
    {
        "url": "/browse/brand--dyson",
        "cat": "Appliances > Dyson"
    },
    {
        "url": "/browse/brand--hoover",
        "cat": "Appliances > Hoover"
    },
    {
        "url": "/browse/brand--hotpoint",
        "cat": "Appliances > Hotpoint"
    },
    {
        "url": "/browse/appliances/brand--bosch",
        "cat": "Appliances > Bosch"
    },
    {
        "url": "/browse/brand--lg",
        "cat": "Appliances > LG"
    },
    {
        "url": "/browse/brand--vax",
        "cat": "Appliances > Vax"
    },
    {
        "url": "/browse/brand--beko",
        "cat": "Appliances > Beko"
    }
];
var cat22=[
    {
        "url": "/browse/appliances/brand--adam-fires-and-fireplaces?uf=brand",
        "cat": "Appliances > Adam Fires & Fireplaces"
    },
    {
        "url": "/browse/appliances/brand--be-modern?uf=brand",
        "cat": "Appliances > Be Modern"
    },
    {
        "url": "/browse/appliances/brand--beko?uf=brand",
        "cat": "Appliances > Beko"
    },
    {
        "url": "/browse/appliances/brand--beldray?uf=brand",
        "cat": "Appliances > Beldray"
    },
    {
        "url": "/browse/appliances/brand--bissell?uf=brand",
        "cat": "Appliances > Bissell"
    },
    {
        "url": "/browse/appliances/brand--black-and-decker?uf=brand",
        "cat": "Appliances > Black & Decker"
    },
    {
        "url": "/browse/appliances/brand--blueair?uf=brand",
        "cat": "Appliances > Blueair"
    },
    {
        "url": "/browse/appliances/brand--bosch?uf=brand",
        "cat": "Appliances > Bosch"
    },
    {
        "url": "/browse/appliances/brand--braun?uf=brand",
        "cat": "Appliances > Braun"
    },
    {
        "url": "/browse/appliances/brand--breville?uf=brand",
        "cat": "Appliances > Breville"
    },
    {
        "url": "/browse/appliances/brand--brita?uf=brand",
        "cat": "Appliances > Brita"
    },
    {
        "url": "/browse/appliances/brand--candy?uf=brand",
        "cat": "Appliances > Candy"
    },
    {
        "url": "/browse/appliances/brand--caso?uf=brand",
        "cat": "Appliances > Caso"
    },
    {
        "url": "/browse/appliances/brand--crock-pot?uf=brand",
        "cat": "Appliances > Crock-Pot"
    },
    {
        "url": "/browse/appliances/brand--daewoo?uf=brand",
        "cat": "Appliances > Daewoo"
    },
    {
        "url": "/browse/appliances/brand--delonghi?uf=brand",
        "cat": "Appliances > DeLonghi"
    },
    {
        "url": "/browse/appliances/brand--dimplex?uf=brand",
        "cat": "Appliances > Dimplex"
    },
    {
        "url": "/browse/appliances/brand--dreame?uf=brand",
        "cat": "Appliances > Dreame"
    },
    {
        "url": "/browse/appliances/brand--dreamland?uf=brand",
        "cat": "Appliances > Dreamland"
    },
    {
        "url": "/browse/appliances/brand--dreo?uf=brand",
        "cat": "Appliances > Dreo"
    },
    {
        "url": "/browse/appliances/brand--drew-and-cole?uf=brand",
        "cat": "Appliances > Drew & Cole"
    },
    {
        "url": "/browse/appliances/brand--dualit?uf=brand",
        "cat": "Appliances > Dualit"
    },
    {
        "url": "/browse/appliances/brand--duux?uf=brand",
        "cat": "Appliances > Duux"
    },
    {
        "url": "/browse/appliances/brand--dyson?uf=brand",
        "cat": "Appliances > Dyson"
    },
    {
        "url": "/browse/appliances/brand--electrolux?uf=brand",
        "cat": "Appliances > Electrolux"
    },
    {
        "url": "/browse/appliances/brand--eufy?uf=brand",
        "cat": "Appliances > Eufy"
    },
    {
        "url": "/browse/appliances/brand--fridgemaster?uf=brand",
        "cat": "Appliances > Fridgemaster"
    },
    {
        "url": "/browse/appliances/brand--george-foreman?uf=brand",
        "cat": "Appliances > George Foreman"
    },
    {
        "url": "/browse/appliances/brand--giles-and-posner?uf=brand",
        "cat": "Appliances > Giles & Posner"
    },
    {
        "url": "/browse/appliances/brand--good-food-by-tower?uf=brand",
        "cat": "Appliances > Good Food by Tower"
    },
    {
        "url": "/browse/appliances/brand--greenpan?uf=brand",
        "cat": "Appliances > GreenPan"
    },
    {
        "url": "/browse/appliances/brand--haden?uf=brand",
        "cat": "Appliances > Haden"
    },
    {
        "url": "/browse/appliances/brand--haier?uf=brand",
        "cat": "Appliances > Haier"
    },
    {
        "url": "/browse/appliances/brand--hisense?uf=brand",
        "cat": "Appliances > Hisense"
    },
    {
        "url": "/browse/appliances/brand--hoover?uf=brand",
        "cat": "Appliances > Hoover"
    },
    {
        "url": "/browse/appliances/brand--hotpoint?uf=brand",
        "cat": "Appliances > Hotpoint"
    },
    {
        "url": "/browse/appliances/brand--indesit?uf=brand",
        "cat": "Appliances > Indesit"
    },
    {
        "url": "/browse/appliances/brand--instant?uf=brand",
        "cat": "Appliances > Instant"
    },
    {
        "url": "/browse/appliances/brand--instant-pot?uf=brand",
        "cat": "Appliances > Instant Pot"
    },
    {
        "url": "/browse/appliances/brand--jml?uf=brand",
        "cat": "Appliances > JML"
    },
    {
        "url": "/browse/appliances/brand--jura?uf=brand",
        "cat": "Appliances > Jura"
    },
    {
        "url": "/browse/appliances/brand--karcher?uf=brand",
        "cat": "Appliances > Karcher"
    },
    {
        "url": "/browse/appliances/brand--kenwood?uf=brand",
        "cat": "Appliances > Kenwood"
    },
    {
        "url": "/browse/appliances/brand--kitchenaid?uf=brand",
        "cat": "Appliances > KitchenAid"
    },
    {
        "url": "/browse/appliances/brand--krups?uf=brand",
        "cat": "Appliances > Krups"
    },
    {
        "url": "/browse/appliances/brand--kuhla?uf=brand",
        "cat": "Appliances > Kuhla"
    },
    {
        "url": "/browse/appliances/brand--laura-ashley?uf=brand",
        "cat": "Appliances > Laura Ashley"
    },
    {
        "url": "/browse/appliances/brand--lg?uf=brand",
        "cat": "Appliances > LG"
    },
    {
        "url": "/browse/appliances/brand--magimix?uf=brand",
        "cat": "Appliances > Magimix"
    },
    {
        "url": "/browse/appliances/brand--makita?uf=brand",
        "cat": "Appliances > Makita"
    },
    {
        "url": "/browse/appliances/brand--midea?uf=brand",
        "cat": "Appliances > midea"
    },
    {
        "url": "/browse/appliances/brand--moccamaster?uf=brand",
        "cat": "Appliances > moccamaster"
    },
    {
        "url": "/browse/appliances/brand--morphy-richards?uf=brand",
        "cat": "Appliances > Morphy Richards"
    },
    {
        "url": "/browse/appliances/brand--mova?uf=brand",
        "cat": "Appliances > Mova"
    },
    {
        "url": "/browse/appliances/brand--neff?uf=brand",
        "cat": "Appliances > Neff"
    },
    {
        "url": "/browse/appliances/brand--nescafe-dolce-gusto?uf=brand",
        "cat": "Appliances > Nescafe Dolce Gusto"
    },
    {
        "url": "/browse/appliances/brand--nespresso?uf=brand",
        "cat": "Appliances > Nespresso"
    },
    {
        "url": "/browse/appliances/brand--ninja?uf=brand",
        "cat": "Appliances > NINJA"
    },
    {
        "url": "/browse/appliances/brand--numatic-international?uf=brand",
        "cat": "Appliances > Numatic International"
    },
    {
        "url": "/browse/appliances/brand--nutribullet?uf=brand",
        "cat": "Appliances > NUTRIBULLET"
    },
    {
        "url": "/browse/appliances/brand--perfectdraft?uf=brand",
        "cat": "Appliances > perfectdraft"
    },
    {
        "url": "/browse/appliances/brand--polti?uf=brand",
        "cat": "Appliances > Polti"
    },
    {
        "url": "/browse/appliances/brand--portmeirion?uf=brand",
        "cat": "Appliances > Portmeirion"
    },
    {
        "url": "/browse/appliances/brand--power?uf=brand",
        "cat": "Appliances > Power"
    },
    {
        "url": "/browse/appliances/brand--rangemaster?uf=brand",
        "cat": "Appliances > Rangemaster"
    },
    {
        "url": "/browse/appliances/brand--russell-hobbs?uf=brand",
        "cat": "Appliances > Russell Hobbs"
    },
    {
        "url": "/browse/appliances/brand--sage?uf=brand",
        "cat": "Appliances > Sage"
    },
    {
        "url": "/browse/appliances/brand--salter?uf=brand",
        "cat": "Appliances > Salter"
    },
    {
        "url": "/browse/appliances/brand--samsung?uf=brand",
        "cat": "Appliances > Samsung"
    },
    {
        "url": "/browse/appliances/brand--shark?uf=brand",
        "cat": "Appliances > Shark"
    },
    {
        "url": "/browse/appliances/brand--siemens?uf=brand",
        "cat": "Appliances > Siemens"
    },
    {
        "url": "/browse/appliances/brand--silentnight?uf=brand",
        "cat": "Appliances > Silentnight"
    },
    {
        "url": "/browse/appliances/brand--smeg?uf=brand",
        "cat": "Appliances > Smeg"
    },
    {
        "url": "/browse/appliances/brand--swan?uf=brand",
        "cat": "Appliances > Swan"
    },
    {
        "url": "/browse/appliances/brand--tassimo?uf=brand",
        "cat": "Appliances > Tassimo"
    },
    {
        "url": "/browse/appliances/brand--tefal?uf=brand",
        "cat": "Appliances > Tefal"
    },
    {
        "url": "/browse/appliances/brand--tower?uf=brand",
        "cat": "Appliances > Tower"
    },
    {
        "url": "/browse/appliances/brand--vax?uf=brand",
        "cat": "Appliances > Vax"
    },
    {
        "url": "/browse/appliances/brand--warmlite?uf=brand",
        "cat": "Appliances > Warmlite"
    },
    {
        "url": "/browse/appliances/brand--worx?uf=brand",
        "cat": "Appliances > Worx"
    }
]
var cat3=[
    {
        "url": "/browse/technology-laptops",
        "cat": "Tech & Gaming > Laptops"
    },
    {
        "url": "/browse/technology-laptops/laptop-type--macbooks",
        "cat": "Tech & Gaming > MacBook"
    },
    {
        "url": "/browse/technology-desktop-computers",
        "cat": "Tech & Gaming > Desktop Computers"
    },
    {
        "url": "/browse/technology-desktop-computers/brand--apple",
        "cat": "Tech & Gaming > iMac"
    },
    {
        "url": "/browse/technology-pc-monitors",
        "cat": "Tech & Gaming > PC Monitors"
    },
    {
        "url": "/browse/technology-computer-accessories",
        "cat": "Tech & Gaming > Computer Accessories"
    },
    {
        "url": "/browse/technology-printers-and-scanners",
        "cat": "Tech & Gaming > Printers & Scanners"
    },
    {
        "url": "/browse/technology-software",
        "cat": "Tech & Gaming > Software"
    },
    {
        "url": "/browse/technology-home-networking",
        "cat": "Tech & Gaming > Home Networking"
    },
    {
        "url": "/browse/technology-data-storage",
        "cat": "Tech & Gaming > Data Storage"
    },
    {
        "url": "/browse/technology-tablets",
        "cat": "Tech & Gaming > Tablets"
    },
    {
        "url": "/browse/technology-tablets/brand--apple",
        "cat": "Tech & Gaming > iPad"
    },
    {
        "url": "/browse/technology-e-readers",
        "cat": "Tech & Gaming > E-Readers"
    },
    {
        "url": "/browse/technology-tablet-accessories",
        "cat": "Tech & Gaming > Tablet Accessories"
    },
    {
        "url": "/browse/technology-televisions",
        "cat": "Tech & Gaming > Televisions"
    },
    {
        "url": "/browse/technology-projectors",
        "cat": "Tech & Gaming > Projectors"
    },
    {
        "url": "/browse/technology-sound-bars-and-accessories",
        "cat": "Tech & Gaming > Soundbars"
    },
    {
        "url": "/browse/technology-streaming-devices",
        "cat": "Tech & Gaming > Streaming Devices"
    },
    {
        "url": "/browse/technology-tv-wall-mounts-and-tv-accessories",
        "cat": "Tech & Gaming > Wall Mounts & TV Accessories"
    },
    {
        "url": "/browse/technology-speakers-and-sound-systems",
        "cat": "Tech & Gaming > Speakers & Sound Systems"
    },
    {
        "url": "/browse/technology-headphones",
        "cat": "Tech & Gaming > Headphones"
    },
    {
        "url": "/browse/technology-smart-watches-and-wearable-tech",
        "cat": "Tech & Gaming > Smart Watches & Wearable Tech"
    },
    {
        "url": "/browse/technology-smart-watches-and-wearable-tech/brand--apple",
        "cat": "Tech & Gaming > Apple Watch"
    },
    {
        "url": "/browse/technology-ai-glasses",
        "cat": "Tech & Gaming > AI Glasses"
    },
    {
        "url": "/browse/technology-smart-home",
        "cat": "Tech & Gaming > Smart Home"
    },
    {
        "url": "/browse/technology-smart-tags-and-trackers",
        "cat": "Tech & Gaming > Smart Tags & Trackers"
    },
    {
        "url": "/browse/technology-mobile-phones",
        "cat": "Tech & Gaming > Mobile Phones"
    },
    {
        "url": "/browse/technology-mobile-phones/brand--apple",
        "cat": "Tech & Gaming > iPhone"
    },
    {
        "url": "/browse/technology-mobile-phone-accessories",
        "cat": "Tech & Gaming > Mobile Phone Accessories"
    },
    {
        "url": "/browse/technology-cameras",
        "cat": "Tech & Gaming > Cameras"
    },
    {
        "url": "/browse/technology-camera-lenses",
        "cat": "Tech & Gaming > Lenses"
    },
    {
        "url": "/browse/technology-camera-accessories",
        "cat": "Tech & Gaming > Camera Accessories"
    },
    {
        "url": "/browse/technology-action-cams-and-accessories",
        "cat": "Tech & Gaming > Action Cams"
    },
    {
        "url": "/browse/technology-camcorders",
        "cat": "Tech & Gaming > Camcorders"
    },
    {
        "url": "/browse/technology-drones-and-accessories",
        "cat": "Tech & Gaming > Drones"
    },
    {
        "url": "/browse/technology-binoculars-and-telescopes",
        "cat": "Tech & Gaming > Binoculars & Telescopes"
    },
    {
        "url": "/browse/technology-vlogging-equipment",
        "cat": "Tech & Gaming > Vlogging Equipment"
    },
    {
        "url": "/browse/technology-sat-navs-and-dash-cams",
        "cat": "Tech & Gaming > Sat Navs & Dash Cams"
    },
    {
        "url": "/browse/technology-digital-cutting",
        "cat": "Tech & Gaming > Digital Crafting"
    },
    {
        "url": "/browse/technology-heat-presses",
        "cat": "Tech & Gaming > Heat Presses"
    },
    {
        "url": "/browse/technology-labelling-machines",
        "cat": "Tech & Gaming > Labelling Machines"
    },
    {
        "url": "/browse/technology-sewing-machines",
        "cat": "Tech & Gaming > Sewing Machines"
    },
    {
        "url": "/browse/technology/platform--xbox-series-x",
        "cat": "Tech & Gaming > Xbox Series X"
    },
    {
        "url": "/browse/technology/platform--xbox-series-s",
        "cat": "Tech & Gaming > Xbox Series S"
    },
    {
        "url": "/browse/technology/platform--playstation-5",
        "cat": "Tech & Gaming > Playstation 5"
    },
    {
        "url": "/browse/technology/platform--nintendo-switch-2",
        "cat": "Tech & Gaming > Nintendo Switch 2"
    },
    {
        "url": "/browse/technology/platform--nintendo-switch",
        "cat": "Tech & Gaming > Nintendo Switch"
    },
    {
        "url": "/browse/technology/platform--pc-gaming",
        "cat": "Tech & Gaming > PC Gaming"
    },
    {
        "url": "/browse/platform--meta-quest",
        "cat": "Tech & Gaming > Meta Quest"
    },
    {
        "url": "/browse/platform--retro-gaming",
        "cat": "Tech & Gaming > Retro Gaming"
    },
    {
        "url": "/browse/gaming-consoles",
        "cat": "Tech & Gaming > Consoles"
    },
    {
        "url": "/browse/gaming-games",
        "cat": "Tech & Gaming > Games"
    },
    {
        "url": "/browse/gaming-passes-and-points",
        "cat": "Tech & Gaming > Gaming Gift Cards, Passes & Points"
    },
    {
        "url": "/browse/gaming-controllers",
        "cat": "Tech & Gaming > Controllers"
    },
    {
        "url": "/browse/gaming-wheels-and-pedals",
        "cat": "Tech & Gaming > Wheels & Pedals"
    },
    {
        "url": "/browse/technology-computer-accessories-headsets",
        "cat": "Tech & Gaming > Gaming Headsets"
    },
    {
        "url": "/browse/gaming-chairs",
        "cat": "Tech & Gaming > Gaming Chairs"
    },
    {
        "url": "/browse/gaming-accessories",
        "cat": "Tech & Gaming > Gaming Accessories"
    },
    {
        "url": "/browse/gaming-handheld-gaming",
        "cat": "Tech & Gaming > Handheld Gaming"
    },
    {
        "url": "/browse/gaming-virtual-reality",
        "cat": "Tech & Gaming > Virtual Reality"
    },
    {
        "url": "/browse/technology-laptops/laptop-type--gaming-laptops",
        "cat": "Tech & Gaming > Gaming Laptops"
    },
    {
        "url": "/browse/gaming-pcs",
        "cat": "Tech & Gaming > Gaming PCs"
    },
    {
        "url": "/browse/technology-pc-monitors/monitor-type--gaming",
        "cat": "Tech & Gaming > Gaming Monitors"
    },
    {
        "url": "/browse/technology-pc-components",
        "cat": "Tech & Gaming > PC Components"
    },
    {
        "url": "/browse/appliances-power-stations",
        "cat": "Tech & Gaming > Power Stations"
    },
    {
        "url": "/browse/technology-mobile-phone-charging",
        "cat": "Tech & Gaming > Charging & Accessories"
    },
    {
        "url": "/browse/appliances-portable-sola-panels",
        "cat": "Tech & Gaming > Solar Panels"
    },
    {
        "url": "/browse/brand--apple",
        "cat": "Tech & Gaming > Apple"
    },
    {
        "url": "/browse/brand--samsung",
        "cat": "Tech & Gaming > Samsung"
    },
    {
        "url": "/promo/xbox",
        "cat": "Tech & Gaming > Xbox"
    },
    {
        "url": "/promo/playstation",
        "cat": "Tech & Gaming > PlayStation"
    },
    {
        "url": "/browse/technology/brand--google",
        "cat": "Tech & Gaming > Google"
    },
    {
        "url": "/browse/brand--hp",
        "cat": "Tech & Gaming > HP"
    },
    {
        "url": "/browse/brand--fitbit",
        "cat": "Tech & Gaming > Fitbit"
    },
    {
        "url": "/browse/brand--meta-quest",
        "cat": "Tech & Gaming > Meta"
    },
    {
        "url": "/promo/nintendo",
        "cat": "Tech & Gaming > Nintendo"
    },
    {
        "url": "/browse/technology/brand--asus",
        "cat": "Tech & Gaming > Asus"
    }
];

var cat33=[
    {
        "url": "/browse/technology/brand--accessorize?uf=brand",
        "cat": "Appliances > Accessorize"
    },
    {
        "url": "/browse/technology/brand--acer?uf=brand",
        "cat": "Appliances > Acer"
    },
    {
        "url": "/browse/technology/brand--agfa?uf=brand",
        "cat": "Appliances > Agfa"
    },
    {
        "url": "/browse/technology/brand--amazon?uf=brand",
        "cat": "Appliances > Amazon"
    },
    {
        "url": "/browse/technology/brand--amd?uf=brand",
        "cat": "Appliances > AMD"
    },
    {
        "url": "/browse/technology/brand--anker?uf=brand",
        "cat": "Appliances > Anker"
    },
    {
        "url": "/browse/technology/brand--anker-nebula?uf=brand",
        "cat": "Appliances > Anker NEBULA"
    },
    {
        "url": "/browse/technology/brand--anker-solix?uf=brand",
        "cat": "Appliances > Anker SOLIX"
    },
    {
        "url": "/browse/technology/brand--aoc?uf=brand",
        "cat": "Appliances > AOC"
    },
    {
        "url": "/browse/technology/brand--apple?uf=brand",
        "cat": "Appliances > Apple"
    },
    {
        "url": "/browse/technology/brand--arlo?uf=brand",
        "cat": "Appliances > arlo"
    },
    {
        "url": "/browse/technology/brand--arsenal?uf=brand",
        "cat": "Appliances > Arsenal"
    },
    {
        "url": "/browse/technology/brand--asus?uf=brand",
        "cat": "Appliances > Asus"
    },
    {
        "url": "/browse/technology/brand--aura?uf=brand",
        "cat": "Appliances > Aura"
    },
    {
        "url": "/browse/technology/brand--avf?uf=brand",
        "cat": "Appliances > AVF"
    },
    {
        "url": "/browse/technology/brand--beats?uf=brand",
        "cat": "Appliances > Beats"
    },
    {
        "url": "/browse/technology/brand--belkin?uf=brand",
        "cat": "Appliances > Belkin"
    },
    {
        "url": "/browse/technology/brand--blaze?uf=brand",
        "cat": "Appliances > Blaze"
    },
    {
        "url": "/browse/technology/brand--blink?uf=brand",
        "cat": "Appliances > Blink"
    },
    {
        "url": "/browse/technology/brand--bluey?uf=brand",
        "cat": "Appliances > Bluey"
    },
    {
        "url": "/browse/technology/brand--bowers-and-wilkins?uf=brand",
        "cat": "Appliances > Bowers & Wilkins"
    },
    {
        "url": "/browse/technology/brand--brazen?uf=brand",
        "cat": "Appliances > BraZen"
    },
    {
        "url": "/browse/technology/brand--brother?uf=brand",
        "cat": "Appliances > Brother"
    },
    {
        "url": "/browse/technology/brand--call-of-duty?uf=brand",
        "cat": "Appliances > Call of Duty"
    },
    {
        "url": "/browse/technology/brand--canon?uf=brand",
        "cat": "Appliances > Canon"
    },
    {
        "url": "/browse/technology/brand--celestron?uf=brand",
        "cat": "Appliances > Celestron"
    },
    {
        "url": "/browse/technology/brand--cmf-by-nothing?uf=brand",
        "cat": "Appliances > cmf by nothing"
    },
    {
        "url": "/browse/technology/brand--corsair?uf=brand",
        "cat": "Appliances > CORSAIR"
    },
    {
        "url": "/browse/technology/brand--cricut?uf=brand",
        "cat": "Appliances > Cricut"
    },
    {
        "url": "/browse/technology/brand--crkd?uf=brand",
        "cat": "Appliances > CRKD"
    },
    {
        "url": "/browse/technology/brand--cyberpower-pc?uf=brand",
        "cat": "Appliances > CyberPower PC"
    },
    {
        "url": "/browse/technology/brand--daewoo?uf=brand",
        "cat": "Appliances > Daewoo"
    },
    {
        "url": "/browse/technology/brand--denon?uf=brand",
        "cat": "Appliances > Denon"
    },
    {
        "url": "/promo/disney/technology",
        "cat": "Appliances > Disney"
    },
    {
        "url": "/browse/technology/brand--disney-frozen?uf=brand",
        "cat": "Appliances > Disney Frozen"
    },
    {
        "url": "/browse/technology/brand--disney-stitch?uf=brand",
        "cat": "Appliances > Disney Stitch"
    },
    {
        "url": "/browse/technology/brand--dji?uf=brand",
        "cat": "Appliances > DJI"
    },
    {
        "url": "/browse/technology/brand--ecoflow?uf=brand",
        "cat": "Appliances > EcoFlow"
    },
    {
        "url": "/browse/technology/brand--einhell?uf=brand",
        "cat": "Appliances > Einhell"
    },
    {
        "url": "/browse/technology/brand--elgato?uf=brand",
        "cat": "Appliances > Elgato"
    },
    {
        "url": "/browse/technology/brand--energizer?uf=brand",
        "cat": "Appliances > Energizer"
    },
    {
        "url": "/browse/technology/brand--entity?uf=brand",
        "cat": "Appliances > Entity"
    },
    {
        "url": "/browse/technology/brand--epson?uf=brand",
        "cat": "Appliances > Epson"
    },
    {
        "url": "/browse/technology/brand--eufy?uf=brand",
        "cat": "Appliances > Eufy"
    },
    {
        "url": "/browse/technology/brand--evercade?uf=brand",
        "cat": "Appliances > Evercade"
    },
    {
        "url": "/browse/technology/brand--fellowes?uf=brand",
        "cat": "Appliances > Fellowes"
    },
    {
        "url": "/browse/technology/brand--finlux?uf=brand",
        "cat": "Appliances > Finlux"
    },
    {
        "url": "/browse/technology/brand--fitbit?uf=brand",
        "cat": "Appliances > Fitbit"
    },
    {
        "url": "/browse/technology/brand--fossil?uf=brand",
        "cat": "Appliances > Fossil"
    },
    {
        "url": "/browse/technology/brand--fujifilm?uf=brand",
        "cat": "Appliances > Fujifilm"
    },
    {
        "url": "/browse/technology/brand--fujifilm-instax?uf=brand",
        "cat": "Appliances > Fujifilm Instax"
    },
    {
        "url": "/browse/technology/brand--galaxy?uf=brand",
        "cat": "Appliances > galaxy"
    },
    {
        "url": "/browse/technology/brand--garmin?uf=brand",
        "cat": "Appliances > Garmin"
    },
    {
        "url": "/browse/technology/brand--gigabyte?uf=brand",
        "cat": "Appliances > GIGABYTE"
    },
    {
        "url": "/browse/technology/brand--gioteck?uf=brand",
        "cat": "Appliances > Gioteck"
    },
    {
        "url": "/browse/technology/brand--google?uf=brand",
        "cat": "Appliances > Google"
    },
    {
        "url": "/browse/technology/brand--gopro?uf=brand",
        "cat": "Appliances > GoPro"
    },
    {
        "url": "/browse/technology/brand--hisense?uf=brand",
        "cat": "Appliances > Hisense"
    },
    {
        "url": "/browse/technology/brand--honor?uf=brand",
        "cat": "Appliances > Honor"
    },
    {
        "url": "/browse/technology/brand--hori?uf=brand",
        "cat": "Appliances > HORI"
    },
    {
        "url": "/browse/technology/brand--hp?uf=brand",
        "cat": "Appliances > HP"
    },
    {
        "url": "/browse/technology/brand--huawei?uf=brand",
        "cat": "Appliances > Huawei"
    },
    {
        "url": "/browse/technology/brand--hypermegatech?uf=brand",
        "cat": "Appliances > HyperMegaTech"
    },
    {
        "url": "/browse/technology/brand--hyperx?uf=brand",
        "cat": "Appliances > HYPERX"
    },
    {
        "url": "/browse/technology/brand--hyte?uf=brand",
        "cat": "Appliances > Hyte"
    },
    {
        "url": "/browse/technology/brand--icon-beanbags?uf=brand",
        "cat": "Appliances > Icon Beanbags"
    },
    {
        "url": "/browse/technology/brand--imou?uf=brand",
        "cat": "Appliances > imou"
    },
    {
        "url": "/browse/technology/brand--imp?uf=brand",
        "cat": "Appliances > imp"
    },
    {
        "url": "/browse/technology/brand--insta360?uf=brand",
        "cat": "Appliances > Insta360"
    },
    {
        "url": "/browse/technology/brand--jbl?uf=brand",
        "cat": "Appliances > JBL"
    },
    {
        "url": "/browse/technology/brand--jlab?uf=brand",
        "cat": "Appliances > JLab"
    },
    {
        "url": "/browse/technology/brand--jmb?uf=brand",
        "cat": "Appliances > JMB"
    },
    {
        "url": "/browse/technology/brand--jml?uf=brand",
        "cat": "Appliances > JML"
    },
    {
        "url": "/browse/technology/brand--kaikoo?uf=brand",
        "cat": "Appliances > KAIKOO"
    },
    {
        "url": "/browse/technology/brand--keychron?uf=brand",
        "cat": "Appliances > Keychron"
    },
    {
        "url": "/browse/technology/brand--kodak?uf=brand",
        "cat": "Appliances > Kodak"
    },
    {
        "url": "/browse/technology/brand--lacie?uf=brand",
        "cat": "Appliances > Lacie"
    },
    {
        "url": "/browse/technology/brand--leapfrog?uf=brand",
        "cat": "Appliances > LeapFrog"
    },
    {
        "url": "/browse/technology/brand--lenco?uf=brand",
        "cat": "Appliances > Lenco"
    },
    {
        "url": "/browse/technology/brand--lenovo?uf=brand",
        "cat": "Appliances > Lenovo"
    },
    {
        "url": "/browse/technology/brand--lg?uf=brand",
        "cat": "Appliances > LG"
    },
    {
        "url": "/browse/technology/brand--liverpool-fc?uf=brand",
        "cat": "Appliances > Liverpool FC"
    },
    {
        "url": "/browse/technology/brand--logitech?uf=brand",
        "cat": "Appliances > Logitech"
    },
    {
        "url": "/browse/technology/brand--logitechg?uf=brand",
        "cat": "Appliances > LogitechG"
    },
    {
        "url": "/browse/technology/brand--majority?uf=brand",
        "cat": "Appliances > Majority"
    },
    {
        "url": "/browse/technology/brand--makita?uf=brand",
        "cat": "Appliances > Makita"
    },
    {
        "url": "/browse/technology/brand--manchester-city?uf=brand",
        "cat": "Appliances > Manchester City"
    },
    {
        "url": "/browse/technology/brand--marshall?uf=brand",
        "cat": "Appliances > Marshall"
    },
    {
        "url": "/browse/technology/brand--master-lock?uf=brand",
        "cat": "Appliances > Master Lock"
    },
    {
        "url": "/browse/technology/brand--maxx-tech?uf=brand",
        "cat": "Appliances > Maxx Tech"
    },
    {
        "url": "/browse/technology/brand--medion?uf=brand",
        "cat": "Appliances > medion"
    },
    {
        "url": "/browse/technology/brand--meta-quest?uf=brand",
        "cat": "Appliances > Meta Quest"
    },
    {
        "url": "/browse/technology/brand--microsoft?uf=brand",
        "cat": "Appliances > Microsoft"
    },
    {
        "url": "/browse/technology/brand--motorola?uf=brand",
        "cat": "Appliances > Motorola"
    },
    {
        "url": "/browse/technology/brand--msi?uf=brand",
        "cat": "Appliances > MSI"
    },
    {
        "url": "/browse/technology/brand--nacon?uf=brand",
        "cat": "Appliances > Nacon"
    },
    {
        "url": "/browse/technology/brand--nextbase?uf=brand",
        "cat": "Appliances > Nextbase"
    },
    {
        "url": "/browse/technology/brand--nikon?uf=brand",
        "cat": "Appliances > Nikon"
    },
    {
        "url": "/promo/nintendo/technology",
        "cat": "Appliances > Nintendo"
    },
    {
        "url": "/browse/technology/brand--nintendo-switch?uf=brand",
        "cat": "Appliances > Nintendo Switch"
    },
    {
        "url": "/browse/technology/brand--nokia?uf=brand",
        "cat": "Appliances > Nokia"
    },
    {
        "url": "/browse/technology/brand--nothing?uf=brand",
        "cat": "Appliances > Nothing"
    },
    {
        "url": "/browse/technology/brand--numskull?uf=brand",
        "cat": "Appliances > Numskull"
    },
    {
        "url": "/browse/technology/brand--nzxt?uf=brand",
        "cat": "Appliances > NZXT"
    },
    {
        "url": "/browse/technology/brand--oakcastle?uf=brand",
        "cat": "Appliances > Oakcastle"
    },
    {
        "url": "/browse/technology/brand--oakley-meta?uf=brand",
        "cat": "Appliances > Oakley Meta"
    },
    {
        "url": "/browse/technology/brand--one-for-all?uf=brand",
        "cat": "Appliances > One For All"
    },
    {
        "url": "/browse/technology/brand--optoma?uf=brand",
        "cat": "Appliances > Optoma"
    },
    {
        "url": "/browse/technology/brand--palit?uf=brand",
        "cat": "Appliances > Palit"
    },
    {
        "url": "/browse/technology/brand--panasonic?uf=brand",
        "cat": "Appliances > Panasonic"
    },
    {
        "url": "/browse/technology/brand--panzerglass?uf=brand",
        "cat": "Appliances > panzerglass"
    },
    {
        "url": "/browse/technology/brand--pc-games?uf=brand",
        "cat": "Appliances > PC Games"
    },
    {
        "url": "/browse/technology/brand--pcspecialist?uf=brand",
        "cat": "Appliances > PCSpecialist"
    },
    {
        "url": "/browse/technology/brand--pdp?uf=brand",
        "cat": "Appliances > PDP"
    },
    {
        "url": "/browse/technology/brand--pentax?uf=brand",
        "cat": "Appliances > PENTAX"
    },
    {
        "url": "/browse/technology/brand--philips?uf=brand",
        "cat": "Appliances > Philips"
    },
    {
        "url": "/browse/technology/brand--philips-hue?uf=brand",
        "cat": "Appliances > Philips Hue"
    },
    {
        "url": "/browse/technology/brand--philips-wiz?uf=brand",
        "cat": "Appliances > Philips WiZ"
    },
    {
        "url": "/browse/technology/brand--photo-creator?uf=brand",
        "cat": "Appliances > Photo Creator"
    },
    {
        "url": "/promo/playstation/technology",
        "cat": "Appliances > Playstation"
    },
    {
        "url": "/browse/technology/brand--playstation-5?uf=brand",
        "cat": "Appliances > PlayStation 5"
    },
    {
        "url": "/browse/technology/brand--pokemon?uf=brand",
        "cat": "Appliances > Pokemon"
    },
    {
        "url": "/browse/technology/brand--polaroid?uf=brand",
        "cat": "Appliances > Polaroid"
    },
    {
        "url": "/browse/technology/brand--poly?uf=brand",
        "cat": "Appliances > Poly"
    },
    {
        "url": "/browse/technology/brand--powercolor?uf=brand",
        "cat": "Appliances > PowerColor"
    },
    {
        "url": "/browse/technology/brand--radley?uf=brand",
        "cat": "Appliances > Radley"
    },
    {
        "url": "/browse/technology/brand--ray-ban-meta?uf=brand",
        "cat": "Appliances > Ray-Ban Meta"
    },
    {
        "url": "/browse/technology/brand--razer?uf=brand",
        "cat": "Appliances > Razer"
    },
    {
        "url": "/browse/technology/brand--red5?uf=brand",
        "cat": "Appliances > RED5"
    },
    {
        "url": "/browse/technology/brand--reflex-active?uf=brand",
        "cat": "Appliances > Reflex Active"
    },
    {
        "url": "/browse/technology/brand--refurbished?uf=brand",
        "cat": "Appliances > Refurbished"
    },
    {
        "url": "/browse/technology/brand--reolink?uf=brand",
        "cat": "Appliances > Reolink"
    },
    {
        "url": "/browse/technology/brand--retro-games?uf=brand",
        "cat": "Appliances > Retro Games"
    },
    {
        "url": "/browse/technology/brand--ricoh?uf=brand",
        "cat": "Appliances > RICOH"
    },
    {
        "url": "/browse/technology/brand--ring?uf=brand",
        "cat": "Appliances > RING"
    },
    {
        "url": "/browse/technology/brand--road-angel?uf=brand",
        "cat": "Appliances > road angel"
    },
    {
        "url": "/browse/technology/brand--roberts?uf=brand",
        "cat": "Appliances > Roberts"
    },
    {
        "url": "/browse/technology/brand--roblox?uf=brand",
        "cat": "Appliances > Roblox"
    },
    {
        "url": "/browse/technology/brand--rucomfy?uf=brand",
        "cat": "Appliances > rucomfy"
    },
    {
        "url": "/browse/technology/brand--ryobi?uf=brand",
        "cat": "Appliances > RYOBI"
    },
    {
        "url": "/browse/technology/brand--samsung?uf=brand",
        "cat": "Appliances > Samsung"
    },
    {
        "url": "/browse/technology/brand--sandisk?uf=brand",
        "cat": "Appliances > SanDisk"
    },
    {
        "url": "/browse/technology/brand--sanus?uf=brand",
        "cat": "Appliances > SANUS"
    },
    {
        "url": "/browse/technology/brand--scan?uf=brand",
        "cat": "Appliances > Scan"
    },
    {
        "url": "/browse/technology/brand--scuf?uf=brand",
        "cat": "Appliances > Scuf"
    },
    {
        "url": "/browse/technology/brand--seagate?uf=brand",
        "cat": "Appliances > Seagate"
    },
    {
        "url": "/browse/technology/brand--sekonda?uf=brand",
        "cat": "Appliances > Sekonda"
    },
    {
        "url": "/browse/technology/brand--sennheiser?uf=brand",
        "cat": "Appliances > Sennheiser"
    },
    {
        "url": "/browse/technology/brand--sharp?uf=brand",
        "cat": "Appliances > Sharp"
    },
    {
        "url": "/browse/technology/brand--shokz?uf=brand",
        "cat": "Appliances > Shokz"
    },
    {
        "url": "/browse/technology/brand--sigma?uf=brand",
        "cat": "Appliances > Sigma"
    },
    {
        "url": "/browse/technology/brand--simplisafe?uf=brand",
        "cat": "Appliances > SimpliSafe"
    },
    {
        "url": "/browse/technology/brand--singer?uf=brand",
        "cat": "Appliances > Singer"
    },
    {
        "url": "/browse/technology/brand--skullcandy?uf=brand",
        "cat": "Appliances > Skullcandy"
    },
    {
        "url": "/browse/technology/brand--skylight?uf=brand",
        "cat": "Appliances > skylight"
    },
    {
        "url": "/browse/technology/brand--sonos?uf=brand",
        "cat": "Appliances > Sonos"
    },
    {
        "url": "/browse/technology/brand--sony?uf=brand",
        "cat": "Appliances > Sony"
    },
    {
        "url": "/browse/technology/brand--soundcore?uf=brand",
        "cat": "Appliances > Soundcore"
    },
    {
        "url": "/browse/technology/brand--squishmallows?uf=brand",
        "cat": "Appliances > Squishmallows"
    },
    {
        "url": "/browse/technology/brand--stealth?uf=brand",
        "cat": "Appliances > Stealth"
    },
    {
        "url": "/browse/technology/brand--steam?uf=brand",
        "cat": "Appliances > steam"
    },
    {
        "url": "/browse/technology/brand--steelseries?uf=brand",
        "cat": "Appliances > SteelSeries"
    },
    {
        "url": "/browse/technology/brand--stormforce?uf=brand",
        "cat": "Appliances > Stormforce"
    },
    {
        "url": "/browse/technology/brand--studio-creator?uf=brand",
        "cat": "Appliances > Studio Creator"
    },
    {
        "url": "/browse/technology/brand--styletech?uf=brand",
        "cat": "Appliances > Styletech"
    },
    {
        "url": "/browse/technology/brand--sumup?uf=brand",
        "cat": "Appliances > SumUp"
    },
    {
        "url": "/browse/technology/brand--swann?uf=brand",
        "cat": "Appliances > Swann"
    },
    {
        "url": "/browse/technology/brand--tcl?uf=brand",
        "cat": "Appliances > TCL"
    },
    {
        "url": "/browse/technology/brand--thrustmaster?uf=brand",
        "cat": "Appliances > Thrustmaster"
    },
    {
        "url": "/browse/technology/brand--tikkers?uf=brand",
        "cat": "Appliances > Tikkers"
    },
    {
        "url": "/browse/technology/brand--tommee-tippee?uf=brand",
        "cat": "Appliances > Tommee Tippee"
    },
    {
        "url": "/browse/technology/brand--toshiba?uf=brand",
        "cat": "Appliances > Toshiba"
    },
    {
        "url": "/browse/technology/brand--tottenham-hotspur-fc?uf=brand",
        "cat": "Appliances > Tottenham Hotspur FC"
    },
    {
        "url": "/browse/technology/brand--tp-link?uf=brand",
        "cat": "Appliances > TP Link"
    },
    {
        "url": "/browse/technology/brand--trust?uf=brand",
        "cat": "Appliances > Trust"
    },
    {
        "url": "/browse/technology/brand--turtle-beach?uf=brand",
        "cat": "Appliances > Turtle Beach"
    },
    {
        "url": "/browse/technology/brand--venom?uf=brand",
        "cat": "Appliances > Venom"
    },
    {
        "url": "/browse/technology/brand--victrola?uf=brand",
        "cat": "Appliances > Victrola"
    },
    {
        "url": "/browse/technology/brand--vogels?uf=brand",
        "cat": "Appliances > Vogels"
    },
    {
        "url": "/browse/technology/brand--vtech?uf=brand",
        "cat": "Appliances > VTech"
    },
    {
        "url": "/browse/technology/brand--western-digital?uf=brand",
        "cat": "Appliances > Western Digital"
    },
    {
        "url": "/browse/technology/brand--withings?uf=brand",
        "cat": "Appliances > Withings"
    },
    {
        "url": "/browse/technology/brand--x-rocker?uf=brand",
        "cat": "Appliances > X Rocker"
    },
    {
        "url": "/promo/xbox/technology",
        "cat": "Appliances > Xbox"
    }
];

var cat4=[
    {
        "url": "/browse/jewellery-mens-watches",
        "cat": "Gifts & Jewellery > Mens Watches"
    },
    {
        "url": "/browse/jewellery-ladies-watches",
        "cat": "Gifts & Jewellery > Ladies Watches"
    },
    {
        "url": "/browse/jewellery-kids-watches",
        "cat": "Gifts & Jewellery > Kids Watches"
    },
    {
        "url": "/browse/jewellery-watch-accessories",
        "cat": "Gifts & Jewellery > Watch Accessories"
    }
]
var cat5=[
    {
        "url": "/browse/health-and-beauty-hair-dryers",
        "cat": "Beauty > Hair Dryers"
    },
    {
        "url": "/browse/health-and-beauty-hair-styling-and-curlers/styler-type--straighteners",
        "cat": "Beauty > Hair Styling & Curlers"
    },
    {
        "url": "/browse/health-and-beauty-hair-styling-and-curlers",
        "cat": "Beauty > Hair Styling & Curlers"
    },
    {
        "url": "/browse/health-and-beauty/brand--ghd",
        "cat": "Beauty > GHD"
    },
    {
        "url": "/browse/health-and-beauty-hair-womens-hair-removal",
        "cat": "Beauty > Womens Hair Removal"
    },
    {
        "url": "/browse/health-and-beauty-mens-shavers",
        "cat": "Beauty > Mens Shavers"
    },
    {
        "url": "/browse/health-and-beauty-mens-hair-clippers-and-trimmers",
        "cat": "Beauty > Mens Hair Clippers & Trimmers"
    },
    {
        "url": "/browse/health-and-beauty-wellness-diagnostics-and-health-monitors",
        "cat": "Beauty > Diagnostics & Health Monitors"
    },
    {
        "url": "/browse/health-and-beauty-wellness-massagers-and-spa-tools",
        "cat": "Beauty > Massagers & Spa Tools"
    },
    {
        "url": "/browse/health-and-beauty-wellness-dental-care",
        "cat": "Beauty > Dental Care"
    },
    {
        "url": "/browse/health-and-beauty-wellness-pain-relief",
        "cat": "Beauty > Pain Relief"
    },
    {
        "url": "/browse/sports-exercise-machines",
        "cat": "Sports & Travel > Exercise Machines"
    }
];
var cat=[...cat1,...cat11,...cat2,...cat22,...cat3,...cat33,...cat4,...cat5];


function add(obj,index)
{
    var found=false;
    for(var i=0;i<all_urls.length;i++)
    {
        if(all_urls[i].url==obj.url)
        {
            found=true;
            break;
        }
    }
    if(!found)
    {
        obj.cat=cat[index].cat;
        all_urls.push(obj)
    }
}

function fetcher(url,callback)
{
    fetch(url, {
    "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "traceparent": "00-686fee1a6762cdc81c6362e3b1d6c1ca-4f3799e14f85a564-01",
        "x-brand": "very"
    },
    "referrer": "https://www.very.co.uk/browse/women/apparel-fit--main-collection?page=2",
    "body": null,
    "method": "GET",
    "mode": "cors",
    "credentials": "include"
    }).then(function(data){
        if(data.status==200)
        {
            return data.json();
        }
        else
        {
            return data;
        }
    }).then(function(data){
        if(data.status)
        {
            setTimeout(function(){
                fetcher(url,callback);
            },30000)
        }
        else
        {
            callback(data);
        }
    });
}

var map={
    "animal":"animal",
    "brand":"brand",
    "laptop-type":"laptopType",
    "monitor-type":"monitorType",
    "platform":"platform",
    "shop-by-room":"shopByRoom",
    "sofa-type":"sofaType",
    "styler-type":"stylerType"
}

function rec(start,index,callback)
{
    console.log(index+"/"+cat.length+" - "+start+" - "+all_urls.length)
    var u=cat[index].url.replace("?uf=brand","").split("/");
    var group="";
    var filter="";
    if(u.length==3)
    {
        group=u[2];
    }
    else if(u.length==4)
    {
        group=u[2];
        var g=u[3].split("--");
        var ss=encodeURIComponent("filters["+map[g[0]]+"]")+"="+encodeURIComponent(g[1]);
        filter="&"+ss;
    }
    else
    {
        console.log("problem with url");
    }

    var url="https://www.very.co.uk/api/product-discovery-browse/browse/group_id/"+encodeURIComponent(group)+"?num_results_per_page=96&page="+start+filter;
    fetcher(url,function(json){
        if(json.response.product_list.length==0)
        {
            //console.log("complete");
            callback();
        }
        else
        {
            for(var i=0;i<json.response.product_list.length;i++)
            {
                add(json.response.product_list[i],index);
            }
            start++;
            rec(start,index,callback);
        }
    })
}

function rec_cat(index)
{
    rec(1,index,function(){
        index++;
        var len=cat.length;
        //len=3;
        if(index<len)
        {
            rec_cat(index);
        }
        else
        {
            console.log("completed");
        }
    });
}
rec_cat(0);


