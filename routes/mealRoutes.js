const express = require("express");
const router = express.Router();
const fetchWithRetry = require("../utils/fetchWithRetry");
const isAuthenticated = require("../middlewares/authMiddleware");
require("dotenv").config();
const Meal = require("../models/meal");

router.get("/mealStream", async (req, res) => {
  try {
    const {
      age,
      goalAndAspiration,
      weight,
      height,
      sex,
      diet,
      mealCountPerDay,
      anyAllergies,
      userId,
    } = req.query;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const prompt = [
      "You are a professional chef and certified nutritionist.",
      "Create a personalized meal plan for ONE DAY based on the following user profile:",
      "",
      `- Age: ${age}`,
      `- Weight: ${weight} kg`,
      `- Height: ${height} cm`,
      `- Sex: ${sex}`,
      `- Goal: ${goalAndAspiration}`,
      `- Diet type: ${diet}`,
      `- Meals per day: ${mealCountPerDay}`,
      `- Allergies: ${anyAllergies || "None"}`,
      "",
      "Generate a total of ${mealCountPerDay} distinct meals that cover the full day. Each meal should include:",
      "",
      ">>> 1. Meal Name (creative, concise)",
      ">>> 2. Meal Time Slot (Breakfast, Lunch, Snack, or Dinner)",
      ">>> 3. Ingredients with exact quantities (scaled for ONE person)",
      ">>> 4. Nutritional Info: Show total Calories, Protein (g), Carbs (g), and Fats (g)",
      "",
      ">>> Format the entire response clearly in markdown.",
      ">>> DO NOT include preparation steps, instructions, tips, or serving flexibility.",
      ">>> DO NOT repeat ingredients across meals unless it’s nutritionally optimal.",
      "",
      ">>> Example format for each meal:",
      "### Meal: Avocado Protein Bowl",
      "**Meal Time:** Breakfast",
      "**Ingredients:**",
      "- 2 boiled eggs",
      "- 1 medium avocado",
      "- 2 slices whole grain toast",
      "- 1 tsp olive oil",
      "",
      "**Nutrition:** 525 Calories – 40g Protein – 60g Carbs – 15g Fat",
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
    const meal = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!meal) throw new Error("Received empty response from API");

    // Save recipe to MongoDB
    await Meal.create({
      userId,
      age,
      goalAndAspiration,
      weight,
      height,
      sex,
      diet,
      mealCountPerDay,
      anyAllergies,
      resultText: meal,
    });

    const chunkSize = 80;
    for (let i = 0; i < meal.length; i += chunkSize) {
      const chunk = meal.slice(i, i + chunkSize);
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

router.get("/meals/saved-meals", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id; // Use `req.user._id` instead of `request.user.id`
    const saved_meal = await Meal.find({ userId });
    console.log("Meal:", saved_meal); // Debugging
    res.json(saved_meal || []);
  } catch (error) {
    console.error("Error fetching your meals:", error);
    res.status(500).json({ error: "Server Error", items: [] });
  }
});
router.delete("/meal/:id", isAuthenticated, async (req, res) => {
  try {
    const deletedMeal = await Meal.deleteOne({ _id: req.params.id });
    if (!deletedMeal) {
      return res.status(404).json({ message: "meals not found" });
    }
    res.status(200).json({ message: "meals deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting meal", error: err });
  }
});
router.get("/meal/:id", isAuthenticated, async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({ message: "meal not found" });
    }
    res.status(200).json(meal);
  } catch (err) {
    res.status(500).json({ message: "Error fetching meal", error: err });
  }
});
module.exports = router;
