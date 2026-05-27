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
    $resultCard.classList.add("hidden");
    $previewZone.classList.remove("hidden");
    sendPhoto();
  };
  reader.readAsDataURL(file);
});

/* ══════════════════════════════════════
   ОТПРАВКА
══════════════════════════════════════ */
function sendPhoto() {
  if (!selectedFile || isAnalyzing) return;
  isAnalyzing = true;

  setVeil(true, "Анализирую...");
  setStatus("Отправляем на сервер...");
  $pickLabel.textContent = "Анализирую...";
  $pickBtn.disabled = true;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(",")[1];
    const chatId =
      tg.initDataUnsafe?.chat?.id ||
      tg.initDataUnsafe?.start_param ||
      null;

    tg.sendData(JSON.stringify({ image: base64, chat_id: chatId }));
    setStatus("Ожидаем результат...");
  };
  reader.readAsDataURL(selectedFile);
}

/* ══════════════════════════════════════
   РЕЗУЛЬТАТ ОТ БОТА
══════════════════════════════════════ */
tg.onEvent("message", function(data) {
  try {
    const r = typeof data === "string" ? JSON.parse(data) : data;
    if (r && r.product_name) showResult(r);
  } catch(_) {}
});

function showResult(r) {
  document.getElementById("resName").textContent     = r.product_name     || "—";
  document.getElementById("resBrand").textContent    = r.brand            || "—";
  document.getElementById("resCategory").textContent = r.product_category || "—";

  setVeil(false);
  setStatus("");
  $resultCard.classList.remove("hidden");
  $pickLabel.textContent = "Следующее фото";
  $pickBtn.disabled = false;
  isAnalyzing = false;
}

/* ══════════════════════════════════════
   СБРОС
══════════════════════════════════════ */
function resetUI() {
  selectedFile = null;
  isAnalyzing  = false;

  $previewZone.classList.add("hidden");
  $resultCard.classList.add("hidden");
  $previewImg.src = "";
  $pickLabel.textContent = "Выбрать фото";
  $pickBtn.disabled = false;

  setVeil(false);
  setStatus("");
  openPicker();
}

$pickBtn.addEventListener("click", function() {
  if (!$resultCard.classList.contains("hidden")) {
    resetUI();
  }
});

/* ══════════════════════════════════════
   ГАЛЕРЕЯ
══════════════════════════════════════ */
async function loadChatPhotos() {
  $refreshBtn.classList.add("spinning");
  setTimeout(() => $refreshBtn.classList.remove("spinning"), 650);

  const grid = document.getElementById("chatGallery");

  if (!API_URL) {
    grid.innerHTML = `<div class="gallery-empty-msg">Укажите API_URL для загрузки фото</div>`;
    return;
  }

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
      $resultCard.classList.add("hidden");
      $previewZone.classList.remove("hidden");
      sendPhoto();
    };
    reader.readAsDataURL(selectedFile);
  } catch(e) {
    setStatus("Не удалось загрузить фото");
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

function setStatus(text) {
  $statusLine.textContent = text;
}

/* ══════════════════════════════════════
   СТАРТ
══════════════════════════════════════ */
loadChatPhotos();
