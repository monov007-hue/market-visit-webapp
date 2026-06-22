/**
 * Market Vision Bot — Mini App
 * app.js v3.0
 *
 * Новый flow:
 *   Пользователь выбирает фото
 *   → FileReader читает как base64
 *   → fetch POST → Cloudflare Worker /analyze
 *   → результат показывается внутри приложения (без закрытия!)
 */

// ─── Конфигурация ─────────────────────────────────────────────────────────────
const CONFIG = {

  ANALYZE_WORKER: "https://market-vision-analyze.marketvisit.workers.dev",
  GALLERY_WORKER: "https://market-vision-gallery.marketvisit.workers.dev",

  // Лимиты
  MAX_IMAGE_SIZE_MB: 4,
  GALLERY_LIMIT: 20,
};

// ─── Telegram WebApp ──────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;

// ─── Состояние приложения ─────────────────────────────────────────────────────
const state = {
  currentView: "home", // home | camera | gallery | result | loading
  selectedImage: null, // base64
  lastResult: null,    // результат анализа
};

// ─── DOM элементы ─────────────────────────────────────────────────────────────
const dom = {
  views: {
    home: document.getElementById("view-home"),
    camera: document.getElementById("view-camera"),
    gallery: document.getElementById("view-gallery"),
    result: document.getElementById("view-result"),
    loading: document.getElementById("view-loading"),
  },

  // Кнопки главного экрана
  btnCamera: document.getElementById("btn-camera"),
  btnGallery: document.getElementById("btn-gallery"),

  // Камера / загрузка фото
  fileInput: document.getElementById("file-input"),
  cameraPreview: document.getElementById("camera-preview"),
  btnAnalyze: document.getElementById("btn-analyze"),
  btnRetake: document.getElementById("btn-retake"),

  // Галерея
  galleryGrid: document.getElementById("gallery-grid"),
  galleryLoading: document.getElementById("gallery-loading"),

  // Загрузка (анализ)
  loadingText: document.getElementById("loading-text"),
  loadingProgress: document.getElementById("loading-progress"),

  // Результат
  resultName: document.getElementById("result-name"),
  resultBrand: document.getElementById("result-brand"),
  resultCategory: document.getElementById("result-category"),
  resultDescription: document.getElementById("result-description"),
  resultConfidence: document.getElementById("result-confidence"),
  resultImage: document.getElementById("result-image"),
  btnSaveResult: document.getElementById("btn-save-result"),
  btnNewScan: document.getElementById("btn-new-scan"),
  btnBack: document.querySelectorAll(".btn-back"),
};

// ─── Навигация ────────────────────────────────────────────────────────────────
function showView(name) {
  Object.values(dom.views).forEach((v) => {
    if (v) v.classList.remove("active");
  });

  const view = dom.views[name];
  if (view) {
    view.classList.add("active");
    state.currentView = name;
  }

  // Кнопка назад Telegram
  if (name === "home") {
    tg?.BackButton?.hide();
  } else {
    tg?.BackButton?.show();
  }
}

// ─── Инициализация Telegram ───────────────────────────────────────────────────
function initTelegram() {
  if (!tg) {
    console.warn("Telegram WebApp не найден — работаем в браузере");
    return;
  }

  tg.ready();
  tg.expand();

  // Применяем тему Telegram
  applyTelegramTheme();

  // Кнопка Назад
  tg.BackButton.onClick(() => {
    if (state.currentView !== "home") {
      showView("home");
    }
  });

  // Главная кнопка (показываем на экране камеры)
  tg.MainButton.setParams({
    text: "Анализировать",
    color: tg.themeParams.button_color || "#2AABEE",
  });
}

function applyTelegramTheme() {
  if (!tg?.themeParams) return;

  const tp = tg.themeParams;
  const root = document.documentElement;

  if (tp.bg_color) root.style.setProperty("--tg-bg", tp.bg_color);
  if (tp.text_color) root.style.setProperty("--tg-text", tp.text_color);
  if (tp.hint_color) root.style.setProperty("--tg-hint", tp.hint_color);
  if (tp.link_color) root.style.setProperty("--tg-link", tp.link_color);
  if (tp.button_color) root.style.setProperty("--tg-button", tp.button_color);
  if (tp.button_text_color) root.style.setProperty("--tg-button-text", tp.button_text_color);
  if (tp.secondary_bg_color) root.style.setProperty("--tg-secondary-bg", tp.secondary_bg_color);
}

