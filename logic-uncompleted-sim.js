// --- logic-uncompleted-sim.js ---

/**
 * 10連詳細（現在地からの1回分）を計算するロジック
 */
function calculateTenPullDetailedLogic(fullSeedArray, gacha, thresholds, ngVal, initialLastRollId, getAddressFunc) {
    const isGuaranteedActive = !isNaN(ngVal);
    const guaranteedCycle = gacha.guaranteedCycle || 30;
    
    let guaranteedStatus = 'none';
    let currentNgVal = ngVal;
    
    // Featured 判定で実際に消費したシードの数をトラック
    let featuredSeedPtr = 0; 
    
    if (isGuaranteedActive && currentNgVal > 0) {
        if (currentNgVal <= 10) {
            guaranteedStatus = `next guaranteed(${currentNgVal}) <= 10 → 9ロール抽選`;
        } else {
            guaranteedStatus = `next guaranteed(${currentNgVal}) >= 11 → 10ロール抽選`;
        }
    } else {
        guaranteedStatus = 'Not Guaranteed/NG Invalid → 10ロール抽選';
    }

    const featuredLog = [];
    const processLog = [];
    const results = [];
    let featuredCountInCycle = 0; 

    // 目玉判定用シード (S1～S10) の計算
    const featuredResults = [];
    for (let i = 1; i <= 10; i++) { 
        const isGuaranteedRoll = isGuaranteedActive && i === currentNgVal && currentNgVal <= 10;

        if (isGuaranteedRoll) {
             featuredLog.push(`S${i} (Skipped): Guaranteed Roll (${currentNgVal})`);
             continue;
        }
        
        const sVal = fullSeedArray[featuredSeedPtr];
        if (sVal === undefined) {
             console.error(`Seed is undefined at index ${featuredSeedPtr}.`);
             break; 
        }

        const mod = sVal % 10000;
        const isFeatured = mod < gacha.featuredItemRate;
        featuredResults.push({ index: i, isFeatured: isFeatured, seedIndex: featuredSeedPtr + 1 });
        featuredLog.push(`S${featuredSeedPtr + 1} (${sVal}) % 10000 = ${mod} < ${gacha.featuredItemRate} → ${isFeatured} (Roll ${i}用)`);
        featuredSeedPtr++;
    }

    let currentSeedIndex = featuredSeedPtr; 
    let lastItemId = initialLastRollId || -1;
    const rollCount = 10;
    let featuredIdxPtr = 0; 

    for (let r = 1; r <= rollCount; r++) {
        let label = `Roll${r}`;
        
        // 確定ロール判定
        if (isGuaranteedActive && r === currentNgVal) {
            label += `(G${r})`;
            if (currentNgVal <= 10) { 
                processLog.push(`${label} (Skipped): Guaranteed Roll`);
            } else {
                processLog.push(`${label}: Featured Item by guaranteed`); 
            }
            results.push({ label: label, name: '目玉(確定)', isGuaranteed: true, isFeatured: false, isReroll: false, preRerollName: null });
            featuredCountInCycle++; 
            currentNgVal = guaranteedCycle - (rollCount - r);
            continue;
        }

        if (isGuaranteedActive) currentNgVal--;

        // 非確定ロール判定
        const fRes = featuredResults[featuredIdxPtr];
        if (!fRes) {
             processLog.push(`${label}: **ERROR**: Featured check result missing.`);
             break;
        }
        featuredIdxPtr++; 
        
        if (fRes.isFeatured) {
            results.push({ label: label, name: '目玉', isGuaranteed: false, isFeatured: true, isReroll: false, preRerollName: null });
             processLog.push(`${label}: Featured (by S${fRes.seedIndex})`);
             lastItemId = -2;
             featuredCountInCycle++; 
             if (isGuaranteedActive) { 
                 currentNgVal--;
                 if (currentNgVal <= 0) currentNgVal = guaranteedCycle;
             }
        } else {
            // Continuation Seeds Consumption
            const sRarity = fullSeedArray[currentSeedIndex];
            const sSlot = fullSeedArray[currentSeedIndex+1];
            
            if (sRarity === undefined || sSlot === undefined) {
                 processLog.push(`${label}: **ERROR**: Seed array ended unexpectedly.`);
                 break; 
            }

            const rarityInfo = getRarityFromRoll(sRarity % 10000, thresholds);
            const rId = rarityInfo.id;
            const rName = rarityInfo.name;
            let logStr = `${label}: S${currentSeedIndex+1}→${rName}`;
            
            const pool = gacha.rarityItems[rId] || [];
            const poolSize = pool.length > 0 ? pool.length : 1;
            const slot = sSlot % poolSize;
            const itemId = (pool[slot] !== undefined) ? pool[slot] : -1;
            const itemName = getItemNameSafe(itemId);
            
            logStr += `, S${currentSeedIndex+2}→${itemName}`;
            
            let finalId = itemId;
            let finalName = itemName;
            let consumed = 2;
            let isReroll = false;
            let preRerollName = null;

            // Dupe Check
            if (rId === 1 && itemId !== -1 && itemId === lastItemId) {
                const sReRoll = fullSeedArray[currentSeedIndex+2];
                if (sReRoll === undefined) break;
                const rePool = pool.filter(id => id !== itemId);
                const reDiv = rePool.length;
                logStr += ` [Dupe]`;
                if (reDiv > 0) {
                    isReroll = true;
                    preRerollName = itemName;
                    const reSlot = sReRoll % reDiv;
                    finalId = rePool[reSlot];
                    finalName = getItemNameSafe(finalId);
                    logStr += `, S${currentSeedIndex+3}→${finalName}`;
                }
                consumed = 3;
            }

            processLog.push(logStr);
            results.push({ label: label, name: finalName, isGuaranteed: false, isFeatured: false, isReroll: isReroll, preRerollName: preRerollName });
            currentSeedIndex += consumed;
            lastItemId = finalId;
            
            if (isGuaranteedActive) { 
                 currentNgVal--;
                 if (currentNgVal <= 0) currentNgVal = guaranteedCycle;
            }
        }
    }

    const nextSeedVal = fullSeedArray[currentSeedIndex]; 
    const nextIndex = currentSeedIndex + 1;
    const nextAddress = (fullSeedArray.length > currentSeedIndex) ? getAddressFunc(nextIndex) : 'End';
    const nextNgVal = isGuaranteedActive ? currentNgVal : NaN;
    const seedsConsumedCorrectly = currentSeedIndex; 

    return {
        guaranteedStatus, featuredLog, processLog, results, featuredCountInCycle,
        transition: { consumedCount: seedsConsumedCorrectly, nextIndex: nextIndex, nextAddress: nextAddress, nextSeed: nextSeedVal, lastItemId: lastItemId, nextNgVal: nextNgVal }
    };
}

