console.log(document.querySelectorAll(".btn-vermais"));


const urlGitHub = 'https://github.com/LSD-IFCE';
const urlInsta = 'https://www.instagram.com/lsdmpe/';
const urlContato = 'mailto:lsd@maranguape.ifce.edu.br';


function gerarQR(id, url){
    const container = document.getElementById(id);
    const card = container.closest(".face.traseira");

    QRCode.toCanvas(url, { width: 200 }, (err, canvas) => {
        if (err) return console.error(err);

        container.appendChild(canvas);

        card.style.cursor = "pointer";

        card.addEventListener("click", () => {
            window.open(url, "_blank");
        });

        const link = card.querySelector("a");

        if(link){
            link.addEventListener("click", (e) => {
                e.stopPropagation();
            });
        }
    });
}

/** nav bar scroll **/
const navbar = document.querySelector("nav");

window.addEventListener("scroll", () => {

    if(window.scrollY > 50){
        navbar.classList.add("scrolled");
    }else{
        navbar.classList.remove("scrolled");
    }

});


gerarQR('qrcode', urlGitHub);
gerarQR('qrcodeInsta', urlInsta);
gerarQR('qrcodeContato', urlContato);