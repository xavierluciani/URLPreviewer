import express from 'express';
import NodeCache from 'node-cache';
import cors from 'cors';
import * as cheerio from 'cheerio';
import axios from 'axios';

const app = express();
const cache = new NodeCache({ stdTTL: 86400 });

app.use(cors({
    origin: 'https://www.neogeo-players.com',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

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
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
            }
        });

        const $ = cheerio.load(response.data);
        
        const metaData = {
            title: $('title').text().trim() || 
                   $('meta[property="og:title"]').attr('content') || 
                   'Titre non trouvé',
            image: $('meta[property="og:image"]').attr('content') || 
                   $('meta[name="twitter:image"]').attr('content') || 
                   'Image non trouvée'
        };

        cache.set(url, metaData);
        res.json(metaData);

    } catch (error) {
        console.error("Erreur :", error);
        res.status(500).json({ error: 'Impossible de récupérer les données' });
    }
});

export default app;
