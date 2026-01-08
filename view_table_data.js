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

        // マスタデータから設定を取得
        const configSource = gachaMasterData.gachas[idWithSuffix] || gachaMasterData.gachas[baseId];
        if (!configSource) return null;

        const config = JSON.parse(JSON.stringify(configSource));
        config._guaranteedNormalRolls = guaranteedNormalRolls;
        config._suffix = suffix;
        
        // 超激レア追加シミュレーション設定 (add)
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
 * 通常ロールの計算に加え、各地点からの確定枠シミュレーションを完全に独立して行う
 */
function executeTableSimulation(numRolls, columnConfigs, seeds) {
    const tableData = Array(numRolls * 2).fill(null).map(() => []);
    
    columnConfigs.forEach((config, colIndex) => {
        if (!config) return;

        // 列ごとに状態を管理するための一時保存用Map（リロール着地用）
        const landingMap = new Map(); 
        let lastDrawA = null; // A側の垂直遷移用
        let lastDrawB = null; // B側の垂直遷移用

        for (let i = 0; i < numRolls * 2; i++) {
            if (i >= seeds.length) break;

            const isTrackB = (i % 2 !== 0);
            let drawContext = null;
            
            // 履歴（ジャンプ着地または垂直遷移）の取得
            if (landingMap.has(i)) {
                // リロールによって着地した場合
                drawContext = { ...landingMap.get(i), fromRerollRoute: true };
            } else {
                // 通常の垂直遷移の場合
                let verticalInfo = isTrackB ? lastDrawB : lastDrawA;
                if (verticalInfo) {
                    drawContext = { ...verticalInfo, fromRerollRoute: false };
                }
            }

            // 1. 通常ロールの抽選（表示および垂直遷移用）
            // 第5引数 useStrictFinalId = false（表示用に再抽選前IDも保持するモード）
            const rollResult = rollWithSeedConsumptionFixed(i, config, seeds, drawContext, false);
            
            // 2. 確定枠（11G等）の独立計算
            let guaranteedResult = null;
            if (config._suffix !== '') {
                const normalCount = config._guaranteedNormalRolls;
                // logic.js で定義した「線形連続・排出後ベース判定」の専用関数を呼び出す
                guaranteedResult = calculateSequentialGuaranteed(i, config, seeds, drawContext, normalCount);
                
                // 【検算】11連内部の1枚目のロール結果が、通常のシミュレーション結果と一致するか検証
                if (guaranteedResult.normalRollsResults && guaranteedResult.normalRollsResults.length > 0) {
                    const firstRollInG = guaranteedResult.normalRollsResults[0];
                    // 実際のキャラID（再抽選後）が一致していればOK
                    guaranteedResult.isVerified = (String(firstRollInG.finalChar.id) === String(rollResult.finalChar.id));
                }
            }

            // セルデータとして保存
            tableData[i][colIndex] = { 
                gachaId: config.id, 
                roll: rollResult,
                guaranteed: guaranteedResult // 独立計算された確定枠データ
            };

            // 垂直方向の次回計算用に現在の状態を構築
            const nextState = {
                rarity: rollResult.rarity,
                charId: rollResult.charId,
                originalCharId: rollResult.originalChar ? rollResult.originalChar.id : rollResult.charId,
                isRerolled: rollResult.isRerolled
            };

            // 今回の通常ロールでリロールが発生した場合は、ジャンプ先に状態を予約
            if (rollResult.isRerolled) {
                landingMap.set(i + rollResult.seedsConsumed, nextState);
            }

            // トラックごとの垂直遷移状態を更新（isRerolledはリセットする）
            if (isTrackB) {
                lastDrawB = { ...nextState, isRerolled: false };
            } else {
                lastDrawA = { ...nextState, isRerolled: false };
            }
        }
    });
    return tableData;
}