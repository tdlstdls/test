/**
 * ui_controller.js
 * 画面描画、イベント制御、URLパラメータ処理を担当
 */

// UI状態変数
let tableGachaIds = [];
let currentRolls = 100;
let showSeedColumns = false;
let showResultDisplay = false;
let finalSeedForUpdate = null;
let isSimulationMode = false;
let isScheduleMode = false;

// --- URL & 初期化関連 ---

function processUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const seedParam = urlParams.get('seed');
    const simConfigParam = urlParams.get('sim_config');
    const gachasParam = urlParams.get('gachas');

    if (gachasParam) {
        tableGachaIds = gachasParam.split('-');
    }

    if (seedParam) {
        const seedEl = document.getElementById('seed');
        if(seedEl) seedEl.value = seedParam;
    }
    if (simConfigParam) {
        const configEl = document.getElementById('sim-config');
        if(configEl) configEl.value = simConfigParam;
        
        isSimulationMode = true;
        const simRadio = document.querySelector('input[value="simulation"]');
        if(simRadio) simRadio.checked = true;
    }
}

function updateUrlParams() {
    const seed = document.getElementById('seed').value;
    const simConfig = document.getElementById('sim-config').value;
    const urlParams = new URLSearchParams(window.location.search);

    if (seed) urlParams.set('seed', seed); else urlParams.delete('seed');
    if (simConfig && isSimulationMode) urlParams.set('sim_config', simConfig); else urlParams.delete('sim_config');
    if (tableGachaIds.length > 0) urlParams.set('gachas', tableGachaIds.join('-')); else urlParams.delete('gachas');

    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    try { window.history.pushState({path: newUrl}, '', newUrl); } catch (e) { console.warn("URL update failed", e); }
}

function initializeDefaultGachas() {
    if (tableGachaIds.length === 0) {
        const options = getGachaSelectorOptions(null);
        if (options.length > 0) {
            tableGachaIds.push(options[0].value);
            if (options.length > 1) {
                tableGachaIds.push(options[1].value);
            }
        } else {
            // データがない場合のフォールバック
            const sortedGachas = Object.values(gachaMasterData.gachas)
                .filter(gacha => gacha.sort < 800)
                .sort((a, b) => a.sort - b.sort);
            if (sortedGachas.length > 0) tableGachaIds.push(sortedGachas[0].id);
            if (sortedGachas.length > 1) tableGachaIds.push(sortedGachas[1].id);
        }
    }
}

// --- イベントハンドラ ---

function onModeChange() {
    const radios = document.getElementsByName('appMode');
    for (const radio of radios) {
        if (radio.checked) {
            isSimulationMode = (radio.value === 'simulation');
            break;
        }
    }
    const simWrapper = document.getElementById('sim-control-wrapper');
    if (simWrapper) {
        if (isSimulationMode && !isScheduleMode) {
            simWrapper.classList.remove('hidden');
        } else {
            simWrapper.classList.add('hidden');
        }
    }
    resetAndGenerateTable();
}

function resetAndGenerateTable() {
    if (isScheduleMode) return; 
    finalSeedForUpdate = null;
    const simConf = document.getElementById('sim-config');
    if (simConf && simConf.value.trim() === '') {
         currentRolls = 100;
    }
    generateRollsTable();
    updateUrlParams();
}

function clearSimConfig() {
    const el = document.getElementById('sim-config');
    if(el) el.value = '';
    resetAndGenerateTable();
}

function updateSeedFromSim() {
    if (finalSeedForUpdate) {
        document.getElementById('seed').value = finalSeedForUpdate;
        document.getElementById('sim-config').value = '';
        resetAndGenerateTable(); 
    }
}

function addGachaColumn() {
    const options = getGachaSelectorOptions(null);
    if (options.length > 0) {
        tableGachaIds.push(options[0].value);
        generateRollsTable();
    }
}

function removeGachaColumn(index) {
    tableGachaIds.splice(index, 1);
    generateRollsTable();
}

function updateGachaSelection(selectElement, index) {
    const originalIdWithG = tableGachaIds[index];
    const isGuaranteed = originalIdWithG.endsWith('g');
    let newId = selectElement.value;
    if (isGuaranteed) newId += 'g';
    tableGachaIds[index] = newId;
    generateRollsTable();
}

