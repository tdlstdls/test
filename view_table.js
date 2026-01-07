/** @file view_table.js @description ガチャ結果テーブルの描画とデバッグ情報の制御（長押し・Ctrl+クリック対応） */

const COLOR_ROUTE_HIGHLIGHT = '#aaddff';
const COLOR_ROUTE_UBER = '#66b2ff';

/** テーブル描画のメイン関数 */
function generateRollsTable() {
    try {
        if (Object.keys(gachaMasterData.gachas).length === 0) return;
        const seedEl = document.getElementById('seed');
        if (!seedEl) return;
        
        let initialSeed = parseInt(seedEl.value, 10) || 12345;
        const numRolls = currentRolls;
        
        // シード配列の生成
        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        for (let i = 0; i < numRolls * 25 + 200; i++) seeds.push(rngForSeeds.next());
        
        const columnConfigs = prepareColumnConfigs();
        const tableData = executeTableSimulation(numRolls, columnConfigs, seeds);
        
        const { highlightMap, guarHighlightMap, lastSeedValue } = preparePathHighlightMaps(initialSeed, seeds, numRolls);
        finalSeedForUpdate = lastSeedValue;

        const container = document.getElementById('rolls-table-container');
        if (!container) return;

        const tableHtml = buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap);
        
        let findAreaHtml = '';
        if (typeof generateFastForecast === 'function') findAreaHtml += generateFastForecast(initialSeed, columnConfigs);

        container.innerHTML = findAreaHtml + tableHtml;
        
        // デバッグ用モーダルの準備（存在しない場合のみ追加）
        if (!document.getElementById('debug-modal')) {
            const modal = document.createElement('div');
            modal.id = 'debug-modal';
            modal.style = "display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.8); overflow:auto; -webkit-overflow-scrolling:touch;";
            modal.innerHTML = `
                <div style="background:#fff; margin:5% auto; padding:20px; width:95%; max-width:1000px; border-radius:8px; font-family:monospace; position:relative; box-shadow:0 4px 15px rgba(0,0,0,0.5);">
                    <span onclick="this.parentElement.parentElement.style.display='none'" style="position:absolute; right:15px; top:5px; cursor:pointer; font-size:30px; font-weight:bold;">&times;</span>
                    <h3 style="margin-top:0; border-bottom:2px solid #eee; padding-bottom:10px;">11G Calculation Debug Log</h3>
                    <p style="font-size:11px; color:#666;">※計算過程：単発10回の連続性とレア被り（排出後基準）の検証ログ</p>
                    <div id="debug-content" style="overflow-x:auto;"></div>
                </div>`;
            document.body.appendChild(modal);
        }

        updateUrlParams();
    } catch (e) {
        console.error(e);
        const container = document.getElementById('rolls-table-container');
        if (container) container.innerHTML = `<p class="error">表示エラー: ${e.message}</p>`;
    }
}

/** テーブルDOM構築 */
function buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap) {
    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
    let html = `<table style="width:100%; border-collapse:collapse; font-size:12px;"><thead>`;
    
    html += `<tr class="sticky-row">
        <th class="col-no">NO.</th><th class="${calcColClass}">SEED</th>
        ${generateNameHeaderHTML()}
        <th class="col-no">NO.</th><th class="${calcColClass}">SEED</th>
        ${generateNameHeaderHTML()}
    </tr></thead><tbody>`;

    for (let i = 0; i < numRolls; i++) {
        html += `<tr>${renderTableRowSide(i, i * 2, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, true)}`;
        html += `${renderTableRowSide(i, i * 2 + 1, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, false)}</tr>`;
    }
    html += `</tbody></table>`;
    return html;
}

