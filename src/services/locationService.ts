export interface GeoLocationResult {
  road: string;
  area: string;
  ward: string;
  city: string;
  coords: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export async function getCurrentGeoLocation(): Promise<GeoLocationResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const coords = `${latitude.toFixed(6)}° N, ${longitude.toFixed(6)}° E`;

        try {
          // Reverse geocoding via OpenStreetMap Nominatim
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'CivicAI-SmartCity-Platform/2.0',
              },
            }
          );

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const road = addr.road || addr.street || addr.suburb || 'Municipal Arterial Road';
            const area = [addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.county, addr.postcode]
              .filter(Boolean)
              .join(', ');
            const city = addr.city || addr.town || addr.state || 'Smart City District';
            const ward = `Ward ${Math.floor((latitude * 100) % 50) + 1} (${city})`;

            resolve({
              road,
              area: area || 'Urban Municipal Zone',
              ward,
              city,
              coords,
              latitude,
              longitude,
              accuracyMeters: Math.round(accuracy),
            });
            return;
          }
        } catch (e) {
          console.warn('Reverse geocoding failed, using coordinates:', e);
        }

        // Fallback with coordinates
        resolve({
          road: 'Municipal Main Road',
          area: `Transit Corridor (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          ward: 'Central Smart City Ward',
          city: 'Municipal Smart City',
          coords,
          latitude,
          longitude,
          accuracyMeters: Math.round(accuracy),
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
