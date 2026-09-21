import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { colors } from "../../lib/theme";
import { logout } from "../../lib/auth";

export default function PerfilScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Perfil</Text>
      <Pressable
        onPress={async () => {
          await logout();
          router.replace("/(auth)/login");
        }}
        style={{ marginTop: 16, backgroundColor: colors.surface, padding: 12, borderRadius: 6 }}
      >
        <Text style={{ color: "#fff" }}>Sair</Text>
      </Pressable>
    </View>
  );
}
