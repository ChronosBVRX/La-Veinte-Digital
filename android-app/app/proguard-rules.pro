# Keep all app classes
-keep class com.laveintedigital.app.** { *; }

# Keep WebView JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Compose runtime (needed for R8)
-dontwarn androidx.compose.**
-keep class androidx.compose.** { *; }

# Keep Activity result contracts & launchers
-keep class androidx.activity.result.** { *; }

# Keep lifecycle (needed for Compose + ViewModel)
-keep class androidx.lifecycle.** { *; }

# Kotlin coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.coroutines.** {
    volatile <fields>;
}

# Navigation Compose
-keep class androidx.navigation.** { *; }

# WebKit & Custom Tabs
-keep class androidx.webkit.** { *; }
-keep class androidx.browser.** { *; }

# Keep R classes
-keepclassmembers class **.R$* {
    public static <fields>;
}
