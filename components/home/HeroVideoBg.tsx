import React from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

// Hero video loop — Pablo 2026-04-25 (Fase C). Placeholder que reproduce un
// archivo `assets/video/hero-loop.mp4` en bucle silencioso, full-screen cover.
//
// Pablo: "quizás también con claude+veo+nano banana". El plan es que Pablo
// genere un loop cinemático 8-12s con Veo (golden hour Miami / drone /
// timelapse cielo) y lo deposite en `assets/video/hero-loop.mp4`. Hasta
// entonces, este componente ejecuta en modo fallback: si el archivo no
// existe, muestra solo bg neutro y la app sigue funcionando.

let videoSource: number | null = null;
try {
  // require dinámico para que la ausencia del asset no rompa el bundle.
  // Cuando Pablo añada el archivo, descomentar la línea de abajo (Metro
  // resuelve el require en build-time, así que no podemos hacer try real;
  // dejamos esta nota como guía).
  // videoSource = require('../../assets/video/hero-loop.mp4');
} catch {
  videoSource = null;
}

export const HeroVideoBg: React.FC = () => {
  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  if (!videoSource) {
    // Fallback visual hasta que Pablo añada el video — gradient/static neutral.
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a0e08' }]} pointerEvents="none" />;
  }

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  );
};
