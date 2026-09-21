# Especificação de App Frontend Mobile (Android/iOS) — Estética Netflix

## 1. Decisão de Stack

| Opção | Prós | Contras |
|---|---|---|
| **React Native (Expo)** | Reaproveita lógica/tipos do backend Next.js (TypeScript compartilhado), comunidade enorme, deploy via EAS | Performance de scroll/animação exige atenção em listas grandes |
| Flutter | Performance de UI excelente, ótimo para animações complexas | Stack separada do backend (Dart), sem reuso de código TS |
| Nativo (Swift + Kotlin) | Máxima performance e acesso a APIs nativas | Dobra o time e o custo de manutenção (2 codebases) |

**Recomendação: React Native com Expo.** Dado que o backend já é TypeScript/Prisma, dá para compartilhar tipos (via um pacote `packages/shared-types` no monorepo) entre o Next.js admin/web e o app mobile — reduz duplicação e erros de contrato de API.

```
plataforma-cursos/
├── apps/
│   ├── web/          (já existente)
│   ├── admin/         (já existente)
│   ├── mobile/         # <- novo: Expo React Native
│   └── api/
├── packages/
│   ├── database/
│   ├── shared-types/   # <- novo: tipos de Course, Lesson, User compartilhados
│   └── ui/
```

---

## 2. Design System — Linguagem Visual "Netflix-like"

### 2.1 Paleta de cores

```typescript
// packages/ui/tokens/colors.ts
export const colors = {
  background: "#141414",       // fundo principal, quase preto
  surface: "#1F1F1F",          // cards, modais
  surfaceElevated: "#2A2A2A",  // elementos sobre cards (botões secundários)
  primary: "#E50914",          // vermelho de destaque (CTA, badges, progresso)
  textPrimary: "#FFFFFF",
  textSecondary: "#B3B3B3",
  textMuted: "#737373",
  gradientOverlay: "linear-gradient(180deg, rgba(20,20,20,0) 0%, rgba(20,20,20,1) 100%)",
  success: "#46D369",          // "Concluído", progresso 100%
  border: "#3A3A3A",
};
```

### 2.2 Tipografia

```typescript
export const typography = {
  fontFamily: "Inter", // ou Netflix Sans Regular se quiser licenciar algo próximo
  hero: { size: 32, weight: "800" },
  title: { size: 20, weight: "700" },
  subtitle: { size: 15, weight: "500", color: colors.textSecondary },
  body: { size: 14, weight: "400" },
  caption: { size: 12, weight: "400", color: colors.textMuted },
};
```

### 2.3 Padrões visuais centrais (o que faz "parecer Netflix")

- **Fundo escuro absoluto** em toda a aplicação, sem modo claro (ou modo claro como exceção rara)
- **Hero banner** no topo da Home: imagem/trailer em destaque com gradiente escurecendo por baixo, título grande e dois botões (Continuar/Assistir + Mais informações)
- **Carrosséis horizontais** por categoria ("Continue assistindo", "Populares em Marketing", "Novos cursos") — cards com scroll horizontal, nunca grid vertical na Home
- **Cards com hover/press state**: leve zoom (`scale: 1.05`) e sombra ao tocar, mostrando título e barra de progresso se já iniciado
- **Barra de progresso fina** vermelha sobreposta na parte inferior do thumbnail de cursos já iniciados
- **Transições suaves**: fade entre telas, nunca troca abrupta de tela

---

## 3. Inventário de Telas

