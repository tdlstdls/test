/** @file view_table.js @description ガチャ結果テーブルの描画と全UI機能の制御 */

const COLOR_ROUTE_HIGHLIGHT = '#aaddff';
const COLOR_ROUTE_UBER = '#66b2ff';

/** メイン描画関数 */
function generateRollsTable() {
    try {
        if (Object.keys(gachaMasterData.gachas).length === 0) return;
        const seedEl = document.getElementById('seed');
        if (!seedEl) return;
        
        let initialSeed = parseInt(seedEl.value, 10);
        if (isNaN(initialSeed)) { 
            initialSeed = 12345;
            seedEl.value = "12345"; 
        }
        
        const numRolls = currentRolls;
        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        // シミュレーションに必要な十分なシードを生成
        for (let i = 0; i < numRolls * 25 + 200; i++) seeds.push(rngForSeeds.next());
        
        const columnConfigs = prepareColumnConfigs();
        const tableData = executeTableSimulation(numRolls, columnConfigs, seeds);
        
        // ハイライト情報の取得
        const { highlightMap, guarHighlightMap, lastSeedValue } = preparePathHighlightMaps(initialSeed, seeds, numRolls);
        finalSeedForUpdate = lastSeedValue;

        const container = document.getElementById('rolls-table-container');
        if (!container) return;

        // 上部予測エリア
        let findAreaHtml = '';
        if (typeof generateFastForecast === 'function') findAreaHtml += generateFastForecast(initialSeed, columnConfigs);
        if (typeof generateMasterInfoHtml === 'function' && showFindInfo && isMasterInfoVisible) {
            findAreaHtml += `<div id="master-info-area" style="padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-top: none; margin-top: -16px; border-radius: 0 0 4px 4px; font-size: 0.85em;">`;
            findAreaHtml += `<div style="border-top: 1px dashed #ccc; margin-bottom: 10px;"></div>`; 
            findAreaHtml += generateMasterInfoHtml();
            findAreaHtml += `</div>`;
        }

        // テーブル本体の構築
        const tableHtml = buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap);
        
        let simNoticeHtml = '';
        if (isSimulationMode) {
            simNoticeHtml = `<div id="sim-auto-calc-notice" style="font-size: 0.75em; color: #666; padding: 5px 10px; background: #fff;">
                ※キャラ名をタップでルート計算。11Gを<b>長押し(またはCtrl+クリック)</b>で詳細計算ログを表示します。
            </div>`;
        }

        // Sim/Txtモード表示
        if (isTxtMode && isSimulationMode) {
            const txtViewHtml = generateTxtRouteView(seeds, initialSeed);
            if (txtViewHtml.includes("ルートが入力されていません")) {
                container.innerHTML = findAreaHtml + simNoticeHtml + tableHtml;
            } else {
                container.innerHTML = findAreaHtml + txtViewHtml + simNoticeHtml + tableHtml;
            }
        } else {
            container.innerHTML = findAreaHtml + simNoticeHtml + tableHtml;
        }

        // デバッグモーダルの初期化
        initDebugModal();

        const resultDiv = document.getElementById('result');
        if (resultDiv) resultDiv.textContent = isSimulationMode ? "Simulation active..." : "Display Mode";
        
        updateUrlParams();
    } catch (e) {
        console.error(e);
        const container = document.getElementById('rolls-table-container');
        if (container) container.innerHTML = `<p class="error">エラー: ${e.message}</p>`;
    }
}

