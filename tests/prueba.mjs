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

const app = new Function(`${js}\n; return { processData, allData, campo, texto, sedeDe, esDomicilio, codigoDe, lineasDe, direccionCompleta, svgDeCodigo, formatoDeCodigo, COL, LINEA, filterPedidos, ordenarFilas, fechaOrden, numeroOrden, valorOrdenPedido, lineasOrdenadas };`)();

nodo('agruparSedes').checked = false;
nodo('ordenPedidos').value = 'cliente';
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
comprueba('EAN de 13 cifras como EAN-13', app.formatoDeCodigo('8410128000400'), 'EAN13');
comprueba('código no numérico como CODE128', app.formatoDeCodigo('ABC-123'), 'CODE128');
comprueba('el hueco del código escapa comillas', app.svgDeCodigo('a"b').includes('data-codigo="a&quot;b"'), true);

// ─── Lo que acaba en pantalla ───
const fichas = nodo('pedidosContent').innerHTML;
comprueba('contador', nodo('pedidosCount').textContent, 'Mostrando 3 pedido(s) con 5 producto(s)');
comprueba('la ficha trae el código', fichas.includes('PEDIDO: ORD-2026-000001'), true);
comprueba('la ficha trae el cliente', fichas.includes('Marta Ribas Soler'), true);
comprueba('la ficha trae la sede', fichas.includes('🏢 Barcelona Sants'), true);
comprueba('la ficha marca el domicilio', fichas.includes('🏠 Envío a Domicilio'), true);
comprueba('sin «undefined» por la página', fichas.includes('undefined'), false);
comprueba('el resumen dibuja códigos de barras', nodo('resumenContent').innerHTML.includes('data-codigo='), true);
comprueba('sin «[object Object]»', fichas.includes('[object Object]'), false);

const resumen = nodo('resumenContent').innerHTML;
comprueba('el resumen agrupa por sede', resumen.includes('Barcelona Sants'), true);
comprueba('el resumen suma las unidades', resumen.includes('Cuña de Queso Curado'), true);
comprueba('el resumen no trae «undefined»', resumen.includes('undefined'), false);

// ─── Ordenación de hojas y productos ───
const ordenCodigos = () => [...nodo('pedidosContent').innerHTML.matchAll(/PEDIDO: ([^<\s]+)/g)].map(m => m[1]);
comprueba('cliente ascendente por defecto', ordenCodigos(), ['ORD-2026-000003', 'ORD-2026-000002', 'ORD-2026-000001']);
nodo('direccionPedidos').value = 'desc';
app.filterPedidos();
comprueba('cliente descendente', ordenCodigos(), ['ORD-2026-000001', 'ORD-2026-000002', 'ORD-2026-000003']);
nodo('ordenPedidos').value = 'original';
app.filterPedidos();
comprueba('recupera orden Excel incluso en descendente', ordenCodigos(), ['ORD-2026-000001', 'ORD-2026-000002', 'ORD-2026-000003']);
nodo('ordenPedidos').value = 'productos';
app.filterPedidos();
comprueba('número productos descendente', ordenCodigos()[0], 'ORD-2026-000001');
nodo('sedeFilter').value = 'Barcelona Sants';
nodo('ordenPedidos').value = 'cliente';
nodo('direccionPedidos').value = 'asc';
app.filterPedidos();
comprueba('orden mantiene filtro sede', ordenCodigos(), ['ORD-2026-000003', 'ORD-2026-000001']);
nodo('usuarioFilter').value = 'Marta Ribas Soler';
app.filterPedidos();
comprueba('orden mantiene filtro usuario', ordenCodigos(), ['ORD-2026-000001']);
nodo('usuarioFilter').value = 'No existe';
app.filterPedidos();
comprueba('orden con selección vacía', ordenCodigos(), []);
comprueba('orden no altera datos originales', app.allData.pedidos.map(app.codigoDe), ['ORD-2026-000001', 'ORD-2026-000002', 'ORD-2026-000003']);
comprueba('orden natural español', app.ordenarFilas(['Producto 10', 'Producto 2', 'Árbol', 'barco'], x => x, 'asc'), ['Árbol', 'barco', 'Producto 2', 'Producto 10']);
comprueba('vacíos al final ascendente', app.ordenarFilas(['', 10, 0, 2], x => x, 'asc'), [0, 2, 10, '']);
comprueba('vacíos al final descendente', app.ordenarFilas(['', 10, 0, 2], x => x, 'desc'), [10, 2, 0, '']);
comprueba('empates conservan orden', app.ordenarFilas(['ana', 'ANA'], x => x, 'asc'), ['ana', 'ANA']);
comprueba('fecha española cronológica', app.fechaOrden('31/01/2026') < app.fechaOrden('02/02/2026'), true);
comprueba('serial Excel', app.fechaOrden(25569), 0);
comprueba('fecha inválida', app.fechaOrden('31/02/2026'), '');
comprueba('fecha ISO', app.fechaOrden('2026-01-31'), app.fechaOrden('31/01/2026'));
comprueba('puntos con coma decimal', app.numeroOrden('1.234,50'), 1234.5);
comprueba('puntos ausentes', app.numeroOrden(''), '');
comprueba('total unidades', app.valorOrdenPedido(primero, 'unidades'), 7);
for (const clave of Object.keys(app.COL)) {
    comprueba('campo ordenable ' + clave, app.valorOrdenPedido(primero, clave) !== undefined, true);
}
nodo('ordenProductos').value = 'cantidad';
nodo('direccionProductos').value = 'desc';
comprueba('líneas por cantidad numérica', app.lineasOrdenadas(primero).map(l => app.campo(l, app.LINEA.cantidad)), [4, 2, 1]);
nodo('ordenProductos').value = 'nombre';
nodo('direccionProductos').value = 'asc';
comprueba('líneas por nombre', app.texto(app.lineasOrdenadas(primero)[0], app.LINEA.nombre), 'Chorizo Vela Ibérico');
for (const clave of ['sku', 'barcode']) {
    nodo('ordenProductos').value = clave;
    comprueba('líneas sin ' + clave + ' al final', app.texto(app.lineasOrdenadas(primero).at(-1), app.LINEA[clave]), '');
}
nodo('ordenProductos').value = 'original';
comprueba('restaurar líneas Excel', app.lineasOrdenadas(primero).map(l => app.campo(l, app.LINEA.cantidad)), [2, 4, 1]);
nodo('usuarioFilter').value = '';
nodo('sedeFilter').value = '';
nodo('ordenProductos').value = 'cantidad';
nodo('direccionProductos').value = 'desc';
app.filterPedidos();
const htmlOrdenado = nodo('pedidosContent').innerHTML;
comprueba('pantalla e impresión usan líneas ordenadas', htmlOrdenado.indexOf('Chorizo Vela Ibérico') < htmlOrdenado.indexOf('Producto sin código de barras'), true);
comprueba('selector accesible y conectado', pagina.includes('for="ordenPedidos"') && pagina.includes('id="ordenPedidos" disabled onchange="filterPedidos()"'), true);

