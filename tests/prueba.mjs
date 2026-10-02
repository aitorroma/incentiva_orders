/**
 * Comprueba que la página lee el Excel que exporta Ƶenksbox.
 *
 * No hace falta navegador: se extrae el <script> de index.html y se ejecuta
 * con un DOM de juguete y los datos de `datos-de-ejemplo.json`, que tienen la
 * misma forma que devuelve XLSX.utils.sheet_to_json.
 *
 *   node tests/prueba.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const pagina = fs.readFileSync(path.join(aqui, '..', 'index.html'), 'utf-8');
const datos = JSON.parse(fs.readFileSync(path.join(aqui, 'datos-de-ejemplo.json'), 'utf-8'));

// El <script> de la aplicación es el más largo de la página
const js = [...pagina.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .reduce((a, b) => (a.length > b.length ? a : b));

// ─── DOM de juguete: sólo lo que la página toca ───
const nodos = new Map();
const nodo = (id) => {
    if (!nodos.has(id)) {
        nodos.set(id, {
            id, innerHTML: '', textContent: '', value: '',
            classList: { add() {}, remove() {}, contains: () => false },
            querySelectorAll: () => [], appendChild() {}, addEventListener() {},
        });
    }
    return nodos.get(id);
};
globalThis.document = { getElementById: nodo, querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, createElement: () => nodo('tmp') };
globalThis.window = { print() {}, open: () => ({ document: { write() {}, close() {} }, onload: null }) };
globalThis.JsBarcode = () => {};
globalThis.XLSX = {};
globalThis.alert = (m) => { throw new Error('alert inesperado: ' + m); };
globalThis.setTimeout = (fn) => fn();

const app = new Function(`${js}\n; return { processData, allData, campo, texto, sedeDe, esDomicilio, codigoDe, lineasDe, direccionCompleta, idDeBarcode, COL, LINEA };`)();

app.allData.pedidos = datos.pedidos;
app.allData.lineas = datos.lineas;
app.processData();

let fallos = 0;
const comprueba = (titulo, real, esperado) => {
    const ok = JSON.stringify(real) === JSON.stringify(esperado);
    if (!ok) {
        fallos++;
        console.log(`MAL  ${titulo}\n      esperado: ${JSON.stringify(esperado)}\n      real:     ${JSON.stringify(real)}`);
    } else {
        console.log(`OK   ${titulo}`);
    }
};

// ─── Las columnas del Excel ───
const primero = app.allData.pedidos[0];
comprueba('código del pedido', app.codigoDe(primero), 'ORD-2026-000001');
comprueba('cliente', primero.CLIENTE_FORMATTED, 'Marta Ribas Soler');
comprueba('DNI', app.texto(primero, app.COL.dni), '00000001R');
comprueba('dirección con provincia y país', app.direccionCompleta(primero), 'Carrer Exemple 1 · Barcelona · España');

// Una columna que falta no debe dar «undefined»
comprueba('columna ausente devuelve cadena vacía', app.texto(app.allData.pedidos[2], app.COL.dni), '');

// Tildes, mayúsculas y espacios de más en los encabezados
comprueba('encabezado sin tilde', app.texto({ 'CODIGO POSTAL': '08030' }, app.COL.cp), '08030');
comprueba('encabezado con espacios', app.texto({ ' Cliente ': 'Ana' }, app.COL.cliente), 'Ana');

// ─── Sedes y envíos ───
comprueba('sede de la columna Sede', app.sedeDe(primero), 'Barcelona Sants');
comprueba('envío a domicilio', app.esDomicilio(app.allData.pedidos[1]), true);
comprueba('sede de un envío a domicilio', app.sedeDe(app.allData.pedidos[1]), 'Envío a domicilio');
comprueba('sedes de la campaña', app.allData.sedes, ['Barcelona Sants', 'Envío a domicilio']);
comprueba('dos personas en la misma sede', app.allData.usuariosPorSede['Barcelona Sants'].length, 2);

// ─── Líneas de pedido ───
comprueba('líneas del primer pedido', app.lineasDe(primero).length, 3);
comprueba('las de otro pedido no se cuelan', app.lineasDe(app.allData.pedidos[1]).length, 1);
comprueba('cantidad de una línea', Number(app.campo(app.lineasDe(primero)[1], app.LINEA.cantidad)), 4);
comprueba('un producto sin código de barras no rompe', app.texto(app.lineasDe(primero)[0], app.LINEA.barcode), '');
comprueba('id de barcode sin caracteres raros', app.idDeBarcode('ORD/2026 1', 0), 'barcode-ORD20261-0');

// ─── Lo que acaba en pantalla ───
const fichas = nodo('pedidosContent').innerHTML;
comprueba('contador', nodo('pedidosCount').textContent, 'Mostrando 3 pedido(s) con 5 producto(s)');
comprueba('la ficha trae el código', fichas.includes('PEDIDO: ORD-2026-000001'), true);
comprueba('la ficha trae el cliente', fichas.includes('Marta Ribas Soler'), true);
comprueba('la ficha trae la sede', fichas.includes('🏢 Barcelona Sants'), true);
comprueba('la ficha marca el domicilio', fichas.includes('🏠 Envío a Domicilio'), true);
comprueba('sin «undefined» por la página', fichas.includes('undefined'), false);
comprueba('sin «[object Object]»', fichas.includes('[object Object]'), false);

const resumen = nodo('resumenContent').innerHTML;
comprueba('el resumen agrupa por sede', resumen.includes('Barcelona Sants'), true);
comprueba('el resumen suma las unidades', resumen.includes('Cuña de Queso Curado'), true);
comprueba('el resumen no trae «undefined»', resumen.includes('undefined'), false);

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} comprobaciones fallidas.`);
process.exit(fallos ? 1 : 0);
