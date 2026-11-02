# FNAF 1 - port web

Recreación de Five Nights at Freddy's 1 en HTML5, sin dependencias ni paso de compilación.
Proyecto de fans, sin afiliación oficial. Five Nights at Freddy's © Scott Cawthon.

## Ejecutar en local

Necesita un servidor HTTP, porque abrir `index.html` directamente bloquea los módulos ES:

    python -m http.server 8123

Después abre http://localhost:8123. Para los tests: `npm test`.

## Publicar

Es un sitio estático. Sube solo esto a GitHub Pages, Netlify, Cloudflare Pages o itch.io:

    index.html   src/   assets/

`Assets Fnaf/` (148 MB) son los originales y no hacen falta en producción; `assets/` pesa 10 MB.

## Estructura

| Ruta | Función |
| --- | --- |
| `src/config.js` | Todos los valores de jugabilidad, con su fuente anotada |
| `src/sim.js` | Reglas puras, sin DOM; las cubre `tests/sim.test.mjs` |
| `src/views.js` | Qué frame muestra cada cámara según el estado |
| `src/main.js` | Escenas, render e input |
| `src/layout.js` | Coordenadas de pantalla |
| `src/warp.js` | Shader del efecto panorámico |
| `tools/build_assets.py` | Corta los sheets y genera `assets/` y `src/manifest.js` |

Para cambiar qué archivo usa un sonido, edita `SOUNDS` en `tools/build_assets.py` y vuelve a
ejecutar `python tools/build_assets.py` (requiere Pillow y NumPy).

## Pruebas rápidas

`?debug=1&night=3&ai=20,20,20,20&speed=4` entra directo a una noche con estado visible,
niveles de IA en orden Freddy, Bonnie, Chica, Foxy, y tiempo acelerado.
