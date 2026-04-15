import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminStockService } from '../services/admin-stock.service';

interface StatItem {
  label: string;
  value: string;
  trend: string;
}

interface EventItem {
  title: string;
  meta: string;
  level: 'critical' | 'warning' | 'info';
}

interface WorkspaceConfig {
  title: string;
  description: string;
  stats: StatItem[];
  actions: string[];
  events: EventItem[];
  headers: string[];
  rows: string[][];
}

@Component({
  selector: 'app-admin-role-page',
  standalone: false,
  templateUrl: './admin-role-page.component.html',
  styleUrls: ['./admin-role-page.component.css']
})
export class AdminRolePageComponent implements OnInit {
  view = 'welcome';

  private readonly configMap: Record<string, WorkspaceConfig> = {
    welcome: {
      title: 'Espace de travail',
      description: 'Choisissez un module depuis la barre latérale pour commencer.',
      stats: [
        { label: 'Modules actifs', value: '8', trend: '+2 ce mois' },
        { label: 'Taux de service', value: '98.6%', trend: '+1.1%' },
        { label: 'Tâches ouvertes', value: '14', trend: '-3 aujourd\'hui' }
      ],
      actions: ['Analyser les indicateurs', 'Valider les demandes en attente', 'Consulter les dernières alertes'],
      events: [
        { title: 'Mise à jour des flux validée', meta: 'Il y a 12 min', level: 'info' },
        { title: 'Anomalie stock critique clôturée', meta: 'Il y a 47 min', level: 'warning' },
        { title: 'Pic de consommation détecté', meta: 'Il y a 1 h', level: 'critical' }
      ],
      headers: ['Module', 'Responsable', 'Statut', 'Échéance'],
      rows: [
        ['Validation des demandes', 'Direction', 'En cours', 'Aujourd\'hui'],
        ['Prévisions', 'Pilotage', 'À vérifier', 'Demain'],
        ['Gestion produits', 'Opérations', 'Stable', 'Semaine 08']
      ]
    },
    validation: {
      title: 'Validation des demandes',
      description: 'Priorisez, validez et suivez les demandes soumises par les équipes.',
      stats: [
        { label: 'Demandes à valider', value: '23', trend: '6 urgentes' },
        { label: 'Validées aujourd\'hui', value: '18', trend: '+20%' },
        { label: 'Délai moyen', value: '2h14', trend: '-35 min' }
      ],
      actions: ['Valider le lot prioritaire', 'Relancer les dossiers incomplets', 'Exporter le rapport journalier'],
      events: [
        { title: 'Demande #DM-219 approuvée', meta: 'Direction régionale', level: 'info' },
        { title: 'Demande #DM-224 en retard', meta: 'Dépassement SLA', level: 'warning' },
        { title: 'Demande #DM-228 bloquée', meta: 'Écart critique', level: 'critical' }
      ],
      headers: ['Référence', 'Type', 'Émetteur', 'Priorité'],
      rows: [
        ['DM-219', 'Achat', 'Agence Nord', 'Moyenne'],
        ['DM-224', 'Maintenance', 'Unité S1', 'Haute'],
        ['DM-228', 'Conformité', 'Qualité centrale', 'Critique']
      ]
    },
    anomalies: {
      title: 'Anomalies critiques',
      description: 'Vue consolidée des anomalies critiques et des actions de mitigation.',
      stats: [
        { label: 'Anomalies critiques', value: '7', trend: '-2 en 24h' },
        { label: 'Sites impactés', value: '4', trend: '1 site sous surveillance' },
        { label: 'Temps moyen de résolution', value: '5h40', trend: '-1h10' }
      ],
      actions: ['Escalader les incidents bloquants', 'Affecter une équipe d\'intervention', 'Recalculer le risque opérationnel'],
      events: [
        { title: 'Capteur CT-88 hors plage', meta: 'Site Tunis Est', level: 'critical' },
        { title: 'Données manquantes corrigées', meta: 'Pipeline import', level: 'warning' },
        { title: 'Anomalie A-140 résolue', meta: 'Contrôle qualité', level: 'info' }
      ],
      headers: ['Code', 'Site', 'Impact', 'Responsable'],
      rows: [
        ['A-143', 'Tunis Est', 'Élevé', 'Support N2'],
        ['A-144', 'Sfax Sud', 'Moyen', 'DataOps'],
        ['A-145', 'Bizerte', 'Élevé', 'Ops Terrain']
      ]
    },
    previsions: {
      title: 'Prévisions',
      description: 'Prévisions consolidées des besoins et tendances de consommation.',
      stats: [
        { label: 'Précision modèle', value: '94.2%', trend: '+0.9%' },
        { label: 'Horizon actif', value: '12 semaines', trend: 'Mise à jour auto' },
        { label: 'Écarts forts', value: '5', trend: '-1' }
      ],
      actions: ['Comparer scénario optimiste', 'Valider le plan d\'approvisionnement', 'Notifier les régions à risque'],
      events: [
        { title: 'Prévision hebdo recalculée', meta: 'Modèle V3.4', level: 'info' },
        { title: 'Écart majeur détecté', meta: 'Produit Lub-20', level: 'warning' },
        { title: 'Risque de rupture anticipé', meta: 'Zone Centre', level: 'critical' }
      ],
      headers: ['Période', 'Prévu', 'Réalisé', 'Écart'],
      rows: [
        ['Semaine 08', '1320 u', '1285 u', '-35 u'],
        ['Semaine 09', '1405 u', '1368 u', '-37 u'],
        ['Semaine 10', '1470 u', '-', '-']
      ]
    },
    categories: {
      title: 'Gérer catégories',
      description: 'Créez, modifiez et organisez les catégories de produits.',
      stats: [
        { label: 'Catégories actives', value: '24', trend: '+2 ce mois' },
        { label: 'Catégories inactives', value: '3', trend: '-1' },
        { label: 'Produits classés', value: '128', trend: 'Couverture 100%' }
      ],
      actions: ['Créer une catégorie', 'Mettre à jour les descriptions', 'Désactiver les catégories obsolètes'],
      events: [
        { title: 'Catégorie CAT-09 créée', meta: 'Par Admin', level: 'info' },
        { title: 'Catégorie CAT-03 sans produit', meta: 'Vérification requise', level: 'warning' },
        { title: 'Conflit de classification détecté', meta: 'Correction urgente', level: 'critical' }
      ],
      headers: ['Code', 'Catégorie', 'Produits', 'Statut'],
      rows: [
        ['CAT-01', 'Lubrifiants', '42', 'Active'],
        ['CAT-02', 'Additifs', '28', 'Active'],
        ['CAT-03', 'Consommables', '0', 'À revoir']
      ]
    },    produits: {
      title: 'Gérer produits',
      description: 'Catalogue produits, stocks et disponibilité opérationnelle.',
      stats: [
        { label: 'Produits actifs', value: '128', trend: '+3 nouveaux' },
        { label: 'Produits à risque', value: '11', trend: '-2' },
        { label: 'Stock moyen', value: '21 jours', trend: '+1 jour' }
      ],
      actions: ['Créer un nouveau produit', 'Ajuster les seuils minimum', 'Lancer l\'inventaire tournant'],
      events: [
        { title: 'Produit PR-408 créé', meta: 'Gammes industrielles', level: 'info' },
        { title: 'Stock faible sur PR-118', meta: 'Seuil atteint', level: 'warning' },
        { title: 'Rupture imminente PR-072', meta: 'Action immédiate', level: 'critical' }
      ],
      headers: ['Code', 'Produit', 'Stock', 'Statut'],
      rows: [
        ['PR-072', 'Huile Premium', '4 j', 'Critique'],
        ['PR-118', 'Additif A2', '7 j', 'Surveillance'],
        ['PR-408', 'Lubrifiant X', '28 j', 'Stable']
      ]
    },
    fournisseurs: {
      title: 'Gérer fournisseurs',
      description: 'Suivi fournisseurs, performance logistique et conformité.',
      stats: [
        { label: 'Fournisseurs actifs', value: '46', trend: '+1' },
        { label: 'Conformes SLA', value: '89%', trend: '+4%' },
        { label: 'Retards ouverts', value: '6', trend: '-3' }
      ],
      actions: ['Évaluer les fournisseurs en retard', 'Mettre à jour les contrats cadres', 'Programmer audit qualité'],
      events: [
        { title: 'Fournisseur FN-22 relancé', meta: 'Retard livraison', level: 'warning' },
        { title: 'Nouveau contrat signé', meta: 'Fournisseur FN-51', level: 'info' },
        { title: 'Non-conformité détectée', meta: 'Lot L-881', level: 'critical' }
      ],
      headers: ['Code', 'Fournisseur', 'SLA', 'Dernière livraison'],
      rows: [
        ['FN-22', 'PetroLink', '82%', 'En retard'],
        ['FN-36', 'SupplyOne', '95%', 'Conforme'],
        ['FN-51', 'Nordex', '98%', 'Conforme']
      ]
    },
    demandes: {
      title: 'Mes demandes',
      description: 'Suivez vos demandes, états de traitement et réponses reçues.',
      stats: [
        { label: 'Demandes ouvertes', value: '9', trend: '+1' },
        { label: 'Traitées ce mois', value: '24', trend: '+6' },
        { label: 'Taux de réponse', value: '93%', trend: '+2%' }
      ],
      actions: ['Créer une nouvelle demande', 'Joindre les documents manquants', 'Relancer les demandes en attente'],
      events: [
        { title: 'Demande DM-511 en revue', meta: 'Validateur assigné', level: 'info' },
        { title: 'Demande DM-507 incomplète', meta: 'Compléments requis', level: 'warning' },
        { title: 'Demande DM-499 rejetée', meta: 'Non-conformité', level: 'critical' }
      ],
      headers: ['Référence', 'Objet', 'Statut', 'Mise à jour'],
      rows: [
        ['DM-511', 'Ajustement seuil', 'En revue', 'Aujourd\'hui'],
        ['DM-507', 'Demande de stock', 'À compléter', 'Hier'],
        ['DM-499', 'Demande exceptionnelle', 'Rejetée', '12/02/2026']
      ]
    }
  };

  config: WorkspaceConfig = this.configMap['welcome'];

  constructor(private route: ActivatedRoute, private adminStockService: AdminStockService) {}

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.view = data['view'] || 'welcome';
      this.config = this.configMap[this.view] || this.configMap['welcome'];

      if (this.view === 'previsions') {
        this.adminStockService.getRecommendations().subscribe({
          next: (res: any) => {
            this.configMap['previsions'].stats = res.stats;
            this.configMap['previsions'].events = res.events;
            this.configMap['previsions'].rows = res.rows;
            // Trigger UI update
            this.config = this.configMap['previsions'];
          },
          error: (err) => console.error('Erreur previsions', err)
        });
      }
    });
  }

  levelClass(level: EventItem['level']): string {
    return `level-${level}`;
  }
}

