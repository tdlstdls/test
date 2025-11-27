function createAndDisplayCompletedSeedView(initialSeed, gacha, tableRows, thresholds, initialLastRollId, displaySeed, params, initialNg) {
    // ロジックファイルへ委譲
    const { Nodes, highlightInfo, maxNodeIndex } = calculateCompletedData(
        initialSeed, gacha, tableRows, thresholds, initialLastRollId, initialNg
    );

    // --- 詳細表示用 HTML生成 (テーブル形式) ---
    let detailsHtml = generateMasterInfoHtml(gacha);
    detailsHtml += '<h2>＜ノード計算詳細 (No.1～)＞</h2>';
    
    let lastRollText = 'Null';
    if (initialLastRollId && itemMaster[initialLastRollId]) {
        const item = itemMaster[initialLastRollId];
        lastRollText = `${item.name}(rarity:${item.rarity}, itemID:${initialLastRollId})`;
    }
    detailsHtml += `LastRoll：${lastRollText}<br><br>`;
    
    // ヘッダー行
    detailsHtml += '<table style="table-layout: fixed; width: auto; font-size: 9px; border-collapse: collapse;"><thead>';
    detailsHtml += '<tr style="background-color: #f2f2f2;">';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">No.</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Address</th>'; 
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Seed</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">rarity</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Item</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Reroll</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">ReRollFlag</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">re-ReRollFlag</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">rarityG</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">uberG</th>'; 
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">legendG</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Single<br>(next)</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">TenPull<br>(next)</th>';
    detailsHtml += '</tr></thead><tbody>'; 
    
    let tableRowsDataHtml = []; 
    
    // 詳細データ行の生成
    for (let i = 1; i <= maxNodeIndex; i++) {
        const node = Nodes[i-1];
        if (!node) continue;
        
        // Single列の整形
        let singleDisplay = '';
        if (node.singleRoll !== null) {
            const rollNum = node.singleRoll.toString();
            if (node.singleUseSeeds !== null && node.singleNextAddr) {
                const nextIndex = node.index + node.singleUseSeeds;
                singleDisplay = `Roll${rollNum}<br><span style="font-size: 80%;">${node.index}+${node.singleUseSeeds}=${nextIndex}(${node.singleNextAddr})</span>`;
            } else {
                singleDisplay = rollNum; 
            }
        }

        // TenPull列の整形
        let tenPullDisplay = '';
        if (node.tenPullMark !== null) {
            const rollMark = node.tenPullMark.toString();
            if (node.tenPullMark === 'r') {
                if (node.tenPullUseSeeds !== null && node.tenPullNextAddr) {
                    const nextIndex = node.index + node.tenPullUseSeeds;
                    tenPullDisplay = `${rollMark}<br><span style="font-size: 80%;">${node.index}+${node.tenPullUseSeeds}=${nextIndex}(${node.tenPullNextAddr})</span>`;
                } else {
                    tenPullDisplay = rollMark;
                }
            } else if (node.tenPullUseSeeds !== null && node.tenPullNextAddr) {
                 const nextIndex = node.index + node.tenPullUseSeeds;
                 let displayRollNum = rollMark;
                 if (typeof node.tenPullMark === 'number' || (typeof node.tenPullMark === 'string' && !node.tenPullMark.startsWith('↖'))) {
                     displayRollNum = `Roll${rollMark}`;
                 } else if (typeof node.tenPullMark === 'string' && node.tenPullMark.startsWith('↖')) {
                     const gRollNum = rollMark.slice(1).replace('g', '');
                     const gNode = Nodes[node.index - 2]; 
                     if (gNode) {
                         displayRollNum = `Roll${gRollNum}g(${gNode.address}G)`; 
                     } else {
                         displayRollNum = `Roll${rollMark}`;
                     }
                 }
                 tenPullDisplay = `${displayRollNum}<br><span style="font-size: 80%;">${node.index}+${node.tenPullUseSeeds}=${nextIndex}(${node.tenPullNextAddr})</span>`;
            } else {
                 tenPullDisplay = rollMark;
            }
        }
        
        const itemInfo = highlightInfo.get(node.address);
        const baseCls = determineHighlightClass(itemInfo);
        
        let itemClsForNormal = '';
        let itemClsForReroll = '';

        if (itemInfo) {
            const usedNormal = (itemInfo.single && !itemInfo.s_reRoll) || (itemInfo.ten && !itemInfo.t_reRoll);
            const usedReroll = (itemInfo.single && itemInfo.s_reRoll) || (itemInfo.ten && itemInfo.t_reRoll);
            if (usedNormal) itemClsForNormal = baseCls;
            if (usedReroll) itemClsForReroll = baseCls;
        }
        
        const itemClsAttr = itemClsForNormal ? ` class="${itemClsForNormal}"` : '';
        const rerollClsAttr = itemClsForReroll ? ` class="${itemClsForReroll}"` : '';

        // Item列
        let itemContent = (node.itemId !== -1) ? `${node.itemName}<br><span style="font-size: 80%;">${node.seed2}%${node.poolSize}=${node.slot}</span>` : '-';
        // Reroll列
        const reRollDivisor = node.poolSize > 1 ? node.poolSize - 1 : 0; 
        let rerollContent = (node.reRollItemId !== -1) ? `${node.reRollItemName}<br><span style="font-size: 80%;">${node.seed3}%${reRollDivisor}=${node.reRollSlot}</span>` : '-';

        // Guaranteed 列のハイライト
        const guaranteedInfo = highlightInfo.get(node.address + 'G');
        const guaranteedCls = determineHighlightClass(guaranteedInfo);
        let uberGClsAttr = '', legendGClsAttr = '';

        if (guaranteedInfo && guaranteedCls) {
            if (node.rarityGId === '3' && node.itemGId !== -1) uberGClsAttr = ` class="${guaranteedCls}"`;
            else if (node.rarityGId === '4' && node.itemGId !== -1) legendGClsAttr = ` class="${guaranteedCls}"`;
        }
        
        let uberGContent = (node.rarityGId === '3' && node.itemGId !== -1) ? `${node.itemGName}<br><span style="font-size: 80%;">${node.seed2}%${node.poolGSize}=${node.slotG}</span>` : '-';
        let legendGContent = (node.rarityGId === '4' && node.itemGId !== -1) ? `${node.itemGName}<br><span style="font-size: 80%;">${node.seed2}%${node.poolGSize}=${node.slotG}</span>` : '-';
        
        // ReRollFlag, re-ReRollFlag (ロジックはLogic側に移動できない部分はここで表示用加工)
        let isConsecutiveDupe = false;
        if (i > 3) {
            const pNodeRe = Nodes[i-4]; 
            if (pNodeRe && node.rarityId === 1 && pNodeRe.reRollFlag && node.itemId === pNodeRe.reRollItemId) {
                 isConsecutiveDupe = true;
            }
        }

        let prevItemName;
        if (i <= 2) {
             prevItemName = getItemNameSafe(initialLastRollId);
        } else {
             const prevNode = Nodes[i - 3];
             if (prevNode) {
                 prevItemName = prevNode.reRollFlag ? (prevNode.reRollItemName || '---') : (prevNode.itemName || '---');
             } else {
                 prevItemName = '---';
             }
        }
        let reRollFlagContent = (node.reRollFlag ? 'true' : 'false') + `<br><span style="font-size: 80%;">${node.itemName}vs${prevItemName}</span>`;

        let prevReRollItemName = '---';
        if (i > 3) {
             const pNodeRe = Nodes[i-4]; 
             if (pNodeRe) {
                 prevReRollItemName = pNodeRe.reRollFlag ? (pNodeRe.reRollItemName || '---') : (pNodeRe.itemName || '---');
             }
        }
        let reReRollFlagContent = (isConsecutiveDupe ? 'true' : 'false') + `<br><span style="font-size: 80%;">${node.itemName}vs${prevReRollItemName}</span>`;

        let rarityGContent = (node.rarityGId || '-') + `<br><span style="font-size: 80%;">${node.roll1}</span>`; 

        let rowHtml = '<tr>';
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${node.index}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${node.address}</td>`; 
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: right; font-family: monospace;">${node.seed1}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${node.rarityId}<br><span style="font-size: 80%;">${node.roll1}</span></td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${itemClsAttr}>${itemContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${rerollClsAttr}>${rerollContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${reRollFlagContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${reReRollFlagContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${rarityGContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${uberGClsAttr}>${uberGContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${legendGClsAttr}>${legendGContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${singleDisplay}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${tenPullDisplay}</td>`;
        rowHtml += '</tr>';
        
        tableRowsDataHtml.push(rowHtml);
    }
    
    // --- メインテーブル生成 ---
    let table = `<table style="table-layout: fixed;" class="${currentHighlightMode === 'single' ? 'mode-single' : (currentHighlightMode === 'multi' ? 'mode-multi' : '')}"><thead>`;
    table += `<tr><th id="forceRerollToggle" class="col-no" style="cursor: pointer;">${window.forceRerollMode ? '☑' : '□'}</th><th>A</th><th>AG</th><th>B</th><th>BG</th></tr>`;
    table += '</thead><tbody>';

    for (let r = 1; r <= tableRows; r++) {
        const nodeIdxA = (r - 1) * 2 + 1;
        const nodeIdxB = (r - 1) * 2 + 2;
        const nodeA = Nodes[nodeIdxA - 1];
        const nodeB = Nodes[nodeIdxB - 1];

        if (!nodeA || !nodeB) break;

        table += `<tr><td class="col-no">${r}</td>`;

        // renderCell関数 
        const renderCell = (node, suffix) => {
            const address = node.address + suffix;
            const info = highlightInfo.get(address);
            const isGuaranteed = (suffix === 'G');
            const itemId = isGuaranteed ? node.itemGId : node.itemId;
            const itemName = isGuaranteed ? node.itemGName : node.itemName;
            const itemRarity = itemMaster[itemId]?.rarity;
            
            let cellContent = '---';
            if (itemId !== -1) {
                const href = generateItemLink(node.seed2, itemId, initialNg, r, true);
                let nameHtml = `<a href="${href}">${itemName}</a>`;
                
                let cssClass = '';
                if (!isGuaranteed) {
                    if (itemRarity === 4) cssClass = 'legendItem-text';
                    else if (itemRarity >= 3) cssClass = 'featuredItem-text';
                }
                if (cssClass) nameHtml = `<span class="${cssClass}">${nameHtml}</span>`;
                
                let showReRoll = false;
                let rrNextAddr = '';
                let rrName = '';
                let normName = itemName;

                if (info && !isGuaranteed) {
                    if (info.single && info.s_reRoll) {
                        showReRoll = true; rrNextAddr = info.s_nextAddr; rrName = info.s_reRollName; normName = info.s_normalName;
                    } else if (info.ten && info.t_reRoll) {
                        showReRoll = true; rrNextAddr = info.t_nextAddr; rrName = info.t_reRollName; normName = info.t_normalName;
                    }
                } 
                else if (!isGuaranteed && (node.reRollFlag || (window.forceRerollMode && node.rarityId === 1 && node.poolSize > 1))) {
                    showReRoll = true; rrNextAddr = node.reRollNextAddress; rrName = node.reRollItemName; normName = node.itemName;
                }

                if (showReRoll) {
                     const hrefRe = generateItemLink(node.seed3, node.reRollItemId, initialNg, r, true);
                     let rrNameHtml = `<a href="${hrefRe}">${rrName}</a>`;
                     let rrCssClass = '';
                     const rrRarity = itemMaster[node.reRollItemId]?.rarity;
                     if (rrRarity === 4) rrCssClass = 'legendItem-text';
                     else if (rrRarity >= 3) rrCssClass = 'featuredItem-text';
                     if (rrCssClass) rrNameHtml = `<span class="${rrCssClass}">${rrNameHtml}</span>`;
                     const hrefNorm = generateItemLink(node.seed2, node.itemId, initialNg, r, true);
                     let normNameHtml = `<a href="${hrefNorm}">${normName}</a>`;
                     if (cssClass) normNameHtml = `<span class="${cssClass}">${normNameHtml}</span>`;
                     cellContent = `${normNameHtml}<br>${rrNextAddr})${rrNameHtml}`;
                } else {
                     cellContent = nameHtml;
                }
            }
            
            let cls = determineHighlightClass(info); 
            return { html: `<td${cls ? ' class=\"'+cls+'\"' : ''}>${cellContent}</td>` };
        };

        table += renderCell(nodeA, '').html;
        table += renderCell(nodeA, 'G').html;
        table += renderCell(nodeB, '').html;
        table += renderCell(nodeB, 'G').html;
        table += '</tr>';
    }
    table += '</tbody></table>';

    document.getElementById('result-table-container').innerHTML = table;
    const detailsDiv = document.getElementById('calculation-details');
    
    // 詳細表示の反映
    let finalDetailsHtml = detailsHtml;
    finalDetailsHtml += tableRowsDataHtml.join('');
    finalDetailsHtml += '</tbody></table>'; 

    detailsDiv.innerHTML = finalDetailsHtml;
    
    // Controls
    const detailsControls = document.getElementById('details-controls');
    const toggleBtn = document.getElementById('toggleDetailsBtn');
    const scrollButtons = detailsControls.querySelector('.scroll-buttons');

    if (scrollButtons) scrollButtons.remove();
    
    detailsControls.style.display = 'flex';
    toggleBtn.onclick = () => {
        if (detailsDiv.style.display === 'none') {
            detailsDiv.style.display = 'block';
            toggleBtn.textContent = '計算過程を非表示';
        } else {
            detailsDiv.style.display = 'none';
            toggleBtn.textContent = '計算過程を表示';
        }
    };
}