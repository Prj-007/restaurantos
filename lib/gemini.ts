import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// Structured output schema — Gemini is forced to return exactly this shape,
// so we never have to hand-parse free-text OCR output.
const invoiceSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    vendorName: { type: SchemaType.STRING, description: "Seller / supplier company name" },
    invoiceNumber: { type: SchemaType.STRING, nullable: true },
    invoiceDate: { type: SchemaType.STRING, nullable: true, description: "ISO 8601 date, e.g. 2026-02-20" },
    currency: { type: SchemaType.STRING, description: "3-letter currency code, best guess, default USD" },
    lineItems: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER, nullable: true },
          unitPrice: { type: SchemaType.NUMBER, nullable: true },
          lineTotal: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ["description"],
      },
    },
    subtotal: { type: SchemaType.NUMBER, nullable: true },
    taxAmount: { type: SchemaType.NUMBER, nullable: true },
    totalAmount: { type: SchemaType.NUMBER, nullable: true },
    isHandwritten: { type: SchemaType.BOOLEAN, description: "true if the invoice text is handwritten rather than printed/typed" },
    confidence: { type: SchemaType.NUMBER, description: "0-1 self-assessed confidence in the extraction accuracy" },
  },
  required: ["vendorName", "lineItems", "totalAmount", "isHandwritten", "confidence"],
};

export type ExtractedInvoice = {
  vendorName: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
  lineItems: { description: string; quantity: number | null; unitPrice: number | null; lineTotal: number | null }[];
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  isHandwritten: boolean;
  confidence: number;
};

const EXTRACTION_PROMPT = `You are an accounts-payable clerk extracting structured data from a supplier invoice image or PDF page. The invoice may be printed/typed OR handwritten — read handwriting carefully, character by character, before giving up on a field. Extract:
- vendor/seller company name
- invoice number (if present)
- invoice date (convert to ISO 8601 YYYY-MM-DD)
- currency (infer from symbols like $, ₹, € if not explicit; default "USD")
- every line item with description, quantity, unit price, and line total (use null for any sub-field you truly cannot read)
- subtotal, tax amount, and grand total
- whether the invoice is handwritten
- your own confidence (0-1) in the overall extraction

Return ONLY the structured data. If a numeric field is illegible or absent, use null rather than guessing wildly.`;

export async function extractInvoice(fileBuffer: Buffer, mimeType: string): Promise<ExtractedInvoice> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: invoiceSchema,
    },
  });

  const result = await model.generateContent([
    { text: EXTRACTION_PROMPT },
    { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
  ]);

  const text = result.response.text();
  return JSON.parse(text) as ExtractedInvoice;
}

// --- AI feature #2: menu pricing suggestion --------------------------------

export type PricingSuggestion = {
  suggestedPrice: number;
  estimatedFoodCost: number;
  estimatedMarginPercent: number;
  rationale: string;
};

// Pure so it's independently testable (no Gemini call): sum of quantity x
// cost-per-unit across a recipe's ingredients.
export function computeFoodCost(ingredients: { quantity: number; costPerUnit: number }[]): number {
  return ingredients.reduce((sum, i) => sum + i.quantity * i.costPerUnit, 0);
}

export async function suggestMenuPrice(input: {
  menuItemName: string;
  currentPrice: number;
  ingredients: { name: string; quantity: number; unit: string; costPerUnit: number }[];
}): Promise<PricingSuggestion> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: pricingSchema,
    },
  });

  const foodCost = computeFoodCost(input.ingredients);

  const prompt = `A restaurant menu item "${input.menuItemName}" is currently priced at ${input.currentPrice}.
Its recipe cost breakdown (raw ingredient cost per serving) is:
${input.ingredients.map((i) => `- ${i.name}: ${i.quantity} ${i.unit} x ${i.costPerUnit}/${i.unit}`).join("\n")}
Computed total food cost per serving: ${foodCost.toFixed(2)}.

Standard restaurant industry practice targets a food cost of roughly 28-35% of menu price. Suggest an optimal menu price, restate the food cost, compute the resulting margin percent, and give a one to two sentence rationale a restaurant owner would understand.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as PricingSuggestion;
}

const pricingSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    suggestedPrice: { type: SchemaType.NUMBER },
    estimatedFoodCost: { type: SchemaType.NUMBER },
    estimatedMarginPercent: { type: SchemaType.NUMBER },
    rationale: { type: SchemaType.STRING },
  },
  required: ["suggestedPrice", "estimatedFoodCost", "estimatedMarginPercent", "rationale"],
};

// --- AI feature #3: ingredient shortage prediction + reorder quantities ----

export type ShortageAnalysis = {
  predictions: {
    ingredientName: string;
    daysUntilShortage: number | null;
    urgency: "critical" | "soon" | "monitor";
    recommendedReorderQuantity: number;
    reasoning: string;
  }[];
  summary: string;
};

const shortageSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    predictions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ingredientName: { type: SchemaType.STRING },
          daysUntilShortage: { type: SchemaType.NUMBER, nullable: true, description: "Estimated days until stock hits zero at current usage rate; null if not estimable" },
          urgency: { type: SchemaType.STRING, enum: ["critical", "soon", "monitor"], format: "enum" },
          recommendedReorderQuantity: { type: SchemaType.NUMBER, description: "How much to reorder now, in the ingredient's unit" },
          reasoning: { type: SchemaType.STRING },
        },
        required: ["ingredientName", "urgency", "recommendedReorderQuantity", "reasoning"],
      },
    },
    summary: { type: SchemaType.STRING },
  },
  required: ["predictions", "summary"],
};

// Predicts which ingredients will run short and how much to reorder, from
// current stock levels, reorder thresholds, and recent consumption implied
// by recent orders (menu items sold -> recipe ingredient quantities used).
export async function analyzeShortagesAndReorder(input: {
  ingredients: { name: string; unit: string; currentStock: number; reorderThreshold: number; recentUsage: number }[];
}): Promise<ShortageAnalysis> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", responseSchema: shortageSchema },
  });

  const prompt = `You are inventory-planning for a restaurant. For each ingredient below, predict how many days until it runs out at its recent usage rate, classify urgency (critical = under 3 days or already at/below reorder threshold, soon = under 10 days, monitor = otherwise), and recommend a reorder quantity that would cover roughly 14 days of usage plus a safety buffer.

