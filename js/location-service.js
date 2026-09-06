/**
 * CIVICAI: Geolocation, Leaflet Interactive Map & Reverse Geocoding Service
 */

export class LocationService {
  /**
   * Get user's current GPS position with fallback
   */
  static getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  /**
   * Reverse geocode coordinates using OpenStreetMap Nominatim API
   */
  static async reverseGeocode(lat, lng) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'en' }
      });
      if (!res.ok) throw new Error('Geocoding request failed');
      const data = await res.json();
      
      const addr = data.address || {};
      const street = addr.road || addr.pedestrian || addr.street || addr.neighbourhood || '';
      const suburb = addr.suburb || addr.city_district || addr.quarter || '';
      const city = addr.city || addr.town || addr.county || 'Metro Region';
      const postcode = addr.postcode ? ` - ${addr.postcode}` : '';

      const formatted = [street, suburb, city].filter(Boolean).join(', ') + postcode;
      return {
        formattedAddress: formatted || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        city: city,
        raw: data
      };
    } catch (e) {
      console.warn('Reverse geocoding network error, fallback to coordinate string:', e);
      return {
        formattedAddress: `Near Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        city: 'Local Area',
        raw: null
      };
    }
  }

  /**
   * Initialize interactive Leaflet map instance on container
   */
  static initMap(containerId, initialLat = 28.6139, initialLng = 77.2090, onLocationChange = () => {}) {
    if (!window.L) {
      console.warn('Leaflet library not loaded.');
      return null;
    }

    const container = document.getElementById(containerId);
    if (!container) return null;

    // Remove existing map if any
    if (container._leaflet_id) {
      container._leaflet_id = null;
    }

    const map = L.map(containerId, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Custom Civic Marker Icon
    const civicIcon = L.divIcon({
      className: 'civic-map-marker',
      html: `<div style="
        background: #0f766e;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
      "><i class="fa-solid fa-triangle-exclamation" style="transform: rotate(45deg); font-size: 14px;"></i></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: civicIcon
    }).addTo(map);

    const updateLocation = async (lat, lng) => {
      onLocationChange(lat, lng, 'Locating address...');
      const geocoded = await LocationService.reverseGeocode(lat, lng);
      onLocationChange(lat, lng, geocoded.formattedAddress);
    };

    marker.on('dragend', function (e) {
      const pos = e.target.getLatLng();
      updateLocation(pos.lat, pos.lng);
    });

    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      updateLocation(e.latlng.lat, e.latlng.lng);
    });

    return {
      map,
      marker,
      setView: (lat, lng, zoom = 16) => {
        map.setView([lat, lng], zoom);
        marker.setLatLng([lat, lng]);
        updateLocation(lat, lng);
      }
    };
  }
}
