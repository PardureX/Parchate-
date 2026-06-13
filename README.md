# Parchate™ — Reproductor MP3

## Archivos
```
parchate/
├── index.html      ← estructura de la app
├── style.css       ← estilos y temas
├── app.js          ← toda la lógica
├── manifest.json   ← para instalar en móvil
├── README.md       ← este archivo
└── icons/
    ├── icon-192.png   ← agregar manualmente (ver abajo)
    └── icon-512.png   ← agregar manualmente
```

---

## Cómo usarlo

1. Abre `index.html` en el navegador (Chrome o Edge recomendado)
2. Ve a la pestaña **Lista** y toca para cargar tus mp3
3. Ajusta el volumen y ecualizador en la pestaña **Ecualizador**

---

## Cómo instalarlo en el celular (PWA)

1. Abre el archivo en Chrome móvil (puedes usar un servidor local o subir a Netlify)
2. Toca el menú de Chrome → "Agregar a pantalla de inicio"
3. La app aparece como ícono en el home, sin barra del navegador

> **Nota:** Para que funcione como PWA necesitas servirlo desde un servidor
> (no abrir el archivo directo como `file://`). Opciones fáciles:
> - **VS Code + Live Server** (extensión gratuita)
> - **Netlify Drop** — arrastra la carpeta a netlify.com/drop y listo
> - **Python:** `python -m http.server 8080` en la carpeta del proyecto

---

## Íconos (agregar manualmente)

Crea o descarga dos imágenes PNG con el logo de Parchate:
- `icons/icon-192.png` — 192×192 px
- `icons/icon-512.png` — 512×512 px

Puedes usar Canva, GIMP o cualquier editor para generarlos.

---

## Características incluidas

- ✅ Reproductor con play/pause, anterior, siguiente
- ✅ Barra de progreso con seek
- ✅ Control de volumen
- ✅ Shuffle y repeat (none / all / one)
- ✅ **Amplificador** hasta 4x (Web Audio API)
- ✅ **Ecualizador** de 3 bandas: graves, medios, agudos
- ✅ Presets: Plano, Bajos+, Vocal, Parlante, Audífonos
- ✅ Carátula del álbum (desde metadata ID3 del mp3)
- ✅ Foto de fondo personalizada
- ✅ 6 colores de acento personalizables
- ✅ Modo oscuro / claro
- ✅ Configuración guardada automáticamente (localStorage)
- ✅ Atajos de teclado: Espacio (play/pause), ← → (pistas)
- ✅ Manifest PWA para instalar en móvil

---

## Metadata ID3 (carátula automática)

Para leer la carátula y artista automáticamente desde el archivo mp3,
agrega esta librería antes de `app.js` en el `index.html`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js"></script>
<script src="app.js"></script>
```

Si no la agregas, igual funciona todo — solo no lee la carátula automáticamente.

---

## Próximas mejoras (Fase 2)

- [ ] Service Worker para modo offline
- [ ] Visualizador de audio (barras animadas)
- [ ] Listas de reproducción guardadas
- [ ] Favoritos
- [ ] Soporte drag & drop de canciones (ya incluido básico)
