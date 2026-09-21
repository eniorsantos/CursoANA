import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { colors } from "../../lib/theme";
import { API_URL } from "../../lib/api";
import { getToken } from "../../lib/auth";

// Player nativo (spec §7): mesma URL assinada HLS do backend; progresso a cada 15s;
// overlay "próxima aula" estilo Netflix nos segundos finais.
export default function PlayerScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);
  const player = useVideoPlayer(playbackUrl ?? "", (p) => {
    if (playbackUrl) p.play();
  });
  const lastReport = useRef(0);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/lessons/${lessonId}/playback-url`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setPlaybackUrl(data.url);
    })();
  }, [lessonId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!player.playing) return;
      const watched = Math.floor(player.currentTime);
      if (player.duration - player.currentTime < 15) setShowNext(true);
      if (watched - lastReport.current >= 15) {
        lastReport.current = watched;
        const token = await getToken();
        await fetch(`${API_URL}/api/lessons/${lessonId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ watchedSeconds: watched }),
        }).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [player, lessonId]);

  if (!playbackUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textSecondary }}>Carregando vídeo…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <VideoView player={player} style={{ width: "100%", height: "100%" }} contentFit="contain" nativeControls={false} />
      {showNext && (
        <View style={{ position: "absolute", bottom: 40, left: 16, right: 16, backgroundColor: colors.surface, borderRadius: 8, padding: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: "700" }}>PRÓXIMA AULA</Text>
          <Text style={{ color: "#fff", marginTop: 4 }}>Continuar para a próxima aula</Text>
          <Pressable onPress={() => setShowNext(false)}>
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Cancelar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
