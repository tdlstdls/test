// --- view-uncompleted.js ---

function createAndDisplayUncompletedSeedView(initialSeed, gacha, tableRows, thresholds, initialLastRollId, displaySeed, params) {
    // 1. データ計算 (Logic)
    const { 
        Nodes, highlightInfo, maxNodes, singleRoutePath, 
        tenPullCyclesData, expectedFeaturedCounts 
    } = calculateUncompletedData(initialSeed, gacha, tableRows, thresholds, initialLastRollId, params);
    
    // デバッグ出力
    console.log("Uncompleted Data Calculated:", { Nodes: Nodes.length, tenPullCyclesData, expectedFeaturedCounts });

    // パラメータ取得
    const ngVal = parseInt(params.get('ng'), 10);
    const initialFs = parseInt(params.get('fs'), 10) || 0; 
    const guaranteedCycle = gacha.guaranteedCycle || 30;
    let initialNg = !isNaN(ngVal) && ngVal > 0 ? ngVal : guaranteedCycle;

    // 2. 詳細画面 (Debug View) のレンダリング
    renderUncompletedDetails(Nodes, highlightInfo, maxNodes, tenPullCyclesData, gacha, initialLastRollId, params);

    // 3. メインテーブル (Main View) のレンダリング
    // 注意: view-uncompleted-table.js 内の関数です。元の view-uncompleted.js の複雑なリンク生成ロジックは
    // そちらに移動している前提です。
    renderUncompletedMainTable(Nodes, highlightInfo, tenPullCyclesData, expectedFeaturedCounts, tableRows, displaySeed, initialNg, initialFs, guaranteedCycle);

    // 4. 詳細表示トグルの制御
    const detailsDiv = document.getElementById('calculation-details');
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