// --- 共通ロジック ---

/**
 * シード配列を一括生成する
 */
function generateSeedList(initialSeed, count) {
    const seeds = [initialSeed];
    for (let i = 1; i < count; i++) {
        seeds[i] = xorshift32(seeds[i - 1]);
    }
    return seeds;
}

/**
 * ロール値と閾値からレアリティ情報を取得する
 */
function getRarityFromRoll(roll, thresholds) {
    if (roll < thresholds['0']) return { id: 0, name: 'ノーマル' };
    if (roll < thresholds['1']) return { id: 1, name: 'レア' };
    if (roll < thresholds['2']) return { id: 2, name: '激レア' };
    if (roll < thresholds['3']) return { id: 3, name: '超激レア' };
    return { id: 4, name: '伝説レア' };
}

/**
 * アドレス文字列 (1A, 1B, 2A...) を生成する
 * cols: 列数 (completed=2, uncompleted=3)
 */
function getAddressStringGeneric(n, cols) {
    if (n <= 0) return '';
    const zeroBasedIndex = n - 1;
    const col_char = String.fromCharCode('A'.charCodeAt(0) + (zeroBasedIndex % cols));
    const row_num = Math.floor(zeroBasedIndex / cols) + 1;
    return `${row_num}${col_char}`;
}

/**
 * アイテム名を取得する安全なヘルパー
 */
function getItemNameSafe(itemId) {
    if (itemId === -1 || itemId === undefined) return '---';
    return itemMaster[itemId]?.name || '---';
}

/**
 * ハイライトクラス判定ロジック
 */
function determineHighlightClass(info) {
    if (!info) return '';
    let cls = '';
    const isSingle10 = info.single && (info.singleRoll % 10 === 0);
    const isTen10 = info.ten && (info.tenRoll % 10 === 0);
    
    if (info.single && info.ten) {
        cls = (isSingle10 || isTen10) ? 'highlight-roll-overlap-dark' : 'highlight-roll-overlap';
    } else if (info.single) {
        cls = isSingle10 ? 'highlight-roll-dark' : 'highlight-roll';
    } else if (info.ten) {
        cls = isTen10 ? 'highlight-roll-10pull-dark' : 'highlight-roll-10pull';
    }
    return cls;
}