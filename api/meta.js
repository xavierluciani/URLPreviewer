import express from 'express';
import NodeCache from 'node-cache';
import cors from 'cors';

const app = express();
const cache = new NodeCache({ stdTTL: 86400 }); // Cache de 24h

// Configuration CORS pour autoriser uniquement toto.bonjour
const corsOptions = {
    origin: 'https://neogeoplayers.com', // Autorise uniquement ce domaine
    methods: ['GET, POST, OPTIONS'],
    allowedHeaders: ['Content-Type']
};

app.use(express.json());
app.use(cors(corsOptions)); // Appliquer les règles CORS

app.post('/api/meta', async (req, res) => {
    console.log("Requête reçue :", req.body);

    const { url } = req.body;
    if (!url) {
        console.error("Erreur : URL manquante");
        return res.status(400).json({ error: 'URL manquante' });
    }

    try {
        const response = await fetch(url); // Utilisation de fetch natif
        const html = await response.text();

        console.log("HTML récupéré avec succès");

        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        const imageMatch = html.match(/<meta property=\"og:image\" content=\"(.*?)\"/);

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