```
├── Onboarding (3 slides + CTA de cadastro/login)
├── Login
│   ├── Email/senha
│   └── Login social (Google/Apple)
├── Cadastro
├── Recuperar senha
├── Home
│   ├── Hero banner (curso em destaque)
│   ├── Carrossel "Continue assistindo"
│   ├── Carrossel "Recomendados para você"
│   ├── Carrossel por categoria (dinâmico)
│   └── Carrossel "Meus cursos"
├── Busca
│   ├── Campo de busca com sugestões
│   └── Grid de resultados
├── Detalhes do Curso
│   ├── Banner do curso + botão "Assistir"/"Comprar"
│   ├── Sinopse, instrutor, avaliação
│   ├── Lista de módulos/aulas (expansível, tipo "temporadas")
│   └── Carrossel "Cursos relacionados"
├── Player de Vídeo (tela cheia, landscape)
│   ├── Controles customizados
│   ├── Seletor de qualidade/velocidade
│   └── "Próxima aula" (auto-play, estilo "próximo episódio")
├── Downloads
│   ├── Lista de aulas baixadas
│   └── Gerenciamento de espaço
├── Meus Cursos / Minha Lista
├── Perfil
│   ├── Dados da conta
│   ├── Assinatura/Planos (upgrade, cancelar)
│   ├── Certificados (lista + compartilhar)
│   └── Configurações (notificações, qualidade de download, sair)
└── Checkout (compra avulsa ou assinatura, WebView ou nativo)
```

---

## 4. Estrutura de Navegação

```tsx
// apps/mobile/app/_layout.tsx (Expo Router)
<Stack>
  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="curso/[slug]" options={{ presentation: "card" }} />
  <Stack.Screen name="player/[lessonId]" options={{ presentation: "fullScreenModal" }} />
  <Stack.Screen name="checkout/[courseId]" options={{ presentation: "modal" }} />
</Stack>
```

```tsx
// apps/mobile/app/(tabs)/_layout.tsx — navegação inferior, estilo Netflix
<Tabs screenOptions={{ tabBarActiveTintColor: colors.textPrimary, tabBarStyle: { backgroundColor: colors.background } }}>
  <Tabs.Screen name="home" options={{ title: "Início", tabBarIcon: HomeIcon }} />
  <Tabs.Screen name="busca" options={{ title: "Buscar", tabBarIcon: SearchIcon }} />
  <Tabs.Screen name="downloads" options={{ title: "Downloads", tabBarIcon: DownloadIcon }} />
  <Tabs.Screen name="meus-cursos" options={{ title: "Minha Lista", tabBarIcon: ListIcon }} />
  <Tabs.Screen name="perfil" options={{ title: "Perfil", tabBarIcon: UserIcon }} />
</Tabs>
```

---

## 5. Componentes-Chave

### 5.1 Card de Curso (com progresso)

```tsx
// components/CourseCard.tsx
import { Image, Pressable, View, Text } from "react-native";
import { colors } from "@ui/tokens/colors";

type Props = {
  title: string;
  thumbnailUrl: string;
  progressPercent?: number; // 0-100, undefined = ainda não iniciado
  onPress: () => void;
};

export function CourseCard({ title, thumbnailUrl, progressPercent, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={{ width: 140, marginRight: 8 }}>
      <View style={{ borderRadius: 4, overflow: "hidden" }}>
        <Image source={{ uri: thumbnailUrl }} style={{ width: 140, height: 200 }} />
        {progressPercent !== undefined && (
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "#4D4D4D" }}>
            <View style={{ width: `${progressPercent}%`, height: 3, backgroundColor: colors.primary }} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, marginTop: 4 }}>
        {title}
      </Text>
    </Pressable>
  );
}
```

### 5.2 Carrossel Horizontal (base para todas as seções da Home)

```tsx
// components/CourseCarousel.tsx
import { FlatList, View, Text } from "react-native";
import { CourseCard } from "./CourseCard";

type Course = { id: string; title: string; thumbnailUrl: string; progressPercent?: number };

export function CourseCarousel({ title, courses, onCoursePress }: {
  title: string;
  courses: Course[];
  onCoursePress: (course: Course) => void;
}) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginLeft: 16, marginBottom: 8 }}>
        {title}
      </Text>
      <FlatList
        horizontal
        data={courses}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <CourseCard
            title={item.title}
            thumbnailUrl={item.thumbnailUrl}
            progressPercent={item.progressPercent}
            onPress={() => onCoursePress(item)}
          />
        )}
      />
    </View>
  );
}
```

### 5.3 Hero Banner da Home

