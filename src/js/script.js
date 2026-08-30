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
    const card = container.closest(".faceRede.traseira");

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

    const dotsContainer = document.querySelector(".hero-dots");
    let dots = [];

    if (dotsContainer) {
        slides.forEach((_, indice) => {
            const dot = document.createElement("button");
            dot.classList.add("dot");
            if (indice === 0) dot.classList.add("active");
            dot.setAttribute("aria-label", `Ir para foto ${indice + 1}`);
            dot.addEventListener("click", () => {
                slideAtual = indice;
                mostrarSlide(slideAtual);
                contagem();
            });
            dotsContainer.appendChild(dot);
        });
        dots = document.querySelectorAll(".hero-dots .dot");
    }

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

        if (dots.length) {
            dots.forEach(dot => dot.classList.remove("active"));
            dots[indice].classList.add("active");
        }
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

/** Carrossel de Equipe — Carrega diretamente na página **/
const carrosselWrapper = document.getElementById("carrosselEquipeWrapper");
const carrosselTrack = document.getElementById("carrosselEquipe");
const btnCarrosselPrev = document.getElementById("carrosselPrev");
const btnCarrosselNext = document.getElementById("carrosselNext");

if (carrosselWrapper && carrosselTrack && typeof equipeMembros !== "undefined" && equipeMembros.length) {

    const total = equipeMembros.length;
    let indiceAtual = 0;
    let autoplayId = null;
    let montado = false;
    let cartasEl = [];

    function linkValido(url, dominio) {
        if (!url) return false;
        const limpo = url.trim().replace(/\/+$/, "");
        if (limpo.toLowerCase().endsWith(dominio)) return false;
        if (/seu_perfil|seu_asd/i.test(limpo)) return false;
        return true;
    }

    function montarCarrossel() {
        if (montado) return;

        equipeMembros.forEach((membro) => {
            const card = document.createElement("div");
            card.className = "membro-card";

            const redes = membro.redes || {};
            let redesHtml = "";
            if (linkValido(redes.instagram, "instagram.com")) {
                redesHtml += `<a href="${redes.instagram}" target="_blank" rel="noopener" aria-label="Instagram de ${membro.nome}"><i class="fab fa-instagram"></i></a>`;
            }
            if (linkValido(redes.github, "github.com")) {
                redesHtml += `<a href="${redes.github}" target="_blank" rel="noopener" aria-label="GitHub de ${membro.nome}"><i class="fab fa-github"></i></a>`;
            }
            if (redes.email) {
                redesHtml += `<a href="mailto:${redes.email}" aria-label="E-mail de ${membro.nome}"><i class="fas fa-envelope"></i></a>`;
            }

            card.innerHTML = `
                <div class="membro-card-avatar">
                    <img src="${membro.foto}" alt="${membro.nome}" loading="lazy">
                </div>
                <span class="membro-card-funcao">${membro.funcao}</span>
                <h3 class="membro-card-nome">${membro.nome}</h3>
                <p class="membro-card-bio">${membro.bio}</p>
                <div class="membro-card-redes">${redesHtml}</div>
            `;

            carrosselTrack.appendChild(card);
        });

        cartasEl = Array.from(carrosselTrack.querySelectorAll(".membro-card"));
        montado = true;
    }

    function offsetCircular(i, atual) {
        let d = i - atual;
        if (d > total / 2) d -= total;
        if (d < -total / 2) d += total;
        return d;
    }

    function atualizarCarrossel() {
        cartasEl.forEach((card, i) => {
            const offset = offsetCircular(i, indiceAtual);
            card.classList.remove("is-center", "is-prev", "is-next", "is-hidden-left", "is-hidden-right");

            if (offset === 0) card.classList.add("is-center");
            else if (offset === -1) card.classList.add("is-prev");
            else if (offset === 1) card.classList.add("is-next");
            else if (offset < -1) card.classList.add("is-hidden-left");
            else card.classList.add("is-hidden-right");
        });
    }

    function irPara(i) {
        indiceAtual = ((i % total) + total) % total;
        atualizarCarrossel();
        reiniciarAutoplay();
    }

    function proximoMembro() { irPara(indiceAtual + 1); }
    function membroAnterior() { irPara(indiceAtual - 1); }

    function reiniciarAutoplay() {
        clearInterval(autoplayId);
        autoplayId = setInterval(proximoMembro, 10000);
    }

    // Monta e inicializa o carrossel diretamente
    montarCarrossel();
    atualizarCarrossel();
    reiniciarAutoplay();

    btnCarrosselNext?.addEventListener("click", proximoMembro);
    btnCarrosselPrev?.addEventListener("click", membroAnterior);
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