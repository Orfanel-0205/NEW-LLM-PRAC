# Jarvis hand tracking

The Expo Go version uses autonomous still-image analysis. It can identify a clearly visible hand or coarse gesture, but it cannot produce continuous finger landmarks.

## Why native tracking is a separate runtime

Expo Go contains a fixed set of native modules. Real hand tracking needs access to camera frames plus a native inference library, so Jarvis must use an Expo development build for this feature.

## Target implementation

1. Install `expo-dev-client` and a native camera frame pipeline.
2. Add MediaPipe Hand Landmarker to Android with its model in the app assets.
3. Run the landmarker in live-stream mode and return the 21 landmarks per detected hand to React Native.
4. Convert image coordinates to preview coordinates, accounting for rotation, mirroring, and crop.
5. Drive callout position and gesture interaction from the landmarks at a capped inference rate.
6. Keep the existing Ollama snapshot scan for semantic scene explanations; do not send every camera frame to Ollama.

Build for a connected Android device after the native module is integrated:

```powershell
npx expo install expo-dev-client
npx expo run:android --device
```

Afterward, JavaScript-only changes can be served with `npx expo start --dev-client`. Rebuild whenever native dependencies or configuration change.

## Runtime contract

The UI must say `AI SNAPSHOT MODE` while running in Expo Go. It should say `NATIVE HAND LANDMARKS` only when the native tracker has initialized and is returning timestamped frames. This prevents a slow vision-language request from being mistaken for real-time tracking.
