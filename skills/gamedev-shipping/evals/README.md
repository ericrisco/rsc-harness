# Evals — gamedev-shipping

These cases assert the skill fires on export/build/package/publish requests across engines
(Godot/Unity/Unreal) and platforms (desktop/web/mobile/store), and that it stays out of runtime
code (routes gameplay → engine skills, netcode → gamedev-multiplayer) and normal web-app hosting
(→ deployment). The capability scenarios check the load-bearing, version-correct facts: the
COOP/COEP cross-origin-isolation headers for threaded web builds, the macOS
codesign→notarytool→stapler chain, the Android JDK 17 + AAB + keystore release path, and the
Godot C#/.NET "no web export" limitation.
