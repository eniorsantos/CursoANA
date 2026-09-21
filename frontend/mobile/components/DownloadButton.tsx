import { useState } from "react";
import { Pressable, Text } from "react-native";
import { colors } from "../lib/theme";
import { downloadLesson } from "../lib/downloads";
import { getUserId } from "../lib/auth";

export function DownloadButton({ lessonId, title }: { lessonId: string; title: string }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  async function onPress() {
    const userId = await getUserId();
    if (!userId) return;
    setProgress(0);
    try {
      await downloadLesson(lessonId, title, userId, setProgress);
      setDone(true);
    } catch {
      // ex: sem acesso — o backend responde 403
    } finally {
      setProgress(null);
    }
  }

  if (done) return <Text style={{ color: colors.success }}>✓ Baixado</Text>;
  if (progress !== null) return <Text style={{ color: colors.textSecondary }}>{Math.round(progress * 100)}%</Text>;
  return (
    <Pressable onPress={onPress}>
      <Text style={{ color: colors.textSecondary }}>⬇</Text>
    </Pressable>
  );
}
