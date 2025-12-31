const prisma = require("../../config/prisma");
const bcrypt = require("bcrypt");

async function listUsers(req, res) {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                surname: true,
                role: true,
                createdAt: true,
            },
            orderBy: {
                id: "asc",
            },
        });

        return res.status(200).json({ users });
    } catch (err) {
        console.error("Admin listUsers error:", err);
        return res.status(500).json({ message: "Kullanıcılar alınırken bir hata oluştu." });
    }
}

async function createAdmin(req, res) {
    try {
        const { email, password, name, surname } = req.body;

        if (!email || !password || !name) {
            return res
                .status(400)
                .json({ message: "Name, email ve şifre zorunludur." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                surname,
                role: "ADMIN",
            },
            select: {
                id: true,
                email: true,
                name: true,
                surname: true,
                role: true,
            },
        });

        return res.status(201).json({ user });
    } catch (err) {
        console.error("Admin createAdmin error:", err);

        if (err.code === "P2002") {
            return res
                .status(409)
                .json({ message: "Bu email adresi zaten kayıtlı." });
        }

        return res
            .status(500)
            .json({ message: "Admin oluşturulurken bir hata oluştu." });
    }
}

module.exports = {
    listUsers,
    createAdmin,
};
