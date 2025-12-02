// --- view-uncompleted-table.js ---

/**
 * 未コンプビューのメインテーブル（期待値表示含む）を生成してDOMに挿入する関数
 * @param {Array} Nodes - 計算済みの全ノードデータ
 * @param {Map} highlightInfo - ハイライト情報（単発ルート、10連ルートの判定用）
 * @param {Array} tenPullCyclesData - 10連シミュレーションの結果データ
 * @param {Object} expectedFeaturedCounts - 期待値データ
 * @param {number} tableRows - 表示する行数
 * @param {string} displaySeed - '1'なら詳細表示、それ以外は通常表示
 * @param {number} initialNg - 初期のNext Guaranteed値
 * @param {number} initialFs - 初期のFeatured Stock値
 * @param {number} guaranteedCycle - 確定周期（通常30）
 */
function renderUncompletedMainTable(Nodes, highlightInfo, tenPullCyclesData, expectedFeaturedCounts, tableRows, displaySeed, initialNg, initialFs, guaranteedCycle) {
    
    // --- ヘルパー関数: アイテムCSS決定 ---
    function determineItemCss(itemId) {
        if (!itemMaster[itemId]) return '';
        if (itemMaster[itemId].rarity === 4) return 'legendItem-text';
        if (itemMaster[itemId].rarity >= 3) return 'featuredItem-text';
        return '';
    }

    // --- 期待値表示エリア ---
    let expectedValueHtml = '<div>';
    if (expectedFeaturedCounts) {
        expectedValueHtml += '<h3>＜単発Nroll後の10連での目玉獲得数予測＞</h3>'; 
        const expectedKeys = Object.keys(expectedFeaturedCounts).sort((a, b) => parseInt(a) - parseInt(b));
        
        const expectedValueText = expectedKeys.map(n => {
            const m = expectedFeaturedCounts[n];
            const rollNum = parseInt(n) + 1; 
            return `${rollNum}roll:<span style="font-weight: bold;">${Math.floor(m)}個</span>`;
        }).join(', ');
        
        expectedValueHtml += `<p style="font-size: 1.1em;">${expectedValueText}</p>`;
    } else {
        expectedValueHtml += '<p>期待値データが見つかりませんでした。</p>';
    }
    expectedValueHtml += '</div><br>';

    // --- テーブルヘッダー生成 ---
    let table = expectedValueHtml;
    table += '<table style="table-layout: fixed;"><thead>';
    
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

    // --- メインループ変数の初期化 ---
    let currentNgVal = !isNaN(initialNg) ? initialNg : -1;
    let currentFsVal = initialFs;

    // --- メインループ (各行の生成) ---
    for (let r = 0; r < tableRows; r++) {
        table += `<tr><td class="col-no">${r + 1}</td>`;
        const nodeIndices = [r * 3 + 1, r * 3 + 2, r * 3 + 3]; // 1行あたりA, B, Cの3ノード
        
        // --- A, B, C 列の処理 ---
        nodeIndices.forEach((idx, colIndex) => {
            const node = Nodes[idx - 1];
            if (!node) {
                table += displaySeed === '1' ? '<td colspan="5"></td>' : '<td></td>';
                return;
            }

            const info = highlightInfo.get(node.address);
            let cls = determineHighlightClass(info);
            
            const isSingleRouteNode = info && info.single; // 単発ガチャのルートに存在するノードか
            const isGuaranteedNode = isSingleRouteNode && node.isGuaranteedRoll; // 単発ルートで確定ロールか

            let content = '';
            let linkFs = currentFsVal;
            
            // ReRollFlagの取得
            const nodeReRollFlag = node.reRollFlag; // logic側で計算済みと仮定

            // ----------------------------------------------------------------
            // Case 1: Single Route Logic (単発ガチャルート上のノード)
            // ----------------------------------------------------------------
            if (isSingleRouteNode) {
                 if (isGuaranteedNode) {
                     // 1-A. Guaranteed Roll Processing (確定ノード)
                     // Next NG resets to guaranteedCycle - 1 (例: 29)
                     const nextNg = guaranteedCycle - 1; 

                     // 目玉(確定)リンク (前の状態への遷移、NG=30)
                     const guaranteedLinkSeed = node.prevSeed1; 
                     const guaranteedLinkNg = guaranteedCycle; 
                     const guaranteedLinkFs = initialFs; // FSは減らない(仕様による)
                     const guaranteedHref = generateItemLink(guaranteedLinkSeed, node.singleCompareItemId, guaranteedLinkNg, node.index, false, guaranteedLinkFs);
                     const guaranteedLinkStyle = `text-decoration: none; color: inherit; font-weight: bold;`;
                     const guaranteedLink = `<a href="${guaranteedHref}" class="featuredItem-text" style="${guaranteedLinkStyle}">目玉(確定)</a>`; 

                     // アイテム名リンク (確定ロール後の状態への遷移、NG=29)
                     const itemDisplayName = node.itemName;
                     const itemLinkSeed = node.seed3; // S(n+2)
                     const itemLinkNg = guaranteedCycle - 1; 
                     const itemLinkFs = initialFs;
                     const itemHref = generateItemLink(itemLinkSeed, node.itemId, itemLinkNg, r+1, false, itemLinkFs);
                     const itemLinkStyle = `text-decoration: none; color: inherit; font-weight: normal;"`;
                     const itemNameLink = `<a href="${itemHref}" style="${itemLinkStyle}">${itemDisplayName}</a>`;

                     content = `${guaranteedLink} / ${itemNameLink}`;
                     
                     // 状態更新
                     currentNgVal = guaranteedCycle - 1; // 次のNG値をリセット
                     currentFsVal = linkFs; 

                 } else {
                     // 1-B. Normal Single Route Node (非確定ノード)
                     // 次のノードの開始NG値
                     let nextNg = (currentNgVal !== -1) ? currentNgVal - 1 : 'none';
                     if (nextNg !== 'none' && nextNg <= 0) nextNg = guaranteedCycle;
                     
                     if (node.isFeatured) {
                         // 目玉アイテムの場合
                         linkFs = currentFsVal - 1;
                         const currentSeedVal = node.seed1; 
                         const hrefFeatured = generateItemLink(currentSeedVal, -2, nextNg, r+1, false, linkFs);
                         content = `${node.featuredNextAddress})<a href="${hrefFeatured}"><span class="featuredItem-text">目玉</span></a>`;
                         currentFsVal -= 1; // FSカウンターを減らす
                     } else {
                        // 通常アイテム
                        const isRerollHighlight = info ? info.s_reRoll : false;
                        
                        if (isRerollHighlight) {
                             // 再抽選が行われたケース
                             const preRerollName = node.itemName; 
                             const postRerollId = node.reRollItemId;
                             const postRerollName = node.reRollItemName;
                             
                             // Pre-Reroll Link: S(n+2)
                             const preSeed = node.seed3; 
                             const preHref = generateItemLink(preSeed, node.itemId, nextNg, r+1, false, linkFs);
                             let preCss = determineItemCss(node.itemId);

                             // Post-Reroll Link: S(n+3)
                             const postSeed = node.seed4; 
                             const postHref = generateItemLink(postSeed, postRerollId, nextNg, r+1, false, linkFs);
                             let postCss = determineItemCss(postRerollId);

                             content = `<a href="${preHref}" class="${preCss}">${preRerollName}</a><br>${node.reRollNextAddress})<a href="${postHref}" class="${postCss}">${postRerollName}</a>`;

                        } else {
                             // 通常排出のケース
                             // Item Link: S(n+2)
                             const nextSeed = node.seed3; 
                             const finalId = node.itemId; 
                             const href = generateItemLink(nextSeed, finalId, nextNg, r+1, false, linkFs);
                             let css = determineItemCss(finalId);
                             content = `<a href="${href}" class="${css}">${node.itemName}</a>`;

                             // 再抽選候補リンク (ReRollFlagがTrueの場合、または強制再抽選モードの場合)
                             if (node.reRollItemId !== -1) { 
                                 if (node.singleIsReroll || window.forceRerollMode) { // node.singleIsReroll を参照
                                     // ReRoll Link: S(n+3)
                                     const rrHref = generateItemLink(node.seed4, node.reRollItemId, nextNg, r+1, false, linkFs); 
                                     let rrName = node.reRollItemName;
                                     let rrCss = determineItemCss(node.reRollItemId);
                                     content += `<br>${node.reRollNextAddress})<a href="${rrHref}" class="${rrCss}">${rrName}</a>`;
                                 }
                             }
                        }
                     }
                     // 状態更新
                     if (currentNgVal !== -1) {
                         currentNgVal -= 1; // 通常時は1減らす
                         if (currentNgVal <= 0) currentNgVal = guaranteedCycle;
                     }
                 }
            } else {
                // ----------------------------------------------------------------
                // Case 2: Off-Route Logic (ルート外の共通ロジック)
                // ----------------------------------------------------------------
                // リンクNG値は「次のロールの開始NG値」
                let linkNgVal = (initialNg !== -1) ? initialNg - (r + 1) : 'none';
                if (linkNgVal !== 'none' && linkNgVal <= 0) {
                    // 0以下になった場合、次のロールの開始NG値は guaranteedCycle - 1
                    // (ここでの計算は簡易的なため、厳密なNG追跡が必要ならLogic側で計算してNodeに持たせるのが理想)
                    linkNgVal = guaranteedCycle - 1;
                }
                const linkFsVal = initialFs; 
                
                if (node.isFeatured) {
                    // 目玉アイテムの場合
                    const currentSeed = node.seed1; 
                    const hrefFeatured = generateItemLink(currentSeed, -2, linkNgVal, r+1, false, linkFsVal);
                    content = `${node.featuredNextAddress})<a href="${hrefFeatured}"><span class="featuredItem-text">目玉</span></a>`;
                    
                } else {
                    const finalId = node.itemId;
                    const preRerollName = node.itemName; 
                    
                    // 1. Pre-Reroll / Normal Link: S(n+2)
                    const nextSeedNormal = node.seed3; 
                    const hrefNormal = generateItemLink(nextSeedNormal, finalId, linkNgVal, r+1, false, linkFsVal);
                    let cssNormal = determineItemCss(finalId);

                    content = `<a href="${hrefNormal}" class="${cssNormal}">${preRerollName}</a>`;
                    
                    // 再抽選リンク (重複再抽選フラグがTrueの場合、または強制再抽選モードの場合)
                    if (node.reRollItemId !== -1 && node.isDupe) {
                        if (window.forceRerollMode || (info && info.ten && info.t_reRoll)) { // 10連ルートの再抽選判定などを考慮
                            // 2. Post-Reroll Link: S(n+3)
                            const nextSeedReroll = node.seed4; 
                            const rrId = node.reRollItemId;
                            const rrName = node.reRollItemName;
                            const rrHref = generateItemLink(nextSeedReroll, rrId, linkNgVal, r+1, false, linkFsVal);
                            let rrCss = determineItemCss(rrId);
                            
                            content += `<br>${node.reRollNextAddress})<a href="${rrHref}" class="${rrCss}">${rrName}</a>`;
                        }
                    }
                }
            }

            // --- セルHTML生成 ---
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

        // --- G Column Logic (10連ガチャシミュレーション結果) ---
        let gContent = '-';
        let gStyle = '';
        
        const cycleIndex = Math.floor(r / 10);
        const rollIndex = r % 10;
        
        const tenPullDetailData = tenPullCyclesData ? tenPullCyclesData[cycleIndex] : null; 
        
        if (rollIndex < 9) { gStyle = 'background-color: #ffffe0;'; } else if (rollIndex === 9) { gStyle = 'background-color: #ffff8d;'; }

        if (tenPullDetailData && rollIndex < 10) {
            const res = tenPullDetailData.results[rollIndex];
            if (res) {
                let cellName = res.name;
                if (res.isReroll && res.preRerollName) {
                    cellName = `${res.preRerollName}<br><span style="font-size:85%;">(再)${cellName}</span>`;
                }
                if (res.isGuaranteed) {
                    cellName = `<span class="featuredItem-text">${cellName}</span>`;
                } else if (res.isFeatured) {
                    cellName = `<span class="featuredItem-text">${cellName}</span>`;
                }

                if (rollIndex === 9) {
                    const addressStr = tenPullDetailData.transition.nextAddress;
                    let nextNg = tenPullDetailData.transition.nextNgVal;
                    
                    if (isNaN(nextNg) || nextNg <= 0) {
                        nextNg = guaranteedCycle - 1; 
                    }
                    
                    let usedFs = tenPullDetailData.featuredCountInCycle || 0;
                    let nextFs = initialFs - usedFs; // ※累積計算は簡易的（このサイクル分のみ減算）

                    const href10 = generateItemLink(
                        tenPullDetailData.transition.nextSeed,
                        tenPullDetailData.transition.lastItemId,
                        nextNg,
                        tenPullDetailData.transition.nextIndex, 
                        false, 
                        nextFs
                    );
                    gContent = `${addressStr})<a href="${href10}">${cellName}</a>`;
                } else {
                    gContent = cellName;
                }
            }
        }
        
        if (displaySeed === '1') table += `<td colspan="5" style="${gStyle}">${gContent}</td>`;
        else table += `<td style="${gStyle}">${gContent}</td>`;
        table += '</tr>';
    }
    table += '</tbody></table>';

    // DOMへの挿入
    document.getElementById('result-table-container').innerHTML = table;
}