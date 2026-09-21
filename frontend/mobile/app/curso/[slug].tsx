import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../lib/theme";
import { api } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { openCheckout } from "../../lib/checkout";
import { DownloadButton } from "../../components/DownloadButton";

type Detail = {
  id: string;
  title: string;
  description: string;
  modules: { id: string; title: string; lessons: { id: string; title: string }[] }[];
};

export default function CourseDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then(setToken);
  }, []);

  const { data: course } = useQuery({
    queryKey: ["course", slug],
    queryFn: () => api<Detail>(`/api/courses/${slug}`, null),
    staleTime: 1000 * 60 * 5,
  });

  if (!course) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textSecondary }}>Carregando…</Text>
      </View>
    );
  }

  const firstLesson = course.modules[0]?.lessons[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 220, backgroundColor: "#2E2740", justifyContent: "flex-end", padding: 16 }}>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{course.title}</Text>
      </View>
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>{course.description}</Text>
        {firstLesson ? (
          <Pressable onPress={() => router.push(`/player/${firstLesson.id}`)} style={{ backgroundColor: colors.primary, padding: 14, borderRadius: 4, alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>▶ Assistir agora</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => openCheckout(course.id, token)} style={{ backgroundColor: colors.primary, padding: 14, borderRadius: 4, alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Comprar curso</Text>
          </Pressable>
        )}
        {course.modules.map((m) => (
          <View key={m.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>{m.title}</Text>
            {m.lessons.map((l) => (
              <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/player/${l.id}`)}>
                  <Text style={{ color: colors.textSecondary, paddingVertical: 6 }}>• {l.title}</Text>
                </Pressable>
                <DownloadButton lessonId={l.id} title={l.title} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