/** テーブルDOM構築 */
function buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap) {
    // ボタンエリアのHTML
    const buttonHtml = `
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3px; font-weight: normal;">
            <span style="font-weight: bold; font-size: 11px;">A</span>
            <button class="add-gacha-btn" onclick="addGachaColumn()" style="font-size: 11px; padding: 1px 4px;">＋列を追加</button>
            <button class="add-gacha-btn" style="background-color: #17a2b8; font-size: 11px; padding: 1px 4px;" onclick="addGachasFromSchedule()">skdで追加</button>
            <span id="add-id-trigger" style="cursor:pointer; text-decoration:underline; color:#007bff; font-size: 11px; font-weight:bold;" onclick="showIdInput()">IDで追加</span>
            <button class="remove-btn" onclick="resetToFirstGacha()" title="解除" style="font-size: 11px; padding: 1px 5px;">×</button>
        </div>`;

    let totalGachaCols = 0;
    tableGachaIds.forEach(idWithSuffix => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        if (gachaMasterData.gachas[id]) totalGachaCols += /[gfs]$/.test(idWithSuffix) ? 2 : 1;
    });

    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
    const calcColSpan = showSeedColumns ? 5 : 0;
    const totalTrackSpan = calcColSpan + totalGachaCols;

    const stickyLeftStyle = `position: sticky; left: 0; z-index: 30; background-color: #f8f9fa; border-right: 1px solid #ddd;`;
    const stickyTopLeftStyle = `position: sticky; top: 0; left: 0; z-index: 40; background-color: #f8f9fa; border-right: 1px solid #ddd;`;

    let html = `<table style="table-layout: auto; width: 100%; border-collapse: collapse;"><thead>
        <tr>
            <th class="col-no" style="${stickyLeftStyle}"></th>
            <th colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 4px; width: 50%;">${buttonHtml}</th>
            <th class="col-no"></th>
            <th colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 4px; font-weight: bold; width: 50%;">B</th>
        </tr>
        <tr class="sticky-row">
            <th class="col-no" style="${stickyTopLeftStyle}">NO.</th><th class="${calcColClass}">SEED</th><th class="${calcColClass}">rarity</th><th class="${calcColClass}">slot</th><th class="${calcColClass}">ReRoll</th><th class="${calcColClass}">Guar</th>
            ${generateNameHeaderHTML()}
            <th class="col-no">NO.</th><th class="${calcColClass}">SEED</th><th class="${calcColClass}">rarity</th><th class="${calcColClass}">slot</th><th class="${calcColClass}">ReRoll</th><th class="${calcColClass}">Guar</th>
            ${generateNameHeaderHTML()}
        </tr>
        <tr class="control-row">
            <th class="col-no" style="${stickyLeftStyle}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th>
            ${generateControlHeaderHTML(true)}
            <th class="col-no"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th>
            ${generateControlHeaderHTML(false)}
        </tr>
    </thead><tbody>`;

    for (let i = 0; i < numRolls; i++) {
        const seedIndexA = i * 2, seedIndexB = i * 2 + 1;
        html += `<tr>${renderTableRowSide(i, seedIndexA, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, true)}`;
        html += `${renderTableRowSide(i, seedIndexB, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, false)}</tr>`;
    }

    const fullColSpan = 2 + (totalTrackSpan * 2);
    html += `<tr><td colspan="${fullColSpan}" style="padding: 10px; text-align: center;">
        <button onclick="addMoreRolls()">+100行</button>
        <button id="toggle-seed-btn" class="secondary" onclick="toggleSeedColumns()">${showSeedColumns ? 'SEED非表示' : 'SEED表示'}</button>
    </td></tr></tbody></table>`;
    return html;
}

