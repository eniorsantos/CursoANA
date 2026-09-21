import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { colors } from "../../lib/theme";
import { api, type ApiCourse } from "../../lib/api";
import { CourseCard } from "../../components/CourseCard";

type Suggestion = { id: string; slug: string; title: string };

export default function BuscaScreen() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  // Sugestões enquanto digita (≥2 chars) — endpoint leve top-5 (spec Fase 2)
  const { data: suggestions } = useQuery({
    queryKey: ["mobile-suggest", q],
    queryFn: () => api<Suggestion[]>(`/api/courses/suggest?q=${encodeURIComponent(q)}`, null),
    enabled: q.length >= 2 && q !== submitted,
    staleTime: 1000 * 60 * 5,
  });

  const { data } = useQuery({
    queryKey: ["mobile-search", submitted],
    queryFn: () => api<ApiCourse[]>(`/api/courses?q=${encodeURIComponent(submitted)}`, null),
    enabled: submitted.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  function submit(term: string) {
    setSubmitted(term);
    setQ(term);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <TextInput
        value={q}
        onChangeText={(t) => {
          setQ(t);
          setSubmitted("");
        }}
        onSubmitEditing={() => submit(q)}
        returnKeyType="search"
        placeholder="Buscar cursos…"
        placeholderTextColor={colors.textMuted}
        style={{ backgroundColor: colors.surface, color: "#fff", borderRadius: 6, padding: 12 }}
      />
      {q.length >= 2 && q !== submitted && (suggestions?.length ?? 0) > 0 && (
        <View style={{ backgroundColor: colors.surface, borderRadius: 6, marginTop: 8 }}>
          {suggestions!.map((s) => (
            <Pressable key={s.id} onPress={() => router.push(`/curso/${s.slug}`)} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: "#fff" }}>{s.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <FlatList
        data={submitted ? (data ?? []) : []}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingTop: 16 }}
        renderItem={({ item }) => <CourseCard course={item} />}
        ListEmptyComponent={submitted ? <Text style={{ color: colors.textSecondary }}>Nada encontrado.</Text> : null}
      />
    </View>
  );
}
