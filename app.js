/**
 * KanbanFlow - Tablero Ágil Kanban con Límites WIP y Métricas de Flujo
 * Arquitectura modular en Vanilla JavaScript (ES6+)
 */

const COLUMNS = ["Pendiente", "En Curso", "Revisión", "Hecho"];
const CATEGORIES = ["Frontend", "Backend", "Algoritmos", "Documentación"];
const CATEGORY_COLORS = {
  Frontend: "#38bdf8",
  Backend: "#a855f7",
  Algoritmos: "#f59e0b",
  Documentación: "#10b981",
};

const HOUR_MS = 3600 * 1000;

/**
 * 1. FlowMetrics
 * Calcula métricas ágiles (Progreso %, Lead Time, Cycle Time) y renderiza
 * el gráfico de barras apiladas en <canvas> nativo.
 */
class FlowMetrics {
  static formatDuration(ms) {
    if (ms === null || ms === undefined || Number.isNaN(ms) || ms < 0) {
      return "—";
    }
    const totalHours = ms / HOUR_MS;
    if (totalHours < 24) {
      return `${totalHours.toFixed(1)} h`;
    }
    const days = totalHours / 24;
    return `${days.toFixed(2)} d (${totalHours.toFixed(1)} h)`;
  }

  static calculate(tasks, wipLimits) {
    const totalPoints = tasks.reduce((sum, t) => sum + Number(t.points || 0), 0);
    const completedTasks = tasks.filter((t) => t.column === "Hecho");
    const completedPoints = completedTasks.reduce(
      (sum, t) => sum + Number(t.points || 0),
      0
    );

    const progressPct =
      totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    // Lead Time: createdAt -> completedAt para tareas en "Hecho"
    const leadTimes = completedTasks
      .filter((t) => t.createdAt && t.completedAt)
      .map((t) => Math.max(0, t.completedAt - t.createdAt));

    const avgLeadTimeMs =
      leadTimes.length > 0
        ? leadTimes.reduce((acc, v) => acc + v, 0) / leadTimes.length
        : null;

    // Cycle Time: startedAt -> completedAt para tareas en "Hecho"
    const cycleTimes = completedTasks
      .filter((t) => t.startedAt && t.completedAt)
      .map((t) => Math.max(0, t.completedAt - t.startedAt));

    const avgCycleTimeMs =
      cycleTimes.length > 0
        ? cycleTimes.reduce((acc, v) => acc + v, 0) / cycleTimes.length
        : null;

    // Conteo por columna y evaluación de límites WIP
    const countsByColumn = {};
    const pointsByColumn = {};
    const matrixByColumnCategory = {};

    COLUMNS.forEach((col) => {
      countsByColumn[col] = 0;
      pointsByColumn[col] = 0;
      matrixByColumnCategory[col] = {
        Frontend: 0,
        Backend: 0,
        Algoritmos: 0,
        Documentación: 0,
      };
    });

    tasks.forEach((task) => {
      if (countsByColumn[task.column] !== undefined) {
        countsByColumn[task.column] += 1;
        pointsByColumn[task.column] += Number(task.points || 0);
        if (matrixByColumnCategory[task.column][task.category] !== undefined) {
          matrixByColumnCategory[task.column][task.category] += 1;
        }
      }
    });

    const wipViolations = [];
    Object.entries(wipLimits).forEach(([col, limit]) => {
      const current = countsByColumn[col] || 0;
      if (current > limit) {
        wipViolations.push({
          column: col,
          current,
          limit,
        });
      }
    });

    const activeWipCount =
      (countsByColumn["En Curso"] || 0) + (countsByColumn["Revisión"] || 0);

    return {
      totalTasks: tasks.length,
      totalPoints,
      completedPoints,
      progressPct,
      avgLeadTimeMs,
      avgCycleTimeMs,
      countsByColumn,
      pointsByColumn,
      matrixByColumnCategory,
      wipViolations,
      activeWipCount,
    };
  }

