const prisma = require("../../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

function generateAccessToken(userId, role) {
    return jwt.sign(
        { userId, role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
    );
}

function generateRefreshToken(userId, role) {
    return jwt.sign(
        { userId, role },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
    );
}

async function register({ email, password, name, surname }) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name,
            surname,
        },
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            role: user.role,
        },
    };
}

async function login({ email, password }) {
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        const error = new Error("INVALID_CREDENTIALS");
        error.code = "INVALID_CREDENTIALS";
        throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        const error = new Error("INVALID_CREDENTIALS");
        error.code = "INVALID_CREDENTIALS";
        throw error;
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            role: user.role,
        },
    };
}


async function getUserById(id) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            surname: true,
            role: true,
        },
    });
}

module.exports = {
    register,
    login,
    getUserById,
    generateAccessToken,
    generateRefreshToken,
};
