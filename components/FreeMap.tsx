import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface FreeMapProps {
  latitude: number;
  longitude: number;
  reports: any[];
  onMarkerPress?: (reportId: string) => void;
}

export const FreeMap: React.FC<FreeMapProps> = ({ latitude, longitude, reports }) => {
  // Generate HTML for Leaflet
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #000; }
        #map { height: 100vh; width: 100vw; background: #000; }
        .leaflet-container { background: #000; }
        /* Dark mode map tiles filter */
        .leaflet-tile-pane {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', {
          zoomControl: false,
          attributionControl: false
        }).setView([${latitude}, ${longitude}], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        // User Marker
        const userIcon = L.divIcon({
          className: 'user-marker',
          html: '<div style="width: 14px; height: 14px; background: #00ff88; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 15px #00ff88;"></div>',
          iconSize: [20, 20]
        });
        L.marker([${latitude}, ${longitude}], { icon: userIcon }).addTo(map);

        const reports = ${JSON.stringify(reports)};
        
        // Heatmap Data
        const heatPoints = reports
          .filter(r => r.location && r.location.latitude && r.location.longitude)
          .map(r => [
            r.location.latitude, 
            r.location.longitude, 
            (r.upvotes || 1) / 10 // Intensity
          ]);

        if (heatPoints.length > 0) {
          L.heatLayer(heatPoints, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
          }).addTo(map);
        }

        // Report Markers
        reports.forEach(report => {
          if (report.location && report.location.latitude && report.location.longitude) {
            const reportIcon = L.divIcon({
              className: 'report-marker',
              html: '<div style="width: 10px; height: 10px; background: #00ff88; border: 2px solid #000; border-radius: 50%;"></div>',
              iconSize: [12, 12]
            });
            L.marker([report.location.latitude, report.location.longitude], { icon: reportIcon }).addTo(map);
          }
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.map}
        scrollEnabled={false} // Prevent scrolling out of the container
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