/** 行レンダリング（A/B側個別） */
function renderTableRowSide(rowIndex, seedIndex, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, isLeftSide) {
    let styleNo = '';
    let bgColor = '#f8f9fa';

    // 特殊なシードパターンの着色（黄色・オレンジ）
    if (RowAnalysis.isSimpleYellow(seedIndex, seeds) || RowAnalysis.isConsecutiveYellow(seedIndex, seeds)) {
        styleNo = 'background-color: #ffeb3b;'; bgColor = '#ffeb3b';
    } else if (RowAnalysis.isSimpleOrange(seedIndex, seeds) || RowAnalysis.isConsecutiveOrange(seedIndex, seeds)) {
        styleNo = 'background-color: #ff9800;'; bgColor = '#ff9800';
    }

    let stickyStyle = isLeftSide ? `position: sticky; left: 0; z-index: 5; border-right: 1px solid #ddd; background-color: ${bgColor};` : '';
    let sideHtml = `<td class="col-no" style="${stickyStyle}${styleNo}">${rowIndex + 1}</td>`;
    
    // 詳細計算セル（SEED, rarity, slot, ReRoll, Guar等）
    sideHtml += generateDetailedCalcCells(seedIndex, seeds, tableData);
    
    tableGachaIds.forEach((idWithSuffix, colIndex) => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        let suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        if (!gachaMasterData.gachas[id]) return;

        const data = tableData[seedIndex][colIndex];
        const roll = data.roll;

        // 通常キャラセルの描画
        let cellHtml = generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);
        
        // シミュレーション時の色上書き
        if (isSimulationMode) {
            cellHtml = cellHtml.replace(/background-color:\s*#98FB98;/gi, `background-color: ${COLOR_ROUTE_HIGHLIGHT};`);
            cellHtml = cellHtml.replace(/background-color:\s*#32CD32;/gi, `background-color: ${COLOR_ROUTE_UBER};`);
        }
        sideHtml += cellHtml;

        // 11G（確定枠）の描画
        if (suffix) {
            let gContent = '---';
            let cellStyle = 'white-space: normal; width: auto; word-break: break-all; vertical-align: middle; border: 1px solid #ddd;';
            
            if (isSimulationMode && guarHighlightMap.get(seedIndex) === id) {
                cellStyle += `background-color: ${COLOR_ROUTE_UBER};`;
            } else {
                cellStyle += `background-color: #eef7ff;`;
            }

            const g = data.guaranteed;
            if (g && g.name !== "データ不足") {
                const addr = formatAddress(g.nextRollStartSeedIndex);
                // 検算エラー時の警告
                const verifiedStyle = g.isVerified ? "" : "border-left: 3px solid #ff4444;";
                
                let gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
                const escapedName = g.name.replace(/'/g, "\\'");

                let gClickAction = isSimulationMode ?
                    `onclick="if(!event.ctrlKey) onGachaCellClick(${seedIndex}, '${id}', '${escapedName}', '${gType}')"` :
                    (g.nextRollStartSeedIndex >= 0 ? `onclick="if(!event.ctrlKey) updateSeedAndRefresh(${seeds[g.nextRollStartSeedIndex - 1]})"` : "");

                // デバッグ用トリガー属性
                const debugAttrs = `onpointerdown="window.start11GTimer(${seedIndex}, ${colIndex})" onpointerup="window.clear11GTimer()" onpointerleave="window.clear11GTimer()" onclick="if(event.ctrlKey) { showDebugLog(${seedIndex}, ${colIndex}); event.preventDefault(); }"`;

                gContent = `
                    <div ${gClickAction} ${debugAttrs} style="cursor:pointer; height:100%; width:100%; ${verifiedStyle} padding:4px;">
                        <span style="font-size:0.9em; color:#666;">${addr}</span><br>
                        <span class="char-link" style="font-weight:bold; color:#0056b3;">${g.name}</span>
                    </div>`;
            }
            sideHtml += `<td class="gacha-cell gacha-column" style="${cellStyle}">${gContent}</td>`;
        }
    });
    return sideHtml;
}

/** 各種ヘッダー生成関数群 */
function generateNameHeaderHTML() {
    let h = "";
    tableGachaIds.forEach(idWithSuffix => {
        const id = idWithSuffix.replace(/[gfs]$/, '');
        const config = gachaMasterData.gachas[id];
        const name = config ? config.name : "不明";
        h += `<th class="gacha-column-header" style="min-width:100px;">${name}</th>`;
        if (/[gfs]$/.test(idWithSuffix)) {
            h += `<th style="background:#d0e8ff; min-width:80px;">11G</th>`;
        }
    });
    return h;
}

function generateControlHeaderHTML(isA) {
    let h = "";
    tableGachaIds.forEach((id, idx) => {
        h += `<th class="gacha-column"><button class="remove-btn" onclick="removeGachaColumn(${idx})">×</button></th>`;
        if (/[gfs]$/.test(id)) {
            h += `<th style="background:#d0e8ff;"></th>`;
        }
    });
    return h;
}

/** アドレス形式変換 */
function formatAddress(index) {
    if (index === null || index === undefined) return "---";
    const row = Math.floor(index / 2) + 1;
    const track = (index % 2 === 0) ? "A" : "B";
    return `${track}${row}`;
}

/** デバッグモーダル初期化 */
function initDebugModal() {
    if (!document.getElementById('debug-modal')) {
        const modal = document.createElement('div');
        modal.id = 'debug-modal';
        modal.style = "display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.8); overflow:auto;";
        modal.innerHTML = `
            <div style="background:#fff; margin:5% auto; padding:20px; width:95%; max-width:1000px; border-radius:8px; font-family:monospace; position:relative;">
                <span onclick="this.parentElement.parentElement.style.display='none'" style="position:absolute; right:15px; top:5px; cursor:pointer; font-size:30px;">&times;</span>
                <h3>11G Calculation Debug Log</h3>
                <div id="debug-content" style="overflow-x:auto;"></div>
            </div>`;
        document.body.appendChild(modal);
    }
}

/** 長押しタイマー管理 */
let gLongPressTimer = null;
window.start11GTimer = function(seedIdx, colIdx) {
    window.clear11GTimer();
    gLongPressTimer = setTimeout(() => { showDebugLog(seedIdx, colIdx); gLongPressTimer = null; }, 800);
};
window.clear11GTimer = function() {
    if (gLongPressTimer) { clearTimeout(gLongPressTimer); gLongPressTimer = null; }
};

/** デバッグログ表示 */
window.showDebugLog = function(seedIndex, colIndex) {
    if (!currentTableData) return;
    const gData = currentTableData[seedIndex][colIndex].guaranteed;
    if (!gData || !gData.debugLog) return;

    let logHtml = `<table border="1" style="width:100%; border-collapse:collapse; background:#fff; font-size:11px;">
        <tr style="background:#eee;">
            <th>Step</th><th>SEED</th><th>演算 (Seed % Pool)</th><th>排出キャラ</th><th>判定詳細</th>
        </tr>`;

    gData.debugLog.forEach(log => {
        let rerollTxt = "-";
        if (log.isRerolled) {
            rerollTxt = `<span style="color:red;">被り回避</span><br>前回:${log.rerollProcess.prevId}<br>新SEED:${log.rerollProcess.nextSeed}`;
        }
        const math = log.step.includes("Uber") ? `${log.seedValue} % ${log.totalChars} = ${log.charIndex}` : `${log.s1} % ${log.totalChars} = ${log.charIndex}`;
        logHtml += `<tr><td>${log.step}</td><td>${log.s1 || log.seedValue}</td><td>${math}</td><td>${log.finalChar.name}</td><td>${rerollTxt}</td></tr>`;
    });
    document.getElementById('debug-content').innerHTML = logHtml + "</table>";
    document.getElementById('debug-modal').style.display = 'block';
};

/** グローバル変数の更新（シミュレーション結果の保持） */
let currentTableData = null;
const originalExecute = executeTableSimulation;
executeTableSimulation = function(n, c, s) {
    currentTableData = originalExecute(n, c, s);
    return currentTableData;
};
