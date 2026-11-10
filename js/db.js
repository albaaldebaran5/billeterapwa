/**
 * Módulo de Persistencia Local con IndexedDB Nativo
 * Proyecto: PWA "Mi Billetera Lite"
 * Base de datos: BilleteraLiteDB (v1)
 */

const DB_NAME = 'BilleteraLiteDB';
const DB_VERSION = 1;
const STORE_NAME = 'gastos';

let dbInstance = null;

/**
 * Inicializa la conexión a IndexedDB y crea el Object Store e índices si no existen.
 * @returns {Promise<IDBDatabase>}
 */
function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (!('indexedDB' in window)) {
      reject(new Error('Este navegador no soporta IndexedDB.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('idx_timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error('Error al abrir IndexedDB.'));
    };
  });
}

/**
 * Guarda un nuevo gasto en IndexedDB con timestamp y fecha legible.
 * @param {string} concepto - Descripción del gasto (ej. "Café")
 * @param {number|string} monto - Cantidad numérica del gasto (ej. 45.50)
 * @param {string} categoria - Categoría ("Comida", "Transporte", "Servicios", "Ocio", "Otros")
 * @returns {Promise<Object>} El objeto del gasto guardado incluyendo su id generado
 */
async function agregarGasto(concepto, monto, categoria) {
  const db = await initDB();
  const ahora = new Date();
  const montoNumerico = Number(parseFloat(monto).toFixed(2));

  if (!concepto || !concepto.trim()) {
    throw new Error('El concepto es obligatorio.');
  }
  if (Number.isNaN(montoNumerico) || montoNumerico <= 0) {
    throw new Error('El monto debe ser un número mayor a cero.');
  }

  const fechaLegible = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(ahora);

  const nuevoGasto = {
    concepto: concepto.trim(),
    monto: montoNumerico,
    categoria: categoria || 'Otros',
    timestamp: ahora.getTime(),
    fecha: fechaLegible
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(nuevoGasto);

    request.onsuccess = (event) => {
      resolve({
        ...nuevoGasto,
        id: event.target.result
      });
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error('No se pudo guardar el gasto.'));
    };
  });
}

/**
 * Obtiene todos los gastos registrados, ordenados del más reciente al más antiguo.
 * @returns {Promise<Array<Object>>}
 */
async function obtenerGastos() {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('idx_timestamp');
    const gastos = [];

    // Cursor en dirección 'prev' para ordenar del más reciente al más antiguo
    const request = index.openCursor(null, 'prev');

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        gastos.push(cursor.value);
        cursor.continue();
      } else {
        resolve(gastos);
      }
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error('No se pudieron obtener los gastos.'));
    };
  });
}

/**
 * Elimina un gasto por su ID primario.
 * @param {number} id - Identificador del gasto a eliminar
 * @returns {Promise<void>}
 */
async function eliminarGasto(id) {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(Number(id));

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = (event) => {
      reject(event.target.error || new Error('No se pudo eliminar el gasto.'));
    };
  });
}

// Exponer funciones tanto en el objeto global como globalmente para fácil acceso
window.initDB = initDB;
window.agregarGasto = agregarGasto;
window.obtenerGastos = obtenerGastos;
window.eliminarGasto = eliminarGasto;
window.BilleteraDB = {
  initDB,
  agregarGasto,
  obtenerGastos,
  eliminarGasto
};

