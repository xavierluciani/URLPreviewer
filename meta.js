const express = require('express');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const cors = require('cors');

const app = express();
const cache = new NodeCache({ stdTTL: 86400 }); // Cache de 24h

const corsOptions = {
    origin: 'https://neogeoplayers.com', // Autorise uniquement ce domaine
    methods: ['POST'],
    allowedHeaders: ['Content-Type']
};

app.use(express.json());
app.use(cors(corsOptions)); // Appliquer les règles CORS

app.post('/api/meta', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL manquante' });

    // Vérifier si l'URL est déjà en cache
    const cachedData = cache.get(url);
    if (cachedData) {
        return res.json(cachedData);
    }

    try {
        const response = await fetch(url);
        const html = await response.text();

        // Extraire les balises meta
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        const imageMatch = html.match(/<meta property="og:image" content="(.*?)"/);

        const metaData = {
            title: titleMatch ? titleMatch[1] : 'Titre non trouvé',
            image: imageMatch ? imageMatch[1] : 'Image non trouvée'
        };

        // Stocker en cache
        cache.set(url, metaData);

        res.json(metaData);
    } catch (error) {
        res.status(500).json({ error: 'Impossible de récupérer les données' });
    }
});

module.exports = app;

3. Déployer sur Vercel

    Créer un fichier vercel.json pour configurer les routes :

json
