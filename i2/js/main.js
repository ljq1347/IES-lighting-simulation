
let scene, camera, renderer, controls;
let zoomTargetDistance = null;
let zoomCurrentDistance = null;
let currentGroup = null;
let poleGroup = null;
let poleMesh = null;
let lampHeadMesh = null;
let lampArmMesh = null;
let lampShadeMesh = null;
let currentData = null;
window.currentData = currentData;
let viewMode = 'curve';
let showPole = true;
let showIES = true;

let measurementMode = false;
let measurementPoints = [];
let measurementLine = null;
let scaleFactor = 1;
window.scaleFactor = scaleFactor;
let measurementInfo = null;

let mapMesh = null;
let mapTexture = null;
let showMap = true;
let mapOpacity = 0.3;
let mapHeight = 50;
let mapWidth = 50;
let mapOffsetX = 0;
let mapOffsetZ = 0;

let movePoleMode = false;
let isDragging = false;
let originalPolePosition = null;
let originalMapOffsetX = 0;
let originalMapOffsetZ = 0;
let previousMousePosition = { x: 0, y: 0 };
let mapOriginalRotation = new THREE.Euler();
let mapOriginalPosition = new THREE.Vector3();
let isMeasuring2D = false;

let poleRulerGroup = null;
let poleRulerLine = null;
let poleRulerLabel = null;
let poleHeight = 5;
let showPoleRuler = true;
let poleRulerOffset = new THREE.Vector3(2, 0, 2);

let illuminanceMesh = null;
let contourLines = [];
let contourLabels = [];
let showIlluminance = true;
let illuminanceUnit = 'fc';
window.illuminanceUnit = illuminanceUnit;
let gridResolution = 15;
window.gridResolution = gridResolution;
let illuminanceData = [];

let lightHeight = 5;
window.lightHeight = lightHeight;
let lampPower = 60;
window.lampPower = lampPower;
let nominalLumen = 80;
let lightRotation = Math.PI / 2;

let panelStates = {
    'map-panel': false,
    'upload-panel': false,
    'lighting-panel': false,
    'illuminance-panel': false
};

function initPanelStates() { 
    Object.keys(panelStates).forEach(panelId => {
        panelStates[panelId] = false;
    });
    
    updateAllPanelLabels();
}

const topInfoItems = {
    'map': null,
    'ies': null,
    'lighting': null,
    'illuminance': null
};

function updateTopInfo(type, icon, text, color = '#3aa0ff') {
    const infoBar = document.getElementById('top-info-bar');
    const infoContent = document.getElementById('top-info-content');
    
    if (!infoBar || !infoContent) return;
    
    topInfoItems[type] = { icon, text, color };
    
    const order = ['map', 'ies', 'lighting', 'illuminance'];
    let html = '';
    order.forEach(key => {
        const item = topInfoItems[key];
        if (item) {
            html += `<div class="info-item"><span class="info-text">${item.text}</span></div>`;
        }
    });
    
    if (html) {
        infoContent.innerHTML = html;
        infoBar.style.display = 'block';
    } else {
        infoBar.style.display = 'none';
    }
    
    updateLabelsFromTopInfo();
}

function updateLabelsFromTopInfo() {
    const typeToPanel = {
        'map': 'map-panel',
        'ies': 'upload-panel',
        'lighting': 'lighting-panel',
        'illuminance': 'illuminance-panel'
    };
    
    Object.keys(topInfoItems).forEach(type => {
        const panelId = typeToPanel[type];
        if (panelId) {
            const hasValue = topInfoItems[type] !== null;
            panelStates[panelId] = hasValue;
            updatePanelLabel(panelId);
        }
    });
}

function removeTopInfo(type) {
    topInfoItems[type] = null;
    let html = '';
    const infoBar = document.getElementById('top-info-bar');
    const infoContent = document.getElementById('top-info-content');
    
    const order = ['map', 'ies', 'lighting', 'illuminance'];
    order.forEach(key => {
        const item = topInfoItems[key];
        if (item) {
            html += `<div style="display:flex; align-items:center; gap:6px; color:${item.color}; padding:8px 12px; background:rgba(255,255,255,0.1); border-radius:6px; width:100%; min-width:180px; box-sizing:border-box;">`;
            html += `<span style="font-size:14px; flex-shrink:0;">${item.icon}</span>`;
            html += `<span style="flex:1; font-size:12px; word-break:break-all; white-space:normal;">${item.text}</span>`;
            html += '</div>';
        }
    });
    
    if (html) {
        infoContent.innerHTML = html;
    } else {
        infoBar.style.display = 'none';
    }
    
    updateLabelsFromTopInfo();
}

function hideTopInfo() {
    const infoBar = document.getElementById('top-info-bar');
    if (infoBar) {
        infoBar.style.display = 'none';
    }
    Object.keys(topInfoItems).forEach(key => {
        topInfoItems[key] = null;
    });
}

function getResolutionText(resolution) {
    if (resolution <= 10) return 'Low';
    if (resolution <= 20) return 'Medium';
    if (resolution <= 30) return 'High';
    if (resolution <= 50) return 'Ultra';
    return 'Extreme';
}

function savePanelStates() {
    try {
        localStorage.setItem('panelStates', JSON.stringify(panelStates));
    } catch (e) {
        console.log('Failed to save panel state:', e);
    }
}

function updatePanelState(panelId, hasValue) {
    panelStates[panelId] = hasValue;
    savePanelStates();
    updatePanelLabel(panelId);
}

function updatePanelLabel(panelId) {
    const hasValue = panelStates[panelId];
    
    const navItem = document.querySelector(`.nav-item[data-panel="${panelId}"]`);
    if (navItem) {
        navItem.classList.remove('default', 'has-value');
        navItem.classList.add(hasValue ? 'has-value' : 'default');
    }
}

function updateAllPanelLabels() {
    Object.keys(panelStates).forEach(panelId => {
        updatePanelLabel(panelId);
    });
}

function resetPanel(panelId) {
    showCustomConfirm('Reset this panel?', (confirmed) => {
        if (!confirmed) {
            return;
        }

        const panelToType = {
            'map-panel': 'map',
            'upload-panel': 'ies',
            'lighting-panel': 'lighting',
            'illuminance-panel': 'illuminance'
        };

        switch (panelId) {
            case 'map-panel':
                if (mapMesh) {
                    scene.remove(mapMesh);
                    mapMesh = null;
                    mapTexture = null;
                }
                document.getElementById('map-file-name').textContent = 'No map uploaded';
                mapHeight = 50;
                mapWidth = 50;
                mapOffsetX = 0;
                mapOffsetZ = 0;
                break;
                
            case 'upload-panel':
                currentData = null;
                window.currentData = currentData;
                document.getElementById('file-name').textContent = '';
                document.getElementById('upload-success-section').style.display = 'none';
                document.getElementById('upload-area').style.display = 'block';
                document.getElementById('upload-confirm-section').style.display = 'none';
                document.getElementById('upload-countdown').style.display = 'none';
                document.getElementById('ies-preview-section').style.display = 'none';
                document.getElementById('current-file-info').querySelector('span').textContent = '';
                const infoPanel = document.getElementById('info-panel');
                if (infoPanel) {
                    infoPanel.style.display = 'none';
                }
                if (currentGroup) {
                    scene.remove(currentGroup);
                    currentGroup = null;
                }
                nominalLumen = 80;
                break;
                
            case 'lighting-panel':
                lampPower = 60;
                window.lampPower = lampPower;
                lightRotation = Math.PI / 2;
                currentColorTemp = 'warm';
                window.currentColorTemp = currentColorTemp;
                document.getElementById('wattage-input').value = 60;
                document.getElementById('wattage-slider').value = 60;
                document.getElementById('rotation-input').value = 90;
                document.getElementById('rotation-slider').value = 90;
                document.querySelectorAll('.btn-temp').forEach(btn => btn.classList.remove('active'));
                document.querySelector('[data-temp="warm"]').classList.add('active');
                if (currentData) {
                    create3DVisualization(currentData);
                }
                break;
                
            case 'illuminance-panel':
                illuminanceUnit = 'fc';
                window.illuminanceUnit = illuminanceUnit;
                showIlluminance = true;
                gridResolution = 15;
                window.gridResolution = gridResolution;
                document.getElementById('illuminance-unit').value = 'fc';
                document.getElementById('show-illuminance').checked = true;
                document.getElementById('grid-resolution').value = 'medium';
                if (illuminanceMesh) {
                    scene.remove(illuminanceMesh);
                    illuminanceMesh = null;
                }
                contourLines.forEach(line => scene.remove(line));
                contourLines = [];
                contourLabels.forEach(label => scene.remove(label));
                contourLabels = [];
                document.getElementById('max-illuminance').textContent = '-';
                document.getElementById('min-illuminance').textContent = '-';
                document.getElementById('avg-illuminance').textContent = '-';
                break;
                
            case 'tool-panel':
                movePoleMode = false;
                const btn = document.getElementById('move-pole-btn');
                if (btn) {
                    btn.textContent = '🔄 Move Pole';
                    btn.style.backgroundColor = '';
                    btn.style.color = '';
                }
                document.getElementById('move-pole-status').style.display = 'none';
                document.body.style.cursor = 'default';
                controls.enabled = true;
                break;
        }

        panelStates[panelId] = false;
        savePanelStates();
        updatePanelLabel(panelId);
        
        const type = panelToType[panelId];
        if (type) {
            removeTopInfo(type);
        }
        
        render();
    });
}

function resetAllPanels() {
    showCustomConfirm('Reset all data? This will clear all uploaded files and settings.', (confirmed) => {
        if (!confirmed) {
            return;
        }

        Object.keys(panelStates).forEach(panelId => {
            resetPanelDirect(panelId);
        });

        Object.keys(panelStates).forEach(panelId => {
            panelStates[panelId] = false;
        });
        savePanelStates();
        updateAllPanelLabels();

        Object.keys(topInfoItems).forEach(key => {
            topInfoItems[key] = null;
        });
        const infoBar = document.getElementById('top-info-bar');
        if (infoBar) {
            infoBar.style.display = 'none';
        }
        updateLabelsFromTopInfo();

        const infoPanel = document.getElementById('info-panel');
        if (infoPanel) {
            infoPanel.style.display = 'none';
        }

        const illuminanceInfoPanel = document.getElementById('illuminance-info-panel');
        if (illuminanceInfoPanel) {
            illuminanceInfoPanel.style.display = 'none';
        }

        const reportContainer = document.getElementById('generate-report-container');
        if (reportContainer) {
            reportContainer.style.display = 'none';
        }

        render();
    });
}

function resetPanelDirect(panelId) {
    const panelToType = {
        'map-panel': 'map',
        'upload-panel': 'ies',
        'lighting-panel': 'lighting',
        'illuminance-panel': 'illuminance'
    };

    switch (panelId) {
        case 'map-panel':
            if (mapMesh) {
                scene.remove(mapMesh);
                mapMesh = null;
                mapTexture = null;
            }
            document.getElementById('map-file-name').textContent = 'No map uploaded';
            mapHeight = 50;
            mapWidth = 50;
            mapOffsetX = 0;
            mapOffsetZ = 0;
            break;
            
        case 'upload-panel':
            currentData = null;
            window.currentData = currentData;
            document.getElementById('file-name').textContent = '';
            document.getElementById('upload-success-section').style.display = 'none';
            document.getElementById('upload-area').style.display = 'block';
            document.getElementById('upload-confirm-section').style.display = 'none';
            document.getElementById('upload-countdown').style.display = 'none';
            document.getElementById('ies-preview-section').style.display = 'none';
            document.getElementById('current-file-info').querySelector('span').textContent = '';
            const infoPanel = document.getElementById('info-panel');
            if (infoPanel) {
                infoPanel.style.display = 'none';
            }
            if (currentGroup) {
                scene.remove(currentGroup);
                currentGroup = null;
            }
            nominalLumen = 80;
            break;
            
        case 'lighting-panel':
            lampPower = 60;
            window.lampPower = lampPower;
            lightRotation = Math.PI / 2;
            currentColorTemp = 'warm';
            window.currentColorTemp = currentColorTemp;
            document.getElementById('wattage-input').value = 60;
            document.getElementById('wattage-slider').value = 60;
            document.getElementById('rotation-input').value = 90;
            document.getElementById('rotation-slider').value = 90;
            document.querySelectorAll('.btn-temp').forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-temp="warm"]').classList.add('active');
            if (currentData) {
                create3DVisualization(currentData);
            }
            break;
            
        case 'illuminance-panel':
            illuminanceUnit = 'fc';
            showIlluminance = true;
            gridResolution = 15;
            document.getElementById('illuminance-unit').value = 'fc';
            document.getElementById('show-illuminance').checked = true;
            document.getElementById('grid-resolution').value = 'medium';
            if (illuminanceMesh) {
                scene.remove(illuminanceMesh);
                illuminanceMesh = null;
            }
            contourLines.forEach(line => scene.remove(line));
            contourLines = [];
            contourLabels.forEach(label => scene.remove(label));
            contourLabels = [];
            document.getElementById('max-illuminance').textContent = '-';
            document.getElementById('min-illuminance').textContent = '-';
            document.getElementById('avg-illuminance').textContent = '-';
            break;
            
        case 'tool-panel':
            movePoleMode = false;
            const btn = document.getElementById('move-pole-btn');
            if (btn) {
                btn.textContent = '🔄 Move Pole';
                btn.style.backgroundColor = '';
                btn.style.color = '';
            }
            document.getElementById('move-pole-status').style.display = 'none';
            document.body.style.cursor = 'default';
            controls.enabled = true;
            break;
    }

    const type = panelToType[panelId];
    if (type) {
        topInfoItems[type] = null;
    }
}

let customConfirmCallback = null;

function showCustomConfirm(message, callback) {
    const overlay = document.getElementById('custom-confirm-overlay');
    const messageElement = document.querySelector('.custom-confirm-message');
    
    if (overlay && messageElement) {
        messageElement.textContent = message;
        customConfirmCallback = callback;
        overlay.classList.add('show');
    }
}

function initConfirmDialogListeners() {
    const confirmBtn = document.getElementById('custom-confirm-confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const overlay = document.getElementById('custom-confirm-overlay');
            if (overlay) {
                overlay.classList.remove('show');
                if (customConfirmCallback) {
                    customConfirmCallback(true);
                    customConfirmCallback = null;
                }
            }
        });
    }

    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const overlay = document.getElementById('custom-confirm-overlay');
            if (overlay) {
                overlay.classList.remove('show');
                if (customConfirmCallback) {
                    customConfirmCallback(false);
                    customConfirmCallback = null;
                }
            }
        });
    }
}

function getSafeAreaBottom() {
    const cssVar = parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom'), 10);
    return Number.isFinite(cssVar) ? cssVar : 0;
}

function showAboutModal() {
    console.log('[About Modal] showAboutModal called');
    const modal = document.getElementById('about-modal');
    console.log('[About Modal] modal element:', modal);
    if (modal) {
        modal.classList.add('active');
        console.log('[About Modal] modal shown');
        modal.addEventListener('click', handleModalOverlayClick);
    } else {
        console.error('[About Modal] modal element not found');
    }
}

function closeAboutModal() {
    console.log('[About Modal] closeAboutModal called');
    const modal = document.getElementById('about-modal');
    if (modal) {
        modal.classList.remove('active');
        console.log('[About Modal] modal hidden');
        modal.removeEventListener('click', handleModalOverlayClick);
    }
}

function handleModalOverlayClick(event) {
    if (event.target === event.currentTarget) {
        console.log('[About Modal] Clicked outside content area');
        closeAboutModal();
    }
}

function getNavBarHeight() {
    const cssVar = parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--nav-height'), 10);
    if (Number.isFinite(cssVar) && cssVar > 0) {
        return cssVar;
    }
    const nav = document.getElementById('mobile-nav');
    return nav ? nav.getBoundingClientRect().height : 60;
}

function syncAppLayout() {
    let bottomInset = 0;
    let topInset = 0;
    if (typeof plus !== 'undefined' && plus.navigator && plus.navigator.getSafeAreaInsets) {
        const insets = plus.navigator.getSafeAreaInsets();
        bottomInset = insets.bottom || 0;
        topInset = insets.top || 0;
    } else if (window.CSS && CSS.supports('padding-bottom: env(safe-area-inset-bottom)')) {
        const probeBottom = document.createElement('div');
        probeBottom.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom);';
        document.body.appendChild(probeBottom);
        bottomInset = parseInt(window.getComputedStyle(probeBottom).paddingBottom, 10) || 0;
        document.body.removeChild(probeBottom);
        
        const probeTop = document.createElement('div');
        probeTop.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);';
        document.body.appendChild(probeTop);
        topInset = parseInt(window.getComputedStyle(probeTop).paddingTop, 10) || 0;
        document.body.removeChild(probeTop);
    }

    bottomInset = Math.min(bottomInset, 20);
    topInset = Math.min(topInset, 50);

    document.documentElement.style.setProperty('--safe-area-inset-bottom', `${bottomInset}px`);
    document.documentElement.style.setProperty('--safe-area-inset-top', `${topInset}px`);

    const nav = document.getElementById('mobile-nav');
    if (nav) {
        document.documentElement.style.setProperty('--nav-height', `${nav.offsetHeight}px`);
    }

    const threeContainer = document.getElementById('three-container');
    if (threeContainer && nav) {
        threeContainer.style.bottom = `${nav.offsetHeight}px`;
    }

    if (renderer && camera) {
        const { width, height } = getViewportSize();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    }
}

function getViewportSize() {
    const visualViewport = window.visualViewport;
    const windowWidth = visualViewport ? visualViewport.width : window.innerWidth;
    const windowHeight = visualViewport ? visualViewport.height : window.innerHeight;
    const navHeight = getNavBarHeight();
    return {
        width: windowWidth,
        height: Math.max(100, windowHeight - navHeight)
    };
}

function init() {
    if (typeof THREE === 'undefined') {
        console.error('THREE not loaded. Please check js/vendor/three.min.js');
        return;
    }
    if (typeof THREE.OrbitControls === 'undefined') {
        console.warn('OrbitControls not loaded. 3D scene can still display but cannot be rotated');
    }

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
        console.error('WebGL is not supported in this browser');
        document.body.innerHTML = '<div style="color:#fff; text-align:center; margin-top:50px; padding:20px;">WebGL is not supported on your device. Please use another browser or device</div>';
        return;
    }

    syncAppLayout();
    
    const { width: viewportWidth, height: viewportHeight } = getViewportSize();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1c1c);

    camera = new THREE.PerspectiveCamera(45, viewportWidth / viewportHeight, 0.1, 2000);
    camera.position.set(-11, 42, -52);

    renderer = new THREE.WebGLRenderer({
        antialias: !isIOS,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isIOS ? 2 : 1.5));
    renderer.setSize(viewportWidth, viewportHeight, false);

    const threeContainer = document.getElementById('three-container');
    if (threeContainer) {
        threeContainer.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }

    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '1';
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = !isIOS;
    if (!isIOS) {
        renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    renderer.physicallyCorrectLights = false;

    const orbitTarget = new THREE.Vector3(0, 4.75, 0);

    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;
        controls.target.copy(orbitTarget);
        controls.minDistance = 5;
        controls.maxDistance = 200;
        controls.zoomSpeed = 0.3;
        controls.enabled = true;
        controls.enableZoom = false;
        zoomTargetDistance = camera.position.distanceTo(controls.target);
        zoomCurrentDistance = zoomTargetDistance;

        renderer.domElement.addEventListener('wheel', (event) => {
            event.preventDefault();
            const minDist = controls.minDistance;
            const maxDist = controls.maxDistance;
            const zoomFactor = event.deltaY > 0 ? 1.02 : 0.98;
            zoomTargetDistance = Math.max(minDist, Math.min(maxDist, zoomTargetDistance * zoomFactor));
        }, { passive: false });
    } else {
        zoomTargetDistance = camera.position.distanceTo(orbitTarget);
        zoomCurrentDistance = zoomTargetDistance;
    }

    addHelpers();
    createStreetlight();
    syncAppLayout();
    animate();
    
    initPanelStates();
}

