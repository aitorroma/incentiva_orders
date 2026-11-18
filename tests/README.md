# Pruebas

```bash
node tests/prueba.mjs
```

Extrae el `<script>` de `index.html` y lo ejecuta con un DOM mínimo y los datos
de `datos-de-ejemplo.json`, que tienen la misma forma que devuelve
`XLSX.utils.sheet_to_json` al leer el Excel de Ƶenksbox. No necesita navegador
ni dependencias: sólo Node.

Si cambian los nombres de las hojas o de las columnas del Excel, se tocan las
constantes `HOJA_PEDIDOS`, `HOJA_LINEAS`, `COL` y `LINEA` de `index.html`, y
estas pruebas avisan de lo que se haya quedado atrás.

## Estilos de producción

La página sirve `assets/tailwind.css` ya compilado, sin Tailwind CDN en el navegador.
Tras cambiar clases en `index.html` o el tema en `tailwind.config.cjs`:

```bash
npm ci
npm run build:css
npm test
```

Subir también el CSS generado. GitHub Pages no ejecuta npm.
Los EAN/UPC con control incorrecto conservan su número y muestran un aviso;
no se corrigen automáticamente ni se convierten a otro formato.
