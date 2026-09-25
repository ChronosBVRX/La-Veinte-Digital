/**
 * Escala canónica centralizada de capas z-index para La Veinte Digital.
 * Evita valores dispersos arbitrarios y garantiza jerarquías coherentes
 * entre navegación, sidebars, modales, overlays y portales a pantalla completa.
 */

export const Z_INDEX = {
  /** Contenido base y elevaciones relativas */
  content: 1,
  /** Barras de navegación móvil fija y barra inferior de valor */
  navigationBar: 30,
  /** Barra lateral de escritorio (DesktopSidebar) */
  sidebar: 40,
  /** Cajón móvil de navegación (Drawer lateral) */
  sidebarDrawer: 50,
  /** Cabecera principal fija (AppHeader) */
  header: 60,
  /** Menús desplegables y popovers emergentes */
  dropdown: 70,
  /** Paneles laterales administrativos (RepresentationSheet) */
  sheet: 500,
  /** Diálogos modales y hojas inferiores (Modal, BottomSheet, ResponsiveDialog) */
  dialog: 1000,
  /** Notificaciones emergentes y alertas flotantes (Toast) */
  toast: 9990,
  /** Flujos completos a pantalla completa (FullscreenPortal) */
  fullscreen: 99999,
} as const

export type ZIndexLevel = keyof typeof Z_INDEX
