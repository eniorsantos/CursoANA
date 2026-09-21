import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../lib/theme";

function Icon({ children }: { children: string }) {
  return <Text style={{ fontSize: 20, color: colors.textPrimary }}>{children}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Início", tabBarIcon: () => <Icon>⌂</Icon> }} />
      <Tabs.Screen name="busca" options={{ title: "Buscar", tabBarIcon: () => <Icon>⌕</Icon> }} />
      <Tabs.Screen name="meus-cursos" options={{ title: "Minha Lista", tabBarIcon: () => <Icon>☰</Icon> }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil", tabBarIcon: () => <Icon>◍</Icon> }} />
    </Tabs>
  );
}
