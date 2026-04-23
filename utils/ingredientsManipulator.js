import { GoogleGenerativeAI } from "@google/generative-ai";

const ingredientsManipulator = async (dish, noOfTablesBooked, totalTables, ingredients) => {
  try {
    const now = new Date();
    const currentTime = now.toLocaleTimeString();

    const prompt = `
You are managing pricing for a restaurant in Pune.

Current time: ${currentTime}

Dish: "${dish}"

Customer requested ingredient changes.

Restaurant load:
- Tables booked: ${noOfTablesBooked}
- Total tables: ${totalTables}

Dish ingredient details:
${ingredients}

Your task:
- If ingredients are added → increase price
- If ingredients are removed → decrease price
- If no meaningful change → return 0
- High occupancy (>70%) → slight increase allowed

Output rules:
- ONLY return a number
- No text, no explanation, no currency
- Integer only (e.g., 0, 20, -10)
`;

    if (!process.env.GEMINI_API_KEY) {
      console.warn("[ingredientsManipulator] No GEMINI_API_KEY configured, returning 0");
      return 0;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(prompt);
    const outputText = response.response.text().trim();

    // Ensure safe numeric return
    const cleanText = outputText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const priceChange = parseInt(cleanText, 10);

    if (isNaN(priceChange)) {
      console.warn("[ingredientsManipulator] Gemini returned non-numeric output:", outputText);
      return 0;
    }

    return priceChange;

  } catch (error) {
    console.error("Error in ingredientsManipulator:", error);
    return 0; // fallback safety
  }
};

export default ingredientsManipulator;