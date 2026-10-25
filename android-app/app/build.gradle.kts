import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.kotlin.serialization)
}

val signingProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.example.gerainapos"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.dagangos.geraina"
        minSdk = 34
        ndk { abiFilters += listOf("arm64-v8a", "x86_64") }
        targetSdk = 36
        versionCode = providers.gradleProperty("gerainaVersionCode").orElse("9").get().toInt()
        versionName = providers.gradleProperty("gerainaVersionName").orElse("1.2.4").get()
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    signingConfigs {
        if (signingProperties.isNotEmpty()) {
            create("upload") {
                storeFile = rootProject.file(signingProperties.getProperty("storeFile"))
                storePassword = signingProperties.getProperty("storePassword")
                keyAlias = signingProperties.getProperty("keyAlias")
                keyPassword = signingProperties.getProperty("keyPassword")
            }
        }
    }
    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            manifestPlaceholders["appLabel"] = "Geraina POS Dev"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            manifestPlaceholders["appLabel"] = "Geraina POS"
            signingConfig = signingConfigs.findByName("upload")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/frontend-assets").get().asFile)
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
}

val bundleFrontend by tasks.registering(Exec::class) {
    inputs.dir(rootProject.file("../frontend/src"))
    inputs.dir(rootProject.file("../frontend/public"))
    inputs.file(rootProject.file("../frontend/package.json"))
    inputs.file(rootProject.file("scripts/bundle-frontend.cjs"))
    outputs.dir(layout.buildDirectory.dir("generated/frontend-assets"))
    commandLine("node", rootProject.file("scripts/bundle-frontend.cjs").absolutePath)
}
tasks.named("preBuild").configure { dependsOn(bundleFrontend) }

kotlin { jvmToolchain(17) }

dependencies {
    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.camera:camera-camera2:1.6.2")
    implementation("androidx.camera:camera-lifecycle:1.6.2")
    implementation("androidx.camera:camera-view:1.6.2")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    debugImplementation(libs.androidx.compose.ui.tooling)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.espresso.core)
    implementation(libs.androidx.navigation3.ui)
    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.lifecycle.viewmodel.navigation3)
}

// A missing upload key must never silently produce an unsigned Play release.
tasks.matching { it.name == "validateSigningRelease" || it.name == "packageReleaseBundle" }.configureEach {
    val uploadSigningConfigured = signingProperties.isNotEmpty()
    doFirst {
        check(uploadSigningConfigured) {
            "Release signing is missing. Run scripts/Prepare-UploadKey.ps1 first; see README.md."
        }
    }
}
