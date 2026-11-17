# KanbanFlow — Tablero Ágil Kanban con Métricas WIP

> **Enlaces del proyecto**

**Link:** `https://hunabbohorquez.github.io/KanbanFlow/`

**Repositorio en GitHub:** `https://github.com/HunabBohorquez/KanbanFlow`

> 📝 **Nota:** este proyecto tiene los **mismos archivos** que el repositorio de GitLab
> (`index.html`, `styles.css`, `app.js`, `README.md`). Solo cambia la plataforma de alojamiento.

---

## Descripción del Proyecto

**KanbanFlow** es una aplicación web de gestión ágil desarrollada íntegramente con **HTML5, CSS3 y JavaScript ES6+ Vanilla** (cero dependencias externas). Permite visualizar y controlar el flujo de trabajo a través de cuatro etapas (**Pendiente**, **En Curso**, **Revisión** y **Hecho**), aplicando límites de trabajo en progreso (**WIP**) y calculando métricas reales de eficiencia de entrega en tiempo real.

### Características Principales
- **Tablero Interactivo de 4 Columnas:** Soporte nativo para arrastrar y soltar (*HTML5 Drag and Drop API*) con resaltado visual de zona destino, además de botones rápidos de desplazamiento (`←` / `→`) en cada tarjeta.
- **Gestión CRUD Completa:** Creación, edición y eliminación de tarjetas con título, descripción breve, categoría (`Frontend`, `Backend`, `Algoritmos`, `Documentación`), prioridad (`Alta`, `Media`, `Baja`) y puntos de esfuerzo (`1, 2, 3, 5, 8`).
- **Trazabilidad Automática de Tiempos:** Registro automático de `createdAt` al crear la tarjeta, `startedAt` al ingresar a *En Curso* y `completedAt` al finalizar en *Hecho*.
- **Panel de Métricas y Gráfico Nativo:** Cálculo en vivo de porcentaje de progreso por puntos, *Lead Time* promedio, *Cycle Time* promedio y gráfico de barras apiladas dibujado en `<canvas>` con soporte HiDPI.
- **Persistencia y Exportación:** Guardado automático en `localStorage`, filtros combinados por texto/categoría/prioridad, carga de Sprint Demo y exportación estructurada a JSON.

---

## Límites WIP y Métricas de Flujo

### Límites WIP (Work In Progress)
Limitar el trabajo en progreso evita la multitarea improductiva y expone cuellos de botella en el flujo:
- **En Curso:** límite configurable en cabecera (por defecto **3** tarjetas).
- **Revisión:** límite configurable en cabecera (por defecto **2** tarjetas).
- Cuando el número de tarjetas en una columna supera su umbral configurado, KanbanFlow activa inmediatamente el estado visual **`⚠️ Límite WIP excedido`** tanto en la columna afectada como en el banner global superior.

### Lead Time vs. Cycle Time
KanbanFlow calcula ambos indicadores exclusivamente sobre las tarjetas completadas en la columna **Hecho**:

$$\text{Lead Time} = \frac{1}{N} \sum_{i=1}^{N} (\text{completedAt}_i - \text{createdAt}_i)$$

$$\text{Cycle Time} = \frac{1}{N} \sum_{i=1}^{N} (\text{completedAt}_i - \text{startedAt}_i)$$

- **Lead Time:** Mide el tiempo total que percibe el cliente o *stakeholder* desde que se registra la solicitud hasta que se entrega terminada.
- **Cycle Time:** Mide la velocidad real de ejecución del equipo desde que se comienza a trabajar activamente en la tarjeta (*En Curso*) hasta que se completa (*Hecho*).

---

## Instrucciones de Ejecución

1. Guarda los 4 archivos (`index.html`, `styles.css`, `app.js`, `README.md`) dentro de una misma carpeta local.
2. Haz doble clic sobre `index.html` para abrirlo directamente en cualquier navegador moderno (Chrome, Firefox, Edge o Safari), o sírvelo mediante cualquier servidor estático local (por ejemplo, `npx serve .` o Live Server).

---

## Pruebas Verificables (Sprint Demo)

Al pulsar el botón **"Cargar Sprint Demo"**, se cargan **10 tarjetas** con marcas de tiempo precalculadas que permiten verificar matemáticamente el funcionamiento del sistema:

| Métrica / Estado | Valor Esperado Exacto | Detalle del Cálculo |
| :--- | :--- | :--- |
| **Total de Tarjetas** | `10 tarjetas` | 1 en Pendiente, 4 en En Curso, 2 en Revisión, 3 en Hecho |
| **Progreso del Sprint** | `33%` (`13 / 40 pts`) | Completados: $3 + 5 + 5 = 13\text{ pts}$ de $40\text{ pts}$ totales |
| **Lead Time Promedio** | `1.50 d (36.0 h)` | Tarjetas en Hecho: $(48\text{ h} + 36\text{ h} + 24\text{ h}) / 3 = 36.0\text{ h}$ |
| **Cycle Time Promedio** | `18.0 h` | Tarjetas en Hecho: $(24\text{ h} + 18\text{ h} + 12\text{ h}) / 3 = 18.0\text{ h}$ |
| **Alerta WIP "En Curso"** | **Activa (`4/3`)** | 4 tarjetas presentes frente al límite WIP por defecto de `3` |
| **Alerta WIP "Revisión"** | **Inactiva (`2/2`)** | 2 tarjetas presentes dentro del límite WIP por defecto de `2` |
| **WIP Activo Total** | `6` | Suma de tarjetas en *En Curso* ($4$) + *Revisión* ($2$) |

### Pasos de Verificación Rápida
1. **Validar Alerta WIP:** Tras cargar el Sprint Demo, verifica que el banner superior y la columna **En Curso** muestren `⚠️ Límite WIP excedido (4/3)`. Mueve una tarjeta de **En Curso** a **Hecho** con el botón `→` (o arrastrándola): la alerta de *En Curso* desaparecerá (`3/3`), pero se activará en **Revisión** (`3/2`).
2. **Validar Actualización de Métricas:** Al mover una tarjeta adicional a **Hecho**, observa cómo el porcentaje de progreso aumenta de inmediato y los promedios de *Lead Time* y *Cycle Time* se recalculan dinámicamente.
3. **Validar Persistencia:** Recarga la página (`F5`) y confirma que tanto las tarjetas modificadas como los límites WIP personalizados se mantienen intactos mediante `localStorage`.
