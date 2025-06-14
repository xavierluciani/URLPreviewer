import express from 'express';
import NodeCache from 'node-cache';
import cors from 'cors';
import puppeteerCore from 'puppeteer-core';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import axios from 'axios';
import axiosRetry from 'axios-retry';

// Configuration du cache
const cache = new NodeCache({ stdTTL: 86400 });

const app = express();

// Configuration CORS
app.use(cors({
    origin: 'https://www.neogeo-players.com',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Configuration Axios avec retry
axiosRetry(axios, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               [403, 429, 500, 502, 503, 504].includes(error.response?.status);
    }
});

// Configuration Vercel pour la durée maximale
export const config = {
    maxDuration: 60, // 60 secondes maximum sur le plan Hobby
};

// User-Agents pour la rotation
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Fonction pour obtenir le navigateur selon l'environnement
async function getBrowser() {
    if (process.env.VERCEL_ENV === 'production') {
        // Production sur Vercel - utiliser @sparticuz/chromium
        const executablePath = await chromium.executablePath();
        
        return await puppeteerCore.launch({
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
            executablePath,
            headless: chromium.headless,
        });
    } else {
        // Développement local - utiliser Puppeteer standard
        return await puppeteer.launch({
            headless: 'new'
        });
    }
}

// Méthode avec Puppeteer optimisée pour Vercel
async function scrapWithPuppeteer(url) {
    let browser = null;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        
        // Configuration optimisée pour Vercel
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent(getRandomUserAgent());
        
        // Bloquer les ressources non nécessaires
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['stylesheet', 'image', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Timeout plus court pour Vercel
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 // 15 secondes maximum
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

        return metaData;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Méthode avec Axios (plus rapide)
async function scrapWithAxios(url) {
    const response = await axios.get(url, {
        timeout: 10000, // 10 secondes
        headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
    });

    const html = response.data;
    
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is) || 
                      html.match(/<meta\s+property="og:title"\s+content="([^"]*)"[^>]*>/i);
    const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"[^>]*>/i) ||
                      html.match(/<meta\s+name="twitter:image"\s+content="([^"]*)"[^>]*>/i);

    return {
        title: titleMatch ? titleMatch[1].trim() : 'Titre non trouvé',
        image: imageMatch ? imageMatch[1] : 'Image non trouvée'
    };
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

    try {
        let metaData;
        
        // Tentative avec Axios d'abord
        try {
            metaData = await scrapWithAxios(url);
        } catch (axiosError) {
            // Fallback vers Puppeteer seulement si nécessaire
            metaData = await scrapWithPuppeteer(url);
        }

        cache.set(url, metaData);
        res.json(metaData);

    } catch (error) {
        console.error("Erreur :", error);
        res.status(500).json({ error: 'Impossible de récupérer les données' });
    }
});

export default app;
