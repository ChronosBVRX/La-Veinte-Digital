package com.laveintedigital.app.nav

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.laveintedigital.app.external.ExternalBrowserScreen
import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.ui.ManageImssCredentialsScreen
import com.laveintedigital.app.imss.ui.ImssPortalScreen
import com.laveintedigital.app.imss.ui.OfficialPayslipsScreen
import com.laveintedigital.app.imss.ui.PayslipHistoryScreen
import com.laveintedigital.app.imss.ui.PayslipViewerScreen
import com.laveintedigital.app.imss.ui.SaveImssCredentialsScreen
import com.laveintedigital.app.imss.ui.TuPerfilBiometricScreen
import com.laveintedigital.app.internal.InternalWebScreen
import com.laveintedigital.app.routing.NavigationTarget

@Composable
fun AppNavHost(
    navController: NavHostController,
    internalUrl: String,
    onCustomTab: (String) -> Unit,
    onIntent: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var savedPayload by remember { mutableStateOf<com.laveintedigital.app.imss.credentials.ImssCredentialPayload?>(null) }

    NavHost(
        navController = navController,
        startDestination = NavRoute.Internal.route,
        modifier = modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
    ) {
        composable(NavRoute.Internal.route) {
            InternalWebScreen(
                initialUrl = internalUrl,
                onExternalNavigation = { target ->
                    when (target) {
                        is NavigationTarget.Internal -> {}
                        is NavigationTarget.External -> navController.navigate(NavRoute.External.create(target.url))
                        is NavigationTarget.CustomTab -> onCustomTab(target.url)
                        is NavigationTarget.Intent -> onIntent(target.url)
                        is NavigationTarget.Block -> {}
                    }
                },
                onCustomTab = onCustomTab,
                onOpenOfficialPayslips = { navController.navigate(NavRoute.OfficialPayslips.route) },
            )
        }

        composable(NavRoute.External.route,
            arguments = listOf(navArgument("url") { type = NavType.StringType }),
        ) { backStackEntry ->
            val url = backStackEntry.arguments?.getString("url") ?: return@composable
            ExternalBrowserScreen(
                initialUrl = url,
                onClose = { navController.popBackStack() },
                onReturnToLaVeinte = { navController.popBackStack(NavRoute.Internal.route, inclusive = false) },
            )
        }

        composable(NavRoute.OfficialPayslips.route) {
            OfficialPayslipsScreen(
                onOpenPortal = { portal -> navController.navigate(NavRoute.ImssPortal.create(portal.id, false)) },
                onOpenBiometrics = { navController.navigate(NavRoute.TuPerfilBiometrics.route) },
                onSaveCredentials = { portal -> navController.navigate(NavRoute.ImssSaveCreds.create(portal.id)) },
                onManageCredentials = { navController.navigate(NavRoute.ManageImssCreds.route) },
                onOpenHistory = { navController.navigate(NavRoute.PayslipHistory.route) },
                onBack = { navController.popBackStack() },
            )
        }

        composable(NavRoute.TuPerfilBiometrics.route) {
            TuPerfilBiometricScreen(
                onBack = { navController.popBackStack() },
                onClose = { navController.popBackStack(NavRoute.Internal.route, inclusive = false) },
                onViewPdf = { path -> navController.navigate(NavRoute.PayslipViewer.create(path)) },
            )
        }

        composable(NavRoute.ImssSaveCreds.route,
            arguments = listOf(navArgument("portalId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val portalId = backStackEntry.arguments?.getString("portalId") ?: return@composable
            val portal = ImssPortal.entries.find { it.id == portalId } ?: return@composable
            SaveImssCredentialsScreen(
                portal = portal,
                onSaved = { payload ->
                    savedPayload = payload
                    navController.popBackStack()
                    navController.navigate(NavRoute.ImssPortal.create(portal.id, true))
                },
                onSkip = {
                    navController.popBackStack()
                    navController.navigate(NavRoute.ImssPortal.create(portal.id, false))
                },
                onBack = { navController.popBackStack() },
            )
        }

        composable(NavRoute.ImssPortal.route,
            arguments = listOf(
                navArgument("portalId") { type = NavType.StringType },
                navArgument("autoLogin") { type = NavType.BoolType; defaultValue = false },
            ),
        ) { backStackEntry ->
            val portalId = backStackEntry.arguments?.getString("portalId") ?: return@composable
            val autoLogin = backStackEntry.arguments?.getBoolean("autoLogin") ?: false
            val portal = ImssPortal.entries.find { it.id == portalId } ?: return@composable
            ImssPortalScreen(
                portal = portal,
                autoLogin = autoLogin,
                onBack = { navController.popBackStack() },
                onClose = { navController.popBackStack(NavRoute.Internal.route, inclusive = false) },
                onOpenHistory = { navController.navigate(NavRoute.PayslipHistory.route) },
            )
        }

        composable(NavRoute.PayslipHistory.route) {
            PayslipHistoryScreen(
                onViewPdf = { path -> navController.navigate(NavRoute.PayslipViewer.create(path)) },
                onBack = { navController.popBackStack() },
            )
        }

        composable(NavRoute.PayslipViewer.route,
            arguments = listOf(navArgument("filePath") { type = NavType.StringType }),
        ) { backStackEntry ->
            val filePath = backStackEntry.arguments?.getString("filePath") ?: return@composable
            PayslipViewerScreen(
                filePath = filePath,
                onBack = { navController.popBackStack() },
            )
        }
        composable(NavRoute.ManageImssCreds.route) {
            ManageImssCredentialsScreen(onBack = { navController.popBackStack() })
        }
    }
}
