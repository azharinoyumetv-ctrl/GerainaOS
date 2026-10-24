# AndroidX WebKit handles the origin-scoped native message listener.
# ML Kit discovers these classes and their zero-argument constructors from
# manifest metadata. R8 full mode otherwise removes the reflective constructors.
-keep class com.google.mlkit.** implements com.google.firebase.components.ComponentRegistrar {
    public <init>();
}
