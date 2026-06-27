# Tasty Station POS — Mobile App (React Native / Expo)

Native mobile app for waiters, cashiers, and kitchen staff.

## Features

- **Login** — PIN/email authentication with secure storage
- **Dashboard** — Real-time stats (revenue, orders, pending)
- **Menu** — Browse menu items with veg/non-veg indicators
- **Kitchen Display** — View incoming orders, update status (Accept → Ready → Done)
- **Offline** — Network status detection (via expo-network)

## Setup

```bash
cd mobile
npm install
npx expo start
```

Scan QR code with Expo Go app on your phone.

## Build APK

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

## Configuration

Edit `src/api/client.js` to point to your backend:

```js
const API_URL = "http://YOUR_BACKEND_IP:3000/api";
```

For production, use your Vercel backend URL.

## Tech Stack

- React Native 0.76 (Expo 52)
- React Navigation 7 (bottom tabs)
- Zustand (state management)
- Axios (API client)
- Expo SecureStore (token storage)
- Expo Network (offline detection)
