import { View, Text } from "react-native";
import { colors } from "../../lib/theme";

export default function MeusCursosScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Minha Lista</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Seus cursos e downloads offline aparecem aqui.</Text>
    </View>
  );
}
