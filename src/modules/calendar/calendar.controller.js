// src/modules/calendar/calendar.controller.js
const service = require("./calendar.service");

function isValidYmd(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

async function getEvents(req, res) {
    try {
        const userId = req.user.id;

        const from = String(req.query.from || "").trim();
        const to = String(req.query.to || "").trim();

        if (!from || !to) {
            return res.status(400).json({ message: "from ve to zorunludur. (YYYY-MM-DD)" });
        }

        if (!isValidYmd(from) || !isValidYmd(to)) {
            return res.status(400).json({ message: "from/to formatı YYYY-MM-DD olmalıdır." });
        }

        const items = await service.getCalendarEvents({ userId, from, to });

        return res.status(200).json({ items });
    } catch (err) {
        console.error("Calendar events error:", err);

        if (err.code === "INVALID_RANGE") {
            return res.status(400).json({ message: "Geçersiz tarih aralığı. (YYYY-MM-DD)" });
        }

        return res.status(500).json({ message: "Takvim eventleri alınırken hata oluştu." });
    }
}

module.exports = { getEvents };
