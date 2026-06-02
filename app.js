const app = document.querySelector("#app");

const categories = [
  "Молочная продукция",
  "Замороженные продукты",
  "Бакалея",
  "Напитки",
  "Косметика и уход",
];

const hypotheses = [
  {
    id: "category-growth",
    title: "Увеличение объёма продаж категории",
    metric: "% продаж категории от общего оборота",
    targetLabel: "Ожидаемый рост, %",
  },
  {
    id: "store-growth",
    title: "Увеличение продаж на уровне магазина",
    metric: "общий объём продаж в рублях",
    targetLabel: "Ожидаемый рост, %",
  },
  {
    id: "no-drop",
    title: "Неснижение продаж",
    metric: "изменение объёма продаж",
    targetLabel: "Максимально допустимое падение, %",
  },
];

const statusMeta = {
  positive: { label: "Положительный результат", className: "status-positive" },
  observe: { label: "Наблюдение", className: "status-observe" },
  stop: { label: "Рекомендуется остановить", className: "status-stop" },
  neutral: { label: "Новый тест", className: "status-neutral" },
  completed: { label: "Завершён", className: "status-completed" },
};

const stores = [
  { id: "s01", name: "Москва, Тверская", region: "Москва", format: "Супермаркет", sales: 128, map: [28, 28] },
  { id: "s02", name: "Москва, Авиапарк", region: "Москва", format: "Гипермаркет", sales: 164, map: [44, 24] },
  { id: "s03", name: "Москва, Ясенево", region: "Москва", format: "У дома", sales: 74, map: [68, 34] },
  { id: "s04", name: "Санкт-Петербург, Невский", region: "Санкт-Петербург", format: "Супермаркет", sales: 118, map: [56, 48] },
  { id: "s05", name: "Санкт-Петербург, Озерки", region: "Санкт-Петербург", format: "У дома", sales: 82, map: [22, 52] },
  { id: "s06", name: "Казань, Кремлевская", region: "Казань", format: "Супермаркет", sales: 101, map: [76, 56] },
  { id: "s07", name: "Казань, Горки", region: "Казань", format: "У дома", sales: 69, map: [35, 67] },
  { id: "s08", name: "Екатеринбург, Центр", region: "Екатеринбург", format: "Супермаркет", sales: 112, map: [62, 72] },
  { id: "s09", name: "Екатеринбург, Уралмаш", region: "Екатеринбург", format: "Гипермаркет", sales: 151, map: [18, 78] },
  { id: "s10", name: "Новосибирск, Академ", region: "Новосибирск", format: "У дома", sales: 76, map: [82, 82] },
  { id: "s11", name: "Новосибирск, Площадь Ленина", region: "Новосибирск", format: "Супермаркет", sales: 106, map: [47, 86] },
  { id: "s12", name: "Краснодар, Галерея", region: "Краснодар", format: "Гипермаркет", sales: 143, map: [72, 16] },
];

let tests = [
  {
    id: "t-dairy",
    name: "Молочная полка 2.0",
    category: "Молочная продукция",
    hypothesisId: "category-growth",
    target: 8,
    duration: "12 из 21 дня",
    status: "observe",
    currentResult: "+5.1%",
    recommendation: "Продолжить наблюдение",
    similarity: 94,
    groups: { test: ["s02", "s07"], control: ["s01", "s05"] },
    planogram: "Планограмма молочной полки v2",
    chart: { test: [42, 44, 45, 47, 49, 51], control: [41, 42, 43, 44, 44, 45] },
  },
  {
    id: "t-drinks",
    name: "Напитки у входа",
    category: "Напитки",
    hypothesisId: "store-growth",
    target: 6,
    duration: "18 из 28 дней",
    status: "stop",
    currentResult: "-2.4%",
    recommendation: "Рекомендуется остановить тест",
    similarity: 91,
    groups: { test: ["s09", "s12"], control: ["s04", "s10"] },
    planogram: "Планировка входной зоны v4",
    chart: { test: [65, 66, 64, 63, 62, 61], control: [64, 65, 65, 66, 66, 67] },
  },
  {
    id: "t-frozen",
    name: "Заморозка: новая выкладка",
    category: "Замороженные продукты",
    hypothesisId: "no-drop",
    target: 3,
    duration: "28 из 28 дней",
    status: "completed",
    currentResult: "+1.8%",
    finalResult: "+1.8%",
    recommendation: "Тест завершён без падения продаж",
    similarity: 96,
    groups: { test: ["s03", "s06"], control: ["s08", "s11"] },
    planogram: "Планограмма заморозки v3",
    completed: true,
    chart: { test: [31, 32, 32, 33, 34, 35], control: [31, 31, 32, 32, 33, 33] },
  },
];