function toggleGuaranteedColumn(index) {
    const idWithG = tableGachaIds[index];
    tableGachaIds[index] = idWithG.endsWith('g') ? idWithG.slice(0, -1) : idWithG + 'g';
    generateRollsTable();
}

function toggleSeedColumns() {
    showSeedColumns = !showSeedColumns;
    generateRollsTable(); 
    updateToggleButtons();
}

function toggleResultDisplay() {
    showResultDisplay = !showResultDisplay;
    const res = document.getElementById('result');
    if(res) res.classList.toggle('hidden', !showResultDisplay);
    updateToggleButtons();
}

function updateToggleButtons() {
    const btnSeed = document.getElementById('toggle-seed-btn');
    const btnRes = document.getElementById('toggle-result-btn');
    if(btnSeed) btnSeed.textContent = showSeedColumns ? 'SEEDを非表示' : 'SEEDを表示';
    if(btnRes) btnRes.textContent = showResultDisplay ? '計算過程を非表示' : '計算過程を表示';
}

function toggleDescription() {
    const content = document.getElementById('description-content');
    const toggle = document.getElementById('toggle-description');
    if(content && toggle) {
        const isHidden = content.classList.toggle('hidden');
        toggle.textContent = isHidden ? '概要を表示' : '概要を非表示';
    }
}

// --- スケジュール表示関連 ---

function setupScheduleUI() {
    let scheduleContainer = document.getElementById('schedule-container');
    if (!scheduleContainer) {
        scheduleContainer = document.createElement('div');
        scheduleContainer.id = 'schedule-container';
        scheduleContainer.className = 'hidden';
        const tableContainer = document.getElementById('rolls-table-container');
        if (tableContainer) {
            tableContainer.parentNode.insertBefore(scheduleContainer, tableContainer.nextSibling);
        } else {
            document.body.appendChild(scheduleContainer);
        }
    }

    if (!document.getElementById('toggle-schedule-btn')) {
        const btn = document.createElement('button');
        btn.id = 'toggle-schedule-btn';
        btn.textContent = 'スケジュールを表示';
        btn.onclick = toggleSchedule;
        btn.className = 'secondary';
        
        const refBtn = document.getElementById('toggle-description');
        if (refBtn && refBtn.parentNode) {
            refBtn.parentNode.insertBefore(btn, refBtn.nextSibling);
        } else {
            const controls = document.querySelector('.controls');
            if(controls) controls.appendChild(btn);
        }
    }
}

