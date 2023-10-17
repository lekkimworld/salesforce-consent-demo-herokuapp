import { Application, Router } from "express";
import renderTemplate from "./ui_helper";
import { loremIpsum } from "lorem-ipsum";

export default (app: Application) => {
    const r = Router();
    r.get("/:category/:idx", async (req, res) => {
        const category = req.params.category;
        const idx = req.params.idx;

        // show product
        renderTemplate(res, "shopproduct", {
            category,
            name: `${category} Product ${Number.parseInt(idx) + 1}`,
            partno: `${category.toUpperCase()}-${Number.parseInt(idx) + 1}`,
            description: loremIpsum({ count: 8 }),
        });
    });

    r.get("/:category", async (req, res) => {
        // get category
        const category = req.params.category;

        // show products in category
        const products = [];
        for (let i = 0; i < category.length; i++) {
            const partno = `${category.toUpperCase()}-${i + 1}`;
            const name = `${category
                .substring(0, 1)
                .toUpperCase()}${category.substring(1)} Product ${i + 1}`;
            const description = loremIpsum({ count: 3 });
            products.push({
                partno,
                name,
                description,
            });
        }
        renderTemplate(res, "shopcategory", { category, products });
    });

    r.get("/", (req, res) => {
        // show categories
        const categories = [];
        categories.push({
            image: "cycle.png",
            name: "Bikes",
            description: loremIpsum({ count: 2 }),
        });
        categories.push({
            image: "cyclic.png",
            name: "Crossfit",
            description: loremIpsum({ count: 2 }),
        });
        categories.push({
            image: "dumbbell.png",
            name: "Dumbbells",
            description: loremIpsum({ count: 2 }),
        });
        categories.push({
            image: "scale.png",
            name: "Scales",
            description: loremIpsum({ count: 2 }),
        });
        categories.push({
            image: "kettlebell.png",
            name: "Kettlebells",
            description: loremIpsum({ count: 2 }),
        });
        categories.push({
            image: "mat.png",
            name: "Mats",
            description: loremIpsum({ count: 2 }),
        });
        renderTemplate(res, "shop", { categories });
    })

    app.use("/shop", r);
};
