const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel.js");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

dotenv.config();

const router = express.Router();

// 🔐 Signup Route
router.post("/user/signup", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      return res.status(201).json({
        message: "User registered successfully. Please log in to continue.",
      });
    } else {
      return res.status(400).json({
        message: "Invalid user data",
      });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// 🔐 Sign-in Route
router.post("/user/signin", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, isLogged: true},
      process.env.SECRET_KEY,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      token,
      username: user.username,
      role: user.role,
      userId: user._id,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({ message: error.message });
  }
});

// ✉️ Email Transporter Config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

// 🧪 Transporter Test (optional but helpful)
transporter.verify((error, success) => {
  if (error) {
    console.error("Email transporter config error:", error);
  } else {
    console.log("Email transporter ready to send ✉️");
  }
});

// 🔁 Forgot Password
router.post("/user/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const mailOptions = {
      to: user.email,
      from: process.env.ADMIN_EMAIL,
      subject: "Password Reset",
      text: `You are receiving this because you (or someone else) requested a password reset.\n\nClick here to reset:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    console.error("Error in /user/forgot-password:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 🔄 Reset Password
router.post("/user/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const decodedToken = decodeURIComponent(token);
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: decodedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error in /user/reset-password:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