// ─── Выбор фото ───────────────────────────────────────────────────────────────
function openCamera() {
  showView("camera");
  dom.btnAnalyze?.classList.add("hidden");
  dom.btnRetake?.classList.add("hidden");
  if (dom.cameraPreview) {
    dom.cameraPreview.src = "";
    dom.cameraPreview.classList.add("hidden");
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Проверка размера
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > CONFIG.MAX_IMAGE_SIZE_MB) {
    showError(`Файл слишком большой (${sizeMB.toFixed(1)} МБ). Максимум ${CONFIG.MAX_IMAGE_SIZE_MB} МБ.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.selectedImage = e.target.result; // data:image/...;base64,...

    if (dom.cameraPreview) {
      dom.cameraPreview.src = state.selectedImage;
      dom.cameraPreview.classList.remove("hidden");
    }

    dom.btnAnalyze?.classList.remove("hidden");
    dom.btnRetake?.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

// ─── Анализ фото ──────────────────────────────────────────────────────────────
async function analyzePhoto() {
  if (!state.selectedImage) return;

  showView("loading");
  setLoadingStep("Подготовка изображения...", 10);

  try {
    // Извлекаем base64 без префикса data:...
    const base64 = state.selectedImage.includes(",")
      ? state.selectedImage.split(",")[1]
      : state.selectedImage;

    setLoadingStep("Анализ изображения (Google Vision)...", 35);

    const response = await fetch(`${CONFIG.ANALYZE_WORKER}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
    });

    setLoadingStep("Определение товара (AI)...", 70);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || `Ошибка сервера: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success && !result.product_name) {
      throw new Error(result.error || "Не удалось определить товар");
    }

    setLoadingStep("Готово!", 100);

    state.lastResult = result;

    // Небольшая задержка чтобы пользователь увидел 100%
    await sleep(300);

    showResult(result);
  } catch (err) {
    console.error("Ошибка анализа:", err);
    showError(err.message);
    showView("camera");
  }
}

function setLoadingStep(text, progress) {
  if (dom.loadingText) dom.loadingText.textContent = text;
  if (dom.loadingProgress) {
    dom.loadingProgress.style.width = `${progress}%`;
  }
}

// ─── Показать результат ───────────────────────────────────────────────────────
function showResult(result) {
  if (dom.resultImage && state.selectedImage) {
    dom.resultImage.src = state.selectedImage;
  }

  if (dom.resultName) dom.resultName.textContent = result.product_name || "Не определено";
  if (dom.resultBrand) dom.resultBrand.textContent = result.brand || "Неизвестно";
  if (dom.resultCategory) dom.resultCategory.textContent = result.category || "Другое";
  if (dom.resultDescription) dom.resultDescription.textContent = result.description || "";

  if (dom.resultConfidence && result.confidence != null) {
    const pct = Math.round(result.confidence * 100);
    dom.resultConfidence.textContent = `${pct}%`;
    dom.resultConfidence.className = `confidence-badge ${pct >= 80 ? "high" : pct >= 50 ? "mid" : "low"}`;
  }

  showView("result");
}

// ─── Сохранить результат (отправить боту) ────────────────────────────────────
function saveResult() {
  if (!state.lastResult) return;

  // Отправляем данные боту через sendData — теперь только как опциональное сохранение,
  // НЕ как основной flow. Приложение не закрывается (tg.close() не вызывается).
  if (tg?.sendData) {
    const payload = JSON.stringify({
      action: "save_product",
      product_name: state.lastResult.product_name,
      brand: state.lastResult.brand,
      category: state.lastResult.category,
      confidence: state.lastResult.confidence,
    });

    // sendData закрывает приложение — показываем подтверждение заранее
    const confirmed = confirm("Сохранить товар в базу данных бота?\n(Приложение закроется после сохранения)");
    if (confirmed) {
      tg.sendData(payload);
    }
  } else {
    showToast("Сохранение доступно только в Telegram");
  }
}

// ─── Галерея ──────────────────────────────────────────────────────────────────
async function loadGallery() {
  showView("gallery");

  if (dom.galleryLoading) dom.galleryLoading.classList.remove("hidden");
  if (dom.galleryGrid) dom.galleryGrid.innerHTML = "";

  try {
    const res = await fetch(`${CONFIG.GALLERY_WORKER}/photos?limit=${CONFIG.GALLERY_LIMIT}`);
    const data = await res.json();

    if (dom.galleryLoading) dom.galleryLoading.classList.add("hidden");

    const photos = data.photos || [];

    if (photos.length === 0) {
      if (dom.galleryGrid) {
        dom.galleryGrid.innerHTML = `
          <div class="gallery-empty">
            <span class="empty-icon">📦</span>
            <p>Фото из группы появятся здесь</p>
            <p class="hint">Отправьте фото товара в группу</p>
          </div>`;
      }
      return;
    }

    photos.forEach((photo) => {
      const item = document.createElement("div");
      item.className = "gallery-item";
      item.innerHTML = `<img src="${photo.url}" alt="Товар" loading="lazy" />`;
      item.addEventListener("click", () => selectFromGallery(photo.url));
      dom.galleryGrid?.appendChild(item);
    });
  } catch (err) {
    if (dom.galleryLoading) dom.galleryLoading.classList.add("hidden");
    if (dom.galleryGrid) {
      dom.galleryGrid.innerHTML = `
        <div class="gallery-error">
          <p>Не удалось загрузить галерею</p>
          <p class="hint">${err.message}</p>
        </div>`;
    }
  }
}

async function selectFromGallery(url) {
  // Загружаем изображение и конвертируем в base64
  showView("loading");
  setLoadingStep("Загрузка фото...", 20);

  try {
    const res = await fetch(url);
    const blob = await res.blob();

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    state.selectedImage = base64;

    setLoadingStep("Анализ изображения...", 40);
    await analyzePhoto();
  } catch (err) {
    showError("Не удалось загрузить фото из галереи");
    showView("gallery");
  }
}

// ─── Утилиты ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function showToast(message, duration = 3000) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showError(message) {
  showToast(`⚠️ ${message}`, 4000);
}

// ─── Привязка событий ─────────────────────────────────────────────────────────
function bindEvents() {
  // Главный экран
  dom.btnCamera?.addEventListener("click", openCamera);
  dom.btnGallery?.addEventListener("click", loadGallery);

  // Камера
  dom.fileInput?.addEventListener("change", handleFileSelect);
  dom.btnAnalyze?.addEventListener("click", analyzePhoto);
  dom.btnRetake?.addEventListener("click", () => {
    if (dom.fileInput) dom.fileInput.value = "";
    openCamera();
  });

  // Результат
  dom.btnSaveResult?.addEventListener("click", saveResult);
  dom.btnNewScan?.addEventListener("click", () => {
    state.selectedImage = null;
    state.lastResult = null;
    showView("home");
  });

  // Кнопки Назад
  dom.btnBack?.forEach((btn) => {
    btn.addEventListener("click", () => showView("home"));
  });
}

// ─── Старт ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTelegram();
  bindEvents();
  showView("home");
});
