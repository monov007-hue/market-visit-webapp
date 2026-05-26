/* ══════════════════════════════════════
   TELEGRAM INIT
══════════════════════════════════════ */
const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#EEE9E2');
tg.setBackgroundColor('#EEE9E2');

// URL бэкенда — задаётся через window.API_URL = "http://..."
// до подключения этого скрипта, или в .env через мета-тег
const API_URL = window.API_URL || "";

let selectedFile = null;
let isAnalyzing  = false;

/* ══════════════════════════════════════
   ЭЛЕМЕНТЫ
══════════════════════════════════════ */
const $uploadZone  = document.getElementById("uploadZone");
const $previewZone = document.getElementById("previewZone");
const $previewImg  = document.getElementById("previewImg");
const $previewVeil = document.getElementById("previewVeil");
const $veilLabel   = document.getElementById("veilLabel");
const $statusLine  = document.getElementById("statusLine");
const $resultCard  = document.getElementById("resultCard");
const $fileInput   = document.getElementById("fileInput");
const $refreshBtn  = document.getElementById("refreshBtn");

/* ══════════════════════════════════════
   ОТКРЫТЬ ПИКЕР
══════════════════════════════════════ */
function openPicker() {
  if (isAnalyzing) return;
  $fileInput.click();
}

/* ══════════════════════════════════════
   ВЫБОР ФАЙЛА → автоматический анализ
══════════════════════════════════════ */
$fileInput.addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;
  selectedFile = file;
  this.value = ""; // сброс чтобы то же фото можно выбрать снова

  const reader = new FileReader();
  reader.onload = function(ev) {
    // Показываем превью, прячем кнопку
    $previewImg.src = ev.target.result;
    $uploadZone.classList.add("hidden");
    $previewZone.classList.remove("hidden");
    $resultCard.classList.add("hidden");

    // Сразу запускаем анализ
    sendPhoto();
  };
  reader.readAsDataURL(file);
});

/* ══════════════════════════════════════
   ОТПРАВКА ФОТО НА АНАЛИЗ
══════════════════════════════════════ */
function sendPhoto() {
  if (!selectedFile || isAnalyzing) return;
  isAnalyzing = true;

  setVeil(true, "Анализирую...");
  setStatus("📤 Отправляем на сервер...");

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(",")[1];

    // chat_id из контекста Telegram
    const chatId =
      tg.initDataUnsafe?.chat?.id ||
      tg.initDataUnsafe?.start_param ||
      null;

    tg.sendData(JSON.stringify({ image: base64, chat_id: chatId }));

    setVeil(false);
    setStatus("⏳ Ожидаем результат от бота...");
  };
  reader.readAsDataURL(selectedFile);
}

/* ══════════════════════════════════════
   РЕЗУЛЬТАТ ОТ БОТА
══════════════════════════════════════ */
tg.onEvent("message", function(data) {
  try {
    const result = typeof data === "string" ? JSON.parse(data) : data;
    if (result && result.product_name) showResult(result);
  } catch(_) {}
});

function showResult(r) {
  document.getElementById("resName").textContent     = r.product_name     || "—";
  document.getElementById("resBrand").textContent    = r.brand            || "—";
  document.getElementById("resCategory").textContent = r.product_category || "—";

  setVeil(false);
  setStatus("");
  $resultCard.classList.remove("hidden");
  isAnalyzing = false;
}

/* ══════════════════════════════════════
   СБРОС — следующее фото
══════════════════════════════════════ */
function resetUI() {
  selectedFile = null;
  isAnalyzing  = false;

  $previewZone.classList.add("hidden");
  $resultCard.classList.add("hidden");
  $previewImg.src = "";

  setVeil(false);
  setStatus("");

  // Показываем кнопку и сразу открываем пикер
  $uploadZone.classList.remove("hidden");
  openPicker();
}

/* ══════════════════════════════════════
   ГАЛЕРЕЯ
══════════════════════════════════════ */
async function loadChatPhotos() {
  // Анимация кнопки обновления
  $refreshBtn.classList.add("spinning");
  setTimeout(() => $refreshBtn.classList.remove("spinning"), 650);

  if (!API_URL) {
    showGalleryEmpty("Укажите API_URL для загрузки фото");
    return;
  }

  try {
    const res  = await fetch(`${API_URL}/api/photos`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    if (!data.photos || data.photos.length === 0) {
      showGalleryEmpty("Нет фото из чата");
      return;
    }

    const grid = document.getElementById("chatGallery");
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
    showGalleryEmpty("Нет соединения с сервером");
  }
}

function showGalleryEmpty(text) {
  const grid = document.getElementById("chatGallery");
  grid.innerHTML = `
    <div class="gallery-empty" id="galleryEmpty">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="gallery-empty-icon">
        <rect x="4" y="8" width="32" height="24" rx="3" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="14" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/>
        <path d="M4 28l7-6 5 5 5-4 7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span>${text}</span>
    </div>`;
}

async function selectFromGallery(url) {
  if (isAnalyzing) return;
  try {
    const res    = await fetch(url);
    const blob   = await res.blob();
    selectedFile = new File([blob], "gallery.jpg", { type: "image/jpeg" });

    const reader = new FileReader();
    reader.onload = function(ev) {
      $previewImg.src = ev.target.result;
      $uploadZone.classList.add("hidden");
      $previewZone.classList.remove("hidden");
      $resultCard.classList.add("hidden");
      sendPhoto();
    };
    reader.readAsDataURL(selectedFile);
  } catch(e) {
    setStatus("⚠️ Не удалось загрузить фото из галереи");
  }
}

/* ══════════════════════════════════════
   УТИЛИТЫ
══════════════════════════════════════ */
function setVeil(on, label = "") {
  if (on) {
    $previewVeil.classList.add("visible");
    $veilLabel.textContent = label;
  } else {
    $previewVeil.classList.remove("visible");
    $veilLabel.textContent = "";
  }
}

function setStatus(text) {
  $statusLine.textContent = text;
}

/* ══════════════════════════════════════
   СТАРТ
══════════════════════════════════════ */
loadChatPhotos();
