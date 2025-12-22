/** @file view_schedule_utils.js @description スケジュール表示の共通設定とユーティリティ */

// 表示状態管理用の変数
if (typeof hideEndedSchedules === 'undefined') {
    window.hideEndedSchedules = false;
}

/** 終了分の表示/非表示を切り替えて再描画 */
function toggleHideEnded() {
    hideEndedSchedules = !hideEndedSchedules;
    if (typeof loadedTsvContent !== 'undefined' && loadedTsvContent) {
        // 再描画を実行
        renderScheduleTable(loadedTsvContent, 'schedule-container');
    }
}

/** 文字列の表示幅を概算する関数 (動的幅調整用) */
function calcTextWidth(text) {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        // 半角文字(ASCII範囲)は約8px、それ以外(全角)は約13pxと仮定
        if ((code >= 0x00 && code < 0x81) || (code === 0xf8f0) || (code >= 0xff61 && code < 0xffa0) || (code >= 0xf8f1 && code < 0xf8f4)) {
            width += 8;
        } else {
            width += 13;
        }
    }
    return width;
}

/** 確率のフォーマット (30 -> 0.3%) */
function fmtRate(val) {
    if (!val) return "0%";
    return (parseInt(val) / 100) + "%";
}

/** ガントチャートを画像として全体保存（右側余白・見切れ対策版） */
function saveGanttImage() {
    const element = document.querySelector('.gantt-chart-container');
    const scrollWrapper = document.querySelector('.gantt-scroll-wrapper');
    if (!element || !scrollWrapper) return;
    
    // インラインスタイルで厳密に計算された「コンテンツの全幅」を取得
    const computedStyle = window.getComputedStyle(element);
    const contentWidthPx = parseFloat(computedStyle.width);

    // 1. 元のスタイルを一時保存
    const originalOverflow = element.style.overflow;
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalWrapperOverflow = scrollWrapper.style.overflow;
    const originalWrapperWidth = scrollWrapper.style.width;

    // 2. sticky要素（ガチャ名ラベルやヘッダー）の固定を一時解除
    // html2canvasはstickyを解釈できず、スクロール位置によって空白やズレが生じるため
    const stickyElements = element.querySelectorAll('.gantt-label-col, .gantt-header, .gantt-date-cell');
    const originalStickyStyles = [];
    stickyElements.forEach(el => {
        originalStickyStyles.push({ el: el, position: el.style.position });
        el.style.position = 'static'; 
    });

    // 3. キャプチャ用に要素を全幅まで強制展開（スクロールバーを消し、全域をレンダリング対象にする）
    element.style.overflow = 'visible';
    element.style.width = contentWidthPx + 'px';
    element.style.maxWidth = 'none';
    scrollWrapper.style.overflow = 'visible';
    scrollWrapper.style.width = contentWidthPx + 'px';
    
    // 4. html2canvasで保存（キャンバス幅をコンテンツ幅に固定して余白をトリミング）
    html2canvas(element, {
        width: contentWidthPx,      // 画像の切り出し幅をコンテンツ幅に限定
        windowWidth: contentWidthPx, // レンダリング基準幅をコンテンツ幅に同期
        scale: 2,                   // 高解像度（Retina対応）
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
    }).then(canvas => {
        // 画像としてダウンロード
        const link = document.createElement('a');
        link.download = `gacha_schedule_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // 5. 元の表示スタイルを復元
        restoreStyles();
    }).catch(err => {
        console.error("Image capture failed:", err);
        alert("画像の保存に失敗しました。");
        restoreStyles();
    });

    function restoreStyles() {
        element.style.overflow = originalOverflow;
        element.style.width = originalWidth;
        element.style.maxWidth = originalMaxWidth;
        scrollWrapper.style.overflow = originalWrapperOverflow;
        scrollWrapper.style.width = originalWrapperWidth;
        originalStickyStyles.forEach(item => {
            item.el.style.position = item.position;
        });
    }
}