// Melhorias visuais dos modais "Editar Perfil" e "Editar Capa":
// pré-visualização de imagem, drag-and-drop e contador de caracteres da bio.
// Não interfere no envio/salvamento dos formulários, que continua em dashboard.js.
(function () {
  function setupImagePreview(inputId, imgId, nameEl) {
    const input = document.getElementById(inputId);
    const img = document.getElementById(imgId);
    if (!input || !img) return;

    function showFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.readAsDataURL(file);
      if (nameEl) nameEl.textContent = file.name;
    }

    input.addEventListener('change', () => {
      if (input.files && input.files[0]) showFile(input.files[0]);
    });

    // Suporte a arrastar-e-soltar sobre a área de preview/dropzone
    const dropTargets = [
      document.getElementById('capaPreviewWrap'),
      document.getElementById('capaDropzone'),
      document.getElementById('avatarDropzone'),
    ].filter(Boolean);

    dropTargets.forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('arrastando');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('arrastando'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('arrastando');
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
          input.files = e.dataTransfer.files;
          showFile(file);
        }
      });
    });
  }

  setupImagePreview('inputCapa', 'capaPreviewImg', document.getElementById('capaNomeArquivo'));
  setupImagePreview('inputAvatar', 'avatarPreviewImg', document.getElementById('avatarNomeArquivo'));

  // Contador de caracteres da bio
  const bio = document.getElementById('perfilBioInput');
  const contador = document.getElementById('bioContador');
  if (bio && contador) {
    const atualizar = () => { contador.textContent = `${bio.value.length}/${bio.maxLength}`; };
    bio.addEventListener('input', atualizar);
    atualizar();
  }

  // Ao abrir o modal de perfil, refletir a foto/nome/capa atuais no preview (se existirem no DOM)
  const btnEditarPerfil = document.getElementById('btnEditarPerfil');
  if (btnEditarPerfil) {
    btnEditarPerfil.addEventListener('click', () => {
      const avatarAtual = document.querySelector('.perfil-avatar');
      const previewAvatar = document.getElementById('avatarPreviewImg');
      if (avatarAtual && previewAvatar) previewAvatar.src = avatarAtual.src;
    });
  }

  const btnEditarCapa = document.getElementById('btnEditarCapa');
  if (btnEditarCapa) {
    btnEditarCapa.addEventListener('click', () => {
      const capaAtual = document.querySelector('.perfil-capa img');
      const previewCapa = document.getElementById('capaPreviewImg');
      if (capaAtual && previewCapa) previewCapa.src = capaAtual.src;
    });
  }
})();