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

/** ガントチャートを画像として全体保存（デスクトップレイアウトを強制適用する版） */
function saveGanttImage() {
    const element = document.querySelector('.gantt-chart-container');
    const scrollWrapper = document.querySelector('.gantt-scroll-wrapper');
    if (!element || !scrollWrapper) return;

    // 1. デスクトップ表示用のスタイルを一時的に注入
    const styleOverride = document.createElement('style');
    styleOverride.id = 'gantt-save-override';
    styleOverride.innerHTML = `
        .gantt-label-col { 
            width: 160px !important; 
            min-width: 160px !important; 
            font-size: 12px !important; 
            line-height: 30px !important; 
            padding: 0 5px !important;
        }
        .gantt-row { height: 30px !important; }
        .gantt-bar { 
            height: 20px !important; 
            top: 5px !important; 
            font-size: 10px !important; 
        }
        .gantt-date-cell { 
            width: 50px !important;
            font-size: 10px !important; 
        }
        .gantt-header { height: 30px !important; }
    `;
    document.head.appendChild(styleOverride);
    
    // 2. 全体の要素情報を取得
    const containerRect = element.getBoundingClientRect();
    const bars = element.querySelectorAll('.gantt-bar');
    
    // 3. 最も右にあるバーの終端位置を探す
    let maxBarRightEdge = 0;
    bars.forEach(bar => {
        const rect = bar.getBoundingClientRect();
        const relativeRight = rect.right - containerRect.left;
        if (relativeRight > maxBarRightEdge) {
            maxBarRightEdge = relativeRight;
        }
    });

    // 4. 切り出し幅の決定 (バーの終端 + 余白)
    const buffer = 40;
    const finalCropWidth = maxBarRightEdge > 0 ? maxBarRightEdge + buffer : element.offsetWidth;

    // 5. スタイルの保存と一時変更
    const originalOverflow = element.style.overflow;
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalWrapperOverflow = scrollWrapper.style.overflow;
    const originalWrapperWidth = scrollWrapper.style.width;

    const stickyElements = element.querySelectorAll('.gantt-label-col, .gantt-header, .gantt-date-cell');
    const originalStickyStyles = [];
    stickyElements.forEach(el => {
        originalStickyStyles.push({ el: el, position: el.style.position });
        el.style.position = 'static'; // キャプチャ用に固定解除
    });

    // 全域レンダリングのために一時的に制限解除
    element.style.overflow = 'visible';
    element.style.maxWidth = 'none';
    scrollWrapper.style.overflow = 'visible';

    // 6. html2canvasで指定した幅（デスクトップ基準）をキャプチャ
    html2canvas(element, {
        width: finalCropWidth,
        windowWidth: 1200, // デスクトップ相当のウィンドウ幅として計算
        scale: 2,          // 高画質
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `gacha_schedule_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        restoreStyles();
    }).catch(err => {
        console.error("Image capture failed:", err);
        alert("画像の保存に失敗しました。");
        restoreStyles();
    });

    function restoreStyles() {
        // 注入したスタイルを削除
        const override = document.getElementById('gantt-save-override');
        if (override) override.remove();

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