/** @file view_table.js @description ガチャ結果テーブルの描画と全UI・操作機能の制御（UI完全復元版） */

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
        // シミュレーション用に十分なシードを生成
        for (let i = 0; i < numRolls * 25 + 300; i++) seeds.push(rngForSeeds.next());
        
        const columnConfigs = prepareColumnConfigs();
        const tableData = executeTableSimulation(numRolls, columnConfigs, seeds);
        
        // ハイライト情報の取得
        const { highlightMap, guarHighlightMap, lastSeedValue } = preparePathHighlightMaps(initialSeed, seeds, numRolls);
        finalSeedForUpdate = lastSeedValue;

        const container = document.getElementById('rolls-table-container');
        if (!container) return;

        // 上部Findエリア
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
                ※キャラ名をタップでルート計算。11Gを<b>長押し(iPhone)またはCtrl+クリック(PC)</b>で詳細ログを表示します。
            </div>`;
        }

        if (isTxtMode && isSimulationMode) {
            const txtViewHtml = generateTxtRouteView(seeds, initialSeed);
            container.innerHTML = findAreaHtml + txtViewHtml + simNoticeHtml + tableHtml;
        } else {
            container.innerHTML = findAreaHtml + simNoticeHtml + tableHtml;
        }

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
    const buttonHtml = `
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3px; font-weight: normal; white-space: normal;">
            <span style="font-weight: bold; margin-right: 1px; font-size: 11px;">A</span>
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

