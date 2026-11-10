/**
 * Lógica Principal de Interfaz, Eventos DOM y Service Worker
 * Proyecto: PWA "Mi Billetera Lite"
 */

(function () {
  'use strict';

  // Referencias del DOM
  const expenseForm = document.getElementById('expense-form');
  const inputConcepto = document.getElementById('concepto');
  const inputMonto = document.getElementById('monto');
  const selectCategoria = document.getElementById('categoria');
  const formFeedback = document.getElementById('form-feedback');
  const totalAmountEl = document.getElementById('total-amount');
  const expenseListEl = document.getElementById('expense-list');
  const emptyStateEl = document.getElementById('empty-state');
  const statusBadgeEl = document.getElementById('status-badge');
  const statusTextEl = document.getElementById('status-text');

  // Formateador de moneda (ej. $45.50 / $150.00)
  const currencyFormatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  /**
   * Formatea un número a moneda ($0.00)
   * @param {number} value
   * @returns {string}
   */
  function formatearMoneda(value) {
    const numero = Number(value) || 0;
    return currencyFormatter.format(numero);
  }

  /**
   * Escapa caracteres HTML para prevenir inyección XSS al renderizar conceptos
   * @param {string} texto
   * @returns {string}
   */
  function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  /**
   * Muestra u oculta un mensaje de validación en el formulario
   * @param {string} mensaje
   */
  function mostrarErrorFormulario(mensaje) {
    if (!mensaje) {
      formFeedback.hidden = true;
      formFeedback.textContent = '';
      return;
    }
    formFeedback.textContent = mensaje;
    formFeedback.hidden = false;
  }

  /**
   * Actualiza el indicador visual de estado de red (En línea / Modo Offline)
   */
  function actualizarEstadoConexion() {
    const enLinea = navigator.onLine;
    if (enLinea) {
      statusBadgeEl.classList.remove('offline');
      statusBadgeEl.classList.add('online');
      statusTextEl.textContent = 'En línea';
    } else {
      statusBadgeEl.classList.remove('online');
      statusBadgeEl.classList.add('offline');
      statusTextEl.textContent = 'Modo Offline';
    }
  }

  /**
   * Carga todos los gastos desde IndexedDB, calcula el total y actualiza el DOM
   */
  async function renderizarGastos() {
    try {
      const gastos = await window.BilleteraDB.obtenerGastos();

      // 1. Calcular suma total
      const sumaTotal = gastos.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);
      totalAmountEl.textContent = formatearMoneda(sumaTotal);

      // 2. Mostrar estado vacío o lista de gastos
      const cantidad = gastos.length;
      if (cantidad === 0) {
        emptyStateEl.hidden = false;
        expenseListEl.hidden = true;
        expenseListEl.innerHTML = '';
        return;
      }

      emptyStateEl.hidden = true;
      expenseListEl.hidden = false;

      expenseListEl.innerHTML = gastos
        .map((gasto) => {
          const conceptoSeguro = escaparHTML(gasto.concepto);
          const categoriaSegura = escaparHTML(gasto.categoria);
          const fechaSegura = escaparHTML(gasto.fecha || '');
          const montoFormateado = formatearMoneda(gasto.monto);

          return `
            <li class="expense-item" data-id="${gasto.id}">
              <div class="expense-info">
                <p class="expense-concept">${conceptoSeguro}</p>
                <div class="expense-meta">
                  <span class="category-badge">${categoriaSegura}</span>
                  <span class="expense-date">${fechaSegura}</span>
                </div>
              </div>
              <div class="expense-right">
                <span class="expense-amount">${montoFormateado}</span>
                <button
                  type="button"
                  class="btn-delete"
                  data-delete-id="${gasto.id}"
                  aria-label="Eliminar gasto ${conceptoSeguro}"
                  title="Eliminar gasto"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                    <path d="M10 11v6"></path>
                    <path d="M14 11v6"></path>
                  </svg>
                </button>
              </div>
            </li>
          `;
        })
        .join('');
    } catch (error) {
      console.error('Error al cargar los gastos:', error);
    }
  }

  /**
   * Maneja el envío del formulario para registrar un nuevo gasto
   * @param {SubmitEvent} event
   */
  async function manejarEnvioFormulario(event) {
    event.preventDefault();
    mostrarErrorFormulario('');

    const concepto = inputConcepto.value.trim();
    const montoRaw = inputMonto.value.trim();
    const categoria = selectCategoria.value;
    const monto = parseFloat(montoRaw);

    if (!concepto) {
      mostrarErrorFormulario('Por favor ingresa el concepto del gasto.');
      inputConcepto.focus();
      return;
    }

    if (!montoRaw || Number.isNaN(monto) || monto <= 0) {
      mostrarErrorFormulario('Ingresa un monto válido mayor a $0.00.');
      inputMonto.focus();
      return;
    }

    try {
      await window.BilleteraDB.agregarGasto(concepto, monto, categoria);
      expenseForm.reset();
      selectCategoria.value = 'Comida';
      inputConcepto.focus();
      await renderizarGastos();
    } catch (error) {
      console.error('Error al guardar el gasto:', error);
      mostrarErrorFormulario(error.message || 'Ocurrió un error al guardar el gasto.');
    }
  }

  /**
   * Maneja la eliminación de un gasto mediante delegación de eventos
   * @param {MouseEvent} event
   */
  async function manejarClickLista(event) {
    const deleteBtn = event.target.closest('[data-delete-id]');
    if (!deleteBtn) return;

    const id = Number(deleteBtn.getAttribute('data-delete-id'));
    if (!id) return;

    try {
      await window.BilleteraDB.eliminarGasto(id);
      await renderizarGastos();
    } catch (error) {
      console.error('Error al eliminar gasto:', error);
    }
  }

  /**
   * Registra el Service Worker para soporte Offline del App Shell
   */
  function registrarServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js')
          .then((registration) => {
            console.log('Service Worker registrado con éxito. Scope:', registration.scope);
          })
          .catch((error) => {
            console.error('Error al registrar el Service Worker:', error);
          });
      });
    }
  }

  /**
   * Inicialización general de la aplicación
   */
  async function inicializarApp() {
    actualizarEstadoConexion();
    window.ononline = actualizarEstadoConexion;
    window.onoffline = actualizarEstadoConexion;
    window.addEventListener('online', actualizarEstadoConexion);
    window.addEventListener('offline', actualizarEstadoConexion);

    expenseForm.addEventListener('submit', manejarEnvioFormulario);
    expenseListEl.addEventListener('click', manejarClickLista);

    registrarServiceWorker();

    try {
      await window.BilleteraDB.initDB();
      await renderizarGastos();
    } catch (error) {
      console.error('Error al inicializar la base de datos:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', inicializarApp);
})();
