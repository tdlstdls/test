/** @file view_table.js @description ガチャ結果テーブルの描画とデバッグ情報の制御 */

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
            modal.style = "display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.7); overflow:auto;";
            modal.innerHTML = `
                <div style="background:#fff; margin:5% auto; padding:20px; width:90%; max-width:1000px; border-radius:8px; font-family:monospace; position:relative;">
                    <span onclick="this.parentElement.parentElement.style.display='none'" style="position:absolute; right:20px; top:10px; cursor:pointer; font-size:24px;">&times;</span>
                    <h3>11G Calculation Debug Log</h3>
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
    
    // ヘッダー生成
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

        // 通常ロール表示
        const roll = data.roll;
        const rarityStyle = roll.rarity === 'uber' ? 'background:#ffe0e0;' : (roll.rarity === 'legend' ? 'background:#ffc0ff;' : '');
        sideHtml += `<td style="${rarityStyle} border:1px solid #eee; padding:4px;">${roll.finalChar.name}</td>`;

        // 11G独立計算データの表示
        if (data.guaranteed) {
            const g = data.guaranteed;
            const addr = formatAddress(g.nextRollStartSeedIndex);
            const verifiedStyle = g.isVerified ? "" : "border-left: 3px solid #ff4444;";
            
            // Ctrl+クリックでデバッグログを表示
            const debugClick = `onclick="if(event.ctrlKey) showDebugLog(${seedIndex}, ${colIndex})"`;
            
            sideHtml += `<td ${debugClick} style="background:#eef7ff; ${verifiedStyle} cursor:help; font-size:11px; padding:4px; border:1px solid #ddd;">
                <div style="color:#666;">${addr}</div>
                <div style="font-weight:bold; color:#0056b3;">${g.name}</div>
            </td>`;
        }
    });
    return sideHtml;
}

/** デバッグログの表示処理 */
window.showDebugLog = function(seedIndex, colIndex) {
    const tableEl = document.getElementById('rolls-table-container');
    // executeTableSimulationの結果にアクセス（グローバルまたはクロージャ内での保持が必要ですが、ここではDOM構築時のデータを利用）
    // 簡易化のため、再計算はせず構築済みデータを参照
    // 実際の運用では tableData をグローバル変数にするか、データ属性に逃がす必要があります。
    // ここでは、現在のテーブル生成で使われた tableData が利用可能であると仮定します。
    
    // tableDataが取得できない場合のためのフォールバック処理は別途実装
    const gData = currentTableData[seedIndex][colIndex].guaranteed;
    if (!gData || !gData.debugLog) return;

    let logHtml = `<table border="1" style="width:100%; border-collapse:collapse; background:#fff; font-size:12px;">
        <tr style="background:#eee;">
            <th>Step</th><th>Index</th><th>SEED</th><th>演算 (Seed % Pool)</th><th>排出キャラ</th><th>リロール詳細</th><th>消費</th>
        </tr>`;

    gData.debugLog.forEach(log => {
        let rerollTxt = "-";
        if (log.isRerolled) {
            rerollTxt = `被り回避: ID ${log.rerollProcess.prevId}<br>新SEED: ${log.rerollProcess.nextSeed}<br>剰余: ${log.rerollProcess.reRollIndex}`;
        }
        
        const math = log.step.includes("Uber") ? 
            `${log.seedValue} % ${log.totalChars} = ${log.charIndex}` :
            `${log.s1} % ${log.totalChars} = ${log.charIndex}`;

        logHtml += `<tr>
            <td>${log.step}</td>
            <td>${log.startIndex}</td>
            <td>${log.s1 || log.seedValue}</td>
            <td>${math}</td>
            <td>${log.finalChar.name} (ID:${log.finalChar.id})</td>
            <td>${rerollTxt}</td>
            <td>${log.consumed || 1}</td>
        </tr>`;
    });
    logHtml += `</table>`;
    
    document.getElementById('debug-content').innerHTML = logHtml;
    document.getElementById('debug-modal').style.display = 'block';
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
