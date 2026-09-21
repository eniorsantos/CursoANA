import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { colors } from "../lib/theme";
import type { ApiCourse } from "../lib/api";

export function CourseCard({ course }: { course: ApiCourse }) {
  return (
    <Pressable onPress={() => router.push(`/curso/${course.slug}`)} style={{ width: 140, marginRight: 8 }}>
      <View style={{ borderRadius: 4, overflow: "hidden", backgroundColor: colors.surface }}>
        <View style={{ width: 140, height: 200, justifyContent: "flex-end", padding: 6, backgroundColor: "#3A2A5C" }}>
          <Text numberOfLines={2} style={{ color: "#fff", fontSize: 13 }}>
            {course.title}
          </Text>
        </View>
        {course.progressPercent !== undefined && (
          <View style={{ height: 3, backgroundColor: "#4D4D4D" }}>
            <View style={{ width: `${course.progressPercent}%`, height: 3, backgroundColor: colors.primary }} />
          </View>
        )}
      </View>
    </Pressable>
  );
}
