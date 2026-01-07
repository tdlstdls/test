/** @file view_table_highlight.js @description シミュレーションモードのルートハイライト計算 */

function preparePathHighlightMaps(initialSeed, seeds, numRolls) {
    const highlightMap = new Map();
    const guarHighlightMap = new Map();
    let lastSeedValue = null;

    if (!isSimulationMode) return { highlightMap, guarHighlightMap, lastSeedValue };
    const simConfigEl = document.getElementById('sim-config');
    if (!simConfigEl || !simConfigEl.value.trim()) return { highlightMap, guarHighlightMap, lastSeedValue };

    const simConfigs = parseSimConfig(simConfigEl.value.trim());
    let rngForText = new Xorshift32(initialSeed);
    let currentSeedIndex = 0;
    
    // 修正ポイント: レア被り判定に必要な情報を保持するようにオブジェクトを拡張
    let lastDrawForHighlight = { 
        rarity: null, 
        charId: null,
        originalCharId: null,
        fromRerollRoute: false
    };

    for (const sim of simConfigs) {
        const config = gachaMasterData.gachas[sim.id];
        if (!config) continue;

        let normalRolls = sim.rolls;
        let isGuaranteedStep = false;
        if (sim.g) {
            if (sim.rolls === 15) { 
                normalRolls = 14;
                isGuaranteedStep = true; 
            }
            else if (sim.rolls === 7) { 
                normalRolls = 6;
                isGuaranteedStep = true; 
            }
            else if (sim.rolls === 11) { 
                normalRolls = 10;
                isGuaranteedStep = true; 
            }
            else { 
                normalRolls = sim.rolls;
            }
        }

        if (isGuaranteedStep) {
            const startSeedIndex = currentSeedIndex;
            guarHighlightMap.set(startSeedIndex, sim.id);
            for (let k = 0; k < normalRolls; k++) {
                if (currentSeedIndex >= numRolls * 2) break;
                highlightMap.set(currentSeedIndex, sim.id);
                
                const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, lastDrawForHighlight);
                if (rr.seedsConsumed === 0) break;

                // 修正ポイント: 次のロールの判定用に状態を正確に更新（垂直被りと連続被り両方に対応）
                lastDrawForHighlight = { 
                    rarity: rr.rarity, 
                    charId: rr.charId,
                    originalCharId: rr.originalChar ? rr.originalChar.id : rr.charId,
                    fromRerollRoute: rr.isRerolled 
                };

                currentSeedIndex += rr.seedsConsumed;
                for (let x = 0; x < rr.seedsConsumed; x++) rngForText.next();
            }
            
            if (startSeedIndex < numRolls * 2) highlightMap.set(`${startSeedIndex}G`, sim.id);
            
            if (currentSeedIndex < seeds.length) {
                const gr = rollGuaranteedUber(currentSeedIndex, config, seeds);
                
                // 確定枠後の状態更新
                lastDrawForHighlight = {
                    rarity: 'uber',
                    charId: gr.charId,
                    originalCharId: gr.charId,
                    fromRerollRoute: false
                };

                currentSeedIndex += gr.seedsConsumed;
                for (let x = 0; x < gr.seedsConsumed; x++) rngForText.next();
            }
        } else {
            for (let k = 0; k < normalRolls; k++) {
                if (currentSeedIndex >= numRolls * 2) break;
                highlightMap.set(currentSeedIndex, sim.id);
                
                const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, lastDrawForHighlight);
                if (rr.seedsConsumed === 0) break;

                // 修正ポイント: 通常ロールの連続性（トラック移動）を正確に計算
                lastDrawForHighlight = { 
                    rarity: rr.rarity, 
                    charId: rr.charId,
                    originalCharId: rr.originalChar ? rr.originalChar.id : rr.charId,
                    fromRerollRoute: rr.isRerolled 
                };

                currentSeedIndex += rr.seedsConsumed;
                for (let x = 0; x < rr.seedsConsumed; x++) rngForText.next();
            }
        }
    }
    lastSeedValue = rngForText.seed;
    return { highlightMap, guarHighlightMap, lastSeedValue };
}