// Todas las sedes: agrupación principal por sede y secundaria por cliente.
nodo('agruparSedes').checked = true;
nodo('ordenPedidos').value = 'codigo';
nodo('direccionPedidos').value = 'asc';
app.filterPedidos();
comprueba('por defecto sede y luego cliente', ordenCodigos(), ['ORD-2026-000003', 'ORD-2026-000001', 'ORD-2026-000002']);
comprueba('check deshabilita criterio alternativo', nodo('ordenPedidos').disabled, true);
nodo('direccionPedidos').value = 'desc';
app.filterPedidos();
comprueba('sede y cliente descendentes', ordenCodigos(), ['ORD-2026-000002', 'ORD-2026-000001', 'ORD-2026-000003']);
nodo('direccionPedidos').value = 'asc';
nodo('sedeFilter').value = 'Barcelona Sants';
app.filterPedidos();
comprueba('una sede mantiene orden por cliente', ordenCodigos(), ['ORD-2026-000003', 'ORD-2026-000001']);
nodo('sedeFilter').value = '';
nodo('agruparSedes').checked = false;
nodo('ordenPedidos').value = 'sede';
app.filterPedidos();
comprueba('orden por sede desempata por cliente', ordenCodigos(), ['ORD-2026-000003', 'ORD-2026-000001', 'ORD-2026-000002']);
comprueba('check marcado por defecto en HTML', pagina.includes('id="agruparSedes" type="checkbox" checked'), true);
comprueba('desmarcar habilita selector', nodo('ordenPedidos').disabled, false);
nodo('ordenPedidos').value = 'codigo';
app.filterPedidos();
comprueba('desmarcado aplica criterio alternativo', ordenCodigos(), ['ORD-2026-000001', 'ORD-2026-000002', 'ORD-2026-000003']);
nodo('agruparSedes').checked = true;
app.filterPedidos();
comprueba('volver a marcar agrupa sedes', ordenCodigos(), ['ORD-2026-000003', 'ORD-2026-000001', 'ORD-2026-000002']);
nodo('agruparSedes').checked = false;
app.filterPedidos();
comprueba('conserva criterio al desmarcar', nodo('ordenPedidos').value, 'codigo');

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} comprobaciones fallidas.`);
process.exit(fallos ? 1 : 0);
