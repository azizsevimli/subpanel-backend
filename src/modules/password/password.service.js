const prisma = require("../../config/prisma");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

function sha256(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
}

function makeToken() {
    // linkte taşıyacağımız raw token
    return crypto.randomBytes(32).toString("hex");
}

async function createResetTokenForEmail(email) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Güvenlik: email yoksa bile aynı response dön (user enumeration engeli)
    if (!user) return { ok: true, resetUrl: null };

    // Eski aktif tokenları iptal etmek iyi pratik
    await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
    });

    const rawToken = makeToken();
    const tokenHash = sha256(rawToken);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 dk

    await prisma.passwordResetToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt,
        },
    });

    // Frontend reset sayfası linki:
    const base = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${base}/reset-password?token=${rawToken}`;

    return { ok: true, resetUrl };
}

async function resetPasswordWithToken({ token, newPassword }) {
    if (!token) {
        const e = new Error("TOKEN_REQUIRED");
        e.code = "TOKEN_REQUIRED";
        throw e;
    }

    if (!newPassword || String(newPassword).length < 6) {
        const e = new Error("WEAK_PASSWORD");
        e.code = "WEAK_PASSWORD";
        throw e;
    }

    const tokenHash = sha256(String(token));
    const now = new Date();

    const record = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
    });

    if (!record) {
        const e = new Error("INVALID_TOKEN");
        e.code = "INVALID_TOKEN";
        throw e;
    }

    if (record.usedAt) {
        const e = new Error("TOKEN_USED");
        e.code = "TOKEN_USED";
        throw e;
    }

    if (record.expiresAt.getTime() <= now.getTime()) {
        const e = new Error("TOKEN_EXPIRED");
        e.code = "TOKEN_EXPIRED";
        throw e;
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: record.userId },
            data: { password: hashedPassword },
        });

        await tx.passwordResetToken.update({
            where: { id: record.id },
            data: { usedAt: new Date() },
        });
    });

    return { ok: true };
}

module.exports = {
    createResetTokenForEmail,
    resetPasswordWithToken,
};