```tsx
// components/HeroBanner.tsx
import { ImageBackground, View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function HeroBanner({ course, onPlay, onDetails }: {
  course: { title: string; bannerUrl: string; description: string };
  onPlay: () => void;
  onDetails: () => void;
}) {
  return (
    <ImageBackground source={{ uri: course.bannerUrl }} style={{ height: 480 }}>
      <LinearGradient
        colors={["transparent", "rgba(20,20,20,0.8)", "#141414"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 300 }}
      />
      <View style={{ position: "absolute", bottom: 24, left: 16, right: 16 }}>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>{course.title}</Text>
        <Text numberOfLines={2} style={{ color: "#ccc", marginTop: 4 }}>{course.description}</Text>
        <View style={{ flexDirection: "row", marginTop: 16, gap: 12 }}>
          <Pressable onPress={onPlay} style={{ backgroundColor: "#fff", paddingVertical: 10, paddingHorizontal: 24, borderRadius: 4, flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontWeight: "700" }}>▶ Assistir</Text>
          </Pressable>
          <Pressable onPress={onDetails} style={{ backgroundColor: "rgba(109,109,110,0.7)", paddingVertical: 10, paddingHorizontal: 24, borderRadius: 4 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>ℹ Mais informações</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}
```

---

## 6. Integração com o Backend Existente

O app mobile **não recria lógica de negócio** — consome as mesmas rotas de API já construídas para o web, com pequenos endpoints adicionais específicos de mobile.

| Tela | Endpoint (já existente) | Observação |
|---|---|---|
| Home | `GET /api/mobile/home` (novo, agregado) | Endpoint dedicado que já retorna hero + carrosséis numa única chamada, evitando N requisições |
| Detalhes do curso | `GET /api/courses/[slug]` | Reaproveita do backend web |
| Checar acesso | `hasAccessToCourse()` (já existe) | Exposto via `GET /api/courses/[id]/access` |
| Player | `GET /api/lessons/[id]/playback-url` | Mesmo endpoint de URL assinada do Mux/Bunny já implementado |
| Progresso | `POST /api/lessons/[id]/progress` | Mesmo endpoint, chamado do player nativo |
| Certificados | `GET /api/users/me/certificates` | Novo endpoint simples de listagem |
| Checkout | `POST /api/checkout/stripe` ou `/mercadopago` | Abre em WebView (ver seção 9) |
| Autenticação | Auth.js via API Route + JWT | Mobile usa `expo-secure-store` para persistir o token, não cookies |

### 6.1 Endpoint agregado de Home (novo, otimizado para mobile)

Evita que o app dispare 5-6 requisições separadas ao abrir — uma preocupação real de performance em rede móvel:

```typescript
// app/api/mobile/home/route.ts
export async function GET(req: Request) {
  const user = await getCurrentUser(req);

  const [continueWatching, recommended, categories, myCourses] = await Promise.all([
    getContinueWatchingCourses(user.id),
    getRecommendedCourses(user.id),
    getCoursesByCategory(),
    getUserEnrolledCourses(user.id),
  ]);

  return Response.json({
    hero: recommended[0] ?? null,
    sections: [
      { title: "Continue assistindo", courses: continueWatching },
      { title: "Recomendados para você", courses: recommended },
      ...categories,
      { title: "Meus cursos", courses: myCourses },
    ],
  });
}
```

### 6.2 Autenticação no mobile (diferente do cookie usado na web)

```typescript
// apps/mobile/lib/auth.ts
import * as SecureStore from "expo-secure-store";

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/mobile/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const { token } = await res.json();
  await SecureStore.setItemAsync("auth_token", token); // armazenamento seguro do device
  return token;
}

export async function getAuthHeader() {
  const token = await SecureStore.getItemAsync("auth_token");
  return { Authorization: `Bearer ${token}` };
}
```

```typescript
// app/api/mobile/login/route.ts — endpoint específico que retorna JWT em vez de cookie de sessão
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = await validateCredentials(email, password); // reaproveita a lógica do authorize() do Auth.js
  if (!user) return new Response("Credenciais inválidas", { status: 401 });

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: "30d" });
  return Response.json({ token });
}
```

---

## 7. Player de Vídeo Nativo

