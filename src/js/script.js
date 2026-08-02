const textoBtn = document.querySelector(".textoBtn");
const seta = document.querySelector(".setaBtn");
const slides = document.querySelectorAll(".slide");
const btnNext = document.querySelector(".next");
const btnPrev = document.querySelector(".prev");
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



if (slides.length) {

    let slideAtual = 0;
    let intervalo;

    function contagem() {
        clearInterval(intervalo);
        intervalo = setInterval(() => {
            slideAtual = (slideAtual + 1) % slides.length
            mostrarSlide(slideAtual)
        }, 4000)
    }
    
    function mostrarSlide(indice) {
        slides.forEach(slide => slide.classList.remove("active"));
        slides[indice].classList.add("active");
    }

    btnNext?.addEventListener("click", () => {
        slideAtual = (slideAtual + 1) % slides.length;
        mostrarSlide(slideAtual);
        contagem()
    });

    btnPrev?.addEventListener("click", () => {
        slideAtual = (slideAtual - 1 + slides.length) % slides.length;
        mostrarSlide(slideAtual);
        contagem()
    });

    contagem();
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