const express = require("express");
const router = express.Router();
const fetchWithRetry = require("../utils/fetchWithRetry");
require("dotenv").config();
const Recipe = require("../models/Recipe");
const isAuthenticated = require("../middlewares/authMiddleware");

router.get("/recipeStream", async (req, res) => {
  try {
    const {
      ingredients,
      mealType,
      cuisine,
      cookingTime,
      complexity,
      servingNumber,
      dietary,
      userId,
    } = req.query;

    if (!ingredients) throw new Error("Ingredients parameter is required");
    if (!servingNumber) throw new Error("Serving number parameter is required");
    if (!userId) throw new Error("User ID is required");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const prompt = [
      "You are a professional chef. Generate a complete recipe with the following parameters:",
      `- Ingredients to use: ${ingredients}`,
      `- Meal type: ${mealType || "any"}`,
      `- Cuisine style: ${cuisine || "any"}`,
      `- Cooking time: ${cookingTime || "flexible"}`,
      `- Difficulty level: ${complexity || "moderate"}`,
      `- Dietary preferences: ${dietary || "any"}`,
      `- NUMBER OF SERVINGS: ${servingNumber}`,
      `>>> THE RECIPE MUST BE FOR EXACTLY ${servingNumber} SERVINGS.`,
      `>>> SCALE ALL INGREDIENT QUANTITIES TO MATCH ${servingNumber} SERVINGS — NO EXCEPTIONS.`,
      ">>> DO NOT default to 2 or 4 servings under any condition.",
      `>>> Label the ingredients section as: '## Ingredients (Serves ${servingNumber})'`,
      ">>> Do NOT include any other serving number anywhere in the recipe.",
      ">>> NO NOTE should suggest that the serving size is flexible.",
      "Include the following sections:",
      "## Recipe Name (creative, in English)",
      "## Description (1–2 lines)",
      "## Ingredients (with exact quantities, scaled for the number of servings)",
      "## Instructions (step-by-step, concise but clear)",
      "## Tips (serving or cooking suggestions)",
      "Use only the ingredients listed. Format the entire output clearly in markdown.",
    ].join("\n");

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const apiResponse = await fetchWithRetry(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          topP: 0.9,
          maxOutputTokens: 1500,
        },
      }),
    });

    const data = await apiResponse.json();
    const recipe = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!recipe) throw new Error("Received empty response from API");
    // console.log("USER ID >>>", userId);
    // console.log("Generated recipe:", recipe);
    // Save recipe to MongoDB
    await Recipe.create({
      userId,
      ingredients,
      mealType,
      cuisine,
      cookingTime,
      complexity,
      servingNumber,
      dietary,
      resultText: recipe,
    });

    const chunkSize = 80;
    for (let i = 0; i < recipe.length; i += chunkSize) {
      const chunk = recipe.slice(i, i + chunkSize);
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    res.write(`data: ${JSON.stringify({ action: "close" })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Server error:", error);
    res.write(
      `data: ${JSON.stringify({
        error: "Failed to generate recipe",
        details: error.message.replace(GEMINI_API_KEY, "REDACTED"),
      })}\n\n`
    );
    res.end();
  }
});

router.get("/recipes/saved-recipes", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id; // Use `req.user._id` instead of `request.user.id`
    const saved_recipe = await Recipe.find({ userId });
    console.log("Recipe:", saved_recipe); // Debugging
    res.json(saved_recipe || []);
  } catch (error) {
    console.error("Error fetching your recipes:", error);
    res.status(500).json({ error: "Server Error", items: [] });
  }
});
router.delete("/recipes/:id", isAuthenticated, async (req, res) => {
  console.log("DELETE /recipes", req.params.id); 
  try {
    const deletedItem = await Recipe.deleteOne({ _id: req.params.id });
    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting item", error: err });
  }
});
router.get("/recipes/:id", isAuthenticated, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: "recipe not found" });
    }
    res.status(200).json(recipe);
  } catch (err) {
    res.status(500).json({ message: "Error fetching recipe", error: err });
  }
});
module.exports = router;
