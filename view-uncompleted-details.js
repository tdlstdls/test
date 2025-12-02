// --- view-uncompleted-details.js ---

/**
 * 詳細テーブル（計算過程）と10連詳細のHTMLを生成してDOMに挿入
 */
function renderUncompletedDetails(Nodes, highlightInfo, maxNodes, tenPullCyclesData, gacha, initialLastRollId, params) {
    const ngVal = parseInt(params.get('ng'), 10);
    const initialFs = parseInt(params.get('fs'), 10) || 0;
    const guaranteedCycle = gacha.guaranteedCycle || 30;
    let ngTrackerDetail = !isNaN(ngVal) && ngVal > 0 ? ngVal : guaranteedCycle;

    // --- 1. 計算詳細 (単発ガチャ詳細) のHTML組み立て ---
    let html = generateMasterInfoHtml(gacha);
    
    let lastRollText = 'Null';
    if (initialLastRollId && itemMaster[initialLastRollId]) {
        lastRollText = `${itemMaster[initialLastRollId].name}(${initialLastRollId}(${itemMaster[initialLastRollId].rarity}))`;
    }

    html += '<h2>＜ノード計算詳細 (No.1～)＞</h2>';
    html += `LastRoll：${lastRollText}<br><br>単発ガチャ詳細<br>`;
    html += '<table style="table-layout: fixed; width: auto; font-size: 9px; border-collapse: collapse;"><thead>';
    html += '<tr style="background-color: #f2f2f2;">';
    html += '<th style="border: 1px solid #ccc; padding: 5px;">No.<br>Address</th><th style="border: 1px solid #ccc; padding: 5px;">Seed<br>(Sn)</th><th style="border: 1px solid #ccc; padding: 5px;">Featured<br>(Sn)</th><th style="border: 1px solid #ccc; padding: 5px;">Rarity<br>(Sn+1)</th><th style="border: 1px solid #ccc; padding: 5px;">Item<br>(Sn+2)</th><th style="border: 1px solid #ccc; padding: 5px;">Reroll<br>(Sn+3)</th><th style="border: 1px solid #ccc; padding: 5px;">ReRollFlag<br>Crnt vs Prev</th><th style="border: 1px solid #ccc; padding: 5px;">Roll<br>(next)</th><th style="border: 1px solid #ccc; padding: 5px;">NextGuar<br>aftRoll</th>'; 
    html += '</tr></thead><tbody>'; 

    for (let i = 1; i <= maxNodes; i++) {
        const node = Nodes[i-1];
        if (!node) continue;
        
        // NGカウンター更新
        let ngContentDetail = '-';
        if (node.singleRoll !== null) {
            let nextNg = ngTrackerDetail - 1;
            if (ngTrackerDetail === 1) { 
                 const nextStartNg = guaranteedCycle - 1; 
                 ngContentDetail = `目玉(確定)<br>${guaranteedCycle}→${nextStartNg}`;
                 ngTrackerDetail = nextStartNg;
            } else if (ngTrackerDetail > 1) {
                ngContentDetail = nextNg.toString();
                ngTrackerDetail = nextNg;
            }
        }
        
        // Highlight logic
        const itemInfo = highlightInfo.get(node.address);
        const baseCls = determineHighlightClass(itemInfo);
        let featuredClsAttr = '', itemClsForNormal = '', itemClsForReroll = '';

        if (itemInfo) {
            if (itemInfo.single && itemInfo.s_featured) featuredClsAttr = ` class="${baseCls}"`; 
            if ((itemInfo.single && !itemInfo.s_reRoll && !itemInfo.s_featured) || (itemInfo.ten && !itemInfo.t_reRoll)) itemClsForNormal = baseCls; 
            if ((itemInfo.single && itemInfo.s_reRoll) || (itemInfo.ten && itemInfo.t_reRoll)) itemClsForReroll = baseCls; 
        }

        // 修正箇所: 変数定義を追加
        const itemClsAttr = itemClsForNormal ? ` class="${itemClsForNormal}"` : '';
        const rerollClsAttr = itemClsForReroll ? ` class="${itemClsForReroll}"` : '';

        // Columns Content
        let singleDisplay = node.singleRoll !== null ? node.singleRoll.toString() : '';
        if (node.singleRoll !== null && node.singleUseSeeds !== null) {
             singleDisplay += `<br>${node.index}+${node.singleUseSeeds}<br>${node.index + node.singleUseSeeds}(${node.singleNextAddr})`;
        }

        // Featured Content
        let featuredContent = node.isFeatured ? 'True' : 'False';
        if (node.isFeatured) {
             const fHref = generateItemLink(node.seed1, -2, node.guaranteedNextNgVal || ngVal, node.index, false, initialFs);
             featuredContent = `<a href="${fHref}" style="text-decoration: none; color: inherit;">True</a>`;
        }
        featuredContent += `<br>S${node.index}%10000<br>${node.seed1 % 10000}${node.isFeatured ? '<' : '>='}${gacha.featuredItemRate}`;

        // Rarity Content
        let rarityContent = `${node.rarityId}(${node.rarity.name})<br>S${node.index + 1}%10000<br><span style="font-size: 80%;">${node.rarityRateRangeDisplay}</span>`;

        // Item & Reroll Content
        let itemContent = '-';
        if (node.itemId !== -1) {
             const nextNg = node.isGuaranteedRoll ? (guaranteedCycle - 1) : ngTrackerDetail;
             const iHref = generateItemLink(node.seed3, node.itemId, nextNg, node.index + 1, false, initialFs);
             let style = node.isFeatured && itemInfo && itemInfo.single ? "color: red; font-weight: bold;" : "";
             if (node.isGuaranteedRoll) {
                 const gHref = generateItemLink(node.prevSeed1, node.singleCompareItemId, guaranteedCycle, node.index, false, initialFs);
                 itemContent = `<a href="${gHref}" class="featuredItem-text">目玉(確定)</a> / <a href="${iHref}">${node.itemName}</a>`;
             } else {
                 itemContent = `<a href="${iHref}" style="${style}">${node.itemName}</a>`;
             }
             itemContent += `<br>S${node.index+2}%${node.poolSize}<br>${node.slot}→ID:${node.itemId}`;
        }

        let rerollContent = '-';
        if (node.reRollItemId !== -1) {
             const nextNg = node.isGuaranteedRoll ? (guaranteedCycle - 1) : ngTrackerDetail;
             const rHref = generateItemLink(node.seed4, node.reRollItemId, nextNg, node.index + 1, false, initialFs);
             rerollContent = `<a href="${rHref}">${node.reRollItemName}</a><br>S${node.index+3}%${node.poolSize>1?node.poolSize-1:0}<br>${node.reRollSlot}→ID:${node.reRollItemId}`;
        }

        // ReRoll Flag (Simplified)
        let reRollFlagContent = node.reRollFlag || '-'; 
        if (!node.reRollFlag && node.singleRoll) {
             reRollFlagContent = node.singleIsReroll ? 'True' : 'False';
             if (node.rarityId===1 && !node.isFeatured) reRollFlagContent += `<br>レア→Yes<br>${node.itemId}vs${node.singleCompareItemId}`;
             else if (node.isFeatured) reRollFlagContent += '<br>目玉→No';
             else reRollFlagContent += '<br>Other→No';
        }

        html += `<tr>
            <td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${node.index}<br>${node.address}</td>
            <td style="border: 1px solid #ccc; padding: 5px; text-align: center; font-family: monospace;">S${node.index}<br>${node.seed1}</td>
            <td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${featuredClsAttr}>${featuredContent}</td>
            <td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${rarityContent}</td>
            <td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${itemClsAttr}>${itemContent}</td>
            <td style="border: 1px solid #ccc; padding: 5px; text-align: center;"${rerollClsAttr}>${rerollContent}</td>
            <td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${reRollFlagContent}</td>
            <td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${singleDisplay}</td>
            <td style="border: 1px solid #ccc; padding: 5px; text-align: center;">${ngContentDetail}</td>
        </tr>`;
    }
    html += '</tbody></table>';

    // --- 2. 10連詳細セクション ---
    if (tenPullCyclesData && tenPullCyclesData.length > 0) {
        html += '<h2 style="margin-top:20px;">＜10連詳細 (現在地からのシミュレーション / 10サイクル)＞</h2>';
        let cumulativeFs = initialFs;
        
        tenPullCyclesData.forEach((cycle, idx) => {
            const count = cycle.featuredCountInCycle || 0;
            cumulativeFs -= count;
            
            html += `<div style="margin-top: 15px; border: 1px solid #000; padding: 10px; background-color: #fcfcfc;">`;
            html += `<h3>【Cycle ${idx + 1}】 (目玉: ${count})</h3>`;
            html += `<p>NG開始: ${cycle.startNgVal}, LastRoll: ${getItemNameSafe(cycle.startLastRollId)}</p>`;
            html += `<p>判定: ${cycle.guaranteedStatus}</p>`;
            
            html += '<h4>[Log]</h4><ul>';
            cycle.processLog.forEach(l => html += `<li style="font-size: 0.8rem;">${l}</li>`);
            html += '</ul>';

            html += '<h4>[Result]</h4><table style="border-collapse: collapse;">';
            cycle.results.forEach(res => {
                const style = res.isGuaranteed || res.isFeatured ? 'color: #d9534f; font-weight: bold;' : '';
                html += `<tr><td style="border: 1px solid #eee;">${res.label}</td><td style="border: 1px solid #eee; ${style}">${res.name}</td></tr>`;
            });
            html += '</table>';

            const linkUrl = generateItemLink(cycle.transition.nextSeed, cycle.transition.lastItemId, cycle.transition.nextNgVal, cycle.transition.nextIndex, false, cumulativeFs);
            html += `<p>Next: ${cycle.transition.nextIndex}(${cycle.transition.nextAddress}) → <a href="${linkUrl}" style="font-weight: bold; color: blue;">遷移する</a></p>`;
            html += '</div>';
        });
    }

    // DOM挿入
    const detailsDiv = document.getElementById('calculation-details'); 
    detailsDiv.innerHTML = html;
}