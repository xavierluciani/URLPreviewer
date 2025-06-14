import express from 'express';
import NodeCache from 'node-cache';
import cors from 'cors';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const app = express();
const cache = new NodeCache({ stdTTL: 86400 });

// Configuration CORS
app.use(cors({
    origin: 'https://www.neogeo-players.com',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Configuration pour Vercel
export const config = {
    maxDuration: 60,
};

async function getBrowser() {
    return await puppeteer.launch({
        args: [
            ...chromium.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-animations',
            '--disable-background-timer-throttling',
            '--disable-restore-session-state',
            '--single-process'
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
}

app.post('/api/meta', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL manquante' });
    }

    // Vérification du cache
    const cachedData = cache.get(url);
    if (cachedData) {
        return res.json(cachedData);
    }

    let browser = null;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
        });

        const metaData = await page.evaluate(() => {
            const title = document.querySelector('title')?.textContent || 
                         document.querySelector('meta[property="og:title"]')?.content || 
                         'Titre non trouvé';
            
            const image = document.querySelector('meta[property="og:image"]')?.content || 
                         document.querySelector('meta[name="twitter:image"]')?.content || 
                         'Image non trouvée';
            
            return { title: title.trim(), image };
        });

        cache.set(url, metaData);
        res.json(metaData);

    } catch (error) {
        console.error("Erreur :", error);
        res.status(500).json({ error: 'Impossible de récupérer les données' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

export default app;
