/* ══════════════════════════════════════
   КОНФИГУРАЦИЯ
══════════════════════════════════════ */
const ANALYZE_WORKER = "https://worker-production-fbf0.up.railway.app";
const GALLERY_WORKER = "https://worker-production-fbf0.up.railway.app";
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
const $previewZone  = document.getElementById("previewZone");
const $previewImg   = document.getElementById("previewImg");
const $previewVeil  = document.getElementById("previewVeil");
const $veilLabel    = document.getElementById("veilLabel");
const $resultCard   = document.getElementById("resultCard");
const $fileInput    = document.getElementById("fileInput");
const $btnZone      = document.getElementById("btnZone");
const $refreshBtn   = document.getElementById("refreshBtn");
const $feedbackZone = document.getElementById("feedbackZone");
const $correctForm  = document.getElementById("correctForm");

const $resName      = document.getElementById("resName");
const $resBrand     = document.getElementById("resBrand");
const $resCategory  = document.getElementById("resCategory");

let isAnalyzing  = false;
let lastProductId = null;  // id последнего проанализированного товара
let lastResult    = null;  // последний результат анализа

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

  if (file.size / 1024 / 1024 > MAX_SIZE_MB) {
    showToast(`Файл слишком большой. Максимум ${MAX_SIZE_MB} МБ.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = function(ev) {
    $previewImg.src = ev.target.result;
    $previewZone.classList.remove("hidden");
    $resultCard.classList.add("hidden");
    $feedbackZone.classList.add("hidden");
    $correctForm.classList.add("hidden");
    $btnZone.classList.add("hidden");
    analyzePhoto(ev.target.result);
  };
  reader.readAsDataURL(file);
});

/* ══════════════════════════════════════
   АНАЛИЗ
══════════════════════════════════════ */
async function analyzePhoto(dataUrl) {
  if (isAnalyzing) return;
  isAnalyzing = true;
  lastProductId = null;

  setVeil(true, "Анализирую...");

  try {
    const base64 = dataUrl.split(",")[1];

    setVeil(true, "Google Vision...");
    const response = await fetch(`${ANALYZE_WORKER}/api/analyze`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ image: base64 }),
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

    lastResult    = result;
    lastProductId = result.product_id || null;

    showResult(result);

  } catch (err) {
    console.error("Ошибка анализа:", err);
    showToast("⚠️ " + err.message);
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
  $feedbackZone.classList.remove("hidden");
  $correctForm.classList.add("hidden");
  $btnZone.classList.remove("hidden");

  document.getElementById("pickBtnLabel").textContent = "Сканировать ещё";
}

/* ══════════════════════════════════════
   ЛАЙК / ДИЗЛАЙК
══════════════════════════════════════ */
async function sendFeedback(vote) {
  // Блокируем кнопки
  document.getElementById("btnLike").disabled    = true;
  document.getElementById("btnDislike").disabled = true;

  if (vote === 1) {
    // Лайк — просто отправляем
    await postFeedback(vote);
    showToast("👍 Спасибо за оценку!");
    $feedbackZone.classList.add("hidden");

  } else {
    // Дизлайк — показываем форму исправления
    $correctForm.classList.remove("hidden");

    // Заполняем поля текущими значениями
    document.getElementById("inputName").value     = lastResult?.product_name || "";
    document.getElementById("inputBrand").value    = lastResult?.brand        || "";

    // Заполняем выпадашку категорий
    fillCategorySelect();
    const currentCat = lastResult?.category || lastResult?.product_category || "Другое";
    document.getElementById("inputCategory").value = currentCat;
  }
}

function fillCategorySelect() {
  const select = document.getElementById("inputCategory");
  if (select.options.length > 1) return; // уже заполнено

  const categories = [
    "Овощи",                      "Фрукты",                       "Зелень и салаты",
    "Грибы",                      "Молоко и сливки",               "Кефир, кисломолочные изделия",
    "Сметана, творог",             "Творог, творожные десерты",     "Сыры",
    "Масло, маргарин",             "Молочные напитки",              "Мороженое",
    "Свинина",                    "Тушка птицы",                  "Разделка куриная",
    "Субпродукты",                "Другие виды мяса",             "Мясные полуфабрикаты",
    "Мясные изделия",             "Колбасные изделия",            "Рыба",
    "Морепродукты",                "Рыба готовая",                "Икра",
    "Консервы мясные",            "Консервы рыбные",              "Хлеб и батоны",
    "Булочки и пирожки",          "Торты и пирожные",             "Печенье и вафли",
    "Сушки и сухари",             "Шоколад и батончики",          "Конфеты и карамель",
    "Зефир и мармелад",           "Халва и козинаки",             "Жевательные резинки",
    "Чипсы и сухарики",           "Орехи и семечки",              "Попкорн",
    "Сухофрукты",                 "Батончики злаковые",           "Крупы",
    "Макароны и лапша",           "Мука и смеси",                 "Бобовые",
    "Растительные масла",         "Майонез и кетчуп",             "Соусы и приправы",
    "Специи и пряности",          "Варенье и джемы",              "Мёд",
    "Сгущённое молоко",           "Сиропы и топпинги",            "Замороженные овощи",
    "Пельмени и вареники",        "Замороженные блюда",           "Овощные консервы",
    "Готовые супы",               "Готовые каши",                 "Паштеты",
    "Детское питание",            "Газированные напитки",         "Соки и нектары",
    "Вода",                       "Энергетики",                   "Чай",
    "Кофе",                       "Алкоголь",                     "Безглютеновые продукты",
    "Диетические продукты",       "Органические продукты",        "Спортивное питание",
    "Растительные альтернативы",  "Другое",
  ];

  select.innerHTML = "";
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value       = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

async function submitCorrection() {
  const name     = document.getElementById("inputName").value.trim();
  const brand    = document.getElementById("inputBrand").value.trim();
  const category = document.getElementById("inputCategory").value;

  if (!name) {
    showToast("Введите название товара");
    return;
  }

  await postFeedback(-1, name, brand, category);

  // Обновляем карточку результата
  $resName.textContent     = name;
  $resBrand.textContent    = brand    || "Не определено";
  $resCategory.textContent = category || "Другое";

  $correctForm.classList.add("hidden");
  $feedbackZone.classList.add("hidden");
  showToast("✅ Исправление сохранено, спасибо!");
}

async function postFeedback(vote, correctName = null, correctBrand = null, correctCategory = null) {
  try {
    await fetch(`${ANALYZE_WORKER}/api/feedback`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        product_id:       lastProductId,
        vote,
        correct_name:     correctName,
        correct_brand:    correctBrand,
        correct_category: correctCategory,
      }),
    });
  } catch(e) {
    console.warn("Ошибка отправки фидбека:", e);
  }
}

function cancelCorrection() {
  $correctForm.classList.add("hidden");
  document.getElementById("btnLike").disabled    = false;
  document.getElementById("btnDislike").disabled = false;
}

/* ══════════════════════════════════════
   ГАЛЕРЕЯ
══════════════════════════════════════ */
async function loadChatPhotos() {
  $refreshBtn.classList.add("spinning");
  setTimeout(() => $refreshBtn.classList.remove("spinning"), 650);

  const grid = document.getElementById("chatGallery");

  try {
    const res  = await fetch(`${GALLERY_WORKER}/api/photos`, {
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
      img.src = `${GALLERY_WORKER}/api/proxy?url=${encodeURIComponent(p.url)}`;
      img.loading = "lazy";
      img.alt     = "";
      img.onclick = () => selectFromGallery(`${GALLERY_WORKER}/api/proxy?url=${encodeURIComponent(p.url)}`);
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
      $feedbackZone.classList.add("hidden");
      $correctForm.classList.add("hidden");
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
document.getElementById("pickBtn").addEventListener("click", openPicker);
document.getElementById("refreshBtn").addEventListener("click", loadChatPhotos);
loadChatPhotos();
