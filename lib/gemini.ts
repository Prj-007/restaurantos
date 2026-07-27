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
    model: "gemini-2.0-flash",
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

export async function suggestMenuPrice(input: {
  menuItemName: string;
  currentPrice: number;
  ingredients: { name: string; quantity: number; unit: string; costPerUnit: number }[];
}): Promise<PricingSuggestion> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: pricingSchema,
    },
  });

  const foodCost = input.ingredients.reduce((sum, i) => sum + i.quantity * i.costPerUnit, 0);

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
