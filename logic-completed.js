/**
 * コンプ済み（統合）ビュー用のデータを計算する関数
 */
function calculateCompletedData(initialSeed, gacha, tableRows, thresholds, initialLastRollId, initialNg) {
    // 1. シード生成
    const maxSeedsNeeded = tableRows * 4 * 2 + 1000;
    const SEED = generateSeedList(initialSeed, maxSeedsNeeded);

    // ヘルパー
    const getAddress = (n) => getAddressStringGeneric(n, 2);

    const Nodes = [];
    const maxNodeIndex = tableRows * 2 + 100;
    
    // 2. ノード計算
    for (let i = 1; i <= maxNodeIndex; i++) {
        const node = {
            index: i,
            address: getAddress(i),
            seed1: SEED[i],
            seed2: SEED[i+1],
            seed3: SEED[i+2],
            singleRoll: null, singleUseSeeds: null, singleNextAddr: null,
            tenPullMark: null, tenPullUseSeeds: null, tenPullNextAddr: null,
            roll1: SEED[i] % 10000
        };

        const roll1 = node.seed1 % 10000;
        node.rarity = getRarityFromRoll(roll1, thresholds);
        node.rarityId = node.rarity.id;
        node.roll1 = roll1;

        // Guaranteed (Uber/Legend) calculation
        const uberRate = gacha.uberGuaranteedFlag ? (gacha.rarityRates['3'] || 0) : 0;
        const legendRate = gacha.legendGuaranteedFlag ? (gacha.rarityRates['4'] || 0) : 0;
        const gDivisor = uberRate + legendRate;
        if (gDivisor > 0) {
            const gRoll = node.seed1 % gDivisor;
            node.rarityGId = (gRoll < uberRate) ? '3' : '4';
            node.rarityGName = (node.rarityGId === '3') ? '超激レア' : '伝説レア';
            node.gRoll = gRoll; node.gDivisor = gDivisor;
        } else {
            node.rarityGId = null; node.rarityGName = '-'; node.gRoll = 0; node.gDivisor = 0;
        }

        // Normal Item
        const pool = gacha.rarityItems[node.rarityId] || [];
        node.poolSize = pool.length;
        if (pool.length > 0) {
            node.slot = node.seed2 % pool.length;
            node.itemId = pool[node.slot];
            node.itemName = getItemNameSafe(node.itemId);
        } else {
            node.slot = 0; node.itemId = -1; node.itemName = '---';
        }

        // Guaranteed Item
        const poolG = node.rarityGId ? (gacha.rarityItems[node.rarityGId] || []) : [];
        node.poolGSize = poolG.length;
        if (poolG.length > 0) {
            node.slotG = node.seed2 % poolG.length;
            node.itemGId = poolG[node.slotG];
            node.itemGName = getItemNameSafe(node.itemGId);
        } else {
            node.slotG = 0; node.itemGId = -1; node.itemGName = '---';
        }

        // ReRoll Flag Calculation
        const prevNode = (i > 2) ? Nodes[i - 3] : null;
        const isRare = (node.rarityId === 1);
        const prevItemId = prevNode ? (prevNode.reRollFlag ? prevNode.reRollItemId : prevNode.itemId) : initialLastRollId;
        node.reRollFlag = isRare && (pool.length > 1) && (node.itemId !== -1) && (node.itemId === prevItemId);
        node.useSeeds = node.reRollFlag ? 3 : 2;

        if (isRare && pool.length > 1) {
             const reRollPool = pool.filter(id => id !== node.itemId);
             if (reRollPool.length > 0) {
                 node.reRollSlot = node.seed3 % reRollPool.length;
                 node.reRollItemId = reRollPool[node.reRollSlot];
                 node.reRollItemName = getItemNameSafe(node.reRollItemId);
             } else {
                 node.reRollItemId = -1; node.reRollItemName = '---';
             }
             const nextIdxRe = i + 3;
             node.reRollNextAddress = getAddress(nextIdxRe);
        } else {
             node.reRollItemId = -1; node.reRollItemName = '---';
             node.reRollNextAddress = '-';
        }
        Nodes.push(node);
    }

    // 3. 単発ルート計算
    let sIdx = 1;
    let sLastItemId = initialLastRollId || -1;
    let sRoll = 1;
    const ngVal = parseInt(initialNg, 10);
    const hasGuaranteed = !isNaN(ngVal);

    while (sIdx <= maxNodeIndex && sRoll <= tableRows) {
        const node = Nodes[sIdx - 1];
        const isGuaranteedRoll = hasGuaranteed && (gacha.uberGuaranteedFlag || gacha.legendGuaranteedFlag) && (sRoll >= ngVal) && ((sRoll - ngVal) % 10 === 0);
        
        if (isGuaranteedRoll) {
            if (node) {
                node.singleRoll = `${sRoll}g`; 
                node.singleUseSeeds = 2;
                node.singleNextAddr = getAddress(sIdx + 2);
            }
            sLastItemId = node ? node.itemGId : -1;
            sIdx += 2;
        } else {
            const isRare = (node && node.rarityId === 1);
            const poolSize = gacha.rarityItems[1] ? gacha.rarityItems[1].length : 0;
            const isMatch = (node && node.itemId !== -1 && node.itemId === sLastItemId);
            const reRollFlag = isRare && isMatch && poolSize > 1;
            
            const useSeeds = reRollFlag ? 3 : 2;
            const finalId = (node && reRollFlag) ? node.reRollItemId : (node ? node.itemId : -1);
            
            if (node) {
                node.singleRoll = sRoll;
                node.singleUseSeeds = useSeeds;
                node.singleNextAddr = getAddress(sIdx + useSeeds);
            }
            sLastItemId = finalId;
            sIdx += useSeeds;
        }
        sRoll++;
    }

    // 4. 10連ルート計算
    let tIdx = 1;
    let tRoll = 1;
    let tLastItemId = initialLastRollId || -1; 

    while (tIdx <= maxNodeIndex && tRoll <= tableRows) {
        const isCycleStart = (tRoll - 1) % 10 === 0;
        const isGuaranteedRoll = hasGuaranteed && (gacha.uberGuaranteedFlag || gacha.legendGuaranteedFlag) && (tRoll >= ngVal) && ((tRoll - ngVal) % 10 === 0);
        
        if (isCycleStart) {
            const nodeG = Nodes[tIdx - 1];
            if(nodeG) { 
                nodeG.tenPullMark = 'r'; 
                nodeG.tenPullUseSeeds = 1; 
                nodeG.tenPullNextAddr = getAddress(tIdx + 1); 
            }
            tIdx++;
        }
        if (tIdx <= maxNodeIndex) {
            if (isGuaranteedRoll) {
                const gNode = Nodes[tIdx - 2]; 
                const nextNode = Nodes[tIdx - 1]; 
                if (gNode) tLastItemId = gNode.itemGId; 
                if (nextNode) {
                    nextNode.tenPullMark = `↖${tRoll}g`;
                    nextNode.tenPullUseSeeds = 1; 
                    nextNode.tenPullNextAddr = getAddress(tIdx + 1); 
                }
                tIdx++;
            } else {
                const node = Nodes[tIdx - 1];
                const isRare = (node && node.rarityId === 1);
                const poolSize = gacha.rarityItems[1] ? gacha.rarityItems[1].length : 0;
                const isMatch = (node && node.itemId !== -1 && node.itemId === tLastItemId);
                const reRollFlag = isRare && isMatch && poolSize > 1;

                const useSeeds = reRollFlag ? 3 : 2;
                const finalId = (node && reRollFlag) ? node.reRollItemId : (node ? node.itemId : -1);

                if (node) {
                    node.tenPullMark = tRoll;
                    node.tenPullUseSeeds = useSeeds;
                    node.tenPullNextAddr = getAddress(tIdx + useSeeds);
                }
                tLastItemId = finalId;
                tIdx += useSeeds;
            }
        }
        tRoll++;
    }

    // 5. highlightInfo 生成
    const highlightInfo = new Map(); 

    // Single Route Highlight
    sIdx = 1;
    sLastItemId = initialLastRollId || -1;
    for (let roll = 1; roll <= tableRows; roll++) {
        if (sIdx > maxNodeIndex) break;
        const node = Nodes[sIdx - 1];
        const isGuaranteedRoll = hasGuaranteed && (gacha.uberGuaranteedFlag || gacha.legendGuaranteedFlag) && (roll >= ngVal) && ((roll - ngVal) % 10 === 0);
        
        if (isGuaranteedRoll) {
            const addressKey = node.address + 'G';
            const info = highlightInfo.get(addressKey) || {};
            info.single = true; info.singleRoll = roll; 
            highlightInfo.set(addressKey, info);
            sLastItemId = node.itemGId;
            sIdx += 2; 
        } else {
            const isRare = (node.rarityId === 1);
            const poolSize = gacha.rarityItems[1] ? gacha.rarityItems[1].length : 0;
            const isMatch = (node && node.itemId !== -1 && node.itemId === sLastItemId);
            const reRollFlag = isRare && isMatch && poolSize > 1;
            const useSeeds = reRollFlag ? 3 : 2;
            const finalId = (node && reRollFlag) ? node.reRollItemId : (node ? node.itemId : -1);
            
            const info = highlightInfo.get(node.address) || {};
            info.single = true; info.singleRoll = roll; 
            info.s_reRoll = reRollFlag;
            if (reRollFlag) {
                info.s_normalName = node.itemName;
                info.s_reRollName = node.reRollItemName;
                info.s_nextAddr = getAddress(sIdx + useSeeds);
            }
            highlightInfo.set(node.address, info);
            sLastItemId = finalId;
            sIdx += useSeeds;
        }
    }
    
    // Ten Pull Route Highlight
    tIdx = 1;
    tLastItemId = initialLastRollId || -1;
    for (let roll = 1; roll <= tableRows; roll++) {
        if (tIdx > maxNodeIndex) break;
        const isCycleStart = (roll - 1) % 10 === 0;
        if (isCycleStart) tIdx++; 
        
        if (tIdx <= maxNodeIndex) {
            const node = Nodes[tIdx - 1];
            const isGuaranteedRoll = (gacha.uberGuaranteedFlag || gacha.legendGuaranteedFlag) && (roll >= ngVal) && ((roll - ngVal) % 10 === 0);
            
            if (isGuaranteedRoll) {
                const gNode = Nodes[tIdx - 2]; 
                if (gNode) {
                    const addressKey = gNode.address + 'G'; 
                    const info = highlightInfo.get(addressKey) || {};
                    info.ten = true; info.tenRoll = roll; 
                    highlightInfo.set(addressKey, info);
                    tLastItemId = gNode.itemGId; 
                } 
                tIdx += 1;
            } else {
                const isRare = (node && node.rarityId === 1);
                const poolSize = gacha.rarityItems[1] ? gacha.rarityItems[1].length : 0;
                const isMatch = (node.itemId !== -1 && node.itemId === tLastItemId);
                const reRollFlag = isRare && isMatch && poolSize > 1;
                const useSeeds = reRollFlag ? 3 : 2;
                let finalId = node.itemId;
                if (reRollFlag) finalId = node.reRollItemId;
                
                const info = highlightInfo.get(node.address) || {};
                info.ten = true; info.tenRoll = roll; 
                info.t_reRoll = reRollFlag;
                if (reRollFlag) {
                    info.t_normalName = node.itemName;
                    info.t_reRollName = node.reRollItemName;
                    info.t_nextAddr = getAddress(tIdx + useSeeds);
                }
                highlightInfo.set(node.address, info);
                tLastItemId = finalId;
                tIdx += useSeeds;
            }
        }
        tRoll++;
    }

    return { Nodes, highlightInfo, maxNodeIndex };
}