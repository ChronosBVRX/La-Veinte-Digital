# Sistema de Componentes UI — La Veinte Digital

## Principios

Todos los componentes usan CSS variables (`--primary`, `--border`, `--muted`, etc.) definidas en `globals.css`. No se usan clases Tailwind. El estilado es con `style={{}}` inline.

## Catálogo de componentes

### Button
Variantes: `primary`, `secondary`, `outline`, `ghost`, `danger`  
Tamaños: `sm`, `md`, `lg`  
Props extra: `loading`, `fullWidth`, `leadingIcon`, `trailingIcon`  

```tsx
<Button variant="primary" size="md">Guardar</Button>
<Button variant="outline" leadingIcon={<DownloadSimple />}>Descargar</Button>
<Button variant="danger" size="sm" loading>Eliminando...</Button>
```

Cuándo usar: acciones dentro de formularios, confirmaciones, submits.  
Cuándo NO: navegación (usar `ActionLink`), solo icono (usar `IconButton`).

### ActionLink
Variantes y tamaños idénticos a Button. Envuelve `Link` de next/link.

```tsx
<ActionLink href="/tarjeton" variant="primary">Importar tarjetón</ActionLink>
```

### IconButton
Botón solo icono con `aria-label`. Variantes: `ghost`, `outline`, `danger`.

```tsx
<IconButton label="Cerrar" variant="ghost"><X /></IconButton>
```

### Card
Variantes: `default`, `subtle`, `interactive`, `highlighted`.  
Subcomponentes: `Card.Header`, `Card.Title`, `Card.Description`, `Card.Content`, `Card.Footer`.

```tsx
<Card variant="default">
  <Card.Header>
    <Card.Title>Título</Card.Title>
    <Card.Description>Subtítulo</Card.Description>
  </Card.Header>
  <Card.Content>Contenido</Card.Content>
  <Card.Footer>Acciones</Card.Footer>
</Card>
```

API legacy: `<Card padding="1.25rem">...</Card>` sigue funcionando.

### SectionCard
Para secciones de formulario/página (NO dashboard). Incluye título, descripción, icono y acción.

```tsx
<SectionCard title="Datos laborales" description="..." icon={<IdentificationCard />}>
  ...formulario...
</SectionCard>
```

### PageHeader
Encabezado estándar de página. Props: `title`, `description?`, `eyebrow?`, `icon?`, `actions?`, `backHref?`.

```tsx
<PageHeader title="Mi Tarjetón" description="Importa tu recibo IMSS" backHref="/" />
```

### FormField
Wrapper de campo con label, hint y error.

```tsx
<FormField label="Nombre" htmlFor="name" error={error} hint="Tu nombre completo" required>
  <Input id="name" />
</FormField>
```

### Input / Textarea / Select
Extienden nativamente con soporte para `invalid`, `leadingIcon`, `trailingElement`.

```tsx
<Input invalid={!!error} leadingIcon={<Search />} placeholder="Buscar..." />
<Textarea rows={4} />
<Select><option>Opción</option></Select>
```

### Checkbox / Radio / Switch
Controles de formulario con indicadores visuales personalizados.

```tsx
<Checkbox label="Acepto los términos" />
<Radio name="color" value="rojo" label="Rojo" />
<Switch label="Notificaciones" defaultChecked />
```

### Badge
Variantes: `neutral`, `success`, `warning`, `error`, `info`, `work`, `tools`, `assistance`, `community`.

```tsx
<Badge variant="success">Completado</Badge>
<Badge variant="work">Nómina</Badge>
```

### Alert
Mensajes de estado con icono y acción opcional.

```tsx
<Alert variant="success" title="Guardado" action={<Button variant="ghost">Ver</Button>}>
  Los cambios se guardaron correctamente.
</Alert>
```

### EmptyState
Estado vacío con icono, título, descripción y acciones.

```tsx
<EmptyState
  icon={<Receipt />}
  title="Sin tarjetones"
  description="Importa tu primer recibo IMSS"
  action={<ActionLink href="/tarjeton">Importar</ActionLink>}
/>
```

### Skeleton
Variantes: `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonList`.

```tsx
<Skeleton width="200px" height="1rem" />
<SkeletonText lines={3} />
<SkeletonCard />
<SkeletonList rows={5} />
```

### Spinner
Indicador de carga con texto opcional.

```tsx
<Spinner size="md" text="Cargando..." />
```

### Modal
Diálogo modal accesible con focus trap, Escape, scroll lock.

```tsx
<Modal open={open} onClose={() => setOpen(false)} title="Título" footer={<Button>Guardar</Button>}>
  Contenido
</Modal>
```

### ConfirmDialog
Confirmación construida sobre Modal. Soporta modo destructivo y loading.

```tsx
<ConfirmDialog
  open={open}
  title="Eliminar"
  description="Esta acción no se puede deshacer"
  confirmLabel="Eliminar"
  destructive
  onConfirm={handleDelete}
  onCancel={() => setOpen(false)}
/>
```

### BottomSheet
Panel inferior genérico con mismas garantías de accesibilidad que Modal.

```tsx
<BottomSheet open={open} onClose={() => setOpen(false)} title="Opciones" height="medium">
  Contenido
</BottomSheet>
```

### Toast
Sistema de notificaciones toast. Usar mediante `useToast()`.

```tsx
const { toast } = useToast()
toast("Guardado correctamente", "success")
toast("Error al guardar", "error")
```

Duraciones: success 4s, info/warning 5s, error 7s.
