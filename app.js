let tg = window.Telegram.WebApp;

tg.expand();

function sendPhoto() {

    let input = document.getElementById("fileInput");
    let file = input.files[0];

    if (!file) {
        alert("Выбери фото");
        return;
    }

    let reader = new FileReader();

    reader.onload = function(e) {

        let base64 = e.target.result.split(",")[1];

        tg.sendData(JSON.stringify({
            image: base64
        }));

        document.getElementById("result").innerText = "Отправлено...";
    };

    reader.readAsDataURL(file);
}