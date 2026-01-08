/** @file logic.js @description ガチャ抽選の核心ロジック（Xorshift32、11連確定計算、デバッグログ保持） */

/** 乱数生成クラス */
class Xorshift32 {
    constructor(seed) {
        this.seed = (seed >>> 0) || 1;
    }
    next() {
        let x = this.seed;
        x ^= (x << 13);
        x ^= (x >>> 17);
        x ^= (x << 15);
        this.seed = x >>> 0;
        return this.seed;
    }
}

/**
 * 1回分のガチャ抽選を行う（シード消費あり）
 * @param {boolean} useStrictFinalId レア被り判定に「直前の実際の排出キャラID」のみを使うか（11連確定用）
 */
function rollWithSeedConsumptionFixed(startIndex, gachaConfig, seeds, lastDrawInfo, useStrictFinalId = false) {
    if (startIndex + 1 >= seeds.length) {
        return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null }, debug: null };
    }

    const s0_seed = seeds[startIndex];
    const s1_seed = seeds[startIndex + 1];

    // 1. レアリティ判定
    const rarityRoll = s0_seed % 10000;
    const rates = gachaConfig.rarity_rates || {};
    const rareRate = rates.rare || 0, superRate = rates.super || 0, uberRate = rates.uber || 0, legendRate = rates.legend || 0;
    
    let currentRarity;
    if (rarityRoll < rareRate) currentRarity = 'rare';
    else if (rarityRoll < rareRate + superRate) currentRarity = 'super';
    else if (rarityRoll < rareRate + superRate + uberRate) currentRarity = 'uber';
    else if (rarityRoll < rareRate + superRate + uberRate + legendRate) currentRarity = 'legend';
    else currentRarity = 'rare';
    
    const characterPool = gachaConfig.pool[currentRarity] || [];
    if (characterPool.length === 0) {
        return { seedsConsumed: 2, finalChar: { name: "該当なし", id: null }, rarity: currentRarity, debug: null };
    }
    
    // 2. キャラクター判定（最初の抽選）
    const totalChars = characterPool.length;
    const charIndex = s1_seed % totalChars;
    let character = characterPool[charIndex];
    const originalChar = character;
    
    let seedsConsumed = 2;
    let isRerolled = false;
    let rerollProcess = null;

    // 3. レア被り判定
    if (currentRarity === 'rare' && lastDrawInfo && lastDrawInfo.rarity === 'rare') {
        const currentCharId = String(character.id);
        // モード切替: 11連確定計算時は「直前の実際の排出キャラ」のみを見る
        const prevIdToCompare = useStrictFinalId ? String(lastDrawInfo.charId) : String(lastDrawInfo.originalCharId);

        if (currentCharId === prevIdToCompare) {
            isRerolled = true;
            let currentPool = characterPool.filter(c => String(c.id) !== prevIdToCompare);
            
            if (currentPool.length > 0 && startIndex + seedsConsumed < seeds.length) {
                const nextSeedVal = seeds[startIndex + seedsConsumed];
                const newTotal = currentPool.length;
                const reRollIndex = nextSeedVal % newTotal;
                character = currentPool[reRollIndex];
                
                rerollProcess = {
                    prevId: prevIdToCompare,
                    nextSeed: nextSeedVal,
                    newTotal: newTotal,
                    reRollIndex: reRollIndex
                };
                seedsConsumed++;
            }
        }
    }

    // デバッグ情報の構築
    const debug = {
        startIndex: startIndex,
        s0: s0_seed,
        rarityRoll: rarityRoll,
        rarity: currentRarity,
        s1: s1_seed,
        totalChars: totalChars,
        charIndex: charIndex,
        originalChar: originalChar,
        isRerolled: isRerolled,
        rerollProcess: rerollProcess,
        finalChar: character,
        consumed: seedsConsumed
    };

    return { 
        originalChar: originalChar, 
        finalChar: character, 
        isRerolled: isRerolled, 
        rarity: currentRarity, 
        charId: character.id, 
        seedsConsumed: seedsConsumed,
        debug: debug
    };
}

/** 確定枠（Uber）の抽選 */
function rollGuaranteedUber(startIndex, gachaConfig, seeds) {
    if (startIndex >= seeds.length) return { seedsConsumed: 1, finalChar: { name: "データ不足", id: null }, debug: null };
    const pool = gachaConfig.pool['uber'] || [];
    if (pool.length === 0) return { seedsConsumed: 1, finalChar: { name: "該当なし", id: null }, debug: null };
    
    const seedValue = seeds[startIndex];
    const charIndex = seedValue % pool.length;
    const character = pool[charIndex];

    const debug = {
        startIndex: startIndex,
        seedValue: seedValue,
        totalChars: pool.length,
        charIndex: charIndex,
        finalChar: character
    };

    return { seedsConsumed: 1, finalChar: character, charId: character.id, debug: debug };
}

/**
 * 11連確定等の連続計算を完全に別データとして管理
 * 10回のロールを線形に連続して行い、デバッグログを保持する
 */
function calculateSequentialGuaranteed(startSeedIndex, gachaConfig, allSeeds, initialLastDraw, normalRollsCount = 10) {
    let seedCursor = startSeedIndex;
    let currentLastDraw = initialLastDraw;
    const debugLog = [];

    // 1. 単発10回を線形にシミュレート
    const normalRollsResults = [];
    for (let i = 0; i < normalRollsCount; i++) {
        const rr = rollWithSeedConsumptionFixed(seedCursor, gachaConfig, allSeeds, currentLastDraw, true);
        if (rr.seedsConsumed === 0) break;

        debugLog.push({ step: `Roll ${i + 1}`, ...rr.debug });
        normalRollsResults.push(rr);
        
        seedCursor += rr.seedsConsumed;
        // 11連内では「実際の排出結果」を次の比較対象にする
        currentLastDraw = { rarity: rr.rarity, charId: rr.charId, originalCharId: rr.charId };
    }

    // 2. 確定枠の抽選
    const gr = rollGuaranteedUber(seedCursor, gachaConfig, allSeeds);
    debugLog.push({ step: `Guaranteed Uber`, ...gr.debug });

    // 3. 次の開始アドレス（確定枠SEEDの直後）
    const nextStartIdx = seedCursor + 1;

    return { 
        name: gr.finalChar.name, 
        charId: gr.charId, 
        nextRollStartSeedIndex: nextStartIdx,
        normalRollsResults: normalRollsResults, // 検算用
        debugLog: debugLog
    };
}