function initEventListeners() {
    console.log('Initializing event listeners...');

    const viewModeRadios = document.querySelectorAll('input[name="view-mode"]');
    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            viewMode = e.target.value;
            if (currentData) create3DVisualization(currentData);
        });
    });

    document.getElementById('show-pole').addEventListener('change', (e) => {
        showPole = e.target.checked;
        if (poleGroup) poleGroup.visible = showPole;
    });

    document.getElementById('show-ies').addEventListener('change', (e) => {
        showIES = e.target.checked;
        if (currentGroup) currentGroup.visible = showIES;
    });

    document.getElementById('measurement-mode').addEventListener('change', (e) => {
        measurementMode = e.target.checked;
        if (measurementMode) {
            startMeasurementMode();
        } else {
            exitMeasurementMode();
            clearMeasurement();
        }
    });

    document.getElementById('set-scale-btn').addEventListener('click', () => {
        if (measurementPoints.length === 2) {
            const distance = measurementPoints[0].distanceTo(measurementPoints[1]);
            const actualDistance = parseFloat(document.getElementById('actual-distance-m').value);
            scaleFactor = actualDistance / distance;
            document.getElementById('measurement-info').textContent = 
                `Scale: 1 unit = ${scaleFactor.toFixed(3)}m`;
            clearMeasurement();
        } else {
            alert('Please click two points in the scene to define the measurement distance');
        }
    });

    const modalDistanceM = document.getElementById('modal-actual-distance-m');
    const modalDistanceFt = document.getElementById('modal-actual-distance-ft');

    if (modalDistanceM && modalDistanceFt) {
        modalDistanceM.addEventListener('input', () => {
            const meters = parseFloat(modalDistanceM.value);
            if (!isNaN(meters)) {
                modalDistanceFt.value = (meters * 3.28084).toFixed(1);
            }
        });

        modalDistanceFt.addEventListener('input', () => {
            const feet = parseFloat(modalDistanceFt.value);
            if (!isNaN(feet)) {
                modalDistanceM.value = (feet / 3.28084).toFixed(1);
            }
        });
    }

    const distanceM = document.getElementById('actual-distance-m');
    const distanceFt = document.getElementById('actual-distance-ft');

    if (distanceM && distanceFt) {
        distanceM.addEventListener('input', () => {
            const meters = parseFloat(distanceM.value);
            if (!isNaN(meters)) {
                distanceFt.value = (meters * 3.28084).toFixed(1);
            }
        });

        distanceFt.addEventListener('input', () => {
            const feet = parseFloat(distanceFt.value);
            if (!isNaN(feet)) {
                distanceM.value = (feet / 3.28084).toFixed(1);
            }
        });
    }

    const poleHeightM = document.getElementById('pole-height-m');
    const poleHeightFt = document.getElementById('pole-height-ft');

    if (poleHeightM && poleHeightFt) {
        poleHeightM.addEventListener('input', () => {
            const meters = parseFloat(poleHeightM.value);
            if (!isNaN(meters)) {
                poleHeightFt.value = (meters * 3.28084).toFixed(1);
            }
        });

        poleHeightFt.addEventListener('input', () => {
            const feet = parseFloat(poleHeightFt.value);
            if (!isNaN(feet)) {
                poleHeightM.value = (feet / 3.28084).toFixed(1);
            }
        });
    }

    document.getElementById('upload-map-btn').addEventListener('click', () => {
        document.getElementById('map-file-input').click();
    });

    document.getElementById('map-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            loadMap(file);
        }
    });

    document.getElementById('use-default-map-btn').addEventListener('click', () => {
        try {
            console.log('[Button] Clicked Use Default Map');
            loadDefaultMap();
            setTimeout(() => {
                showCustomAlert('Default map applied!', () => {
                    if (typeof closeAllPanels === 'function') {
                        closeAllPanels();
                    }
                });
            }, 500);
        } catch (e) {
            console.error('[Button] Use Default Map error:', e);
            showCustomAlert('Failed to load default map. Please retry');
        }
    });

    function showCustomAlert(message, onCloseCallback) {
        const overlay = document.getElementById('custom-alert-overlay');
        const messageElement = document.querySelector('.custom-alert-message');
        const confirmBtn = document.getElementById('custom-alert-confirm-btn');
        
        if (overlay && messageElement && confirmBtn) {
            messageElement.textContent = message;
            
            confirmBtn.textContent = 'OK';
            
            overlay.classList.add('show');
            
            let countdown = 3;
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    overlay.classList.remove('show');
                    confirmBtn.textContent = 'OK';
                    if (typeof onCloseCallback === 'function') {
                        onCloseCallback();
                    }
                } else {
                    confirmBtn.textContent = `OK (${countdown}s)`;
                }
            }, 1000);
            
            const handleConfirmClick = () => {
                clearInterval(countdownInterval);
                overlay.classList.remove('show');
                confirmBtn.textContent = 'OK';
                confirmBtn.removeEventListener('click', handleConfirmClick);
                if (typeof onCloseCallback === 'function') {
                    onCloseCallback();
                }
            };
            
            confirmBtn.addEventListener('click', handleConfirmClick);
        }
    }

    document.getElementById('show-map').addEventListener('change', (e) => {
        showMap = e.target.checked;
        if (mapMesh) mapMesh.visible = showMap;
    });

    document.getElementById('map-opacity').addEventListener('input', (e) => {
        mapOpacity = parseFloat(e.target.value);
        if (mapMesh && mapMesh.material) {
            mapMesh.material.opacity = mapOpacity;
        }
        document.getElementById('opacity-value').textContent = Math.round(mapOpacity * 100) + '%';
    });
    
    document.getElementById('back-to-3d-btn').addEventListener('click', () => {
        backTo3DMode();
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        hideMapModal();
    });

    document.getElementById('modal-cancel-btn').addEventListener('click', () => {
        hideMapModal();
    });

    document.getElementById('modal-set-scale-btn').addEventListener('click', () => {
        if (modalMeasurementPoints.length === 2) {
            const dx = modalMeasurementPoints[1].x - modalMeasurementPoints[0].x;
            const dy = modalMeasurementPoints[1].y - modalMeasurementPoints[0].y;
            const pixelDistance = Math.sqrt(dx * dx + dy * dy);

            const actualDistance = parseFloat(document.getElementById('modal-actual-distance-m').value);

            if (isNaN(actualDistance) || actualDistance <= 0) {
                alert('Please enter a valid distance (number greater than 0)');
                return;
            }

            const metersPerPixel = actualDistance / pixelDistance;

            if (modalMapImage) {
                const actualMapWidth = modalMapImage.width * metersPerPixel;
                const actualMapHeight = modalMapImage.height * metersPerPixel;

                const confirmMessage = `Confirm scale settings:\n\nMeasured Distance: ${actualDistance.toFixed(1)} m\nMeasured Pixels: ${pixelDistance.toFixed(1)} px\nMeters per Pixel: ${metersPerPixel.toFixed(4)} m\nMap Size: ${actualMapWidth.toFixed(1)}m × ${actualMapHeight.toFixed(1)}m`;

                if (confirm(confirmMessage)) {
                    mapWidth = actualMapWidth;
                    mapHeight = actualMapHeight;

                    scaleFactor = 1.0;

                    updateMapMeshSize(actualMapWidth, actualMapHeight);

                    document.getElementById('measurement-info').textContent = 
                        `Scale: 1 unit = ${scaleFactor.toFixed(3)}m`;

                    const infoDisplay = document.getElementById('map-info-display');
                    const infoText = document.getElementById('map-info-text');
                    if (infoDisplay && infoText && modalMapImage) {
                        infoText.textContent = `📍 Map: ${modalMapImage.width}×${modalMapImage.height}px | Actual: ${mapWidth.toFixed(1)}m (W) × ${mapHeight.toFixed(1)}m (H)`;
                        infoDisplay.style.display = 'block';
                    }

                    hideMapModal();
                    
                    const movePoleContainer = document.getElementById('move-pole-container');
                    if (movePoleContainer) {
                        movePoleContainer.style.display = 'flex';
                    }
                    
                    const newPoleHeight = 5;
                    
                    updatePoleRulerHeight(newPoleHeight);
                    
                    const poleHeightInput = document.getElementById('pole-height-m');
                    const poleHeightFtInput = document.getElementById('pole-height-ft');
                    const poleHeightValue = document.getElementById('pole-height-value');
                    if (poleHeightInput) {
                        poleHeightInput.value = newPoleHeight.toFixed(1);
                    }
                    if (poleHeightFtInput) {
                        poleHeightFtInput.value = (newPoleHeight * 3.28084).toFixed(1);
                    }
                    if (poleHeightValue) {
                        poleHeightValue.textContent = newPoleHeight.toFixed(1);
                    }
                    
                    alert(`✅ Scale set successfully!\n\nMap Size: ${actualMapWidth.toFixed(1)}m × ${actualMapHeight.toFixed(1)}m\nPole Height: ${newPoleHeight.toFixed(1)}m`);
                }
            }
        } else {
            alert('Please click two points on the map to measure distance');
        }
    });

    document.getElementById('map-canvas').addEventListener('click', handleModalCanvasClick);
    
    document.getElementById('map-canvas').addEventListener('touchstart', handleModalCanvasTouchStart, { passive: false });
    document.getElementById('map-canvas').addEventListener('touchend', handleModalCanvasTouchEnd, { passive: false });

    document.getElementById('zoom-in-btn').addEventListener('click', zoomIn);
    document.getElementById('zoom-out-btn').addEventListener('click', zoomOut);
    document.getElementById('zoom-reset-btn').addEventListener('click', resetZoom);

    document.getElementById('map-canvas').addEventListener('wheel', (event) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = modalZoom * delta;

        if (newZoom >= 0.5 && newZoom <= 5) {
            modalZoom = newZoom;
            updateZoomLevel();
            drawMeasurementOnCanvas();
        }
    }, { passive: false });
    
    document.getElementById('map-canvas').addEventListener('touchmove', handleModalCanvasTouchMove, { passive: false });

    document.getElementById('map-canvas').addEventListener('mousedown', handleModalCanvasMouseDown);
    document.getElementById('map-canvas').addEventListener('mousemove', handleModalCanvasMouseMove);
    document.getElementById('map-canvas').addEventListener('mouseup', handleModalCanvasMouseUp);
    document.getElementById('map-canvas').addEventListener('mouseleave', handleModalCanvasMouseLeave);

    document.getElementById('pole-height-m').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const applySettingsBtn = document.getElementById('apply-settings-btn');
            if (applySettingsBtn) {
                applySettingsBtn.click();
            }
        }
    });

    document.getElementById('show-pole-ruler').addEventListener('change', (e) => {
        updatePoleRulerVisibility(e.target.checked);
    });

    document.getElementById('move-pole-btn').addEventListener('click', () => {
        toggleMovePoleMode();
    });

    document.getElementById('confirm-move-btn').addEventListener('click', () => {
        confirmMovePole();
    });

    document.getElementById('cancel-move-btn').addEventListener('click', () => {
        cancelMovePole();
    });

    document.getElementById('floating-confirm-btn').addEventListener('click', () => {
        confirmMovePole();
    });

    document.getElementById('floating-cancel-btn').addEventListener('click', () => {
        cancelMovePole();
    });

    document.getElementById('rotate-cw-btn').addEventListener('click', () => {
        rotateMapCW();
    });

    document.getElementById('rotate-ccw-btn').addEventListener('click', () => {
        rotateMapCCW();
    });

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mouseleave', onMouseUp);

    renderer.domElement.addEventListener('touchstart', onTouchStart);
    renderer.domElement.addEventListener('touchmove', onTouchMove);
    renderer.domElement.addEventListener('touchend', onTouchEnd);
    renderer.domElement.addEventListener('touchcancel', onTouchEnd);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && movePoleMode) {
            cancelMovePole();
        }
    });

    document.getElementById('illuminance-unit').addEventListener('change', (e) => {
        illuminanceUnit = e.target.value;
        window.illuminanceUnit = illuminanceUnit;
        updateTopInfo('illuminance', '📊', `Illuminance Analysis: Unit=${illuminanceUnit.toUpperCase()} | Grid=${getResolutionText(gridResolution)}`, '#00BCD4');
    });

    document.getElementById('show-illuminance').addEventListener('change', (e) => {
        showIlluminance = e.target.checked;
        if (illuminanceMesh) illuminanceMesh.visible = showIlluminance;
        const infoPanel = document.getElementById('illuminance-info-panel');
        if (infoPanel) {
            infoPanel.style.display = showIlluminance ? 'block' : 'none';
        }
    });

    document.getElementById('grid-resolution').addEventListener('change', (e) => {
        const res = e.target.value;
        gridResolution = res === 'low' ? 10 : (res === 'medium' ? 20 : (res === 'high' ? 30 : (res === 'ultra' ? 50 : 80)));
        window.gridResolution = gridResolution;
        updateTopInfo('illuminance', '📊', `Illuminance Analysis: Unit=${illuminanceUnit.toUpperCase()} | Grid=${getResolutionText(gridResolution)}`, '#00BCD4');
    });

    const applySettingsBtn = document.getElementById('apply-settings-btn');
    if (applySettingsBtn) {
        applySettingsBtn.addEventListener('click', function() {
            console.log('Analysis panel - Apply settings button clicked');
            
            const hasMap = topInfoItems['map'] !== null;
            const hasIES = topInfoItems['ies'] !== null;
            const hasLighting = topInfoItems['lighting'] !== null;
            
            if (!hasMap || !hasIES || !hasLighting) {
                let missingItems = [];
                if (!hasMap) missingItems.push('Map');
                if (!hasIES) missingItems.push('IES');
                if (!hasLighting) missingItems.push('Lighting');
                showCustomAlert(`Please set ${missingItems.join(', ')} first before analysis.`);
                return;
            }
            
            const input = document.getElementById('pole-height-m');
            const valueDisplay = document.getElementById('pole-height-value');
            if (input) {
                let newHeight = parseFloat(input.value);
                if (isNaN(newHeight)) {
                    newHeight = 5;
                }
                if (newHeight < 0.1) {
                    newHeight = 0.1;
                }
                if (newHeight > 100) {
                    newHeight = 100;
                }
                input.value = newHeight.toFixed(1);
                if (valueDisplay) {
                    valueDisplay.textContent = newHeight.toFixed(1);
                }
                updatePoleRulerHeight(newHeight);
            }
            
            if (currentData) {
                createIlluminanceMap(currentData);
                updateIlluminanceDisplay();
                updatePanelState('illuminance-panel', true);
                const infoPanel = document.getElementById('illuminance-info-panel');
                if (infoPanel) {
                    infoPanel.style.display = 'block';
                }
                const reportContainer = document.getElementById('generate-report-container');
                if (reportContainer) {
                    reportContainer.style.display = 'block';
                }
                showCustomAlert('Analysis settings applied!');
            } else {
                showCustomAlert('Please upload IES file first');
            }
        });
    } else {
        console.log('apply-settings-btn element not found');
    }

    renderer.domElement.addEventListener('click', onMouseClick);

    window.addEventListener('resize', onWindowResize, false);

    document.getElementById('wattage-slider').addEventListener('input', handleWattageChange);
    document.getElementById('wattage-input').addEventListener('input', handleWattageInputChange);
    document.getElementById('wattage-input').addEventListener('change', handleWattageInputChange);
    document.querySelectorAll('.btn-temp').forEach(btn => {
        btn.addEventListener('click', () => handleColorTempChange(btn.dataset.temp));
    });
    
    const customBtn = document.getElementById('custom-settings-btn');
    if (customBtn) {
        customBtn.addEventListener('click', function() {
            console.log('Custom settings button clicked');
            document.getElementById('lighting-main-options').style.display = 'none';
            document.getElementById('lighting-settings-content').style.display = 'block';
        });
    } else {
        console.log('custom-settings-btn element not found');
    }
    
    const confirmBtn = document.getElementById('confirm-lighting-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            console.log('Confirm settings button clicked');
            const colorTempText = currentColorTemp === 'warm' ? 'Warm' : (currentColorTemp === 'neutral' ? 'Neutral' : 'Cool');
            updateTopInfo('lighting', '💡', `灯光: ${lampPower}W | ${colorTempText}`, '#FF9800');
            updatePanelState('lighting-panel', true);
            setTimeout(() => {
                closeAllPanels();
                showCustomAlert('Settings applied: ' + lampPower + 'W | Color Temp: ' + colorTempText);
            }, 100);
        });
    } else {
        console.log('confirm-lighting-btn element not found');
    }
    
    const iesBtn = document.getElementById('use-ies-lumen-btn');
    if (iesBtn) {
        iesBtn.addEventListener('click', function() {
            console.log('Default IES button clicked');
            console.log('currentData:', currentData);
            console.log('currentData.lumen:', currentData ? currentData.lumen : 'undefined');
            if (currentData && currentData.lumen) {
                const defaultPower = Math.round(currentData.lumen / nominalLumen);
                lampPower = Math.max(1, Math.min(500, defaultPower));
                window.lampPower = lampPower;
                document.getElementById('wattage-input').value = lampPower;
                document.getElementById('wattage-slider').value = lampPower;
                updateTopInfo('lighting', '💡', `Light: ${lampPower}W (from IES)`, '#FF9800');
                updatePanelState('lighting-panel', true);
                setTimeout(() => {
                    closeAllPanels();
                    showCustomAlert('Default wattage set from IES file: ' + lampPower + 'W');
                }, 100);
            } else {
            }
        });
    } else {
        console.log('use-ies-lumen-btn element not found');
    }
    
    document.getElementById('confirm-rotation-btn').addEventListener('click', handleRotationInputChange);

    document.getElementById('upload-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    document.getElementById('use-default-ies-btn').addEventListener('click', () => {
        loadDefaultIES();
        showCustomAlert('Default IES applied!', () => {
            closeAllPanels();
        });
    });

    let selectedIESFile = null;
    let selectedIESData = null;
    let uploadedFileName = null;

    document.getElementById('file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        selectedIESFile = file;
        selectedIESData = null;
        document.getElementById('file-name').textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                selectedIESData = parseIES(event.target.result);
                if (typeof parseAndRenderIES === 'function') {
                    parseAndRenderIES(event.target.result, 'preview-main');
                }
                document.getElementById('ies-preview-section').style.display = 'block';
            } catch (error) {
                console.log('Preview parsing failed:', error.message);
                document.getElementById('ies-preview-section').style.display = 'none';
            }
        };
        reader.readAsText(file);
        
        document.getElementById('upload-confirm-section').style.display = 'block';
        document.getElementById('upload-btn').style.display = 'none';
        document.getElementById('use-default-ies-btn').style.display = 'none';
        document.querySelector('#upload-panel-content .panel-cancel-container').style.display = 'none';
    });

    document.getElementById('reupload-btn').addEventListener('click', () => {
        document.getElementById('upload-success-section').style.display = 'none';
        document.getElementById('upload-area').style.display = 'block';
        document.getElementById('upload-btn').style.display = 'block';
        document.getElementById('file-name').textContent = '';
        document.getElementById('file-input').value = '';
        document.getElementById('ies-preview-section').style.display = 'none';
        document.getElementById('upload-confirm-section').style.display = 'none';
        selectedIESFile = null;
        selectedIESData = null;
        uploadedFileName = null;
    });

    document.getElementById('confirm-upload-btn').addEventListener('click', () => {
        if (!selectedIESFile) return;
        
        showLoadingOverlay('Loading IES file...');
        
        document.getElementById('upload-confirm-section').style.display = 'none';
        document.getElementById('ies-preview-section').style.display = 'none';
        document.getElementById('upload-countdown').style.display = 'block';
        
        let countdown = 5;
        const timerElement = document.getElementById('countdown-timer');
        timerElement.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            timerElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                document.getElementById('loading').style.display = 'block';
                
                setTimeout(() => {
                    try {
                        if (selectedIESData) {
                            create3DVisualization(selectedIESData);
                        } else {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const data = parseIES(event.target.result);
                                create3DVisualization(data);
                            };
                            reader.readAsText(selectedIESFile);
                        }
                        
                        uploadedFileName = selectedIESFile.name;
                        
                        document.getElementById('current-file-info').querySelector('span').textContent = uploadedFileName;
                        document.getElementById('upload-area').style.display = 'none';
                        document.getElementById('upload-success-section').style.display = 'block';
                        
                        if (currentData && currentData.lumen) {
                            const defaultPower = Math.round(currentData.lumen / nominalLumen);
                            lampPower = Math.max(1, Math.min(500, defaultPower));
                            window.lampPower = lampPower;
                            document.getElementById('wattage-input').value = lampPower;
                            document.getElementById('wattage-slider').value = lampPower;
                            updatePanelState('lighting-panel', true);
                        }
                        
                        updateTopInfo('ies', '📁', uploadedFileName + ': IES', '#3aa0ff');
                        
                        updatePanelState('upload-panel', true);
                        
                        hideLoadingOverlay();
                        
                        showCustomAlert('IES file uploaded successfully!', () => {
                            closeAllPanels();
                        });
                    } catch (error) {
                        alert('Failed to parse IES file: ' + error.message);
                        hideLoadingOverlay();
                        document.getElementById('upload-countdown').style.display = 'none';
                        document.getElementById('ies-preview-section').style.display = 'block';
                        document.getElementById('upload-confirm-section').style.display = 'block';
                    } finally {
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('upload-countdown').style.display = 'none';
                    }
                }, 300);
            }
        }, 1000);
    });

    document.getElementById('cancel-upload-btn').addEventListener('click', () => {
        selectedIESFile = null;
        selectedIESData = null;
        document.getElementById('file-name').textContent = '';
        document.getElementById('upload-confirm-section').style.display = 'none';
        document.getElementById('ies-preview-section').style.display = 'none';
        document.getElementById('upload-countdown').style.display = 'none';
        document.getElementById('upload-btn').style.display = 'block';
        document.getElementById('use-default-ies-btn').style.display = 'block';
        document.querySelector('#upload-panel-content .panel-cancel-container').style.display = 'flex';
        document.getElementById('file-input').value = '';
    });

    document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.addEventListener('click', () => {
            if (navItem.dataset.panel === 'upload-panel' && uploadedFileName) {
                document.getElementById('current-file-info').querySelector('span').textContent = uploadedFileName;
                document.getElementById('upload-area').style.display = 'none';
                document.getElementById('upload-success-section').style.display = 'block';
            }
        });
    });

    const generateReportBtn = document.getElementById('generate-report-btn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }
    
    initNavListeners();
}

