const mongoose = require('mongoose');

const RecipeSchema = new mongoose.Schema({
  ingredients: String,
  mealType: String,
  cuisine: String,
  cookingTime: String,
  complexity: String,
  dietary: String,
  servingNumber: String,
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

module.exports = mongoose.model('Recipe', RecipeSchema);