const state = {
  draft: {
    category: "",
    hypothesisId: "",
    target: "",
    proposed: null,
    selected: null,
  },
  filters: {
    region: "all",
    format: "all",
    sales: "all",
  },
  planogram: "",
  toast: "",
};

function getRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [screen = "", id = ""] = hash.split("/");
  return { screen: screen || "home", id };
}

function navigate(path) {
  const nextHash = `#/${path.replace(/^\/?/, "")}`;
  if (window.location.hash === nextHash) {
    render();
    return;
  }
  window.location.hash = nextHash;
}

function render() {
  const route = getRoute();
  const screen = route.screen;

  if (screen === "new") {
    app.innerHTML = renderCreateScreen();
  } else if (screen === "groups") {
    app.innerHTML = isDraftReady() ? renderGroupsScreen() : renderDraftMissing();
  } else if (screen === "assignment") {
    app.innerHTML = isDraftReady() && state.draft.proposed ? renderAssignmentScreen() : renderDraftMissing();
  } else if (screen === "dashboard") {
    app.innerHTML = renderDashboardScreen(route.id);
  } else if (screen === "report") {
    app.innerHTML = renderReportScreen(route.id);
  } else {
    app.innerHTML = renderHomeScreen();
  }

  if (state.toast) {
    app.insertAdjacentHTML("beforeend", `<div class="toast" role="status">${escapeHtml(state.toast)}</div>`);
  }
}

function renderHomeScreen() {
  const activeTests = tests.filter((test) => !test.completed);
  activeTests.forEach(recalculateStatusOnHome);
  const completedTests = tests.filter((test) => test.completed);
  const activeCards = activeTests.map(renderTestCard).join("");
  const completedCards = completedTests.map(renderTestCard).join("");

  return `
    <section class="page-title">
      <div>
        <h2>Активные тесты</h2>
        <p class="subtitle">При открытии этой страницы статусы активных A/B-тестов пересчитываются по моковым данным мониторинга.</p>
      </div>
    </section>

    <section class="grid test-list">
      ${activeCards || renderEmptyState("Активных тестов нет. Создайте первый тест через кнопку в верхней панели.")}
    </section>

    <section class="page-title section-title">
      <div>
        <h2>Завершённые тесты</h2>
        <p class="subtitle">Здесь сохраняются тесты после явного завершения пользователем.</p>
      </div>
    </section>

    <section class="grid test-list">
      ${completedCards || renderEmptyState("Завершённых тестов пока нет.")}
    </section>
  `;
}

function renderTestCard(test) {
  const hypothesis = getHypothesis(test.hypothesisId);
  const status = statusMeta[test.status] || statusMeta.neutral;
  const action = test.completed ? "open-report" : "open-dashboard";
  const actionLabel = test.completed ? "Открыть финальный отчёт" : "Открыть дашборд";

  return `
    <button class="card test-card" type="button" data-action="${action}" data-id="${test.id}">
      <div class="card-header">
        <div>
          <p class="eyebrow">${escapeHtml(test.category)}</p>
          <h3>${escapeHtml(test.name)}</h3>
        </div>
        <span class="status-pill ${status.className}">${status.label}</span>
      </div>
      <ul class="meta-list">
        <li><strong>Гипотеза:</strong> ${escapeHtml(hypothesis.title)}</li>
        <li><strong>Метрика:</strong> ${escapeHtml(hypothesis.metric)}</li>
        <li><strong>Длительность:</strong> ${escapeHtml(test.duration)}</li>
        <li><strong>Действие:</strong> ${actionLabel}</li>
      </ul>
    </button>
  `;
}

