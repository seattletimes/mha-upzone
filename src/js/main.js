// require("./lib/ads");
// var track = require("./lib/tracking");

require("component-responsive-frame/child");
require("component-leaflet-map");

var xhr = require("./lib/xhr");
var $ = require("./lib/qsa");
var { rgb, palette } = require("./lib/colors");

var mapElement = $.one("leaflet-map");
var map = mapElement.map;
var L = mapElement.leaflet;
var button = $.one(".load-data");
var geoJSON;

var mode = "before";
var filter = {};

var lerp = function(a, b, d) {
  var out = [];
  for (var i = 0; i < a.length; i++) {
    out[i] = a[i] + (b[i] - a[i]) * d;
  }
  return out;
};

var lowColor = [66, 6, 66];
var highColor = [240, 133, 12];

var processFeature = function(feature, layer) {
  var props = feature.properties;
  if (!props) return console.log(props);
  var match = props.mha.match(/\((M\d?|no MHA)\)/);
  if (!match) return;  
  var [ sub, change ] = match;
  props.mha = props.mha.replace(" " + sub, "").trim();
  var { zoning, mha } = props;
  props.mha_change = change;
  props.mha_before = window.zoneCodes[zoning];
  props.mha_after = window.zoneCodes[mha] ? window.zoneCodes[mha] : { mha_cat: props.mha_before.mha_cat };
  // special-case NC-30 to NC-40
  if (zoning.match(/nc\d?-30/i) && mha.match(/nc\d?-40/i)) {
    props.delta = 0;
  } else {
    props.delta = props.mha_after.mha_cat - props.mha_before.mha_cat;
  }
  props.type = window.zoneCodes[props.zoning].type;
};

var shades = [
  rgb(96, 30, 30),
  rgb(192, 40, 40),
  rgb(255, 120, 80)
]

var changeColor = function(props) {
  if (props.delta == 0) {
    return shades[0];
  } else if (props.delta == 1) {
      return shades[1];
  } else if (props.delta > 1) {
      return shades[2];
  }
  return magenta;
};

var makeLerp = function(property) {
  return props => rgb.apply(null, lerp(lowColor, highColor, props[property].mha_cat / 5));
}

var beforeColor = makeLerp("mha_before");
var afterColor = makeLerp("mha_after");

var colorizer = {
  change: changeColor,
  before: beforeColor,
  after: afterColor
};

var keys = {
  change: `
<ul>
  <li> <i class="dot" style="background: ${shades[0]}"></i> Increased density within the same level
  <li> <i class="dot" style="background: ${shades[1]}"></i> Increased one density level
  <li> <i class="dot" style="background: ${shades[2]}"></i> Increased two or more density levels
</ul>
  `,
  before: `
<ul>
  <li> <i class="dot" style="background: ${rgb.apply(null, lowColor)}"></i> Lowest density
  <li> <i class="dot" style="background: ${rgb.apply(null, highColor)}"></i> Highest density
</ul>
  `
};
keys.after = keys.before;

var style = function(feature) {
  var fillColor = colorizer[mode](feature.properties);
  return {
    fillColor,
    color: palette.dfDarkGray,
    opacity: .5,
    fillOpacity: .8,
    weight: .5
  }
};

var onClickZone = function(e) {
  var props = e.target.feature.properties;
  map.openPopup(`
<div class="mha-popup">
  <h3>${props.type} zone</h3>
  <ul>
    <li> <b>Current: ${props.zoning}</b>
      <ul>
        <li> ${props.mha_before.description || "No description"}
        <li> Density level ${props.mha_before.mha_cat}
      </ul>
    <li> <b>Proposed: ${props.mha}</b>
      <ul>
        <li> ${props.mha_after.description || "No description"}
        <li> Density level ${props.mha_after.mha_cat}
      </ul>
  </ul>
</div>
  `, e.latlng)
}

var init = function(geodata) {
  button.parentElement.removeChild(button);
  geodata.features.forEach(processFeature);
  geoJSON = new L.GeoJSON(geodata, { style, onEachFeature: (f, l) => l.addEventListener("click", onClickZone) });
  geoJSON.addTo(map);
  map.fitBounds(geoJSON.getBounds());
};


var loadData = function() {
  button.innerHTML = "Loading...";
  // this may be entirely pointless, but fun
  if ("Worker" in window) {
    var worker = new Worker("./worker.js");
    worker.onmessage = msg => init(msg.data);
  } else {
    xhr("./assets/mha.geojson", (_, data) => init(data));
  }
};

// button.addEventListener("click", loadData);
loadData();

var keyContainer = $.one(".key");

var changeMode = function() {
  var selected = $.one(".mode-controls input:checked").value;
  mode = selected;
  keyContainer.innerHTML = keys[mode];
  if (geoJSON) geoJSON.setStyle(style);
};

$.one(".mode-controls").addEventListener("change", changeMode);

changeMode();
