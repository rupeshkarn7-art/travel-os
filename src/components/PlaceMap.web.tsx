import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { buildMapHtml, MapMarker } from './mapHtml';

export function PlaceMap({ markers, height = 260, selectedId, onSelect }: { markers: MapMarker[]; height?: number | string; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const html = useMemo(() => buildMapHtml(markers.filter((m) => m.lat != null && m.lng != null), selectedId), [markers, selectedId]);
  useEffect(() => {
    const h = (e: MessageEvent) => { if (e.data && e.data.travelosMarker) onSelect?.(String(e.data.travelosMarker)); };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [onSelect]);
  return (
    <View style={{ height: height as any, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E8F0FD' }}>
      {React.createElement('iframe', { srcDoc: html, title: 'Map', style: { border: 0, width: '100%', height: '100%' }, sandbox: 'allow-scripts allow-same-origin' })}
    </View>
  );
}
