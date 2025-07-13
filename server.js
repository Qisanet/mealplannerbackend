const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const connectDatabase = require("./config/config.js");
const userRoute = require("./routes/userRoute.js");
require("dotenv").config();
const recipeRoutes = require("./routes/recipeRoutes.js");
const mealRoutes = require("./routes/mealRoutes.js")
const app = express();
app.use(
  cors({
    origin: "*",
  })
);

connectDatabase();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

// POST route to create a new lost/found item

app.use("/", userRoute);
app.use("/", recipeRoutes);
app.use("/", mealRoutes);

app.get("/", (request, response) => {
  console.log(request);
  return response.status(234).send("welcome to Mern Stack");
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App is listening to port ${port}`);
});
