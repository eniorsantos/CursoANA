import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { colors } from "../../lib/theme";
import { listDownloads, removeDownload, purgeExpired, totalDownloadBytes, type DownloadMeta } from "../../lib/downloads";
import { getUserId } from "../../lib/auth";
import { registerPushNotifications } from "../../lib/notifications";

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MeusCursosScreen() {
  const [items, setItems] = useState<DownloadMeta[]>([]);
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    // Checagem de expiração/acesso a cada abertura (spec §8)
    const userId = await getUserId();
    if (userId) await purgeExpired(userId);
    setItems(await listDownloads());
    setTotal(await totalDownloadBytes());
    await registerPushNotifications();
  }, []);

  useFocusEffect(() => {
    refresh();
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Downloads</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{formatMB(total)} usados · expiram em 30 dias</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.lessonId}
        contentContainerStyle={{ paddingTop: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.surface, borderRadius: 6, padding: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>{item.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {formatMB(item.sizeBytes)} · expira em {new Date(item.expiresAt).toLocaleDateString("pt-BR")}
            </Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
              <Pressable onPress={() => router.push(`/player/${item.lessonId}?offline=1`)}>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>▶ Assistir offline</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await removeDownload(item.lessonId);
                  await refresh();
                }}
              >
                <Text style={{ color: colors.textSecondary }}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, marginTop: 16 }}>Nenhuma aula baixada. Abra uma aula e toque em Baixar.</Text>}
      />
    </View>
  );
}
