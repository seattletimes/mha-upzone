var xhr = new XMLHttpRequest();

xhr.open("GET", "./assets/mha.geojson");
xhr.send();

xhr.addEventListener("load", function() {
  var json = JSON.parse(xhr.responseText);
  self.postMessage(json);
});