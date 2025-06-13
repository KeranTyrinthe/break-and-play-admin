// Script pour l'interface Employé
// Auteur: Cascade
// Description: Gère la logique de l'interface de validation des entrées pour les employés.

document.addEventListener('DOMContentLoaded', function() {
    // --- VERIFICATION DES ACCES ---
    const utilisateur = api.obtenirUtilisateurConnecte();
    if (!utilisateur || utilisateur.role !== 'employe') {
        api.deconnexion();
        return;
    }

    // --- ELEMENTS DU DOM ---
    const userNameElement = document.getElementById('userName');
    const btnDeconnexion = document.getElementById('btnDeconnexion');
    const btnActualiser = document.getElementById('btnActualiser');
    const rechercheClientInput = document.getElementById('rechercheClient');
    const listeClientsContainer = document.getElementById('listeClientsContainer');
    const listeClientsEntresTbody = document.getElementById('listeClientsEntres');
    const totalClientsPayesElement = document.getElementById('totalClients');
    const clientsEntresElement = document.getElementById('clientsEntres');
    const clientsEnAttenteElement = document.getElementById('clientsEnAttente');
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationNomElement = document.getElementById('confirmationNom');
    const btnConfirmerEntree = document.getElementById('btnConfirmerEntree');
    const btnAnnulerModal = confirmationModal.querySelector('.btn-cancel');
    const btnFermerModal = confirmationModal.querySelector('.close');

    // --- ETAT DE L'APPLICATION ---
    let tousLesClients = [];
    let clientEnCoursDeValidation = null;

    // --- INITIALISATION ---
    function initialiserInterface() {
        userNameElement.textContent = utilisateur.nom || 'Employé';
        configurerEvenements();
        actualiserToutesLesDonnees();
        setInterval(actualiserToutesLesDonnees, 20000);
    }

    // --- CONFIGURATION DES EVENEMENTS ---
    function configurerEvenements() {
        btnDeconnexion.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                api.deconnexion();
            }
        });
        btnActualiser.addEventListener('click', actualiserToutesLesDonnees);
        rechercheClientInput.addEventListener('input', mettreAJourAffichage);
        btnConfirmerEntree.addEventListener('click', confirmerValidationEntree);
        btnAnnulerModal.addEventListener('click', fermerModalConfirmation);
        btnFermerModal.addEventListener('click', fermerModalConfirmation);
        
        confirmationModal.addEventListener('click', (e) => {
            if (e.target === confirmationModal) fermerModalConfirmation();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && confirmationModal.style.display === 'block') {
                fermerModalConfirmation();
            }
        });

        // Utilisation de la délégation d'événements pour les boutons de validation
        listeClientsContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.btn-valider-entree');
            if (button) {
                const id = button.dataset.id;
                const prenom = button.dataset.prenom;
                const nom = button.dataset.nom;
                ouvrirConfirmationEntree(id, prenom, nom);
            }
        });
    }

    // --- LOGIQUE METIER ---
    async function actualiserToutesLesDonnees() {
        definirEtatChargement(true);
        try {
            tousLesClients = await api.obtenirClients();
            mettreAJourAffichage();
        } catch (error) {
            gererErreur(error, "Impossible de charger les données des clients.");
        } finally {
            definirEtatChargement(false);
        }
    }

    function mettreAJourAffichage() {
        const termeRecherche = rechercheClientInput.value.toLowerCase();
        const clientsPayes = tousLesClients.filter(c => c.statut_paiement === 'paye');
        
        const clientsFiltres = clientsPayes.filter(client => {
            const texteClient = `${client.nom} ${client.prenom} ${client.email || ''}`.toLowerCase();
            return texteClient.includes(termeRecherche);
        });

        const clientsEnAttente = clientsFiltres.filter(c => !c.est_entre);
        const clientsDejaEntres = clientsPayes
            .filter(c => c.est_entre)
            .sort((a, b) => new Date(b.heure_entree) - new Date(a.heure_entree));

        afficherStatistiques(clientsPayes, clientsDejaEntres);
        afficherClientsEnAttente(clientsEnAttente);
        afficherClientsEntres(clientsDejaEntres.slice(0, 10));
    }

    async function confirmerValidationEntree() {
        if (!clientEnCoursDeValidation) return;
        definirEtatValidation(true);
        try {
            await api.validerEntreeClient(clientEnCoursDeValidation.id);
            afficherNotification(`Entrée de ${clientEnCoursDeValidation.prenom} validée !`, 'success');
            fermerModalConfirmation();
            await actualiserToutesLesDonnees();
        } catch (error) {
            gererErreur(error, "Cette entrée a peut-être déjà été validée.");
        } finally {
            definirEtatValidation(false);
        }
    }

    // --- FONCTIONS D'AFFICHAGE ---
    function afficherStatistiques(clientsPayes, clientsDejaEntres) {
        totalClientsPayesElement.textContent = clientsPayes.length;
        clientsEntresElement.textContent = clientsDejaEntres.length;
        clientsEnAttenteElement.textContent = clientsPayes.length - clientsDejaEntres.length;
    }

    function afficherClientsEnAttente(clients) {
        if (clients.length === 0) {
            listeClientsContainer.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle"></i><h3>Aucun client en attente</h3><p>Tous les clients ont été traités.</p></div>`;
            return;
        }
        listeClientsContainer.innerHTML = clients.map(creerCarteClient).join('');
    }

    function afficherClientsEntres(clients) {
        if (clients.length === 0) {
            listeClientsEntresTbody.innerHTML = `<tr><td colspan="3" class="empty-state"><i class="fas fa-history"></i><h3>Aucune entrée récente</h3></td></tr>`;
            return;
        }
        listeClientsEntresTbody.innerHTML = clients.map(client => `
            <tr>
                <td data-label="Nom">${escapeHtml(client.nom)}</td>
                <td data-label="Prénom">${escapeHtml(client.prenom)}</td>
                <td data-label="Heure d'entrée"><span class="badge badge-entre-recent">${formaterDate(client.heure_entree)}</span></td>
            </tr>`).join('');
    }

    function creerCarteClient(client) {
        return `
            <div class="client-card">
                <div class="client-header">
                    <h4>${escapeHtml(client.prenom)} ${escapeHtml(client.nom)}</h4>
                </div>
                <div class="client-actions">
                    <button class="btn-valider-entree" 
                            data-id="${client.id}" 
                            data-prenom="${escapeHtml(client.prenom)}" 
                            data-nom="${escapeHtml(client.nom)}">
                        <i class="fas fa-check"></i> OK
                    </button>
                </div>
            </div>`;
    }

    // --- GESTION DE LA MODALE ---
    function ouvrirConfirmationEntree(id, prenom, nom) {
        clientEnCoursDeValidation = { id: parseInt(id, 10), prenom, nom };
        confirmationNomElement.textContent = `${prenom} ${nom}`;
        confirmationModal.style.display = 'block';
    }

    function fermerModalConfirmation() {
        confirmationModal.style.display = 'none';
        clientEnCoursDeValidation = null;
    }

    // --- HELPERS VISUELS ---
    function definirEtatChargement(isLoading) {
        const icon = btnActualiser.querySelector('i');
        btnActualiser.disabled = isLoading;
        icon.className = isLoading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt';
    }

    function definirEtatValidation(isValidating) {
        btnConfirmerEntree.disabled = isValidating;
        btnConfirmerEntree.innerHTML = isValidating 
            ? `<i class="fas fa-spinner fa-spin"></i> Validation...` 
            : `<i class="fas fa-check"></i> Confirmer l'entrée`;
    }

    // --- FONCTIONS UTILITAIRES ---
    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function gererErreur(error, message = 'Une erreur est survenue.') {
        console.error(message, error);
        const detail = error.details ? error.details.erreur : (error.message || JSON.stringify(error));
        afficherNotification(`${message} ${detail}`, 'error');
    }

    function afficherNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }

    function formaterDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    initialiserInterface();
});