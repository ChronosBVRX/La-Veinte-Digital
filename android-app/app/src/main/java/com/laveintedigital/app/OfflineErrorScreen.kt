package com.laveintedigital.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.laveintedigital.app.ui.theme.BrandBlue
import com.laveintedigital.app.ui.theme.BrandNavy

/**
 * Pantalla de error offline (modo respaldo nativo).
 *
 * Evolución compatible de la pantalla histórica: mantiene el botón "Reintentar" con el mismo
 * comportamiento y agrega, cuando [onOpenSavedDocuments] no es null, el acceso a los documentos
 * guardados en el dispositivo (pantalla Compose 100% nativa, sin WebView ni red).
 */
@Composable
fun OfflineErrorScreen(
    title: String = "Sin conexión a Internet",
    message: String = "Algunas funciones de La Veinte Digital necesitan conexión.\nTus documentos guardados siguen disponibles.",
    onRetry: () -> Unit,
    onOpenSavedDocuments: (() -> Unit)? = null,
    isBackOnline: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.horizontalGradient(colors = listOf(BrandNavy, BrandBlue))
            ),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp).fillMaxWidth(),
        ) {
            Image(
                painter = painterResource(R.drawable.splash_logo),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(80.dp),
            )
            Spacer(Modifier.height(24.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.65f),
                textAlign = TextAlign.Center,
            )
            if (isBackOnline) {
                Spacer(Modifier.height(12.dp))
                Text(
                    text = "Conexión recuperada",
                    style = MaterialTheme.typography.labelLarge,
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.18f), RoundedCornerShape(999.dp))
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                )
            }
            Spacer(Modifier.height(32.dp))
            if (onOpenSavedDocuments != null) {
                Button(
                    onClick = onOpenSavedDocuments,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = BrandNavy,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Ver mis documentos", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                }
                Spacer(Modifier.height(12.dp))
                OutlinedButton(
                    onClick = onRetry,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Intentar de nuevo", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                }
            } else {
                Button(
                    onClick = onRetry,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = BrandNavy,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Reintentar", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                }
            }
        }
    }
}