  static renderChart(canvas, matrixByColumnCategory) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || 640));
    const height = Math.max(160, Math.floor(rect.height || 185));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padLeft = 36;
    const padRight = 18;
    const padTop = 16;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Calcular máximo valor en Y
    const columnTotals = COLUMNS.map((col) =>
      CATEGORIES.reduce(
        (acc, cat) => acc + (matrixByColumnCategory[col]?.[cat] || 0),
        0
      )
    );
    const maxVal = Math.max(4, ...columnTotals);

    // Líneas horizontales de referencia
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const gridSteps = Math.min(maxVal, 4);
    for (let i = 0; i <= gridSteps; i++) {
      const val = Math.round((maxVal / gridSteps) * i);
      const y = padTop + chartH - (val / maxVal) * chartH;

      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillText(String(val), padLeft - 8, y);
    }

    // Dibujar barras apiladas por columna
    const slotWidth = chartW / COLUMNS.length;
    const barWidth = Math.min(56, slotWidth * 0.48);

    COLUMNS.forEach((col, colIdx) => {
      const centerX = padLeft + slotWidth * colIdx + slotWidth / 2;
      const barX = centerX - barWidth / 2;
      let currentY = padTop + chartH;

      CATEGORIES.forEach((cat) => {
        const count = matrixByColumnCategory[col]?.[cat] || 0;
        if (count > 0) {
          const segHeight = (count / maxVal) * chartH;
          currentY -= segHeight;

          ctx.fillStyle = CATEGORY_COLORS[cat];
          ctx.fillRect(barX, currentY, barWidth, segHeight);

          // Etiqueta numérica interna si hay espacio suficiente
          if (segHeight >= 15) {
            ctx.fillStyle = "#0f172a";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(count), centerX, currentY + segHeight / 2);
          }
        }
      });

      // Total encima de la barra
      const total = columnTotals[colIdx];
      if (total > 0) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(total), centerX, currentY - 4);
      }

      // Nombre de la columna en el eje X
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "600 11.5px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(col, centerX, padTop + chartH + 8);
    });

    ctx.restore();
  }
}

/**
 * 2. BoardStore
 * Administra el estado central, reglas de negocio para marcas de tiempo,
 * límites WIP, datos de demostración y persistencia en localStorage.
 */
class BoardStore {
  constructor(storageKey = "kanbanflow_state_v1") {
    this.storageKey = storageKey;
    this.listeners = [];
    this.state = this.loadFromStorage() || this.createInitialState();
  }

  createInitialState() {
    return {
      tasks: this.buildDemoTasks(),
      wipLimits: {
        "En Curso": 3,
        Revisión: 2,
      },
      filters: {
        search: "",
        category: "ALL",
        priority: "ALL",
      },
    };
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.saveToStorage();
    this.listeners.forEach((fn) => fn(this.state));
  }

  saveToStorage() {
    try {
      const payload = {
        tasks: this.state.tasks,
        wipLimits: this.state.wipLimits,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (err) {
      console.error("Error al guardar en localStorage:", err);
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.tasks)) return null;
      return {
        tasks: parsed.tasks,
        wipLimits: {
          "En Curso": Number(parsed.wipLimits?.["En Curso"]) || 3,
          Revisión: Number(parsed.wipLimits?.["Revisión"]) || 2,
        },
        filters: {
          search: "",
          category: "ALL",
          priority: "ALL",
        },
      };
    } catch (err) {
      console.warn("No se pudo recuperar el estado previo:", err);
      return null;
    }
  }