function toggleSchedule() {
    if (!loadedTsvContent) {
        alert("スケジュールの読み込みに失敗しました。");
        return;
    }

    isScheduleMode = !isScheduleMode;
    const scheduleBtn = document.getElementById('toggle-schedule-btn');
    const simWrapper = document.getElementById('sim-control-wrapper');
    const tableContainer = document.getElementById('rolls-table-container');
    const scheduleContainer = document.getElementById('schedule-container');
    const resultDiv = document.getElementById('result');

    if (isScheduleMode) {
        scheduleBtn.textContent = 'シミュレーターに戻る';
        scheduleBtn.classList.add('active');
        if (simWrapper) simWrapper.classList.add('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (resultDiv) resultDiv.classList.add('hidden');
        if (scheduleContainer) {
            scheduleContainer.classList.remove('hidden');
            if (typeof renderScheduleTable === 'function') {
                renderScheduleTable(loadedTsvContent, 'schedule-container');
            }
        }
    } else {
        scheduleBtn.textContent = 'スケジュールを表示';
        scheduleBtn.classList.remove('active');
        if (isSimulationMode && simWrapper) simWrapper.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (resultDiv && showResultDisplay) resultDiv.classList.remove('hidden');
        if (scheduleContainer) scheduleContainer.classList.add('hidden');
    }
}

// --- プルダウン生成ロジック ---

function getGachaSelectorOptions(selectedId) {
    const now = new Date();
    const formatInt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return parseInt(`${y}${m}${day}`, 10);
    };
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayInt = formatInt(yesterdayDate);

    const toShortDate = (str) => {
        if(!str || str.length < 8) return str;
        return `${parseInt(str.substring(4,6))}/${parseInt(str.substring(6,8))}`;
    };

    let scheduleRaw = [];
    if (loadedTsvContent && typeof parseGachaTSV === 'function') {
        scheduleRaw = parseGachaTSV(loadedTsvContent);
    }
    
    const usedIds = new Set();
    const allOptions = [];

    // Group 1: スケジュール (終了日 >= 昨日)
    let scheduledItems = [];
    scheduleRaw.forEach(item => {
        if(!gachaMasterData.gachas[item.id]) return;

        const masterName = gachaMasterData.gachas[item.id].name;
        const checkStr = (masterName + item.tsvName).replace(/\s/g, "");
        const isSpecial = checkStr.includes("プラチナ") || checkStr.includes("レジェンド");

        const e = parseInt(item.rawEnd, 10);

        // 表示条件: 特殊ガチャ または 終了日が昨日以降
        if (isSpecial || e >= yesterdayInt) {
            scheduledItems.push({
                id: item.id,
                name: masterName,
                tsvName: item.tsvName || item.name,
                rawStart: item.rawStart,
                rawEnd: item.rawEnd,
                s: parseInt(item.rawStart, 10),
                isSpecial: isSpecial
            });
        }
    });

    scheduledItems.sort((a, b) => {
        if (a.isSpecial !== b.isSpecial) return a.isSpecial ? 1 : -1;
        return a.s - b.s;
    });

    scheduledItems.forEach(item => {
        if (usedIds.has(item.id.toString())) return;
        
        const baseName = `${item.name} (${item.id})`;
        let label = item.isSpecial 
            ? `${toShortDate(item.rawStart)}~ ${baseName}`
            : `${toShortDate(item.rawStart)}~${toShortDate(item.rawEnd)} ${baseName}`;
        
        allOptions.push({ value: item.id, label: label });
        usedIds.add(item.id.toString());
    });

    // Group 2: シリーズ最新 (G1で表示済みはスキップ)
    const seriesMaxMap = new Map();
    Object.values(gachaMasterData.gachas).forEach(g => {
        if (usedIds.has(g.id)) return;
        if (g.series_id !== undefined && g.sort < 800) {
            const current = seriesMaxMap.get(g.series_id);
            if (!current || parseInt(g.id) > parseInt(current.id)) {
                seriesMaxMap.set(g.series_id, g);
            }
        }
    });

    const seriesList = Array.from(seriesMaxMap.values());
    seriesList.sort((a, b) => a.sort - b.sort);

    seriesList.forEach(g => {
        allOptions.push({ value: g.id, label: `${g.name} (${g.id})` });
        usedIds.add(g.id);
    });

    // Group 3: その他
    const othersList = [];
    Object.values(gachaMasterData.gachas).forEach(g => {
        if (usedIds.has(g.id)) return;
        othersList.push(g);
    });

    othersList.sort((a, b) => parseInt(b.id) - parseInt(a.id));

    othersList.forEach(g => {
        allOptions.push({ value: g.id, label: `${g.id} ${g.name}` });
        usedIds.add(g.id);
    });

    if (selectedId && !usedIds.has(selectedId)) {
        const missing = gachaMasterData.gachas[selectedId];
        if (missing) {
            allOptions.push({ value: selectedId, label: `${selectedId} ${missing.name} (選択中)` });
        }
    }

    return allOptions;
}

// --- テーブル描画ロジック ---

