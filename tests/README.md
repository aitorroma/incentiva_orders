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
