const GOOGLE_MAPS_SCRIPT_ID = "google-maps-script";
const GOOGLE_MAPS_LIBRARIES = ["drawing", "geometry", "places"];

let googleMapsPromise = null;

function buildGoogleMapsUrl(apiKey) {
  const params = new URLSearchParams({
    key: apiKey,
    loading: "async",
    libraries: GOOGLE_MAPS_LIBRARIES.join(","),
  });

  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

function waitForGoogleMaps(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const poll = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error("Google Maps no termino de cargar a tiempo"));
        return;
      }

      window.setTimeout(poll, 50);
    };

    poll();
  });
}

export function loadGoogleMaps(apiKey) {
  if (!apiKey) {
    return Promise.reject(new Error("Falta VITE_GOOGLE_MAPS_API_KEY"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);

    if (existingScript) {
      waitForGoogleMaps().then(resolve).catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = buildGoogleMapsUrl(apiKey);
    script.async = true;
    script.defer = true;

    script.onload = () => {
      waitForGoogleMaps().then(resolve).catch(reject);
    };

    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error("No se pudo descargar Google Maps"));
    };

    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPromise = null;
    throw error;
  });

  return googleMapsPromise;
}