function initNavListeners() {
    const mobileNav = document.getElementById('mobile-nav');
    if (!mobileNav) return;
    
    let isNavProcessing = false;

    function handleNavInteraction(e) {
        if (isNavProcessing) {
            return;
        }
        
        const navItem = e.target.closest('.nav-item');
        const resetBtn = e.target.closest('.nav-reset-btn');

        if (navItem && navItem.dataset.panel) {
            e.preventDefault();
            e.stopPropagation();
            
            isNavProcessing = true;
            openPanel(navItem.dataset.panel);
            
            setTimeout(() => {
                isNavProcessing = false;
            }, 300);
            
            return;
        }

        if (resetBtn && resetBtn.dataset.panel) {
            e.preventDefault();
            e.stopPropagation();
            
            isNavProcessing = true;
            resetPanel(resetBtn.dataset.panel);
            
            setTimeout(() => {
                isNavProcessing = false;
            }, 300);
        }
    }

    mobileNav.addEventListener('click', handleNavInteraction, true);
    mobileNav.addEventListener('touchend', handleNavInteraction, { capture: true, passive: false });
    mobileNav.addEventListener('pointerup', handleNavInteraction, true);
}

function addHelpers() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(0, 50, 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    scene.add(sunLight);
 

    createPoleRuler();
}

function startMeasurementMode() {
    controls.enabled = false;
    
    if (mapMesh) {
        mapOriginalRotation.copy(mapMesh.rotation);
        mapOriginalPosition.copy(mapMesh.position);
        
        mapMesh.rotation.set(0, 0, 0);
        mapMesh.position.set(0, lightHeight * 0.5, -lightHeight);
        
        if (mapMesh.material) {
            mapMesh.material.opacity = 0.9;
        }
        
        isMeasuring2D = true;
        
        camera.position.set(0, lightHeight * 0.6, lightHeight * 1.5);
        camera.lookAt(0, lightHeight * 0.5, -lightHeight);
        
        document.getElementById('measurement-info').textContent = 
            '已切换到2D测量模式，请在地图上点击两个点';
    } else {
        document.getElementById('measurement-info').textContent = 
            '请在3D场景中点击两个点进行测量';
    }
    
    clearMeasurement();
}

function startMeasurementModeAfterUpload() {
    document.getElementById('measurement-panel').style.display = 'block';
    document.getElementById('map-panel').style.display = 'none';
    
    controls.enabled = false;
    
    mapOriginalRotation.copy(mapMesh.rotation);
    mapOriginalPosition.copy(mapMesh.position);
    
    mapMesh.rotation.set(0, 0, 0);
    mapMesh.position.set(0, lightHeight * 0.5, -lightHeight);
    
    if (mapMesh.material) {
        mapMesh.material.opacity = 0.95;
    }
    
    isMeasuring2D = true;
    measurementMode = true;
    
    camera.position.set(0, lightHeight * 2, lightHeight * 2.5);
    camera.lookAt(0, lightHeight * 0.5, -lightHeight);
    
    document.getElementById('measurement-info').textContent = 
        '请在地图上点击两个点来测量距离，然后设置比例尺';
    
    clearMeasurement();
}

function exitMeasurementMode() {
    controls.enabled = true;
    
    if (isMeasuring2D && mapMesh) {
        mapMesh.rotation.copy(mapOriginalRotation);
        mapMesh.position.copy(mapOriginalPosition);
        
        if (mapMesh.material) {
            mapMesh.material.opacity = mapOpacity;
        }
        
        isMeasuring2D = false;
        
        camera.position.set(-8, 12, -12);
        camera.lookAt(0, 4.75, 0);
    }
    
    document.getElementById('measurement-info').textContent = '';
}

function backTo3DMode() {
    document.getElementById('measurement-panel').style.display = 'none';
    document.getElementById('map-panel').style.display = 'block';
    
    exitMeasurementMode();
    measurementMode = false;
    
    clearMeasurement();
}

function onMouseClick(event) {
    if (!measurementMode) return;
    
    event.preventDefault();
    
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    let intersectPoint = null;
    
    if (isMeasuring2D && mapMesh) {
        const intersects = raycaster.intersectObject(mapMesh);
        if (intersects.length > 0) {
            intersectPoint = intersects[0].point;
        }
    } else {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectPoint);
    }

    if (intersectPoint) {
        measurementPoints.push(intersectPoint.clone());
        
        const markerGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: measurementPoints.length === 1 ? 0x00ff00 : 0xff0000 
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.copy(intersectPoint);
        marker.position.y = 0.01;
        scene.add(marker);

        if (measurementPoints.length === 2) {
            if (measurementLine) {
                scene.remove(measurementLine);
            }
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(measurementPoints);
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
            measurementLine = new THREE.Line(lineGeometry, lineMaterial);
            scene.add(measurementLine);

            const distance = measurementPoints[0].distanceTo(measurementPoints[1]);
            const actualDistance = distance * scaleFactor;
            
            document.getElementById('measurement-info').textContent = 
                `测量距离: ${distance.toFixed(2)}单位 ≈ ${actualDistance.toFixed(2)}米`;
        }
    }
}

function clearMeasurement() {
    while (measurementPoints.length > 0) {
        measurementPoints.pop();
    }
    if (measurementLine) {
        scene.remove(measurementLine);
        measurementLine = null;
    }
    scene.children = scene.children.filter(child => {
        if (child.geometry && child.geometry.type === 'SphereGeometry' && 
            child.material && child.material.color &&
            (child.material.color.getHex() === 0x00ff00 || child.material.color.getHex() === 0xff0000)) {
            return false;
        }
        return true;
    });
}

let modalMeasurementPoints = [];
let modalCanvasCtx = null;
let modalMapImage = null;
let modalZoom = 1;
let modalOffsetX = 0;
let modalOffsetY = 0;
let originalCanvasWidth = 0;
let originalCanvasHeight = 0;
let modalIsDragging = false;
let modalDragStartTime = 0;
let modalIsTapping = false;
let modalDragStartX = 0;
let modalDragStartY = 0;
let modalDragStartOffsetX = 0;
let modalDragStartOffsetY = 0;
let modalHasMoved = false;
let modalLongPressTimer = null;
let modalLongPressTriggered = false;
let modalLastTouchTime = 0;
const MODAL_LONG_PRESS_MS = 500;
const MODAL_TAP_MOVE_THRESHOLD = 12;

function getModalCanvasScreenCoords(clientX, clientY) {
    const canvas = document.getElementById('map-canvas');
    const rect = canvas.getBoundingClientRect();
    const canvasAspect = canvas.width / canvas.height;
    const rectAspect = rect.width / rect.height;

    let renderWidth, renderHeight, offsetX, offsetY;
    if (rectAspect > canvasAspect) {
        renderHeight = rect.height;
        renderWidth = rect.height * canvasAspect;
        offsetX = (rect.width - renderWidth) / 2;
        offsetY = 0;
    } else {
        renderWidth = rect.width;
        renderHeight = rect.width / canvasAspect;
        offsetX = 0;
        offsetY = (rect.height - renderHeight) / 2;
    }

    const x = (clientX - rect.left - offsetX) * (canvas.width / renderWidth);
    const y = (clientY - rect.top - offsetY) * (canvas.height / renderHeight);
    return { x, y };
}

function screenToModalMapCoords(screenX, screenY) {
    const canvas = document.getElementById('map-canvas');
    const w = canvas.width;
    const h = canvas.height;
    const x = (screenX - w / 2) / modalZoom - modalOffsetX + w / 2;
    const y = (screenY - h / 2) / modalZoom - modalOffsetY + h / 2;
    return {
        x: Math.max(0, Math.min(w, x)),
        y: Math.max(0, Math.min(h, y))
    };
}

function clearModalLongPressTimer() {
    if (modalLongPressTimer) {
        clearTimeout(modalLongPressTimer);
        modalLongPressTimer = null;
    }
}

function addModalMeasurementPoint(clientX, clientY) {
    const screen = getModalCanvasScreenCoords(clientX, clientY);
    const point = screenToModalMapCoords(screen.x, screen.y);

    if (modalMeasurementPoints.length < 2) {
        modalMeasurementPoints.push(point);
    } else {
        modalMeasurementPoints = [point];
    }
    drawMeasurementOnCanvas();
}

function loadMap(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            if (mapTexture) {
                mapTexture.dispose();
            }
            mapTexture = new THREE.CanvasTexture(img);
            mapTexture.wrapS = THREE.ClampToEdgeWrapping;
            mapTexture.wrapT = THREE.ClampToEdgeWrapping;
            
            if (mapWidth === 0) {
                mapWidth = 50;
            }
            if (mapHeight === 0) {
                mapHeight = 50;
            }
            
            updateMapMesh(img);
            
            document.getElementById('map-file-name').textContent = file.name;
            updateMapInfo(img.width, img.height);
            
            modalMapImage = img;
            
            updatePanelState('map-panel', true);
            
            updateTopInfo('map', '🗺️', file.name + ': Map', '#4CAF50');
            
            setTimeout(() => {
                showMapModal();
            }, 500);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function layoutAndDrawMapModalCanvas() {
    if (!modalMapImage) return;

    const canvas = document.getElementById('map-canvas');
    modalCanvasCtx = canvas.getContext('2d');

    const container = document.getElementById('map-canvas-container');
    const modalBody = canvas.closest('.modal-body');
    let containerWidth = container ? container.clientWidth : 0;

    if (!containerWidth && modalBody) {
        containerWidth = modalBody.clientWidth;
    }
    if (!containerWidth) {
        containerWidth = Math.min(window.innerWidth - 40, 560);
    }

    const maxHeight = Math.min(window.innerHeight * 0.45, 360);
    let width = modalMapImage.width;
    let height = modalMapImage.height;

    let scale = Math.min(containerWidth / width, maxHeight / height);
    if (!isFinite(scale) || scale <= 0) {
        scale = 1;
    }

    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.style.display = 'block';

    originalCanvasWidth = width;
    originalCanvasHeight = height;

    modalCanvasCtx.fillStyle = '#000';
    modalCanvasCtx.fillRect(0, 0, width, height);
    modalCanvasCtx.drawImage(modalMapImage, 0, 0, width, height);
}

function showMapModal() {
    if (!modalMapImage) return;

    const modal = document.getElementById('map-modal');
    modal.classList.add('show');

    modalZoom = 1;
    modalOffsetX = 0;
    modalOffsetY = 0;
    updateZoomLevel();

    modalMeasurementPoints = [];
    document.getElementById('modal-measurement-info').textContent = '';

    const drawWhenReady = () => {
        layoutAndDrawMapModalCanvas();
        const canvas = document.getElementById('map-canvas');
        if (canvas && canvas.width <= 1) {
            setTimeout(layoutAndDrawMapModalCanvas, 100);
        }
    };

    requestAnimationFrame(() => {
        requestAnimationFrame(drawWhenReady);
    });
}

function updateZoomLevel() {
    document.getElementById('zoom-level').textContent = Math.round(modalZoom * 100) + '%';
}

function zoomIn() {
    if (modalZoom < 5) {
        modalZoom *= 1.2;
        updateZoomLevel();
        drawMeasurementOnCanvas();
    }
}

function zoomOut() {
    if (modalZoom > 0.5) {
        modalZoom /= 1.2;
        updateZoomLevel();
        drawMeasurementOnCanvas();
    }
}

function resetZoom() {
    modalZoom = 1;
    modalOffsetX = 0;
    modalOffsetY = 0;
    updateZoomLevel();
    drawMeasurementOnCanvas();
}

function handleModalCanvasMouseDown(event) {
    if (modalZoom <= 1) return;
    
    modalIsDragging = true;
    modalDragStartX = event.clientX;
    modalDragStartY = event.clientY;
    modalDragStartOffsetX = modalOffsetX;
    modalDragStartOffsetY = modalOffsetY;
    
    event.target.style.cursor = 'grabbing';
}

function handleModalCanvasMouseMove(event) {
    if (!modalIsDragging) return;
    
    const deltaX = (event.clientX - modalDragStartX) / modalZoom;
    const deltaY = (event.clientY - modalDragStartY) / modalZoom;
    
    modalOffsetX = modalDragStartOffsetX + deltaX;
    modalOffsetY = modalDragStartOffsetY + deltaY;
    
    const canvas = document.getElementById('map-canvas');
    const maxOffsetX = (canvas.width * (modalZoom - 1)) / 2;
    const maxOffsetY = (canvas.height * (modalZoom - 1)) / 2;
    
    modalOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, modalOffsetX));
    modalOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, modalOffsetY));
    
    drawMeasurementOnCanvas();
}

function handleModalCanvasMouseUp(event) {
    if (modalIsDragging) {
        modalIsDragging = false;
        event.target.style.cursor = modalZoom > 1 ? 'grab' : 'default';
    }
}

function handleModalCanvasMouseLeave(event) {
    handleModalCanvasMouseUp(event);
}

let modalInitialPinchDistance = 0;
let modalInitialZoom = 1;

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleModalCanvasTouchStart(event) {
    const touches = event.touches;
    
    if (touches.length === 1) {
        event.preventDefault();
        const touch = touches[0];
        modalDragStartX = touch.clientX;
        modalDragStartY = touch.clientY;
        modalDragStartTime = Date.now();
        modalIsTapping = true;
        modalHasMoved = false;
        modalLongPressTriggered = false;
        clearModalLongPressTimer();

        const startX = touch.clientX;
        const startY = touch.clientY;
        modalLongPressTimer = setTimeout(() => {
            if (!modalHasMoved && modalIsTapping) {
                modalLongPressTriggered = true;
                modalIsTapping = false;
                addModalMeasurementPoint(startX, startY);
                if (navigator.vibrate) {
                    navigator.vibrate(30);
                }
            }
        }, MODAL_LONG_PRESS_MS);
    } else if (touches.length === 2) {
        event.preventDefault();
        clearModalLongPressTimer();
        modalIsTapping = false;
        modalInitialPinchDistance = getTouchDistance(touches);
        modalInitialZoom = modalZoom;
    }
}

function handleModalCanvasTouchMove(event) {
    const touches = event.touches;

    if (touches.length === 1 && modalIsTapping) {
        const touch = touches[0];
        const deltaX = Math.abs(touch.clientX - modalDragStartX);
        const deltaY = Math.abs(touch.clientY - modalDragStartY);
        if (deltaX > MODAL_TAP_MOVE_THRESHOLD || deltaY > MODAL_TAP_MOVE_THRESHOLD) {
            modalHasMoved = true;
            clearModalLongPressTimer();
        }
    }
    
    if (touches.length === 2) {
        event.preventDefault();
        const currentDistance = getTouchDistance(touches);
        const scale = currentDistance / modalInitialPinchDistance;
        let newZoom = modalInitialZoom * scale;
        
        newZoom = Math.max(0.5, Math.min(5, newZoom));
        
        modalZoom = newZoom;
        updateZoomLevel();
        drawMeasurementOnCanvas();
    } else if (touches.length === 1 && modalZoom > 1) {
        event.preventDefault();
        const deltaX = touches[0].clientX - modalDragStartX;
        const deltaY = touches[0].clientY - modalDragStartY;
        
        modalOffsetX += deltaX / modalZoom;
        modalOffsetY += deltaY / modalZoom;
        
        const canvas = document.getElementById('map-canvas');
        const maxOffsetX = (canvas.width * (modalZoom - 1)) / 2;
        const maxOffsetY = (canvas.height * (modalZoom - 1)) / 2;
        
        modalOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, modalOffsetX));
        modalOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, modalOffsetY));
        
        modalDragStartX = touches[0].clientX;
        modalDragStartY = touches[0].clientY;
        
        drawMeasurementOnCanvas();
    }
}

function handleModalCanvasTouchEnd(event) {
    clearModalLongPressTimer();
    const touches = event.changedTouches;

    if (modalLongPressTriggered) {
        event.preventDefault();
        modalLastTouchTime = Date.now();
        modalIsTapping = false;
        modalLongPressTriggered = false;
        return;
    }
    
    if (touches.length === 1 && modalIsTapping && !modalHasMoved) {
        const touch = touches[0];
        const deltaX = Math.abs(touch.clientX - modalDragStartX);
        const deltaY = Math.abs(touch.clientY - modalDragStartY);
        const deltaTime = Date.now() - modalDragStartTime;
        
        if (deltaX < MODAL_TAP_MOVE_THRESHOLD && deltaY < MODAL_TAP_MOVE_THRESHOLD && deltaTime < MODAL_LONG_PRESS_MS) {
            event.preventDefault();
            addModalMeasurementPoint(touch.clientX, touch.clientY);
            modalLastTouchTime = Date.now();
        }
    }
    
    modalIsTapping = false;
}

function hideMapModal() {
    const modal = document.getElementById('map-modal');
    modal.classList.remove('show');
    modalMeasurementPoints = [];
    
    if (modalCanvasCtx) {
        const canvas = document.getElementById('map-canvas');
        modalCanvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    const fileInput = document.getElementById('map-file-input');
    if (fileInput) {
        fileInput.value = '';
    }
}

function drawMeasurementOnCanvas() {
    if (!modalCanvasCtx || !modalMapImage) return;
    
    const canvas = document.getElementById('map-canvas');
    
    canvas.style.cursor = modalZoom > 1 ? 'grab' : 'default';
    
    modalCanvasCtx.fillStyle = '#000';
    modalCanvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    modalCanvasCtx.save();
    
    modalCanvasCtx.translate(canvas.width / 2, canvas.height / 2);
    modalCanvasCtx.scale(modalZoom, modalZoom);
    modalCanvasCtx.translate(modalOffsetX, modalOffsetY);
    
    const mapX = -canvas.width / 2;
    const mapY = -canvas.height / 2;
    
    modalCanvasCtx.drawImage(modalMapImage, mapX, mapY, canvas.width, canvas.height);
    
    const pointRadius = 6 / modalZoom;
    modalMeasurementPoints.forEach((point, index) => {
        const px = point.x - canvas.width / 2;
        const py = point.y - canvas.height / 2;
        
        modalCanvasCtx.beginPath();
        modalCanvasCtx.arc(px, py, pointRadius, 0, Math.PI * 2);
        modalCanvasCtx.fillStyle = index === 0 ? '#00ff00' : '#ff0000';
        modalCanvasCtx.fill();
        modalCanvasCtx.strokeStyle = '#fff';
        modalCanvasCtx.lineWidth = 2 / modalZoom;
        modalCanvasCtx.stroke();
    });
    
    if (modalMeasurementPoints.length === 2) {
        const p1x = modalMeasurementPoints[0].x - canvas.width / 2;
        const p1y = modalMeasurementPoints[0].y - canvas.height / 2;
        const p2x = modalMeasurementPoints[1].x - canvas.width / 2;
        const p2y = modalMeasurementPoints[1].y - canvas.height / 2;
        
        modalCanvasCtx.beginPath();
        modalCanvasCtx.moveTo(p1x, p1y);
        modalCanvasCtx.lineTo(p2x, p2y);
        modalCanvasCtx.strokeStyle = '#00ffff';
        modalCanvasCtx.lineWidth = 2 / modalZoom;
        modalCanvasCtx.stroke();
        
        const dx = modalMeasurementPoints[1].x - modalMeasurementPoints[0].x;
        const dy = modalMeasurementPoints[1].y - modalMeasurementPoints[0].y;
        const pixelDistance = Math.sqrt(dx * dx + dy * dy);
        
        document.getElementById('modal-measurement-info').textContent = 
            `测量距离: ${pixelDistance.toFixed(1)} 像素 (缩放: ${Math.round(modalZoom * 100)}%)`;
    }
    
    modalCanvasCtx.restore();
}

function handleModalCanvasClick(event) {
    if (Date.now() - modalLastTouchTime < 500) {
        return;
    }
    addModalMeasurementPoint(event.clientX, event.clientY);
}

function updateMapMesh(img) {
    if (mapMesh) {
        scene.remove(mapMesh);
    }
    
    const aspect = img.width / img.height;
    let width = mapWidth;
    
    let height = width / aspect;
    mapHeight = height;
    
    const mapMaterial = new THREE.MeshBasicMaterial({
        map: mapTexture,
        transparent: true,
        opacity: mapOpacity,
        side: THREE.DoubleSide
    });
    mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mapMaterial);
    mapMesh.rotation.x = -Math.PI / 2;
    mapMesh.position.y = 0.02;
    mapMesh.visible = showMap;
    scene.add(mapMesh);
}