function renderCreateScreen() {
  const hypothesis = hypotheses.find((item) => item.id === state.draft.hypothesisId);
  const label = hypothesis?.targetLabel || "Целевой процент";
  const ready = isDraftReady();

  return `
    <section class="page-title">
      <div>
        <h2>Создание нового теста</h2>
        <p class="subtitle">Заполните три поля в одной группе. Кнопка продолжения активируется только после выбора категории, гипотезы и целевого процента.</p>
      </div>
    </section>

    <section class="panel">
      <div class="compact-form" role="group" aria-label="Параметры теста">
        <div class="field">
          <label for="categorySelect">Категория товаров</label>
          <select id="categorySelect">
            <option value="">Выберите категорию</option>
            ${categories.map((category) => option(category, category, state.draft.category)).join("")}
          </select>
        </div>
        <div class="field">
          <label for="hypothesisSelect">Гипотеза</label>
          <select id="hypothesisSelect">
            <option value="">Выберите гипотезу</option>
            ${hypotheses.map((item) => option(item.id, item.title, state.draft.hypothesisId)).join("")}
          </select>
        </div>
        <div class="field">
          <label for="targetInput" id="targetInlineHint">${escapeHtml(label)}</label>
          <input id="targetInput" type="number" min="1" max="100" inputmode="decimal" value="${escapeHtml(state.draft.target)}" placeholder="Например, 8" />
        </div>
        <button class="primary-button" type="button" data-action="continue-groups" ${ready ? "" : "disabled"}>Продолжить к выбору магазинов</button>
      </div>
    </section>

    <section class="grid two-column">
      <div class="hint-box">
        <strong>Динамическая подсказка:</strong> ${escapeHtml(label)}.
        Для гипотезы «Неснижение продаж» это максимально допустимое падение, для гипотез роста - ожидаемый рост.
      </div>
      <div class="panel">
        <h3>Ограничения прототипа</h3>
        <ul class="meta-list">
          <li>Алгоритм подбора групп полностью замокан.</li>
          <li>Один магазин может быть только в одном активном тесте.</li>
          <li>Статусы активных тестов пересчитываются при открытии главной страницы.</li>
        </ul>
      </div>
    </section>
  `;
}

