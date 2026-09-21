# CursosAna Mobile (Expo — MVP Fase 1 da spec)

App React Native com Expo Router consumindo a mesma API do backend (`frontend/mobile`).

## Telas (spec §3–§4)
- `(auth)/login` — JWT via `POST /api/auth/mobile/login`, token em `expo-secure-store`
- `(tabs)/home` — endpoint agregado `GET /api/mobile/home` (hero + carrosséis, 1 chamada)
- `(tabs)/busca` — `GET /api/courses?q=` com debounce implícito (≥2 chars)
- `(tabs)/meus-cursos`, `(tabs)/perfil` (logout)
- `curso/[slug]` — detalhe + módulos/aulas expansíveis + comprar
- `player/[lessonId]` — `expo-video` com a mesma URL assinada HLS, progresso a cada 15 s,
  overlay "próxima aula" nos últimos 15 s

## Fora do MVP (Fase 2 da spec)
Downloads offline criptografados, push notifications, busca com sugestões,
Chromecast/AirPlay, perfis múltiplos, modo tablet.

## Rodar
```bash
cd frontend/mobile
npm install
npx expo start
# EAS: eas build --platform android --profile staging
```
Configure `EXPO_PUBLIC_API_URL` (ou `extra.apiUrl` no `app.json`) para o backend.
Checkout abre no navegador do sistema (`expo-web-browser`) — sem IAP no MVP;
validar política da App Store antes de escalar (spec §9).
