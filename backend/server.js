const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'break_and_play_secret_key_2025';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialisation de la base de données
const db = new sqlite3.Database('./break_and_play.db');

// Création des tables
db.serialize(() => {
    // Table des utilisateurs
    db.run(`CREATE TABLE IF NOT EXISTS utilisateurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        mot_de_passe TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'employe')),
        cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Table des clients
    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT,
        telephone TEXT,
        statut_paiement TEXT DEFAULT 'paye' CHECK(statut_paiement IN ('paye', 'non_paye')),
        est_entre BOOLEAN DEFAULT FALSE,
        heure_entree DATETIME,
        ajoute_par INTEGER,
        cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ajoute_par) REFERENCES utilisateurs (id)
    )`);

    // Table des logs
    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        utilisateur_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        horodatage DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs (id)
    )`);

    // Création des super administrateurs par défaut
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    const dmnqtmbPassword = bcrypt.hashSync('010901T', 10);
    db.run(`INSERT OR IGNORE INTO utilisateurs (nom, mot_de_passe, role) VALUES (?, ?, ?)`, 
        ['Keran', defaultPassword, 'super_admin']);
    db.run(`INSERT OR IGNORE INTO utilisateurs (nom, mot_de_passe, role) VALUES (?, ?, ?)`, 
        ['Dominique', defaultPassword, 'super_admin']);
    db.run(`INSERT OR IGNORE INTO utilisateurs (nom, mot_de_passe, role) VALUES (?, ?, ?)`, 
        ['dmnqtmb', dmnqtmbPassword, 'super_admin']);
});

// Middleware d'authentification
const authentifierToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ erreur: 'Token manquant' });
    }

    jwt.verify(token, JWT_SECRET, (err, utilisateur) => {
        if (err) {
            return res.status(403).json({ erreur: 'Token invalide' });
        }
        req.utilisateur = utilisateur;
        next();
    });
};

// Route de connexion
app.post('/api/connexion', (req, res) => {
    const { nom, motDePasse } = req.body;

    db.get('SELECT * FROM utilisateurs WHERE nom = ?', [nom], async (err, utilisateur) => {
        if (err) {
            return res.status(500).json({ erreur: 'Erreur serveur' });
        }

        if (!utilisateur || !await bcrypt.compare(motDePasse, utilisateur.mot_de_passe)) {
            return res.status(401).json({ erreur: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        const token = jwt.sign(
            { id: utilisateur.id, nom: utilisateur.nom, role: utilisateur.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Log de connexion
        db.run('INSERT INTO logs (utilisateur_id, action, details) VALUES (?, ?, ?)',
            [utilisateur.id, 'CONNEXION', `Connexion réussie`]);

        res.json({
            token,
            utilisateur: {
                id: utilisateur.id,
                nom: utilisateur.nom,
                role: utilisateur.role
            }
        });
    });
});

// Route pour créer un nouvel utilisateur (super admin seulement)
app.post('/api/utilisateurs', authentifierToken, async (req, res) => {
    if (req.utilisateur.role !== 'super_admin') {
        return res.status(403).json({ erreur: 'Accès refusé' });
    }

    const { nom, motDePasse, role } = req.body;

    if (!nom || !motDePasse || !role) {
        return res.status(400).json({ erreur: 'Tous les champs sont requis' });
    }

    try {
        const motDePasseHache = await bcrypt.hash(motDePasse, 10);
        
        db.run('INSERT INTO utilisateurs (nom, mot_de_passe, role) VALUES (?, ?, ?)',
            [nom, motDePasseHache, role], function(err) {
                if (err) {
                    return res.status(500).json({ erreur: 'Erreur lors de la création de l\'utilisateur' });
                }

                // Log de création d'utilisateur
                db.run('INSERT INTO logs (utilisateur_id, action, details) VALUES (?, ?, ?)',
                    [req.utilisateur.id, 'CREATION_UTILISATEUR', `Création de ${role}: ${nom}`]);

                res.json({ message: 'Utilisateur créé avec succès', id: this.lastID });
            });
    } catch (error) {
        res.status(500).json({ erreur: 'Erreur serveur' });
    }
});

// Route pour obtenir tous les utilisateurs (super admin seulement)
app.get('/api/utilisateurs', authentifierToken, (req, res) => {
    if (req.utilisateur.role !== 'super_admin') {
        return res.status(403).json({ erreur: 'Accès refusé' });
    }

    db.all('SELECT id, nom, role, cree_le FROM utilisateurs ORDER BY cree_le DESC', (err, utilisateurs) => {
        if (err) {
            return res.status(500).json({ erreur: 'Erreur serveur' });
        }
        res.json(utilisateurs);
    });
});

// Route pour supprimer un utilisateur (super admin seulement)
app.delete('/api/utilisateurs/:id', authentifierToken, (req, res) => {
    if (req.utilisateur.role !== 'super_admin') {
        return res.status(403).json({ erreur: 'Accès refusé' });
    }

    const userId = req.params.id;

    // Empêcher la suppression du super admin
    if (parseInt(userId) === req.utilisateur.id) {
        return res.status(400).json({ erreur: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    db.run('DELETE FROM utilisateurs WHERE id = ?', [userId], function(err) {
        if (err) {
            return res.status(500).json({ erreur: 'Erreur lors de la suppression' });
        }

        // Log de suppression
        db.run('INSERT INTO logs (utilisateur_id, action, details) VALUES (?, ?, ?)',
            [req.utilisateur.id, 'SUPPRESSION_UTILISATEUR', `Suppression utilisateur ID: ${userId}`]);

        res.json({ message: 'Utilisateur supprimé avec succès' });
    });
});

// Route pour ajouter un client (admin et super admin)
app.post('/api/clients', authentifierToken, (req, res) => {
    if (req.utilisateur.role === 'employe') {
        return res.status(403).json({ erreur: 'Accès refusé' });
    }

    const { nom, prenom, email, telephone } = req.body;

    if (!nom || !prenom) {
        return res.status(400).json({ erreur: 'Nom et prénom sont requis' });
    }

    db.run('INSERT INTO clients (nom, prenom, email, telephone, ajoute_par) VALUES (?, ?, ?, ?, ?)',
        [nom, prenom, email, telephone, req.utilisateur.id], function(err) {
            if (err) {
                return res.status(500).json({ erreur: 'Erreur lors de l\'ajout du client' });
            }

            // Log d'ajout de client
            db.run('INSERT INTO logs (utilisateur_id, action, details) VALUES (?, ?, ?)',
                [req.utilisateur.id, 'AJOUT_CLIENT', `Ajout client: ${prenom} ${nom}`]);

            res.json({ message: 'Client ajouté avec succès', id: this.lastID });
        });
});

// Route pour obtenir tous les clients
app.get('/api/clients', authentifierToken, (req, res) => {
    let query = `
        SELECT c.*, u.nom as ajoute_par_nom 
        FROM clients c 
        LEFT JOIN utilisateurs u ON c.ajoute_par = u.id 
        ORDER BY c.cree_le DESC
    `;

    db.all(query, (err, clients) => {
        if (err) {
            return res.status(500).json({ erreur: 'Erreur serveur' });
        }

        // Masquer qui a ajouté le client pour les admins (pas super admin)
        if (req.utilisateur.role === 'admin') {
            clients = clients.map(client => {
                const { ajoute_par_nom, ...clientSansAjoutePar } = client;
                return clientSansAjoutePar;
            });
        }

        res.json(clients);
    });
});

// Route pour supprimer un client (super admin seulement)
app.delete('/api/clients/:id', authentifierToken, (req, res) => {
    if (req.utilisateur.role !== 'super_admin') {
        return res.status(403).json({ erreur: 'Accès refusé. Seul un super administrateur peut supprimer un client.' });
    }

    const clientId = req.params.id;

    // Avant de supprimer, on récupère les infos du client pour le log
    db.get('SELECT nom, prenom FROM clients WHERE id = ?', [clientId], (err, client) => {
        if (err) {
            return res.status(500).json({ erreur: 'Erreur serveur lors de la récupération du client.' });
        }
        if (!client) {
            return res.status(404).json({ erreur: 'Client non trouvé.' });
        }

        const clientInfoForLog = `${client.prenom} ${client.nom}`;

        db.run('DELETE FROM clients WHERE id = ?', [clientId], function(err) {
            if (err) {
                return res.status(500).json({ erreur: 'Erreur lors de la suppression du client.' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ erreur: 'Client non trouvé ou déjà supprimé.' });
            }

            // Log de la suppression
            db.run('INSERT INTO logs (utilisateur_id, action, details) VALUES (?, ?, ?)',
                [req.utilisateur.id, 'SUPPRESSION_CLIENT', `Suppression du client ID ${clientId}: ${clientInfoForLog}`]);

            res.json({ message: 'Client supprimé avec succès' });
        });
    });
});

// Route pour valider l'entrée d'un client (employé)
app.post('/api/clients/:id/valider-entree', authentifierToken, (req, res) => {
    const clientId = req.params.id;

    // Vérifier si le client existe et n'est pas déjà entré
    db.get('SELECT * FROM clients WHERE id = ?', [clientId], (err, client) => {
        if (err) {
            return res.status(500).json({ erreur: 'Erreur serveur' });
        }

        if (!client) {
            return res.status(404).json({ erreur: 'Client non trouvé' });
        }

        if (client.est_entre) {
            return res.status(400).json({ erreur: 'Ce client est déjà entré' });
        }

        // Marquer comme entré
        db.run('UPDATE clients SET est_entre = TRUE, heure_entree = CURRENT_TIMESTAMP WHERE id = ?',
            [clientId], function(err) {
                if (err) {
                    return res.status(500).json({ erreur: 'Erreur lors de la validation' });
                }

                // Log de validation d'entrée
                db.run('INSERT INTO logs (utilisateur_id, action, details) VALUES (?, ?, ?)',
                    [req.utilisateur.id, 'VALIDATION_ENTREE', `Validation entrée: ${client.prenom} ${client.nom}`]);

                res.json({ message: 'Entrée validée avec succès' });
            });
    });
});

// Route pour obtenir les statistiques
app.get('/api/statistiques', authentifierToken, (req, res) => {
    const stats = {};

    // Nombre total de clients
    db.get('SELECT COUNT(*) as total FROM clients', (err, result) => {
        if (err) return res.status(500).json({ erreur: 'Erreur serveur' });
        stats.totalClients = result.total;

        // Nombre de clients entrés
        db.get('SELECT COUNT(*) as entres FROM clients WHERE est_entre = TRUE', (err, result) => {
            if (err) return res.status(500).json({ erreur: 'Erreur serveur' });
            stats.clientsEntres = result.entres;

            // Nombre de clients payés
            db.get('SELECT COUNT(*) as payes FROM clients WHERE statut_paiement = "paye"', (err, result) => {
                if (err) return res.status(500).json({ erreur: 'Erreur serveur' });
                stats.clientsPayes = result.payes;

                stats.clientsEnAttente = stats.totalClients - stats.clientsEntres;
                res.json(stats);
            });
        });
    });
});

// Route pour obtenir les logs (super admin seulement)
app.get('/api/logs', authentifierToken, (req, res) => {
    if (req.utilisateur.role !== 'super_admin') {
        return res.status(403).json({ erreur: 'Accès refusé' });
    }

    db.all(`
        SELECT l.*, u.nom as utilisateur_nom 
        FROM logs l 
        LEFT JOIN utilisateurs u ON l.utilisateur_id = u.id 
        ORDER BY l.horodatage DESC 
        LIMIT 100
    `, (err, logs) => {
        if (err) {
            return res.status(500).json({ erreur: 'Erreur serveur' });
        }
        res.json(logs);
    });
});

// Route pour servir la page principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🎉 Serveur Break and Play démarré sur http://localhost:${PORT}`);
    console.log(`📁 Frontend accessible à la racine`);
    console.log(`🔒 Super Admin par défaut: Keran / admin123`);
});