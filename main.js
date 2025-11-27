// --- グローバル変数 ---
const DEFAULT_PARAMS = {
    gacha: '45',
    seed: '123456789',
    ng: 'none',
    fs: 'none',
    lr: null,
    comp: false,
    tx: false,
    roll: 100,
    displaySeed: '0'
};

// ハイライト状態管理
let currentHighlightMode = 'all'; // 'all', 'single', 'multi'
let activeGachaId;
let forceRerollMode = false;

// グローバルスコープへ公開（viewスクリプトからの参照用）
window.activeGachaId = activeGachaId;
window.forceRerollMode = forceRerollMode;

// --- ディスパッチャー & メイン ---

function runSimulationAndDisplay(options = {}) {
    const { hideSeedInput = false, uiOverrides = {} } = options;
    const params = new URLSearchParams(window.location.search);
    const latestGachaId = Object.keys(gachaMaster).reduce((a, b) => parseInt(a) > parseInt(b) ? a : b);
    
    const p = {};
    ['gacha', 'seed', 'ng', 'fs', 'lr', 'comp', 'tx', 'roll', 'displaySeed'].forEach(k => {
        p[k] = params.get(k);
    });
    if (!p.gacha || !gachaMaster[p.gacha]) p.gacha = latestGachaId;
    if (!p.seed) p.seed = DEFAULT_PARAMS.seed;
    if (!p.roll) p.roll = DEFAULT_PARAMS.roll;
    if (!p.ng) p.ng = DEFAULT_PARAMS.ng;
    if (p.tx === 'true') p.tx = '1'; else if (p.tx === 'false') p.tx = '0';
    if (!p.tx && DEFAULT_PARAMS.tx) p.tx = '1';
    if (p.comp === '1') p.comp = 'true'; else if (p.comp === '0') p.comp = 'false';
    
    if (uiOverrides.seed !== undefined) p.seed = uiOverrides.seed;
    if (uiOverrides.guaranteedRolls !== undefined) p.ng = uiOverrides.guaranteedRolls;
    if (uiOverrides.featuredStock !== undefined) p.fs = uiOverrides.featuredStock;
    if (uiOverrides.isComplete !== undefined) p.comp = uiOverrides.isComplete ? 'true' : 'false';
    
    activeGachaId = p.gacha;
    window.activeGachaId = activeGachaId; // 更新
    
    const gacha = gachaMaster[p.gacha];
    
    document.getElementById('seedInput').value = p.seed;
    const isComplete = (p.comp === 'true');
    document.getElementById('featuredCompleteCheckbox').checked = isComplete;
    
    if (gacha.featuredItemStock === 0) {
        document.getElementById('featuredCompleteCheckbox').checked = true;
        document.getElementById('featuredCompleteCheckbox').parentElement.classList.add('hidden-control');
    } else {
        document.getElementById('featuredCompleteCheckbox').parentElement.classList.remove('hidden-control');
    }
    
    const isComp = document.getElementById('featuredCompleteCheckbox').checked;
    const stockControl = document.getElementById('stockControl');
    const guaranteedControl = document.getElementById('guaranteedControl');
    const legendDisplay = document.getElementById('legendDisplay');

    populateFeaturedStockInput(p.gacha, p.fs);

    const legendCommon = document.getElementById('legendCommon');
    if (isComp) {
        stockControl.classList.add('hidden-control');
        if (gacha.uberGuaranteedFlag || gacha.legendGuaranteedFlag) {
            guaranteedControl.classList.remove('hidden-control');
            legendDisplay.classList.remove('hidden-control');
            populateGuaranteedRolls(10, p.ng);
        } else {
            guaranteedControl.classList.add('hidden-control');
            legendDisplay.classList.add('hidden-control');
        }
        legendCommon.style.display = 'inline-block';
    } else {
        stockControl.classList.remove('hidden-control');
        guaranteedControl.classList.remove('hidden-control');
        legendDisplay.classList.remove('hidden-control');
        populateGuaranteedRolls(gacha.guaranteedCycle || 30, p.ng);
        legendCommon.style.display = 'none'; 
    }

    const lastRollDisplay = document.getElementById('lastRollDisplay');
    if (p.lr && itemMaster[p.lr]) {
        lastRollDisplay.textContent = `LastRoll: ${itemMaster[p.lr].name}`;
    } else {
        lastRollDisplay.textContent = '';
    }

    const newParams = {
        gacha: p.gacha, seed: p.seed, ng: p.ng, fs: p.fs, lr: p.lr,
        comp: isComp ? 'true' : 'false',
        tx: (p.tx === '1' || (!hideSeedInput && document.getElementById('seedRow').classList.contains('hidden-control') === false)) ? '1' : '0',
        roll: p.roll, displaySeed: p.displaySeed
    };
    if (!hideSeedInput && document.getElementById('seedRow').style.display === 'flex') newParams.tx = '1';

    const newQuery = generateUrlQuery(newParams);
    window.history.replaceState({ path: newQuery }, '', `${window.location.pathname}${newQuery}`);

    const seedValue = parseInt(p.seed, 10);
    const lastRollId = p.lr ? parseInt(p.lr, 10) : null;
    const rows = parseInt(p.roll, 10);
    const thresholds = {
        '0': gacha.rarityRates['0'],
        '1': gacha.rarityRates['0'] + gacha.rarityRates['1'],
        '2': gacha.rarityRates['0'] + gacha.rarityRates['1'] + gacha.rarityRates['2'],
        '3': gacha.rarityRates['0'] + gacha.rarityRates['1'] + gacha.rarityRates['2'] + gacha.rarityRates['3'],
        '4': 10000
    };

    if (isComp) {
        createAndDisplayCompletedSeedView(seedValue, gacha, rows, thresholds, lastRollId, p.displaySeed, new URLSearchParams(newQuery), p.ng);
    } else {
        createAndDisplayUncompletedSeedView(seedValue, gacha, rows, thresholds, lastRollId, p.displaySeed, new URLSearchParams(newQuery));
    }
}

