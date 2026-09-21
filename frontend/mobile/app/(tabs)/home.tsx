import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ImageBackground } from "react-native";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../lib/theme";
import { api, type ApiCourse } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { CourseCarousel } from "../../components/CourseCarousel";

type HomeData = { hero: ApiCourse | null; sections: { title: string; courses: ApiCourse[] }[] };

function Hero({ course }: { course: ApiCourse }) {
  return (
    <ImageBackground source={{ uri: course.thumbnailUrl ?? undefined }} style={{ height: 480, justifyContent: "flex-end" }}>
      <LinearGradient colors={["transparent", "rgba(20,20,20,0.8)", colors.background]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 300 }} />
      <View style={{ padding: 16 }}>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>{course.title}</Text>
        <Text numberOfLines={2} style={{ color: "#ccc", marginTop: 4 }}>{course.description}</Text>
        <View style={{ flexDirection: "row", marginTop: 16, gap: 12 }}>
          <Link href={`/curso/${course.slug}`} asChild>
            <Pressable style={{ backgroundColor: "#fff", paddingVertical: 10, paddingHorizontal: 24, borderRadius: 4 }}>
              <Text style={{ fontWeight: "700" }}>▶ Assistir</Text>
            </Pressable>
          </Link>
          <Link href={`/curso/${course.slug}`} asChild>
            <Pressable style={{ backgroundColor: "rgba(109,109,110,0.7)", paddingVertical: 10, paddingHorizontal: 24, borderRadius: 4 }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>ℹ Mais informações</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ImageBackground>
  );
}

export default function HomeScreen() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then(setToken);
  }, []);

  // Catálogo com cache generoso (spec §11): não muda a cada minuto.
  const { data, isLoading } = useQuery({
    queryKey: ["mobile-home"],
    queryFn: () => api<HomeData>("/api/mobile/home", token),
    enabled: token !== null,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  if (isLoading || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textSecondary }}>Carregando…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      {data.hero && <Hero course={data.hero} />}
      {data.sections.map((s) => (
        <CourseCarousel key={s.title} title={s.title} courses={s.courses} />
      ))}
    </ScrollView>
  );
}