Reaproveita a mesma URL assinada HLS do Mux/Bunny já implementada no backend, mas o player em si precisa de uma lib nativa (o `hls.js` da web não roda em React Native).

```bash
npx expo install expo-av
```

```tsx
// components/VideoPlayer.native.tsx
import { Video, ResizeMode } from "expo-av";
import { useEffect, useRef, useState } from "react";

export function NativeVideoPlayer({ lessonId }: { lessonId: string }) {
  const videoRef = useRef<Video>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth(`/api/lessons/${lessonId}/playback-url`)
      .then((res) => res.json())
      .then((data) => setPlaybackUrl(data.url));
  }, [lessonId]);

  async function handlePlaybackStatusUpdate(status: any) {
    if (status.isLoaded && Math.floor(status.positionMillis / 1000) % 15 === 0) {
      fetchWithAuth(`/api/lessons/${lessonId}/progress`, {
        method: "POST",
        body: JSON.stringify({ watchedSeconds: Math.floor(status.positionMillis / 1000) }),
      });
    }
  }

  if (!playbackUrl) return <LoadingSpinner />;

  return (
    <Video
      ref={videoRef}
      source={{ uri: playbackUrl }}
      resizeMode={ResizeMode.CONTAIN}
      useNativeControls={false} // controles customizados, estilo Netflix
      onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      shouldPlay
      style={{ width: "100%", height: "100%" }}
    />
  );
}
```

> Para uma experiência mais robusta (qualidade adaptativa real, melhor suporte a HLS/DRM), vale considerar `react-native-video` no lugar do `expo-av` conforme o app amadurece — `expo-av` é suficiente para MVP mas tem limitações em controle fino de qualidade.

### 7.1 Tela "Próxima aula" (auto-play estilo Netflix)

```tsx
// components/NextEpisodeOverlay.tsx
// Aparece nos últimos 15s do vídeo, com contagem regressiva e opção de cancelar
export function NextEpisodeOverlay({ nextLesson, onPlay, onCancel }: {
  nextLesson: { title: string; thumbnailUrl: string };
  onPlay: () => void;
  onCancel: () => void;
}) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown === 0) return onPlay();
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <View style={styles.overlay}>
      <Image source={{ uri: nextLesson.thumbnailUrl }} style={styles.thumb} />
      <Text style={styles.title}>Próxima aula: {nextLesson.title}</Text>
      <Text style={styles.countdown}>Iniciando em {countdown}s</Text>
      <Pressable onPress={onCancel}><Text>Cancelar</Text></Pressable>
    </View>
  );
}
```

---

## 8. Downloads Offline

Diferencial importante em mobile (rede instável, dados móveis caros no Brasil).

| Aspecto | Abordagem |
|---|---|
| Formato | Baixar o `.mp4` de qualidade única (não o HLS adaptativo, que é para streaming) — o Mux/Bunny oferecem um "static rendition" para isso |
| Armazenamento | `expo-file-system` salvando em diretório privado do app |
| Proteção | Arquivo criptografado localmente (AES) usando uma chave derivada do `userId + deviceId`, decriptado só em memória na hora da reprodução — evita que o `.mp4` baixado seja simplesmente copiado do storage do celular e compartilhado |
| Expiração | Downloads expiram (ex: 30 dias) ou se o usuário perder acesso ao curso (assinatura cancelada) — checagem local a cada abertura do app |

```typescript
// lib/downloads.ts
import * as FileSystem from "expo-file-system";

export async function downloadLesson(lessonId: string, staticRenditionUrl: string) {
  const localUri = `${FileSystem.documentDirectory}downloads/${lessonId}.mp4`;

  const downloadResumable = FileSystem.createDownloadResumable(
    staticRenditionUrl,
    localUri,
    {},
    (progress) => {
      const percent = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
      updateDownloadProgress(lessonId, percent);
    }
  );

  const result = await downloadResumable.downloadAsync();

  await saveDownloadMetadata({
    lessonId,
    localUri: result!.uri,
    downloadedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 dias
  });
}
```

---

## 9. Checkout no Mobile

Apps iOS têm uma restrição importante: a Apple **exige uso do In-App Purchase (IAP)** para conteúdo digital consumido dentro do app, cobrando 15-30% de comissão — a menos que a compra aconteça fora do app.

