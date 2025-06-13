// Script pour l'interface Administrateur

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier l'authentification et les droits
    if (!verifierAuthentification() || !api.peutAccederAdmin()) {
        window.location.href = '/';
        return;
    }

    // Éléments du DOM
    const btnDeconnexion = document.getElementById('btnDeconnexion');
    const btnAjouterClient = document.getElementById('btnAjouterClient');
    const btnExporter = document.getElementById('btnExporter');
    const btnImporter = document.getElementById('btnImporter');
    const importFileInput = document.getElementById('importFile');
    const btnActualiserStats = document.getElementById('btnActualiserStats');

    // Modal et formulaire
    const clientModal = document.getElementById('clientModal');
    const clientForm = document.getElementById('clientForm');
    const closeModal = document.querySelector('.close');
    const btnCancel = document.querySelector('.btn-cancel');

    // Filtres
    const filtreStatut = document.getElementById('filtreStatut');
    const filtreEntree = document.getElementById('filtreEntree');
    const rechercheClient = document.getElementById('rechercheClient');

    // Variables d'état
    let clients = [];

    // Initialisation
    initialiserInterface();

    // Gestionnaires d'événements
    btnDeconnexion.addEventListener('click', function() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            api.deconnexion();
        }
    });

    btnAjouterClient.addEventListener('click', function() {
        ouvrirModal();
    });

    btnExporter.addEventListener('click', function() {
        exporterDonnees();
    });

    btnImporter.addEventListener('click', function() {
        importFileInput.click(); // Ouvre la boîte de dialogue de sélection de fichier
    });

    importFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            importerClients(file);
        }
    });

    btnActualiserStats.addEventListener('click', function() {
        chargerStatistiques();
    });

    // Formulaire d'ajout de client
    clientForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await ajouterClient();
    });

    // Fermeture du modal
    closeModal.addEventListener('click', fermerModal);
    btnCancel.addEventListener('click', fermerModal);

    // Fermer le modal en cliquant à l'extérieur
    clientModal.addEventListener('click', function(e) {
        if (e.target === clientModal) {
            fermerModal();
        }
    });

    // Filtres et recherche
    filtreStatut.addEventListener('change', filtrerClients);
    filtreEntree.addEventListener('change', filtrerClients);
    rechercheClient.addEventListener('input', filtrerClients);

    // Fonctions principales
    async function initialiserInterface() {
        try {
            const utilisateur = api.obtenirUtilisateurConnecte();
            document.getElementById('userName').textContent = utilisateur.nom;

            await Promise.all([
                chargerStatistiques(),
                chargerClients()
            ]);

            afficherNotification('Interface chargée avec succès', 'success');
        } catch (error) {
            gererErreur(error);
        }
    }

    async function chargerStatistiques() {
        try {
            const btnActualiser = document.getElementById('btnActualiserStats');
            const iconOriginal = btnActualiser.innerHTML;
            btnActualiser.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
            btnActualiser.disabled = true;

            const stats = await api.obtenirStatistiques();
            
            document.getElementById('totalClients').textContent = stats.totalClients || 0;
            document.getElementById('clientsPayes').textContent = stats.clientsPayes || 0;
            document.getElementById('clientsEntres').textContent = stats.clientsEntres || 0;
            document.getElementById('clientsEnAttente').textContent = stats.clientsEnAttente || 0;

            btnActualiser.innerHTML = iconOriginal;
            btnActualiser.disabled = false;
        } catch (error) {
            gererErreur(error);
            const btnActualiser = document.getElementById('btnActualiserStats');
            btnActualiser.innerHTML = '<i class="fas fa-sync-alt"></i> Actualiser';
            btnActualiser.disabled = false;
        }
    }

    async function chargerClients() {
        try {
            clients = await api.obtenirClients();
            afficherClients(clients);
        } catch (error) {
            gererErreur(error);
        }
    }

    function afficherClients(clientsAffiches) {
        const tbody = document.getElementById('listeClients');
        
        if (!clientsAffiches || clientsAffiches.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>Aucun client trouvé</h3>
                        <p>Aucun client ne correspond aux critères de recherche</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = clientsAffiches.map(client => `
            <tr>
                <td data-label="Nom">${client.nom}</td>
                <td data-label="Prénom">${client.prenom}</td>
                <td data-label="Email">${client.email || '-'}</td>
                <td data-label="Téléphone">${client.telephone || '-'}</td>
                <td data-label="Statut">
                    <span class="badge ${client.statut_paiement === 'paye' ? 'badge-paye' : 'badge-non-paye'}">
                        ${client.statut_paiement === 'paye' ? 'Payé' : 'Non payé'}
                    </span>
                </td>
                <td data-label="Entrée">
                    <span class="badge ${client.est_entre ? 'badge-entre' : 'badge-en-attente'}">
                        ${client.est_entre ? `Entré le ${formaterDate(client.heure_entree)}` : 'En attente'}
                    </span>
                </td>
                <td data-label="Créé le">${formaterDate(client.cree_le)}</td>
            </tr>
        `).join('');
    }

    async function ajouterClient() {
        try {
            const nom = document.getElementById('clientNom').value.trim();
            const prenom = document.getElementById('clientPrenom').value.trim();
            const email = document.getElementById('clientEmail').value.trim();
            const telephone = document.getElementById('clientTelephone').value.trim();

            if (!nom || !prenom) {
                afficherNotification('Nom et prénom sont requis', 'error');
                return;
            }

            // Validation de l'email
            if (email && !validerEmail(email)) {
                afficherNotification('Format d\'email invalide', 'error');
                return;
            }

            // Validation du téléphone
            if (telephone && !validerTelephone(telephone)) {
                afficherNotification('Format de téléphone invalide', 'error');
                return;
            }

            const btnSubmit = clientForm.querySelector('.btn-submit');
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Ajout en cours...';

            await api.ajouterClient(nom, prenom, email, telephone);
            
            afficherNotification(`Client ${prenom} ${nom} ajouté avec succès`, 'success');
            fermerModal();
            clientForm.reset();
            
            // Recharger les données
            await Promise.all([
                chargerStatistiques(),
                chargerClients()
            ]);

            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Ajouter Client';
        } catch (error) {
            gererErreur(error);
            const btnSubmit = clientForm.querySelector('.btn-submit');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Ajouter Client';
        }
    }

    function filtrerClients() {
        const statutFiltre = filtreStatut.value;
        const entreeFiltre = filtreEntree.value;
        const recherche = rechercheClient.value.toLowerCase();

        let clientsFiltres = clients.filter(client => {
            // Filtre par statut
            if (statutFiltre && client.statut_paiement !== statutFiltre) {
                return false;
            }

            // Filtre par entrée
            if (entreeFiltre === 'entre' && !client.est_entre) {
                return false;
            }
            if (entreeFiltre === 'en_attente' && client.est_entre) {
                return false;
            }

            // Filtre par recherche
            if (recherche) {
                const texteRecherche = `${client.nom} ${client.prenom} ${client.email || ''} ${client.telephone || ''}`.toLowerCase();
                if (!texteRecherche.includes(recherche)) {
                    return false;
                }
            }

            return true;
        });

        afficherClients(clientsFiltres);
    }

    function exporterDonnees() {
        if (clients.length === 0) {
            afficherNotification('Aucune donnée à exporter', 'warning');
            return;
        }

        const donneesExport = clients.map(client => ({
            'Nom': client.nom,
            'Prénom': client.prenom,
            'Email': client.email || '',
            'Téléphone': client.telephone || '',
            'Statut Paiement': client.statut_paiement === 'paye' ? 'Payé' : 'Non payé',
            'Est Entré': client.est_entre ? 'Oui' : 'Non',
            'Heure Entrée': client.heure_entree ? formaterDate(client.heure_entree) : '',
            'Date d\'ajout': formaterDate(client.cree_le)
        }));

        // Utilisation de SheetJS pour créer un fichier Excel
        const worksheet = XLSX.utils.json_to_sheet(donneesExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

        // Déclencher le téléchargement
        XLSX.writeFile(workbook, `export_clients_${new Date().toISOString().slice(0,10)}.xlsx`);

        afficherNotification('Exportation vers Excel réussie !', 'success');
    }

    async function importerClients(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const clientsAImporter = XLSX.utils.sheet_to_json(worksheet);

                if (clientsAImporter.length === 0) {
                    afficherNotification('Le fichier est vide ou mal formaté.', 'warning');
                    return;
                }

                let succesCount = 0;
                let errorCount = 0;

                for (const client of clientsAImporter) {
                    // Normaliser les clés (Nom, Prénom, etc.)
                    const nom = client.Nom || client.nom;
                    const prenom = client.Prénom || client.prenom;
                    const email = client.Email || client.email;
                    const telephone = client.Téléphone || client.telephone;

                    if (nom && prenom) {
                        try {
                            await api.ajouterClient(nom, prenom, email, telephone);
                            succesCount++;
                        } catch (err) {
                            errorCount++;
                            console.error(`Erreur lors de l'ajout du client ${nom}:`, err);
                        }
                    }
                }

                afficherNotification(`${succesCount} client(s) importé(s) avec succès. ${errorCount} erreur(s).`, 'success');
                
                // Recharger les données
                await Promise.all([
                    chargerStatistiques(),
                    chargerClients()
                ]);

            } catch (error) {
                gererErreur(error, 'Erreur lors de la lecture du fichier. Assurez-vous que le format est correct.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function ouvrirModal() {
        clientModal.style.display = 'block';
        document.getElementById('clientNom').focus();
    }

    function fermerModal() {
        clientModal.style.display = 'none';
        clientForm.reset();
    }

    // Fonctions de validation
    function validerEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    function validerTelephone(telephone) {
        // Accepter différents formats de téléphone français
        const regex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/;
        const telephoneNettoye = telephone.replace(/[\s\-\.]/g, '');
        return regex.test(telephoneNettoye) || telephoneNettoye.length >= 8;
    }

    // Gestion des touches clavier
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && clientModal.style.display === 'block') {
            fermerModal();
        }
    });

    // Auto-actualisation des statistiques toutes les 30 secondes
    setInterval(function() {
        chargerStatistiques();
    }, 30000);
});