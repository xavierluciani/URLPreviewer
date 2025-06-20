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

function validateAndCleanUrl(inputUrl) {
    try {
        let cleanedUrl = inputUrl.trim()
            .replace(/^["']+|["']+$/g, '')
            .replace(/["']/g, '')
            .replace(/\s+/g, '');
        
        const urlObj = new URL(cleanedUrl);
        
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error('Protocole non supporté');
        }
        
        return cleanedUrl;
    } catch (error) {
        throw new Error('URL invalide: ' + error.message);
    }
}

function findLogoImage($) {
    // Sélectionne toutes les balises img
    const imgs = $('img');
    for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        const attribs = img.attribs || {};
        // Vérifie id, class, alt pour le mot "logo" (insensible à la casse)
        if (
            (attribs.id && attribs.id.toLowerCase().includes('logo')) ||
            (attribs.class && attribs.class.toLowerCase().includes('logo')) ||
            (attribs.alt && attribs.alt.toLowerCase().includes('logo'))
        ) {
            return attribs.src || null;
        }
    }
    return null;
}

app.post('/api/meta', async (req, res) => {
    let { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL manquante' });
    }

    try {
        url = validateAndCleanUrl(url);
    } catch (error) {
        return res.status(400).json({ error: error.message });
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

        const title = $('title').text().trim() ||
            $('meta[property="og:title"]').attr('content') ||
            'Titre non trouvé';

        let image = $('meta[property="og:image"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content');

        // Si pas d'image og/twitter, cherche une image "logo"
        if (!image) {
            image = findLogoImage($);
        }
        if (!image) {
            image = 'Image non trouvée';
        }

        const metaData = { title, image };        

        cache.set(url, metaData);
        res.json(metaData);

    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            console.error(`Erreur HTTP ${status} pour ${url}`);
            
            switch (status) {
                case 410:
                    return res.status(410).json({ 
                        error: 'Ressource définitivement supprimée' 
                    });
                case 404:
                    return res.status(404).json({ 
                        error: 'Page non trouvée' 
                    });
                default:
                    return res.status(status).json({ 
                        error: `Erreur HTTP ${status}` 
                    });
            }
        } else {
            console.error('Erreur de réseau:', error.message);
            return res.status(500).json({ 
                error: 'Erreur de connexion' 
            });
        }
    }
});

export default app;
