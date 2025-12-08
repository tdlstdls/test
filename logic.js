/**
 * 乱数生成クラス
 */
class Xorshift32 {
    constructor(seed) { this.seed = (seed >>> 0) || 1; }
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
 */
function rollWithSeedConsumptionFixed(startIndex, gachaConfig, seeds, lastDrawInfo) {
    if (startIndex + 1 >= seeds.length) return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null }, originalChar: null, isRerolled: false, rarity: null, charId: null, s0: null, s1: null, s2: null };
    
    const s0_seed = seeds[startIndex];
    const s1_seed = seeds[startIndex + 1];

    const rarityRoll = s0_seed % 10000;
    const rates = gachaConfig.rarity_rates || {};
    const rareRate = rates.rare || 0, superRate = rates.super || 0, uberRate = rates.uber || 0, legendRate = rates.legend || 0;
    let currentRarity;
    
    if (rarityRoll < rareRate) { currentRarity = 'rare'; } 
    else if (rarityRoll < rareRate + superRate) { currentRarity = 'super'; } 
    else if (rarityRoll < rareRate + superRate + uberRate) { currentRarity = 'uber'; } 
    else if (rarityRoll < rareRate + superRate + uberRate + legendRate) { currentRarity = 'legend'; } 
    else { currentRarity = 'rare'; }
    
    const characterPool = gachaConfig.pool[currentRarity] || [];
    if (characterPool.length === 0) {
        const s2_seed = (startIndex + 2 < seeds.length) ? seeds[startIndex + 2] : null;
        return { seedsConsumed: 2, finalChar: { name: "該当なし", id: null }, originalChar: null, isRerolled: false, rarity: currentRarity, charId: null, charIndex: -1, totalChars: 0, s0: s0_seed, s1: s1_seed, s2: s2_seed };
    }
    
    const totalChars = characterPool.length;
    const charIndex = s1_seed % totalChars;
    let character = characterPool[charIndex];
    const originalChar = character;
    let seedsConsumed = 2;
    let isRerolled = false;
    let s2_seed = (startIndex + 2 < seeds.length) ? seeds[startIndex + 2] : null;
    let reRollIndex = null;
    let uniqueTotal = null;

    // レア被り判定（Rare Dupe Check）
    if (currentRarity === 'rare' && lastDrawInfo && lastDrawInfo.rarity === 'rare' && lastDrawInfo.charId === character.id) {
        const uniqueRareChars = characterPool.filter(c => c.id !== lastDrawInfo.charId);
        uniqueTotal = uniqueRareChars.length;
        
        if (uniqueTotal > 0) {
            if (s2_seed === null) {
                 return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null }, originalChar: null, isRerolled: false, rarity: null, charId: null, s0: s0_seed, s1: s1_seed, s2: null };
            }
            reRollIndex = s2_seed % uniqueTotal;
            character = uniqueRareChars[reRollIndex];
            isRerolled = true;
            seedsConsumed = 3;
        } 
    }
    
    return { 
        s0: s0_seed, s1: s1_seed, s2: s2_seed, 
        originalChar: originalChar, 
        finalChar: character, 
        isRerolled: isRerolled, 
        rarity: currentRarity, 
        charId: character.id, 
        charIndex: charIndex, 
        totalChars: totalChars, 
        uniqueTotal: uniqueTotal,
        reRollIndex: reRollIndex,
        seedsConsumed: seedsConsumed 
    };
}

/**
 * 確定枠（Uber）の抽選
 */
function rollGuaranteedUber(startIndex, gachaConfig, seeds) {
    if (startIndex >= seeds.length) return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null }, originalChar: null, isRerolled: false, rarity: 'uber', charId: null, s0: null };

    const s0_seed = seeds[startIndex];
    const currentRarity = 'uber';
    const characterPool = gachaConfig.pool[currentRarity] || [];
    const totalChars = characterPool.length;
    if (totalChars === 0) {
        return { seedsConsumed: 1, finalChar: { name: "該当なし", id: null }, originalChar: null, isRerolled: false, rarity: currentRarity, charId: null, charIndex: -1, totalChars: 0, s0: s0_seed };
    }
    const charIndex = s0_seed % totalChars;
    const character = characterPool[charIndex];
    return { seedsConsumed: 1, finalChar: character, originalChar: character, isRerolled: false, rarity: currentRarity, charId: character.id, charIndex: charIndex, totalChars: totalChars, s0: s0_seed };
}

/**
 * 確定枠の先読み計算
 */
function calculateGuaranteedLookahead(startSeedIndex, gachaConfig, allSeeds, initialLastDraw) {
    if (!gachaConfig || !gachaConfig.pool['uber']) return { name: "N/A", nextSeed: null, nextRollStartSeedIndex: null };

    let seedCursor = startSeedIndex;
    let lastDraw = initialLastDraw;
    let nextSimSeedValue = null;

    // 10連分の通常抽選
    for (let i = 0; i < 10; i++) {
        if (seedCursor + 1 >= allSeeds.length) return { name: "データ不足", nextSeed: null, nextRollStartSeedIndex: null };

        const rollResult = rollWithSeedConsumptionFixed(seedCursor, gachaConfig, allSeeds, lastDraw);
        if (rollResult.seedsConsumed === 0) return { name: "データ不足", nextSeed: null, nextRollStartSeedIndex: null };
        
        seedCursor += rollResult.seedsConsumed;
        lastDraw = { rarity: rollResult.rarity, charId: rollResult.charId };
    }

    if (seedCursor >= allSeeds.length) return { name: "データ不足", nextSeed: null, nextRollStartSeedIndex: null };
    
    // 11回目が確定枠
    const guaranteedRollResult = rollGuaranteedUber(seedCursor, gachaConfig, allSeeds);
    if (guaranteedRollResult.seedsConsumed === 0) return { name: "データ不足", nextSeed: null, nextRollStartSeedIndex: null };
    
    seedCursor += guaranteedRollResult.seedsConsumed;
    nextSimSeedValue = (seedCursor < allSeeds.length) ? allSeeds[seedCursor] : null;

    return { name: guaranteedRollResult.finalChar.name, nextSeed: nextSimSeedValue, nextRollStartSeedIndex: seedCursor };
}