  /**
   * Genera 10 tarjetas precalculadas con timestamps deterministas para pruebas
   * verificables de Lead Time, Cycle Time y alerta de límite WIP en "En Curso".
   */
  buildDemoTasks() {
    const now = Date.now();
    return [
      // --- HECHO (3 tarjetas = 13 puntos) ---
      // Tarea 1: Lead = 48h, Cycle = 24h
      {
        id: "demo-1",
        title: "Configurar arquitectura base y tokens CSS",
        description: "Definir paleta oscura, variables CSS y layout grid responsivo.",
        category: "Frontend",
        priority: "Alta",
        points: 3,
        column: "Hecho",
        createdAt: now - 72 * HOUR_MS,
        startedAt: now - 48 * HOUR_MS,
        completedAt: now - 24 * HOUR_MS,
      },
      // Tarea 2: Lead = 36h, Cycle = 18h
      {
        id: "demo-2",
        title: "Diseñar esquema de persistencia JSON y localStorage",
        description: "Serialización segura de tarjetas, límites WIP y recuperación ante fallos.",
        category: "Backend",
        priority: "Alta",
        points: 5,
        column: "Hecho",
        createdAt: now - 60 * HOUR_MS,
        startedAt: now - 42 * HOUR_MS,
        completedAt: now - 24 * HOUR_MS,
      },
      // Tarea 3: Lead = 24h, Cycle = 12h
      {
        id: "demo-3",
        title: "Implementar cálculo de Lead Time y Cycle Time",
        description: "Fórmulas estadísticas para tiempos promedio desde creación e inicio.",
        category: "Algoritmos",
        priority: "Media",
        points: 5,
        column: "Hecho",
        createdAt: now - 36 * HOUR_MS,
        startedAt: now - 24 * HOUR_MS,
        completedAt: now - 12 * HOUR_MS,
      },

      // --- REVISIÓN (2 tarjetas = 8 puntos, igual al límite WIP=2) ---
      {
        id: "demo-4",
        title: "Renderizado de gráfico apilado en HTML5 Canvas",
        description: "Dibujar barras proporcionales por columna y etiqueta con soporte HiDPI.",
        category: "Frontend",
        priority: "Alta",
        points: 5,
        column: "Revisión",
        createdAt: now - 30 * HOUR_MS,
        startedAt: now - 16 * HOUR_MS,
        completedAt: null,
      },
      {
        id: "demo-5",
        title: "Guía de métricas Kanban y pruebas verificables",
        description: "Documentar flujo de trabajo, límites WIP y casos de verificación en README.",
        category: "Documentación",
        priority: "Baja",
        points: 3,
        column: "Revisión",
        createdAt: now - 20 * HOUR_MS,
        startedAt: now - 8 * HOUR_MS,
        completedAt: null,
      },

      // --- EN CURSO (4 tarjetas = 13 puntos -> EXCEDE WIP=3 por defecto) ---
      {
        id: "demo-6",
        title: "Controlador Drag & Drop nativo con feedback visual",
        description: "Gestionar eventos dragstart, dragover, drop y resaltado de zona destino.",
        category: "Frontend",
        priority: "Alta",
        points: 5,
        column: "En Curso",
        createdAt: now - 18 * HOUR_MS,
        startedAt: now - 10 * HOUR_MS,
        completedAt: null,
      },
      {
        id: "demo-7",
        title: "Algoritmo de filtrado multicriterio en tiempo real",
        description: "Combinar búsqueda textual insensible a mayúsculas con categoría y prioridad.",
        category: "Algoritmos",
        priority: "Media",
        points: 3,
        column: "En Curso",
        createdAt: now - 15 * HOUR_MS,
        startedAt: now - 7 * HOUR_MS,
        completedAt: null,
      },
      {
        id: "demo-8",
        title: "Validador de integridad para exportación JSON",
        description: "Incluir metadatos de resumen y timestamps ISO en el archivo descargable.",
        category: "Backend",
        priority: "Media",
        points: 3,
        column: "En Curso",
        createdAt: now - 14 * HOUR_MS,
        startedAt: now - 5 * HOUR_MS,
        completedAt: null,
      },
      {
        id: "demo-9",
        title: "Controles de accesibilidad y movimiento por teclado",
        description: "Botones rápidos <- y -> en tarjetas para desplazar sin ratón.",
        category: "Frontend",
        priority: "Baja",
        points: 2,
        column: "En Curso",
        createdAt: now - 10 * HOUR_MS,
        startedAt: now - 3 * HOUR_MS,
        completedAt: null,
      },

      // --- PENDIENTE (1 tarjeta = 6 puntos -> Total Sprint = 40 puntos) ---
      {
        id: "demo-10",
        title: "Optimización de heurística para detección de cuellos de botella",
        description: "Analizar permanencia promedio por columna para sugerir ajustes de WIP.",
        category: "Algoritmos",
        priority: "Media",
        points: 6,
        column: "Pendiente",
        createdAt: now - 6 * HOUR_MS,
        startedAt: null,
        completedAt: null,
      },
    ];
  }

