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
    // maxNodesはテーブル表示に必要な分より多めに確保
    const maxNodes = tableRows * 3 + 20; 
    
    // 表示用配列 (Addressとは非同期のリスト)
    const tenPullDisplayLines = [];
    const tenPullResults = [];
    
    const highlightInfo = new Map(); 

    for (let i = 1; i <= maxNodes; i++) {
        // ★修正点 1: シード割り当てを連番に変更 (スライディングウィンドウ)
        // Node i が Seed i (配列インデックス i-1) から始まるようにする
        const seedStartIdx = i; 
        
        const s1 = SEED[seedStartIdx];     
        const s2 = SEED[seedStartIdx + 1]; 
        const s3 = SEED[seedStartIdx + 2]; 
        const s4 = SEED[seedStartIdx + 3]; 
        const s5 = SEED[seedStartIdx + 4]; 
        
        // ★修正点 2: seed1の計算元シード (直前のシード)
        // i=1 の場合 SEED[-1] となるため undefined/null 許容
        let prevSeedVal = SEED[seedStartIdx - 1];

        const node = {
            index: i,
            address: getAddress(i),
            seed1: s1, seed2: s2, seed3: s3, seed4: s4, seed5: s5,
            prevSeed1: prevSeedVal, // ★表示に使用: seed1の計算元シード
            isFeatured: (s1 % 10000) < gacha.featuredItemRate,
            singleRoll: null, singleUseSeeds: null, singleNextAddr: null,
            singleIsReroll: false,  
            singleCompareItemName: '---', 
            singleCompareItemId: -1, 
            tenPullMark: null, tenPullUseSeeds: null, tenPullNextAddr: null,  
        };


        // ★修正点 3: Next Address の計算 (消費シード数 = 進むノード数となるため、そのまま加算)
        // Featured=1シード消費 -> +1 Node
        // Normal=3シード消費 -> +3 Node
        // Reroll=4シード消費 -> +4 Node
        node.featuredNextAddress = getAddress(i + 1); 
        node.normalNextAddress = getAddress(i + 3);   
        node.reRollNextAddress = getAddress(i + 4);   

        node.rarity = getRarityFromRoll(s2 % 10000, thresholds);
        node.rarityId = node.rarity.id;
        node.rarityName = node.rarity.name; 
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

        // Duplication Status Logic (単発ルート外の比較ロジック: 3 Node前/4 Node前の参照と ReRollItem の考慮)
        let compareId3Node = -1; 
        let compareId4Node = -1; 
        let compareName3Node = '---';
        let compareName4Node = '---';
        
        // i-1 (3シード前) などの参照ロジック
        if (i <= 1) { 
            compareId3Node = initialLastRollId || -1;
            compareName3Node = getItemNameSafe(initialLastRollId || -1);
        } else {
            const pNode3 = (i > 3) ? Nodes[i-4] : null; 
            if (pNode3) {
                 compareId3Node = pNode3.itemId;
                 compareName3Node = pNode3.itemName;
            } else if (i <= 3) {
                compareId3Node = initialLastRollId || -1;
                compareName3Node = getItemNameSafe(initialLastRollId || -1);
            }

            const pNode4 = (i > 4) ? Nodes[i-5] : null;
            if (pNode4) {
                 if (pNode4.reRollItemId !== -1) { 
                     compareId4Node = pNode4.reRollItemId;
                     compareName4Node = pNode4.reRollItemName;
                 }
            }
        }
        
        // 判定ロジック
        const currentId = node.itemId;
        const isDupe3 = (currentId !== -1 && currentId === compareId3Node);
        const isDupe4 = (compareId4Node !== -1 && currentId === compareId4Node); 
        node.isDupe = (node.rarityId === 1 && (isDupe3 || isDupe4)); 

        // dupeCompareTargets を常に設定
        if (node.rarityId === 1) {
            const reRollTargetName = (compareId4Node !== -1) ? compareName4Node : '';
            node.dupeCompareTargets = `${compareName3Node}${reRollTargetName ? ' / ' + reRollTargetName : ''}`; 
        } else {
            node.dupeCompareTargets = node.rarityName; // Non-Rarity 1 はレアリティ名
        }

        // 表示用の DupeName を決定
        if (node.isDupe) {
            const reRollTargetName = (compareId4Node !== -1) ? compareName4Node : '';
            node.prevItemDupeName = compareName3Node;
            node.itemNameForDisplay = `${node.itemName} vs ${node.prevItemDupeName}${reRollTargetName ? ' / ' + reRollTargetName : ''}`; 
        } else {
            node.itemNameForDisplay = getItemNameSafe(node.itemId);
            node.prevItemDupeName = compareName3Node; 
        }

        Nodes.push(node);
    }
    
    // 3. 単発ルート計算
    let sIdx = 1; 
    let sLastActualItemId = initialLastRollId || -1; 
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
        
        const compareItemName = getItemNameSafe(sLastActualItemId);
        node.singleCompareItemName = compareItemName;
        node.singleCompareItemId = sLastActualItemId; 

        if (isGuaranteedRoll) {
            node.singleRoll = `${roll}g`;
            node.singleUseSeeds = 0; 
            node.singleNextAddr = getAddress(sIdx);
            node.singleIsReroll = false; 
            currentNg = guaranteedCycle; 
            continue; 
        }

        let usedSeeds = 0;
        let finalId = -1;

        if (node.isFeatured) {
            usedSeeds = 1; 
            finalId = -2; // 目玉排出を示す一時的なID
            node.singleRoll = roll;
            node.singleUseSeeds = usedSeeds;
            node.singleNextAddr = node.featuredNextAddress; // getAddress(sIdx + 1)
            node.singleIsReroll = false; 

        } else {
            const isRare = (node.rarityId === 1);
            const poolSize = gacha.rarityItems[1] ? gacha.rarityItems[1].length : 0;
            
            const currentId = Number(node.itemId);
            const lastId = Number(sLastActualItemId);
            
            const isMatchByID = (currentId !== -1 && lastId !== -1 && currentId === lastId);
            const isMatch = isMatchByID; 
            
            // ReRoll判定ロジック
            const isReroll = isRare && isMatch && poolSize > 1; 
            
            finalId = isReroll ? node.reRollItemId : node.itemId;
            
            // 消費シード数（Node数）の決定
            usedSeeds = isReroll ? 4 : 3;
            
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
        
        sIdx = sIdx + usedSeeds; // sIdx は消費シード数分だけ進む (Nodeも連番なのでそのまま加算)
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
    // S1〜S10 の Featured を使用
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
            // S1〜S10 を使用するため、シードインデックスは i に固定
            const checkSeedIndex = i; 
            const checkSeed = SEED[checkSeedIndex - 1]; // SEEDは0始まりなので修正
            const isFeatured = (checkSeed % 10000) < gacha.featuredItemRate;
            featuredFlags.push({ isFeatured: isFeatured, isGuaranteed: false });
            
            if (nodeIndex <= maxNodes) {
                 const node = Nodes[nodeIndex - 1]; 
                 const featuredText = isFeatured ? `True→目玉[${i}G]` : `False`;
                 
                 // ノード情報から表示
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

    // --- Phase 2: 詳細判定 (Rarity/Item/ReRoll) ---
    // 10連での消費シード数を計算し、確定枠を考慮
    // 10連の最初の10個のチェックに使うシード群の次は、S11から開始
    let currentSeedIndex = 11; 

    // Guaranteed枠はシード消費しないため、Featureチェックに使った分だけシードが進んでいる状態
    // ただし、Featureチェックは確定枠以外で行われている。
    // ここでは10連の結果生成のために、S11以降のシードを順番に消費していくロジック
    // (Nodeテーブルとは独立して計算するが、結果はNodeに書き込む)

    tLastItemId = initialLastRollId || -1; 
    tIdx = 1; 

    for (let r = 1; r <= maxTenPullRolls; r++) {
        const flagData = featuredFlags[r-1];
        const node = Nodes[tIdx - 1]; 
        if (!node) continue;
        
        let useSeeds = 0;
        let finalId = -1;
        
        if (flagData.isGuaranteed) {
             // Guaranteed Roll
             node.tenPullMark = `${r}g`;
             useSeeds = 0;
             node.tenPullUseSeeds = useSeeds; 
             node.tenPullNextAddr = getAddress(tIdx); // シードを消費しない
             tenPullResults.push({text: '目玉(確定)', isFeatured: false, isGuaranteed: true}); 

        } else if (flagData.isFeatured) {
             // Featured Roll (S1〜S10 の判定結果を使用)
             node.tenPullMark = r;
             useSeeds = 1;
             node.tenPullUseSeeds = useSeeds; 
             node.tenPullNextAddr = getAddress(tIdx + 1); // 1シード消費
             tenPullResults.push({text: '目玉', isFeatured: true, isGuaranteed: false});
             tIdx += useSeeds; // Node Indexを進める

        } else {
             // 通常アイテム排出の計算
             const t_s2 = SEED[currentSeedIndex - 1];     // 0-based index correction
             const t_s3 = SEED[currentSeedIndex + 1 - 1];
             const t_s4 = SEED[currentSeedIndex + 2 - 1];
             
             const rarity = getRarityFromRoll(t_s2 % 10000, thresholds);
             const rarityId = rarity.id;
             const rarityName = rarity.name;
             const rarityRoll = t_s2 % 10000;
             
             const pool = gacha.rarityItems[rarityId] || [];
             const poolSize = pool.length > 0 ? pool.length : 1;
             const slot = t_s3 % poolSize;
             
             // ★修正: pool[slot]が0の場合に false 扱いされて -1 になるのを防ぐ
             const itemVal = (pool[slot] !== undefined) ? pool[slot] : -1;
             const itemName = getItemNameSafe(itemVal);

             const isRare = (rarityId === 1);
             const isDupe = (itemVal !== -1 && itemVal === tLastItemId);
             const reRoll = isRare && isDupe && pool.length > 1;
             
             finalId = itemVal;
             let finalName = itemName;

             // Display lines
             rollDisplayStartIndex.set(r, currentDisplayIndex);
             const raritySeedCalc = `${t_s2}%10000=${rarityRoll}`;
             tenPullDisplayLines.push(`Rarity${r}:${rarityId}(${rarityName})<br><span style="font-size: 80%;">${raritySeedCalc}</span>`);
             currentDisplayIndex++;
             
             const itemSeedCalc = `${t_s3}%${poolSize}=${slot}`;

             if (reRoll) {
                 const rePool = pool.filter(id => id !== itemVal);
                 if (rePool.length > 0) {
                     const reRollDivisor = rePool.length;
                     const reRollSlot = t_s4 % reRollDivisor;
                     finalId = rePool[reRollSlot];
                     const reName = getItemNameSafe(finalId);
                     finalName = `${itemName}<br>(再)${reName}`;
                     
                     // Display lines for Item and Reroll
                     tenPullDisplayLines.push(`Item${r}:${itemName}→レア被り<br><span style="font-size: 80%;">${itemSeedCalc}</span>`);
                     currentDisplayIndex++;
                     
                     const reRollSeedCalc = `${t_s4}%${reRollDivisor}=${reRollSlot}`;
                     tenPullDisplayLines.push(`ReRollItem${r}:${reName}[${r}G]<br><span style="font-size: 80%;">${reRollSeedCalc}</span>`);
                     currentDisplayIndex++;
                     
                 } else {
                     tenPullDisplayLines.push(`Item${r}:${itemName}[${r}G]<br><span style="font-size: 80%;">${itemSeedCalc}</span>`);
                     currentDisplayIndex++;
                 }
                 useSeeds = 3; // S2, S3, S4 を消費
             } else {
                 // 通常排出
                 tenPullDisplayLines.push(`Item${r}:${itemName}[${r}G]<br><span style="font-size: 80%;">${itemSeedCalc}</span>`);
                 currentDisplayIndex++;
                 useSeeds = 2; // S2, S3 を消費
             }
             
             // Node情報の更新
             node.tenPullMark = r;
             node.tenPullUseSeeds = useSeeds;
             node.tenPullNextAddr = getAddress(tIdx + useSeeds);
             
             // tLastItemId を新しい確定アイテムで更新
             tLastItemId = finalId;
             
             tenPullResults.push({text: finalName, isFeatured: false, isGuaranteed: false});
             
             currentSeedIndex += useSeeds;
             tIdx += useSeeds;
        }
    }
    
    // ★追加: 10連完了後の次の状態を取得
    const tenPullNextNodeIndex = tIdx;
    const tenPullNextSeedValue = SEED[tIdx - 1]; 
    const tenPullNextAddrStr = getAddress(tIdx);


    // 5. highlightInfo 生成
    // --- 単発ルート Highlight (A, B, C列のみ) ---
    sIdx = 1; 
    for (let roll = 1; roll <= tableRows; roll++) {
        if (sIdx > maxNodes) break;
        const node = Nodes[sIdx - 1];
        if (!node || node.singleRoll === null) break;
        const addressKey = node.address;
        
        if (node.singleUseSeeds === 0 && node.singleRoll.toString().endsWith('g')) {
             // Guaranteed Roll 
             const info = highlightInfo.get(addressKey + 'G') || {};
             info.single = true; info.singleRoll = roll; 
             highlightInfo.set(addressKey + 'G', info);
        } else if (node.isFeatured) {
             // Featured
             const info = highlightInfo.get(addressKey) || {};
             info.single = true; info.singleRoll = roll; 
             info.s_featured = true;
             info.s_reRoll = false;
             highlightInfo.set(addressKey, info);
        } else if (node.rarityId !== 1) { 
             // レアリティ1以外
             const info = highlightInfo.get(addressKey) || {};
             info.single = true; info.singleRoll = roll;
             info.s_featured = false;
             info.s_reRoll = false; 
             
             info.s_normalName = node.rarityName; 
             info.s_compareItemName = node.rarityName; 
             
             highlightInfo.set(addressKey, info);
             
        } else {
             // 通常ロール (レアリティ1) または レア被り再抽選
             const isRerollExplicit = node.singleIsReroll; 
             
             const info = highlightInfo.get(addressKey) || {};
             info.single = true; info.singleRoll = roll; 
             info.s_featured = false;
             info.s_reRoll = isRerollExplicit; 
             
             info.s_currentId = node.itemId;
             info.s_compareId = node.singleCompareItemId; 

             if (info.s_reRoll) {
                 info.s_normalName = node.itemName; 
                 info.s_reRollName = node.reRollItemName;
             }
             info.s_compareItemName = node.singleCompareItemName;

             highlightInfo.set(addressKey, info);
        }
        sIdx += node.singleUseSeeds || 3; // ノードが消費したシード数だけインデックスを進める
    }
    
    return { 
        Nodes, highlightInfo, maxNodes, 
        tenPullDisplayLines, tenPullResults, singleRoutePath, numGuaranteed,
        tenPullNextNodeIndex, tenPullNextSeedValue, tenPullNextAddrStr
    };
}