function generateRollsTable() {
    try {
        if (Object.keys(gachaMasterData.gachas).length === 0) return;
        const seedEl = document.getElementById('seed');
        if(!seedEl) return;
        
        const initialSeed = parseInt(seedEl.value, 10);
        const numRolls = currentRolls;
        if (isNaN(initialSeed)) return;

        if (typeof Xorshift32 === 'undefined' || typeof rollWithSeedConsumptionFixed === 'undefined') {
            document.getElementById('rolls-table-container').innerHTML = 
                '<p class="error">logic.js が読み込まれていません。</p>';
            return;
        }

        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        for (let i = 0; i < numRolls * 15 + 20; i++) seeds.push(rngForSeeds.next());

        const uniqueGachaIds = [...new Set(tableGachaIds.map(id => id.replace('g', '')))];
        const gachaConfigs = uniqueGachaIds.map(id => gachaMasterData.gachas[id]).filter(Boolean);
        
        const tableData = Array(numRolls * 2).fill(null).map(() => []);
        gachaConfigs.forEach((config, gachaIndex) => {
            if (!config) return;
            let prevDrawA = null, prevDrawB = null;
            for (let i = 0; i < numRolls; i++) {
                const seedIndexA = i * 2, seedIndexB = i * 2 + 1;
                
                const rollResultA = rollWithSeedConsumptionFixed(seedIndexA, config, seeds, prevDrawA);
                const isConsecutiveA = prevDrawA && prevDrawA.isRerolled && rollResultA.isRerolled;
                tableData[seedIndexA][gachaIndex] = { gachaId: config.id, roll: rollResultA, isConsecutive: isConsecutiveA };
                prevDrawA = { rarity: rollResultA.rarity, charId: rollResultA.charId, isRerolled: rollResultA.isRerolled };
                
                if (seedIndexB < seeds.length - 2) {
                    const rollResultB = rollWithSeedConsumptionFixed(seedIndexB, config, seeds, prevDrawB);
                    const isConsecutiveB = prevDrawB && prevDrawB.isRerolled && rollResultB.isRerolled;
                    tableData[seedIndexB][gachaIndex] = { gachaId: config.id, roll: rollResultB, isConsecutive: isConsecutiveB };
                    prevDrawB = { rarity: rollResultB.rarity, charId: rollResultB.charId, isRerolled: rollResultB.isRerolled };
                }
            }
        });

        const highlightMap = new Map();
        if (isSimulationMode) {
            const simConfigEl = document.getElementById('sim-config');
            if(simConfigEl && typeof parseSimConfig !== 'undefined') {
                const simConfigs = parseSimConfig(simConfigEl.value.trim());
                let rngForText = new Xorshift32(initialSeed);
                let currentSeedIndex = 0;
                let lastDrawForHighlight = { rarity: null, charId: null };

                for (const sim of simConfigs) {
                    if (gachaMasterData.gachas[sim.id]) sim.gachaConfig = gachaMasterData.gachas[sim.id];
                    if (!sim.gachaConfig) continue;

                    if (sim.g && sim.rolls === 11) {
                        const startSeedIndex = currentSeedIndex;
                        for(let k=0; k<10; k++){
                             if(currentSeedIndex >= numRolls*2) break;
                             highlightMap.set(currentSeedIndex, sim.id);
                             const rr = rollWithSeedConsumptionFixed(currentSeedIndex, sim.gachaConfig, seeds, lastDrawForHighlight);
                             if(rr.seedsConsumed===0) break;
                             lastDrawForHighlight = {rarity: rr.rarity, charId: rr.charId};
                             currentSeedIndex += rr.seedsConsumed;
                             for(let x=0; x<rr.seedsConsumed; x++) rngForText.next();
                        }
                        if(startSeedIndex < numRolls*2) highlightMap.set(`${startSeedIndex}G`, sim.id);
                        if(currentSeedIndex < seeds.length && typeof rollGuaranteedUber !== 'undefined') {
                            const gr = rollGuaranteedUber(currentSeedIndex, sim.gachaConfig, seeds);
                            currentSeedIndex += gr.seedsConsumed;
                            for(let x=0; x<gr.seedsConsumed; x++) rngForText.next();
                        }
                    } else {
                        for(let k=0; k<sim.rolls; k++){
                            if(currentSeedIndex >= numRolls*2) break;
                            highlightMap.set(currentSeedIndex, sim.id);
                            const rr = rollWithSeedConsumptionFixed(currentSeedIndex, sim.gachaConfig, seeds, lastDrawForHighlight);
                            if(rr.seedsConsumed===0) break;
                            lastDrawForHighlight = {rarity: rr.rarity, charId: rr.charId};
                            currentSeedIndex += rr.seedsConsumed;
                            for(let x=0; x<rr.seedsConsumed; x++) rngForText.next();
                        }
                    }
                }
                finalSeedForUpdate = rngForText.seed;
            }
        }
        
        const buttonHtml = `<button class="add-gacha-btn" onclick="addGachaColumn()">＋列を追加</button>`;
        let totalGachaCols = 0;
        tableGachaIds.forEach(idWithG => {
            const id = idWithG.replace('g', '');
            if (gachaMasterData.gachas[id]) totalGachaCols += idWithG.endsWith('g') ? 2 : 1;
        });
        
        const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
        const calcColSpan = showSeedColumns ? 5 : 0;
        const totalTrackSpan = calcColSpan + totalGachaCols;

        let tableHtml = `<table><thead>
            <tr><th rowspan="2" class="col-no">NO.</th><th colspan="${totalTrackSpan}">A ${buttonHtml}</th>
            <th rowspan="2" class="col-no">NO.</th><th colspan="${totalTrackSpan}">B</th></tr><tr>`;
        
        const generateHeader = () => {
            let html = `
                <th class="${calcColClass}">S1<br>rarity</th>
                <th class="${calcColClass}">S2<br>slot</th>
                <th class="${calcColClass}">S3<br>ReRoll</th>
                <th class="${calcColClass}">Guaranteed<br>slot</th>
                <th class="${calcColClass}">Detail</th>
            `;
            tableGachaIds.forEach((idWithG, index) => {
                const isGuaranteed = idWithG.endsWith('g');
                const id = isGuaranteed ? idWithG.slice(0, -1) : idWithG;
                const gachaConfig = gachaMasterData.gachas[id];
                if (!gachaConfig) return;
                const removeBtn = `<button class="remove-btn" onclick="removeGachaColumn(${index})">x</button>`;
                const gBtn = `<button onclick="toggleGuaranteedColumn(${index})">G</button>`;
                
                // プルダウン生成 & ラベル整形
                const options = getGachaSelectorOptions(id);
                let selectedLabel = "";
                const foundOption = options.find(o => o.value == id);
                if (foundOption) {
                    selectedLabel = foundOption.label;
                } else {
                    selectedLabel = `${id} ${gachaConfig.name}`;
                }

                // ラベルを日付/ID(1行目)と名前(2行目)に分割
                let displayHTML = selectedLabel;
                const firstSpaceIdx = selectedLabel.indexOf(' ');
                if (firstSpaceIdx !== -1) {
                    const part1 = selectedLabel.substring(0, firstSpaceIdx);
                    const part2 = selectedLabel.substring(firstSpaceIdx + 1);
                    displayHTML = `<span style="font-size:0.85em; color:#333;">${part1}</span><br><span style="font-weight:bold; font-size:0.95em;">${part2}</span>`;
                }

                // プルダウン自体のHTML
                let selector = `<select onchange="updateGachaSelection(this, ${index})" style="width: 30px; cursor: pointer; opacity: 0; position: absolute; left:0; top:0; height: 100%; width: 100%;">`;
                options.forEach(opt => {
                    const selected = (opt.value == id) ? 'selected' : '';
                    selector += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                });
                selector += '</select>';
                
                // ヘッダーUI組み立て
                const cls = isGuaranteed ? '' : 'class="gacha-column"';
                const fakeSelectBtn = `<div style="width:20px; height:20px; background:#ddd; border:1px solid #999; display:flex; align-items:center; justify-content:center; border-radius:3px;">▼</div>`;

                html += `
                <th ${cls} ${isGuaranteed?'colspan="2"':''}>
                    <div class="gacha-header-wrapper" style="display: flex; align-items: center; justify-content: center; gap: 6px; position: relative;">
                        <div style="position: relative; width: 24px; height: 24px;">
                            ${fakeSelectBtn}
                            ${selector}
                        </div>
                        <div style="text-align: left; line-height: 1.25;">
                            ${displayHTML}
                        </div>
                    </div>
                    <div style="margin-top:4px;">
                        ${gBtn}${removeBtn}
                    </div>
                </th>`;
            });
            return html;
        };
        tableHtml += generateHeader() + generateHeader() + `</tr></thead><tbody>`;

        const generateCell = (seedIndex, id) => {
            const gachaIndex = gachaConfigs.findIndex(c => c.id === id);
            if(gachaIndex === -1 || !tableData[seedIndex] || !tableData[seedIndex][gachaIndex]) {
                return `<td class="gacha-cell gacha-column">N/A</td>`;
            }
            const fullRoll = tableData[seedIndex][gachaIndex].roll;
            if(!fullRoll) return `<td>N/A</td>`;
            
            let hlClass = '';
            if (isSimulationMode) {
                if (highlightMap.get(seedIndex) === id) hlClass = ' highlight';
                if (hlClass && fullRoll.rarity === 'uber') hlClass = ' highlight-uber';
            }

            let style = '';
            if (!hlClass) {
                const sv = seeds[seedIndex] % 10000;
                if(sv >= 9970) style = 'background-color: #DDA0DD;';
                else if(sv >= 9940) style = 'background-color: #9370DB;';
                else if(sv >= 9470) style = 'background-color: #FF4C4C;';
                else if(sv >= 9070) style = 'background-color: #FFB6C1;';
                else if(sv >= 6970) style = 'background-color: #FFDAB9;';
                else if(sv >= 6470) style = 'background-color: #FFFFE0;';
            }

            let content = fullRoll.finalChar.name;
            if (fullRoll.isRerolled) {
                content = `${fullRoll.originalChar.name}<br>(${fullRoll.finalChar.name})`;
            }
            return `<td class="gacha-cell gacha-column${hlClass}" style="${style}">${content}</td>`;
        };

        for(let i=0; i<numRolls; i++){
            const seedIndexA = i*2, seedIndexB = i*2+1;
            let rowHtml = `<tr><td class="col-no">${i+1}</td>`;
            
            if(showSeedColumns) rowHtml += `<td class="${calcColClass}"></td>`.repeat(5);

            tableGachaIds.forEach(idWithG => {
                const id = idWithG.replace('g','');
                const isG = idWithG.endsWith('g');
                if(!gachaMasterData.gachas[id]) return;
                rowHtml += generateCell(seedIndexA, id);
                if(isG) {
                    let gContent = '---';
                    if (isSimulationMode && typeof calculateGuaranteedLookahead !== 'undefined') {
                         let lastDraw = (i>0 && tableData[seedIndexA-2]?.[gachaConfigs.findIndex(c=>c.id===id)]?.roll) ? 
                                       {rarity: tableData[seedIndexA-2][gachaConfigs.findIndex(c=>c.id===id)].roll.rarity, charId: tableData[seedIndexA-2][gachaConfigs.findIndex(c=>c.id===id)].roll.charId} : null;
                         const gRes = calculateGuaranteedLookahead(seedIndexA, gachaMasterData.gachas[id], seeds, lastDraw);
                         gContent = gRes.name;
                    }
                    rowHtml += `<td>${gContent}</td>`;
                }
            });

            rowHtml += `<td class="col-no">${i+1}</td>`;

            if(showSeedColumns) rowHtml += `<td class="${calcColClass}"></td>`.repeat(5);

            tableGachaIds.forEach(idWithG => {
                const id = idWithG.replace('g','');
                const isG = idWithG.endsWith('g');
                if(!gachaMasterData.gachas[id]) return;
                rowHtml += generateCell(seedIndexB, id);
                if(isG) {
                    let gContent = '---';
                    if (isSimulationMode && typeof calculateGuaranteedLookahead !== 'undefined') {
                        let lastDraw = (i>0 && tableData[seedIndexB-2]?.[gachaConfigs.findIndex(c=>c.id===id)]?.roll) ? 
                                       {rarity: tableData[seedIndexB-2][gachaConfigs.findIndex(c=>c.id===id)].roll.rarity, charId: tableData[seedIndexB-2][gachaConfigs.findIndex(c=>c.id===id)].roll.charId} : null;
                        const gRes = calculateGuaranteedLookahead(seedIndexB, gachaMasterData.gachas[id], seeds, lastDraw);
                        gContent = gRes.name;
                    }
                    rowHtml += `<td>${gContent}</td>`;
                }
            });
            
            rowHtml += `</tr>`;
            tableHtml += rowHtml;
        }
        
        tableHtml += '</tbody></table>';
        const container = document.getElementById('rolls-table-container');
        if(container) container.innerHTML = tableHtml;

        const resultDiv = document.getElementById('result');
        if(resultDiv) resultDiv.textContent = isSimulationMode ? "Simulation active..." : "Display Mode";
        
        updateUrlParams();

    } catch(e) {
        const container = document.getElementById('rolls-table-container');
        if(container) container.innerHTML = `<p class="error">エラー: ${e.message}</p>`;
        console.error(e);
    }
}