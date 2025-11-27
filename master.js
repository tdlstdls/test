// --- マスターデータ ---
const gachaMaster = {
    '34': { name: '(旧)ハロウィン',
            featuredItemRate: 600,
            featuredItemStock: 5,
            guaranteedCycle: 30,
            uberGuaranteedFlag: false,
            legendGuaranteedFlag: false,
            rarityRates: { '0': 2000, '1': 5000, '2': 3000, '3': 0, '4': 0 },
            pool: [0, 2, 3, 4, 5, 10, 11, 12, 14] },

    '42': { name: '1.1億DL記念',
            featuredItemRate: 500,
            featuredItemStock: 5,
            guaranteedCycle: 30,
            uberGuaranteedFlag: false,
            legendGuaranteedFlag: false,
            rarityRates: { '0': 1000, '1': 5000, '2': 3000, '3': 1000, '4': 0 },
            pool: [0, 2, 3, 4, 5, 10, 11, 12, 14, 375, 381, 689] },

    '44': { name: 'ハロウィン',
            featuredItemRate: 500,
            featuredItemStock: 8,
            guaranteedCycle: 30,
            uberGuaranteedFlag: false,
            legendGuaranteedFlag: false,
            rarityRates: { '0': 2000, '1': 4900, '2': 3000, '3': 0, '4': 100 },
            pool: [0, 2, 3, 4, 5, 10, 11, 12, 14, 18] },
            
    '45': { name: 'にゃんこレンジャー',
            featuredItemRate: 0,
            featuredItemStock: 0,
            guaranteedCycle: 10,
            uberGuaranteedFlag: true,
            legendGuaranteedFlag: false,
            rarityRates: { '0': 0, '1': 7000, '2': 2300, '3': 500, '4': 200 },
            pool: [0,2,3,4,5,11,12,14,197,184,375,726,831] }
};

const itemMaster = {
    0: { name: "スピダ", rarity: 1 },
    2: { name: "ネコボン", rarity: 2 },
    3: { name: "ニャンピュ", rarity: 1 },
    4: { name: "おかめ", rarity: 2 },
    5: { name: "スニャ", rarity: 2 },
    10: { name: "5千XP", rarity: 0 },
    11: { name: "1万XP", rarity: 1 },
    12: { name: "3万XP", rarity: 1 },
    14: { name: "10万XP", rarity: 2 },
    18: { name: "200万XP", rarity: 4 },
    197: { name: "100万XP", rarity: 4 },
    184: { name: "ミスターニンジャ", rarity: 3 },
    375: { name: "記念ネコ", rarity: 3 },
    381: { name: "ねこ農家", rarity: 3 },
    689: { name: "石の上にも10年ネコ", rarity: 3 },
    726: { name: "ネコメダル王", rarity: 3 },
    831: { name: "スカーフにゃんこ", rarity: 3 }
};