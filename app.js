let tg = window.Telegram.WebApp;
tg.expand();

let selectedFile = null;

/* ────────────────
   ОТКРЫТЬ ПИКЕР
──────────────── */
function openPicker() {
    document.getElementById("fileInput").click();
}

/* ────────────────
   ВЫБОР ФАЙЛА
──────────────── */
document.getElementById("fileInput").addEventListener("change", function(e) {

    selectedFile = e.target.files[0];

    if (!selectedFile) return;

    let reader = new FileReader();

    reader.onload = function(ev) {
        document.getElementById("preview").innerHTML =
            `<img src="${ev.target.result}">`;
    };

    reader.readAsDataURL(selectedFile);
});

/* ────────────────
   ОТПРАВКА
──────────────── */
function sendPhoto() {

    if (!selectedFile) {
        document.getElementById("status").innerText = "⚠️ выбери фото";
        return;
    }

    let reader = new FileReader();

    document.getElementById("status").innerText = "⏳ анализ...";

    reader.onload = function(e) {

        let base64 = e.target.result.split(",")[1];

        tg.sendData(JSON.stringify({
            image: base64
        }));

        document.getElementById("status").innerText = "📤 отправлено";
    };

    reader.readAsDataURL(selectedFile);
}

/* ────────────────
   ЗАГРУЗКА ФОТО ИЗ ЧАТА
──────────────── */
async function loadChatPhotos() {

    try {

        let res = await fetch("/api/photos"); 
        let data = await res.json();

        let container = document.getElementById("chatGallery");

        container.innerHTML = "";

        data.photos.forEach(p => {

            let img = document.createElement("img");
            img.src = p.url;

            container.appendChild(img);
        });

    } catch (e) {
        console.log("no backend photos API yet");
    }
}

loadChatPhotos();
