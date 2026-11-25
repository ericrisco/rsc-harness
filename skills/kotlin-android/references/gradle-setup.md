# Gradle setup: version catalog, build scripts, KSP, common fixes

Targets the 2026 floors from SKILL.md. **Verify the AGP ↔ KGP ↔ compileSdk matrix against
current docs before locking** — a mismatch fails the build with a confusing message.

## Version catalog — `gradle/libs.versions.toml`

```toml
[versions]
agp = "9.2.0"                 # >= 9.2 required when using Compose (compileSdk 37)
kotlin = "2.2.20"             # K2 default & Stable
ksp = "2.2.20-2.0.0"          # KSP version trails the Kotlin version
composeBom = "2026.05.01"     # -> Compose 1.11.2
navigation = "2.8.0"          # type-safe @Serializable routes
hilt = "2.52"
room = "2.7.0"
retrofit = "2.11.0"
kotlinxSerialization = "1.7.3"
lifecycle = "2.8.7"           # lifecycle-runtime-compose -> collectAsStateWithLifecycle

[libraries]
compose-bom = { module = "androidx.compose:compose-bom", version.ref = "composeBom" }
compose-ui = { module = "androidx.compose.ui:ui" }
compose-material3 = { module = "androidx.compose.material3:material3" }
lifecycle-runtime-compose = { module = "androidx.lifecycle:lifecycle-runtime-compose", version.ref = "lifecycle" }
lifecycle-viewmodel-compose = { module = "androidx.lifecycle:lifecycle-viewmodel-compose", version.ref = "lifecycle" }
navigation-compose = { module = "androidx.navigation:navigation-compose", version.ref = "navigation" }
hilt-android = { module = "com.google.dagger:hilt-android", version.ref = "hilt" }
hilt-compiler = { module = "com.google.dagger:hilt-compiler", version.ref = "hilt" }
hilt-navigation-compose = { module = "androidx.hilt:hilt-navigation-compose", version = "1.2.0" }
room-runtime = { module = "androidx.room:room-runtime", version.ref = "room" }
room-ktx = { module = "androidx.room:room-ktx", version.ref = "room" }
room-compiler = { module = "androidx.room:room-compiler", version.ref = "room" }
retrofit = { module = "com.squareup.retrofit2:retrofit", version.ref = "retrofit" }
retrofit-kotlinx-serialization = { module = "com.squareup.retrofit2:converter-kotlinx-serialization", version.ref = "retrofit" }
kotlinx-serialization-json = { module = "org.jetbrains.kotlinx:kotlinx-serialization-json", version.ref = "kotlinxSerialization" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }   # the Compose compiler plugin
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
```

The Compose compiler is now the **Kotlin Compose plugin** (`org.jetbrains.kotlin.plugin.compose`),
not the old `composeOptions { kotlinCompilerExtensionVersion = ... }` block. The plugin version
tracks the Kotlin version automatically.

## Root `build.gradle.kts`

```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
}
```

## Module `app/build.gradle.kts`

```kotlin
plugins {
    alias(libs.plugins.android.application)          // AGP 9 compiles Kotlin itself: no org.jetbrains.kotlin.android
    alias(libs.plugins.kotlin.compose)        // Compose compiler — replaces composeOptions
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)                    // KSP, never kapt, for Room + Hilt
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.example.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.example.app"
        minSdk = 24
        targetSdk = 37
    }
    buildFeatures { compose = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin { jvmToolchain(17) }
}

dependencies {
    implementation(platform(libs.compose.bom))   // BOM pins every Compose artifact
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.navigation.compose)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)                       // KSP, not kapt
    implementation(libs.hilt.navigation.compose)

    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)                       // KSP, not kapt

    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.kotlinx.serialization.json)
}
```

## Common build errors and the fix

| Symptom | Cause | Fix |
|---|---|---|
| `This version of the Compose Compiler requires Kotlin ...` | Old `composeOptions` block pinning a compiler version | Delete `composeOptions`; apply `kotlin.plugin.compose`; the version follows Kotlin. |
| `The Android Gradle plugin supports only Kotlin Gradle plugin version X+` | AGP ↔ KGP mismatch | Align both per the AGP/Kotlin compatibility matrix; bump the lower one. |
| `Schema export directory is not provided` / slow incremental builds | Using `kapt` for Room/Hilt | Switch to KSP (`ksp(...)` + `id("com.google.devtools.ksp")`). |
| `Serializer for class 'X' is not found` | Missing serialization plugin or `@Serializable` | Apply `kotlin.plugin.serialization`; annotate the DTO/route. |
| `MyRepo cannot be provided without an @Inject constructor` | Hilt can't construct the type | Add `@Inject constructor(...)` to the concrete class, or `@Binds` the interface to its impl in an `@InstallIn` module. |
| `compileSdk 37` rejected | AGP below 9.2 | Bump AGP to ≥ 9.2.0. |
| Build runs on JDK 11/21 and fails | Wrong toolchain | Pin `jvmToolchain(17)` and `JavaVersion.VERSION_17`. |
