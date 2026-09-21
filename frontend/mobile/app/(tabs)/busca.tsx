import { useState } from "react";
import { View, Text, TextInput, FlatList } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../lib/theme";
import { api, type ApiCourse } from "../../lib/api";
import { CourseCard } from "../../components/CourseCard";

export default function BuscaScreen() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["mobile-search", q],
    queryFn: () => api<ApiCourse[]>(`/api/courses?q=${encodeURIComponent(q)}`, null),
    enabled: q.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Buscar cursos…"
        placeholderTextColor={colors.textMuted}
        style={{ backgroundColor: colors.surface, color: "#fff", borderRadius: 6, padding: 12 }}
      />
      <FlatList
        data={data ?? []}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingTop: 16 }}
        renderItem={({ item }) => <CourseCard course={item} />}
        ListEmptyComponent={q.length >= 2 ? <Text style={{ color: colors.textSecondary }}>Nada encontrado.</Text> : null}
      />
    </View>
  );
}