Ingredients (name, unit, currentStock, reorderThreshold, recentUsage = amount consumed in the last 7 days):
${input.ingredients.map((i) => `- ${i.name}: unit=${i.unit}, currentStock=${i.currentStock}, reorderThreshold=${i.reorderThreshold}, recentUsage(7d)=${i.recentUsage}`).join("\n")}

Give a short overall summary too.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as ShortageAnalysis;
}

// --- AI feature #4: food preparation time estimate --------------------------

export type PrepTimeEstimate = {
  estimatedMinutes: number;
  complexity: "simple" | "moderate" | "complex";
  reasoning: string;
};

const prepTimeSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    estimatedMinutes: { type: SchemaType.NUMBER },
    complexity: { type: SchemaType.STRING, enum: ["simple", "moderate", "complex"], format: "enum" },
    reasoning: { type: SchemaType.STRING },
  },
  required: ["estimatedMinutes", "complexity", "reasoning"],
};

export async function estimatePrepTime(input: {
  menuItemName: string;
  category: string;
  ingredients: { name: string; quantity: number; unit: string }[];
}): Promise<PrepTimeEstimate> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", responseSchema: prepTimeSchema },
  });

  const prompt = `Estimate realistic kitchen preparation + cook time (in minutes, from order placed to plated) for this restaurant menu item, for a typical mid-size restaurant kitchen during service (not from scratch/prep-ahead time).

Menu item: "${input.menuItemName}" (category: ${input.category})
Ingredients: ${input.ingredients.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(", ") || "not specified"}

Classify complexity and give a one-sentence reasoning.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as PrepTimeEstimate;
}

// --- AI feature #5: ingredient waste analysis --------------------------------

export type WasteAnalysis = {
  topOffenders: { ingredientName: string; totalWasted: number; unit: string; estimatedCost: number }[];
  recommendations: string[];
  summary: string;
};

const wasteAnalysisSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    topOffenders: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ingredientName: { type: SchemaType.STRING },
          totalWasted: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING },
          estimatedCost: { type: SchemaType.NUMBER },
        },
        required: ["ingredientName", "totalWasted", "unit", "estimatedCost"],
      },
    },
    recommendations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    summary: { type: SchemaType.STRING },
  },
  required: ["topOffenders", "recommendations", "summary"],
};

export async function analyzeWaste(input: {
  wasteLogs: { ingredientName: string; unit: string; quantity: number; costPerUnit: number; reason: string | null; date: string }[];
}): Promise<WasteAnalysis> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", responseSchema: wasteAnalysisSchema },
  });

  const prompt = `Analyze this restaurant's logged ingredient waste over the recent period and identify the top offenders by estimated cost impact (quantity x costPerUnit), plus 3-5 concrete, actionable recommendations to reduce waste (e.g. portioning, storage, ordering frequency, prep timing) grounded in the actual logged reasons where possible.

Waste log entries (ingredient, unit, quantity wasted, cost per unit, reason, date):
${input.wasteLogs.map((w) => `- ${w.ingredientName}: ${w.quantity} ${w.unit} @ ${w.costPerUnit}/${w.unit}, reason="${w.reason ?? "unspecified"}", date=${w.date}`).join("\n")}

Give a short overall summary too.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as WasteAnalysis;
}
