/** @file view_table_data.js @description 経路依存シミュレーションによるテーブルデータ生成（11連確定独立計算・検算機能付き） */

/** 各列のガチャ設定を構築（確定枠用のパラメータを付与） */
function prepareColumnConfigs() {
    return tableGachaIds.map((idWithSuffix, colIndex) => {
        let suffix = '';
        let baseId = idWithSuffix;
        
        // 接尾辞の解析 (g:確定11連, f:確定15連, s:確定7連)
        if (idWithSuffix.endsWith('f')) { suffix = 'f'; baseId = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('s')) { suffix = 's'; baseId = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('g')) { suffix = 'g'; baseId = idWithSuffix.slice(0, -1); }

        let guaranteedNormalRolls = 0;
        if (suffix === 'g') guaranteedNormalRolls = 10;
        else if (suffix === 'f') guaranteedNormalRolls = 14;
        else if (suffix === 's') guaranteedNormalRolls = 6;

        const configSource = gachaMasterData.gachas[idWithSuffix] || gachaMasterData.gachas[baseId];
        if (!configSource) return null;

        const config = JSON.parse(JSON.stringify(configSource));
        config._guaranteedNormalRolls = guaranteedNormalRolls;
        config._suffix = suffix;
        
        // 超激レア追加設定
        const addCount = uberAdditionCounts[colIndex] || 0;
        if (addCount > 0 && config.pool.uber) {
            for (let k = 1; k <= addCount; k++) {
                config.pool.uber.unshift({ id: `sim-new-${k}`, name: `新規超激${k}`, rarity: 'uber' });
            }
        }
        return config;
    });
}

/** * 全ガチャ列のシミュレーションを実行 
 * 通常ロールの計算に加え、各地点からの11連確定シミュレーションを完全に独立して行う
 */
function executeTableSimulation(numRolls, columnConfigs, seeds) {
    const tableData = Array(numRolls * 2).fill(null).map(() => []);
    
    columnConfigs.forEach((config, colIndex) => {
        if (!config) return;

        const landingMap = new Map(); 
        let lastDrawA = null; 
        let lastDrawB = null; 

        // 垂直方向の進捗をシミュレート
        for (let i = 0; i < numRolls * 2; i++) {
            if (i >= seeds.length) break;

            const isTrackB = (i % 2 !== 0);
            let drawContext = null;
            
            // 履歴（ジャンプ着地または垂直遷移）の取得
            if (landingMap.has(i)) {
                drawContext = { ...landingMap.get(i), fromRerollRoute: true };
            } else {
                let verticalInfo = isTrackB ? lastDrawB : lastDrawA;
                if (verticalInfo) {
                    drawContext = { ...verticalInfo, fromRerollRoute: false };
                }
            }

            // 1. 通常ロールの抽選（表示用）
            const rollResult = rollWithSeedConsumptionFixed(i, config, seeds, drawContext, false);
            
            // 2. 確定枠（11G等）の独立計算
            let guaranteedResult = null;
            if (config._suffix !== '') {
                const normalCount = config._guaranteedNormalRolls;
                // logic.js で定義した線形連続・排出ベース判定の専用関数を呼び出す
                guaranteedResult = calculateSequentialGuaranteed(i, config, seeds, drawContext, normalCount);
                
                // 【検算】11連内部の1枚目のロール結果が、通常の計算結果と一致するか検証
                if (guaranteedResult.normalRollsResults && guaranteedResult.normalRollsResults.length > 0) {
                    const firstRollInG = guaranteedResult.normalRollsResults[0];
                    guaranteedResult.isVerified = (firstRollInG.finalChar.id === rollResult.finalChar.id);
                }
            }

            // データを保存
            tableData[i][colIndex] = { 
                gachaId: config.id, 
                roll: rollResult,
                guaranteed: guaranteedResult
            };

            // 次の計算用状態
            const nextState = {
                rarity: rollResult.rarity,
                charId: rollResult.charId,
                originalCharId: rollResult.originalChar ? rollResult.originalChar.id : rollResult.charId,
                isRerolled: rollResult.isRerolled
            };

            // リロール発生時はジャンプ先を予約
            if (rollResult.isRerolled) {
                landingMap.set(i + rollResult.seedsConsumed, nextState);
            }

            // 垂直遷移状態を更新
            if (isTrackB) {
                lastDrawB = { ...nextState, isRerolled: false };
            } else {
                lastDrawA = { ...nextState, isRerolled: false };
            }
        }
    });
    return tableData;
}
