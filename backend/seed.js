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

/**
 * Določi, ali se naj seedajo demo uporabniki (z znanimi gesli/PIN-i).
 *
 * Produkcija: demo uporabniki se NE seedajo — namesto tega se iz env
 * spremenljivk ustvari samo admin (SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD).
 * Demo seed se eksplicitno omogoči z:
 *   - NODE_ENV !== 'production' (default za dev), ALI
 *   - SEED_DEMO_USERS=true (eksplicitni override, tudi v produkciji če res rabi)
 */
const shouldSeedDemoUsers = () => {
    if (process.env.SEED_DEMO_USERS === "true") return true;
    if (process.env.SEED_DEMO_USERS === "false") return false;
    return process.env.NODE_ENV !== "production";
};

/**
 * Ustvari admin uporabnika iz env spremenljivk (produkcijski bootstrap).
 * Zahteva SEED_ADMIN_EMAIL in SEED_ADMIN_PASSWORD; PIN je opcijski.
 */
const seedProductionAdmin = async () => {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
        throw new Error(
            "Production seed requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars. " +
            "Demo users are disabled in production. Set SEED_DEMO_USERS=true to override (NOT recommended)."
        );
    }
    console.log(`🔐 Production bootstrap — creating admin: ${email}`);
    const admin = await User.create({
        name: process.env.SEED_ADMIN_NAME || "Administrator",
        email,
        password,
        role: "admin",
        pin: process.env.SEED_ADMIN_PIN || undefined,
        designation: "System Administrator",
        isActive: true,
    });
    console.log(`✅ Admin created: ${admin.email}`);
    return [admin];
};

const seedData = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB for seeding...");

        const seedDemo = shouldSeedDemoUsers();
        console.log(`Seed mode: ${seedDemo ? "DEMO (development)" : "PRODUCTION (admin from env)"}`);

        // 1. Clear existing specific operational and config data
        console.log("Cleaning existing data...");
        await User.deleteMany({});
        await Category.deleteMany({});
        await MenuItem.deleteMany({});
        await Table.deleteMany({});
        await Client.deleteMany({});
        await Inventory.deleteMany({});
        await Tax.deleteMany({});
        await Discount.deleteMany({});
        await Order.deleteMany({});
        console.log("Database cleared.");

        // 2. Seed Users — production bootstrap ali demo podatki
        console.log("Seeding Users...");
        let createdUsers;
        if (seedDemo) {
            // Demo uporabniki — uporabimo User.create() (ne insertMany), da se
            // pre("save") hook za bcrypt hashing gesel pravilno sproži.
            createdUsers = [];
            for (const u of data.users) {
                createdUsers.push(await User.create(u));
            }
            console.log(`Inserted ${createdUsers.length} demo users.`);
        } else {
            createdUsers = await seedProductionAdmin();
        }

        // 3-N. Ostali demo podatki (menu, mize, stranke, ...) — samo v demo načinu.
        // V produkciji admin ustvari te podatke preko admin UI-ja.
        if (seedDemo) {
            console.log("Seeding Categories...");
            const createdCategories = await Category.insertMany(data.categories);
            console.log(`Inserted ${createdCategories.length} categories.`);

            console.log("Seeding Menu Items...");
            const menuItemsWithIds = data.menuItems.map(item => {
                const category = createdCategories.find(c => c.name === item.categoryName);
                const { categoryName: _, ...rest } = item;
                return {
                    ...rest,
                    category: category ? category._id : null
                };
            });
            await MenuItem.insertMany(menuItemsWithIds);
            console.log(`Inserted ${menuItemsWithIds.length} menu items.`);

            console.log("Seeding Tables...");
            await Table.insertMany(data.tables);
            console.log(`Inserted ${data.tables.length} tables.`);

            console.log("Seeding Clients...");
            await Client.insertMany(data.clients);
            console.log(`Inserted ${data.clients.length} clients.`);

            console.log("Seeding Inventory...");
            await Inventory.insertMany(data.inventory);
            console.log(`Inserted ${data.inventory.length} inventory items.`);

            console.log("Seeding Taxes and Discounts...");
            await Tax.insertMany(data.taxes);
            await Discount.insertMany(data.discounts);
            console.log("Seeded Taxes and Discounts.");
        } else {
            console.log("Skipping demo menu/tables/clients/inventory (production mode).");
        }

        console.log("Data Seeding Completed Successfully! 🚀");
        process.exit(0);

    } catch (error) {
        console.error("Error Seeding Data:", error);
        process.exit(1);
    }
};

seedData();
