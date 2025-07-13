const fetch = require("node-fetch").default;

async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res;

    let data = {};
    try {
      data = await res.json();
    } catch {
      
    }

    const isOverloaded =
      data?.error?.message?.toLowerCase().includes("overloaded") ||
      data?.error?.message?.toLowerCase().includes("internal error");

    if (isOverloaded) {
      console.warn(`Retrying due to model error: attempt ${i + 1}...`);
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    } else {
      throw new Error(data?.error?.message || "API request failed");
    }
  }
  throw new Error("Model is overloaded. Please try again later.");
}

module.exports = fetchWithRetry;
