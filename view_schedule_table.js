/** @file view_schedule_table.js @description リスト形式のスケジュール表描画 */

function renderScheduleTable(tsvContent, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const data = parseGachaTSV(tsvContent);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayInt = getDateInt(yesterday);
    
    let filteredData = data.filter(item => parseInt(item.rawEnd) >= yesterdayInt);
    // フィルタ: 終了分の非表示設定
    if (hideEndedSchedules) {
        filteredData = filteredData.filter(item => {
            const endDt = parseDateTime(item.rawEnd, item.endTime);
            return now <= endDt;
        });
    }

    // ソート順：開催終了分を最優先 -> 通常ガチャ（日付順） -> プラチナ（日付順） -> レジェンド（日付順）
    filteredData.sort((a, b) => {
        const endA = parseDateTime(a.rawEnd, a.endTime);
        const endB = parseDateTime(b.rawEnd, b.endTime);
        const isEndedA = now > endA;
        const isEndedB = now > endB;

        if (isEndedA !== isEndedB) return isEndedA ? -1 : 1;

        const getTypeOrder = (item) => {
            const name = (item.seriesName + (item.tsvName || "")).replace(/\s/g, "");
            if (name.includes("プラチナ")) return 1;
            if (name.includes("レジェンド")) return 2;
            return 0; 
        };

        const orderA = getTypeOrder(a);
        const orderB = getTypeOrder(b);

        if (orderA !== orderB) return orderA - orderB;
        return parseInt(a.rawStart) - parseInt(b.rawStart);
    });

    const ganttHtml = renderGanttChart(data);
    const hideBtnClass = hideEndedSchedules ? 'text-btn active' : 'text-btn';
    
    // 設定：通常 16px、最小 13px に維持（!important で外部CSSの 10px 指定をガード）
    const fontSizeResponsive = "clamp(13px, 2vw, 16px) !important";

    let html = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
            <h3 style="margin:0; font-size: 20px;">開催スケジュール</h3>
            <span onclick="toggleHideEnded()" class="${hideBtnClass}" style="font-size: 15px; padding: 4px 10px;">終了分を非表示</span>
        </div>
        ${ganttHtml}
        <div style="margin-top: 20px;"></div>
        <div class="schedule-scroll-wrapper" style="overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; border: 1px solid #ccc; border-radius: 6px;">
        <table class="schedule-table" style="width: auto; min-width: 100%; table-layout: auto; font-size: ${fontSizeResponsive}; border-collapse: collapse; line-height: 1.5; background: #fff;">
        <thead>
            <tr style="background-color: #f8f9fa;">
                <th style="padding: 10px 8px !important; border: 1px solid #ddd; font-weight: bold;">自</th>
                <th style="padding: 10px 8px !important; border: 1px solid #ddd; font-weight: bold;">至</th>
                <th style="padding: 10px 15px !important; border: 1px solid #ddd; font-weight: bold; text-align: left;">ガチャ名 / 詳細</th>
                <th style="padding: 10px 8px !important; border: 1px solid #ddd;">レア</th>
                <th style="padding: 10px 8px !important; border: 1px solid #ddd;">激レア</th>
                <th style="padding: 10px 8px !important; border: 1px solid #ddd;">超激</th>
                <th style="padding: 10px 8px !important; border: 1px solid #ddd;">伝説</th>
                <th style="padding: 10px 8px !important; border: 1px solid #ddd;">確定</th>
            </tr>
        </thead>
        <tbody>
    `;

    filteredData.forEach((item, index) => {
        let seriesDisplay = item.seriesName ? item.seriesName : "シリーズ不明";
        if (item.guaranteed) seriesDisplay += " [確定]";

        const startStr = `${formatDateJP(item.rawStart)}<br><span style="color:#555; font-weight: normal;">${formatTime(item.startTime)}</span>`;
        const endDateFormatted = formatDateJP(item.rawEnd);
        let endStr = endDateFormatted;

        const isPlat = item.seriesName.includes("プラチナ");
        const isLeg = item.seriesName.includes("レジェンド");
        let isAppliedNextStart = false;

        if (isPlat || isLeg) {
            const nextSameType = filteredData.slice(index + 1).find(nextItem => {
                if (isPlat) return nextItem.seriesName.includes("プラチナ");
                if (isLeg) return nextItem.seriesName.includes("レジェンド");
                return false;
            });

            if (nextSameType) {
                if (parseInt(nextSameType.rawStart) < yesterdayInt) return;
                endStr = `${formatDateJP(nextSameType.rawStart)}<br><span style="color:#555; font-weight: normal;">${formatTime(nextSameType.startTime)}</span>`;
                isAppliedNextStart = true;
            }
        }

        if (!isAppliedNextStart && endDateFormatted !== '永続') {
            endStr += `<br><span style="color:#555; font-weight: normal;">${formatTime(item.endTime)}</span>`;
        }
        
        const isPlatLeg = isPlatinumOrLegend(item);
        const uberRateVal = parseInt(item.uber);
        let uberStyle = ( !isPlatLeg && uberRateVal !== 500 ) ? 'color:red; font-weight:bold;' : '';
        const legendRateVal = parseInt(item.legend);
        let legendStyle = ( !isPlatLeg && legendRateVal > 30 ) ? 'color:red; font-weight:bold;' : '';
        const endDateTime = parseDateTime(item.rawEnd, item.endTime);
        
        let rowClass = (now > endDateTime) ? "row-ended" : (item.guaranteed ? "row-guaranteed" : "");
        let rowStyle = "";
        if (now > endDateTime) rowStyle = "background-color: #fcfcfc; color: #999;";
        else if (item.guaranteed) rowStyle = "background-color: #fffff4;";

        html += `
            <tr class="${rowClass}" style="${rowStyle}">
                <td style="white-space: nowrap; padding: 10px 8px !important; border: 1px solid #ddd; text-align: center; vertical-align: middle; font-weight: bold;">${startStr}</td>
                <td style="white-space: nowrap; padding: 10px 8px !important; border: 1px solid #ddd; text-align: center; vertical-align: middle; font-weight: bold;">${endStr}</td>
                <td style="text-align:left; vertical-align: middle; white-space: normal; word-break: break-all; padding: 12px 15px !important; border: 1px solid #ddd;">
                    <div style="font-weight:bold; color:#000; line-height: 1.4; margin-bottom: 4px;">${seriesDisplay}</div>
                    <div style="color:#777; margin-bottom: 6px; font-size: 0.95em;">(ID: ${item.id})</div>
                    <div style="color:#333; line-height: 1.5; border-top: 1px solid #eee; padding-top: 6px;">${item.tsvName}</div>
                </td>
                <td style="text-align:center; padding: 10px 8px !important; border: 1px solid #ddd; vertical-align: middle;">${fmtRate(item.rare)}</td>
                <td style="text-align:center; padding: 10px 8px !important; border: 1px solid #ddd; vertical-align: middle;">${fmtRate(item.supa)}</td>
                <td style="text-align:center; padding: 10px 8px !important; border: 1px solid #ddd; vertical-align: middle; ${uberStyle}">${fmtRate(item.uber)}</td>
                <td style="text-align:center; padding: 10px 8px !important; border: 1px solid #ddd; vertical-align: middle; ${legendStyle}">${fmtRate(item.legend)}</td>
                <td style="text-align:center; padding: 10px 8px !important; border: 1px solid #ddd; vertical-align: middle;">
                    ${item.guaranteed ? '<span style="color:red; font-size: 22px; line-height:1;">●</span>' : '-'}
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}