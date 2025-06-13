// Script pour l'interface Super Administrateur

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier l'authentification et les droits
    if (!verifierAuthentification() || !api.peutAccederSuperAdmin()) {
        window.location.href = '/';
        return;
    }

    // Éléments du DOM
    const btnDeconnexion = document.getElementById('btnDeconnexion');
    const btnAjouterClient = document.getElementById('btnAjouterClient');
    const btnOuvrirModalAjoutAdmin = document.getElementById('btnOuvrirModalAjoutAdmin');
    const btnOuvrirModalAjoutEmploye = document.getElementById('btnOuvrirModalAjoutEmploye');
    const btnImporter = document.getElementById('btnImporter');
    const importFileInput = document.getElementById('importFileInput');
    const btnExporter = document.getElementById('btnExporter');
    const btnActualiserStats = document.getElementById('btnActualiserStats');
    const btnActualiserLogs = document.getElementById('btnActualiserLogs');

    // Modales
    const clientModal = document.getElementById('clientModal');
    const userModal = document.getElementById('userModal');
    const userModalTitle = document.getElementById('userModalTitle');
    const clientForm = document.getElementById('clientForm');
    const userForm = document.getElementById('userForm');

    // Variable pour la logique de création
    let roleEnCoursDeCreation = null;

    // Filtres
    const filtreStatut = document.getElementById('filtreStatut');
    const filtreEntree = document.getElementById('filtreEntree');
    const rechercheClient = document.getElementById('rechercheClient');

    // Variables d'état
    let clients = [];
    let utilisateurs = [];
    let logs = [];

    // Initialisation
    initialiserInterface();

    // Gestionnaires d'événements
    btnDeconnexion.addEventListener('click', function() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            api.deconnexion();
        }
    });

    btnAjouterClient.addEventListener('click', function() {
        clientForm.reset();
        document.getElementById('clientModalTitle').innerHTML = '<i class="fas fa-user-plus"></i> Ajouter un Client';
        ouvrirModal('clientModal');
    });

    btnOuvrirModalAjoutAdmin.addEventListener('click', function() {
        // Réinitialiser manuellement les champs
        document.getElementById('newUserNameInput').value = '';
        document.getElementById('newUserPasswordInput').value = '';
        
        // Définir le rôle pour la création
        roleEnCoursDeCreation = 'admin';

        // Mettre à jour le titre de la modale
        document.getElementById('userModalTitle').innerHTML = `<i class="fas fa-user-tie"></i> Ajouter un Administrateur`;
        
        // Ouvrir la modale
        ouvrirModal('userModal');
    });

    btnOuvrirModalAjoutEmploye.addEventListener('click', function() {
        // Réinitialiser manuellement les champs
        document.getElementById('newUserNameInput').value = '';
        document.getElementById('newUserPasswordInput').value = '';
        
        // Définir le rôle pour la création
        roleEnCoursDeCreation = 'employe';

        // Mettre à jour le titre de la modale
        document.getElementById('userModalTitle').innerHTML = `<i class="fas fa-user-check"></i> Ajouter un Employé`;
        
        // Ouvrir la modale
        ouvrirModal('userModal');
    });

    btnImporter.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            importerClients(file);
        }
    });

    btnExporter.addEventListener('click', function() {
        exporterDonnees();
    });

    btnActualiserStats.addEventListener('click', function() {
        chargerStatistiques();
    });

    btnActualiserLogs.addEventListener('click', function() {
        chargerLogs();
    });

    // Formulaire d'ajout de client
    clientForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await ajouterClient();
    });

    // Formulaire d'ajout d'utilisateur
    userForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await creerUtilisateur();
    });

    // Filtres et recherche
    filtreStatut.addEventListener('change', filtrerClients);
    filtreEntree.addEventListener('change', filtrerClients);
    rechercheClient.addEventListener('input', filtrerClients);

    // Gestion des modales
    document.querySelectorAll('.close, .btn-cancel').forEach(element => {
        element.addEventListener('click', function(e) {
            const modalId = e.target.getAttribute('data-modal');
            if (modalId) {
                fermerModal(modalId);
            }
        });
    });

    // Fermer les modales en cliquant à l'extérieur
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                fermerModal(modal.id);
            }
        });
    });

    // Fonctions principales
    async function initialiserInterface() {
        try {
            const utilisateur = api.obtenirUtilisateurConnecte();
            document.getElementById('userName').textContent = utilisateur.nom;

            await Promise.all([
                chargerStatistiques(),
                chargerClients(),
                chargerUtilisateurs(),
                chargerLogs()
            ]);

            afficherNotification('Interface chargée avec succès', 'success');
        } catch (error) {
            gererErreur(error);
        }
    }

    async function chargerStatistiques() {
        try {
            const stats = await api.obtenirStatistiques();
            
            document.getElementById('totalClients').textContent = stats.totalClients || 0;
            document.getElementById('clientsPayes').textContent = stats.clientsPayes || 0;
            document.getElementById('clientsEntres').textContent = stats.clientsEntres || 0;
            document.getElementById('clientsEnAttente').textContent = stats.clientsEnAttente || 0;
        } catch (error) {
            gererErreur(error);
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

    async function chargerUtilisateurs() {
        try {
            utilisateurs = await api.obtenirUtilisateurs();
            afficherUtilisateurs(utilisateurs);
        } catch (error) {
            gererErreur(error);
        }
    }

    async function chargerLogs() {
        try {
            logs = await api.obtenirLogs();
            afficherLogs(logs);
        } catch (error) {
            gererErreur(error);
        }
    }

    function afficherClients(clientsAffiches) {
        const tbody = document.getElementById('listeClients');
        
        if (!clientsAffiches || clientsAffiches.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
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
                <td data-label="Ajouté par">${client.ajoute_par_nom || 'Système'}</td>
                <td data-label="Créé le">${formaterDate(client.cree_le)}</td>
                <td data-label="Actions">
                    <button class="btn-table btn-supprimer" onclick="supprimerClient(${client.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function afficherUtilisateurs(utilisateursAffiches) {
        const tbody = document.getElementById('listeUtilisateurs');
        const utilisateurConnecte = api.obtenirUtilisateurConnecte();
        
        if (!utilisateursAffiches || utilisateursAffiches.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-user-cog"></i>
                        <h3>Aucun utilisateur trouvé</h3>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = utilisateursAffiches.map(utilisateur => `
            <tr>
                <td data-label="Nom">${utilisateur.nom}</td>
                <td data-label="Rôle">
                    <span class="badge ${obtenirClasseBadgeRole(utilisateur.role)}">
                        ${formaterRole(utilisateur.role)}
                    </span>
                </td>
                <td data-label="Créé le">${formaterDate(utilisateur.cree_le)}</td>
                <td data-label="Actions">
                    ${utilisateur.id !== utilisateurConnecte.id ? `
                        <button class="btn-table btn-supprimer" onclick="supprimerUtilisateur(${utilisateur.id}, '${utilisateur.nom}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : '<span class="badge badge-super-admin">Vous</span>'}
                </td>
            </tr>
        `).join('');
    }

    function afficherLogs(logsAffiches) {
        const tbody = document.getElementById('listeLogs');
        
        if (!logsAffiches || logsAffiches.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-history"></i>
                        <h3>Aucune activité enregistrée</h3>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = logsAffiches.map(log => `
            <tr>
                <td data-label="Date">${formaterDate(log.horodatage)}</td>
                <td data-label="Utilisateur">${log.utilisateur_nom || 'Système'}</td>
                <td data-label="Action">
                    <span class="badge ${obtenirClasseBadgeAction(log.action)}">
                        ${formaterAction(log.action)}
                    </span>
                </td>
                <td data-label="Détails">${log.details || '-'}</td>
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

            await api.ajouterClient(nom, prenom, email, telephone);
            
            afficherNotification(`Client ${prenom} ${nom} ajouté avec succès`, 'success');
            fermerModal('clientModal');
            clientForm.reset();
            
            // Recharger les données
            await Promise.all([
                chargerStatistiques(),
                chargerClients()
            ]);
        } catch (error) {
            gererErreur(error);
        }
    }

    async function creerUtilisateur() {
        const nom = document.getElementById('newUserNameInput').value.trim();
        const motDePasse = document.getElementById('newUserPasswordInput').value.trim();
        const role = roleEnCoursDeCreation;



        if (!nom || !motDePasse || !role) {
            afficherNotification('Veuillez remplir tous les champs obligatoires.', 'error');
            return;
        }

        try {
            // L'appel API attend des arguments séparés, pas un objet
            await api.creerUtilisateur(nom, motDePasse, role);
            afficherNotification(`Utilisateur "${nom}" (${role}) créé avec succès.`, 'success');
            
            fermerModal('userModal');
            userForm.reset();
            
            await chargerUtilisateurs(); // Recharger la liste des utilisateurs

        } catch (error) {
            gererErreur(error, "Erreur lors de la création de l'utilisateur");
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

    async function importerClients(file) {
        if (!confirm(`Êtes-vous sûr de vouloir importer les clients depuis le fichier "${file.name}" ?`)) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                let workbook;

                // Détecter si le fichier est un CSV pour gérer les délimiteurs
                const isCsv = file.name.toLowerCase().endsWith('.csv');

                if (isCsv) {
                    // Convertir le buffer en texte
                    const decoder = new TextDecoder('utf-8');
                    let text = decoder.decode(data);

                    // Remplacer les points-virgules par des virgules pour uniformiser
                    // Cela rend l'importation robuste aux configurations régionales d'Excel
                    text = text.replace(/;/g, ',');
                    
                    workbook = XLSX.read(text, { type: 'string' });
                } else {
                    // Logique originale pour les fichiers XLSX
                    workbook = XLSX.read(data, { type: 'array' });
                }

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const clientsAImporter = XLSX.utils.sheet_to_json(worksheet, { raw: true });

                if (clientsAImporter.length === 0) {
                    afficherNotification('Le fichier est vide ou ne contient pas de données lisibles.', 'warning');
                    return;
                }

                let succesCount = 0;
                let errorCount = 0;

                // Traiter les ajouts en parallèle
                await Promise.all(clientsAImporter.map(async (client) => {
                    // Normaliser les clés (Nom, Prénom, etc.)
                    const nom = client['Nom'] || client['nom'];
                    const prenom = client['Prénom'] || client['prenom'];
                    const email = client['Email'] || client['email'];
                    const telephone = client['Téléphone'] || client['telephone'];

                    if (!nom || !prenom) {
                        console.warn('Ligne ignorée (nom ou prénom manquant):', client);
                        errorCount++;
                        return;
                    }

                    try {
                        await api.ajouterClient(nom, prenom, email, telephone);
                        succesCount++;
                    } catch (err) {
                        console.error(`Erreur lors de l'ajout du client ${nom} ${prenom}:`, err);
                        errorCount++;
                    }
                }));

                afficherNotification(`${succesCount} client(s) importé(s) avec succès. ${errorCount > 0 ? `${errorCount} erreur(s).` : ''}`, 'success');
                
                // Recharger les données pour refléter les ajouts
                await chargerClients();
                await chargerStatistiques();

            } catch (error) {
                gererErreur(error, "Erreur lors de la lecture du fichier d'import.");
            }
        };

        reader.onerror = (error) => {
            gererErreur(error, "Impossible de lire le fichier.");
        };

        // Lire le fichier en tant que buffer, la conversion en texte sera faite si nécessaire
        reader.readAsArrayBuffer(file);
    }

    function exporterDonnees() {
        if (clients.length === 0) {
            afficherNotification('Aucune donnée à exporter', 'warning');
            return;
        }

        // Préparer les données pour l'export
        const donneesExport = clients.map(client => ({
            'Nom': client.nom,
            'Prénom': client.prenom,
            'Email': client.email || '',
            'Téléphone': client.telephone || '',
            'Statut Paiement': client.statut_paiement === 'paye' ? 'Payé' : 'Non payé',
            'Est Entré': client.est_entre ? 'Oui' : 'Non',
            'Heure Entrée': client.heure_entree ? formaterDate(client.heure_entree) : '',
            'Ajouté Par': client.ajoute_par_nom || 'Système',
            'Date d\'ajout': formaterDate(client.cree_le)
        }));

        exporterEnCSV(donneesExport, 'clients_break_and_play');
    }

    function ouvrirModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    function fermerModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        

    }





    // Fonctions utilitaires
    function obtenirClasseBadgeAction(action) {
        const classes = {
            'CONNEXION': 'badge-entre',
            'AJOUT_CLIENT': 'badge-paye',
            'VALIDATION_ENTREE': 'badge-entre',
            'CREATION_UTILISATEUR': 'badge-admin',
            'SUPPRESSION_UTILISATEUR': 'badge-non-paye'
        };
        return classes[action] || 'badge-en-attente';
    }

    function formaterAction(action) {
        const actions = {
            'CONNEXION': 'Connexion',
            'AJOUT_CLIENT': 'Ajout Client',
            'VALIDATION_ENTREE': 'Validation Entrée',
            'CREATION_UTILISATEUR': 'Création Utilisateur',
            'SUPPRESSION_UTILISATEUR': 'Suppression Utilisateur'
        };
        return actions[action] || action;
    }

    // Fonctions globales pour les boutons
    window.supprimerClient = async function(clientId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
            return;
        }

        try {
            await api.supprimerClient(clientId);
            afficherNotification('Client supprimé avec succès.', 'success');
            // Recharger les données pour mettre à jour l'interface
            chargerClients();
        } catch (error) {
            gererErreur(error);
        }
    };

    window.supprimerUtilisateur = async function(utilisateurId, nom) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${nom}" ?`)) {
            return;
        }

        try {
            await api.supprimerUtilisateur(utilisateurId);
            afficherNotification(`Utilisateur "${nom}" supprimé avec succès`, 'success');
            await chargerUtilisateurs();
        } catch (error) {
            gererErreur(error);
        }
    };
});