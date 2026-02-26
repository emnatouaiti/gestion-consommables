#!/bin/bash

# Script de vérification et de déploiement du système de gestion des consommables

echo "=========================================="
echo "Système de Gestion des Consommables"
echo "Script de Vérification et De Déploiement"
echo "=========================================="
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
CHECKS_PASSED=0
CHECKS_FAILED=0

# Fonction de vérification
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((CHECKS_FAILED++))
    fi
}

# Fonction d'avertissement
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "📋 VÉRIFICATIONS PRÉALABLES"
echo "=================================="

# Vérifier PHP
php -v > /dev/null 2>&1
check $? "PHP installé"

# Vérifier Composer
if command -v composer &> /dev/null; then
    check 0 "Composer installé"
else
    check 1 "Composer installé"
fi

# Vérifier Node.js
if command -v node &> /dev/null; then
    check 0 "Node.js installé"
else
    check 1 "Node.js installé"
fi

# Vérifier Angular CLI
if command -v ng &> /dev/null; then
    check 0 "Angular CLI installé"
else
    check 1 "Angular CLI installé"
fi

echo ""
echo "🏗️  VÉRIFICATION DE LA STRUCTURE"
echo "=================================="

# Vérifier les dossiers
[ -d "backend" ] && check 0 "Dossier backend existe" || check 1 "Dossier backend existe"
[ -d "frontend" ] && check 0 "Dossier frontend existe" || check 1 "Dossier frontend existe"

# Vérifier les fichiers clés du backend
[ -f "backend/artisan" ] && check 0 "Fichier artisan existe" || check 1 "Fichier artisan existe"
[ -f "backend/app/Models/ConsumableRequest.php" ] && check 0 "Modèle ConsumableRequest existe" || check 1 "Modèle ConsumableRequest existe"
[ -f "backend/app/Http/Controllers/ConsumableRequestController.php" ] && check 0 "Contrôleur ConsumableRequest existe" || check 1 "Contrôleur ConsumableRequest existe"

# Vérifier les fichiers clés du frontend
[ -f "frontend/src/app/consumable-request/consumable-request.ts" ] && check 0 "Composant frontend existe" || check 1 "Composant frontend existe"
[ -f "frontend/src/app/services/consumable-request.service.ts" ] && check 0 "Service frontend existe" || check 1 "Service frontend existe"

echo ""
echo "📦 INSTRUCTIONS DE DÉPLOIEMENT"
echo "=================================="

echo ""
echo "1️⃣  BACKEND - Démarrage"
echo "   $ cd backend"
echo "   $ composer install"
echo "   $ cp .env.example .env"
echo "   $ php artisan key:generate"
echo "   $ php artisan migrate"
echo "   $ php artisan serve"
echo ""

echo "2️⃣  FRONTEND - Démarrage"
echo "   $ cd frontend"
echo "   $ npm install"
echo "   $ ng serve"
echo ""

echo "3️⃣  TESTS"
echo "   $ cd backend"
echo "   $ php artisan test tests/Feature/ConsumableRequestTest.php"
echo ""

echo "=================================="
echo "📊 RÉSUMÉ"
echo "=================================="
echo -e "Vérifications réussies : ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Vérifications échouées : ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Tout est prêt pour le déploiement!${NC}"
else
    echo -e "${RED}✗ Veuillez corriger les problèmes détectés.${NC}"
fi

echo ""
echo "📚 Documentation"
echo "=================================="
echo "- CONSUMABLE_MANAGEMENT.md - Guide technique"
echo "- README_CONSUMABLES.md - Utilisation"
echo "- VERIFICATION.md - Checklist"
echo "- postman_collection.json - Tests API"
echo ""

echo "🎯 Endpoints API"
echo "=================================="
echo "GET    /api/consumable-requests"
echo "POST   /api/consumable-requests"
echo "PUT    /api/consumable-requests/{id}/approve"
echo "PUT    /api/consumable-requests/{id}/reject"
echo ""

echo "✨ Système prêt à l'emploi!"
