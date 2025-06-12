// Module API pour communiquer avec le serveur Break and Play

class BreakAndPlayAPI {
    constructor() {
        this.baseUrl = 'https://break-and-play-admin.onrender.com/api';
        this.token = localStorage.getItem('token');
    }

    // Méthode pour faire des requêtes HTTP
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);

            // Gérer les réponses vides (ex: 201 Created ou 204 No Content)
            const text = await response.text();
            const data = text ? JSON.parse(text) : {};

            if (!response.ok) {
                // Utiliser le message d'erreur du serveur s'il existe
                throw new Error(data.erreur || response.statusText || 'Erreur serveur');
            }

            return data;
        } catch (error) {
            console.error('Erreur API:', error);
            throw error;
        }
    }

    // Méthodes d'authentification
    async connexion(nom, motDePasse) {
        const data = await this.request('/connexion', {
            method: 'POST',
            body: JSON.stringify({ nom, motDePasse })
        });

        if (data.token) {
            this.token = data.token;
            localStorage.setItem('token', data.token);
            localStorage.setItem('utilisateur', JSON.stringify(data.utilisateur));
        }

        return data;
    }

    deconnexion() {
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('utilisateur');
        window.location.href = '/';
    }

    // Méthodes pour les utilisateurs
    async creerUtilisateur(nom, motDePasse, role) {
        return await this.request('/utilisateurs', {
            method: 'POST',
            body: JSON.stringify({ nom, motDePasse, role })
        });
    }

    async obtenirUtilisateurs() {
        return await this.request('/utilisateurs');
    }

    async supprimerUtilisateur(id) {
        return await this.request(`/utilisateurs/${id}`, {
            method: 'DELETE'
        });
    }

    // Méthodes pour les clients
    async ajouterClient(nom, prenom, email, telephone) {
        return await this.request('/clients', {
            method: 'POST',
            body: JSON.stringify({ nom, prenom, email, telephone })
        });
    }

    async obtenirClients() {
        return await this.request('/clients');
    }

    async validerEntreeClient(id) {
        return await this.request(`/clients/${id}/valider-entree`, {
            method: 'POST'
        });
    }

    async supprimerClient(id) {
        return await this.request(`/clients/${id}`, {
            method: 'DELETE'
        });
    }

    // Méthodes pour les statistiques
    async obtenirStatistiques() {
        return await this.request('/statistiques');
    }

    // Méthodes pour les logs
    async obtenirLogs() {
        return await this.request('/logs');
    }

    // Utilitaires
    obtenirUtilisateurConnecte() {
        const utilisateur = localStorage.getItem('utilisateur');
        return utilisateur ? JSON.parse(utilisateur) : null;
    }

    estConnecte() {
        return !!this.token && !!this.obtenirUtilisateurConnecte();
    }

    peutAccederSuperAdmin() {
        const utilisateur = this.obtenirUtilisateurConnecte();
        return utilisateur && utilisateur.role === 'super_admin';
    }

    peutAccederAdmin() {
        const utilisateur = this.obtenirUtilisateurConnecte();
        return utilisateur && (utilisateur.role === 'admin' || utilisateur.role === 'super_admin');
    }

    peutAccederEmploye() {
        const utilisateur = this.obtenirUtilisateurConnecte();
        return utilisateur && ['employe', 'admin', 'super_admin'].includes(utilisateur.role);
    }
}

// Instance globale de l'API
window.api = new BreakAndPlayAPI();

// Fonctions utilitaires pour les notifications
function afficherNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
        <div class="notification-header">
            <h4 class="notification-title">
                ${type === 'success' ? '✅ Succès' : type === 'error' ? '❌ Erreur' : '⚠️ Attention'}
            </h4>
            <button class="notification-close">&times;</button>
        </div>
        <div class="notification-body">${message}</div>
    `;

    // Ajouter la notification au DOM
    document.body.appendChild(notification);

    // Gérer la fermeture
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });

    // Auto-suppression après 5 secondes
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Fonction pour gérer les erreurs globales
function gererErreur(error) {
    console.error('Erreur:', error);
    afficherNotification(error.message || 'Une erreur est survenue', 'error');
}

// Fonction pour formater les dates
function formaterDate(dateString) {
    if (!dateString) return 'Non défini';
    
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Fonction pour formater les rôles
function formaterRole(role) {
    const roles = {
        'super_admin': 'Super Administrateur',
        'admin': 'Administrateur',
        'employe': 'Employé'
    };
    return roles[role] || role;
}

// Fonction pour obtenir la couleur du badge selon le rôle
function obtenirClasseBadgeRole(role) {
    const classes = {
        'super_admin': 'badge-super-admin',
        'admin': 'badge-admin',
        'employe': 'badge-employe'
    };
    return classes[role] || '';
}

// Fonction pour exporter les données en CSV (simulation Excel)
function exporterEnCSV(donnees, nomFichier) {
    if (!donnees || donnees.length === 0) {
        afficherNotification('Aucune donnée à exporter', 'warning');
        return;
    }

    // Créer le contenu CSV
    const headers = Object.keys(donnees[0]);
    const csvContent = [
        headers.join(','),
        ...donnees.map(row => 
            headers.map(header => 
                `"${String(row[header] || '').replace(/"/g, '""')}"`
            ).join(',')
        )
    ].join('\n');

    // Créer et télécharger le fichier
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${nomFichier}_${new Date().getTime()}.csv`;
    link.click();

    afficherNotification('Export réalisé avec succès', 'success');
}

// Fonction pour vérifier l'authentification et rediriger si nécessaire
function verifierAuthentification() {
    if (!api.estConnecte()) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// Fonction pour rediriger vers le bon tableau de bord selon le rôle
function redirigerSelonRole() {
    const utilisateur = api.obtenirUtilisateurConnecte();
    if (!utilisateur) {
        window.location.href = '/';
        return;
    }

    const pages = {
        'super_admin': '/super-admin.html',
        'admin': '/admin.html',
        'employe': '/employe.html'
    };

    const page = pages[utilisateur.role];
    if (page && window.location.pathname !== page) {
        window.location.href = page;
    }
}