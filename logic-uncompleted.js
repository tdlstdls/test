/**
 * 未コンプ（分割）ビュー用のデータを計算する関数
 */
function calculateUncompletedData(initialSeed, gacha, tableRows, thresholds, initialLastRollId, params) {
    // 1. シード生成
    const maxSeedsNeeded = tableRows * 10 + 1000; 
    const SEED = generateSeedList(initialSeed, maxSeedsNeeded);

    const getAddress = (n) => getAddressStringGeneric(n, 3);
    
    // 2. 全ノード計算
    const Nodes = [];
    const maxNodes = tableRows * 3 + 20;
    
    // 表示用配列 (Addressとは非同期のリスト)
    const tenPullDisplayLines = [];
    const tenPullResults = [];
    
    const highlightInfo = new Map(); 

    for (let i = 1; i <= maxNodes; i++) {
        const seedStartIdx = (i - 1) * 3 + 1;
        const s1 = SEED[seedStartIdx];     
        const s2 = SEED[seedStartIdx + 1]; 
        const s3 = SEED[seedStartIdx + 2]; 
        const s4 = SEED[seedStartIdx + 3]; 
        const s5 = SEED[seedStartIdx + 4]; 

        const node = {
            index: i,
            address: getAddress(i),
            seed1: s1, seed2: s2, seed3: s3, seed4: s4, seed5: s5,
            isFeatured: (s1 % 10000) < gacha.featuredItemRate,
            singleRoll: null, singleUseSeeds: null, singleNextAddr: null,
            // ★修正: singleIsRerollとsingleCompareItemNameを初期化
            singleIsReroll: false,  
            singleCompareItemName: '---', 
            singleCompareItemId: -1, // ★追加: 比較対象IDを初期化
            tenPullMark: null, tenPullUseSeeds: null, tenPullNextAddr: null,  
        };

        node.featuredNextAddress = getAddress(i + 1);
        node.normalNextAddress = getAddress(i + 3);
        node.reRollNextAddress = getAddress(i + 4);

        node.rarity = getRarityFromRoll(s2 % 10000, thresholds);
        node.rarityId = node.rarity.id;
        node.rarityRoll = s2 % 10000;
        node.rarityGId = null; node.itemGId = -1; node.itemGName = '---';

        const pool = gacha.rarityItems[node.rarityId] || [];
        node.poolSize = pool.length;
        if (pool.length > 0) {
            node.slot = s3 % pool.length;
            node.itemId = pool[node.slot];
            node.itemName = getItemNameSafe(node.itemId);
        } else {
            node.slot = 0; node.itemId = -1; node.itemName = '---';
        }
        
        // ReRoll Logic
        const isRare = (node.rarityId === 1);
        if (isRare && pool.length > 1) {
            const reRollPool = pool.filter(id => id !== node.itemId);
            if (reRollPool.length > 0) {
                node.reRollSlot = s4 % reRollPool.length;
                node.reRollItemId = reRollPool[node.reRollSlot];
                node.reRollItemName = getItemNameSafe(node.reRollItemId);
            } else {
                node.reRollItemId = -1; node.reRollItemName = '---';
            }
        } else {
            node.reRollItemId = -1; node.reRollItemName = '---';
        }

        // Duplication Status Logic (単発ルートの比較対象とは異なるロジックのため注意)
        let prevItemDupeId = -1;
        let pNode = null;
        if (i <= 3) { 
            prevItemDupeId = initialLastRollId || -1;
        } else {
            pNode = Nodes[i-4]; 
            // 添付ファイルでは pNode の null チェックが漏れていましたが、安全のため追加します
            prevItemDupeId = pNode ? pNode.itemId : -1; 
        }

        node.isDupe = (node.rarityId === 1 && node.itemId !== -1 && node.itemId === prevItemDupeId);
        node.itemNameForDisplay = getItemNameSafe(node.itemId);
        node.prevItemDupeName = (i <= 3) ? getItemNameSafe(initialLastRollId || -1) : getItemNameSafe(pNode ? pNode.itemId : -1);

        // Re-ReRoll Logic
        let prevReRollTargetId = (i <= 3) ? (initialLastRollId || -1) : (pNode ? pNode.reRollItemId : -1); // 添付ファイルでは pNode の null チェックが漏れていました
        node.prevReRollTargetName = getItemNameSafe(prevReRollTargetId);
        node.isReReDupe = (node.rarityId === 1 && node.itemId !== -1 && node.itemId === prevReRollTargetId);
        node.reReDupeSourceItemName = getItemNameSafe(node.itemId);

        Nodes.push(node);
    }
    
    // 3. 単発ルート計算
    let sIdx = 1; 
    let sLastActualItemId = initialLastRollId || -1; // Roll #1 の比較対象は Last Roll のアイテム
    const singleRoutePath = new Map();
    const ngVal = parseInt(params.get('ng'), 10);
    const hasGuaranteed = !isNaN(ngVal);
    let currentNg = hasGuaranteed ? ngVal : -1;
    const guaranteedCycle = gacha.guaranteedCycle || 30;

    for (let roll = 1; roll <= tableRows; roll++) {
        if (sIdx > maxNodes) break;
        const node = Nodes[sIdx - 1];
        if (!node) break;
        
        const isGuaranteedRoll = hasGuaranteed && (currentNg === 1); 
        
        // 判定に使用する比較対象アイテム名を取得しノードに保存 (目玉/確定枠通過前)
        const compareItemName = getItemNameSafe(sLastActualItemId);
        node.singleCompareItemName = compareItemName;
        node.singleCompareItemId = sLastActualItemId; // ★追加: 比較対象IDをノードに保存

        if (isGuaranteedRoll) {
            node.singleRoll = `${roll}g`;
            node.singleUseSeeds = 0; 
            node.singleNextAddr = getAddress(sIdx);
            node.singleIsReroll = false; 
            currentNg = guaranteedCycle; 
            // sLastActualItemId は変更しない
            continue; 
        }

        let usedSeeds = 0;
        let finalId = -1;

        if (node.isFeatured) {
            usedSeeds = 1;
            finalId = -2; // 目玉排出を示す一時的なID
            node.singleRoll = roll;
            node.singleUseSeeds = usedSeeds;
            node.singleNextAddr = node.featuredNextAddress;
            node.singleIsReroll = false; 
            // sLastActualItemId は変更しない (次回の比較対象を飛ばす)

        } else {
            const isRare = (node.rarityId === 1);
            const poolSize = gacha.rarityItems[1] ? gacha.rarityItems[1].length : 0;
            
            // レア被り判定の比較
            // ★修正: 意図せぬ型変換による一致を防ぐため、IDを厳密に数値として比較します。
            const currentId = Number(node.itemId);
            const lastId = Number(sLastActualItemId);
            
            // 厳密なID一致判定
            const isMatchByID = (currentId !== -1 && lastId !== -1 && currentId === lastId);
            
            // 最終的なマッチ判定
            const isMatch = isMatchByID; 
            
            // ReRoll判定ロジック
            const isReroll = isRare && isMatch && poolSize > 1; 
            
            finalId = isReroll ? node.reRollItemId : node.itemId;
            usedSeeds = isReroll ? 4 : 3;
            
            // ★修正: ReRollFlagをノードに保存
            node.singleIsReroll = isReroll; 

            // sLastActualItemId を新しい確定アイテムで更新
            sLastActualItemId = finalId; 

            node.singleRoll = roll;
            node.singleUseSeeds = usedSeeds;
            node.singleNextAddr = isReroll ? node.reRollNextAddress : node.normalNextAddress;
        }
        
        singleRoutePath.set(sIdx, roll);
        if (hasGuaranteed) {
            currentNg = currentNg - 1;
            if (currentNg <= 0) currentNg = guaranteedCycle;
        }
        
        sIdx = sIdx + usedSeeds;
    }

    // 4. 10連ルート計算 (TenPull列のデータ行生成)
    let tIdx = 1;
    let tLastItemId = initialLastRollId || -1;
    const tpNgVal = parseInt(params.get('ng'), 10);
    const isTenPullGuaranteed = (tpNgVal > 0); 
    const maxTenPullRolls = Math.min(tableRows, 10); 
    
    const featuredFlags = [];
    let numGuaranteed = 0;
    
    // --- Phase 1: 目玉判定・確定枠 (Roll 1～10) ---
    let guaranteedText = ''; 
    const rollDisplayStartIndex = new Map(); 
    let currentDisplayIndex = 0;


    for (let i = 1; i <= 10; i++) {
        const isGuaranteedSlot = isTenPullGuaranteed && (i === tpNgVal);
        const nodeIndex = i;
        
        if (isGuaranteedSlot) {
            featuredFlags.push({ isFeatured: false, isGuaranteed: true }); 
            numGuaranteed++;
            
            guaranteedText = `目玉(確定)[${i}G]`;
            rollDisplayStartIndex.set(i, currentDisplayIndex); 
            
        } else {
            const checkSeedIndex = i - numGuaranteed;
            const checkSeed = SEED[checkSeedIndex];
            const isFeatured = (checkSeed % 10000) < gacha.featuredItemRate;
            featuredFlags.push({ isFeatured: isFeatured, isGuaranteed: false });
            
            if (nodeIndex <= maxNodes) {
                 const node = Nodes[nodeIndex - 1]; 
                 const featuredText = isFeatured ? `True→目玉[${i}G]` : 'False';
                 
                 const seedDisplay = `${node.seed1}%10000=${node.seed1 % 10000}`;
                 
                 rollDisplayStartIndex.set(i, currentDisplayIndex);
                 tenPullDisplayLines.push(`Featured${i}:${featuredText}<br><span style="font-size: 80%;">${seedDisplay}</span>`);
                 currentDisplayIndex++;
            }
        }
    }

    if (guaranteedText && tenPullDisplayLines.length > 0) {
        tenPullDisplayLines[0] = `${guaranteedText}<br>${tenPullDisplayLines[0]}`;
        if(rollDisplayStartIndex.get(tpNgVal) !== undefined) {
             rollDisplayStartIndex.set(tpNgVal, 0);
        }
    } else if (guaranteedText && tenPullDisplayLines.length === 0) {
        rollDisplayStartIndex.set(tpNgVal, currentDisplayIndex);
        tenPullDisplayLines.push(guaranteedText);
        currentDisplayIndex++;
    }

    let currentSeedIndex = (10 - numGuaranteed) + 1;
    let nodeIndexOffset = 0;
    let resultCount = 0; 

    // --- Phase 2: 詳細判定 (Rarity/Item/ReRoll) ---
    for (let r = 1; r <= maxTenPullRolls; r++) {
        const flagData = featuredFlags[r-1];
        const nodeIndex = tIdx + nodeIndexOffset;
        
        if (flagData.isGuaranteed) {
             const node = Nodes[r - 1]; 
             if (node) {
                 node.tenPullMark = `${r}g`;
                 node.tenPullUseSeeds = 0;
                 node.tenPullNextAddr = getAddress(r);
             }
             tenPullResults.push({text: '目玉(確定)', isFeatured: false}); 
             resultCount++;

        } else if (flagData.isFeatured) {
             const node = Nodes[r - 1];
             if (node) {
                 node.tenPullMark = r;
                 node.tenPullUseSeeds = 0;
                 node.tenPullNextAddr = getAddress(r);
             }
             tenPullResults.push({text: '目玉', isFeatured: true});
             resultCount++;

        } else {
             // 通常アイテム排出の計算
             const s_rarity_seed_idx = currentSeedIndex;
             const s_slot_seed_idx = currentSeedIndex + 1;
             
             const s_rarity = SEED[s_rarity_seed_idx];
             const s_slot = SEED[s_slot_seed_idx];
             
             const rarityObj = getRarityFromRoll(s_rarity % 10000, thresholds);
             const rarityId = rarityObj.id;
             const pool = gacha.rarityItems[rarityId] || [];
             let itemVal = -1;
             let itemName = '---';
             let finalName = '---'; 
             
             if (pool.length > 0) {
                 const slot = s_slot % pool.length;
                 itemVal = pool[slot];
                 itemName = getItemNameSafe(itemVal);
                 finalName = itemName;
             }
             const isRare = (rarityId === 1);
             // レア被り判定の比較対象は tLastItemId を使用
             const isDupe = (itemVal !== -1 && itemVal === tLastItemId);
             const reRoll = isRare && isDupe && pool.length > 1;
             let finalId = itemVal;
             let useSeeds = 2; 

             // 1. Rarity Line
             const n_idx_rarity = Math.floor((s_rarity_seed_idx - 1) / 3) + 1;
             let raritySeedDisplay = '---';
             if (n_idx_rarity <= maxNodes) {
                 const node = Nodes[n_idx_rarity - 1];
                 raritySeedDisplay = node.seed2; 
             }
             rollDisplayStartIndex.set(r, currentDisplayIndex);
             const raritySeedCalc = `${raritySeedDisplay}%10000=${raritySeedDisplay % 10000}`;
             tenPullDisplayLines.push(`Rarity${r}:${rarityId}(${rarityObj.name})<br><span style="font-size: 80%;">${raritySeedCalc}</span>`);
             currentDisplayIndex++;
             
             // 2. Item Line (Slot)
             const n_idx_slot = Math.floor((s_slot_seed_idx - 1) / 3) + 1;
             let slotSeedDisplay = '---';
             const poolSize = pool.length > 0 ? pool.length : 1;
             if (n_idx_slot <= maxNodes) {
                 const node = Nodes[n_idx_slot - 1];
                 slotSeedDisplay = node.seed3; 
             }
             
             if (reRoll) {
                 tenPullDisplayLines.push(`Item${r}:${itemName}→レア被り<br>${slotSeedDisplay}%${poolSize}=${slotSeedDisplay % poolSize}`);
                 currentDisplayIndex++;
                 
                 const rePool = pool.filter(id => id !== itemVal);
                 if (rePool.length > 0) {
                     const s_reroll_seed_idx = currentSeedIndex + 2;
                     const s_reroll = SEED[s_reroll_seed_idx];
                     const reSlot = s_reroll % rePool.length;
                     finalId = rePool[reSlot];
                     const reName = getItemNameSafe(finalId);
                     finalName = `${itemName}<br>(再)${reName}`;
                     useSeeds = 3; 
                     const reRollDivisor = rePool.length;

                     // 3. ReRoll Line
                     const n_idx_reroll = Math.floor((s_reroll_seed_idx - 1) / 3) + 1;
                     let rerollSeedDisplay = '---';
                     if (n_idx_reroll <= maxNodes) {
                         const node = Nodes[n_idx_reroll - 1];
                         rerollSeedDisplay = node.seed4; 
                     }
                     const reRollSeedCalc = `${rerollSeedDisplay}%${reRollDivisor}=${rerollSeedDisplay % reRollDivisor}`;
                     tenPullDisplayLines.push(`ReRollItem${r}:${reName}[${r}G]<br><span style="font-size: 80%;">${reRollSeedCalc}</span>`);
                     currentDisplayIndex++;
                 }
             } else {
                 // 通常排出
                 const itemSeedCalc = `${slotSeedDisplay}%${poolSize}=${slotSeedDisplay % poolSize}`;
                 tenPullDisplayLines.push(`Item${r}:${itemName}[${r}G]<br><span style="font-size: 80%;">${itemSeedCalc}</span>`);
                 currentDisplayIndex++;
             }
             
             // Node情報の更新 (Address, highlight用)
             const node = Nodes[nodeIndex - 1];
             if (node) {
                 node.tenPullMark = r;
                 node.tenPullUseSeeds = useSeeds;
                 node.tenPullNextAddr = getAddress(nodeIndex + useSeeds);
             }
             
             // tLastItemId を新しい確定アイテムで更新
             tLastItemId = finalId;
             
             currentSeedIndex += useSeeds;
             nodeIndexOffset += useSeeds;
             tenPullResults.push({text: finalName, isFeatured: false});
             resultCount++;
        }
    }


    // 5. highlightInfo 生成
    // --- 単発ルート Highlight (A, B, C列のみ) ---
    sIdx = 1; 
    for (let roll = 1; roll <= tableRows; roll++) {
        if (sIdx > maxNodes) break;
        const node = Nodes[sIdx - 1];
        if (!node || node.singleRoll === null) break;
        const addressKey = node.address;
        
        if (node.singleUseSeeds === 0 && node.singleRoll.toString().endsWith('g')) {
             // Guaranteed Roll は Address(G) をハイライト
             const info = highlightInfo.get(addressKey + 'G') || {};
             info.single = true; info.singleRoll = roll; 
             highlightInfo.set(addressKey + 'G', info);
        } else if (node.isFeatured) {
             // Featured(S1)の場合: HighlightキーはAddressのまま、s_featuredフラグを設定
             const info = highlightInfo.get(addressKey) || {};
             info.single = true; info.singleRoll = roll; 
             info.s_featured = true;
             info.s_reRoll = false;
             highlightInfo.set(addressKey, info);
        } else {
             // 通常ロール または レア被り再抽選 (S2, S3, S4シード消費)
             const isRerollExplicit = node.singleIsReroll; // ★修正: singleIsReroll を使用
             
             const info = highlightInfo.get(addressKey) || {};
             info.single = true; info.singleRoll = roll; 
             info.s_featured = false;
             info.s_reRoll = isRerollExplicit; 
             
             // ★修正: デバッグのため、IDを直接 highlightInfo に保存
             info.s_currentId = node.itemId;
             info.s_compareId = node.singleCompareItemId; // 新しく保存した比較対象IDを使用

             if (info.s_reRoll) {
                 // ReRollFlag=Trueの場合、表示を「アイテム名Vs比較対象アイテム名」に変更
                 info.s_normalName = node.itemName;
                 info.s_reRollName = node.reRollItemName;
             }
             // ★修正: 比較対象アイテム名を保存
             info.s_compareItemName = node.singleCompareItemName;

             highlightInfo.set(addressKey, info);
        }
        sIdx += node.singleUseSeeds || 1;
    }
    
    return { Nodes, highlightInfo, maxNodes, tenPullDisplayLines, tenPullResults, singleRoutePath, numGuaranteed };
}