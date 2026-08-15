package com.laveintedigital.app.intents

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent
import com.laveintedigital.app.ui.theme.Primary

object IntentLauncher {

    /**
     * Open [url] via Android Intent (tel:, mailto:, sms:, geo:, whatsapp:, intent:, etc.).
     * Shows a toast if no app can handle the scheme.
     */
    fun launchScheme(context: Context, url: String): Boolean {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return try {
            context.startActivity(intent)
            true
        } catch (t: ActivityNotFoundException) {
            Toast.makeText(
                context,
                "No hay una aplicación instalada para abrir este enlace.",
                Toast.LENGTH_SHORT,
            ).show()
            false
        } catch (t: SecurityException) {
            false
        }
    }

    /**
     * Open [url] in a Custom Tab bound to our brand color.
     */
    fun launchCustomTab(context: Context, url: String): Boolean {
        val intent = CustomTabsIntent.Builder()
            .setToolbarColor(Primary.value.toInt())
            .setShowTitle(true)
            .setUrlBarHidingEnabled(false)
            .build()
        intent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            intent.launchUrl(context, Uri.parse(url))
            true
        } catch (t: ActivityNotFoundException) {
            try {
                val fallback = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallback)
            } catch (_: Throwable) {
                Toast.makeText(
                    context,
                    "No hay un navegador instalado en este dispositivo.",
                    Toast.LENGTH_LONG,
                ).show()
            }
            false
        }
    }
}