/** 行レンダリング */
function renderTableRowSide(rowIndex, seedIndex, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, isLeftSide) {
    let styleNo = '';
    let bgColor = '#f8f9fa';

    if (RowAnalysis.isSimpleYellow(seedIndex, seeds) || RowAnalysis.isConsecutiveYellow(seedIndex, seeds)) {
        styleNo = 'background-color: #ffeb3b;'; bgColor = '#ffeb3b';
    } else if (RowAnalysis.isSimpleOrange(seedIndex, seeds) || RowAnalysis.isConsecutiveOrange(seedIndex, seeds)) {
        styleNo = 'background-color: #ff9800;'; bgColor = '#ff9800';
    }

    let stickyStyle = isLeftSide ? `position: sticky; left: 0; z-index: 5; border-right: 1px solid #ddd; background-color: ${bgColor};` : '';
    let sideHtml = `<td class="col-no" style="${stickyStyle}${styleNo}">${rowIndex + 1}</td>`;
    
    sideHtml += generateDetailedCalcCells(seedIndex, seeds, tableData);
    
    tableGachaIds.forEach((idWithSuffix, colIndex) => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        let suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        if (!gachaMasterData.gachas[id]) return;

        const data = tableData[seedIndex][colIndex];
        const roll = data.roll;

        // 通常セルの描画（色・リンク等）
        let cellHtml = generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);
        cellHtml = cellHtml.replace('style="', 'style="white-space: normal; width: auto; word-break: break-all; vertical-align: middle; ');
        
        if (isSimulationMode) {
            cellHtml = cellHtml.replace(/background-color:\s*#98FB98;/gi, `background-color: ${COLOR_ROUTE_HIGHLIGHT};`);
            cellHtml = cellHtml.replace(/background-color:\s*#32CD32;/gi, `background-color: ${COLOR_ROUTE_UBER};`);
        }
        sideHtml += cellHtml;

        // 11G（独立確定枠計算）の描画
        if (suffix) {
            let gContent = '---';
            let cellStyle = 'white-space: normal; width: auto; word-break: break-all; vertical-align: middle; border: 1px solid #ddd; ';
            
            if (isSimulationMode && guarHighlightMap.get(seedIndex) === id) {
                cellStyle += `background-color: ${COLOR_ROUTE_UBER};`;
            } else {
                cellStyle += `background-color: #eef7ff;`;
            }

            const g = data.guaranteed;
            if (g && g.name !== "データ不足") {
                const addr = formatAddress(g.nextRollStartSeedIndex);
                const verifiedStyle = g.isVerified ? "" : "border-left: 3px solid #ff4444;";
                const gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
                const escapedName = g.name.replace(/'/g, "\\'");

                let gClickAction = isSimulationMode ?
                    `onclick="if(!event.ctrlKey) onGachaCellClick(${seedIndex}, '${id}', '${escapedName}', '${gType}')"` :
                    (g.nextRollStartSeedIndex >= 0 ? `onclick="if(!event.ctrlKey) updateSeedAndRefresh(${seeds[g.nextRollStartSeedIndex - 1]})"` : "");

                // デバッグ用トリガー
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

/** タイトル行の生成（プルダウン復活） */
function generateNameHeaderHTML() {
    let html = "";
    tableGachaIds.forEach((idWithSuffix, index) => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        const isGuaranteed = /[gfs]$/.test(idWithSuffix);
        const config = gachaMasterData.gachas[id];
        if (!config) return;

        // ガチャ名の構築
        const options = getGachaSelectorOptions(id);
        const currentOpt = options.find(o => String(o.value) === id);
        let label = currentOpt ? currentOpt.label : config.name;
        
        const addCount = uberAdditionCounts[index] || 0;
        let addStr = addCount > 0 ? ` <span style="color:#d9534f; font-weight:normal; font-size:0.8em;">(add:${addCount})</span>` : "";

        let displayHTML = "";
        const spaceIdx = label.indexOf(' ');
        if (spaceIdx !== -1) {
            const p1 = label.substring(0, spaceIdx), p2 = label.substring(spaceIdx + 1);
            displayHTML = `<span style="font-size:0.85em; color:#333;">${p1}</span><br><span style="font-weight:bold;">${p2}${addStr}</span>`;
        } else {
            displayHTML = `<span>${label}${addStr}</span>`;
        }

        const cls = isGuaranteed ? '' : 'class="gacha-column"';
        html += `<th ${cls} ${isGuaranteed ? 'colspan="2"' : ''} style="vertical-align: bottom; padding: 4px;">
                    <div style="text-align: center; line-height: 1.2;">${displayHTML}</div>
                 </th>`;
    });
    return html;
}

/** 操作行の生成（Gボタン, Add, ▼ボタン） */
function generateControlHeaderHTML(isInteractive) {
    let html = "";
    tableGachaIds.forEach((idWithSuffix, index) => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        let suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        const isG = suffix !== '';

        let controlArea = "";
        if (isInteractive) {
            // ▼プルダウン
            const options = getGachaSelectorOptions(id);
            let select = `<select onchange="updateGachaSelection(this, ${index})" style="width:100%; height:100%; opacity:0; position:absolute; left:0; top:0; cursor:pointer;">`;
            options.forEach(opt => {
                const selected = (String(opt.value) === id) ? 'selected' : '';
                select += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
            });
            select += `</select>`;
            const pullDownBtn = `<div style="position:relative; width:20px; height:20px; background:#ddd; border:1px solid #999; border-radius:3px; display:flex; align-items:center; justify-content:center; font-size:10px;">▼${select}</div>`;

            // Gトグルボタン
            let gLabel = 'G';
            if (suffix === 'g') gLabel = '11G'; else if (suffix === 'f') gLabel = '15G'; else if (suffix === 's') gLabel = '7G';
            const gBtn = `<button onclick="toggleGuaranteedColumn(${index})" style="min-width:25px; font-size:10px; padding:2px 4px;">${gLabel}</button>`;

            // Add機能
            const curAdd = uberAdditionCounts[index] || 0;
            const addLabel = curAdd > 0 ? `add:${curAdd}` : `add`;
            const addTrigger = `<span id="add-trigger-${index}" style="font-size:11px; color:#007bff; cursor:pointer; text-decoration:underline;" onclick="showAddInput(${index})">${addLabel}</span>`;
            let addSelect = `<span id="add-select-wrapper-${index}" style="display:none;"><select class="uber-add-select" onchange="updateUberAddition(this, ${index})" style="width:35px; font-size:10px;">`;
            for(let k=0; k<=20; k++) addSelect += `<option value="${k}" ${k===curAdd?'selected':''}>${k}</option>`;
            addSelect += `</select></span>`;

            const delBtn = `<button class="remove-btn" onclick="removeGachaColumn(${index})" style="font-size:10px; padding:2px 5px;">×</button>`;

            controlArea = `<div style="display:flex; justify-content:center; align-items:center; gap:3px;">${pullDownBtn}${gBtn}${addTrigger}${addSelect}${delBtn}</div>`;
        }

        const cls = isG ? '' : 'class="gacha-column"';
        html += `<th ${cls} ${isG ? 'colspan="2"' : ''} style="padding: 2px;">${controlArea}</th>`;
    });
    return html;
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
            <div style="background:#fff; margin:5% auto; padding:20px; width:95%; max-width:1000px; border-radius:8px; font-family:monospace; position:relative; box-shadow:0 4px 15px rgba(0,0,0,0.5);">
                <span onclick="this.parentElement.parentElement.style.display='none'" style="position:absolute; right:15px; top:5px; cursor:pointer; font-size:30px; font-weight:bold;">&times;</span>
                <h3 style="margin-top:0; border-bottom:2px solid #eee; padding-bottom:10px;">11G Calculation Debug Log</h3>
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
    const data = currentTableData[seedIndex][colIndex].guaranteed;
    if (!data || !data.debugLog) return;

    let logHtml = `<table border="1" style="width:100%; border-collapse:collapse; background:#fff; font-size:11px;">
        <tr style="background:#eee; position:sticky; top:0;">
            <th>Step</th><th>SEED</th><th>演算 (Seed % Pool)</th><th>排出キャラ</th><th>判定詳細</th>
        </tr>`;

    data.debugLog.forEach(log => {
        let rerollTxt = "-";
        if (log.isRerolled) {
            rerollTxt = `<span style="color:red;">被り回避</span><br>前回ID:${log.rerollProcess.prevId}を回避<br>新SEED:${log.rerollProcess.nextSeed}<br>剰余:${log.rerollProcess.reRollIndex}`;
        }
        const math = log.step.includes("Uber") ? `${log.seedValue} % ${log.totalChars} = <b>${log.charIndex}</b>` : `${log.s1} % ${log.totalChars} = <b>${log.charIndex}</b>`;
        logHtml += `<tr><td>${log.step}</td><td>${log.s1 || log.seedValue}</td><td>${math}</td><td>${log.finalChar.name}<br>(ID:${log.finalChar.id})</td><td>${rerollTxt}</td></tr>`;
    });
    document.getElementById('debug-content').innerHTML = logHtml + "</table>";
    document.getElementById('debug-modal').style.display = 'block';
};

/** シミュレーション結果のグローバル保持 */
let currentTableData = null;
const originalExecute = executeTableSimulation;
executeTableSimulation = function(n, c, s) {
    currentTableData = originalExecute(n, c, s);
    return currentTableData;
};