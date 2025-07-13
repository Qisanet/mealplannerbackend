const mongoose = require("mongoose");

const MealPlanSchema = new mongoose.Schema({
  age: String,
  goalAndAspiration: String,
  weight: String,
  height: String,
  sex: String,
  diet: String,
  mealCountPerDay: String,
  anyAllergies: String,
  resultText: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Assuming your user model is called "User"
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Meal", MealPlanSchema);
