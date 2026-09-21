import { FlatList, View, Text } from "react-native";
import { CourseCard } from "./CourseCard";
import type { ApiCourse } from "../lib/api";

export function CourseCarousel({ title, courses }: { title: string; courses: ApiCourse[] }) {
  if (!courses.length) return null;
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginLeft: 16, marginBottom: 8 }}>{title}</Text>
      <FlatList
        horizontal
        data={courses}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => <CourseCard course={item} />}
      />
    </View>
  );
}
