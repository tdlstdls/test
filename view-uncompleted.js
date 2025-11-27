function createAndDisplayUncompletedSeedView(initialSeed, gacha, tableRows, thresholds, initialLastRollId, displaySeed, params) {
    // ロジックファイルへ委譲
    const { 
        Nodes, highlightInfo, maxNodes, tenPullDisplayLines, tenPullResults, singleRoutePath, numGuaranteed 
    } = calculateUncompletedData(initialSeed, gacha, tableRows, thresholds, initialLastRollId, params);
    
    const ngVal = parseInt(params.get('ng'), 10);

    // --- 詳細表示の組み立て ---
    let detailsHtml = generateMasterInfoHtml(gacha);
    
    // LastRollの表示テキスト作成
    let lastRollText = 'Null';
    if (initialLastRollId && itemMaster[initialLastRollId]) {
        lastRollText = `${itemMaster[initialLastRollId].name}(${initialLastRollId}(${itemMaster[initialLastRollId].rarity}))`;
    }

    detailsHtml += '<h2>＜ノード計算詳細 (No.1～)＞</h2>';
    //detailsHtml += '<p style="margin-top: -10px; font-size: 10px;">（このデータは、特定のSEED INDEXからの計算結果を示します。実際のルートではレア被りにより消費SEED数が異なります）</p>';
    detailsHtml += `LastRoll：${lastRollText}<br><br>`;

    detailsHtml += '<table style="table-layout: fixed; width: auto; font-size: 9px; border-collapse: collapse;"><thead>';
    detailsHtml += '<tr style="background-color: #f2f2f2;">';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">No.</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Address</th>'; 
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Seed<br>(S1)</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Featured<br>(S1)</th>'; // F列
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Rarity<br>(S2)</th>'; // S2列
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Item<br>(S3)</th>'; // S3列
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Reroll<br>(S4)</th>'; // S4列
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">ReRollFlag</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">re-ReRollFlag</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">Single<br>(next)</th>';
    detailsHtml += '<th style="border: 1px solid #ccc; padding: 5px;">TenPull</th>'; 
    detailsHtml += '</tr></thead><tbody>'; 
    
    const tableRowsDataHtml = []; 
    
    for (let i = 1; i <= maxNodes; i++) {
        const node = Nodes[i-1];
        if (!node) continue;
        
        const seedStartIdx = (i - 1) * 3 + 1;
        
        // Single列
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

        // TenPull列 (変更: Addressとは対応しない独立したリストを表示)
        // 表の行数 i に対応する tenPullDisplayLines の要素を取得
        // i は 1始まりのノード番号だが、TenPullのリストは配列なので i-1 でアクセス
        let tenPullDisplay = '-';
        if (i - 1 < tenPullDisplayLines.length) {
            tenPullDisplay = tenPullDisplayLines[i - 1];
        }
        
        // Highlight logic (HTML生成のみ)
        const itemInfo = highlightInfo.get(node.address);
        const baseCls = determineHighlightClass(itemInfo);
        
        let featuredClsAttr = ''; // ★新規: Featured(S1)列用
        let itemClsForNormal = '', itemClsForReroll = '';

        if (itemInfo) {
            const isSingleFeatured = itemInfo.single && itemInfo.s_featured; // ★新規フラグをチェック
            
            // Item(S3)列にハイライトを適用する条件
            // 単発Featuredの場合は Item(S3)列のハイライトを適用しないように除外
            const usedNormal = (itemInfo.single && !itemInfo.s_reRoll && !isSingleFeatured) || (itemInfo.ten && !itemInfo.t_reRoll);
            
            // Reroll(S4)列にハイライトを適用する条件
            const usedReroll = (itemInfo.single && itemInfo.s_reRoll) || (itemInfo.ten && itemInfo.t_reRoll);
            
            if (isSingleFeatured) featuredClsAttr = ` class="${baseCls}"`; // ★Featured(S1)列に適用
            if (usedNormal) itemClsForNormal = baseCls; // Item(S3)列に適用
            if (usedReroll) itemClsForReroll = baseCls; // Reroll(S4)列に適用
        }
        
        // 属性文字列の生成
        const itemClsAttr = itemClsForNormal ? ` class="${itemClsForNormal}"` : '';
        const rerollClsAttr = itemClsForReroll ? ` class="${itemClsForReroll}"` : '';


        // 各カラムのコンテンツ生成
        let itemContent = (node.itemId !== -1) ? `${node.itemName}<br><span style="font-size: 80%;">${node.seed3}%${node.poolSize}=${node.slot}</span>` : '-';
        const reRollDivisor = node.poolSize > 1 ? node.poolSize - 1 : 0;
        let rerollContent = (node.reRollItemId !== -1) ? `${node.reRollItemName}<br><span style="font-size: 80%;">${node.seed4}%${reRollDivisor}=${node.reRollSlot}</span>` : '-';
        
        let featuredContent = node.isFeatured ? 'True' : 'False';
        featuredContent += `<br><span style="font-size: 80%;">${node.seed1}%10000=${node.seed1%10000} < ${gacha.featuredItemRate}</span>`;
        
        let rarityContent = `${node.rarityId}(${node.rarity.name})<br><span style="font-size: 80%;">${node.seed2}%10000=${node.rarityRoll}</span>`; 
        
        let reRollFlagContent = (node.rarityId === 1) ? (node.isDupe ? 'False' : 'True') : '---';
        reRollFlagContent += `<br><span style="font-size: 80%;">${node.itemNameForDisplay} vs ${node.prevItemDupeName}</span>`;
        
        let reReRollItemDisplay = '---';
        if (node.rarityId === 1 && node.itemId !== -1) {
             reReRollItemDisplay = `${node.reReDupeSourceItemName} vs ${node.prevReRollTargetName}`;
        }
        let reReRollFlagContent = node.isReReDupe ? 'False' : 'True';
        reReRollFlagContent += `<br><span style="font-size: 80%;">${reReRollItemDisplay}</span>`;

        let rowHtml = '<tr>';
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${node.index}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${node.address}</td>`; 
        // Seed (S1)列
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: right; font-family: monospace;">${node.seed1}<br><span style="font-size: 80%;">S${seedStartIdx}</span></td>`;
        // Featured(S1)列に featuredClsAttr を適用
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${featuredClsAttr}>${featuredContent}</td>`; // ★修正
        // Rarity(S2)列（ハイライトはなし）
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${rarityContent}</td>`;
        // Item(S3)列に itemClsAttr を適用
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${itemClsAttr}>${itemContent}</td>`;
        // Reroll(S4)列に rerollClsAttr を適用
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${rerollClsAttr}>${rerollContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${reRollFlagContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${reReRollFlagContent}</td>`;
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${singleDisplay}</td>`;
        // TenPull列
        rowHtml += `<td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${tenPullDisplay}</td>`;
        rowHtml += '</tr>';
        
        tableRowsDataHtml.push(rowHtml);
    }

    // --- メインテーブル生成 --- (変更なし)
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
    
    // テーブル行生成 (変更なし)
    let currentSeedIndex = (10 - (numGuaranteed || 0)) + 1;
    let nodeIndexOffset = 0;
    
    for (let r = 0; r < tableRows; r++) {
        table += `<tr><td class="col-no">${r + 1}</td>`;
        const nodeIndices = [r * 3 + 1, r * 3 + 2, r * 3 + 3];

        const currentRollNum = r + 1;
        let isNextGuaranteedTarget = false;
        if (!isNaN(ngVal) && gacha.uberGuaranteedFlag) {
            if (currentRollNum === ngVal) isNextGuaranteedTarget = true;
            else if (currentRollNum > ngVal && (currentRollNum - ngVal) % 30 === 0) isNextGuaranteedTarget = true;
        }

        nodeIndices.forEach(idx => {
            const node = Nodes[idx - 1];
            if (!node) {
                table += displaySeed === '1' ? '<td colspan="5"></td>' : '<td></td>';
                return;
            }

            const info = highlightInfo.get(node.address);
            let cls = determineHighlightClass(info);
            
            let content = '';

            if (node.isFeatured) {
                const href = generateItemLink(node.seed1, -2, params.get('ng'), r+1, false);
                content = `${node.featuredNextAddress})<a href="${href}"><span class="featuredItem-text">目玉</span></a>`;
            } 
            else {
                const isRerollHighlight = info ? (info.s_reRoll || info.t_reRoll) : false;
                const finalId = isRerollHighlight ? node.reRollItemId : node.itemId;
                const finalName = isRerollHighlight ? node.reRollItemName : node.itemName;
                const seedForLink = isRerollHighlight ? node.seed4 : node.seed3;

                const href = generateItemLink(seedForLink, finalId, params.get('ng'), r+1, false);
                let itemName = finalName;
                let css = '';
                if (itemMaster[finalId]?.rarity >= 3) css = 'featuredItem-text';
                if (itemMaster[finalId]?.rarity === 4) css = 'legendItem-text';

                content = `<a href="${href}" class="${css}">${itemName}</a>`;

                if (node.reRollItemId !== -1 && !isRerollHighlight) {
                    const rrHref = generateItemLink(node.seed4, node.reRollItemId, params.get('ng'), r+1, false);
                    let rrName = node.reRollItemName;
                    let rrCss = '';
                    if (itemMaster[node.reRollItemId]?.rarity >= 3) rrCss = 'featuredItem-text';
                    if (itemMaster[node.reRollItemId]?.rarity === 4) rrCss = 'legendItem-text';
                    content += `<br>${node.reRollNextAddress})<a href="${rrHref}" class="${rrCss}">${rrName}</a>`;
                }
            }
            
            if (isNextGuaranteedTarget && singleRoutePath.has(idx)) {
                content = `<span class="featuredItem-text">目玉(確定)</span><br>/---`;
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
        
        if (r < 10 && tenPullResults[r]) { 
             const tRes = tenPullResults[r];
             let gContent = tRes.text;
             
             // ★修正: 目玉（確定）を赤太字フォントに
             if (gContent === '目玉(確定)') {
                 gContent = `<span style="color: red; font-weight: bold;">${gContent}</span>`;
             } 
             // 目玉（Featured）は以前の featuredItem-text クラスで赤色になる
             else if (tRes.isFeatured) {
                 gContent = `<span class="featuredItem-text">${gContent}</span>`;
             }

             if (displaySeed === '1') table += `<td colspan="5" style="${gStyle}">${gContent}</td>`;
             else table += `<td style="${gStyle}">${gContent}</td>`;
        } else {
             if (displaySeed === '1') table += `<td colspan="5" style="${gStyle}">-</td>`;
             else table += `<td style="${gStyle}">-</td>`;
        }
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