function updateMapInfo(imgWidth, imgHeight) {
    const infoDisplay = document.getElementById('map-info-display');
    const infoText = document.getElementById('map-info-text');
    
    if (infoDisplay && infoText) {
        infoText.textContent = `📍 Map: ${imgWidth}×${imgHeight}px | Actual: ${mapWidth.toFixed(1)}m (W) × ${mapHeight.toFixed(1)}m (H)`;
        infoDisplay.style.display = 'block';
    }
    
    const fileName = document.getElementById('map-file-name');
    if (fileName) {
        fileName.textContent = `Map uploaded (${imgWidth}×${imgHeight}px)`;
    }
}

function updateMapMeshSize(newWidth, newHeight) {
    if (!mapMesh || !mapTexture) return;
    
    mapWidth = newWidth;
    mapHeight = newHeight;
    
    scene.remove(mapMesh);
    
    const aspect = modalMapImage ? (modalMapImage.width / modalMapImage.height) : 1;
    let width = newWidth;
    let height = newHeight;
    
    if (width / height > aspect) {
        width = height * aspect;
    } else {
        height = width / aspect;
    }
    
    const mapMaterial = new THREE.MeshBasicMaterial({
        map: mapTexture,
        transparent: true,
        opacity: mapOpacity,
        side: THREE.DoubleSide
    });
    
    mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mapMaterial);
    mapMesh.rotation.x = -Math.PI / 2;
    mapMesh.position.set(mapOffsetX, 0.02, mapOffsetZ);
    mapMesh.visible = showMap;
    scene.add(mapMesh);
    
    updateMapInfo(modalMapImage.width, modalMapImage.height);
}

function loadDefaultMap() {
    if (typeof THREE === 'undefined') {
        console.error('THREE.js not loaded');
        showCustomAlert('System initializing, please try again later');
        return;
    }
    if (typeof scene === 'undefined') {
        console.error('scene is undefined');
        showCustomAlert('Scene not initialized. Please refresh the page');
        return;
    }
    
    console.log('[Map] loadDefaultMap called, scene:', !!scene);
    
    const possiblePaths = [];
    
    if (window.DEFAULT_MAP_BASE64) {
        possiblePaths.push(window.DEFAULT_MAP_BASE64);
        console.log('[Map] Using base64 data URI');
    }
    
    possiblePaths.push('img/0-3d-simulation-chatgpt.png');
    possiblePaths.push('./img/0-3d-simulation-chatgpt.png');
    possiblePaths.push('/img/0-3d-simulation-chatgpt.png');
    possiblePaths.push('_www/img/0-3d-simulation-chatgpt.png');
    
    try {
        if (window.location.href && window.location.href.includes('index.html')) {
            possiblePaths.push(window.location.href.replace('index.html', 'img/0-3d-simulation-chatgpt.png'));
        }
    } catch (e) {
        console.warn('[Map] Failed to build URL path:', e);
    }
    
    possiblePaths.push('__UNI__img/0-3d-simulation-chatgpt.png');
    possiblePaths.push('./__UNI__img/0-3d-simulation-chatgpt.png');
    
    possiblePaths.push('./www/img/0-3d-simulation-chatgpt.png');
    possiblePaths.push('www/img/0-3d-simulation-chatgpt.png');
    
    console.log('[Map] Trying path list:', possiblePaths);
    
    let currentPathIndex = 0;
    
    const tryLoadPath = () => {
        if (currentPathIndex >= possiblePaths.length) {
            console.error('All path attempts failed, cannot load default map');
            showCustomAlert('Failed to load default map. Please try uploading a custom map');
            return;
        }
        
        const defaultMapPath = possiblePaths[currentPathIndex];
        currentPathIndex++;
        
        console.log('[Map] Trying to load map:', defaultMapPath);
        
        const img = new Image();
        
        img.onload = () => {
            console.log('[Map] Successfully loaded default map:', defaultMapPath);
            
            if (mapTexture) {
                try {
                    mapTexture.dispose();
                } catch (e) {
                    console.warn('[Map] Failed to release old texture:', e);
                }
            }
            
            try {
                mapTexture = new THREE.CanvasTexture(img);
                mapTexture.wrapS = THREE.ClampToEdgeWrapping;
                mapTexture.wrapT = THREE.ClampToEdgeWrapping;
            } catch (e) {
                console.error('[Map] Failed to create texture:', e);
                showCustomAlert('Failed to create map texture');
                return;
            }
            
            if (mapMesh) {
                try {
                    scene.remove(mapMesh);
                } catch (e) {
                    console.warn('[Map] Failed to remove old grid:', e);
                }
            }
            
            const aspect = img.width / img.height;
            let width = 500;
            let height = 500;
            if (aspect > 1) {
                height = 500 / aspect;
            } else {
                width = 500 * aspect;
            }
            
            try {
                const mapMaterial = new THREE.MeshBasicMaterial({
                    map: mapTexture,
                    transparent: true,
                    opacity: typeof mapOpacity !== 'undefined' ? mapOpacity : 0.8,
                    side: THREE.DoubleSide
                });
                mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mapMaterial);
                mapMesh.rotation.x = -Math.PI / 2;
                mapMesh.position.y = 0.02;
                mapMesh.visible = typeof showMap !== 'undefined' ? showMap : true;
                scene.add(mapMesh);
                
                mapWidth = width;
                mapHeight = height;
                
                scaleFactor = 0.2;
                window.scaleFactor = scaleFactor;
                
                const defaultPoleHeight = 5;
                
                updatePoleRulerHeight(defaultPoleHeight);
                
                const defaultPoleHeightInput = document.getElementById('pole-height-m');
                const defaultPoleHeightFtInput = document.getElementById('pole-height-ft');
                const defaultPoleHeightValue = document.getElementById('pole-height-value');
                if (defaultPoleHeightInput) {
                    defaultPoleHeightInput.value = defaultPoleHeight.toFixed(1);
                }
                if (defaultPoleHeightFtInput) {
                    defaultPoleHeightFtInput.value = (defaultPoleHeight * 3.28084).toFixed(1);
                }
                if (defaultPoleHeightValue) {
                    defaultPoleHeightValue.textContent = defaultPoleHeight.toFixed(1);
                }
                
                document.getElementById('map-file-name').textContent = '0-3d-simulation-chatgpt.png';
                
                if (typeof updatePanelState === 'function') {
                    updatePanelState('map-panel', true);
                }
                
                if (typeof updateTopInfo === 'function') {
                    updateTopInfo('map', '🗺️', 'Default Map: Map', '#4CAF50');
                }
                
                const infoDisplay = document.getElementById('map-info-display');
                const infoText = document.getElementById('map-info-text');
                if (infoDisplay && infoText && img) {
                    infoText.textContent = `📍 Map: ${img.width}×${img.height}px | Actual: ${mapWidth.toFixed(1)}m (W) × ${mapHeight.toFixed(1)}m (H)`;
                    infoDisplay.style.display = 'block';
                }
                
                console.log('[Map] Default map loaded with scale 1 unit = 1m');
                
                scaleFactor = 1.0;
                window.scaleFactor = scaleFactor;
                
                const measurementInfo = document.getElementById('measurement-info');
                if (measurementInfo) {
                    measurementInfo.textContent = `Scale: 1 unit = ${scaleFactor.toFixed(3)}m`;
                }
                
                if (poleGroup) {
                    scene.remove(poleGroup);
                    poleGroup = null;
                }
                createStreetlight();
                
                if (poleRulerGroup) {
                    updatePoleRulerHeight(poleHeight);
                }
                
                if (currentData) {
                    create3DVisualization(currentData);
                }
                
                const movePoleContainer = document.getElementById('move-pole-container');
                if (movePoleContainer) {
                    movePoleContainer.style.display = 'flex';
                }
                
                createScaleReferenceLine();
                
            } catch (e) {
                console.error('[Map] Failed to create map grid:', e);
                showCustomAlert('Failed to create map');
            }
        };
        
        img.onerror = () => {
            console.warn('[Map] Path loading failed, trying next:', defaultMapPath);
            tryLoadPath();
        };
        
        setTimeout(() => {
            if (!img.complete) {
                console.warn('[Map] Loading timeout, trying next:', defaultMapPath);
                img.src = '';
                tryLoadPath();
            }
        }, 3000);
        
        img.src = defaultMapPath;
    };
    
    tryLoadPath();
}

function createScaleReferenceLine() {
    if (scaleReferenceLine) {
        scene.remove(scaleReferenceLine);
        scaleReferenceLine.geometry.dispose();
        scaleReferenceLine.material.dispose();
        scaleReferenceLine = null;
    }
    if (scaleReferenceLabel) {
        scene.remove(scaleReferenceLabel);
        scaleReferenceLabel = null;
    }
    
    const lineLength = 50 / 3.28084;
    const linePoints = [
        new THREE.Vector3(-lineLength / 2, 0.03, 0),
        new THREE.Vector3(lineLength / 2, 0.03, 0)
    ];
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ff00, 
        linewidth: 2 
    });
    scaleReferenceLine = new THREE.Line(lineGeometry, lineMaterial);
    
    if (mapMesh) {
        const mapBounds = new THREE.Box3().setFromObject(mapMesh);
        const centerX = (mapBounds.min.x + mapBounds.max.x) / 2;
        const centerZ = (mapBounds.min.z + mapBounds.max.z) / 2;
        scaleReferenceLine.position.set(centerX + mapWidth/4 - lineLength/2, 0, centerZ + mapHeight/4);
    } else {
        scaleReferenceLine.position.set(20 - lineLength/2, 0, 20);
    }
    
    scene.add(scaleReferenceLine);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(10, 10, 236, 44, 8);
    ctx.fill();
    
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.textAlign = 'center';
    ctx.fillText('50ft Reference', canvas.width / 2, 42);
    
    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ 
        map: labelTexture, 
        transparent: true 
    });
    scaleReferenceLabel = new THREE.Sprite(labelMaterial);
    scaleReferenceLabel.scale.set(6, 1.5, 1);
    
    scaleReferenceLabel.position.copy(scaleReferenceLine.position);
    scaleReferenceLabel.position.y = 1;
    
    scene.add(scaleReferenceLabel);
    
    console.log('[Scale Reference] Created 10m reference line');
}

let scaleReferenceLine = null;
let scaleReferenceLabel = null;

function createPoleRuler() {
    poleRulerGroup = new THREE.Group();
    
    const scaledHeight = poleHeight * scaleFactor * 5;
    
    const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, scaledHeight, 0)
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
        color: 0xffff00,
        dashSize: 0.3 * scaleFactor * 5,
        gapSize: 0.15 * scaleFactor * 5,
        linewidth: 2
    });
    
    poleRulerLine = new THREE.Line(geometry, material);
    poleRulerLine.computeLineDistances();
    poleRulerGroup.add(poleRulerLine);
    
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 200;
    labelCanvas.height = 60;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 200, 60);
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(poleHeight.toFixed(1) + ' meter', 100, 30);
    
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMaterial = new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true
    });
    
    poleRulerLabel = new THREE.Sprite(labelMaterial);
    poleRulerLabel.scale.set(2 * scaleFactor * 5, 0.6 * scaleFactor * 5, 1);
    poleRulerLabel.position.set(0.8 * scaleFactor * 5, scaledHeight / 2, 0);
    poleRulerGroup.add(poleRulerLabel);
    
    const endCapGeometry = new THREE.SphereGeometry(0.08 * scaleFactor * 5, 16, 16);
    const endCapMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const topCap = new THREE.Mesh(endCapGeometry, endCapMaterial);
    topCap.position.set(0, scaledHeight, 0);
    poleRulerGroup.add(topCap);
    
    const bottomCap = new THREE.Mesh(endCapGeometry, endCapMaterial.clone());
    bottomCap.material.color.setHex(0xff8800);
    bottomCap.position.set(0, 0, 0);
    poleRulerGroup.add(bottomCap);
    
    poleRulerGroup.position.copy(poleRulerOffset);
    poleRulerGroup.visible = showPoleRuler;
    scene.add(poleRulerGroup);
}

function updatePoleRulerHeight(newHeight) {
    poleHeight = newHeight;
    lightHeight = newHeight;
    window.lightHeight = lightHeight;
    
    const scaledHeight = poleHeight * scaleFactor * 5;
    
    if (poleRulerLine) {
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, scaledHeight, 0)
        ];
        poleRulerLine.geometry.setFromPoints(points);
        poleRulerLine.computeLineDistances();
        
        if (poleRulerLine.material) {
            poleRulerLine.material.dashSize = 0.3 * scaleFactor * 5;
            poleRulerLine.material.gapSize = 0.15 * scaleFactor * 5;
        }
    }
    
    if (poleRulerLabel) {
        poleRulerLabel.scale.set(2 * scaleFactor * 5, 0.6 * scaleFactor * 5, 1);
        poleRulerLabel.position.set(0.8 * scaleFactor * 5, scaledHeight / 2, 0);
        
        const canvas = poleRulerLabel.material.map.image;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(poleHeight.toFixed(1) + ' meter', canvas.width / 2, canvas.height / 2);
        poleRulerLabel.material.map.needsUpdate = true;
    }
    
    if (poleRulerGroup) {
        const children = poleRulerGroup.children;
        children.forEach((child, index) => {
            if (index >= 2 && child.geometry && child.geometry.type === 'SphereGeometry') {
                child.position.y = index === 2 ? scaledHeight : 0;
                child.geometry.dispose();
                child.geometry = new THREE.SphereGeometry(0.08 * scaleFactor * 5, 16, 16);
            }
        });
    }
    
    if (poleMesh) {
        poleMesh.geometry.dispose();
        poleMesh.geometry = new THREE.CylinderGeometry(0.2 * scaleFactor * 5, 0.2 * scaleFactor * 5, scaledHeight, 24);
        poleMesh.position.y = scaledHeight / 2;
    }
    
    if (lampArmMesh) {
        lampArmMesh.position.y = scaledHeight - 0.25 * scaleFactor * 5;
    }
    
    if (lampHeadMesh) {
        lampHeadMesh.position.y = scaledHeight - 0.2 * scaleFactor * 5;
    }
    
    if (lampShadeMesh) {
        lampShadeMesh.position.y = scaledHeight - 0.3 * scaleFactor * 5;
    }
    
    const pointLights = [];
    poleGroup.traverse((child) => {
        if (child instanceof THREE.PointLight) {
            pointLights.push(child);
        }
    });
    
    const lightYOffset = scaledHeight - 0.25 * scaleFactor * 5;
    const scaledArmLength = 2.35 * scaleFactor * 5;
    const positions = [
        [scaledArmLength, lightYOffset, 0.075 * scaleFactor * 5], 
        [scaledArmLength + 0.1 * scaleFactor * 5, lightYOffset, 0.075 * scaleFactor * 5], 
        [scaledArmLength + 0.2 * scaleFactor * 5, lightYOffset, 0.075 * scaleFactor * 5],
        [scaledArmLength, lightYOffset, -0.075 * scaleFactor * 5], 
        [scaledArmLength + 0.1 * scaleFactor * 5, lightYOffset, -0.075 * scaleFactor * 5], 
        [scaledArmLength + 0.2 * scaleFactor * 5, lightYOffset, -0.075 * scaleFactor * 5]
    ];
    
    pointLights.forEach((light, idx) => {
        if (positions[idx]) {
            light.position.set(...positions[idx]);
        }
    });
    
    if (currentData) {
        createIlluminanceMap(currentData);
    }
    
    if (currentData) {
        create3DVisualization(currentData);
    }
    
    document.getElementById('pole-height-value').textContent = poleHeight.toFixed(1);
}

function updatePoleRulerVisibility(visible) {
    showPoleRuler = visible;
    if (poleRulerGroup) {
        poleRulerGroup.visible = visible;
    }
}

function updatePoleRulerPosition() {
    if (poleRulerGroup && mapMesh) {
        const polePos = new THREE.Vector3();
        poleGroup.getWorldPosition(polePos);
        poleRulerOffset.set(polePos.x + 2, 0, polePos.z + 2);
        poleRulerGroup.position.copy(poleRulerOffset);
    }
}

function loadLocalFile(filePath) {
    return new Promise((resolve, reject) => {
        const readWithPlusIo = () => {
            if (typeof plus === 'undefined' || !plus.io) {
                return Promise.reject(new Error('plus.io unavailable'));
            }

            const absolutePath = location.href.substring(0, location.href.lastIndexOf('/') + 1) + filePath;
            return new Promise((plusResolve, plusReject) => {
                plus.io.resolveLocalFileSystemURL(absolutePath, function(entry) {
                    entry.file(function(file) {
                        const reader = new plus.io.FileReader();
                        reader.onloadend = function(e) {
                            plusResolve(e.target.result);
                        };
                        reader.onerror = function() {
                            plusReject(new Error('plus.io.FileReader failed'));
                        };
                        reader.readAsText(file);
                    }, function() {
                        plusReject(new Error('plus.io entry.file failed'));
                    });
                }, function() {
                    plusReject(new Error('plus.io resolveLocalFileSystemURL failed'));
                });
            });
        };

        const readWithFetch = () => fetch(filePath).then(response => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('Fetch failed');
        });

        const readWithXHR = () => new Promise((xhrResolve, xhrReject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', filePath, true);
            xhr.responseType = 'text';
            xhr.onload = function() {
                if (xhr.status === 200 || xhr.status === 0) {
                    xhrResolve(xhr.responseText);
                } else {
                    xhrReject(new Error('XHR failed'));
                }
            };
            xhr.onerror = () => xhrReject(new Error('XHR error'));
            try {
                xhr.send();
            } catch (e) {
                xhrReject(e);
            }
        });

        if (typeof plus !== 'undefined' && plus.io) {
            readWithPlusIo()
                .then(resolve)
                .catch(() => readWithXHR().then(resolve).catch(() => readWithFetch().then(resolve).catch(reject)));
            return;
        }

        readWithXHR()
            .then(resolve)
            .catch(() => readWithFetch().then(resolve).catch(reject));
    });
}

function showLoadingOverlay(message = 'Loading IES file...') {
    const overlay = document.getElementById('loading-overlay');
    const textElement = document.querySelector('#loading-overlay .loading-text');
    
    if (overlay) {
        if (textElement) {
            textElement.textContent = message;
        }
        overlay.classList.add('show');
        overlay.offsetHeight;
        overlay.style.display = 'flex';
        overlay.style.WebkitDisplay = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        overlay.style.display = 'none';
    }
}

