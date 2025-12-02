// --- logic-uncompleted.js ---

/**
 * 未コンプ（分割）ビュー用のデータを計算する関数
 */
function calculateUncompletedData(initialSeed, gacha, tableRows, thresholds, initialLastRollId, params) {
    // 1. シード生成
    const maxSeedsNeeded = tableRows * 10 + 1000; 
    const SEED = generateSeedList(initialSeed, maxSeedsNeeded);
    const getAddress = (n) => getAddressStringGeneric(n, 3);
    
    // 2. 全ノード計算 (メインテーブル用)
    const Nodes = [];
    const maxNodes = tableRows * 3 + 20; 
    const highlightInfo = new Map(); 

    const ngVal = parseInt(params.get('ng'), 10);
    const initialFs = parseInt(params.get('fs'), 10) || 0; 
    const guaranteedCycle = gacha.guaranteedCycle || 30;
    
    for (let i = 1; i <= maxNodes; i++) {
        const seedStartIdx = i; 
        const s1 = SEED[seedStartIdx];     
        const s2 = SEED[seedStartIdx + 1]; 
        const s3 = SEED[seedStartIdx + 2]; 
        const s4 = SEED[seedStartIdx + 3]; 
        let prevSeedVal = SEED[seedStartIdx - 1];

        const node = {
            index: i, address: getAddress(i),
            seed1: s1, seed2: s2, seed3: s3, seed4: s4,
            prevSeed1: prevSeedVal,
            isFeatured: (s1 % 10000) < gacha.featuredItemRate,
            singleRoll: null, singleUseSeeds: null, singleNextAddr: null,
            guaranteedNextNgVal: ngVal,
            isFeaturedUsedFs: false,
        };

        node.featuredNextAddress = getAddress(i + 1); 
        node.normalNextAddress = getAddress(i + 3);   
        node.reRollNextAddress = getAddress(i + 4);   

        node.rarity = getRarityFromRoll(s2 % 10000, thresholds);
        node.rarityId = node.rarity.id;
        node.rarityName = node.rarity.name; 
        
        // レアリティ範囲表示用
        let lowerBound = 0, upperBound = 10000;
        const rarityIds = Object.keys(thresholds).map(Number).sort((a, b) => a - b);
        for(const id of rarityIds) {
            if (id < node.rarityId) lowerBound = thresholds[id];
            if (id === node.rarityId) { upperBound = thresholds[id]; break; }
        }
        node.rarityRateRangeDisplay = `${lowerBound}<=${s2 % 10000}<${upperBound}`;
        
        const pool = gacha.rarityItems[node.rarityId] || [];
        node.poolSize = pool.length;
        if (pool.length > 0) {
            node.slot = s3 % pool.length;
            node.itemId = pool[node.slot];
            node.itemName = getItemNameSafe(node.itemId);
        } else {
            node.slot = 0; node.itemId = -1; node.itemName = '---';
        }
        
        const isRare = (node.rarityId === 1);
        if (isRare && pool.length > 1) {
            const reRollPool = pool.filter(id => id !== node.itemId);
            if (reRollPool.length > 0) {
                node.reRollSlot = s4 % reRollPool.length;
                node.reRollItemId = reRollPool[node.reRollSlot];
                node.reRollItemName = getItemNameSafe(node.reRollItemId);
            } else { node.reRollItemId = -1; node.reRollItemName = '---'; }
        } else { node.reRollItemId = -1; node.reRollItemName = '---'; }

        // Dupe判定用
        let compareId3Node = -1, compareId4Node = -1;
        let compareName3Node = '---', compareName4Node = '---';
        
        if (i <= 1) { 
            compareId3Node = initialLastRollId || -1;
            compareName3Node = getItemNameSafe(initialLastRollId || -1);
        } else {
            const pNode3 = (i > 3) ? Nodes[i-4] : null; 
            if (pNode3 && pNode3.singleUseSeeds === 3) {
                 compareId3Node = pNode3.itemId; compareName3Node = pNode3.itemName;
            } else if (i <= 3) {
                compareId3Node = initialLastRollId || -1; compareName3Node = getItemNameSafe(initialLastRollId || -1);
            }
            const pNode4 = (i > 4) ? Nodes[i-5] : null;
            if (pNode4 && pNode4.singleUseSeeds === 4 && pNode4.reRollItemId !== -1) {
                 compareId4Node = pNode4.reRollItemId; compareName4Node = pNode4.reRollItemName;
            }
        }
        
        const currentId = node.itemId;
        const isDupe3 = (currentId !== -1 && currentId === compareId3Node);
        const isDupe4 = (compareId4Node !== -1 && currentId === compareId4Node); 
        node.isDupe = (node.rarityId === 1 && (isDupe3 || isDupe4)); 

        if (node.rarityId === 1) {
            const id3 = compareId3Node !== -1 ? compareName3Node : '-';
            const id4 = compareId4Node !== -1 ? compareName4Node : '';
            node.dupeCompareTargets = `${id3}${id4 ? '/' + id4 : ''}`; 
        } else { node.dupeCompareTargets = node.rarityName; }

        Nodes.push(node);
    }
    
    // 3. 単発ルート計算
    let sIdx = 1; 
    let sLastActualItemId = initialLastRollId || -1; 
    let sCurrentFs = initialFs;
    const singleRoutePath = new Map();
    const hasGuaranteed = !isNaN(ngVal);
    let currentNg = hasGuaranteed ? ngVal : -1;

    for (let roll = 1; roll <= tableRows; roll++) {
        if (sIdx > maxNodes) break;
        const node = Nodes[sIdx - 1];
        if (!node) break;
        
        const isGuaranteedRoll = hasGuaranteed && (currentNg === 1); 
        node.singleCompareItemName = getItemNameSafe(sLastActualItemId);
        node.singleCompareItemId = sLastActualItemId; 

        if (isGuaranteedRoll) {
            node.singleRoll = `${roll}g`;
            node.singleUseSeeds = 1; 
            node.singleNextAddr = node.featuredNextAddress;
            node.singleIsReroll = false; 
            node.isGuaranteedRoll = true; // フラグ
            currentNg = guaranteedCycle; 
            sLastActualItemId = -2; 
        } else {
            let usedSeeds = 0;
            let finalId = -1;
            
            if (node.isFeatured) {
                usedSeeds = 1; finalId = -2; 
                node.singleRoll = roll;
                node.singleUseSeeds = usedSeeds;
                node.singleNextAddr = node.featuredNextAddress; 
                if (sCurrentFs > 0) { sCurrentFs -= 1; node.isFeaturedUsedFs = true; }
            } else {
                const poolSize = gacha.rarityItems[1] ? gacha.rarityItems[1].length : 0;
                const currentId = Number(node.itemId);
                const lastId = Number(sLastActualItemId);
                const isMatch = (currentId !== -1 && lastId !== -1 && currentId === lastId);
                const isReroll = (node.rarityId === 1) && isMatch && poolSize > 1; 
                
                finalId = isReroll ? node.reRollItemId : node.itemId;
                usedSeeds = isReroll ? 4 : 3;
                
                node.singleIsReroll = isReroll; 
                node.singleRoll = roll;
                node.singleUseSeeds = usedSeeds;
                node.singleNextAddr = isReroll ? node.reRollNextAddress : node.normalNextAddress; 
            }
            sLastActualItemId = finalId; 
            if (hasGuaranteed) {
                currentNg = currentNg - 1;
                if (currentNg <= 0) currentNg = guaranteedCycle;
            }
        }
        singleRoutePath.set(sIdx, roll);
        sIdx = sIdx + (node.singleUseSeeds || 3); 
    }

    // 4. Highlight Info 生成 (単発ルート)
    sIdx = 1; 
    for (let roll = 1; roll <= tableRows; roll++) {
        if (sIdx > maxNodes) break;
        const node = Nodes[sIdx - 1];
        if (!node || node.singleRoll === null) break;
        const addressKey = node.address;
        
        const info = highlightInfo.get(addressKey) || {};
        info.single = true; info.singleRoll = roll; 

        if (node.singleRoll.toString().endsWith('g')) {
             info.s_guaranteed = true;
        } else if (node.isFeatured) {
             info.s_featured = true; info.s_reRoll = false;
        } else if (node.rarityId !== 1) { 
             info.s_featured = false; info.s_reRoll = false; 
             info.s_normalName = node.rarityName; 
        } else {
             info.s_featured = false;
             info.s_reRoll = node.singleIsReroll; 
             info.s_currentId = node.itemId;
             if (info.s_reRoll) {
                 info.s_normalName = node.itemName; 
                 info.s_reRollName = node.reRollItemName;
             }
        }
        highlightInfo.set(addressKey, info);
        sIdx += node.singleUseSeeds || 3; 
    }
    
    // 5. Simロジック委譲: 10連サイクル計算 & 期待値計算
    const tenPullCyclesData = calculateTenPullsOverCycles(SEED, gacha, thresholds, ngVal, initialLastRollId, 10);
    const nRollsArray = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const expectedFeaturedCounts = calculateExpectedFeaturedCounts(SEED, gacha, thresholds, nRollsArray, ngVal, initialLastRollId);

    return { Nodes, highlightInfo, maxNodes, singleRoutePath, tenPullCyclesData, expectedFeaturedCounts };
}