| Estratégia | Como funciona | Trade-off |
|---|---|---|
| **WebView externa (recomendado para MVP)** | Botão "Assinar" abre o navegador do sistema (não WebView interna) apontando para o checkout Stripe/MP já existente | Sem comissão da Apple, mas a Apple pode rejeitar se a experiência "parecer" comprar dentro do app — usar `expo-web-browser` com `openAuthSessionAsync`, deixando claro que saiu do app |
| Apple IAP + Google Play Billing | Implementar `react-native-iap`, replicando os planos como produtos nas duas lojas | Comissão de até 30%, mas experiência 100% nativa e sem risco de rejeição |

```typescript
// lib/checkout.ts
import * as WebBrowser from "expo-web-browser";

export async function openCheckout(courseId: string) {
  const res = await fetchWithAuth(`/api/checkout/stripe`, {
    method: "POST",
    body: JSON.stringify({ courseId }),
  });
  const { url } = await res.json();

  // Abre no navegador do sistema, não numa WebView embutida — mais seguro e mais aceito pela Apple
  await WebBrowser.openBrowserAsync(url);
}
```

> Essa é uma decisão de produto/negócio, não só técnica — vale validar com um advogado ou consultor de compliance de App Store antes de escalar, já que a Apple é rigorosa e pode rejeitar o app na revisão se entender que está contornando o IAP indevidamente.

---

## 10. Push Notifications

```typescript
// Casos de uso principais:
// - "Sua assinatura foi renovada"
// - "Novo curso disponível na categoria que você segue"
// - "Continue de onde parou: você não assiste há 3 dias"
```

```bash
npx expo install expo-notifications
```

Integra com a mesma fila BullMQ já construída — adiciona um novo tipo de job na fila `email` (ou uma fila `push` dedicada) que, em vez de (ou além de) enviar email, dispara via Expo Push API.

---

## 11. Performance e Cache

- **Cache de imagens**: `expo-image` (substituto do `Image` padrão) com cache em disco automático — essencial para carrosséis com dezenas de thumbnails
- **Cache de dados de API**: TanStack Query (`@tanstack/react-query`) com `staleTime` generoso para catálogo de cursos (não muda a cada minuto) e `staleTime: 0` para progresso/status de matrícula
- **Listas grandes**: usar `FlashList` (da Shopify) em vez de `FlatList` para carrosséis com muitos itens — renderização significativamente mais rápida

```typescript
// lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // catálogo: 5 min de cache
      retry: 2,
    },
  },
});
```

---

## 12. Build e Distribuição

```bash
npm install -g eas-cli
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

```json
// eas.json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "staging": { "distribution": "internal", "env": { "API_URL": "https://staging.seusite.com" } },
    "production": { "env": { "API_URL": "https://seusite.com" } }
  }
}
```

---

## 13. Roadmap de Implementação

**Fase 1 — MVP mobile (4-6 semanas)**
- Auth (login/cadastro/social), Home com carrosséis, detalhes do curso, player básico (sem download), checkout via navegador externo

**Fase 2 — Paridade com Netflix (3-4 semanas)**
- Downloads offline, "próxima aula" auto-play, push notifications, busca com sugestões

**Fase 3 — Polimento**
- Modo tablet/iPad otimizado, Chromecast/AirPlay, perfis múltiplos por conta (como Netflix permite "quem está assistindo")

---

## 14. Checklist Final

- [ ] Reaproveitar tipos TypeScript do backend via pacote compartilhado — evita contrato de API divergente entre web e mobile
- [ ] Autenticação mobile usa JWT + `expo-secure-store`, nunca cookie de sessão web
- [ ] Player nativo consome a mesma URL assinada do Mux/Bunny — não duplicar lógica de geração de token
- [ ] Downloads offline criptografados localmente, com expiração vinculada ao status de acesso do usuário
- [ ] Checkout iOS avaliado quanto à política de In-App Purchase da Apple antes do lançamento
- [ ] Endpoint agregado de Home para reduzir número de requisições em rede móvel
