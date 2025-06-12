// Script pour la page de connexion

document.addEventListener('DOMContentLoaded', function() {
    // Éléments du DOM
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const superAdminSection = document.getElementById('superAdminSection');
    const btnAjouterAdmin = document.getElementById('btnAjouterAdmin');
    const btnAjouterEmploye = document.getElementById('btnAjouterEmploye');
    const userModal = document.getElementById('userModal');
    const userForm = document.getElementById('userForm');
    const closeModal = document.querySelector('.close');
    const btnCancel = document.querySelector('.btn-cancel');

    // Variables pour le modal
    let currentUserRole = '';

    // Vérifier si l'utilisateur est déjà connecté
    if (api.estConnecte()) {
        redirigerSelonRole();
        return;
    }

    // Gestionnaire de soumission du formulaire de connexion
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const nom = document.getElementById('nom').value.trim();
        const motDePasse = document.getElementById('motDePasse').value;

        if (!nom || !motDePasse) {
            afficherErreur('Veuillez remplir tous les champs');
            return;
        }

        try {
            // Désactiver le bouton pendant la connexion
            const btnLogin = loginForm.querySelector('.btn-login');
            btnLogin.disabled = true;
            btnLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';

            const resultat = await api.connexion(nom, motDePasse);
            
            if (resultat.utilisateur) {
                afficherNotification('Connexion réussie ! Redirection...', 'success');
                
                // Rediriger vers le tableau de bord approprié
                setTimeout(() => {
                    redirigerSelonRole();
                }, 1000);
            }
        } catch (error) {
            afficherErreur(error.message);
        } finally {
            // Réactiver le bouton
            const btnLogin = loginForm.querySelector('.btn-login');
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
        }
    });

    // Gestionnaires pour les boutons d'ajout d'utilisateurs
    btnAjouterAdmin.addEventListener('click', function() {
        ouvrirModalAjoutUtilisateur('admin', 'Ajouter un Administrateur');
    });

    btnAjouterEmploye.addEventListener('click', function() {
        ouvrirModalAjoutUtilisateur('employe', 'Ajouter un Employé');
    });

    // Gestionnaire de soumission du formulaire d'ajout d'utilisateur
    userForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const nom = document.getElementById('userName').value.trim();
        const motDePasse = document.getElementById('userPassword').value;

        if (!nom || !motDePasse) {
            afficherNotification('Veuillez remplir tous les champs', 'error');
            return;
        }

        if (motDePasse.length < 6) {
            afficherNotification('Le mot de passe doit contenir au moins 6 caractères', 'error');
            return;
        }

        try {
            const btnSubmit = userForm.querySelector('.btn-submit');
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Création...';

            await api.creerUtilisateur(nom, motDePasse, currentUserRole);
            
            const roleText = currentUserRole === 'admin' ? 'Administrateur' : 'Employé';
            afficherNotification(`${roleText} "${nom}" créé avec succès !`, 'success');
            
            fermerModal();
            userForm.reset();
            
        } catch (error) {
            afficherNotification(error.message, 'error');
        } finally {
            const btnSubmit = userForm.querySelector('.btn-submit');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Créer';
        }
    });

    // Gestionnaires pour fermer le modal
    closeModal.addEventListener('click', fermerModal);
    btnCancel.addEventListener('click', fermerModal);

    // Fermer le modal en cliquant à l'extérieur
    userModal.addEventListener('click', function(e) {
        if (e.target === userModal) {
            fermerModal();
        }
    });

    // Fonctions utilitaires
    function afficherErreur(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        
        // Masquer automatiquement après 5 secondes
        setTimeout(masquerErreur, 5000);
    }

    function masquerErreur() {
        errorMessage.classList.remove('show');
    }

    function ouvrirModalAjoutUtilisateur(role, titre) {
        currentUserRole = role;
        document.getElementById('modalTitle').textContent = titre;
        document.getElementById('userRole').value = role;
        userModal.style.display = 'block';
        
        // Focus sur le premier champ
        document.getElementById('userName').focus();
    }

    function fermerModal() {
        userModal.style.display = 'none';
        userForm.reset();
        currentUserRole = '';
    }

    // Gestion des touches clavier
    document.addEventListener('keydown', function(e) {
        // Fermer le modal avec Échap
        if (e.key === 'Escape' && userModal.style.display === 'block') {
            fermerModal();
        }
        
        // Soumettre le formulaire avec Entrée
        if (e.key === 'Enter' && document.activeElement.form === loginForm) {
            e.preventDefault();
            loginForm.dispatchEvent(new Event('submit'));
        }
    });

    // Animation des particules
    animerParticules();
});

// Fonction pour animer les particules décoratives
function animerParticules() {
    const particules = document.querySelectorAll('.particle');
    
    particules.forEach((particule, index) => {
        // Définir une position initiale aléatoire
        const randomX = Math.random() * 100;
        const randomY = Math.random() * 100;
        
        particule.style.left = randomX + '%';
        particule.style.top = randomY + '%';
        
        // Ajouter un délai d'animation unique
        particule.style.animationDelay = (index * 0.5) + 's';
        
        // Déplacer périodiquement les particules
        setInterval(() => {
            const newX = Math.random() * 100;
            const newY = Math.random() * 100;
            
            particule.style.transition = 'all 3s ease-in-out';
            particule.style.left = newX + '%';
            particule.style.top = newY + '%';
        }, 8000 + (index * 1000)); // Décalage pour éviter la synchronisation
    });
}