/** 側面（A/B）の描画 */
function renderTableRowSide(rowIndex, seedIndex, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, isLeftSide) {
    let sideHtml = `<td class="col-no" style="background:#f8f9fa;">${rowIndex + 1}</td>`;
    sideHtml += `<td class="calc-column ${showSeedColumns ? '' : 'hidden'}">${seeds[seedIndex]}</td>`;

    tableGachaIds.forEach((idWithSuffix, colIndex) => {
        const data = tableData[seedIndex][colIndex];
        if (!data) return;

        const roll = data.roll;
        const rarityStyle = roll.rarity === 'uber' ? 'background:#ffe0e0;' : (roll.rarity === 'legend' ? 'background:#ffc0ff;' : '');
        sideHtml += `<td style="${rarityStyle} border:1px solid #eee; padding:4px;">${roll.finalChar.name}</td>`;

        if (data.guaranteed) {
            const g = data.guaranteed;
            const addr = formatAddress(g.nextRollStartSeedIndex);
            const verifiedStyle = g.isVerified ? "" : "border-left: 3px solid #ff4444;";
            
            // iPhone用の長押し処理と、PC用のCtrl+クリック処理を両立
            const touchAttrs = `
                onpointerdown="window.start11GTimer(${seedIndex}, ${colIndex})" 
                onpointerup="window.clear11GTimer()" 
                onpointerleave="window.clear11GTimer()"
                onclick="if(event.ctrlKey) { showDebugLog(${seedIndex}, ${colIndex}); event.preventDefault(); }"
            `;
            
            sideHtml += `<td ${touchAttrs} style="background:#eef7ff; ${verifiedStyle} cursor:help; font-size:11px; padding:4px; border:1px solid #ddd; user-select:none; -webkit-user-select:none;">
                <div style="color:#666;">${addr}</div>
                <div style="font-weight:bold; color:#0056b3;">${g.name}</div>
            </td>`;
        }
    });
    return sideHtml;
}

/** 長押しタイマーの管理 */
let gLongPressTimer = null;
window.start11GTimer = function(seedIdx, colIdx) {
    window.clear11GTimer();
    gLongPressTimer = setTimeout(() => {
        showDebugLog(seedIdx, colIdx);
        gLongPressTimer = null;
    }, 800); // 0.8秒で長押し判定
};

window.clear11GTimer = function() {
    if (gLongPressTimer) {
        clearTimeout(gLongPressTimer);
        gLongPressTimer = null;
    }
};

/** デバッグログの表示処理 */
window.showDebugLog = function(seedIndex, colIndex) {
    if (!currentTableData) return;
    const gData = currentTableData[seedIndex][colIndex].guaranteed;
    if (!gData || !gData.debugLog) return;

    let logHtml = `<table border="1" style="width:100%; border-collapse:collapse; background:#fff; font-size:11px;">
        <tr style="background:#eee; position:sticky; top:0;">
            <th>Step</th><th>SEED</th><th>演算 (Seed % Pool)</th><th>排出キャラ</th><th>被り判定詳細</th>
        </tr>`;

    gData.debugLog.forEach(log => {
        let rerollTxt = "-";
        if (log.isRerolled) {
            rerollTxt = `<span style="color:red;">被り回避</span><br>前回ID:${log.rerollProcess.prevId}を回避<br>新SEED:${log.rerollProcess.nextSeed}<br>再抽選剰余:${log.rerollProcess.reRollIndex}`;
        }
        
        const math = log.step.includes("Uber") ? 
            `${log.seedValue} % ${log.totalChars} = <b>${log.charIndex}</b>` :
            `${log.s1} % ${log.totalChars} = <b>${log.charIndex}</b>`;

        logHtml += `<tr>
            <td style="white-space:nowrap;">${log.step}</td>
            <td>${log.s1 || log.seedValue}</td>
            <td>${math}</td>
            <td style="font-weight:bold;">${log.finalChar.name}<br><small>(ID:${log.finalChar.id})</small></td>
            <td style="font-size:10px;">${rerollTxt}</td>
        </tr>`;
    });
    logHtml += `</table>`;
    
    const contentArea = document.getElementById('debug-content');
    if (contentArea) {
        contentArea.innerHTML = logHtml;
        document.getElementById('debug-modal').style.display = 'block';
    }
};

/** アドレス形式変換 (例: 24 -> B13) */
function formatAddress(index) {
    if (index === null || index === undefined) return "---";
    const row = Math.floor(index / 2) + 1;
    const track = (index % 2 === 0) ? "A" : "B";
    return `${track}${row}`;
}

/** ガチャ名ヘッダーの生成 */
function generateNameHeaderHTML() {
    let h = "";
    tableGachaIds.forEach(idWithSuffix => {
        const id = idWithSuffix.replace(/[gfs]$/, '');
        const config = gachaMasterData.gachas[id];
        const name = config ? config.name : "不明";
        h += `<th style="min-width:100px;">${name}</th>`;
        if (/[gfs]$/.test(idWithSuffix)) {
            h += `<th style="background:#d0e8ff; min-width:80px;">11G</th>`;
        }
    });
    return h;
}

/** グローバル変数の更新（シミュレーション結果の保持） */
let currentTableData = null;
const originalExecute = executeTableSimulation;
executeTableSimulation = function(n, c, s) {
    currentTableData = originalExecute(n, c, s);
    return currentTableData;
};
