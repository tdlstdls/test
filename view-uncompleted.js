function createAndDisplayUncompletedSeedView(initialSeed, gacha, tableRows, thresholds, initialLastRollId, displaySeed, params) {
    // ロジックファイルへ委譲
    const { 
        Nodes, highlightInfo, maxNodes, tenPullDisplayLines, tenPullResults, singleRoutePath, numGuaranteed,
        tenPullNextNodeIndex, tenPullNextSeedValue, tenPullNextAddrStr
    } = calculateUncompletedData(initialSeed, gacha, tableRows, thresholds, initialLastRollId, params);
    
    const ngVal = parseInt(params.get('ng'), 10);
    const initialFs = parseInt(params.get('fs'), 10) || 0; 
    const guaranteedCycle = gacha.guaranteedCycle || 30;

    // --- 詳細表示の組み立て ---
    let detailsHtml = generateMasterInfoHtml(gacha);
    
    let lastRollText = 'Null';
    if (initialLastRollId && itemMaster[initialLastRollId]) {
        lastRollText = `${itemMaster[initialLastRollId].name}(${initialLastRollId}(${itemMaster[initialLastRollId].rarity}))`;
    }

    detailsHtml += '<h2>＜ノード計算詳細 (No.1～)＞</h2>';
    detailsHtml += `LastRoll：${lastRollText}<br><br>`;

    detailsHtml += '<table style="table-layout: fixed; width: auto; font-size: 9px; border-collapse: collapse;"><thead>';
    detailsHtml += '<tr style="background-color: #f2f2f2;">';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">No.</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Address</th>'; 
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Seed<br>(Sn)</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Featured<br>(Sn)</th>'; 
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Rarity<br>(Sn+1)</th>'; 
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Item<br>(Sn+2)</th>'; 
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Reroll<br>(Sn+3)</th>'; 
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">ReRollFlag<br>Crnt vs Prev</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Single<br>(next)</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">TenPull<br>(next)</th>'; 
    detailsHtml += '</tr></thead><tbody>'; 
    
    const tableRowsDataHtml = []; 
    
    // TenPull列の最後の行に番地計算を追加
    let isTenPullLastLineFound = false;
    let tenPullLastLineIndex = -1;
    // tenPullDisplayLinesの有効な最後のインデックスを探す
    for (let k = tenPullDisplayLines.length - 1; k >= 0; k--) {
        if (tenPullDisplayLines[k]) {
            tenPullLastLineIndex = k;
            break;
        }
    }

    for (let i = 1; i <= maxNodes; i++) {
        const node = Nodes[i-1];
        if (!node) continue;
        
        let singleDisplay = '';
        if (node.singleRoll !== null) {
            const rollNum = node.singleRoll.toString();
            if (node.singleUseSeeds !== null && node.singleNextAddr) {
                const nextIndex = node.index + (node.singleUseSeeds === 0 ? 0 : node.singleUseSeeds);
                singleDisplay = `Roll${rollNum}<br><span style="font-size: 80%;">${node.index}+${node.singleUseSeeds}=${nextIndex}(${node.singleNextAddr})</span>`;
            } else {
                singleDisplay = rollNum; 
            }
        }

        let tenPullDisplay = '-';
        if (i - 1 < tenPullDisplayLines.length) {
            tenPullDisplay = tenPullDisplayLines[i - 1];
            
            // 指示: 「-」ではない一番下のセルについて... 合計（番地）の表示を追加
            if ((i - 1) === tenPullLastLineIndex) {
                // 消費シード数 = 次のインデックス - 現在のインデックス
                const used = tenPullNextNodeIndex - i;
                const transitionInfo = `<br>${i}+${used}=${tenPullNextNodeIndex}(${tenPullNextAddrStr})`;
                tenPullDisplay += transitionInfo;
            }
        }
        
        const itemInfo = highlightInfo.get(node.address);
        const baseCls = determineHighlightClass(itemInfo);
        
        let featuredClsAttr = ''; 
        let itemClsForNormal = '', itemClsForReroll = '';

        if (itemInfo) {
            const isSingleFeatured = itemInfo.single && itemInfo.s_featured; 
            const usedNormal = (itemInfo.single && !itemInfo.s_reRoll && !isSingleFeatured) || (itemInfo.ten && !itemInfo.t_reRoll);
            const usedReroll = (itemInfo.single && itemInfo.s_reRoll) || (itemInfo.ten && itemInfo.t_reRoll);
            
            if (isSingleFeatured) featuredClsAttr = ` class="${baseCls}"`; 
            if (usedNormal) itemClsForNormal = baseCls; 
            if (usedReroll) itemClsForReroll = baseCls; 
        }
        
        const itemClsAttr = itemClsForNormal ? ` class="${itemClsForNormal}"` : '';
        const rerollClsAttr = itemClsForReroll ? ` class="${itemClsForReroll}"` : '';

        let itemContent = (node.itemId !== -1) ? `${node.itemName}<br><span style="font-size: 80%;">${node.seed3}%${node.poolSize}=${node.slot}</span>` : '-';
        const reRollDivisor = node.poolSize > 1 ? node.poolSize - 1 : 0;
        let rerollContent = (node.reRollItemId !== -1) ? `${node.reRollItemName}<br><span style="font-size: 80%;">${node.seed4}%${reRollDivisor}=${node.reRollSlot}</span>` : '-';
        
        let featuredContent = node.isFeatured ? 'True' : 'False';
        featuredContent += `<br><span style="font-size: 80%;">${node.seed1%10000}<${gacha.featuredItemRate}</span>`;
        
        let rarityContent = `${node.rarityId}(${node.rarity.name})<br><span style="font-size: 80%;">${node.rarityRoll}</span>`; 
        
        let reRollFlagContent = '';
        const isSingleRoute = itemInfo && itemInfo.single && node.singleRoll !== null;

        if (isSingleRoute && !node.singleRoll.toString().endsWith('g')) { 
            const isFeatured = itemInfo.s_featured;
            if (isFeatured) {
                reRollFlagContent = `False<br><span style="font-size: 80%;">目玉</span>`; 
            } else if (node.rarityId !== 1) { 
                reRollFlagContent = `False<br><span style="font-size: 80%;">` + (node.rarityName || '---') + `</span>`; 
            } else {
                const isReroll = itemInfo.s_reRoll;
                const compareName = itemInfo.s_compareItemName; 
                const itemName = isReroll ? node.itemName : node.itemName; 
                reRollFlagContent = `${isReroll ? 'True' : 'False'}<br><span style="font-size: 80%;">` + (itemName || '---') + ` vs ` + (compareName || '---') + `</span>`;
            }
        } else {
            if (node.rarityId !== 1) {
                reRollFlagContent = `False<br><span style="font-size: 80%;">` + (node.rarityName || '---') + `</span>`;
            } else {
                const itemName = node.itemName; 
                const dupeCompareTargets = node.dupeCompareTargets; 
                reRollFlagContent = (node.isDupe ? 'True' : 'False') + `<br><span style="font-size: 80%;">` + (itemName || '---') + ` vs ` + (dupeCompareTargets || '---') + `</span>`;
            }
        }
        
        // 詳細テーブルでの確定枠表示 (目玉(確定)/アイテム名)
        if (node.singleRoll !== null && node.singleRoll.toString().endsWith('g')) {
             // 確定枠の場合、アイテム表示を上書き
             const itemDisplayName = node.itemName;
             itemContent = `<span style="color: red; font-weight: bold;">目玉(確定)</span> / ${itemDisplayName}<br><span style="font-size: 80%;">Guaranteed</span>`;
        }

        const displaySeedValue = node.seed1; 

        let rowHtml = '<tr>';
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${node.index}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${node.address}</td>`; 
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: right; font-family: monospace;">${displaySeedValue}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${featuredClsAttr}>${featuredContent}</td>`; 
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${rarityContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${itemClsAttr}>${itemContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${rerollClsAttr}>${rerollContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${reRollFlagContent}</td>`; 
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${singleDisplay}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${tenPullDisplay}</td>`;
        rowHtml += '</tr>';
        
        tableRowsDataHtml.push(rowHtml);
    }

    // --- メインテーブル生成 --- 
    let table = '<table style="table-layout: fixed;"><thead>';
    let header1 = `<tr><th rowspan="${displaySeed === '1' ? 2 : 1}" id="forceRerollToggle" class="col-no" style="cursor: pointer;">${window.forceRerollMode ? '☑' : '□'}</th>`;
    let header2 = '<tr>';
    if (displaySeed === '1') {
        header1 += '<th colspan="5">A</th><th colspan="5">B</th><th colspan="5">C</th><th colspan="5">G</th>';
        const subHeaders = ['S1<br>Feat', 'S2<br>Rare', 'S3<br>Slot', 'S4<br>Re', 'Item'];
        for(let i=0; i<4; i++) header2 += subHeaders.map(h => `<th>${h}</th>`).join('');
    } else {
        header1 += '<th>A</th><th>B</th><th>C</th><th>G</th>';
    }
    header1 += '</tr>';
    if (displaySeed === '1') { header2 += '</tr>'; table += header1 + header2; } else { table += header1; }
    table += '</thead><tbody>';
    
    // 現在のパラメータ（状態）を保持
    let currentNgVal = !isNaN(ngVal) ? ngVal : -1;
    let currentFsVal = initialFs;

    for (let r = 0; r < tableRows; r++) {
        table += `<tr><td class="col-no">${r + 1}</td>`;
        const nodeIndices = [r * 3 + 1, r * 3 + 2, r * 3 + 3];

        const currentRollNum = r + 1;
        
        nodeIndices.forEach(idx => {
            const node = Nodes[idx - 1];
            if (!node) {
                table += displaySeed === '1' ? '<td colspan="5"></td>' : '<td></td>';
                return;
            }

            const info = highlightInfo.get(node.address);
            let cls = determineHighlightClass(info);
            
            const isSingleRouteNode = info && info.single;
            const isGuaranteedNode = isSingleRouteNode && node.singleRoll && node.singleRoll.toString().endsWith('g');

            let content = '';
            
            // --- パラメータ計算 ---
            let linkNg = 'none';
            let linkFs = currentFsVal;
            
            if (isSingleRouteNode) {
                 if (isGuaranteedNode) {
                     // Guaranteed Cell (Ng becomes 0 logic)
                     // fs: ここで消費されるので、リンク先には -1 した値を渡す
                     linkFs = currentFsVal - 1;
                     
                     // Guaranteed表示
                     const uberHref = generateItemLink(node.seed3, -2, guaranteedCycle, r+1, false, linkFs);
                     const itemHref = generateItemLink(node.seed3, node.itemId, guaranteedCycle - 1, r+1, false, linkFs);
                     
                     let itemCss = '';
                     if (itemMaster[node.itemId]?.rarity >= 3) itemCss = 'featuredItem-text';
                     if (itemMaster[node.itemId]?.rarity === 4) itemCss = 'legendItem-text';
                     
                     content = `<a href="${uberHref}" style="color: red; font-weight: bold;">目玉(確定)</a> / <a href="${itemHref}" class="${itemCss}">${node.itemName}</a>`;
                     
                     // Cycle Reset
                     currentNgVal = guaranteedCycle; // 次の行のためにリセット(29スタートになるようにループ末尾で-1される)
                     currentFsVal -= 1; // 消費反映

                 } else {
                     // Normal or Featured Node
                     // 次のロールのNG値 = currentNgVal - 1 (ただしサイクル考慮)
                     let nextNg = (currentNgVal !== -1) ? currentNgVal - 1 : 'none';
                     if (nextNg !== 'none' && nextNg <= 0) nextNg = guaranteedCycle;
                     
                     // fsの減算: 目玉の場合
                     if (node.isFeatured) {
                         linkFs = currentFsVal - 1;
                     }
                     
                     if (node.isFeatured) {
                        const nextSeedVal = (node.index < maxNodes) ? Nodes[node.index].seed1 : 0; 
                        
                        const hrefFeatured = generateItemLink(nextSeedVal, -2, nextNg, r+1, false, linkFs);
                        content = `${node.featuredNextAddress})<a href="${hrefFeatured}"><span class="featuredItem-text">目玉</span></a>`;
                        
                        if (isSingleRouteNode) currentFsVal -= 1; // ルート上なら消費

                     } else {
                        // 通常アイテム
                        const nextNodeIdx = node.index + node.singleUseSeeds;
                        const nextSeedForLink = (nextNodeIdx <= maxNodes) ? Nodes[nextNodeIdx-1].seed1 : 0;
                        
                        const isRerollHighlight = info ? info.s_reRoll : false;
                        
                        if (isRerollHighlight) {
                             const preRerollName = node.itemName; 
                             const postRerollId = node.reRollItemId;
                             const postRerollName = node.reRollItemName;
                             const rrHref = generateItemLink(nextSeedForLink, postRerollId, nextNg, r+1, false, linkFs);
                             
                             let rrCss = '';
                             if (itemMaster[postRerollId]?.rarity >= 3) rrCss = 'featuredItem-text';
                             if (itemMaster[postRerollId]?.rarity === 4) rrCss = 'legendItem-text';
                             
                             content = `${preRerollName}<br>${node.reRollNextAddress})<a href="${rrHref}" class="${rrCss}">${postRerollName}</a>`;
                        } else {
                             const finalId = node.itemId; 
                             const href = generateItemLink(nextSeedForLink, finalId, nextNg, r+1, false, linkFs);
                             let css = '';
                             if (itemMaster[finalId]?.rarity >= 3) css = 'featuredItem-text';
                             if (itemMaster[finalId]?.rarity === 4) css = 'legendItem-text';
             
                             content = `<a href="${href}" class="${css}">${node.itemName}</a>`;

                             // Reroll Candidate Link (Duplicate but not taken in single route)
                             if (node.reRollItemId !== -1 && !node.isDupe) { 
                                 const rrHref = generateItemLink(node.seed4, node.reRollItemId, nextNg, r+1, false, linkFs);
                                 let rrName = node.reRollItemName;
                                 let rrCss = '';
                                 if (itemMaster[node.reRollItemId]?.rarity >= 3) rrCss = 'featuredItem-text';
                                 if (itemMaster[node.reRollItemId]?.rarity === 4) rrCss = 'legendItem-text';
                                 content += `<br>${node.reRollNextAddress})<a href="${rrHref}" class="${rrCss}">${rrName}</a>`;
                             }
                        }
                     }
                 }
                 
                 // NG Update for next loop iteration
                 if (currentNgVal !== -1) {
                     currentNgVal -= 1;
                     if (currentNgVal <= 0) currentNgVal = guaranteedCycle;
                 }

            } else {
                // Not on single route
                if (node.isFeatured) {
                    content = `${node.featuredNextAddress})<span class="featuredItem-text">目玉</span>`;
                } else {
                    content = node.itemName;
                    if (node.reRollItemId !== -1 && node.isDupe) {
                        content += `<br>${node.reRollNextAddress})${node.reRollItemName}`;
                    }
                }
            }

            if (displaySeed === '1') {
                const sub1 = `(S${(idx-1)*3+1})${node.seed1}<br>${node.seed1%10000}<br>${node.isFeatured}`;
                const sub2 = `(S${(idx-1)*3+2})${node.seed2}<br>${node.seed2%10000}<br>${node.rarity.name}`;
                const sub3 = `(S${(idx-1)*3+3})${node.seed3}<br>${node.poolSize}<br>${node.slot}`;
                let sub4 = '---';
                if (!node.isFeatured && node.reRollItemId !== -1) {
                    sub4 = `(S${(idx-1)*3+4})${node.seed4}<br>ReRoll`;
                }
                table += `<td${cls ? ' class="'+cls+'"' : ''}>${sub1}</td><td${cls ? ' class="'+cls+'"' : ''}>${sub2}</td><td${cls ? ' class="'+cls+'"' : ''}>${sub3}</td><td${cls ? ' class="'+cls+'"' : ''}>${sub4}</td><td${cls ? ' class="'+cls+'"' : ''}>${content}</td>`;
            } else {
                table += `<td${cls ? ' class="'+cls+'"' : ''}>${content}</td>`;
            }
        });

        // G Column (Ten Pull Result) 
        let gStyle = '';
        if (r < 9) { gStyle = 'background-color: #ffffe0;'; } else if (r === 9) { gStyle = 'background-color: #ffff8d;'; }
        
        let gContent = '-';
        if (r < 10 && tenPullResults[r]) { 
             const tRes = tenPullResults[r];
             gContent = tRes.text;
             
             if (tRes.isGuaranteed) {
                 gContent = `<span style="color: red; font-weight: bold;">${gContent}</span>`;
             } 
             else if (tRes.isFeatured) {
                 gContent = `<span class="featuredItem-text">${gContent}</span>`;
             }

             // 10行目 (index 9) の場合、遷移先番地とリンクを追加
             if (r === 9) {
                 const addressStr = tenPullNextAddrStr;
                 
                 let nextNg10 = 'none';
                 if (!isNaN(ngVal)) {
                     nextNg10 = ngVal - 10;
                     if (nextNg10 <= 0) nextNg10 += guaranteedCycle;
                 }
                 
                 let countFsUsed = 0;
                 tenPullResults.forEach(res => {
                     if (res.isFeatured || res.isGuaranteed) countFsUsed++;
                 });
                 let nextFs10 = initialFs - countFsUsed;

                 const href10 = generateItemLink(tenPullNextSeedValue, -2, nextNg10, 11, false, nextFs10); // IDは仮で-2
                 
                 gContent = `${addressStr})<a href="${href10}">${gContent}</a>`;
             }
        }

        if (displaySeed === '1') table += `<td colspan="5" style="${gStyle}">${gContent}</td>`;
        else table += `<td style="${gStyle}">${gContent}</td>`;

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

    const detailsControls = document.getElementById('details-controls');
    const toggleBtn = document.getElementById('toggleDetailsBtn');
    const scrollButtons = detailsControls.querySelector('.scroll-buttons');
    if (scrollButtons) scrollButtons.remove();
    
    detailsControls.style.display = 'flex';
    toggleBtn.style.display = 'inline-block'; 

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