  /**
   * Ajusta las marcas de tiempo automáticamente según la transición de columna.
   */
  applyTimestampRules(task, targetColumn) {
    const now = Date.now();
    const updated = { ...task, column: targetColumn };

    if (!updated.createdAt) {
      updated.createdAt = now;
    }

    if (targetColumn === "Pendiente") {
      updated.startedAt = null;
      updated.completedAt = null;
    } else if (targetColumn === "En Curso") {
      if (!updated.startedAt) {
        updated.startedAt = now;
      }
      updated.completedAt = null;
    } else if (targetColumn === "Revisión") {
      if (!updated.startedAt) {
        updated.startedAt = now;
      }
      updated.completedAt = null;
    } else if (targetColumn === "Hecho") {
      if (!updated.startedAt) {
        updated.startedAt = updated.createdAt;
      }
      if (!updated.completedAt) {
        updated.completedAt = now;
      }
    }

    return updated;
  }

  addTask(data) {
    const now = Date.now();
    const baseTask = {
      id: `task-${now}-${Math.random().toString(36).slice(2, 7)}`,
      title: data.title.trim(),
      description: (data.description || "").trim(),
      category: data.category,
      priority: data.priority,
      points: Number(data.points),
      column: data.column || "Pendiente",
      createdAt: now,
      startedAt: null,
      completedAt: null,
    };

    const readyTask = this.applyTimestampRules(baseTask, baseTask.column);
    this.state.tasks.unshift(readyTask);
    this.notify();
  }

  updateTask(id, data) {
    const index = this.state.tasks.findIndex((t) => t.id === id);
    if (index === -1) return;

    const current = this.state.tasks[index];
    const merged = {
      ...current,
      title: data.title.trim(),
      description: (data.description || "").trim(),
      category: data.category,
      priority: data.priority,
      points: Number(data.points),
    };

    const finalTask =
      data.column && data.column !== current.column
        ? this.applyTimestampRules(merged, data.column)
        : merged;

    this.state.tasks[index] = finalTask;
    this.notify();
  }

  moveTask(id, targetColumn) {
    if (!COLUMNS.includes(targetColumn)) return;
    const index = this.state.tasks.findIndex((t) => t.id === id);
    if (index === -1) return;

    const current = this.state.tasks[index];
    if (current.column === targetColumn) return;

    this.state.tasks[index] = this.applyTimestampRules(current, targetColumn);
    this.notify();
  }

