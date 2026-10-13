export interface MapMarker { id: string; title: string; lat: number; lng: number; subtitle?: string }

/** Leaflet + OpenStreetMap: no API key needed. Navigation itself is delegated to the user's map app. */
export function buildMapHtml(markers: MapMarker[], selectedId?: string | null) {
  const data = JSON.stringify(markers).replace(/</g, '\\u003c');
  const sel = JSON.stringify(selectedId ?? null);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;background:#E8F0FD;font-family:-apple-system,Roboto,sans-serif}
.pin{width:30px;height:30px;border-radius:50% 50% 50% 0;background:#1769E0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.pin.sel{background:#FF8A3D;width:36px;height:36px}
.pin i{display:block;width:10px;height:10px;background:#fff;border-radius:50%;margin:7px}
#err{display:none;padding:24px;text-align:center;color:#0B1F3A}</style></head>
<body><div id="map"></div><div id="err">Map could not load. Check your internet connection.</div>
<script>
var M=${data}, SEL=${sel};
function send(id){ if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(String(id));} else {parent.postMessage({travelosMarker:id},'*');} }
try{
  var map=L.map('map',{zoomControl:true,attributionControl:true}).setView([22.5,79],4);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  var pts=[];
  M.forEach(function(m){
    var ic=L.divIcon({className:'',html:'<div class="pin'+(m.id===SEL?' sel':'')+'"><i></i></div>',iconSize:[30,30],iconAnchor:[15,30]});
    var mk=L.marker([m.lat,m.lng],{icon:ic,title:m.title}).addTo(map);
    mk.bindTooltip(m.title,{direction:'top',offset:[0,-28]});
    mk.on('click',function(){send(m.id)});
    pts.push([m.lat,m.lng]);
  });
  if(pts.length===1){map.setView(pts[0],12)} else if(pts.length>1){map.fitBounds(pts,{padding:[40,40],maxZoom:13})}
}catch(e){document.getElementById('map').style.display='none';document.getElementById('err').style.display='block'}
</script></body></html>`;
}
