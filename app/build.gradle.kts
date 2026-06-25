plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.android.island"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.android.island"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // ⚠️ CRITICAL: Use compileOnly for LSPosed API. Do NOT use implementation!
    // compileOnly use karne se LSPosed runtime APIs APK ke andar include nahi hote,
    // kyunki ye APIs device host system provide karega runtime pe.
    compileOnly("de.robv.android.xposed:api:82")

    // Android baseline libraries
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
}

repositories {
    google()
    mavenCentral()
    // Xposed APIs are hosted on Maven Central. No custom repositories are needed anymore.
}