function loadDefaultIES() {
    showLoadingOverlay('Loading default IES file...');
    
    const defaultIESPath = 'ies/opensolardesign.ies';
    
    loadLocalFile(defaultIESPath)
        .then(content => {
            if (!content) {
                console.log('Cannot load default IES file:', defaultIESPath);
                hideLoadingOverlay();
                return;
            }
            
            const data = parseIES(content);
            if (data) {
                currentData = data;
                window.currentData = currentData;
                create3DVisualization(data);
                
                updateTopInfo('ies', '📁', 'osd: IES', '#3aa0ff');
                
                updatePanelState('upload-panel', true);
            }
            hideLoadingOverlay();
        })
        .catch(error => {
            console.error('Failed to load default IES file:', error);
            hideLoadingOverlay();
        });
}

function clearIlluminanceMap() {
    if (illuminanceMesh) {
        scene.remove(illuminanceMesh);
        illuminanceMesh.geometry.dispose();
        illuminanceMesh.material.dispose();
        illuminanceMesh = null;
    }
    
    contourLines.forEach(line => {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    });
    contourLines = [];
    
    contourLabels.forEach(label => {
        scene.remove(label);
    });
    contourLabels = [];
    
    document.getElementById('max-illuminance').textContent = '-';
    document.getElementById('min-illuminance').textContent = '-';
}
 
function calculateIlluminance(data) {
    
    const resolution = gridResolution;
    const results = [];
    
    const actualLightHeight = lightHeight;
    
    const circleRadius = actualLightHeight * 2;
    const gridSize = circleRadius * 2;
    const step = gridSize / resolution;
    
    const lightPosX = 2.45;
    const lightPosY = actualLightHeight;
    const lightPosZ = 0;
    
    const iesLumen = data.lumen || 1000;
    const actualLumen = lampPower * nominalLumen;
    const powerRatio = actualLumen / iesLumen;
    
    for (let i = 0; i <= resolution; i++) {
        for (let j = 0; j <= resolution; j++) {
            const x = lightPosX - gridSize / 2 + i * step;
            const z = lightPosZ - gridSize / 2 + j * step;
            
            const dx = x - lightPosX;
            const dz = z - lightPosZ;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            
            if (horizontalDist > circleRadius) {
                results.push({ x, z, illuminance: 0 });
                continue;
            }
            
            const straightDist = Math.sqrt(horizontalDist * horizontalDist + lightPosY * lightPosY);
            
            const cosTheta = lightPosY / straightDist;
            const theta = Math.acos(cosTheta);
            
            const gammaAngle = theta;
            
            let phi = Math.atan2(dz, dx);
            phi += lightRotation - Math.PI * 7 / 4;
            
            let intensity = interpolateIntensity(data, gammaAngle, phi);
            
            intensity *= powerRatio;
            
            let illuminance = 0;
            if (straightDist > 0.01) {
                illuminance = (intensity * cosTheta) / (straightDist * straightDist);
            }
            
            results.push({ x, z, illuminance });
        }
    }
    
    return results;
}

function interpolateIntensity(data, theta, phi) {
    if (!data || !data.candelaValues || data.candelaValues.length === 0) {
        return 0;
    }
    
    const verticalAngles = data.verticalAngles || [];
    const horizontalAngles = data.horizontalAngles || [];
    
    if (verticalAngles.length === 0 || horizontalAngles.length === 0) {
        return 0;
    }
    
    let vIndex = 0;
    for (let i = 0; i < verticalAngles.length; i++) {
        if (verticalAngles[i] <= theta * 180 / Math.PI) {
            vIndex = i;
        }
    }
    
    let hIndex = 0;
    const phiDeg = (phi * 180 / Math.PI + 360) % 360;
    for (let i = 0; i < horizontalAngles.length; i++) {
        if (horizontalAngles[i] <= phiDeg) {
            hIndex = i;
        }
    }
    
    const values = data.candelaValues;
    if (hIndex < values.length && vIndex < values[hIndex].length) {
        return values[hIndex][vIndex];
    }
    
    return 0;
}

function getIlluminanceColor(value) {
    const colorStops = [
        { value: 0, color: new THREE.Color(0x2a2a2a) },
        { value: 5, color: new THREE.Color(0x00aaff) },
        { value: 10, color: new THREE.Color(0x00ffff) },
        { value: 20, color: new THREE.Color(0x66ffaa) },
        { value: 35, color: new THREE.Color(0xaaee66) },
        { value: 50, color: new THREE.Color(0xffee44) },
        { value: 75, color: new THREE.Color(0xffcc44) },
        { value: 100, color: new THREE.Color(0xffaa33) }
    ];
    
    for (let i = 0; i < colorStops.length - 1; i++) {
        const lower = colorStops[i];
        const upper = colorStops[i + 1];
        
        if (value >= lower.value && value <= upper.value) {
            const t = (value - lower.value) / (upper.value - lower.value);
            return lower.color.clone().lerp(upper.color, t);
        }
    }
    
    return colorStops[colorStops.length - 1].color.clone();
}

function createIlluminanceMap(data) {
    if (illuminanceMesh) {
        scene.remove(illuminanceMesh);
        illuminanceMesh.geometry.dispose();
        illuminanceMesh.material.dispose();
    }
    
    contourLines.forEach(line => {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    });
    contourLines = [];
    
    contourLabels.forEach(label => {
        scene.remove(label);
    });
    contourLabels = [];
    
    illuminanceData = calculateIlluminance(data);
    
    const maxValue = Math.max(...illuminanceData.map(d => d.illuminance));
    const minValue = Math.min(...illuminanceData.filter(d => d.illuminance > 0).map(d => d.illuminance));
    
    const contourLevels = [];
    
    if (maxValue > 0) {
        const totalLevels = 20;
        
        const highValueThreshold = maxValue * 0.1;
        const highNumLevels = Math.floor(totalLevels * 0.6);
        
        const highLevels = [];
        if (highValueThreshold > 0.01) {
            const highStep = (maxValue - highValueThreshold) / (highNumLevels - 1);
            for (let i = 0; i < highNumLevels; i++) {
                highLevels.push(maxValue - i * highStep);
            }
        }
        
        const lowLevels = [];
        const lowNumLevels = totalLevels - highNumLevels;
        if (minValue > 0 && highValueThreshold > minValue) {
            const logMin = Math.log10(minValue);
            const logMax = Math.log10(Math.max(highValueThreshold, minValue * 2));
            if (logMax > logMin) {
                const logStep = (logMax - logMin) / lowNumLevels;
                for (let i = 1; i <= lowNumLevels; i++) {
                    lowLevels.push(Math.pow(10, logMin + logStep * i));
                }
            }
        }
        
        const allLevels = [...highLevels, ...lowLevels].filter((val, idx, arr) => {
            return idx === arr.findIndex(v => Math.abs(v - val) < 0.001);
        }).sort((a, b) => a - b);
        
        contourLevels.push(...allLevels);
    } else {
        contourLevels = illuminanceUnit === 'fc' 
            ? [0.1, 0.3, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.5, 10.0]
            : [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
    }
    const actualLightHeight = lightHeight;
    const circleRadius = actualLightHeight * 2;
    const gridSize = circleRadius * 2;
    const resolution = gridResolution;
    
    const visualScale = scaleFactor * 5;
    
    const lightPosX = 2.45;
    const lightPosZ = 0;
    
    if (maxValue > 0 && contourLevels.length > 0 && illuminanceData.length > 0) {
        const colors = [
            0x0066ff,
            0x00aaff,
            0x00ffff,
            0x66ffaa,
            0xaaff66,
            0xffff66,
            0xffcc44,
            0xff8844,
            0xff4444
        ];
        
        const searchRadius = actualLightHeight * 1.8;
        
        contourLevels.forEach((level, index) => {
            try {
                const rawPoints = [];
                const angleSteps = 128;
                
                for (let i = 0; i < angleSteps; i++) {
                    let angle = (i / angleSteps) * Math.PI * 2;
                    angle += lightRotation - Math.PI * 7 / 4;
                    
                    let low = 0, high = searchRadius;
                    let foundRadius = -1;
                    
                    for (let iter = 0; iter < 12; iter++) {
                        const mid = (low + high) / 2;
                        const x = lightPosX + Math.cos(angle) * mid;
                        const z = lightPosZ - Math.sin(angle) * mid;
                        
                        let illuminance = interpolateIlluminance(x, z, illuminanceData);
                        
                        if (illuminance >= level) {
                            low = mid;
                            foundRadius = mid;
                        } else {
                            high = mid;
                        }
                    }
                    
                    if (foundRadius > 0 && foundRadius < searchRadius - 0.1) {
                        rawPoints.push({ angle, radius: foundRadius });
                    }
                }
                
                if (rawPoints.length > 20) {
                    let hasLargeGap = false;
                    const maxAngleGap = Math.PI / 12;
                    
                    for (let i = 1; i < rawPoints.length; i++) {
                        const prevAngle = rawPoints[i - 1].angle;
                        const currAngle = rawPoints[i].angle;
                        let gap = Math.abs(currAngle - prevAngle);
                        if (gap > Math.PI) gap = Math.PI * 2 - gap;
                        if (gap > maxAngleGap) {
                            hasLargeGap = true;
                            break;
                        }
                    }
                    
                    if (!hasLargeGap) {
                        const smoothedPoints = smoothContour(rawPoints, lightPosX, lightPosZ, visualScale);
                        
                        const geometry = new THREE.BufferGeometry().setFromPoints(smoothedPoints);
                        const colorIndex = Math.min(Math.floor((level / maxValue) * colors.length), colors.length - 1);
                        const material = new THREE.LineBasicMaterial({
                            color: colors[colorIndex],
                            linewidth: 2,
                            transparent: true,
                            opacity: 0.85
                        });
                        const line = new THREE.Line(geometry, material);
                        scene.add(line);
                        contourLines.push(line);
                        
                        const labelCount = Math.min(Math.floor(smoothedPoints.length / 40) + 1, 4);
                        const step = Math.floor(smoothedPoints.length / labelCount);
                        for (let i = 0; i < labelCount; i++) {
                            const labelIndex = (i * step + Math.floor(Math.random() * step * 0.5)) % smoothedPoints.length;
                            const point = smoothedPoints[labelIndex];
                            addContourLabel(point.x, point.z, level);
                        }
                    }
                }
            } catch (e) {
                console.error('Error creating contour:', e);
            }
        });
    }
    
    function interpolateIlluminance(x, z, data) {
        if (!data || data.length === 0) return 0;
        
        let minDist = Infinity;
        let result = 0;
        
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const dx = d.x - x;
            const dz = d.z - z;
            const dist = dx * dx + dz * dz;
            
            if (dist < minDist) {
                minDist = dist;
                result = d.illuminance;
                if (dist < 0.01) break;
            }
        }
        
        return result;
    }
    
    function smoothContour(rawPoints, centerX, centerZ, visualScale) {
        if (rawPoints.length < 4) {
            return rawPoints.map(p => new THREE.Vector3(
                (centerX + Math.cos(p.angle) * p.radius) * visualScale,
                0.025,
                (centerZ + Math.sin(p.angle) * p.radius) * visualScale
            ));
        }
        
        const smoothed = [];
        const subdivisions = 3;
        
        const extended = [rawPoints[rawPoints.length - 1], ...rawPoints, rawPoints[0], rawPoints[1]];
        
        for (let i = 1; i < extended.length - 3; i++) {
            const p0 = extended[i - 1];
            const p1 = extended[i];
            const p2 = extended[i + 1];
            const p3 = extended[i + 2];
            
            for (let j = 0; j <= subdivisions; j++) {
                const t = j / subdivisions;
                const t2 = t * t;
                const t3 = t2 * t;
                
                const radius = 0.5 * (-p0.radius + 3 * p1.radius - 3 * p2.radius + p3.radius) * t3 +
                              0.5 * (2 * p0.radius - 5 * p1.radius + 4 * p2.radius - p3.radius) * t2 +
                              0.5 * (-p0.radius + p2.radius) * t +
                              p1.radius;
                
                let angle = p1.angle + (p2.angle - p1.angle) * t;
                
                smoothed.push(new THREE.Vector3(
                    (centerX + Math.cos(angle) * radius) * visualScale,
                    0.025,
                    (centerZ + Math.sin(angle) * radius) * visualScale
                ));
            }
        }
        
        return smoothed;
    }
    
    const canvas = document.createElement('canvas');
    const canvasSize = 512;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = canvasSize / 2;
    
    let maxLux = 0;
    let minLux = Infinity;
    let sumLux = 0;
    let count = 0;
    
    const lightPosPhysical = new THREE.Vector3(2.45, lightHeight, 0);
    
    const colorStops = [
        { value: 0, r: 42, g: 42, b: 42 },
        { value: 5, r: 0, g: 170, b: 255 },
        { value: 10, r: 0, g: 255, b: 255 },
        { value: 20, r: 102, g: 255, b: 170 },
        { value: 35, r: 170, g: 238, b: 102 },
        { value: 50, r: 255, g: 238, b: 68 },
        { value: 75, r: 255, g: 204, b: 68 },
        { value: 100, r: 255, g: 170, b: 51 }
    ];
    
    function getSmoothColor(illuminance) {
        if (illuminance < 0.1) {
            return { r: 42, g: 42, b: 42 };
        }
        
        for (let i = 0; i < colorStops.length - 1; i++) {
            const lower = colorStops[i];
            const upper = colorStops[i + 1];
            
            if (illuminance >= lower.value && illuminance <= upper.value) {
                const t = (illuminance - lower.value) / (upper.value - lower.value);
                const r = Math.round(lower.r + (upper.r - lower.r) * t);
                const g = Math.round(lower.g + (upper.g - lower.g) * t);
                const b = Math.round(lower.b + (upper.b - lower.b) * t);
                return { r, g, b };
            }
        }
        
        const last = colorStops[colorStops.length - 1];
        return { r: last.r, g: last.g, b: last.b };
    }
    
    function bilinearInterpolate(x, z) {
        const step = gridSize / resolution;
        const gridMinX = lightPosPhysical.x - gridSize / 2;
        const gridMinZ = lightPosPhysical.z - gridSize / 2;
        
        const gridI = (x - gridMinX) / step;
        const gridJ = (z - gridMinZ) / step;
        
        if (gridI < 0 || gridI > resolution || gridJ < 0 || gridJ > resolution) {
            return 0;
        }
        
        const i0 = Math.max(0, Math.floor(gridI));
        const i1 = Math.min(resolution, i0 + 1);
        const j0 = Math.max(0, Math.floor(gridJ));
        const j1 = Math.min(resolution, j0 + 1);
        
        const idx00 = i0 * (resolution + 1) + j0;
        const idx01 = i0 * (resolution + 1) + j1;
        const idx10 = i1 * (resolution + 1) + j0;
        const idx11 = i1 * (resolution + 1) + j1;
        
        const v00 = illuminanceData[idx00]?.illuminance || 0;
        const v01 = illuminanceData[idx01]?.illuminance || 0;
        const v10 = illuminanceData[idx10]?.illuminance || 0;
        const v11 = illuminanceData[idx11]?.illuminance || 0;
        
        if (v00 === 0 && v01 === 0 && v10 === 0 && v11 === 0) {
            return 0;
        }
        
        const fx = gridI - i0;
        const fz = gridJ - j0;
        
        const v0 = v00 * (1 - fx) + v10 * fx;
        const v1 = v01 * (1 - fx) + v11 * fx;
        const interpolated = v0 * (1 - fz) + v1 * fz;
        
        return Math.max(0, interpolated);
    }
    
    for (let y = 0; y < canvasSize; y++) {
        for (let x = 0; x < canvasSize; x++) {
            const dx = (x - centerX) / radius;
            const dy = (y - centerY) / radius;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= 1) {
                const gridX = lightPosPhysical.x + dx * circleRadius;
                const gridZ = lightPosPhysical.z - dy * circleRadius;
                
                const illuminance = bilinearInterpolate(gridX, gridZ);
                
                if (illuminance > 0) {
                    maxLux = Math.max(maxLux, illuminance);
                    minLux = Math.min(minLux, illuminance);
                    sumLux += illuminance;
                    count++;
                }
                
                const color = getSmoothColor(illuminance);
                
                const colorTemp = window.currentColorTemp || 4000;
                const tempColor = applyColorTempToRGB(color.r, color.g, color.b, colorTemp);
                
                const edgeFalloff = 1 - dist * dist;
                const alpha = 0.7 * edgeFalloff;
                
                ctx.fillStyle = `rgba(${tempColor.r}, ${tempColor.g}, ${tempColor.b}, ${alpha})`;
            } else {
                ctx.fillStyle = 'rgba(0, 0, 0, 0)';
            }
            ctx.fillRect(x, y, 1, 1);
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    const visualGridSize = gridSize * visualScale;
    const geometry = new THREE.PlaneGeometry(visualGridSize, visualGridSize);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.01,
        depthWrite: false,
        depthTest: false
    });
    
    illuminanceMesh = new THREE.Mesh(geometry, material);
    illuminanceMesh.position.set(lightPosPhysical.x * visualScale, 0.01, lightPosPhysical.z * visualScale);
    illuminanceMesh.rotation.x = -Math.PI / 2;
    illuminanceMesh.visible = showIlluminance;
    scene.add(illuminanceMesh);
    
    const avgLux = count > 0 ? sumLux / count : 0;
    updateIlluminanceStats(maxLux, minLux === Infinity ? 0 : minLux, avgLux);
}

function generateContours(data, level, gridSize, resolution) {
    const contours = [];
    const step = gridSize / resolution;
    const visited = new Array(data.length).fill(false);
    
    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            const idx = i * (resolution + 1) + j;
            if (visited[idx]) continue;
            
            const cell = [
                data[idx],
                data[idx + 1],
                data[idx + resolution + 1],
                data[idx + resolution + 2]
            ];
            
            const cellValues = cell.map(d => d?.illuminance || 0);
            const hasCrossing = cellValues.some(v => v >= level) && 
                               cellValues.some(v => v < level);
            
            if (hasCrossing) {
                const contour = traceContour(data, i, j, level, gridSize, resolution, visited);
                if (contour.length > 1) {
                    contours.push(contour);
                }
            }
        }
    }
    
    return contours;
}

function traceContour(data, startI, startJ, level, gridSize, resolution, visited) {
    const contour = [];
    let i = startI;
    let j = startJ;
    
    const step = gridSize / resolution;
    const halfGrid = gridSize / 2;
    const totalSize = resolution + 1;
    
    const startIdx = i * totalSize + j;
    
    let previousExitEdge = null;
    
    while (i >= 0 && i < resolution && j >= 0 && j < resolution) {
        const idx = i * totalSize + j;
        
        if (visited[idx]) {
            if (idx === startIdx && contour.length > 2) {
                break;
            }
            const neighbors = getUnvisitedNeighbors(i, j, resolution, visited, totalSize);
            if (neighbors.length > 0) {
                const [ni, nj] = neighbors[0];
                i = ni;
                j = nj;
                previousExitEdge = null;
                continue;
            }
            break;
        }
        
        visited[idx] = true;
        
        const cell = [
            data[idx]?.illuminance || 0,
            data[idx + 1]?.illuminance || 0,
            data[idx + totalSize]?.illuminance || 0,
            data[idx + totalSize + 1]?.illuminance || 0
        ];
        
        const crossings = [];
        if ((cell[0] >= level) !== (cell[1] >= level)) {
            const t = cell[1] !== cell[0] ? (level - cell[0]) / (cell[1] - cell[0]) : 0.5;
            crossings.push({ edge: 'top', t: t });
        }
        if ((cell[1] >= level) !== (cell[3] >= level)) {
            const t = cell[3] !== cell[1] ? (level - cell[1]) / (cell[3] - cell[1]) : 0.5;
            crossings.push({ edge: 'right', t: t });
        }
        if ((cell[2] >= level) !== (cell[3] >= level)) {
            const t = cell[3] !== cell[2] ? (level - cell[2]) / (cell[3] - cell[2]) : 0.5;
            crossings.push({ edge: 'bottom', t: t });
        }
        if ((cell[0] >= level) !== (cell[2] >= level)) {
            const t = cell[2] !== cell[0] ? (level - cell[0]) / (cell[2] - cell[0]) : 0.5;
            crossings.push({ edge: 'left', t: t });
        }
        
        if (crossings.length !== 2) {
            const neighbors = getUnvisitedNeighbors(i, j, resolution, visited, totalSize);
            if (neighbors.length > 0) {
                const [ni, nj] = neighbors[0];
                i = ni;
                j = nj;
                previousExitEdge = null;
                continue;
            }
            break;
        }
        
        let entry = crossings[0];
        let exit = crossings[1];
        
        if (previousExitEdge) {
            const oppositeEdge = {
                'top': 'bottom',
                'bottom': 'top',
                'left': 'right',
                'right': 'left'
            };
            
            if (crossings[0].edge !== oppositeEdge[previousExitEdge]) {
                entry = crossings[1];
                exit = crossings[0];
            }
        }
        
        let x1, z1, x2, z2;
        
        if (entry.edge === 'top') {
            x1 = -halfGrid + j * step + entry.t * step;
            z1 = -halfGrid + i * step;
        } else if (entry.edge === 'right') {
            x1 = -halfGrid + (j + 1) * step;
            z1 = -halfGrid + i * step + entry.t * step;
        } else if (entry.edge === 'bottom') {
            x1 = -halfGrid + j * step + entry.t * step;
            z1 = -halfGrid + (i + 1) * step;
        } else {
            x1 = -halfGrid + j * step;
            z1 = -halfGrid + i * step + entry.t * step;
        }
        
        if (exit.edge === 'top') {
            x2 = -halfGrid + j * step + exit.t * step;
            z2 = -halfGrid + i * step;
        } else if (exit.edge === 'right') {
            x2 = -halfGrid + (j + 1) * step;
            z2 = -halfGrid + i * step + exit.t * step;
        } else if (exit.edge === 'bottom') {
            x2 = -halfGrid + j * step + exit.t * step;
            z2 = -halfGrid + (i + 1) * step;
        } else {
            x2 = -halfGrid + j * step;
            z2 = -halfGrid + i * step + exit.t * step;
        }
        
        if (contour.length === 0 || !isPointNear(contour[contour.length - 1], { x: x1, z: z1 }, step)) {
            contour.push({ x: x1, z: z1 });
        }
        
        previousExitEdge = exit.edge;
        
        if (exit.edge === 'top') i--;
        else if (exit.edge === 'right') j++;
        else if (exit.edge === 'bottom') i++;
        else j--;
    }
    
    return contour;
}

