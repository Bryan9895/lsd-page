/**
 * Dados da equipe LSD
 *
 * Regras de padronização:
 * - Todos os membros usam fotos de ./src/images/equipe/avatar/.
 * - Função e bio existentes foram preservadas.
 * - Campos ainda não definidos permanecem como "Em desenvolvimento".
 * - Redes sociais/e-mail não confirmados ficam vazios.
 * - Os selos são limitados ao catálogo oficial abaixo.
 */

const SELOS_DISPONIVEIS = Object.freeze([
    "Laboratório de Sistemas e Dados",
    "Student teach Student",
    "Líder",
    "Robótica Educacional",
    "Lupa Digital",
    "Equipe de Mídia",
    "Simulados Enem",
    "Corrige AI",
    "FioCruz"
]);

const equipeMembros = [
    {
        nome: "Bryan William",
        funcao: "Desenvolvedor Full Stack",
        bio: "Nunca hesite, pois no momento que você hesitar, perderá.",
        foto: "./src/images/equipe/avatar/bryan.jpeg",
        selos: ["Student teach Student", "Líder"],
        redes: {
            instagram: "",
            github: "https://github.com/Bryan9895",
            email: "bryan.william10@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Heitor Martins",
        funcao: "Desenvolvedor Full Stack",
        bio: "Esta bio está em desenvolvimento.",
        foto: "./src/images/equipe/avatar/heitor.jpeg",
        selos: ["Robótica Educacional", "Lupa Digital", "Líder"],
        redes: {
            instagram: "",
            github: "https://github.com/Keniche46",
            email: ""
        }
    },
    {
        nome: "Francisco Adriel",
        funcao: "Robotista",
        bio: "Esta bio está em desenvolvimento.",
        foto: "./src/images/equipe/avatar/adriel.jpeg",
        selos: ["Lupa Digital", "Robótica Educacional"],
        redes: {
            instagram: "",
            github: "",
            email: ""
        }
    },
    {
        nome: "Paula Giovanna",
        funcao: "Diretora de Mídia",
        bio: "O seu sorriso pode mudar o mundo, por isso não deixe o mundo mudar o seu sorriso!",
        foto: "./src/images/equipe/avatar/giovanna.jpeg",
        selos: ["Equipe de Mídia"],
        redes: {
            instagram: "https://instagram.com/giosampp_",
            github: "",
            email: "paula.sampaio09@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Suellen Quintela",
        funcao: "Em desenvolvimento",
        bio: "Eu quero inventar meu próprio pecado, quero inventar meu próprio veneno.",
        foto: "./src/images/equipe/avatar/suellen.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "https://www.instagram.com/susu.life77",
            github: "https://github.com/suy772",
            email: "maria.quintela09@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Isabelly Gomes",
        funcao: "Produtora Criativa",
        bio: "Ad astra per aspera.",
        foto: "./src/images/equipe/avatar/isabelly.jpeg",
        selos: ["Simulados Enem", "Equipe de Mídia"],
        redes: {
            instagram: "https://instagram.com/isabelly_gomesds",
            github: "https://github.com/isabellygomesds",
            email: "isabelly.gomes11@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Lilia Carla",
        funcao: "Em desenvolvimento",
        bio: "Aquilo que mais receamos é o que nos faz sair dos nossos hábitos.",
        foto: "./src/images/equipe/avatar/lilia.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: ""
        }
    },
    {
        nome: "Maria Liliane",
        funcao: "Designer",
        bio: "Não se preocupe com o que os outros pensam. Apenas seja você mesmo.",
        foto: "./src/images/equipe/avatar/liliane.jpeg",
        selos: ["Corrige AI", "Simulados Enem"],
        redes: {
            instagram: "https://instagram.com/l1anes_",
            github: "https://github.com/LilianeBarbosa",
            email: "liliane.barbosa06@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Valentina Maciel",
        funcao: "Em desenvolvimento",
        bio: "O impossível não é impossível. Sua própria existência é a prova disso.",
        foto: "./src/images/equipe/avatar/valentina.jpeg",
        selos: ["Corrige AI"],
        redes: {
            instagram: "",
            github: "",
            email: "fernandes.valentina10@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Nicolas Mateus",
        funcao: "Programador",
        bio: "Não há como aprender a voar sem cair algumas vezes.",
        foto: "./src/images/equipe/avatar/nicolas.jpeg",
        selos: ["FioCruz", "Lupa Digital"],
        redes: {
            instagram: "",
            github: "https://github.com/SHConan-28",
            email: "silva.nicolas62@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Murilo Belizário",
        funcao: "Desenvolvedor Full Stack",
        bio: "Sapere Aude.",
        foto: "./src/images/equipe/avatar/murilo.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "https://github.com/MuriStack",
            email: "murilo.belizario12@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Hanna Sophia",
        funcao: "Desenvolvedora Python",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/hanna.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: "hanna.sophia03@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Wendell",
        funcao: "Robótico",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/wendell.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: "wendell.silva01@aluno.ifce.edu.br"
        }
    },
    {
        nome: "José Gilvan",
        funcao: "Membro Esporádico",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/gilvan.jpeg",
        selos: ["Lupa Digital"],
        redes: {
            instagram: "",
            github: "",
            email: "gilvan.silva01@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Caio Salgado Marques",
        funcao: "Desenvolvedor Full Stack",
        bio: "Sei lá!",
        foto: "./src/images/equipe/avatar/caio.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: "caio.salgado@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Yasmin Erbenes",
        funcao: "Fotógrafa",
        bio: "Carpe diem.",
        foto: "./src/images/equipe/avatar/yasmin.jpeg",
        selos: ["Equipe de Mídia"],
        redes: {
            instagram: "",
            github: "",
            email: "yasmin.erbenes@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Felipe Chen Fan",
        funcao: "Em desenvolvimento",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/felipe.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: "felipe.chen@aluno.ifce.edu.br"
        }
    },
    {
        nome: "Mario Gabriel",
        funcao: "Desenvolvedor Full Stack",
        bio: "O inverno está chegando.",
        foto: "./src/images/equipe/avatar/mario.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: "mario.gabriel@aluno.ifce.edu.br"
        }
    },

    // Membros adicionados a partir das fotos existentes na pasta avatar.
    {
        nome: "Miguel Angelo",
        funcao: "Em desenvolvimento",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/angelo.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: ""
        }
    },
    {
        nome: "Deyvisson",
        funcao: "Em desenvolvimento",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/deyvisson.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: ""
        }
    },
    {
        nome: "Esther Tiburcio",
        funcao: "Em desenvolvimento",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/esther.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: ""
        }
    },
    {
        nome: "Miguel Freitas",
        funcao: "Em desenvolvimento",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/freitas.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: ""
        }
    },
    {
        nome: "Miguel Rogisson",
        funcao: "Em desenvolvimento",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/rogisson.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: ""
        }
    },
    {
        nome: "Wesley Ryan",
        funcao: "Em desenvolvimento",
        bio: "Em desenvolvimento.",
        foto: "./src/images/equipe/avatar/ryan.jpeg",
        selos: ["Laboratório de Sistemas e Dados"],
        redes: {
            instagram: "",
            github: "",
            email: ""
        }
    }
];

// Garante que nenhum selo digitado por engano seja exibido fora do catálogo oficial.
equipeMembros.forEach((membro) => {
    membro.selos = Array.isArray(membro.selos)
        ? membro.selos.filter((selo) => SELOS_DISPONIVEIS.includes(selo))
        : [];

    membro.redes = {
        instagram: membro.redes?.instagram || "",
        github: membro.redes?.github || "",
        email: membro.redes?.email || ""
    };
});