function renderGroupsScreen() {
  const proposed = ensureProposedGroups();
  const selected = ensureSelectedGroups();
  const validation = getGroupValidation(selected);
  const rows = getFilteredStores();
  const pins = rows.map((store) => renderMapPin(store, proposed, selected)).join("");

  return `
    <section class="page-title">
      <div>
        <h2>Выбор тестовой и контрольной групп</h2>
        <p class="subtitle">Система показывает автоматически предложенные группы, но можно кликать по магазинам в таблице или на карте и оставить только нужную часть выборки.</p>
      </div>
      <button class="secondary-button" type="button" data-action="go-new">Назад к параметрам</button>
    </section>

    <section class="groups-layout">
      <aside class="groups-sidebar">
        <section class="filters filters-stacked" aria-label="Фильтры магазинов">
          <h3>Фильтры</h3>
          <div class="field">
            <label for="regionFilter">Регион</label>
            <select id="regionFilter">
              <option value="all">Все регионы</option>
              ${uniqueValues(stores, "region").map((value) => option(value, value, state.filters.region)).join("")}
            </select>
          </div>
          <div class="field">
            <label for="formatFilter">Формат магазина</label>
            <select id="formatFilter">
              <option value="all">Все форматы</option>
              ${uniqueValues(stores, "format").map((value) => option(value, value, state.filters.format)).join("")}
            </select>
          </div>
          <div class="field">
            <label for="salesFilter">Объём продаж</label>
            <select id="salesFilter">
              ${option("all", "Любой объём", state.filters.sales)}
              ${option("high", "Высокий: от 115 млн ₽", state.filters.sales)}
              ${option("medium", "Средний: 85-114 млн ₽", state.filters.sales)}
              ${option("low", "Низкий: до 84 млн ₽", state.filters.sales)}
            </select>
          </div>
          <button class="ghost-button" type="button" data-action="reset-filters">Сбросить</button>
        </section>

        <section class="map-card">
          <h3>Карта магазинов</h3>
          <p class="subtitle">Клик по точке меняет выбор магазина.</p>
          <div class="legend-row">
            <span class="group-pill">Тестовая</span>
            <span class="group-pill group-control">Контрольная</span>
            <span class="tag">Доступен</span>
            <span class="occupied-pill">Занят</span>
          </div>
          <div class="mock-map" aria-label="Схематичная карта магазинов">${pins}</div>
        </section>
      </aside>

      <div class="panel table-panel">
        <div class="card-header">
          <div>
            <h3>Магазины</h3>
            <p class="subtitle">Выбрано: ${selected.test.length} тестовых и ${selected.control.length} контрольных. Занятые магазины отсортированы ниже доступных.</p>
          </div>
          <button class="primary-button" type="button" data-action="use-suggested-groups" ${validation.ok ? "" : "disabled"}>Использовать выбранные группы</button>
        </div>
        <div class="selection-summary ${validation.ok ? "is-ok" : "is-warning"}">
          ${escapeHtml(validation.message)}
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Магазин</th>
                <th>Регион</th>
                <th>Формат</th>
                <th>Продажи</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((store) => renderStoreRow(store, proposed, selected)).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderStoreRow(store, proposed, selected) {
  const occupiedBy = getOccupiedTest(store.id);
  const selectedGroup = getSelectedGroup(store.id, selected);
  const proposedGroup = getProposedGroup(store.id, proposed);
  const rowClass = [
    occupiedBy ? "is-occupied" : "is-clickable",
    selectedGroup ? `is-selected-${selectedGroup}` : "",
  ].filter(Boolean).join(" ");
  let status = `<span class="tag">Доступен</span>`;

  if (occupiedBy) {
    status = renderOccupiedPill(occupiedBy);
  } else if (selectedGroup === "test") {
    status = `<span class="group-pill">Тестовая группа</span>`;
  } else if (selectedGroup === "control") {
    status = `<span class="group-pill group-control">Контрольная группа</span>`;
  } else if (proposedGroup === "test") {
    status = `<span class="tag">Предложен в тестовую</span>`;
  } else if (proposedGroup === "control") {
    status = `<span class="tag">Предложен в контрольную</span>`;
  }

  return `
    <tr class="${rowClass}" ${occupiedBy ? "" : `data-action="toggle-store" data-id="${store.id}" tabindex="0"`}>
      <td><strong>${escapeHtml(store.name)}</strong></td>
      <td>${escapeHtml(store.region)}</td>
      <td>${escapeHtml(store.format)}</td>
      <td>${store.sales} млн ₽</td>
      <td>${status}</td>
    </tr>
  `;
}

function renderOccupiedPill(test) {
  return `
    <a class="occupied-pill occupied-link" href="#/dashboard/${test.id}" target="_blank" rel="noopener noreferrer">
      <span class="occupied-text occupied-text-default">Занят</span>
      <span class="occupied-text occupied-text-hover">Открыть тест</span>
      <span class="tooltip">
        Участвует в тесте «${escapeHtml(test.name)}».
      </span>
    </a>
  `;
}

function renderMapPin(store, proposed, selected) {
  const occupiedBy = getOccupiedTest(store.id);
  const selectedGroup = getSelectedGroup(store.id, selected);
  const proposedGroup = getProposedGroup(store.id, proposed);
  const className = [
    occupiedBy ? "occupied" : "",
    selectedGroup === "control" ? "control" : "",
    !occupiedBy && !selectedGroup ? "unselected" : "",
    !selectedGroup && proposedGroup ? `suggested-${proposedGroup}` : "",
  ].filter(Boolean).join(" ");
  const tag =
    selectedGroup === "test"
      ? "Т"
      : selectedGroup === "control"
        ? "К"
        : proposedGroup === "test"
          ? "Т?"
          : proposedGroup === "control"
            ? "К?"
            : store.id.replace("s", "");

  return `
    <button class="map-pin ${className}" type="button" style="left: ${store.map[0]}%; top: ${store.map[1]}%;" title="${escapeHtml(store.name)}" ${occupiedBy ? "disabled" : `data-action="toggle-store" data-id="${store.id}"`}>
      ${tag}
    </button>
  `;
}

function renderAssignmentScreen() {
  const selected = ensureSelectedGroups();
  const ready = Boolean(state.planogram);

  return `
    <section class="page-title">
      <div>
        <h2>Назначение изменений</h2>
        <p class="subtitle">Изменение планограммы назначается только тестовой группе. Контрольная группа остается без изменений.</p>
      </div>
      <button class="secondary-button" type="button" data-action="go-groups">Назад к группам</button>
    </section>

    <section class="grid two-column">
      <div class="panel">
        <h3>Новая планограмма или планировка</h3>
        <div class="upload-box">
          <div class="field">
            <label for="planogramSelect">Выбрать из библиотеки</label>
            <select id="planogramSelect">
              <option value="">Выберите вариант</option>
              ${option("planogram-category-v2", "Планограмма категории v2", state.planogram)}
              ${option("entrance-layout-v4", "Планировка входной зоны v4", state.planogram)}
              ${option("shelf-density-test", "Плотность выкладки: тест", state.planogram)}
            </select>
          </div>
        </div>
        <div class="button-row" style="margin-top: 18px;">
          <button class="primary-button" type="button" data-action="start-test" ${ready ? "" : "disabled"}>Запустить тест</button>
        </div>
      </div>

      <aside class="panel">
        <h3>Состав групп</h3>
        <p class="subtitle">Система уже исключила магазины, участвующие в других активных тестах.</p>
        <div class="grid report-grid">
          <div>
            <span class="group-pill">Тестовая группа</span>
            ${renderStoreList(selected.test)}
          </div>
          <div>
            <span class="group-pill group-control">Контрольная группа</span>
            ${renderStoreList(selected.control)}
          </div>
        </div>
      </aside>
    </section>
  `;
}

function renderDashboardScreen(testId) {
  const test = tests.find((item) => item.id === testId);
  if (!test) {
    return renderNotFound("Тест не найден");
  }

  const hypothesis = getHypothesis(test.hypothesisId);
  const status = statusMeta[test.status] || statusMeta.neutral;

  return `
    <section class="notice">
      <span class="notice-icon">!</span>
      <div><strong>Внимание:</strong> в одной из групп были изменены планограммы/ассортимент. Это может повлиять на результаты.</div>
    </section>

    <section class="panel">
      <div class="page-title">
        <div>
          <h2>${escapeHtml(test.name)}</h2>
          <p class="subtitle">${escapeHtml(test.category)} · статус был пересчитан на главной странице${test.lastRecalculatedAt ? ` в ${test.lastRecalculatedAt}` : ""}</p>
        </div>
        <span class="status-pill ${status.className}">${status.label}</span>
      </div>

      <div class="metric-strip" style="margin-top: 18px;">
        <div class="metric-tile">
          <span>Целевая метрика</span>
          <strong>${escapeHtml(hypothesis.metric)}</strong>
        </div>
        <div class="metric-tile">
          <span>Текущий результат</span>
          <strong>${escapeHtml(test.currentResult)}</strong>
        </div>
        <div class="metric-tile">
          <span>Рекомендация системы</span>
          <strong>${escapeHtml(test.recommendation)}</strong>
        </div>
        <div class="metric-tile">
          <span>Длительность теста</span>
          <strong>${escapeHtml(test.duration)}</strong>
        </div>
      </div>
    </section>

    <section class="grid chart-grid">
      ${renderChartCard("Тестовая группа", test.chart.test, "#2563eb")}
      ${renderChartCard("Контрольная группа", test.chart.control, "#64748b")}
    </section>

    <section class="button-row">
      <button class="danger-button" type="button" data-action="finish-test" data-id="${test.id}">Завершить тест</button>
      <button class="ghost-button" type="button" data-action="go-home">Вернуться к активным тестам</button>
    </section>
  `;
}

function renderReportScreen(testId) {
  const test = tests.find((item) => item.id === testId);
  if (!test) {
    return renderNotFound("Отчет не найден");
  }

  const hypothesis = getHypothesis(test.hypothesisId);
  const result = test.finalResult || test.currentResult;

  return `
    <section class="page-title">
      <div>
        <h2>Финальный отчет</h2>
        <p class="subtitle">Структурированный итог по завершенному A/B-тесту.</p>
      </div>
    </section>

    <section class="grid report-grid">
      <div class="panel">
        <h3>Параметры теста</h3>
        <ul class="meta-list">
          <li><strong>Категория:</strong> ${escapeHtml(test.category)}</li>
          <li><strong>Гипотеза:</strong> ${escapeHtml(hypothesis.title)}</li>
          <li><strong>Целевой процент:</strong> ${escapeHtml(String(test.target))}%</li>
          <li><strong>Метрика:</strong> ${escapeHtml(hypothesis.metric)}</li>
        </ul>
      </div>
      <div class="panel">
        <h3>Похожесть групп</h3>
        <div class="final-result">
          <div>
            <strong>${test.similarity}%</strong>
            <span>по продажам, региону и формату</span>
          </div>
        </div>
      </div>
    </section>

    <section class="grid report-grid">
      <div class="panel">
        <span class="group-pill">Тестовая группа</span>
        ${renderStoreList(test.groups.test)}
      </div>
      <div class="panel">
        <span class="group-pill group-control">Контрольная группа</span>
        ${renderStoreList(test.groups.control)}
      </div>
    </section>

    <section class="grid chart-grid">
      ${renderCombinedChart(test)}
      <div class="panel">
        <h3>Итоговый замеренный результат</h3>
        <div class="final-result">
          <div>
            <strong>${escapeHtml(result)}</strong>
            <span>${escapeHtml(test.recommendation)}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="report-actions">
      <button class="secondary-button" type="button" data-action="export-report">Экспорт отчёта</button>
      <button class="primary-button" type="button" data-action="go-new">Создать новый тест</button>
      <button class="ghost-button" type="button" data-action="go-home">К активным тестам</button>
    </section>
  `;
}

function renderChartCard(title, values, color) {
  return `
    <article class="chart-card">
      <h3>${escapeHtml(title)}</h3>
      ${renderLineChart([{ values, color }])}
    </article>
  `;
}

function renderCombinedChart(test) {
  return `
    <article class="chart-card">
      <h3>Итоговый график</h3>
      ${renderLineChart([
        { values: test.chart.test, color: "#2563eb" },
        { values: test.chart.control, color: "#64748b" },
      ])}
      <div class="legend-row">
        <span class="group-pill">Тестовая</span>
        <span class="group-pill group-control">Контрольная</span>
      </div>
    </article>
  `;
}

function renderLineChart(series) {
  const allValues = series.flatMap((item) => item.values);
  const min = Math.min(...allValues) - 2;
  const max = Math.max(...allValues) + 2;
  const gridLines = [40, 85, 130, 175]
    .map((y) => `<line x1="24" x2="376" y1="${y}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />`)
    .join("");
  const lines = series
    .map((item) => {
      const points = item.values
        .map((value, index) => {
          const x = 34 + index * (332 / (item.values.length - 1));
          const y = 176 - ((value - min) / (max - min)) * 136;
          return `${x},${y}`;
        })
        .join(" ");
      return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("");

  return `
    <svg class="chart" viewBox="0 0 400 210" role="img" aria-label="График результатов теста">
      <rect x="0" y="0" width="400" height="210" rx="20" fill="#f8fafc" />
      ${gridLines}
      ${lines}
      <line x1="24" x2="376" y1="178" y2="178" stroke="#cbd5e1" stroke-width="2" />
    </svg>
  `;
}

function renderStoreList(ids) {
  const items = ids
    .map((id) => stores.find((store) => store.id === id))
    .filter(Boolean)
    .map((store) => `<li>${escapeHtml(store.name)} <span class="subtitle">· ${store.sales} млн ₽</span></li>`)
    .join("");
  return `<ul class="store-list" style="margin-top: 12px;">${items}</ul>`;
}

function renderDraftMissing() {
  return `
    <section class="empty-state">
      <div>
        <h2>Сначала заполните параметры теста</h2>
        <p class="subtitle">После выбора категории, гипотезы и целевого процента можно перейти к группам.</p>
        <button class="primary-button" type="button" data-action="go-new">Перейти к созданию теста</button>
      </div>
    </section>
  `;
}

function renderNotFound(message) {
  return `
    <section class="empty-state">
      <div>
        <h2>${escapeHtml(message)}</h2>
        <p class="subtitle">Вернитесь к списку активных тестов или создайте новый.</p>
        <button class="primary-button" type="button" data-action="go-home">К активным тестам</button>
      </div>
    </section>
  `;
}

function renderEmptyState(message) {
  return `
    <section class="empty-state">
      <div>
        <h2>${escapeHtml(message)}</h2>
      </div>
    </section>
  `;
}

function isDraftReady() {
  return Boolean(
    state.draft.category &&
      state.draft.hypothesisId &&
      Number(state.draft.target) > 0,
  );
}

function ensureProposedGroups() {
  if (state.draft.proposed) {
    return state.draft.proposed;
  }

  const availableStores = stores
    .filter((store) => !getOccupiedTest(store.id))
    .sort((a, b) => {
      if (a.region === b.region) {
        return b.sales - a.sales;
      }
      return a.region.localeCompare(b.region, "ru");
    });

  state.draft.proposed = {
    test: availableStores.filter((_, index) => index % 2 === 0).slice(0, 4).map((store) => store.id),
    control: availableStores.filter((_, index) => index % 2 === 1).slice(0, 4).map((store) => store.id),
  };
  state.draft.selected = cloneGroups(state.draft.proposed);

  return state.draft.proposed;
}

function ensureSelectedGroups() {
  const proposed = ensureProposedGroups();
  if (!state.draft.selected) {
    state.draft.selected = cloneGroups(proposed);
  }
  return state.draft.selected;
}

function cloneGroups(groups) {
  return {
    test: [...groups.test],
    control: [...groups.control],
  };
}

function getGroupValidation(groups) {
  if (!groups.test.length && !groups.control.length) {
    return { ok: false, message: "Выберите одинаковое количество магазинов в тестовую и контрольную группы." };
  }
  if (groups.test.length !== groups.control.length) {
    return {
      ok: false,
      message: `Группы должны быть равными: сейчас тестовая ${groups.test.length}, контрольная ${groups.control.length}.`,
    };
  }
  return { ok: true, message: `Группы равны: ${groups.test.length} + ${groups.control.length}. Можно продолжать.` };
}

function getFilteredStores() {
  return stores
    .filter((store) => {
      const byRegion = state.filters.region === "all" || store.region === state.filters.region;
      const byFormat = state.filters.format === "all" || store.format === state.filters.format;
      const bySales =
        state.filters.sales === "all" ||
        (state.filters.sales === "high" && store.sales >= 115) ||
        (state.filters.sales === "medium" && store.sales >= 85 && store.sales <= 114) ||
        (state.filters.sales === "low" && store.sales <= 84);

      return byRegion && byFormat && bySales;
    })
    .sort((a, b) => {
      const aOccupied = Boolean(getOccupiedTest(a.id));
      const bOccupied = Boolean(getOccupiedTest(b.id));
      if (aOccupied !== bOccupied) {
        return aOccupied ? 1 : -1;
      }
      if (a.region !== b.region) {
        return a.region.localeCompare(b.region, "ru");
      }
      return b.sales - a.sales;
    });
}

function getProposedGroup(storeId, proposed) {
  if (proposed.test.includes(storeId)) {
    return "test";
  }
  if (proposed.control.includes(storeId)) {
    return "control";
  }
  return "";
}

function getSelectedGroup(storeId, selected) {
  if (selected.test.includes(storeId)) {
    return "test";
  }
  if (selected.control.includes(storeId)) {
    return "control";
  }
  return "";
}

function toggleStoreSelection(storeId) {
  if (getOccupiedTest(storeId)) {
    return;
  }

  const proposed = ensureProposedGroups();
  const selected = ensureSelectedGroups();
  const currentGroup = getSelectedGroup(storeId, selected);

  if (currentGroup) {
    selected[currentGroup] = selected[currentGroup].filter((id) => id !== storeId);
    return;
  }

  const proposedGroup = getProposedGroup(storeId, proposed);
  const targetGroup =
    selected.test.length < selected.control.length
      ? "test"
      : selected.control.length < selected.test.length
        ? "control"
        : proposedGroup || "test";

  selected[targetGroup].push(storeId);
}

function getOccupiedTest(storeId) {
  return tests.find((test) => {
    if (test.completed) {
      return false;
    }
    return test.groups.test.includes(storeId) || test.groups.control.includes(storeId);
  });
}

function getHypothesis(id) {
  return hypotheses.find((item) => item.id === id) || hypotheses[0];
}

function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]))].sort((a, b) => a.localeCompare(b, "ru"));
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function recalculateStatusOnHome(test) {
  if (test.completed) {
    return;
  }

  const scenario = {
    "t-dairy": {
      status: "observe",
      currentResult: "+5.1%",
      recommendation: "Продолжить наблюдение",
      chart: { test: [42, 44, 45, 47, 49, 51], control: [41, 42, 43, 44, 44, 45] },
    },
    "t-drinks": {
      status: "stop",
      currentResult: "-2.4%",
      recommendation: "Рекомендуется остановить тест",
      chart: { test: [65, 66, 64, 63, 62, 61], control: [64, 65, 65, 66, 66, 67] },
    },
  }[test.id] || {
    status: "positive",
    currentResult: `+${Math.max(2, Number(test.target) + 1).toFixed(1)}%`,
    recommendation: "Положительный результат",
    chart: { test: [38, 39, 42, 45, 48, 52], control: [38, 39, 40, 41, 42, 43] },
  };

  Object.assign(test, scenario);
  test.lastRecalculatedAt = new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startTest() {
  const selected = ensureSelectedGroups();
  const hypothesis = getHypothesis(state.draft.hypothesisId);
  const selectedPlanogram = planogramLabel(state.planogram);
  const id = `t-${Date.now()}`;
  const target = Number(state.draft.target);

  tests = [
    {
      id,
      name: `${state.draft.category}: ${hypothesis.title}`,
      category: state.draft.category,
      hypothesisId: state.draft.hypothesisId,
      target,
      duration: "1 из 28 дней",
      status: "neutral",
      currentResult: "+0.0%",
      recommendation: "Продолжить наблюдение",
      similarity: 93,
      groups: cloneGroups(selected),
      planogram: selectedPlanogram,
      chart: { test: [38, 39, 42, 45, 48, 52], control: [38, 39, 40, 41, 42, 43] },
    },
    ...tests,
  ];

  resetDraft();
  navigate(`dashboard/${id}`);
}

function finishTest(testId) {
  const test = tests.find((item) => item.id === testId);
  if (!test) {
    return;
  }
  test.completed = true;
  test.status = "completed";
  test.finalResult = test.currentResult;
  test.duration = test.duration.replace(/^1 /, "28 ");
  navigate(`report/${test.id}`);
}

function resetDraft() {
  state.draft = {
    category: "",
    hypothesisId: "",
    target: "",
    proposed: null,
    selected: null,
  };
  state.filters = { region: "all", format: "all", sales: "all" };
  state.planogram = "";
}

function planogramLabel(value) {
  const labels = {
    "planogram-category-v2": "Планограмма категории v2",
    "entrance-layout-v4": "Планировка входной зоны v4",
    "shelf-density-test": "Плотность выкладки: тест",
  };
  return labels[value] || "Новая планограмма";
}

function showToast(message) {
  state.toast = message;
  render();
  window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2200);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (!control || control.disabled) {
    return;
  }

  const { action, id } = control.dataset;
  event.preventDefault();

  if (action === "go-home") {
    navigate("");
  }
  if (action === "go-new") {
    navigate("new");
  }
  if (action === "go-groups") {
    navigate("groups");
  }
  if (action === "continue-groups") {
    state.draft.proposed = null;
    state.draft.selected = null;
    navigate("groups");
  }
  if (action === "use-suggested-groups") {
    const validation = getGroupValidation(ensureSelectedGroups());
    if (validation.ok) {
      navigate("assignment");
    } else {
      showToast(validation.message);
    }
  }
  if (action === "open-dashboard") {
    navigate(`dashboard/${id}`);
  }
  if (action === "open-report") {
    navigate(`report/${id}`);
  }
  if (action === "toggle-store") {
    toggleStoreSelection(id);
    render();
  }
  if (action === "start-test") {
    startTest();
  }
  if (action === "finish-test") {
    finishTest(id);
  }
  if (action === "export-report") {
    showToast("Экспорт отчёта подготовлен. В прототипе это мок-действие.");
  }
  if (action === "reset-filters") {
    state.filters = { region: "all", format: "all", sales: "all" };
    render();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "targetInput") {
    return;
  }

  state.draft.target = event.target.value;
  const button = document.querySelector('[data-action="continue-groups"]');
  if (button) {
    button.disabled = !isDraftReady();
  }
});

document.addEventListener("change", (event) => {
  const { id, value } = event.target;

  if (id === "categorySelect") {
    state.draft.category = value;
    state.draft.proposed = null;
    state.draft.selected = null;
    render();
  }
  if (id === "hypothesisSelect") {
    state.draft.hypothesisId = value;
    state.draft.proposed = null;
    state.draft.selected = null;
    render();
  }
  if (id === "regionFilter") {
    state.filters.region = value;
    render();
  }
  if (id === "formatFilter") {
    state.filters.format = value;
    render();
  }
  if (id === "salesFilter") {
    state.filters.sales = value;
    render();
  }
  if (id === "planogramSelect") {
    state.planogram = value;
    render();
  }
});

window.addEventListener("hashchange", render);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const row = event.target.closest('tr[data-action="toggle-store"]');
  if (!row) {
    return;
  }

  event.preventDefault();
  toggleStoreSelection(row.dataset.id);
  render();
});
render();
