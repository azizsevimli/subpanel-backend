const prisma = require("../../config/prisma");

function isValidDateString(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseYmdToUtcDate(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function toYmdUtc(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function startOfDayUtc(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
}

function daysInMonthUtc(year, monthIndex0) {
    return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

// ✅ Ay/Yıl ekleme: gün yoksa ayın son gününe clamp
function addMonthsClampUtc(dateUtc, months) {
    const y = dateUtc.getUTCFullYear();
    const m0 = dateUtc.getUTCMonth();
    const d = dateUtc.getUTCDate();

    const targetMonthIndex = m0 + months;
    const targetYear = y + Math.floor(targetMonthIndex / 12);
    const targetMonth0 = ((targetMonthIndex % 12) + 12) % 12;

    const dim = daysInMonthUtc(targetYear, targetMonth0);
    const day = Math.min(d, dim);

    return new Date(Date.UTC(targetYear, targetMonth0, day, 0, 0, 0));
}

function addYearsClampUtc(dateUtc, years) {
    const y = dateUtc.getUTCFullYear() + years;
    const m0 = dateUtc.getUTCMonth();
    const d = dateUtc.getUTCDate();

    const dim = daysInMonthUtc(y, m0);
    const day = Math.min(d, dim);

    return new Date(Date.UTC(y, m0, day, 0, 0, 0));
}

function addDaysUtc(dateUtc, days) {
    const d = new Date(dateUtc);
    d.setUTCDate(d.getUTCDate() + days);
    return startOfDayUtc(d);
}

function inRangeUtc(dateUtc, fromUtc, toUtc) {
    return dateUtc.getTime() >= fromUtc.getTime() && dateUtc.getTime() <= toUtc.getTime();
}

function clampByEndDate(endDate, candidateUtc) {
    if (!endDate) return candidateUtc;
    const endUtc = startOfDayUtc(endDate);
    return candidateUtc.getTime() <= endUtc.getTime() ? candidateUtc : null;
}

function buildEventId(type, subscriptionId, ymd) {
    return `${type}:${subscriptionId}:${ymd}`;
}

async function getCalendarEvents({ userId, from, to }) {
    if (!isValidDateString(from) || !isValidDateString(to)) {
        const e = new Error("INVALID_RANGE");
        e.code = "INVALID_RANGE";
        throw e;
    }

    const fromUtc = parseYmdToUtcDate(from);
    const toUtc = parseYmdToUtcDate(to);

    const subs = await prisma.subscription.findMany({
        where: {
            userId,
            status: { in: ["ACTIVE", "PAUSED"] },
        },
        select: {
            id: true,
            status: true,
            repeatUnit: true,
            repeatInterval: true,
            startDate: true,
            endDate: true,
            amount: true,
            currency: true,
            platform: { select: { id: true, name: true, logoUrl: true } },
        },
    });

    const events = [];

    for (const s of subs) {
        // startDate zorunlu; ama DB’de eski kayıtlar kalmış olabilir diye koruyalım
        if (!s.startDate) continue;

        const platformName = s.platform?.name || "Platform";
        const amount = s.amount;
        const currency = s.currency || "";

        const startUtc = startOfDayUtc(s.startDate);
        const endDate = s.endDate ? startOfDayUtc(s.endDate) : null;

        // START event
        if (inRangeUtc(startUtc, fromUtc, toUtc)) {
            const ymd = toYmdUtc(startUtc);
            events.push({
                id: buildEventId("START", s.id, ymd),
                type: "START",
                subscriptionId: s.id,
                date: ymd,
                title: `${platformName} • Start`,
                status: s.status,
                amount,
                currency,
                platform: s.platform,
            });
        }

        const unit = s.repeatUnit || "MONTH";
        const interval = Number.isInteger(s.repeatInterval) && s.repeatInterval > 0 ? s.repeatInterval : 1;

        // İlk renewal: startDate + interval
        const addInterval = (d) =>
            unit === "YEAR" ? addYearsClampUtc(d, interval) : addMonthsClampUtc(d, interval);

        // renewal günlerini aralığa yaklaştır:
        // cursor = firstRenewal
        let cursor = addInterval(startUtc);

        // from'dan önceyse ileri sar
        // (çok uzun geçmişe gitmemek için güvenlik limiti koyuyoruz)
        let guard = 0;
        while (cursor.getTime() < fromUtc.getTime() && guard < 240) { // max 240 adım
            cursor = addInterval(cursor);
            guard++;
        }

        guard = 0;
        while (cursor.getTime() <= toUtc.getTime() && guard < 240) {
            const bounded = clampByEndDate(endDate, cursor);
            if (!bounded) break;

            if (inRangeUtc(bounded, fromUtc, toUtc)) {
                const ymd = toYmdUtc(bounded);
                events.push({
                    id: buildEventId("RENEWAL", s.id, ymd),
                    type: "RENEWAL",
                    subscriptionId: s.id,
                    date: ymd,
                    title: `${platformName} • Renewal`,
                    status: s.status,
                    amount,
                    currency,
                    platform: s.platform,
                });

                // İstersen dönem bitişini de event olarak ekleyebilirsin:
                // periodEnd = renewal - 1 gün
                // const periodEnd = addDaysUtc(bounded, -1);
                // ...
            }

            cursor = addInterval(cursor);
            guard++;
        }
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    return events;
}

module.exports = { getCalendarEvents };
