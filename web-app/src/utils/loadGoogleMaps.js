export function loadGoogleMaps(apiKey) {
  return new Promise((resolve) => {
    if (window.google && window.google.maps) return resolve();
    const id = "google-maps-script";
    if (document.getElementById(id)) {
      const interval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,places,routes,geocoding&callback=initMap`;
    s.async = true;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}
