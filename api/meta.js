import express from 'express';
import NodeCache from 'node-cache';
import cors from 'cors';
import puppeteer from 'puppeteer-core';

const app = express();
const cache = new NodeCache({ stdTTL: 86400 });

app.use(cors({
    origin: 'https://www.neogeo-players.com',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

app.post('/api/meta', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL manquante' });
    }

    const cachedData = cache.get(url);
    if (cachedData) {
        return res.json(cachedData);
    }

    try {
        const browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const metaData = await page.evaluate(() => {
            const title = document.querySelector('title')?.textContent || 
                         document.querySelector('meta[property="og:title"]')?.content || 
                         'Titre non trouvé';
            
            const image = document.querySelector('meta[property="og:image"]')?.content || 
                         document.querySelector('meta[name="twitter:image"]')?.content || 
                         'Image non trouvée';
            
            return { title: title.trim(), image };
        });

        await browser.close();
        cache.set(url, metaData);
        res.json(metaData);

    } catch (error) {
        console.error("Erreur :", error);
        res.status(500).json({ error: 'Impossible de récupérer les données' });
    }
});

export default app;