  stepTask(id, direction) {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task) return;
    const currentIdx = COLUMNS.indexOf(task.column);
    const nextIdx = currentIdx + direction;
    if (nextIdx >= 0 && nextIdx < COLUMNS.length) {
      this.moveTask(id, COLUMNS[nextIdx]);
    }
  }

  deleteTask(id) {
    this.state.tasks = this.state.tasks.filter((t) => t.id !== id);
    this.notify();
  }

  setWipLimit(column, value) {
    const parsed = Math.max(1, Math.min(50, Number(value) || 1));
    this.state.wipLimits[column] = parsed;
    this.notify();
  }

  setFilters(partialFilters) {
    this.state.filters = {
      ...this.state.filters,
      ...partialFilters,
    };
    this.listeners.forEach((fn) => fn(this.state));
  }

  resetFilters() {
    this.setFilters({
      search: "",
      category: "ALL",
      priority: "ALL",
    });
  }

  loadDemoSprint() {
    this.state.tasks = this.buildDemoTasks();
    this.state.wipLimits = {
      "En Curso": 3,
      Revisión: 2,
    };
    this.state.filters = {
      search: "",
      category: "ALL",
      priority: "ALL",
    };
    this.notify();
  }

  clearBoard() {
    this.state.tasks = [];
    this.notify();
  }

  getFilteredTasks() {
    const { search, category, priority } = this.state.filters;
    const query = search.trim().toLowerCase();

    return this.state.tasks.filter((task) => {
      const matchesCat = category === "ALL" || task.category === category;
      const matchesPrio = priority === "ALL" || task.priority === priority;
      const matchesText =
        !query ||
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query));

      return matchesCat && matchesPrio && matchesText;
    });
  }

  exportToJson() {
    const metrics = FlowMetrics.calculate(
      this.state.tasks,
      this.state.wipLimits
    );
    const exportData = {
      exportedAt: new Date().toISOString(),
      application: "KanbanFlow",
      wipLimits: this.state.wipLimits,
      metricsSummary: {
        totalTasks: metrics.totalTasks,
        totalPoints: metrics.totalPoints,
        completedPoints: metrics.completedPoints,
        progressPercentage: metrics.progressPct,
        averageLeadTimeHours:
          metrics.avgLeadTimeMs !== null
            ? Number((metrics.avgLeadTimeMs / HOUR_MS).toFixed(2))
            : null,
        averageCycleTimeHours:
          metrics.avgCycleTimeMs !== null
            ? Number((metrics.avgCycleTimeMs / HOUR_MS).toFixed(2))
            : null,
      },
      tasks: this.state.tasks,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kanbanflow-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}

/**
 * 3. DragDropController
 * Encapsula la API HTML5 Drag and Drop con resaltado visual de zonas destino.
 */
class DragDropController {
  constructor(store) {
    this.store = store;
    this.draggedTaskId = null;
    this.initDropzones();
  }

  initDropzones() {
    const dropzones = document.querySelectorAll(".column__dropzone");

    dropzones.forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        zone.classList.add("drag-over");
      });

      zone.addEventListener("dragenter", (e) => {
        e.preventDefault();
        zone.classList.add("drag-over");
      });

      zone.addEventListener("dragleave", (e) => {
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove("drag-over");
        }
      });

      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("drag-over");
        const taskId =
          e.dataTransfer.getData("text/plain") || this.draggedTaskId;
        const targetColumn = zone.dataset.column;

        if (taskId && targetColumn) {
          this.store.moveTask(taskId, targetColumn);
        }
        this.draggedTaskId = null;
      });
    });
  }

  bindCardEvents(cardElement, taskId) {
    cardElement.setAttribute("draggable", "true");

    cardElement.addEventListener("dragstart", (e) => {
      this.draggedTaskId = taskId;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", taskId);
      requestAnimationFrame(() => {
        cardElement.classList.add("dragging");
      });
    });

    cardElement.addEventListener("dragend", () => {
      cardElement.classList.remove("dragging");
      this.draggedTaskId = null;
      document
        .querySelectorAll(".column__dropzone.drag-over")
        .forEach((z) => z.classList.remove("drag-over"));
    });
  }
}

/**
 * 4. BoardRenderer
 * Sincroniza el DOM (columnas, tarjetas, alertas WIP, panel de métricas, modal
 * y eventos de interfaz) con el estado de BoardStore.
 */
class BoardRenderer {
  constructor(store, dndController) {
    this.store = store;
    this.dnd = dndController;
    this.cacheDom();
    this.bindUIEvents();
    this.store.subscribe((state) => this.render(state));
    window.addEventListener("resize", () => {
      const metrics = FlowMetrics.calculate(
        this.store.state.tasks,
        this.store.state.wipLimits
      );
      FlowMetrics.renderChart(
        this.dom.flowChart,
        metrics.matrixByColumnCategory
      );
    });
    this.render(this.store.state);
  }

