/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */

const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#F0EDE8');
tg.setBackgroundColor('#F0EDE8');

// URL бэкенда для получения фото из группы
// Укажи адрес своего бота-сервера в .env и передай через мета-тег или константу
const API_URL = window.API_URL || "";

let selectedFile = null;
let isAnalyzing  = false;

/* ══════════════════════════════════════
   ОТКРЫТЬ ПИКЕР
══════════════════════════════════════ */
function openPicker() {
  if (isAnalyzing) return;
  document.getElementById("fileInput").click();
}

/* ══════════════════════════════════════
   ВЫБОР ФАЙЛА → автоматический анализ
══════════════════════════════════════ */
document.getElementById("fileInput").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = function(ev) {
    // Показываем превью
    const img = document.getElementById("previewImg");
    img.src = ev.target.result;

    document.getElementById("previewWrap").classList.remove("hidden");
    document.getElementById("resultCard").classList.add("hidden");

    // Сразу запускаем анализ
    sendPhoto();
  };
  reader.readAsDataURL(file);

  // Сбрасываем input чтобы можно было выбрать то же фото повторно
  this.value = "";
});

/* ══════════════════════════════════════
   ОТПРАВКА + АНАЛИЗ
══════════════════════════════════════ */
function sendPhoto() {
  if (!selectedFile || isAnalyzing) return;

  isAnalyzing = true;
  setStatus("⏳ Анализирую...");
  setLoading(true);

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(",")[1];

    // Получаем chat_id если приложение открыто из группы
    const chatId = tg.initDataUnsafe?.chat?.id
                || tg.initDataUnsafe?.start_param
                || null;

    tg.sendData(JSON.stringify({
      image:   base64,
      chat_id: chatId,
    }));

    setStatus("📤 Отправлено на анализ");
    setLoading(false);
    isAnalyzing = false;
  };

  reader.readAsDataURL(selectedFile);
}

/* ══════════════════════════════════════
   ПОЛУЧИТЬ РЕЗУЛЬТАТ ОТ БОТА
   Бот отправляет результат через tg.onEvent
══════════════════════════════════════ */
tg.onEvent("message", function(data) {
  try {
    const result = typeof data === "string" ? JSON.parse(data) : data;
    if (result.product_name) showResult(result);
  } catch(_) {}
});

function showResult(r) {
  document.getElementById("resName").textContent     = r.product_name     || "—";
  document.getElementById("resBrand").textContent    = r.brand            || "—";
  document.getElementById("resCategory").textContent = r.product_category || "—";
  document.getElementById("resultCard").classList.remove("hidden");
  setStatus("");
}

/* ══════════════════════════════════════
   СБРОС UI
══════════════════════════════════════ */
function resetUI() {
  selectedFile = null;
  isAnalyzing  = false;

  document.getElementById("previewWrap").classList.add("hidden");
  document.getElementById("resultCard").classList.add("hidden");
  document.getElementById("previewImg").src = "";

  setStatus("");
  openPicker();
}

/* ══════════════════════════════════════
   ГАЛЕРЕЯ — фото из группы
══════════════════════════════════════ */
async function loadChatPhotos() {
  if (!API_URL) return;

  try {
    const res  = await fetch(`${API_URL}/api/photos`);
    const data = await res.json();

    const container = document.getElementById("chatGallery");
    const empty     = document.getElementById("galleryEmpty");

    if (!data.photos || data.photos.length === 0) {
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    container.innerHTML = "";

    data.photos.forEach(p => {
      const img   = document.createElement("img");
      img.src     = p.url;
      img.loading = "lazy";
      img.alt     = "фото из чата";
      img.onclick = () => selectFromGallery(p.url);
      container.appendChild(img);
    });

  } catch(e) {
    console.log("[Gallery] API недоступен:", e.message);
  }
}

// Выбрать фото из галереи и сразу анализировать
async function selectFromGallery(url) {
  if (isAnalyzing) return;

  try {
    const res    = await fetch(url);
    const blob   = await res.blob();
    selectedFile = new File([blob], "gallery.jpg", { type: "image/jpeg" });

    const reader = new FileReader();
    reader.onload = function(ev) {
      document.getElementById("previewImg").src = ev.target.result;
      document.getElementById("previewWrap").classList.remove("hidden");
      document.getElementById("resultCard").classList.add("hidden");
      sendPhoto();
    };
    reader.readAsDataURL(selectedFile);
  } catch(e) {
    setStatus("⚠️ Не удалось загрузить фото");
  }
}

/* ══════════════════════════════════════
   УТИЛИТЫ
══════════════════════════════════════ */
function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function setLoading(on) {
  const wrap = document.getElementById("previewWrap");
  const spin = document.getElementById("analyzeSpinner");
  const stat = document.getElementById("analyzeStatus");

  if (on) {
    wrap.classList.add("loading");
    spin.classList.remove("hidden");
    stat.textContent = "Анализирую...";
  } else {
    wrap.classList.remove("loading");
    spin.classList.add("hidden");
    stat.textContent = "";
  }
}

/* ══════════════════════════════════════
   СТАРТ
══════════════════════════════════════ */
loadChatPhotos();
