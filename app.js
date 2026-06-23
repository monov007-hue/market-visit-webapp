/* ══════════════════════════════════════
   КОНФИГУРАЦИЯ
══════════════════════════════════════ */
const ANALYZE_WORKER = "https://market-vision-analyze.marketvisit.workers.dev";
const GALLERY_WORKER = "https://market-vision-gallery.marketvisit.workers.dev";
const MAX_SIZE_MB    = 4;

/* ══════════════════════════════════════
   TELEGRAM INIT
══════════════════════════════════════ */
const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#EBF3FB');
tg.setBackgroundColor('#EBF3FB');

/* ══════════════════════════════════════
   ЭЛЕМЕНТЫ
══════════════════════════════════════ */
const $previewZone = document.getElementById("previewZone");
const $previewImg  = document.getElementById("previewImg");
const $previewVeil = document.getElementById("previewVeil");
const $veilLabel   = document.getElementById("veilLabel");
const $resultCard  = document.getElementById("resultCard");
const $fileInput   = document.getElementById("fileInput");
const $btnZone     = document.getElementById("btnZone");
const $refreshBtn  = document.getElementById("refreshBtn");
const $gallery     = document.getElementById("gallerySection");

const $resName     = document.getElementById("resName");
const $resBrand    = document.getElementById("resBrand");
const $resCategory = document.getElementById("resCategory");

let isAnalyzing = false;

/* ══════════════════════════════════════
   ОТКРЫТЬ ПИКЕР
══════════════════════════════════════ */
function openPicker() {
  if (isAnalyzing) return;
  $fileInput.click();
}

/* ══════════════════════════════════════
   ВЫБОР ФАЙЛА → сразу анализ
══════════════════════════════════════ */
$fileInput.addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;
  this.value = "";

  // Проверка размера
  if (file.size / 1024 / 1024 > MAX_SIZE_MB) {
    showToast(`Файл слишком большой. Максимум ${MAX_SIZE_MB} МБ.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = function(ev) {
    // Показываем превью
    $previewImg.src = ev.target.result;
    $previewZone.classList.remove("hidden");
    $resultCard.classList.add("hidden");
    $btnZone.classList.add("hidden");

    // Запускаем анализ
    analyzePhoto(ev.target.result);
  };
  reader.readAsDataURL(file);
});

/* ══════════════════════════════════════
   АНАЛИЗ ЧЕРЕЗ CLOUDFLARE WORKER
══════════════════════════════════════ */
async function analyzePhoto(dataUrl) {
  if (isAnalyzing) return;
  isAnalyzing = true;

  setVeil(true, "Анализирую...");

  try {
    // Извлекаем base64 без префикса
    const base64 = dataUrl.split(",")[1];

    setVeil(true, "Google Vision...");
    const response = await fetch(`${ANALYZE_WORKER}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
    });

    setVeil(true, "Определяю товар...");

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Ошибка сервера: ${response.status}`);
    }

    const result = await response.json();

    if (!result.product_name) {
      throw new Error("Не удалось определить товар");
    }

    showResult(result);

  } catch (err) {
    console.error("Ошибка анализа:", err);
    showToast("⚠️ " + err.message);
    // Показываем кнопку снова
    setVeil(false);
    $previewZone.classList.add("hidden");
    $btnZone.classList.remove("hidden");
  } finally {
    isAnalyzing = false;
  }
}

/* ══════════════════════════════════════
   ПОКАЗАТЬ РЕЗУЛЬТАТ
══════════════════════════════════════ */
function showResult(result) {
  setVeil(false);

  $resName.textContent     = result.product_name || "Не определено";
  $resBrand.textContent    = result.brand        || "Не определено";
  $resCategory.textContent = result.category || result.product_category || "Другое";

  $resultCard.classList.remove("hidden");
  $btnZone.classList.remove("hidden");

  // Меняем текст кнопки
  document.getElementById("pickBtnLabel").textContent = "Сканировать ещё";
}

/* ══════════════════════════════════════
   ГАЛЕРЕЯ
══════════════════════════════════════ */
async function loadChatPhotos() {
  $refreshBtn.classList.add("spinning");
  setTimeout(() => $refreshBtn.classList.remove("spinning"), 650);

  const grid = document.getElementById("chatGallery");

  try {
    const res  = await fetch(`${GALLERY_WORKER}/photos?limit=20`, {
      signal: AbortSignal.timeout(6000)
    });
    const data = await res.json();

    if (!data.photos || data.photos.length === 0) {
      grid.innerHTML = `<div class="gallery-empty-msg">Нет фото из чата</div>`;
      return;
    }

    grid.innerHTML = "";
    data.photos.forEach(p => {
      const img   = document.createElement("img");
      img.src     = p.url;
      img.loading = "lazy";
      img.alt     = "";
      img.onclick = () => selectFromGallery(p.url);
      grid.appendChild(img);
    });

  } catch(e) {
    grid.innerHTML = `<div class="gallery-empty-msg">Нет соединения</div>`;
  }
}

async function selectFromGallery(url) {
  if (isAnalyzing) return;
  try {
    const res  = await fetch(url);
    const blob = await res.blob();

    const reader = new FileReader();
    reader.onload = function(ev) {
      $previewImg.src = ev.target.result;
      $previewZone.classList.remove("hidden");
      $resultCard.classList.add("hidden");
      $btnZone.classList.add("hidden");
      analyzePhoto(ev.target.result);
    };
    reader.readAsDataURL(blob);
  } catch(e) {
    showToast("Не удалось загрузить фото");
  }
}

/* ══════════════════════════════════════
   УТИЛИТЫ
══════════════════════════════════════ */
function setVeil(on, label = "") {
  if (on) {
    $previewVeil.classList.remove("hidden");
    $veilLabel.textContent = label;
  } else {
    $previewVeil.classList.add("hidden");
  }
}

function showToast(msg, duration = 3500) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position:fixed; bottom:28px; left:50%; transform:translateX(-50%) translateY(12px);
      background:rgba(0,0,0,.75); color:#fff; padding:10px 20px;
      border-radius:20px; font-size:14px; z-index:9999;
      opacity:0; transition:opacity .2s, transform .2s;
      font-family:'Inter',sans-serif; white-space:nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  setTimeout(() => { toast.style.opacity = "1"; toast.style.transform = "translateX(-50%) translateY(0)"; }, 10);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(-50%) translateY(12px)"; }, duration);
}

/* ══════════════════════════════════════
   СТАРТ
══════════════════════════════════════ */
loadChatPhotos();
});