function populateGuaranteedRolls(max, currentVal) {
    const input = document.getElementById('guaranteedRollsInput');
    input.innerHTML = '';
    const unsetOption = document.createElement('option');
    unsetOption.value = 'none'; unsetOption.textContent = '未設定'; input.appendChild(unsetOption);
    for (let i = 1; i <= max; i++) {
        const option = document.createElement('option'); option.value = i; option.textContent = i; input.appendChild(option);
    }
    if (currentVal && input.querySelector(`option[value="${currentVal}"]`)) {
        input.value = currentVal;
    } else {
        input.value = 'none';
    }
}
function populateFeaturedStockInput(gachaId, preferredValue) {
    const gacha = gachaMaster[gachaId];
    const input = document.getElementById('featuredStockInput');
    if (!gacha) return;
    input.innerHTML = '';
    const unsetOption = document.createElement('option');
    unsetOption.value = 'none'; unsetOption.textContent = '-'; input.appendChild(unsetOption);
    for (let i = 1; i <= gacha.featuredItemStock; i++) {
        const option = document.createElement('option'); option.value = i; option.textContent = i; input.appendChild(option);
    }
    if (preferredValue && preferredValue !== 'none' && input.querySelector(`option[value="${preferredValue}"]`)) {
        input.value = preferredValue;
    } else {
        input.value = 'none';
    }
}

function toggleSeedInput() {
    const seedRow = document.getElementById('seedRow');
    if (seedRow.classList.contains('hidden-control')) {
        seedRow.classList.remove('hidden-control');
    } else {
        seedRow.classList.add('hidden-control');
    }
}

// イベントリスナー設定
document.addEventListener('DOMContentLoaded', () => {
    setupGachaRarityItems(); // from utils.js

    document.getElementById('executeButton').addEventListener('click', () => runSimulationAndDisplay({ hideSeedInput: true, uiOverrides: { seed: document.getElementById('seedInput').value } }));
    document.getElementById('guaranteedRollsInput').addEventListener('change', (e) => runSimulationAndDisplay({ uiOverrides: { guaranteedRolls: e.target.value } }));
    document.getElementById('featuredStockInput').addEventListener('change', (e) => runSimulationAndDisplay({ uiOverrides: { featuredStock: e.target.value } }));
    document.getElementById('featuredCompleteCheckbox').addEventListener('change', () => runSimulationAndDisplay({ uiOverrides: { isComplete: document.getElementById('featuredCompleteCheckbox').checked } }));
    document.getElementById('copySeedLink').addEventListener('click', (event) => {
        event.preventDefault();
        const seedToCopy = new URLSearchParams(window.location.search).get('seed');
        if (seedToCopy && navigator.clipboard) {
            navigator.clipboard.writeText(seedToCopy).then(() => {
                const originalText = event.target.textContent;
                event.target.textContent = 'Copied!';
                setTimeout(() => { event.target.textContent = originalText; }, 1500);
            });
        }
    });
    document.getElementById('result-table-container').addEventListener('click', (event) => {
        if (event.target.id === 'forceRerollToggle') {
            window.forceRerollMode = !window.forceRerollMode;
            runSimulationAndDisplay();
        }
    });

    document.getElementById('showSeedInputLink').addEventListener('click', (e) => {
        e.preventDefault();
        toggleSeedInput();
    });

    const applyHighlightMode = () => {
         const table = document.querySelector('#result-table-container table');
         if (!table) return;
         table.classList.remove('mode-single', 'mode-multi');
         if (currentHighlightMode === 'single') table.classList.add('mode-single');
         if (currentHighlightMode === 'multi') table.classList.add('mode-multi');
    };

    document.getElementById('legendSingle').addEventListener('click', () => {
        if (document.getElementById('featuredCompleteCheckbox').checked) {
            currentHighlightMode = (currentHighlightMode === 'single') ? 'all' : 'single';
            applyHighlightMode();
        }
    });
    document.getElementById('legendMulti').addEventListener('click', () => {
        if (document.getElementById('featuredCompleteCheckbox').checked) {
            currentHighlightMode = (currentHighlightMode === 'multi') ? 'all' : 'multi';
            applyHighlightMode();
        }
    });

    document.getElementById('scrollToSingle').addEventListener('click', () => {
        const h2s = document.querySelectorAll('#calculation-details h2');
        for (const h2 of h2s) {
            if (h2.textContent.includes('＜単発ルート＞')) {
                h2.scrollIntoView({ behavior: 'smooth' });
                break;
            }
        }
    });

    document.getElementById('scrollToMulti').addEventListener('click', () => {
        const h2s = document.querySelectorAll('#calculation-details h2');
        for (const h2 of h2s) {
            if (h2.textContent.includes('＜10連ルート＞')) {
                h2.scrollIntoView({ behavior: 'smooth' });
                break;
            }
        }
    });

    runSimulationAndDisplay();
});