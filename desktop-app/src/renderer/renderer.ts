(function () {
  'use strict';

  const DesktopShell = (window as any).DesktopShell;

  // Elementos de Navegación
  const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const viewPanels = document.querySelectorAll<HTMLDivElement>('.view-panel');

  // Elementos de Navegador Libre
  const urlInput = document.getElementById('url-input') as HTMLInputElement;
  const navBack = document.getElementById('nav-back')!;
  const navForward = document.getElementById('nav-forward')!;
  const navReload = document.getElementById('nav-reload')!;
  const navGo = document.getElementById('nav-go')!;
  const webviewLibre = document.getElementById('webview-libre') as any;

  // Elementos de Bloqueo / PIN
  const lockOverlay = document.getElementById('lock-overlay')!;
  const lockTitle = document.getElementById('lock-title')!;
  const lockDesc = document.getElementById('lock-desc')!;
  const setupNotice = document.getElementById('setup-notice')!;
  const pinLabel = document.getElementById('pin-label')!;
  const pinInput = document.getElementById('pin-input') as HTMLInputElement;
  const groupPinConfirm = document.getElementById('group-pin-confirm')!;
  const pinConfirmInput = document.getElementById('pin-confirm-input') as HTMLInputElement;
  const btnTogglePin = document.getElementById('btn-toggle-pin')!;
  const btnTogglePinConfirm = document.getElementById('btn-toggle-pin-confirm')!;
  const btnSubmitPin = document.getElementById('btn-submit-pin') as HTMLButtonElement;
  const lockError = document.getElementById('lock-error')!;
  const btnLockApp = document.getElementById('btn-lock-app')!;

  // Elementos para Cambiar PIN
  const btnChangePinHeader = document.getElementById('btn-change-pin-header')!;
  const changePinModal = document.getElementById('change-pin-modal')!;
  const btnCloseChangePin = document.getElementById('btn-close-change-pin')!;
  const btnCancelChangePin = document.getElementById('btn-cancel-change-pin')!;
  const btnSaveNewPin = document.getElementById('btn-save-new-pin') as HTMLButtonElement;
  const inputCurrentPin = document.getElementById('input-current-pin') as HTMLInputElement;
  const inputNewPin = document.getElementById('input-new-pin') as HTMLInputElement;
  const inputConfirmNewPin = document.getElementById('input-confirm-new-pin') as HTMLInputElement;
  const changePinError = document.getElementById('change-pin-error')!;

  // Elementos de Tarjetón Automático
  const tarjetonFormSection = document.getElementById('tarjeton-form-section')!;
  const tarjetonSavedBadge = document.getElementById('tarjeton-saved-badge')!;
  const tarjetonSavedMat = document.getElementById('tarjeton-saved-mat')!;
  const btnEditTarjetonCreds = document.getElementById('btn-edit-tarjeton-creds')!;
  const tarjetonInputsGroup = document.getElementById('tarjeton-inputs-group')!;
  const tarjetonMatInput = document.getElementById('tarjeton-mat-input') as HTMLInputElement;
  const tarjetonDelInput = document.getElementById('tarjeton-del-input') as HTMLInputElement;
  const tarjetonPassInput = document.getElementById('tarjeton-pass-input') as HTMLInputElement;
  const chkSaveTarjetonCreds = document.getElementById('chk-save-tarjeton-creds') as HTMLInputElement;
  const btnStartTarjetonDownload = document.getElementById('btn-start-tarjeton-download') as HTMLButtonElement;

  const tarjetonProgressSection = document.getElementById('tarjeton-progress-section')!;
  const tarjetonProgressStatus = document.getElementById('tarjeton-progress-status')!;
  const stepTj1 = document.getElementById('step-tj-1')!;
  const stepTj2 = document.getElementById('step-tj-2')!;
  const stepTj3 = document.getElementById('step-tj-3')!;
  const stepTj4 = document.getElementById('step-tj-4')!;

  const tarjetonSuccessSection = document.getElementById('tarjeton-success-section')!;
  const tarjetonSuccessFilename = document.getElementById('tarjeton-success-filename')!;
  const btnOpenDownloadedTarjeton = document.getElementById('btn-open-downloaded-tarjeton') as HTMLButtonElement;
  const btnAgainTarjeton = document.getElementById('btn-again-tarjeton')!;
  const tarjetonErrorAlert = document.getElementById('tarjeton-error-alert')!;
  let lastDownloadedTarjetonPath: string | null = null;

  // Elementos de Checadas Biométricas
  const bioMatInput = document.getElementById('bio-mat-input') as HTMLInputElement;
  const bioPassInput = document.getElementById('bio-pass-input') as HTMLInputElement;
  const btnConsultBiometrics = document.getElementById('btn-consult-biometrics') as HTMLButtonElement;
  const bioLoadingSection = document.getElementById('bio-loading-section')!;
  const bioProgressStatus = document.getElementById('bio-progress-status')!;
  const bioSummaryCards = document.getElementById('bio-summary-cards')!;
  const metricTotal = document.getElementById('metric-total')!;
  const metricEntradas = document.getElementById('metric-entradas')!;
  const metricSalidas = document.getElementById('metric-salidas')!;
  const metricRetardos = document.getElementById('metric-retardos')!;
  const metricOmisiones = document.getElementById('metric-omisiones')!;
  const bioTableSection = document.getElementById('bio-table-section')!;
  const bioTableBody = document.getElementById('bio-table-body')!;
  const bioErrorAlert = document.getElementById('bio-error-alert')!;

  // Elementos de Documentos
  const docsListContainer = document.getElementById('docs-list')!;
  const filterButtons = document.querySelectorAll<HTMLButtonElement>('.filter-btn');

  // Elementos del Modal de Credenciales
  const credsModal = document.getElementById('creds-modal')!;
  const btnConfigCreds = document.getElementById('btn-config-creds')!;
  const btnCloseCreds = document.getElementById('btn-close-creds')!;
  const btnCloseCredsModal = document.getElementById('btn-close-creds-modal')!;
  const btnSaveCreds = document.getElementById('btn-save-creds')!;
  const credTarjetonMat = document.getElementById('cred-tarjeton-mat') as HTMLInputElement;
  const credTarjetonDel = document.getElementById('cred-tarjeton-del') as HTMLInputElement;
  const credTarjetonPass = document.getElementById('cred-tarjeton-pass') as HTMLInputElement;
  const credTuPerfilMat = document.getElementById('cred-tuperfil-mat') as HTMLInputElement;
  const credTuPerfilPass = document.getElementById('cred-tuperfil-pass') as HTMLInputElement;

  // Toast
  const toast = document.getElementById('toast')!;

  let isFirstTimeSetup = false;
  let currentActiveTab = 'lvd';
  let currentDocFilter = 'ALL';

  // ==========================================
  // 1. GESTIÓN DE PESTAÑAS
  // ==========================================
  function switchTab(tabId: string, optionalUrl?: string) {
    currentActiveTab = tabId;

    tabButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    viewPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });

    if (tabId === 'documentos') {
      loadDocuments(currentDocFilter);
    } else if (tabId === 'tarjeton') {
      loadTarjetonSavedStatus();
    } else if (tabId === 'biometricos') {
      loadTuPerfilSavedStatus();
    } else if (tabId === 'libre' && optionalUrl && webviewLibre) {
      webviewLibre.src = optionalUrl;
      urlInput.value = optionalUrl;
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (tabId) switchTab(tabId);
    });
  });

  if (DesktopShell && typeof DesktopShell.onTabChanged === 'function') {
    DesktopShell.onTabChanged((tabId: string) => {
      switchTab(tabId);
    });
  }

  // ==========================================
  // 2. NAVEGADOR LIBRE
  // ==========================================
  function navigateToUrl() {
    let target = urlInput.value.trim();
    if (!target) return;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    if (webviewLibre) {
      webviewLibre.src = target;
    }
  }

  navGo.addEventListener('click', navigateToUrl);
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigateToUrl();
  });

  navBack.addEventListener('click', () => {
    if (webviewLibre && webviewLibre.canGoBack()) webviewLibre.goBack();
  });

  navForward.addEventListener('click', () => {
    if (webviewLibre && webviewLibre.canGoForward()) webviewLibre.goForward();
  });

  navReload.addEventListener('click', () => {
    if (webviewLibre) webviewLibre.reload();
  });

  if (webviewLibre) {
    try {
      webviewLibre.addEventListener('did-navigate', (e: any) => {
        if (currentActiveTab === 'libre') urlInput.value = e.url;
      });
      webviewLibre.addEventListener('did-navigate-in-page', (e: any) => {
        if (currentActiveTab === 'libre') urlInput.value = e.url;
      });
    } catch (err) {}
  }

  // ==========================================
  // 3. FLUJO NATIVO AUTOMÁTICO DE TARJETÓN
  // ==========================================
  async function loadTarjetonSavedStatus() {
    const creds = await DesktopShell.getCredentials('tarjeton');
    if (creds && creds.matricula) {
      tarjetonSavedMat.textContent = creds.matricula;
      tarjetonSavedBadge.style.display = 'flex';
      tarjetonInputsGroup.style.display = 'none';
      tarjetonMatInput.value = creds.matricula;
      tarjetonDelInput.value = creds.delegacion || '';
      tarjetonPassInput.value = creds.password || '';
    } else {
      tarjetonSavedBadge.style.display = 'none';
      tarjetonInputsGroup.style.display = 'grid';
    }
  }

  btnEditTarjetonCreds.addEventListener('click', () => {
    tarjetonSavedBadge.style.display = 'none';
    tarjetonInputsGroup.style.display = 'grid';
    tarjetonMatInput.focus();
  });

  if (DesktopShell && typeof DesktopShell.onTarjetonProgress === 'function') {
    DesktopShell.onTarjetonProgress((stepText: string) => {
      tarjetonProgressStatus.textContent = stepText;

      // Actualizar visual de pasos
      if (stepText.includes('Conectando')) {
        stepTj1.className = 'step-item active';
      } else if (stepText.includes('Ingresando') || stepText.includes('validando')) {
        stepTj1.className = 'step-item completed';
        stepTj2.className = 'step-item active';
      } else if (stepText.includes('Generando')) {
        stepTj1.className = 'step-item completed';
        stepTj2.className = 'step-item completed';
        stepTj3.className = 'step-item active';
      } else if (stepText.includes('Descargando') || stepText.includes('respaldando')) {
        stepTj1.className = 'step-item completed';
        stepTj2.className = 'step-item completed';
        stepTj3.className = 'step-item completed';
        stepTj4.className = 'step-item active';
      }
    });
  }

  btnStartTarjetonDownload.addEventListener('click', async () => {
    tarjetonErrorAlert.style.display = 'none';

    let matricula = tarjetonMatInput.value.trim();
    let delegacion = tarjetonDelInput.value.trim();
    let password = tarjetonPassInput.value.trim();

    const savedCreds = await DesktopShell.getCredentials('tarjeton');
    if (!matricula && savedCreds) {
      matricula = savedCreds.matricula;
      delegacion = savedCreds.delegacion;
      password = savedCreds.password;
    }

    if (!matricula || !password) {
      tarjetonErrorAlert.textContent = 'Por favor ingresa tu matrícula y contraseña de Tarjetón.';
      tarjetonErrorAlert.style.display = 'block';
      return;
    }

    if (chkSaveTarjetonCreds.checked) {
      await DesktopShell.saveCredentials('tarjeton', { matricula, delegacion, password });
    }

    // Iniciar vista de progreso
    tarjetonFormSection.style.display = 'none';
    tarjetonSuccessSection.style.display = 'none';
    tarjetonProgressSection.style.display = 'block';
    stepTj1.className = 'step-item active';
    stepTj2.className = 'step-item';
    stepTj3.className = 'step-item';
    stepTj4.className = 'step-item';

    try {
      const res = await DesktopShell.executeTarjetonDownload({ matricula, delegacion, password });

      tarjetonProgressSection.style.display = 'none';

      if (res && res.ok && res.document) {
        lastDownloadedTarjetonPath = res.document.localPath;
        tarjetonSuccessFilename.textContent = `Archivo guardado en USB: ${res.document.name}`;
        tarjetonSuccessSection.style.display = 'block';
        showToast('Tarjetón descargado y respaldado en USB.');
      } else {
        tarjetonFormSection.style.display = 'block';
        tarjetonErrorAlert.textContent = (res && res.error) || 'No se pudo generar el tarjetón. Verifica tus credenciales.';
        tarjetonErrorAlert.style.display = 'block';
      }
    } catch (err: any) {
      tarjetonProgressSection.style.display = 'none';
      tarjetonFormSection.style.display = 'block';
      tarjetonErrorAlert.textContent = err.message || 'Error de comunicación durante la descarga.';
      tarjetonErrorAlert.style.display = 'block';
    }
  });

  btnOpenDownloadedTarjeton.addEventListener('click', async () => {
    if (lastDownloadedTarjetonPath) {
      await DesktopShell.openDocument(lastDownloadedTarjetonPath);
    }
  });

  btnAgainTarjeton.addEventListener('click', () => {
    tarjetonSuccessSection.style.display = 'none';
    tarjetonFormSection.style.display = 'block';
    loadTarjetonSavedStatus();
  });

  // ==========================================
  // 4. FLUJO NATIVO AUTOMÁTICO DE CHECADAS
  // ==========================================
  async function loadTuPerfilSavedStatus() {
    const creds = await DesktopShell.getCredentials('tuperfil');
    if (creds && creds.matricula) {
      bioMatInput.value = creds.matricula;
      bioPassInput.value = creds.password || '';
    }
  }

  if (DesktopShell && typeof DesktopShell.onTuPerfilProgress === 'function') {
    DesktopShell.onTuPerfilProgress((stepText: string) => {
      bioProgressStatus.textContent = stepText;
    });
  }

  btnConsultBiometrics.addEventListener('click', async () => {
    bioErrorAlert.style.display = 'none';

    let matricula = bioMatInput.value.trim();
    let password = bioPassInput.value.trim();

    const savedCreds = await DesktopShell.getCredentials('tuperfil');
    if (!matricula && savedCreds) {
      matricula = savedCreds.matricula;
      password = savedCreds.password;
    }

    if (!matricula || !password) {
      bioErrorAlert.textContent = 'Por favor ingresa tu usuario y contraseña de Tu Perfil.';
      bioErrorAlert.style.display = 'block';
      return;
    }

    await DesktopShell.saveCredentials('tuperfil', { matricula, password });

    bioLoadingSection.style.display = 'block';
    bioSummaryCards.style.display = 'none';
    bioTableSection.style.display = 'none';

    try {
      const res = await DesktopShell.executeTuPerfilConsult({ matricula, password });

      bioLoadingSection.style.display = 'none';

      if (res && res.ok && res.records) {
        const sum = res.summary || { total: res.records.length, entradas: 0, salidas: 0, retardos: 0, omisiones: 0 };
        metricTotal.textContent = String(sum.total);
        metricEntradas.textContent = String(sum.entradas);
        metricSalidas.textContent = String(sum.salidas);
        metricRetardos.textContent = String(sum.retardos);
        metricOmisiones.textContent = String(sum.omisiones);
        bioSummaryCards.style.display = 'grid';

        bioTableBody.innerHTML = '';
        if (res.records.length === 0) {
          bioTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #5E728C; padding: 24px;">No se encontraron checadas en el periodo actual.</td></tr>';
        } else {
          res.records.forEach((r: any) => {
            const tr = document.createElement('tr');
            let pillClass = 'normal';
            if (r.estatus.toLowerCase().includes('retardo')) pillClass = 'retardo';
            if (r.estatus.toLowerCase().includes('omision') || r.estatus.toLowerCase().includes('omisión')) pillClass = 'omision';

            tr.innerHTML = `
              <td>${r.fecha}</td>
              <td><strong>${r.hora}</strong></td>
              <td>${r.tipo}</td>
              <td><span class="status-pill ${pillClass}">${r.estatus}</span></td>
              <td style="color: #5E728C;">${r.checador || 'Checador Central'}</td>
            `;
            bioTableBody.appendChild(tr);
          });
        }
        bioTableSection.style.display = 'block';
        showToast(`Se consultaron ${res.records.length} registros oficiales.`);
      } else {
        bioErrorAlert.textContent = (res && res.error) || 'Error consultando registros biométricos.';
        bioErrorAlert.style.display = 'block';
      }
    } catch (err: any) {
      bioLoadingSection.style.display = 'none';
      bioErrorAlert.textContent = err.message || 'Error de conexión con Tu Perfil.';
      bioErrorAlert.style.display = 'block';
    }
  });

  // ==========================================
  // 5. EXPLORADOR DE DOCUMENTOS EN USB
  // ==========================================
  async function loadDocuments(sourceFilter: string = 'ALL') {
    currentDocFilter = sourceFilter;
    const docs = await DesktopShell.listDocuments(sourceFilter === 'ALL' ? undefined : sourceFilter);

    docsListContainer.innerHTML = '';

    if (!docs || docs.length === 0) {
      docsListContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: #5E728C;">
          <p style="font-size: 14px; font-weight: 500;">No hay archivos guardados en esta categoría.</p>
          <p style="font-size: 12px; margin-top: 4px; color: #94A3B8;">Los tarjetones descargados y oficios se respaldarán aquí automáticamente.</p>
        </div>
      `;
      return;
    }

    docs.forEach((doc: any) => {
      const tile = document.createElement('div');
      tile.className = 'doc-tile';

      const dateFormatted = new Date(doc.downloadedAt).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const sizeKb = (doc.fileSize / 1024).toFixed(1) + ' KB';

      tile.innerHTML = `
        <div class="doc-tile-top">
          <div class="doc-tile-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="doc-tile-info">
            <div class="doc-tile-name" title="${doc.name}">${doc.name}</div>
            <div class="doc-tile-meta">${dateFormatted} • ${sizeKb}</div>
          </div>
        </div>
        <div class="doc-tile-actions">
          <button class="doc-tile-btn open-action">Abrir Documento</button>
          <button class="doc-tile-btn delete-action" title="Eliminar">&times;</button>
        </div>
      `;

      const openBtn = tile.querySelector('.open-action')!;
      openBtn.addEventListener('click', async () => {
        await DesktopShell.openDocument(doc.localPath);
      });

      const deleteBtn = tile.querySelector('.delete-action')!;
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`¿Eliminar ${doc.name} de la memoria USB?`)) {
          await DesktopShell.deleteDocumentById(doc.id, doc.localPath);
          loadDocuments(currentDocFilter);
        }
      });

      docsListContainer.appendChild(tile);
    });
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadDocuments(btn.dataset.source || 'ALL');
    });
  });

  // ==========================================
  // 6. BÓVEDA Y PANTALLA DE BLOQUEO POR PIN
  // ==========================================
  async function checkLockStatus(retries = 10) {
    try {
      const shell = (window as any).DesktopShell;
      if (!shell && retries > 0) {
        setTimeout(() => checkLockStatus(retries - 1), 60);
        return;
      }
      const isConfigured = await shell.isVaultConfigured();
      isFirstTimeSetup = !isConfigured;

      if (isFirstTimeSetup) {
        lockTitle.textContent = 'Configura tu PIN de Seguridad';
        setupNotice.style.display = 'block';
        lockDesc.textContent = 'Este PIN cifrará tus credenciales y protegerá tus archivos en esta memoria USB.';
        pinLabel.textContent = 'Define tu nuevo PIN (4 a 8 caracteres)';
        groupPinConfirm.style.display = 'block';
        btnSubmitPin.textContent = 'Guardar PIN y continuar';
        lockOverlay.style.display = 'flex';
        setTimeout(() => pinInput.focus(), 150);
      } else {
        setupNotice.style.display = 'none';
        groupPinConfirm.style.display = 'none';
        pinLabel.textContent = 'PIN de Seguridad';
        btnSubmitPin.textContent = 'Desbloquear';

        const isLocked = await shell.isVaultLocked();
        if (isLocked) {
          lockTitle.textContent = 'Acceso Seguro';
          lockDesc.textContent = 'Introduce tu PIN para acceder a tus documentos en esta memoria USB.';
          lockOverlay.style.display = 'flex';
          setTimeout(() => pinInput.focus(), 150);
        } else {
          lockOverlay.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error al verificar estado de la bóveda:', err);
    }
  }

  async function handlePinSubmit() {
    const shell = (window as any).DesktopShell;
    if (!shell) {
      showLockError('Iniciando sistema de seguridad... Espera un momento.');
      return;
    }

    const pin = pinInput.value.trim();
    if (!pin || pin.length < 4) {
      showLockError('El PIN debe tener al menos 4 caracteres');
      pinInput.focus();
      return;
    }

    if (isFirstTimeSetup) {
      const confirmPin = pinConfirmInput.value.trim();
      if (!confirmPin) {
        showLockError('Por favor confirma tu PIN en el segundo campo');
        pinConfirmInput.focus();
        return;
      }
      if (pin !== confirmPin) {
        showLockError('Los PINs no coinciden. Escribe el mismo PIN en ambos campos.');
        pinConfirmInput.focus();
        return;
      }

      btnSubmitPin.disabled = true;
      btnSubmitPin.textContent = 'Guardando...';

      try {
        const res = await shell.setupPin(pin);
        if (res && res.ok) {
          isFirstTimeSetup = false;
          lockOverlay.style.display = 'none';
          pinInput.value = '';
          pinConfirmInput.value = '';
          lockError.style.display = 'none';
          showToast('PIN configurado con éxito.');
          loadTarjetonSavedStatus();
          loadTuPerfilSavedStatus();
        } else {
          showLockError((res && res.error) || 'Error al configurar el PIN');
        }
      } catch (e: any) {
        showLockError(e?.message || 'Error inesperado al configurar PIN');
      } finally {
        btnSubmitPin.disabled = false;
        btnSubmitPin.textContent = 'Guardar PIN y continuar';
      }
    } else {
      btnSubmitPin.disabled = true;
      btnSubmitPin.textContent = 'Verificando...';

      try {
        const ok = await shell.unlock(pin);
        if (ok) {
          lockOverlay.style.display = 'none';
          pinInput.value = '';
          lockError.style.display = 'none';
          showToast('Bóveda desbloqueada.');
          loadTarjetonSavedStatus();
          loadTuPerfilSavedStatus();
        } else {
          showLockError('PIN incorrecto. Intenta de nuevo.');
          pinInput.value = '';
          pinInput.focus();
        }
      } catch (e: any) {
        showLockError(e?.message || 'Error al verificar PIN');
      } finally {
        btnSubmitPin.disabled = false;
        btnSubmitPin.textContent = 'Desbloquear';
      }
    }
  }

  function showLockError(msg: string) {
    lockError.textContent = msg;
    lockError.style.display = 'block';
  }

  btnSubmitPin.addEventListener('click', handlePinSubmit);

  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (isFirstTimeSetup) pinConfirmInput.focus();
      else handlePinSubmit();
    }
  });

  pinConfirmInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePinSubmit();
  });

  btnTogglePin.addEventListener('click', () => {
    pinInput.type = pinInput.type === 'password' ? 'text' : 'password';
  });

  btnTogglePinConfirm.addEventListener('click', () => {
    pinConfirmInput.type = pinConfirmInput.type === 'password' ? 'text' : 'password';
  });

  btnLockApp.addEventListener('click', async () => {
    await DesktopShell.lock();
    pinInput.value = '';
    pinConfirmInput.value = '';
    lockError.style.display = 'none';
    checkLockStatus();
  });

  if (DesktopShell && typeof DesktopShell.onLockStateChanged === 'function') {
    DesktopShell.onLockStateChanged((locked: boolean) => {
      if (locked) checkLockStatus();
      else lockOverlay.style.display = 'none';
    });
  }

  // ==========================================
  // 7. MODALES DE CAMBIO DE PIN Y CREDENCIALES
  // ==========================================
  btnChangePinHeader.addEventListener('click', () => {
    inputCurrentPin.value = '';
    inputNewPin.value = '';
    inputConfirmNewPin.value = '';
    changePinError.style.display = 'none';
    changePinModal.style.display = 'flex';
    setTimeout(() => inputCurrentPin.focus(), 150);
  });

  btnCloseChangePin.addEventListener('click', () => { changePinModal.style.display = 'none'; });
  btnCancelChangePin.addEventListener('click', () => { changePinModal.style.display = 'none'; });

  btnSaveNewPin.addEventListener('click', async () => {
    const currentPin = inputCurrentPin.value.trim();
    const newPin = inputNewPin.value.trim();
    const confirmNewPin = inputConfirmNewPin.value.trim();

    if (!currentPin) {
      showChangePinError('Por favor ingresa tu PIN actual');
      inputCurrentPin.focus();
      return;
    }
    if (!newPin || newPin.length < 4) {
      showChangePinError('El nuevo PIN debe tener al menos 4 caracteres');
      inputNewPin.focus();
      return;
    }
    if (newPin !== confirmNewPin) {
      showChangePinError('El nuevo PIN y su confirmación no coinciden');
      inputConfirmNewPin.focus();
      return;
    }

    btnSaveNewPin.disabled = true;
    btnSaveNewPin.textContent = 'Actualizando...';

    try {
      const res = await DesktopShell.changePin(currentPin, newPin);
      if (res && res.ok) {
        changePinModal.style.display = 'none';
        showToast('PIN actualizado correctamente.');
      } else {
        showChangePinError((res && res.error) || 'El PIN actual no es correcto');
      }
    } catch (err: any) {
      showChangePinError(err?.message || 'Error al cambiar PIN');
    } finally {
      btnSaveNewPin.disabled = false;
      btnSaveNewPin.textContent = 'Actualizar PIN';
    }
  });

  function showChangePinError(msg: string) {
    changePinError.textContent = msg;
    changePinError.style.display = 'block';
  }

  btnConfigCreds.addEventListener('click', async () => {
    const tarjetonCreds = await DesktopShell.getCredentials('tarjeton');
    if (tarjetonCreds) {
      credTarjetonMat.value = tarjetonCreds.matricula || '';
      credTarjetonDel.value = tarjetonCreds.delegacion || '';
      credTarjetonPass.value = tarjetonCreds.password || '';
    }

    const tuPerfilCreds = await DesktopShell.getCredentials('tuperfil');
    if (tuPerfilCreds) {
      credTuPerfilMat.value = tuPerfilCreds.matricula || '';
      credTuPerfilPass.value = tuPerfilCreds.password || '';
    }

    credsModal.style.display = 'flex';
  });

  btnCloseCreds.addEventListener('click', () => { credsModal.style.display = 'none'; });
  btnCloseCredsModal.addEventListener('click', () => { credsModal.style.display = 'none'; });

  btnSaveCreds.addEventListener('click', async () => {
    await DesktopShell.saveCredentials('tarjeton', {
      matricula: credTarjetonMat.value.trim(),
      delegacion: credTarjetonDel.value.trim(),
      password: credTarjetonPass.value.trim(),
    });

    await DesktopShell.saveCredentials('tuperfil', {
      matricula: credTuPerfilMat.value.trim(),
      password: credTuPerfilPass.value.trim(),
    });

    credsModal.style.display = 'none';
    showToast('Credenciales guardadas y cifradas en la USB.');
    loadTarjetonSavedStatus();
    loadTuPerfilSavedStatus();
  });

  // ==========================================
  // TOAST
  // ==========================================
  let toastTimer: any = null;
  function showToast(message: string) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.display = 'block';
    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  // INICIALIZACIÓN
  function initApp() {
    checkLockStatus();
    loadDocuments('ALL');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