  cacheDom() {
    this.dom = {
      globalWipAlert: document.getElementById("global-wip-alert"),
      metricProgressPct: document.getElementById("metric-progress-pct"),
      metricProgressDetail: document.getElementById("metric-progress-detail"),
      metricProgressBar: document.getElementById("metric-progress-bar"),
      metricLeadTime: document.getElementById("metric-lead-time"),
      metricCycleTime: document.getElementById("metric-cycle-time"),
      metricTotalCards: document.getElementById("metric-total-cards"),
      metricWipSummary: document.getElementById("metric-wip-summary"),
      flowChart: document.getElementById("flow-chart"),

      filterSearch: document.getElementById("filter-search"),
      filterCategory: document.getElementById("filter-category"),
      filterPriority: document.getElementById("filter-priority"),
      btnResetFilters: document.getElementById("btn-reset-filters"),

      btnNewTask: document.getElementById("btn-new-task"),
      btnLoadDemo: document.getElementById("btn-load-demo"),
      btnExportJson: document.getElementById("btn-export-json"),
      btnClearBoard: document.getElementById("btn-clear-board"),

      modal: document.getElementById("task-modal"),
      modalTitle: document.getElementById("modal-title"),
      taskForm: document.getElementById("task-form"),
      taskId: document.getElementById("task-id"),
      taskTitle: document.getElementById("task-title"),
      taskDesc: document.getElementById("task-desc"),
      taskCategory: document.getElementById("task-category"),
      taskPriority: document.getElementById("task-priority"),
      taskPoints: document.getElementById("task-points"),
      taskColumn: document.getElementById("task-column"),
      timestampsPreview: document.getElementById("task-timestamps-preview"),
      btnCloseModal: document.getElementById("btn-close-modal"),
      btnCancelModal: document.getElementById("btn-cancel-modal"),
    };
  }

