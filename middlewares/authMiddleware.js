const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const isAuthenticated = async (request, response, next) => {
  let token;

  if (
    request.headers.authorization &&
    request.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = request.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.SECRET_KEY);

      request.user = await User.findById(decoded.userId).select("-password");

      if (!request.user) {
        return response.status(404).json({
          message: "User not found. Invalid token.",
        });
      }

      next();
    } catch (error) {
      console.error("Token verification failed:", error);
      return response.status(401).json({
        message: "Invalid or expired token.",
      });
    }
  } else {
    return response.status(401).json({
      message: "Token missing or improperly formatted.",
    });
  }
};

module.exports = isAuthenticated;
