import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const users = [
    { name: "Olivia Owner", email: "owner@restaurantos.dev", role: "OWNER" as const },
    { name: "Mark Manager", email: "manager@restaurantos.dev", role: "MANAGER" as const },
    { name: "Carla Chef", email: "chef@restaurantos.dev", role: "CHEF" as const },
    { name: "Will Waiter", email: "waiter@restaurantos.dev", role: "WAITER" as const },
    { name: "Cara Cashier", email: "cashier@restaurantos.dev", role: "CASHIER" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  const categories = [
    { name: "Food & Beverage Supplies", description: "Raw ingredients, produce, beverages" },
    { name: "Utilities", description: "Electricity, water, gas" },
    { name: "Equipment & Maintenance", description: "Kitchen equipment, repairs" },
    { name: "Packaging", description: "Takeaway containers, disposables" },
    { name: "Miscellaneous", description: "Anything that doesn't fit elsewhere" },
  ];
  for (const c of categories) {
    await prisma.expenseCategory.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }

  const suppliers = [
    { name: "Fresh Farms Produce", contactName: "Raj Mehta", phone: "+91-9800011122", email: "sales@freshfarms.example" },
    { name: "Metro Beverage Distributors", contactName: "Anita Rao", phone: "+91-9800033344", email: "orders@metrobev.example" },
    { name: "Coastal Seafood Co.", contactName: "Deepak Nair", phone: "+91-9800055566", email: "hello@coastalseafood.example" },
  ];
  for (const s of suppliers) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!existing) await prisma.supplier.create({ data: s });
  }

  const ingredients = [
    { name: "Tomato", unit: "kg", costPerUnit: 40, currentStock: 25, reorderThreshold: 10 },
    { name: "Mozzarella Cheese", unit: "kg", costPerUnit: 550, currentStock: 8, reorderThreshold: 5 },
    { name: "Chicken Breast", unit: "kg", costPerUnit: 280, currentStock: 15, reorderThreshold: 8 },
    { name: "Basmati Rice", unit: "kg", costPerUnit: 90, currentStock: 40, reorderThreshold: 15 },
    { name: "Olive Oil", unit: "litre", costPerUnit: 620, currentStock: 6, reorderThreshold: 4 },
  ];
  const ingredientRows: Record<string, string> = {};
  for (const i of ingredients) {
    const existing = await prisma.ingredient.findFirst({ where: { name: i.name } });
    const row = existing ?? (await prisma.ingredient.create({ data: i }));
    ingredientRows[i.name] = row.id;
  }

  const margherita = await prisma.menuItem.findFirst({ where: { name: "Margherita Pizza" } });
  const margheritaRow =
    margherita ??
    (await prisma.menuItem.create({
      data: { name: "Margherita Pizza", category: "Main Course", price: 399, description: "Classic tomato & mozzarella pizza" },
    }));
  await prisma.recipeIngredient.upsert({
    where: { menuItemId_ingredientId: { menuItemId: margheritaRow.id, ingredientId: ingredientRows["Tomato"] } },
    update: {},
    create: { menuItemId: margheritaRow.id, ingredientId: ingredientRows["Tomato"], quantity: 0.2 },
  });
  await prisma.recipeIngredient.upsert({
    where: { menuItemId_ingredientId: { menuItemId: margheritaRow.id, ingredientId: ingredientRows["Mozzarella Cheese"] } },
    update: {},
    create: { menuItemId: margheritaRow.id, ingredientId: ingredientRows["Mozzarella Cheese"], quantity: 0.15 },
  });

  const butterChicken = await prisma.menuItem.findFirst({ where: { name: "Butter Chicken" } });
  const butterChickenRow =
    butterChicken ??
    (await prisma.menuItem.create({
      data: { name: "Butter Chicken", category: "Main Course", price: 449, description: "Creamy tomato chicken curry" },
    }));
  await prisma.recipeIngredient.upsert({
    where: { menuItemId_ingredientId: { menuItemId: butterChickenRow.id, ingredientId: ingredientRows["Chicken Breast"] } },
    update: {},
    create: { menuItemId: butterChickenRow.id, ingredientId: ingredientRows["Chicken Breast"], quantity: 0.25 },
  });
  await prisma.recipeIngredient.upsert({
    where: { menuItemId_ingredientId: { menuItemId: butterChickenRow.id, ingredientId: ingredientRows["Tomato"] } },
    update: {},
    create: { menuItemId: butterChickenRow.id, ingredientId: ingredientRows["Tomato"], quantity: 0.15 },
  });

  for (let n = 1; n <= 8; n++) {
    await prisma.restaurantTable.upsert({
      where: { number: n },
      update: {},
      create: { number: n, capacity: n % 3 === 0 ? 6 : 4 },
    });
  }

  console.log("Seed complete. Demo login: owner@restaurantos.dev / password123 (and manager/chef/waiter/cashier@restaurantos.dev)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
