/* ══════════════════════════════════════
   TELEGRAM INIT
══════════════════════════════════════ */
const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#EBF3FB');
tg.setBackgroundColor('#EBF3FB');

const API_URL = window.API_URL || "";

let selectedFile = null;
let isAnalyzing  = false;

/* ══════════════════════════════════════
   ЭЛЕМЕНТЫ
══════════════════════════════════════ */
const $previewZone = document.getElementById("previewZone");
const $previewImg  = document.getElementById("previewImg");
const $previewVeil = document.getElementById("previewVeil");
const $veilLabel   = document.getElementById("veilLabel");
const $statusLine  = document.getElementById("statusLine");
const $resultCard  = document.getElementById("resultCard");
const $fileInput   = document.getElementById("fileInput");
const $pickBtn     = document.getElementById("pickBtn");
const $refreshBtn  = document.getElementById("refreshBtn");
const $pickLabel   = document.getElementById("pickBtnLabel");
const $btnZone     = document.getElementById("btnZone");
const $gallery     = document.getElementById("gallerySection");

/* ══════════════════════════════════════
   СТАРТ — скрыть галерею если нет API
══════════════════════════════════════ */
if (!API_URL) {
  $gallery.classList.add("hidden");
}

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
  selectedFile = file;
  this.value = "";

  const reader = new FileReader();
  reader.onload = function(ev) {
    $previewImg.src = ev.target.result;
    $previewZone.classList.remove("hidden");
    $btnZone.classList.add("hidden");       // скрываем кнопку
    sendPhoto();
  };
  reader.readAsDataURL(file);
});

/* ══════════════════════════════════════
   ОТПРАВКА
   sendData() отправляет данные боту
   и ЗАКРЫВАЕТ приложение автоматически.
   Результат бот пришлёт отдельным
   сообщением в чат.
══════════════════════════════════════ */
function sendPhoto() {
  if (!selectedFile || isAnalyzing) return;
  isAnalyzing = true;

  setVeil(true, "Отправляю...");

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(",")[1];
    const chatId =
      tg.initDataUnsafe?.chat?.id ||
      tg.initDataUnsafe?.start_param ||
      null;

    // После sendData приложение закроется —
    // бот пришлёт результат в чат
    tg.sendData(JSON.stringify({ image: base64, chat_id: chatId }));
  };
  reader.readAsDataURL(selectedFile);
}

/* ══════════════════════════════════════
   ГАЛЕРЕЯ
══════════════════════════════════════ */
async function loadChatPhotos() {
  if (!API_URL) return;

  $refreshBtn.classList.add("spinning");
  setTimeout(() => $refreshBtn.classList.remove("spinning"), 650);

  const grid = document.getElementById("chatGallery");

  try {
    const res  = await fetch(`${API_URL}/api/photos`, {
      signal: AbortSignal.timeout(5000)
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
    grid.innerHTML = `<div class="gallery-empty-msg">Нет соединения с сервером</div>`;
  }
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
      $previewZone.classList.remove("hidden");
      $btnZone.classList.add("hidden");
      sendPhoto();
    };
    reader.readAsDataURL(selectedFile);
  } catch(e) {
    console.error("Не удалось загрузить фото", e);
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

/* ══════════════════════════════════════
   СТАРТ
══════════════════════════════════════ */
loadChatPhotos();