function getUnvisitedNeighbors(i, j, resolution, visited, totalSize) {
    const neighbors = [];
    
    if (i > 0 && !visited[(i - 1) * totalSize + j]) neighbors.push([i - 1, j]);
    if (i < resolution - 1 && !visited[(i + 1) * totalSize + j]) neighbors.push([i + 1, j]);
    if (j > 0 && !visited[i * totalSize + (j - 1)]) neighbors.push([i, j - 1]);
    if (j < resolution - 1 && !visited[i * totalSize + (j + 1)]) neighbors.push([i, j + 1]);
    
    return neighbors;
}

function isPointNear(p1, p2, threshold) {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dz * dz) < threshold;
}

function addContourLabel(x, z, value) {
    const canvas = document.createElement('canvas');
    canvas.width = 1152;
    canvas.height = 288;
    const ctx = canvas.getContext('2d');
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.fillStyle = 'rgba(10, 40, 100, 0.95)';
    ctx.roundRect(18, 18, 1116, 252, 36);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 9;
    ctx.roundRect(18, 18, 1116, 252, 36);
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 126px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const displayValue = illuminanceUnit === 'fc' 
        ? (value * 0.092903).toFixed(1) 
        : value.toFixed(1);
    const unit = illuminanceUnit === 'fc' ? 'fc' : 'lux';
    ctx.fillText(`${displayValue} ${unit}`, 576, 144);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true 
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, 0.1, z);
    sprite.scale.set(13.5, 3.375, 1);
    
    scene.add(sprite);
    contourLabels.push(sprite);
}

function updateIlluminanceStats(max, min, avg) {
    const unit = illuminanceUnit;
    const convert = (value) => {
        if (unit === 'fc') {
            return value * 0.092903;
        }
        return value;
    };
    
    const maxEl = document.getElementById('max-illuminance');
    const minEl = document.getElementById('min-illuminance');
    const avgEl = document.getElementById('avg-illuminance');
    
    if (maxEl) maxEl.textContent = `${convert(max).toFixed(2)} ${unit === 'lux' ? 'lux' : 'fc'}`;
    if (minEl) minEl.textContent = `${convert(min).toFixed(2)} ${unit === 'lux' ? 'lux' : 'fc'}`;
    if (avgEl) avgEl.textContent = `${convert(avg).toFixed(2)} ${unit === 'lux' ? 'lux' : 'fc'}`;
}

function updateIlluminanceDisplay() {
    if (illuminanceData.length > 0) {
        let maxLux = 0;
        let minLux = Infinity;
        let sumLux = 0;
        let count = 0;
        
        illuminanceData.forEach(d => {
            if (d.illuminance > 0) {
                maxLux = Math.max(maxLux, d.illuminance);
                minLux = Math.min(minLux, d.illuminance);
                sumLux += d.illuminance;
                count++;
            }
        });
        
        const avgLux = count > 0 ? sumLux / count : 0;
        updateIlluminanceStats(maxLux, minLux === Infinity ? 0 : minLux, avgLux);
    }
}

function createStreetlight() {
    poleGroup = new THREE.Group();

    const scaledHeight = poleHeight * scaleFactor * 5;

    const poleMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.6, metalness: 0.6 });
    poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scaleFactor * 5, 0.2 * scaleFactor * 5, scaledHeight, 24), poleMat);
    poleMesh.position.set(0, scaledHeight / 2, 0);
    poleMesh.castShadow = true;
    poleGroup.add(poleMesh);

    const armMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5, metalness: 0.5 });
    lampArmMesh = new THREE.Mesh(new THREE.BoxGeometry(1.9 * scaleFactor * 5, 0.125 * scaleFactor * 5, 0.125 * scaleFactor * 5), armMat);
    lampArmMesh.position.set(0.975 * scaleFactor * 5, scaledHeight - 0.25 * scaleFactor * 5, 0);
    lampArmMesh.castShadow = true;
    poleGroup.add(lampArmMesh);

    const headMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7, metalness: 0.1, opacity: 0.6, transparent: true });
    lampHeadMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scaleFactor * 5, 0.05 * scaleFactor * 5, 0.5 * scaleFactor * 5), headMat);
    lampHeadMesh.position.set(2.45 * scaleFactor * 5, scaledHeight - 0.2 * scaleFactor * 5, 0);
    lampHeadMesh.castShadow = true;
    lampHeadMesh.visible = true;
    poleGroup.add(lampHeadMesh);

    const shadeMat = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 0.2,
        metalness: 0.6,
        side: THREE.DoubleSide
    });
    const ellipsoidGeometry = new THREE.SphereGeometry(0.4 * scaleFactor * 5, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    ellipsoidGeometry.scale(1.3, 0.8, 1.0);
    lampShadeMesh = new THREE.Mesh(ellipsoidGeometry, shadeMat);
    lampShadeMesh.position.set(2.4 * scaleFactor * 5, scaledHeight - 0.3 * scaleFactor * 5, 0);
    lampShadeMesh.castShadow = true;
    lampShadeMesh.receiveShadow = true;
    poleGroup.add(lampShadeMesh);

    const warmWhiteColor = 0xFFF1CC;

    const lightYOffset = scaledHeight - 0.25 * scaleFactor * 5;
    const scaledArmLength = 2.35 * scaleFactor * 5;
    const positions = [
        [scaledArmLength, lightYOffset, 0.075 * scaleFactor * 5], [scaledArmLength + 0.1 * scaleFactor * 5, lightYOffset, 0.075 * scaleFactor * 5], [scaledArmLength + 0.2 * scaleFactor * 5, lightYOffset, 0.075 * scaleFactor * 5],
        [scaledArmLength, lightYOffset, -0.075 * scaleFactor * 5], [scaledArmLength + 0.1 * scaleFactor * 5, lightYOffset, -0.075 * scaleFactor * 5], [scaledArmLength + 0.2 * scaleFactor * 5, lightYOffset, -0.075 * scaleFactor * 5]
    ];

    const pointLights = [];
    positions.forEach((pos, idx) => {
        const pointLight = new THREE.PointLight(warmWhiteColor, 0.3, 120, 2.0);
        if (idx < 3) {
            pointLight.castShadow = true;
            pointLight.shadow.mapSize.set(512, 512);
        }
        pointLight.position.set(...pos);
        poleGroup.add(pointLight);
        pointLights.push(pointLight);

    });

    const spotTargets = [];
    positions.forEach(pos => {
        const target = new THREE.Object3D();
        target.position.set(pos[0], 0.5, pos[2]);
        scene.add(target);
        spotTargets.push(target);
    });

    const spotAngle = THREE.MathUtils.degToRad(55);
    const spotPenumbra = 0.3;
    positions.forEach((pos, idx) => {
        const spotLight = new THREE.SpotLight(warmWhiteColor, 0.3, 120, spotAngle, spotPenumbra, 2.0);
        if (idx < 3) {
            spotLight.castShadow = true;
            spotLight.shadow.mapSize.set(512, 512);
        }
        spotLight.position.set(...pos);
        spotLight.target = spotTargets[idx];
        poleGroup.add(spotLight);
    });
 

    scene.add(poleGroup);
}

function parseIES(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    
    let manufacturer = '', luminaire = '', lampType = '';
    let lineIndex = 0;
    
    if (lines[0] && lines[0].toUpperCase().startsWith('IES')) {
        lineIndex = 1;
        if (lines[lineIndex]) manufacturer = lines[lineIndex];
        lineIndex++;
        if (lines[lineIndex]) luminaire = lines[lineIndex];
        lineIndex++;
        if (lines[lineIndex]) lampType = lines[lineIndex];
        lineIndex++;
    }

    let dataStart = null;
    for (let i = lineIndex; i < lines.length; i++) {
        if (lines[i].toUpperCase().includes('TILT=')) {
            for (let j = i + 1; j < lines.length; j++) {
                if (/^\s*\d/.test(lines[j])) {
                    dataStart = j;
                    break;
                }
            }
            break;
        }
    }

    if (dataStart === null) throw new Error('未找到 IES 数据');

    const allNumbers = [];
    for (let i = dataStart; i < lines.length; i++) {
        const matches = lines[i].match(/-?[\d.]+/g);
        if (matches) allNumbers.push(...matches.map(Number));
    }

    if (allNumbers.length < 10) throw new Error('数据不足');

    const nLamps = Math.round(allNumbers[0]);
    const lumen = allNumbers[1];
    const candelaMultiplier = allNumbers[2];
    const nHoriz = Math.round(allNumbers[3]);
    const nVert = Math.round(allNumbers[4]);
    const unitType = allNumbers[5];
    const unit = unitType === 1 ? 'cd' : unitType === 2 ? 'klm' : 'lm';

    const gammaVals = allNumbers.slice(6, 6 + nVert);
    const phiVals = allNumbers.slice(6 + nVert, 6 + nVert + nHoriz);

    const intensity = [];
    let idx = 6 + nVert + nHoriz;
    for (let i = 0; i < nHoriz; i++) {
        const row = allNumbers.slice(idx, idx + nVert);
        intensity.push(row);
        idx += nVert;
    }

    const flatIntensity = intensity.flat();
    const maxInt = Math.max(...flatIntensity);
    const minInt = Math.min(...flatIntensity.filter(v => v > 0));

    return {
        manufacturer,
        luminaire,
        lampType,
        nLamps,
        unit,
        lumen,
        gamma: gammaVals.map(v => v * Math.PI / 180),
        phi: phiVals.map(v => v * Math.PI / 180),
        intensity,
        maxInt,
        minInt,
        maxIntensity: maxInt,
        verticalAngles: gammaVals,
        horizontalAngles: phiVals,
        candelaValues: intensity
    };
}

class IESPreviewRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.maxRadius = Math.min(this.centerX, this.centerY) - 30;
    }

    drawGrid(maxCandela) {
        const { ctx, centerX, centerY, maxRadius } = this;
        
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            const r = (maxRadius / 4) * i;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
            ctx.stroke();
            
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px Arial';
            ctx.fillText(Math.round((maxCandela / 4) * i) + ' cd', centerX + 5, centerY - r + 3);
        }

        ctx.beginPath();
        ctx.moveTo(centerX - maxRadius, centerY);
        ctx.lineTo(centerX + maxRadius, centerY);
        ctx.moveTo(centerX, centerY - maxRadius);
        ctx.lineTo(centerX, centerY + maxRadius);
        ctx.stroke();

        ctx.fillStyle = '#6b7280';
        ctx.fillText('0° (下射)', centerX - 15, centerY + maxRadius + 15);
        ctx.fillText('90°', centerX + maxRadius + 5, centerY + 4);
        ctx.fillText('180°', centerX - 10, centerY - maxRadius - 10);
    }

    drawIESGraph(angles, candelas) {
        const { ctx, centerX, centerY, maxRadius } = this;
        
        const maxIntensity = Math.max(...candelas, 1);

        this.drawGrid(maxIntensity);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
        
        ctx.beginPath();
        
        angles.forEach((angle, idx) => {
            const candela = candelas[idx];
            const r = (candela / maxIntensity) * maxRadius;
            const theta = (angle * Math.PI / 180) + (Math.PI / 2);
            
            const x = centerX + r * Math.cos(theta);
            const y = centerY + r * Math.sin(theta);
            
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        for (let idx = angles.length - 1; idx >= 0; idx--) {
            const angle = angles[idx];
            const candela = candelas[idx];
            const r = (candela / maxIntensity) * maxRadius;
            const theta = (-angle * Math.PI / 180) + (Math.PI / 2);
            
            const x = centerX + r * Math.cos(theta);
            const y = centerY + r * Math.sin(theta);
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.stroke();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#eab308';
        ctx.fill();
    }

    render(data, type = 'top') {
        if (!this.canvas || !data) return;
        
        const { ctx } = this;
        
        ctx.clearRect(0, 0, this.width, this.height);

        const candelaValues = data.intensity || [];
        const verticalAngles = data.gamma || [];

        if (candelaValues.length > 0 && verticalAngles.length > 0) {
            if (type === 'top') {
                this.drawIESGraph(verticalAngles, candelaValues[0]);
            } else if (type === 'front') {
                this.drawIESGraph(verticalAngles, candelaValues[0]);
            } else if (type === 'side') {
                const midIdx = Math.floor(candelaValues.length / 2);
                if (midIdx < candelaValues.length) {
                    this.drawIESGraph(verticalAngles, candelaValues[midIdx]);
                }
            }
        }
    }
}

function drawIESPreviews(data) {
    if (!data || !data.intensity) return;
    
    const topRenderer = new IESPreviewRenderer('preview-top');
    topRenderer.render(data, 'top');
    
    const frontRenderer = new IESPreviewRenderer('preview-front');
    frontRenderer.render(data, 'front');
    
    const sideRenderer = new IESPreviewRenderer('preview-side');
    sideRenderer.render(data, 'side');
}

function drawTopView(data) {
    const canvas = document.getElementById('preview-top');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 8;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    
    for (let r = 1; r <= 4; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (maxRadius / 4) * r, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(rad) * maxRadius,
            centerY + Math.sin(rad) * maxRadius
        );
        ctx.stroke();
    }
    
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    const candelaValues = data.intensity || [];
    const verticalAngles = data.gamma || [];
    
    let maxCandela = 0;
    candelaValues.forEach(row => {
        row.forEach(val => {
            if (val > maxCandela) maxCandela = val;
        });
    });
    
    if (maxCandela > 0 && candelaValues.length > 0 && verticalAngles.length > 0) {
        drawCurve(ctx, verticalAngles, candelaValues[0], maxCandela, maxRadius, centerX, centerY, '#ff8800', true);
        
        if (candelaValues.length >= 2) {
            const midIdx = Math.floor(candelaValues.length / 2);
            drawCurve(ctx, verticalAngles, candelaValues[midIdx], maxCandela, maxRadius, centerX, centerY, '#6666ff', false);
        }
    }
    
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * 绘制单条配光曲线
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Array} angles 垂直角度数组（度数）
 * @param {Array} candelas 对应角度的光强值
 * @param {number} maxCandela 最大光强值
 * @param {number} maxRadius 画布最大半径
 * @param {number} centerX 中心X坐标
 * @param {number} centerY 中心Y坐标
 * @param {string} color 线条颜色
 * @param {boolean} fill 是否填充
 */
function drawCurve(ctx, angles, candelas, maxCandela, maxRadius, centerX, centerY, color, fill = true) {
    if (!angles || !candelas || angles.length !== candelas.length) return;
    
    const points = [];
    for (let i = 0; i < angles.length; i++) {
        const angle = angles[i];
        const candela = candelas[i];
        const rad = ((180 - angle) * Math.PI) / 180;
        const radius = (candela / maxCandela) * maxRadius;
        points.push({
            x: centerX + Math.cos(rad) * radius,
            y: centerY + Math.sin(rad) * radius
        });
    }
    
    if (fill && points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        for (const p of points) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
        gradient.addColorStop(0, 'rgba(255, 220, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 240, 100, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 255, 150, 0.4)');
        ctx.fillStyle = gradient;
        ctx.fill();
    }
    
    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (const p of points) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

function drawFrontView(data) {
    const canvas = document.getElementById('preview-front');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 6;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    
    for (let r = 1; r <= 4; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (maxRadius / 4) * r, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(rad) * maxRadius,
            centerY + Math.sin(rad) * maxRadius
        );
        ctx.stroke();
    }
    
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    let maxCandela = 0;
    data.intensity.forEach(row => {
        row.forEach(val => {
            if (val > maxCandela) maxCandela = val;
        });
    });
    
    if (maxCandela > 0 && data.intensity.length > 0) {
        const verticalAngles = data.gamma || [];
        const candelas = data.intensity[0] || [];
        
        if (candelas.length > 0 && verticalAngles.length === candelas.length) {
            const points = [];
            for (let i = 0; i < verticalAngles.length; i++) {
                const angle = verticalAngles[i];
                const candela = candelas[i];
                const rad = ((180 - angle) * Math.PI) / 180;
                const radius = (candela / maxCandela) * maxRadius;
                points.push({
                    x: centerX + Math.cos(rad) * radius,
                    y: centerY + Math.sin(rad) * radius
                });
            }
            
            if (points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                for (const p of points) {
                    ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
                const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
                gradient.addColorStop(0, 'rgba(255, 220, 0, 0.8)');
                gradient.addColorStop(0.5, 'rgba(255, 240, 100, 0.6)');
                gradient.addColorStop(1, 'rgba(255, 255, 150, 0.4)');
                ctx.fillStyle = gradient;
                ctx.fill();
            }
            
            if (points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (const p of points) {
                    ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    }
    
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawSideView(data) {
    const canvas = document.getElementById('preview-side');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 6;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    
    for (let r = 1; r <= 4; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (maxRadius / 4) * r, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(rad) * maxRadius,
            centerY + Math.sin(rad) * maxRadius
        );
        ctx.stroke();
    }
    
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    let maxCandela = 0;
    data.intensity.forEach(row => {
        row.forEach(val => {
            if (val > maxCandela) maxCandela = val;
        });
    });
    
    if (maxCandela > 0 && data.intensity.length > 0) {
        const horizontalAngles = data.phi || [];
        const verticalAngles = data.gamma || [];
        
        if (horizontalAngles.length > 0) {
            const avgCandelas = [];
            for (let h = 0; h < horizontalAngles.length; h++) {
                const intensities = data.intensity[h] || [];
                const avg = intensities.reduce((a, b) => a + b, 0) / intensities.length;
                avgCandelas.push(avg);
            }
            
            const points = [];
            for (let i = 0; i < horizontalAngles.length; i++) {
                const angle = horizontalAngles[i];
                const candela = avgCandelas[i];
                const rad = (angle * Math.PI) / 180;
                const radius = (candela / maxCandela) * maxRadius;
                points.push({
                    x: centerX + Math.cos(rad) * radius,
                    y: centerY + Math.sin(rad) * radius
                });
            }
            
            if (points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                for (const p of points) {
                    ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
                const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
                gradient.addColorStop(0, 'rgba(255, 220, 0, 0.8)');
                gradient.addColorStop(0.5, 'rgba(255, 240, 100, 0.6)');
                gradient.addColorStop(1, 'rgba(255, 255, 150, 0.4)');
                ctx.fillStyle = gradient;
                ctx.fill();
            }
            
            if (points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (const p of points) {
                    ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
                ctx.strokeStyle = '#6666ff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    }
    
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
    ctx.fill();
}

function getHeatmapColor(value) {
    const r = Math.round(255 * Math.min(1, value * 2));
    const g = Math.round(255 * Math.min(1, (1 - value) * 2));
    const b = Math.round(50 + value * 50);
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
}

function addDirectionIndicator(position) {
    const axisLength = 0.6;
    
    const axisGroup = new THREE.Group();
    
    const zAxisGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.3, 0),
        new THREE.Vector3(0, 0.3, axisLength)
    ]);
    const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
    axisGroup.add(new THREE.Line(zAxisGeometry, zAxisMaterial));
    
    const zArrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.15, 8),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    zArrow.position.set(0, 0.3, axisLength);
    zArrow.rotation.x = Math.PI / 2;
    axisGroup.add(zArrow);
    
    const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.3, 0),
        new THREE.Vector3(axisLength, 0.3, 0)
    ]);
    const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 });
    axisGroup.add(new THREE.Line(xAxisGeometry, xAxisMaterial));
    
    const xArrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.15, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    xArrow.position.set(axisLength, 0.3, 0);
    xArrow.rotation.z = -Math.PI / 2;
    axisGroup.add(xArrow);
    
    const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.3, 0),
        new THREE.Vector3(0, 0.3 - axisLength, 0)
    ]);
    const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 });
    axisGroup.add(new THREE.Line(yAxisGeometry, yAxisMaterial));
    
    const yArrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.15, 8),
        new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    yArrow.position.set(0, 0.3 - axisLength, 0);
    yArrow.rotation.x = Math.PI;
    axisGroup.add(yArrow);
    
    axisGroup.rotation.y = lightRotation;
    
    axisGroup.position.set(position.x, position.y, position.z);
    
    const labelOffset = axisLength + 0.15;
    addAxisLabel(position, 'Z (前)', 
        Math.sin(lightRotation) * labelOffset, 
        0.35, 
        -Math.cos(lightRotation) * labelOffset, 
        0xff0000);
    addAxisLabel(position, 'X (侧)', 
        Math.cos(lightRotation) * labelOffset, 
        0.35, 
        Math.sin(lightRotation) * labelOffset, 
        0x00ff00);
    addAxisLabel(position, 'Y (下)', 0, 0.3 - axisLength - 0.15, 0, 0x0000ff);
    
    currentGroup.add(axisGroup);
}

