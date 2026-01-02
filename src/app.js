const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const path = require("path");

const prisma = require("./config/prisma");
const authMiddleware = require("./middlewares/authMiddleware");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const adminPlatformRoutes = require("./routes/admin.platforms");
const adminUploadRoutes = require("./routes/admin.uploads");
const platformsPublicRoutes = require("./routes/platforms");
const subscriptionRoutes = require("./routes/subscriptions");
const dashboardRoutes = require("./routes/dashboard");
const calendarRoutes = require("./routes/calendar");
const passwordRoutes = require("./routes/password");
const settingsRoutes = require("./routes/settings");

const app = express();

app.use(helmet());
app.use(
    cors({
        origin: "http://localhost:3000",
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/platforms", adminPlatformRoutes);
app.use("/api/admin/uploads", adminUploadRoutes);
app.use("/api/platforms", platformsPublicRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/api/health", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        return res.status(200).json({
            status: "ok",
            message: "Backend çalışıyor",
            database: "connected",
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Health check error:", err);

        return res.status(500).json({
            status: "error",
            message: "Backend çalışıyor ancak veritabanı bağlantısında sorun var",
            database: "disconnected",
            timestamp: new Date().toISOString()
        });
    }
});

app.get("/api/me", authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                surname: true,
                role: true,
            },
        });

        if (!user) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı" });
        }

        return res.status(200).json({
            user,
        });
    } catch (err) {
        console.error("ME endpoint error:", err);
        return res.status(500).json({ message: "Sunucu hatası" });
    }
});

module.exports = app;