/**
 * nサイクル分の10連計算を実行
 */
function calculateTenPullsOverCycles(initialFullSeedArray, gacha, thresholds, initialNgVal, initialLastRollId, nCycles = 10) {
    const getAddress = (n) => getAddressStringGeneric(n, 3);
    let currentSeedArray = [...initialFullSeedArray];
    let currentLastRollId = initialLastRollId;
    let currentNgVal = initialNgVal;
    
    const cycleResults = [];
    const maxSeedsInTenPull = 40; 

    for (let c = 1; c <= nCycles; c++) {
        if (currentSeedArray.length < 1) break;
        const tenPullSeedSlice = currentSeedArray.slice(0, maxSeedsInTenPull); 
        const cycleResult = calculateTenPullDetailedLogic(tenPullSeedSlice, gacha, thresholds, currentNgVal, currentLastRollId, getAddress);
        
        cycleResults.push({ cycle: c, ...cycleResult, startNgVal: currentNgVal, startLastRollId: currentLastRollId });

        const consumedCount = cycleResult.transition.consumedCount;
        currentSeedArray = currentSeedArray.slice(consumedCount);
        currentLastRollId = cycleResult.transition.lastItemId;
        currentNgVal = cycleResult.transition.nextNgVal;
    }
    return cycleResults;
}

/**
 * 単発Nロール後の10連目玉獲得数期待値の計算ロジック
 */
function calculateExpectedFeaturedCounts(initialFullSeedArray, gacha, thresholds, nRollsArray, initialNgVal, initialLastRollId) {
    const results = {};
    const guaranteedCycle = gacha.guaranteedCycle || 30;
    const tenPullSimulationLength = 40; 
    
    // Nロール後の状態をシミュレーション
    const simulateSingleRollsAndGetState = (n, seedArray, initialNg, initialLastRoll) => {
        let currentSeedIndex = 0;
        let currentNg = !isNaN(initialNg) && initialNg > 0 ? initialNg : guaranteedCycle;
        let lastItemId = initialLastRoll || -1;
        
        for (let r = 1; r <= n; r++) {
            if (currentSeedIndex >= seedArray.length) break;
            const isFeatured = (seedArray[currentSeedIndex] % 10000) < gacha.featuredItemRate;
            const isGuaranteedRoll = (currentNg === 1);
            let usedSeeds = 0;

            if (isGuaranteedRoll) {
                usedSeeds = 1; currentNg = guaranteedCycle; lastItemId = -2;
            } else if (isFeatured) {
                usedSeeds = 1; currentNg = currentNg - 1;
                if (currentNg <= 0) currentNg = guaranteedCycle;
                lastItemId = -2;
            } else {
                const sRarity = seedArray[currentSeedIndex+1];
                const sSlot = seedArray[currentSeedIndex+2];
                if (sRarity === undefined || sSlot === undefined) { usedSeeds = 3; break; }
                const rarityInfo = getRarityFromRoll(sRarity % 10000, thresholds);
                const rId = rarityInfo.id;
                const pool = gacha.rarityItems[rId] || [];
                const itemId = (pool[sSlot % (pool.length||1)] !== undefined) ? pool[sSlot % (pool.length||1)] : -1;
                usedSeeds = 3;
                let finalId = itemId;

                if (rId === 1 && itemId !== -1 && itemId === lastItemId) {
                    const sReRoll = seedArray[currentSeedIndex+3];
                    if (sReRoll !== undefined) {
                        const rePool = pool.filter(id => id !== itemId);
                        if (rePool.length > 0) {
                            finalId = rePool[sReRoll % rePool.length];
                            usedSeeds = 4;
                        }
                    }
                }
                currentNg = currentNg - 1;
                if (currentNg <= 0) currentNg = guaranteedCycle;
                lastItemId = finalId;
            }
            currentSeedIndex += usedSeeds;
        }
        return { nextSeedIndex: currentSeedIndex, nextNg: currentNg, nextLastRollId: lastItemId };
    };

    for (const n of nRollsArray) {
        if (n < 0) continue;
        const { nextSeedIndex, nextNg, nextLastRollId } = simulateSingleRollsAndGetState(n, initialFullSeedArray, initialNgVal, initialLastRollId);
        const tenPullSeedArray = initialFullSeedArray.slice(nextSeedIndex, nextSeedIndex + tenPullSimulationLength);

        if (tenPullSeedArray.length < 9) {
             results[n] = 0; continue;
        }
        const tenPullResult = calculateTenPullDetailedLogic(tenPullSeedArray, gacha, thresholds, nextNg, nextLastRollId, (addr) => `S${nextSeedIndex + addr}`);
        results[n] = tenPullResult.featuredCountInCycle;
    }
    return results;
}