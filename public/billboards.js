/* BILLBOARDS: 10 markets, 2 billboards each. To feature a paying product, replace an A(...) line:
   A('Brand name','Product line','emoji','#brandColour'). OPEN() is a for-sale billboard.
   The names below are made-up sample brands. Edit this file, commit, and the game updates. */
(function(){
function A(b,p,e,c){return{brand:b,product:p,emoji:e,color:c}}
function OPEN(){return{brand:'Your brand here',product:'Advertise on this billboard',emoji:'\uD83D\uDCE3',color:'#2F6BFF',open:true}}
var RICE=A('Sunrise Rice','Rice, 1 bag','\uD83C\uDF5A','#D98E1F'),WATER=A('AquaPure','Pure water sachets','\uD83D\uDCA7','#1E88E5'),PHONE=A('BrightCall','Phones and chargers','\uD83D\uDCF1','#7B3FE4'),
NOOD=A('Golden Crate','Noodles','\uD83C\uDF5C','#C9961A'),TOM=A('FreshFarm','Tomatoes and pepper','\uD83C\uDF45','#C62828'),SHOE=A('StepUp','Sneakers','\uD83D\uDC5F','#00897B'),
UMB=A('SunShield','Umbrellas and caps','\u2602\uFE0F','#E4572E'),FAN=A('KoolBreeze','Rechargeable fans','\uD83C\uDF00','#0097A7'),BISC=A('SweetBite','Biscuits','\uD83C\uDF6A','#8D5A2B'),
SPICE=A('Mama Spice','Pepper and seasoning','\uD83C\uDF36\uFE0F','#B71C1C'),LAMP=A('Lumo','Solar lamps','\uD83D\uDCA1','#F9A825');
function M(name,city,sky,goods,b1,b2){return{name:name,city:city,sky:sky,goods:goods,boards:[b1,b2]}}
window.BILLBOARDS=[
M('Balogun Market','Lagos Island',['#1b2a52','#f4a259'],['\uD83D\uDC57','\uD83D\uDC54','\uD83E\uDDE3','\uD83D\uDC5C'],SHOE,A('Free ADVERT','Cold drinks','\uD83E\uDD64','#E4572E')),
M('Computer Village','Ikeja, Lagos',['#14233f','#6aa7ff'],['\uD83D\uDCF1','\uD83D\uDD0C','\uD83C\uDFA7','\uD83D\uDCBB'],PHONE,LAMP),
M('Alaba International','Ojo, Lagos',['#2a1f4d','#ff8a65'],['\uD83D\uDCFA','\uD83D\uDD0A','\uD83D\uDCA1','\uD83D\uDD0C'],FAN,OPEN()),
M('Mile 12 Market','Lagos',['#16352c','#ffd166'],['\uD83C\uDF45','\uD83C\uDF36\uFE0F','\uD83E\uDDC5','\uD83E\uDD6C'],TOM,A('Free ADVERT','SIM cards','\uD83D\uDCF6','#00897B')),
M('Oyingbo Market','Lagos Mainland',['#3a1f3d','#f78fb3'],['\uD83D\uDC1F','\uD83E\uDD90','\uD83C\uDF5A','\uD83C\uDF4C'],RICE,OPEN()),
M('Onitsha Main Market','Anambra',['#1d2b53','#ffb347'],['\uD83D\uDCE6','\uD83D\uDC5E','\uD83E\uDDF4','\uD83D\uDEE2\uFE0F'],NOOD,WATER),
M('Ariaria International','Aba, Abia',['#2b1d3a','#ef8354'],['\uD83D\uDC5E','\uD83D\uDC5C','\uD83E\uDDF5','\uD83D\uDC57'],SHOE,OPEN()),
M('Kurmi Market','Kano',['#3b2a14','#ffd27d'],['\uD83E\uDDF5','\uD83C\uDF6F','\uD83E\uDD5C','\uD83D\uDC90'],SPICE,UMB),
M('Dugbe Market','Ibadan, Oyo',['#16304a','#ffa07a'],['\uD83C\uDF60','\uD83C\uDF4C','\uD83E\uDD6D','\uD83E\uDDFA'],BISC,OPEN()),
M('Wuse Market','Abuja',['#1a2740','#7fd1ae'],['\uD83C\uDF7E','\uD83C\uDF4E','\uD83C\uDF5E','\uD83E\uDDC3'],WATER,RICE)
];
})();

/* TAXI FARES: fare = base + perStop for every market you pass. To set an exact price for a trip to one market,
   add it to fares, for example  fares:{'Wuse Market':5000,'Kurmi Market':3500}  (amounts in naira). */
window.TAXI={base:350,perStop:0,open:6,fares:{'Balogun Market':350,'Computer Village':350,'Alaba International':350,'Mile 12 Market':350,'Oyingbo Market':350,'Onitsha Main Market':500,'Ariaria International':500,'Kurmi Market':500,'Dugbe Market':500,'Wuse Market':500}};
