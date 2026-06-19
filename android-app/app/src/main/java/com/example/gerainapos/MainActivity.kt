package com.example.gerainapos

import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.example.gerainapos.theme.GerainaPOSTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    enableEdgeToEdge()
    setContent {
      GerainaPOSTheme {
        var webViewRef by remember { mutableStateOf<WebView?>(null) }

        BackHandler(enabled = webViewRef?.canGoBack() == true) {
          webViewRef?.goBack()
        }

        AndroidView(
          modifier = Modifier.fillMaxSize(),
          factory = { context ->
            WebView(context).apply {
              layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
              )
              webViewClient = WebViewClient()
              settings.javaScriptEnabled = true
              settings.domStorageEnabled = true
              settings.databaseEnabled = true
              settings.useWideViewPort = true
              settings.loadWithOverviewMode = true
              loadUrl("https://dagangos-features.preview.emergentagent.com/")
              webViewRef = this
            }
          },
          update = {
            webViewRef = it
          }
        )
      }
    }
  }
}
