import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Link, router } from "expo-router";
import { colors } from "../../lib/theme";
import { login } from "../../lib/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit() {
    setError("");
    try {
      await login(email, password);
      router.replace("/(tabs)/home");
    } catch {
      setError("Credenciais inválidas");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24 }}>
      <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800", marginBottom: 24 }}>Entrar</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" placeholderTextColor={colors.textMuted} style={{ backgroundColor: colors.surface, color: "#fff", borderRadius: 6, padding: 12, marginBottom: 12 }} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Senha" secureTextEntry placeholderTextColor={colors.textMuted} style={{ backgroundColor: colors.surface, color: "#fff", borderRadius: 6, padding: 12, marginBottom: 12 }} />
      {error ? <Text style={{ color: "red", marginBottom: 12 }}>{error}</Text> : null}
      <Pressable onPress={onSubmit} style={{ backgroundColor: colors.primary, padding: 14, borderRadius: 6, alignItems: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>Entrar</Text>
      </Pressable>
      <Link href="/(auth)/cadastro" asChild>
        <Pressable style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary }}>Criar conta</Text>
        </Pressable>
      </Link>
    </View>
  );
}
