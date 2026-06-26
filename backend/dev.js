/**
 * Dev mode: požene backend z auto-seed v istem procesu.
 *
 * Delovanje:
 *   1. Poveže se na MongoDB (pravi ali in-memory fallback)
 *   2. Če je DB prazen, seed-a demo podatke
 *   3. Zažene Express server (enako kot `npm run dev`)
 *
 * Uporaba:  node dev.js   (ali   npm run dev:seed)
 */
require("dotenv").config();
const connectDB = require("./config/database/connection");

const User = require("./models/user.model");
const { Category, MenuItem } = require("./models/menu.model");
const Table = require("./models/table.model");
const Client = require("./models/client.model");
const Inventory = require("./models/inventory.model");
const Tax = require("./models/tax.model");
const Discount = require("./models/discount.model");
const Order = require("./models/order.model");
const data = require("./data");

const seedIfEmpty = async () => {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
        console.log(`ℹ️  DB already has ${userCount} users — skipping seed.`);
        return;
    }
    console.log("🌱 DB empty — seeding demo data…");

    await User.insertMany(data.users);
    const cats = await Category.insertMany(data.categories);

    const menuItems = data.menuItems.map(item => {
        const cat = cats.find(c => c.name === item.categoryName);
        const { categoryName: _, ...rest } = item;
        return { ...rest, category: cat._id };
    });
    await MenuItem.insertMany(menuItems);
    await Table.insertMany(data.tables);
    await Client.insertMany(data.clients);
    await Inventory.insertMany(data.inventory);
    if (data.taxes) await Tax.insertMany(data.taxes);
    if (data.discounts) await Discount.insertMany(data.discounts);

    console.log(`✅ Seeded: ${data.users.length} users, ${data.menuItems.length} menu items, ${data.tables.length} tables`);
};

(async () => {
    try {
        await connectDB();
        await seedIfEmpty();
    } catch (err) {
        console.error("Startup error:", err.message);
        process.exit(1);
    }

    // Zaženi Express server — require namesto da bi ponovno pognali process
    require("./index.js");
})();