function addAxisLabel(position, text, offsetX, offsetY, offsetZ, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 32;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Arial';
    ctx.fillStyle = `rgb(${((color >> 16) & 255)}, ${((color >> 8) & 255)}, ${(color & 255)})`;
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, 22);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(position.x + offsetX, position.y + offsetY, position.z + offsetZ);
    sprite.scale.set(0.3, 0.075, 1);
    currentGroup.add(sprite);
}

function create3DVisualization(data) {
    currentData = data;
    window.currentData = currentData;
    
    if (currentGroup) {
        scene.remove(currentGroup);
        currentGroup = null;
    }

    currentGroup = new THREE.Group();
    const maxInt = data.maxInt;
    const scale = 3;
    const lampPosition = new THREE.Vector3(2.45 * scaleFactor * 5, (poleHeight - 0.25) * scaleFactor * 5, 0);
    
    addDirectionIndicator(lampPosition);

    if (viewMode === 'curve' || viewMode === 'combine') {
        for (let i = 0; i < data.phi.length; i++) {
            const curvePoints = [];
            for (let j = 0; j < data.gamma.length; j++) {
                const I = data.intensity[i][j];
                if (I <= 0) continue;
                const phi = data.phi[i] + lightRotation + Math.PI - Math.PI * 7 / 4;
                const x = Math.cos(phi) * Math.sin(data.gamma[j]);
                const z = Math.sin(phi) * Math.sin(data.gamma[j]);
                const y = -Math.cos(data.gamma[j]);
                const r = (I / maxInt) * scale;
                curvePoints.push(new THREE.Vector3(x * r + lampPosition.x, y * r + lampPosition.y, z * r + lampPosition.z));
            }
            if (curvePoints.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
                const material = new THREE.LineBasicMaterial({
                    color: 0xffdd00, linewidth: 2, transparent: true, opacity: 0.8
                });
                currentGroup.add(new THREE.Line(geometry, material));
            }
        }

        for (let j = 0; j < data.gamma.length; j++) {
            const curvePoints = [];
            for (let i = 0; i < data.phi.length; i++) {
                const I = data.intensity[i][j];
                if (I <= 0) continue;
                const phi = data.phi[i] + lightRotation + Math.PI / 2 - Math.PI * 7 / 4;
                const x = Math.cos(phi) * Math.sin(data.gamma[j]);
                const z = Math.sin(phi) * Math.sin(data.gamma[j]);
                const y = -Math.cos(data.gamma[j]);
                const r = (I / maxInt) * scale;
                curvePoints.push(new THREE.Vector3(x * r + lampPosition.x, y * r + lampPosition.y, z * r + lampPosition.z));
            }
            if (curvePoints.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
                const material = new THREE.LineBasicMaterial({
                    color: 0x00ddff, linewidth: 1, transparent: true, opacity: 0.5
                });
                currentGroup.add(new THREE.Line(geometry, material));
            }
        }
    }

    if (viewMode === 'particle' || viewMode === 'combine') {
        const points = [];
        const colors = [];
        for (let i = 0; i < data.phi.length; i++) {
            for (let j = 0; j < data.gamma.length; j++) {
                const I = data.intensity[i][j];
                if (I <= 0 || I < maxInt * 0.05) continue;
                const phi = data.phi[i] + lightRotation - Math.PI * 7 / 4;
                const x = Math.cos(phi) * Math.sin(data.gamma[j]);
                const z = Math.sin(phi) * Math.sin(data.gamma[j]);
                const y = -Math.cos(data.gamma[j]);
                const r = (I / maxInt) * scale;
                points.push(new THREE.Vector3(x * r + lampPosition.x, y * r + lampPosition.y, z * r + lampPosition.z));
                const t = I / maxInt;
                colors.push(new THREE.Color().setHSL(0.1 + t * 0.15, 1, 0.4 + t * 0.4));
            }
        }
        if (points.length > 0) {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(
                colors.flatMap(c => [c.r, c.g, c.b]), 3
            ));
            const material = new THREE.PointsMaterial({
                size: 0.05, vertexColors: true, transparent: true, opacity: 0.8
            });
            currentGroup.add(new THREE.Points(geometry, material));
        }
    }

    if (viewMode === 'surface') {
        const vertices = [];
        const faces = [];
        const colors = [];
        
        for (let i = 0; i < data.phi.length - 1; i++) {
            for (let j = 0; j < data.gamma.length - 1; j++) {
                const I1 = data.intensity[i][j];
                const I2 = data.intensity[i+1][j];
                const I3 = data.intensity[i][j+1];
                const I4 = data.intensity[i+1][j+1];
                
                if (I1 <= 0 || I2 <= 0 || I3 <= 0 || I4 <= 0) continue;

                const createPoint = (ii, jj, I) => {
                    const phi = data.phi[ii] + lightRotation + Math.PI / 2 - Math.PI * 7 / 4;
                    const x = Math.cos(phi) * Math.sin(data.gamma[jj]);
                    const z = Math.sin(phi) * Math.sin(data.gamma[jj]);
                    const y = -Math.cos(data.gamma[jj]);
                    const r = (I / maxInt) * scale;
                    return { 
                        x: x * r + lampPosition.x, 
                        y: y * r + lampPosition.y, 
                        z: z * r + lampPosition.z 
                    };
                };

                const p0 = createPoint(i, j, I1);
                const p1 = createPoint(i+1, j, I2);
                const p2 = createPoint(i, j+1, I3);
                const p3 = createPoint(i+1, j+1, I4);

                const baseIdx = vertices.length / 3;
                vertices.push(p0.x, p0.y, p0.z);
                vertices.push(p1.x, p1.y, p1.z);
                vertices.push(p2.x, p2.y, p2.z);
                vertices.push(p3.x, p3.y, p3.z);

                faces.push(baseIdx, baseIdx+1, baseIdx+2);
                faces.push(baseIdx+1, baseIdx+3, baseIdx+2);

                const avgI = (I1 + I2 + I3 + I4) / 4;
                const t = avgI / maxInt;
                const color = new THREE.Color().setHSL(0.15, 0.8, 0.3 + t * 0.5);
                for (let k = 0; k < 4; k++) colors.push(color.r, color.g, color.b);
            }
        }

        if (vertices.length > 0) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geometry.setIndex(faces);
            const material = new THREE.MeshBasicMaterial({
                vertexColors: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide
            });
            currentGroup.add(new THREE.Mesh(geometry, material));
        }
    }
 
    scene.add(currentGroup);

    document.getElementById('manufacturer').textContent = data.manufacturer || '-';
    document.getElementById('luminaire').textContent = data.luminaire || '-';
    document.getElementById('lamp-type').textContent = data.lampType || '-';
    document.getElementById('unit').textContent = data.unit;
    document.getElementById('lamp-count').textContent = data.nLamps;
    document.getElementById('lumen').textContent = data.lumen.toFixed(0);
    document.getElementById('vert-count').textContent = data.gamma.length;
    document.getElementById('horiz-count').textContent = data.phi.length;
    document.getElementById('max-intensity').textContent = maxInt.toFixed(2);
    document.getElementById('intensity-range').textContent = `${data.minInt.toFixed(2)} - ${maxInt.toFixed(2)}`;
    
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) {
        infoPanel.style.display = 'block';
    }
    
    clearIlluminanceMap();
}

function animate() {
    requestAnimationFrame(animate);

    const orbitTarget = controls ? controls.target : new THREE.Vector3(0, 4.75, 0);

    if (zoomTargetDistance !== null && zoomCurrentDistance !== null) {
        const currentDist = camera.position.distanceTo(orbitTarget);
        const diff = zoomTargetDistance - currentDist;

        if (Math.abs(diff) > 0.01) {
            const newDist = currentDist + diff * 0.1;
            const direction = new THREE.Vector3().subVectors(camera.position, orbitTarget).normalize();
            camera.position.copy(direction.multiplyScalar(newDist).add(orbitTarget));
        }
    }

    if (controls) {
        controls.update();
    }
    
    updateFloatingActionsPosition();
    
    
    renderer.render(scene, camera);
}

function toggleMovePoleMode() {
    movePoleMode = !movePoleMode;
    
    const btn = document.getElementById('move-pole-btn');
    const status = document.getElementById('move-pole-status');
    const actions = document.getElementById('move-pole-actions');
    const floatingActions = document.getElementById('floating-move-actions');
    
    if (movePoleMode) {
        if (poleGroup) {
            originalPolePosition = poleGroup.position.clone();
        }
        originalMapOffsetX = mapOffsetX;
        originalMapOffsetZ = mapOffsetZ;
        controls.enabled = false;
        camera.position.set(0, 30, 0.1);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        btn.style.display = 'none';
        actions.style.display = 'none';
        floatingActions.style.display = 'flex';
        status.style.display = 'block';
        document.body.style.cursor = 'grab';
    } else {
        controls.enabled = true;
        btn.style.display = 'block';
        actions.style.display = 'none';
        floatingActions.style.display = 'none';
        status.style.display = 'none';
        document.body.style.cursor = 'default';
        isDragging = false;
    }
}

function confirmMovePole() {
    movePoleMode = false;
    const btn = document.getElementById('move-pole-btn');
    const status = document.getElementById('move-pole-status');
    const actions = document.getElementById('move-pole-actions');
    const floatingActions = document.getElementById('floating-move-actions');
    controls.enabled = true;
    btn.style.display = 'block';
    actions.style.display = 'none';
    floatingActions.style.display = 'none';
    status.style.display = 'none';
    document.body.style.cursor = 'default';
    isDragging = false;
}

function rotateMapCW() {
    if (!mapMesh) return;
    
    const currentRotation = mapMesh.rotation.z;
    const newRotation = currentRotation + THREE.MathUtils.degToRad(5);
    
    mapMesh.rotation.z = newRotation;
    
    const degrees = Math.round(THREE.MathUtils.radToDeg(newRotation) % 360);
    const input = document.getElementById('map-rotation-input');
    if (input) {
        input.value = degrees < 0 ? degrees + 360 : degrees;
    }
}

function rotateMapCCW() {
    if (!mapMesh) return;
    
    const currentRotation = mapMesh.rotation.z;
    const newRotation = currentRotation - THREE.MathUtils.degToRad(5);
    
    mapMesh.rotation.z = newRotation;
    
    const degrees = Math.round(THREE.MathUtils.radToDeg(newRotation) % 360);
    const input = document.getElementById('map-rotation-input');
    if (input) {
        input.value = degrees < 0 ? degrees + 360 : degrees;
    }
}

function cancelMovePole() {
    if (poleGroup && originalPolePosition) {
        poleGroup.position.copy(originalPolePosition);
    }
    mapOffsetX = originalMapOffsetX;
    mapOffsetZ = originalMapOffsetZ;
    if (mapMesh) {
        mapMesh.position.x = originalMapOffsetX;
        mapMesh.position.z = originalMapOffsetZ;
    }
    if (illuminanceMesh) {
        illuminanceMesh.position.x = originalMapOffsetX;
        illuminanceMesh.position.z = originalMapOffsetZ;
    }
    movePoleMode = false;
    const btn = document.getElementById('move-pole-btn');
    const status = document.getElementById('move-pole-status');
    const actions = document.getElementById('move-pole-actions');
    const floatingActions = document.getElementById('floating-move-actions');
    controls.enabled = true;
    btn.style.display = 'block';
    actions.style.display = 'none';
    floatingActions.style.display = 'none';
    status.style.display = 'none';
    document.body.style.cursor = 'default';
    isDragging = false;
}

function updateFloatingActionsPosition() {
    if (!movePoleMode) return;
    
    const floatingActions = document.getElementById('floating-move-actions');
    if (!floatingActions || floatingActions.style.display === 'none') return;
    
    if (!poleGroup || !camera) return;
    
    const polePosition = new THREE.Vector3();
    poleGroup.getWorldPosition(polePosition);
    
    const screenPosition = polePosition.clone().project(camera);
    
    const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
    const y = (screenPosition.y * -0.5 + 0.5) * window.innerHeight;
    
    const poleTopPosition = polePosition.clone();
    poleTopPosition.y += poleHeight || 5;
    
    const screenTopPosition = poleTopPosition.clone().project(camera);
    const topX = (screenTopPosition.x * 0.5 + 0.5) * window.innerWidth;
    const topY = (screenTopPosition.y * -0.5 + 0.5) * window.innerHeight;
    
    const buttonHeight = 32;
    const buttonGap = 4;
    const totalHeight = buttonHeight * 4 + buttonGap * 3;
    
    let finalX = topX + 120;
    if (finalX + 100 > window.innerWidth) {
        finalX = window.innerWidth - 100;
    }
    
    let finalY = topY - totalHeight / 2 + 50;
    if (finalY + totalHeight > window.innerHeight - 70) {
        finalY = window.innerHeight - totalHeight - 70;
    }
    if (finalY < 0) {
        finalY = 10;
    }
    
    floatingActions.style.left = finalX + 'px';
    floatingActions.style.top = finalY + 'px';
}

function onMouseDown(event) {
    if (!movePoleMode) return;
    
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
    document.body.style.cursor = 'grabbing';
    event.preventDefault();
}

function onMouseMove(event) {
    if (!movePoleMode || !isDragging) return;
    
    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;
    
    const cameraDistance = camera.position.length();
    const sensitivity = cameraDistance * 0.002;
    
    const moveX = deltaX * sensitivity;
    const moveZ = deltaY * sensitivity;
    
    moveMap(moveX, moveZ);
    
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
    
    event.preventDefault();
}

function onMouseUp() {
    if (movePoleMode) {
        isDragging = false;
        document.body.style.cursor = 'grab';
    }
}

let touchStartDistance = null;
let touchStartCameraDistance = null;
let lastTouchCenterX = 0;
let lastTouchCenterY = 0;

function onTouchStart(event) {
    
    const touches = event.touches;
    
    if (touches.length === 1) {
        previousMousePosition = {
            x: touches[0].clientX,
            y: touches[0].clientY
        };
        
        if (movePoleMode) {
            isDragging = true;
        }
    } else if (touches.length === 2) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        touchStartDistance = Math.sqrt(dx * dx + dy * dy);
        touchStartCameraDistance = camera.position.distanceTo(controls.target);
        
        lastTouchCenterX = (touches[0].clientX + touches[1].clientX) / 2;
        lastTouchCenterY = (touches[0].clientY + touches[1].clientY) / 2;
    }
}

function onTouchMove(event) {
    const touches = event.touches;
    
    if (touches.length === 1) {
        if (!previousMousePosition) return;
        
        const deltaX = touches[0].clientX - previousMousePosition.x;
        const deltaY = touches[0].clientY - previousMousePosition.y;
        
        if (movePoleMode) {
            const cameraDistance = camera.position.length();
            const sensitivity = cameraDistance * 0.002;
            
            const moveX = deltaX * sensitivity;
            const moveZ = deltaY * sensitivity;
            
            moveMap(moveX, moveZ);
        } else if (controls.enabled) {
            if (typeof controls.rotateLeft === 'function') {
                controls.rotateLeft(deltaX * 0.005);
                controls.rotateUp(deltaY * 0.005);
            } else if (typeof controls.rotateX === 'function') {
                controls.rotateX(deltaY * 0.005);
                controls.rotateY(deltaX * 0.005);
            } else {
                if (controls.target) {
                    const spherical = new THREE.Spherical().setFromVector3(camera.position);
                    spherical.theta -= deltaX * 0.005;
                    spherical.phi += deltaY * 0.005;
                    spherical.makeSafe();
                    camera.position.setFromSpherical(spherical);
                    camera.lookAt(controls.target);
                }
            }
        }
        
        previousMousePosition = {
            x: touches[0].clientX,
            y: touches[0].clientY
        };
    } else if (touches.length === 2) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        if (touchStartDistance && touchStartCameraDistance) {
            const scale = currentDistance / touchStartDistance;
            const newDistance = touchStartCameraDistance / scale;
            
            const minDist = controls.minDistance;
            const maxDist = controls.maxDistance;
            const clampedDistance = Math.max(minDist, Math.min(maxDist, newDistance));
            
            const direction = camera.position.clone().sub(controls.target).normalize();
            camera.position.copy(controls.target).add(direction.multiplyScalar(clampedDistance));
            
            zoomTargetDistance = clampedDistance;
            zoomCurrentDistance = clampedDistance;
        }
        
        lastTouchCenterX = (touches[0].clientX + touches[1].clientX) / 2;
        lastTouchCenterY = (touches[0].clientY + touches[1].clientY) / 2;
    }
}

function onTouchEnd() {
    touchStartDistance = null;
    touchStartCameraDistance = null;
    
    if (movePoleMode) {
        isDragging = false;
    }
}

function moveMap(deltaX, deltaZ) {
    mapOffsetX += deltaX;
    mapOffsetZ += deltaZ;
    
    if (mapMesh) {
        mapMesh.position.x = mapOffsetX;
        mapMesh.position.z = mapOffsetZ;
    }
    
    if (illuminanceMesh) {
        illuminanceMesh.position.x = mapOffsetX;
        illuminanceMesh.position.z = mapOffsetZ;
    }
    
    updateMovableElements(deltaX, deltaZ);
}

function updateMovableElements(deltaX, deltaZ) {
}

function onWindowResize() {
    syncAppLayout();
}
 
let currentColorTemp = 'warm';
window.currentColorTemp = currentColorTemp;
let lampEnabled = true;

function handleWattageChange(e) {
    const wattage = parseInt(e.target.value);
    document.getElementById('wattage-input').value = wattage;
    lampPower = wattage;
    window.lampPower = lampPower;
    updatePanelState('lighting-panel', true);
}

function handleWattageInputChange(e) {
    let wattage = parseInt(e.target.value);
    
    if (isNaN(wattage) || wattage < 1) {
        wattage = 1;
    } else if (wattage > 500) {
        wattage = 500;
    }
    
    e.target.value = wattage;
    document.getElementById('wattage-slider').value = wattage;
    lampPower = wattage;
    window.lampPower = lampPower;
    updatePanelState('lighting-panel', true);
}

function handleRotationChange(e) {
    const degrees = parseInt(e.target.value);
    document.getElementById('rotation-input').value = degrees;
    lightRotation = THREE.MathUtils.degToRad(degrees);
    updatePanelState('lighting-panel', true);
    if (currentData) {
        createIlluminanceMap(currentData);
    }
}