  bindUIEvents() {
    // Botones principales
    this.dom.btnNewTask.addEventListener("click", () => this.openModal());
    this.dom.btnLoadDemo.addEventListener("click", () => {
      this.store.loadDemoSprint();
      this.syncFilterInputs();
    });
    this.dom.btnExportJson.addEventListener("click", () =>
      this.store.exportToJson()
    );
    this.dom.btnClearBoard.addEventListener("click", () => {
      if (confirm("¿Seguro que deseas eliminar todas las tarjetas del tablero?")) {
        this.store.clearBoard();
      }
    });

    // Inputs WIP en cabeceras
    document.querySelectorAll("input[data-wip-col]").forEach((input) => {
      input.addEventListener("change", (e) => {
        const col = e.target.dataset.wipCol;
        this.store.setWipLimit(col, e.target.value);
      });
    });

    // Filtros
    this.dom.filterSearch.addEventListener("input", (e) => {
      this.store.setFilters({ search: e.target.value });
    });
    this.dom.filterCategory.addEventListener("change", (e) => {
      this.store.setFilters({ category: e.target.value });
    });
    this.dom.filterPriority.addEventListener("change", (e) => {
      this.store.setFilters({ priority: e.target.value });
    });
    this.dom.btnResetFilters.addEventListener("click", () => {
      this.store.resetFilters();
      this.syncFilterInputs();
    });

    // Modal CRUD
    this.dom.btnCloseModal.addEventListener("click", () =>
      this.dom.modal.close()
    );
    this.dom.btnCancelModal.addEventListener("click", () =>
      this.dom.modal.close()
    );

    this.dom.taskForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = this.dom.taskId.value;
      const payload = {
        title: this.dom.taskTitle.value,
        description: this.dom.taskDesc.value,
        category: this.dom.taskCategory.value,
        priority: this.dom.taskPriority.value,
        points: Number(this.dom.taskPoints.value),
        column: this.dom.taskColumn.value,
      };

      if (id) {
        this.store.updateTask(id, payload);
      } else {
        this.store.addTask(payload);
      }
      this.dom.modal.close();
    });
  }

  syncFilterInputs() {
    this.dom.filterSearch.value = this.store.state.filters.search;
    this.dom.filterCategory.value = this.store.state.filters.category;
    this.dom.filterPriority.value = this.store.state.filters.priority;
  }

  openModal(task = null) {
    if (task) {
      this.dom.modalTitle.textContent = "Editar Tarjeta";
      this.dom.taskId.value = task.id;
      this.dom.taskTitle.value = task.title;
      this.dom.taskDesc.value = task.description || "";
      this.dom.taskCategory.value = task.category;
      this.dom.taskPriority.value = task.priority;
      this.dom.taskPoints.value = String(task.points);
      this.dom.taskColumn.value = task.column;

      const fmt = (ts) =>
        ts ? new Date(ts).toLocaleString("es-ES") : "Pendiente";
      this.dom.timestampsPreview.innerHTML = `
        <span><strong>Creada:</strong> ${fmt(task.createdAt)}</span>
        <span><strong>Iniciada (En Curso):</strong> ${fmt(task.startedAt)}</span>
        <span><strong>Completada (Hecho):</strong> ${fmt(task.completedAt)}</span>
      `;
      this.dom.timestampsPreview.classList.remove("hidden");
    } else {
      this.dom.modalTitle.textContent = "Nueva Tarjeta";
      this.dom.taskForm.reset();
      this.dom.taskId.value = "";
      this.dom.taskPoints.value = "3";
      this.dom.taskColumn.value = "Pendiente";
      this.dom.timestampsPreview.classList.add("hidden");
    }

    this.dom.modal.showModal();
    this.dom.taskTitle.focus();
  }

  createCardElement(task) {
    const colIndex = COLUMNS.indexOf(task.column);
    const canMoveLeft = colIndex > 0;
    const canMoveRight = colIndex < COLUMNS.length - 1;

    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = task.id;

    // Indicador de tiempo relevante según estado
    let timeCaption = "";
    if (task.column === "Hecho" && task.createdAt && task.completedAt) {
      const leadH = ((task.completedAt - task.createdAt) / HOUR_MS).toFixed(1);
      const cycleH = task.startedAt
        ? ((task.completedAt - task.startedAt) / HOUR_MS).toFixed(1)
        : leadH;
      timeCaption = `Lead: ${leadH}h · Cycle: ${cycleH}h`;
    } else if (task.startedAt) {
      const elapsedH = Math.max(
        0.1,
        (Date.now() - task.startedAt) / HOUR_MS
      ).toFixed(1);
      timeCaption = `En flujo: ${elapsedH}h`;
    } else {
      timeCaption = "Sin iniciar";
    }

    card.innerHTML = `
      <div class="card__top">
        <span class="badge-category badge-category--${task.category}">${this.escapeHtml(
      task.category
    )}</span>
        <div class="card__actions">
          <button type="button" class="card-icon-btn btn-edit" title="Editar tarjeta" aria-label="Editar tarjeta">✎</button>
          <button type="button" class="card-icon-btn card-icon-btn--delete btn-delete" title="Eliminar tarjeta" aria-label="Eliminar tarjeta">✕</button>
        </div>
      </div>

      <h3 class="card__title">${this.escapeHtml(task.title)}</h3>
      ${
        task.description
          ? `<p class="card__desc">${this.escapeHtml(task.description)}</p>`
          : ""
      }

      <div class="card__meta">
        <div class="card__tags">
          <span class="priority-pill">
            <i class="priority-dot priority-dot--${task.priority}"></i>
            ${this.escapeHtml(task.priority)}
          </span>
          <span class="points-badge">${task.points} pts</span>
        </div>

        <div class="card__move-controls">
          <button type="button" class="btn-move btn-prev" ${
            canMoveLeft ? "" : "disabled"
          } title="Mover a columna anterior">&larr;</button>
          <button type="button" class="btn-move btn-next" ${
            canMoveRight ? "" : "disabled"
          } title="Mover a columna siguiente">&rarr;</button>
        </div>
      </div>

      <div class="card__time-info">${timeCaption}</div>
    `;

    // Eventos de botones internos
    card
      .querySelector(".btn-edit")
      .addEventListener("click", () => this.openModal(task));

    card.querySelector(".btn-delete").addEventListener("click", () => {
      this.store.deleteTask(task.id);
    });

    card.querySelector(".btn-prev").addEventListener("click", () => {
      this.store.stepTask(task.id, -1);
    });

    card.querySelector(".btn-next").addEventListener("click", () => {
      this.store.stepTask(task.id, 1);
    });

    this.dnd.bindCardEvents(card, task.id);
    return card;
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  render(state) {
    // 1. Calcular métricas globales sobre todas las tareas del sprint
    const metrics = FlowMetrics.calculate(state.tasks, state.wipLimits);
    const visibleTasks = this.store.getFilteredTasks();

    // 2. Actualizar tarjetas de métricas
    this.dom.metricProgressPct.textContent = `${metrics.progressPct}%`;
    this.dom.metricProgressDetail.textContent = `${metrics.completedPoints} / ${metrics.totalPoints} pts`;
    this.dom.metricProgressBar.style.width = `${metrics.progressPct}%`;

    this.dom.metricLeadTime.textContent = FlowMetrics.formatDuration(
      metrics.avgLeadTimeMs
    );
    this.dom.metricCycleTime.textContent = FlowMetrics.formatDuration(
      metrics.avgCycleTimeMs
    );

    this.dom.metricTotalCards.textContent = `${metrics.totalTasks} tarjetas`;
    this.dom.metricWipSummary.textContent = `WIP activo: ${metrics.activeWipCount} (En Curso + Revisión)`;

    // 3. Actualizar inputs y alertas WIP
    Object.entries(state.wipLimits).forEach(([col, limit]) => {
      const inputEl = document.getElementById(`wip-${col}`);
      if (inputEl && Number(inputEl.value) !== limit) {
        inputEl.value = limit;
      }

      const wrapperEl = document.getElementById(`column-wrapper-${col}`);
      const alertEl = document.getElementById(`wip-alert-${col}`);
      const count = metrics.countsByColumn[col] || 0;
      const exceeded = count > limit;

      if (wrapperEl) {
        wrapperEl.classList.toggle("wip-exceeded", exceeded);
      }
      if (alertEl) {
        alertEl.classList.toggle("hidden", !exceeded);
        if (exceeded) {
          alertEl.textContent = `⚠️ Límite WIP excedido (${count}/${limit})`;
        }
      }
    });

    if (metrics.wipViolations.length > 0) {
      const details = metrics.wipViolations
        .map((v) => `${v.column}: ${v.current} de ${v.limit} máx.`)
        .join(" | ");
      this.dom.globalWipAlert.textContent = `⚠️ Límite WIP excedido — ${details}. Prioriza terminar tareas antes de iniciar nuevas.`;
      this.dom.globalWipAlert.classList.remove("hidden");
    } else {
      this.dom.globalWipAlert.classList.add("hidden");
    }

    // 4. Renderizar columnas y tarjetas visibles
    COLUMNS.forEach((col) => {
      const dropzone = document.getElementById(`col-${col}`);
      const countBadge = document.getElementById(`count-${col}`);
      const pointsBadge = document.getElementById(`points-${col}`);

      if (countBadge) {
        countBadge.textContent = String(metrics.countsByColumn[col] || 0);
      }
      if (pointsBadge) {
        pointsBadge.textContent = `${metrics.pointsByColumn[col] || 0} pts`;
      }

      if (!dropzone) return;
      dropzone.innerHTML = "";

      const colTasks = visibleTasks.filter((t) => t.column === col);
      if (colTasks.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-placeholder";
        empty.textContent = "Arrastra tarjetas aquí o crea una nueva";
        dropzone.appendChild(empty);
      } else {
        colTasks.forEach((task) => {
          dropzone.appendChild(this.createCardElement(task));
        });
      }
    });

    // 5. Dibujar gráfico en <canvas>
    FlowMetrics.renderChart(
      this.dom.flowChart,
      metrics.matrixByColumnCategory
    );
  }
}

// Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", () => {
  const store = new BoardStore();
  const dndController = new DragDropController(store);
  new BoardRenderer(store, dndController);
});
