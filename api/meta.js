import express from 'express';
import NodeCache from 'node-cache';
import cors from 'cors';

const app = express();
const cache = new NodeCache({ stdTTL: 86400 }); // Cache de 24h

// Configuration CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

app.post('/api/meta', async (req, res) => {
    console.log("Requête reçue :", req.body);

    const { url } = req.body;
    if (!url) {
        console.error("Erreur : URL manquante");
        return res.status(400).json({ error: 'URL manquante' });
    }

    try {
        const fetch = (await import('node-fetch')).default; // Import dynamique

        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US,en;q=0.8',
                'Referer': 'https://www.google.com/', // Simule une requête venant de Google
                'Connection': 'keep-alive'
            }
        });

        if (!response.ok) {
            console.error(`Erreur HTTP ${response.status}`);
            return res.status(response.status).json({ error: `Erreur HTTP ${response.status}` });
        }

        const html = await response.text();
        console.log("HTML récupéré avec succès");

        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        const imageMatch = html.match(/<meta property="og:image" content="(.*?)"/);

        const metaData = {
            title: titleMatch ? titleMatch[1] : 'Titre non trouvé',
            image: imageMatch ? imageMatch[1] : 'Image non trouvée'
        };

        console.log("Données extraites :", metaData);

        res.json(metaData);
    } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
        res.status(500).json({ error: 'Impossible de récupérer les données' });
    }
});

export default app;
