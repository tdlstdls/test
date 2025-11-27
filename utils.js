// --- ユーティリティ関数 ---

function generateUrlQuery(p) {
    const query = new URLSearchParams();
    // DEFAULT_PARAMSはmain.jsで定義されますが、参照エラーを防ぐため
    // ここでチェックするか、呼び出し側で制御します。
    // 今回は単純化のため、呼び出し側でフィルタリング済みのオブジェクトを受け取る想定、
    // もしくは単純な変換を行います。
    for (const key in p) {
        if (p[key] !== null && p[key] !== undefined) query.set(key, p[key]);
    }
    return '?' + query.toString();
}

function xorshift32(seed) {
    let x = seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 15;
    return x >>> 0;
}

function setupGachaRarityItems() {
    for (const gachaId in gachaMaster) {
        const gacha = gachaMaster[gachaId];
        if (gacha && gacha.pool) {
            gacha.rarityItems = { '0': [], '1': [], '2': [], '3': [], '4': [] };
            for (const itemId of gacha.pool) {
                const item = itemMaster[itemId];
                if (item && gacha.rarityItems[item.rarity] !== undefined) {
                    gacha.rarityItems[item.rarity].push(itemId);
                }
            }
            for (const rarity in gacha.rarityItems) gacha.rarityItems[rarity].sort((a, b) => a - b);
        }
    }
}

function generateMasterInfoHtml(gacha) {
    let html = `<h2>＜マスター情報＞</h2>`;
    // activeGachaIdはグローバル変数としてmain.jsで管理される想定
    html += `(ガチャ) ${gacha.name}(ID:${window.activeGachaId || '?'})<br>`;
    html += `(目玉) ${gacha.featuredItemRate > 0}(レート:${gacha.featuredItemRate}, 初期残数:${gacha.featuredItemStock})<br>`;
    html += `(確定) 超激:${gacha.uberGuaranteedFlag}, 伝説:${gacha.legendGuaranteedFlag}<br>`;
    
    const r = gacha.rarityRates;
    const r0 = r['0'];
    const t1 = r0;
    const t2 = r0 + r['1'];
    const t3 = t2 + r['2'];
    const t4 = t3 + r['3'];
    
    let rateStr = `(レート) `;
    if (r0 === 0) rateStr += `0(ノーマル)-, `;
    else rateStr += `0(ノーマル)～${t1-1}, `;
    
    rateStr += `1(レア)～${t2-1}, `;
    rateStr += `2(激レア)～${t3-1}, `;
    rateStr += `3(超激レア)～${t4-1}, `;
    rateStr += `4(伝説レア)～9999`;
    html += rateStr + `<br>`;
    
    html += `(各レアリティ別アイテム)<br>`;
    const rarities = ['0.ノーマル', '1.レア', '2.激レア', '3.超激レア', '4.伝説レア'];
    for (let i = 0; i <= 4; i++) {
        const pool = gacha.rarityItems[i.toString()];
        if (pool && pool.length > 0) {
            const itemsStr = pool.map(id => `${itemMaster[id].name}(ID:${id})`).join(', ');
            html += `${rarities[i]}(${pool.length}種) ${itemsStr}<br>`;
        }
    }
    return html + '<br>';
}

function getFormattedItemComparison(nodeItemName, nodeItemId, nodeRarityId, prevItemId, comparisonTargetName) {
    const rComp = (nodeRarityId === 1) ? '1=1' : `${nodeRarityId}≠1`;
    let idComp = '';
    let targetDisplay = '';

    if (comparisonTargetName) {
         targetDisplay = comparisonTargetName;
    } else {
         targetDisplay = (prevItemId === -1) ? 'Null' : `${prevItemId}`;
    }

    if (prevItemId === -1) {
         idComp = (nodeItemId === -1) ? '=Null' : '≠Null'; 
    } else {
         idComp = (nodeItemId === prevItemId) ? `=${targetDisplay}` : `≠${targetDisplay}`;
    }
    
    const isDupe = (nodeRarityId === 1 && nodeItemId !== -1 && nodeItemId === prevItemId);
    
    const text = `${nodeItemName}(${nodeItemId}(${rComp})${idComp})`;
    return { text, isDupe };
}

function generateItemLink(newSeed, newItemId, initialInputNg, rollNumberInSequence, isCompleted) {
    // グローバルの activeGachaId を参照
    const gId = window.activeGachaId; 
    const currentParams = new URLSearchParams(window.location.search);
    const paramsForQuery = {};
    for (const [key, value] of currentParams.entries()) paramsForQuery[key] = value;
    if (!paramsForQuery.gacha) paramsForQuery.gacha = gId;

    paramsForQuery.seed = newSeed;
    if (newItemId !== undefined) paramsForQuery.lr = newItemId;

    const initialInputNgInt = parseInt(initialInputNg, 10);
    if (initialInputNg !== 'none' && !isNaN(initialInputNgInt) && rollNumberInSequence !== undefined) {
        if (isCompleted) {
            const rollInCycle = (rollNumberInSequence - 1) % 10;
            let ngValue = initialInputNgInt - 1 - rollInCycle;
            if (ngValue <= 0) ngValue += 10;
            paramsForQuery.ng = ngValue.toString();
        } else {
            const gacha = gachaMaster[gId];
            const periodicity = gacha.guaranteedCycle || 30;
            let ngValue = initialInputNgInt;
            ngValue = ngValue - 1;
            if (ngValue <= 0) ngValue = periodicity;
            paramsForQuery.ng = ngValue.toString();
        }
    } else {
        paramsForQuery.ng = 'none';
    }
    return generateUrlQuery(paramsForQuery);
}