function handleRotationInputChange(e) {
    const input = document.getElementById('rotation-input');
    let degrees = parseInt(input.value);
    
    if (isNaN(degrees) || degrees < 0) {
        degrees = 0;
    } else if (degrees > 360) {
        degrees = 360;
    }
    
    input.value = degrees;
    const slider = document.getElementById('rotation-slider');
    if (slider) slider.value = degrees;
    lightRotation = THREE.MathUtils.degToRad(degrees);
    updatePanelState('lighting-panel', true);
    if (currentData) {
        createIlluminanceMap(currentData);
    }
}

function rotateLight(degrees) {
    let currentDegrees = THREE.MathUtils.radToDeg(lightRotation);
    currentDegrees += degrees;
    currentDegrees = ((currentDegrees % 360) + 360) % 360;
    document.getElementById('rotation-slider').value = currentDegrees;
    document.getElementById('rotation-input').value = currentDegrees;
    lightRotation = THREE.MathUtils.degToRad(currentDegrees);
    updatePanelState('lighting-panel', true);
    if (currentData) {
        createIlluminanceMap(currentData);
    }
}

function applyColorTempToRGB(r, g, b, kelvin) {
    const tempColor = kelvinToRGB(kelvin);
    const tr = (tempColor >> 16) & 255;
    const tg = (tempColor >> 8) & 255;
    const tb = tempColor & 255;
    
    const mixFactor = 0.6;
    
    const newR = Math.round(r * (1 - mixFactor) + tr * mixFactor);
    const newG = Math.round(g * (1 - mixFactor) + tg * mixFactor);
    const newB = Math.round(b * (1 - mixFactor) + tb * mixFactor);
    
    return { r: newR, g: newG, b: newB };
}

function kelvinToRGB(kelvin) {
    let temp = kelvin / 100;
    let red, green, blue;
    
    if (temp <= 66) {
        red = 255;
        green = Math.round(99.4708025861 * Math.log(temp) - 161.1195681661);
        if (temp <= 19) {
            blue = 0;
        } else {
            blue = Math.round(138.5177312231 * Math.log(temp - 10) - 305.0447927307);
        }
    } else {
        red = Math.round(329.698727446 * Math.pow(temp - 60, -0.1332047592));
        green = Math.round(288.1221695283 * Math.pow(temp - 60, -0.0755148492));
        blue = 255;
    }
    
    red = Math.max(0, Math.min(255, red));
    green = Math.max(0, Math.min(255, green));
    blue = Math.max(0, Math.min(255, blue));
    
    return (red << 16) | (green << 8) | blue;
}

function handleColorTempChange(temp) {
    currentColorTemp = parseInt(temp);
    window.currentColorTemp = currentColorTemp;
    
    document.querySelectorAll('.btn-temp').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-temp="${temp}"]`).classList.add('active');
    
    updatePanelState('lighting-panel', true);
    
    const lightColor = kelvinToRGB(currentColorTemp);
    
    scene.children.forEach(child => {
        if (child instanceof THREE.AmbientLight) {
            child.color.setHex(lightColor);
        }
    });
    
    scene.traverse(child => {
        if (child instanceof THREE.PointLight || child instanceof THREE.SpotLight) {
            child.color.setHex(lightColor);
        }
    });
    
    if (currentData && illuminanceMesh) {
        createIlluminanceMap(currentData);
    }
}

function handleLampToggle(e) {
    lampEnabled = e.target.checked;
}

function applyLightingSettings() {
    /* if (!lampEnabled) {
        lampPower = 0;
    } */
    
    /* if (currentData) {
        createIlluminanceMap(currentData);
    } */
    
    const colorTempText = currentColorTemp === 'warm' ? 'Warm' : (currentColorTemp === 'neutral' ? 'Neutral' : 'Cool');
    updateTopInfo('lighting', '💡', `lighting: ${lampPower}W | ${colorTempText} | turn ${Math.round(lightRotation * 180 / Math.PI)}°`, '#FFC107');
}

function initPanelDrag() {
    const panels = document.querySelectorAll('.draggable-panel');
    
    panels.forEach(panel => {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        panel.appendChild(resizeHandle);
        
        let isDragging = false;
        let isResizing = false;
        let startX, startY;
        let startLeft, startTop;
        let startWidth, startHeight;
        
        panel.addEventListener('mousedown', (e) => {
            if (e.target === resizeHandle) {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = panel.offsetWidth;
                startHeight = panel.offsetHeight;
                e.preventDefault();
            } else {
                if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select')) {
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startLeft = panel.offsetLeft;
                    startTop = panel.offsetTop;
                    panel.style.zIndex = 200;
                    e.preventDefault();
                }
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                let newLeft = startLeft + dx;
                let newTop = startTop + dy;
                
                newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
                
                panel.style.left = newLeft + 'px';
                panel.style.top = newTop + 'px';
                panel.style.transform = 'none';
            } else if (isResizing) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                let newWidth = startWidth + dx;
                let newHeight = startHeight + dy;
                
                newWidth = Math.max(150, newWidth);
                newHeight = Math.max(100, newHeight);
                
                panel.style.width = newWidth + 'px';
                panel.style.height = newHeight + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            isResizing = false;
            panel.style.zIndex = 100;
        });
    });
}

function generateReport() {
    console.log('[Report] generateReport called');

    const productKey = 'i6_report';
    if (!checkPurchaseStatus(productKey)) {
        console.log('[Report] User not purchased, showing purchase modal');
        showPurchaseModal(productKey);
        return;
    }

    console.log('[Report] currentData exists:', !!window.currentData);
    if (window.currentData) {
        console.log('[Report] currentData:', JSON.stringify(window.currentData, null, 2).substring(0, 200) + '...');
    }

    if (!currentData) {
        console.log('[Report] No currentData, showing alert');
        alert('Please upload an IES file or load the default file');
        return;
    }

    try {
        const originalCameraPosition = camera.position.clone();
        const originalCameraTarget = controls.target.clone();
        
        camera.position.set(0, 200, 0.1);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        
        renderer.render(scene, camera);
        
        const screenshotData = renderer.domElement.toDataURL('image/png');
        
        camera.position.copy(originalCameraPosition);
        camera.lookAt(originalCameraTarget);
        controls.target.copy(originalCameraTarget);
        renderer.render(scene, camera);
        
        const reportData = collectReportData();
        reportData.screenshot = screenshotData;
        console.log('[Report] reportData collected successfully');
        
        renderReportInModal(reportData);
        console.log('[Report] Report rendered in modal');
    } catch (error) {
        console.error('[Report] Error generating report:', error);
        alert('Error generating report: ' + error.message);
    }
}

function renderReportInModal(data) {
    console.log('[Report] renderReportInModal called');
    
    const oldModal = document.getElementById('reportModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'reportModal';
    
    modal.innerHTML = `
        <style>
            #reportModal {
                display: flex !important;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 99999;
                justify-content: center;
                align-items: center;
                padding: 20px;
                overflow-y: auto;
            }
            
            #reportModal .report-modal-content {
                background: white;
                border-radius: 12px;
                max-width: 900px;
                width: 90%;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                position: relative;
            }
            
            #reportModal .report-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 2px solid #667eea;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px 12px 0 0;
            }
            
            #reportModal .report-modal-header h3 {
                margin: 0;
                font-size: 18px;
            }
            
            #reportModal .close-report-btn {
                width: 32px;
                height: 32px;
                border: none;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border-radius: 50%;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            
            #reportModal .close-report-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            #reportModal .report-modal-body {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                color: #333;
                max-height: 60vh;
            }
            
            #reportModal .report-modal-footer {
                padding: 16px 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            #reportModal .report-modal-btn {
                padding: 10px 24px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            #reportModal .report-modal-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            #reportModal .report-modal-btn-secondary {
                background: #f0f0f0;
                color: #666;
            }
            
            #reportModal .report-section { margin-bottom: 24px; }
            
            #reportModal .report-section-title {
                font-size: 16px;
                font-weight: bold;
                color: #667eea;
                margin-bottom: 12px;
                padding-left: 10px;
                border-left: 4px solid #667eea;
            }
            
            #reportModal .report-info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 12px;
            }
            
            #reportModal .report-info-item {
                padding: 12px;
                background: #f9f9f9;
                border-radius: 8px;
            }
            
            #reportModal .report-info-label {
                font-size: 12px;
                color: #888;
                margin-bottom: 4px;
            }
            
            #reportModal .report-info-value {
                font-size: 14px;
                font-weight: 600;
                color: #333;
            }
            
            #reportModal .report-stats-cards {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                margin-top: 12px;
            }
            
            #reportModal .report-stat-card {
                text-align: center;
                padding: 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 8px;
            }
            
            #reportModal .report-stat-label { font-size: 11px; opacity: 0.9; }
            #reportModal .report-stat-value { font-size: 20px; font-weight: bold; margin: 4px 0; }
            #reportModal .report-stat-unit { font-size: 11px; opacity: 0.9; }
            
            #reportModal .report-legend-container {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                padding: 16px;
                background: #f9f9f9;
                border-radius: 8px;
                margin-top: 12px;
            }
            
            #reportModal .report-legend-item { display: flex; align-items: center; gap: 6px; }
            #reportModal .report-legend-color { width: 20px; height: 20px; border-radius: 4px; }
            
            #reportModal .report-screenshot-container {
                margin-top: 12px;
                border-radius: 8px;
                overflow: hidden;
                background: #f9f9f9;
                padding: 10px;
            }
            
            #reportModal .report-screenshot-img {
                width: 100%;
                max-height: 500px;
                object-fit: contain;
                border-radius: 4px;
            }
            
            @media (max-width: 600px) {
                #reportModal .report-stats-cards { grid-template-columns: 1fr; }
                #reportModal .report-modal-content { width: 95%; margin: 10px; }
            }
        </style>
        
        <div class="report-modal-content">
            <div class="report-modal-header">
                <h3>📊 Lighting Simulation Report</h3>
                <button class="close-report-btn" onclick="document.getElementById('reportModal').remove();">×</button>
            </div>
            <div class="report-modal-body">
                <div class="report-section">
                    <div class="report-section-title">📋 Product Information</div>
                    <div class="report-info-grid">
                        ${data.productInfo.map(([label, value]) => `
                            <div class="report-info-item">
                                <div class="report-info-label">${label}</div>
                                <div class="report-info-value">${value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="report-section">
                    <div class="report-section-title">⚙️ Lighting Settings</div>
                    <div class="report-info-grid">
                        ${data.lightingSettings.map(([label, value]) => `
                            <div class="report-info-item">
                                <div class="report-info-label">${label}</div>
                                <div class="report-info-value">${value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="report-section">
                    <div class="report-section-title">📈 Illuminance Statistics</div>
                    <div class="report-stats-cards">
                        <div class="report-stat-card">
                            <div class="report-stat-label">Max Illuminance</div>
                            <div class="report-stat-value">${data.stats.max}</div>
                            <div class="report-stat-unit">${data.unit}</div>
                        </div>
                        <div class="report-stat-card">
                            <div class="report-stat-label">Min Illuminance</div>
                            <div class="report-stat-value">${data.stats.min}</div>
                            <div class="report-stat-unit">${data.unit}</div>
                        </div>
                        <div class="report-stat-card">
                            <div class="report-stat-label">Average Illuminance</div>
                            <div class="report-stat-value">${data.stats.avg}</div>
                            <div class="report-stat-unit">${data.unit}</div>
                        </div>
                    </div>
                </div>
                
                <div class="report-section">
                    <div class="report-section-title">🎨 Illuminance Legend</div>
                    <div class="report-legend-container">
                        ${data.legendData.map(item => `
                            <div class="report-legend-item">
                                <div class="report-legend-color" style="background-color: ${item.color}"></div>
                                <span style="font-size: 12px;">${item.label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                ${data.screenshot ? `
                <div class="report-section">
                    <div class="report-section-title">📷 Illuminance Map Overview</div>
                    <div class="report-screenshot-container">
                        <img src="${data.screenshot}" alt="Illuminance Map Screenshot" class="report-screenshot-img">
                    </div>
                </div>
                ` : ''}
                
                <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
                    IES 3D Lighting Simulation Report<br>
                    Generated: ${data.generatedDate}
                </div>
            </div>
            <div class="report-modal-footer">
                <button class="report-modal-btn report-modal-btn-secondary" onclick="document.getElementById('reportModal').remove();">Close</button>
                <!-- <button class="report-modal-btn report-modal-btn-primary" onclick="window.print()">Print Report</button> -->
            </div>
        </div>
    `;
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
    console.log('[Report] Modal added to body');
}

function setupReportModalClose() {
    const modal = document.getElementById('reportModal');
    const closeBtn = document.getElementById('closeReportBtn');
    const reportCloseBtn = document.getElementById('reportCloseBtn');
    
    closeBtn?.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    reportCloseBtn?.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    modal?.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function collectReportData() {
    const data = window.currentData || {};
    const height = window.lightHeight || 5;
    const power = window.lampPower || 60;
    const colorTemp = window.currentColorTemp || 'warm';
    const gridRes = window.gridResolution || 15;
    const unit = window.illuminanceUnit || 'fc';
    const scale = window.scaleFactor || 1;
    
    const productInfo = [
        ['Manufacturer', data.manufacturer || '-'],
        ['Luminaire', data.luminaire || '-'],
        ['Lamp Type', data.lampType || '-'],
        ['Unit', data.unit || '-'],
        ['Lamps', (data.nLamps || 1).toString()],
        ['Lumen', (data.lumen || 0).toFixed(0) + ' lm'],
        ['Vertical Angles', (data.verticalAngles?.length || 0).toString()],
        ['Horizontal Angles', (data.horizontalAngles?.length || 0).toString()],
        ['Max Intensity', (data.maxIntensity?.toFixed(2) || '-')],
        ['Intensity Range', (data.minInt?.toFixed(2) || '-') + ' - ' + (data.maxIntensity?.toFixed(2) || '-')]
    ];
    
    const lightingSettings = [
        ['Light Height', height + ' m'],
        ['Power', power + ' W'],
        ['Color Temp', colorTemp === 'warm' ? 'Warm' : colorTemp === 'neutral' ? 'Neutral' : 'Cool'],
        ['Grid Resolution', gridRes === 10 ? 'Low' : gridRes === 20 ? 'Medium' : gridRes === 30 ? 'High' : gridRes === 50 ? 'Ultra' : 'Extreme'],
        ['Illuminance Unit', unit.toUpperCase()],
        ['Scale', '1 unit = ' + scale.toFixed(3) + ' m']
    ];
    
    const maxLux = parseFloat(document.getElementById('max-illuminance')?.textContent || '0');
    const minLux = parseFloat(document.getElementById('min-illuminance')?.textContent || '0');
    const avgLux = parseFloat(document.getElementById('avg-illuminance')?.textContent || '0');
    
    const stats = {
        max: maxLux.toFixed(2),
        min: minLux.toFixed(2),
        avg: avgLux.toFixed(2)
    };
    
    const legendData = generateLegendData(unit);
    
    return {
        generatedDate: new Date().toLocaleString('en-US'),
        productInfo,
        lightingSettings,
        stats,
        unit: unit.toUpperCase(),
        legendData
    };
}

function generateLegendData(unit) {
    const thresholds = unit === 'lux' 
        ? [[0, 5], [5, 10], [10, 20], [20, 50], [50, 100], [100, Infinity]]
        : [[0, 0.5], [0.5, 1], [1, 2], [2, 5], [5, 10], [10, Infinity]];
    
    const colors = ['#2a2a2a', '#0080ff', '#00ffff', '#80ff80', '#ffff00', '#ff8000'];
    
    return thresholds.map(([min, max], index) => ({
        color: colors[index],
        label: max === Infinity ? `> ${min}` : `${min} - ${max}`
    }));
}
 

function handlePanelOpened(panelId) {
    setTimeout(() => {
        try {
            switch (panelId) {
                case 'map-panel':
                    console.log('[Panel] Map panel opened, please select a map');
                    break;
                case 'upload-panel':
                    break;
                case 'illuminance-panel':
                    if (typeof syncAppLayout === 'function') {
                        syncAppLayout();
                    }
                    break;
                default:
                    break;
            }
            if (typeof syncAppLayout === 'function') {
                syncAppLayout();
            }
        } catch (e) {
            console.error('[Panel] handlePanelOpened error:', e);
        }
    }, 50);
}

window.openPanel = function(panelId) {
    console.log('openPanel called with:', panelId);

    const navItems = document.querySelectorAll('#mobile-nav .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    const activeNav = document.querySelector(`#mobile-nav .nav-item[data-panel="${panelId}"]`);
    if (activeNav) activeNav.classList.add('active');

    const panelContents = document.querySelectorAll('.panel-content');
    panelContents.forEach(content => {
        content.classList.remove('active');
    });

    const panelContent = document.getElementById(`${panelId}-content`);
    if (panelContent) {
        panelContent.classList.add('active');
        console.log('Panel opened:', panelId);

        if (panelId === 'lighting-panel') {
            const mainOptions = document.getElementById('lighting-main-options');
            const settingsContent = document.getElementById('lighting-settings-content');
            if (mainOptions) mainOptions.style.display = 'flex';
            if (settingsContent) settingsContent.style.display = 'none';
        }

        handlePanelOpened(panelId);
    }
};

window.closeAllPanels = function() {
    const navItems = document.querySelectorAll('#mobile-nav .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    const panelContents = document.querySelectorAll('.panel-content');
    panelContents.forEach(content => {
        content.classList.remove('active');
    });
};

window.toggleLeftPanel = function() {
    const panel = document.getElementById('controls-panel-left');
    const minimizeBtn = document.getElementById('minimize-left-panel');
    
    if (panel.classList.contains('minimized')) {
        panel.classList.remove('minimized');
        minimizeBtn.textContent = '−';
    } else {
        panel.classList.add('minimized');
        minimizeBtn.textContent = '+';
    }
};

window.resetPanel = resetPanel;

window.resetAllPanels = resetAllPanels;

window.showCustomConfirm = showCustomConfirm;

window.__navTap = function(panelId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    openPanel(panelId);
};

document.addEventListener('click', function(e) {
    const isClickInsidePanel = e.target.closest('.panel-content');
    const isClickOnNav = e.target.closest('#mobile-nav');
    
    if (!isClickInsidePanel && !isClickOnNav) {
        closeAllPanels();
    }
});

document.addEventListener('click', function(e) {
    if (e.target.closest('.panel-content')) {
        e.stopPropagation();
    }
});

let appBootstrapped = false;

function bootstrapApp() {
    if (appBootstrapped) return;
    if (!document.getElementById('mobile-nav')) return;
    appBootstrapped = true;

    console.log('DOM loaded, initializing...');
    
    localStorage.removeItem('panelStates');
    
    Object.keys(topInfoItems).forEach(key => {
        topInfoItems[key] = null;
    });
    
    const infoBar = document.getElementById('top-info-bar');
    if (infoBar) {
        infoBar.style.display = 'none';
    }
    
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) {
        infoPanel.style.display = 'none';
    }

    const illuminanceInfoPanel = document.getElementById('illuminance-info-panel');
    if (illuminanceInfoPanel) {
        illuminanceInfoPanel.style.display = 'none';
    }

    const reportContainer = document.getElementById('generate-report-container');
    if (reportContainer) {
        reportContainer.style.display = 'none';
    }
    
    init();
    initEventListeners();
    initConfirmDialogListeners();
    syncAppLayout();
    
    window.addEventListener('resize', syncAppLayout, false);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncAppLayout);
    }
    
    updateLabelsFromTopInfo();

    scheduleInitialContent();
}

function scheduleInitialContent() {
    let loaded = false;
    const load = () => {
        if (loaded) return;
        loaded = true;
    };

    if (typeof plus !== 'undefined') {
        load();
        return;
    }

    document.addEventListener('plusready', load, { once: true });
    load();
}

document.addEventListener('DOMContentLoaded', bootstrapApp);
document.addEventListener('plusready', function() {
    syncAppLayout();
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        setTimeout(syncAppLayout, 100);
        setTimeout(syncAppLayout, 300);
        setTimeout(syncAppLayout, 500);
    }
    if (!appBootstrapped) {
        bootstrapApp();
    }
    setupPaymentQueueListener();
});

if (document.readyState !== 'loading') {
    bootstrapApp();
}
