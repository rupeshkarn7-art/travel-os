import React, { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildMapHtml, MapMarker } from './mapHtml';

export function PlaceMap({ markers, height = 260, selectedId, onSelect }: { markers: MapMarker[]; height?: number | string; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const html = useMemo(() => buildMapHtml(markers.filter((m) => m.lat != null && m.lng != null), selectedId), [markers, selectedId]);
  return (
    <View style={{ height: height as any, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E8F0FD' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost' }}
        onMessage={(e) => onSelect?.(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        accessibilityLabel="Map"
      />
    </View>
  );
}
