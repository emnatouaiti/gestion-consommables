import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminStockService } from '../../core/services/admin-stock.service';

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
      description: 'Choisissez un module depuis la barre laterale pour commencer.',
      stats: [
        { label: 'Modules actifs', value: '8', trend: '+2 ce mois' },
        { label: 'Taux de service', value: '98.6%', trend: '+1.1%' },
        { label: 'Teches ouvertes', value: '14', trend: '-3 aujourd\'hui' }
      ],
      actions: ['Analyser les indicateurs', 'Valider les demandes en attente', 'Consulter les dernieres alertes'],
      events: [
        { title: 'Mise e jour des flux validee', meta: 'Il y a 12 min', level: 'info' },
        { title: 'Anomalie stock critique cleturee', meta: 'Il y a 47 min', level: 'warning' },
        { title: 'Pic de consommation detecte', meta: 'Il y a 1 h', level: 'critical' }
      ],
      headers: ['Module', 'Responsable', 'Statut', 'echeance'],
      rows: [
        ['Validation des demandes', 'Direction', 'En cours', 'Aujourd\'hui'],
        ['Previsions', 'Pilotage', 'e verifier', 'Demain'],
        ['Gestion produits', 'Operations', 'Stable', 'Semaine 08']
      ]
    },
    validation: {
      title: 'Validation des demandes',
      description: 'Priorisez, validez et suivez les demandes soumises par les equipes.',
      stats: [
        { label: 'Demandes e valider', value: '23', trend: '6 urgentes' },
        { label: 'Validees aujourd\'hui', value: '18', trend: '+20%' },
        { label: 'Delai moyen', value: '2h14', trend: '-35 min' }
      ],
      actions: ['Valider le lot prioritaire', 'Relancer les dossiers incomplets', 'Exporter le rapport journalier'],
      events: [
        { title: 'Demande #DM-219 approuvee', meta: 'Direction regionale', level: 'info' },
        { title: 'Demande #DM-224 en retard', meta: 'Depassement SLA', level: 'warning' },
        { title: 'Demande #DM-228 bloquee', meta: 'ecart critique', level: 'critical' }
      ],
      headers: ['Reference', 'Type', 'emetteur', 'Priorite'],
      rows: [
        ['DM-219', 'Achat', 'Agence Nord', 'Moyenne'],
        ['DM-224', 'Maintenance', 'Unite S1', 'Haute'],
        ['DM-228', 'Conformite', 'Qualite centrale', 'Critique']
      ]
    },
    anomalies: {
      title: 'Anomalies critiques',
      description: 'Vue consolidee des anomalies critiques et des actions de mitigation.',
      stats: [
        { label: 'Anomalies critiques', value: '7', trend: '-2 en 24h' },
        { label: 'Sites impactes', value: '4', trend: '1 site sous surveillance' },
        { label: 'Temps moyen de resolution', value: '5h40', trend: '-1h10' }
      ],
      actions: ['Escalader les incidents bloquants', 'Affecter une equipe d\'intervention', 'Recalculer le risque operationnel'],
      events: [
        { title: 'Capteur CT-88 hors plage', meta: 'Site Tunis Est', level: 'critical' },
        { title: 'Donnees manquantes corrigees', meta: 'Pipeline import', level: 'warning' },
        { title: 'Anomalie A-140 resolue', meta: 'Controle qualite', level: 'info' }
      ],
      headers: ['Code', 'Site', 'Impact', 'Responsable'],
      rows: [
        ['A-143', 'Tunis Est', 'eleve', 'Support N2'],
        ['A-144', 'Sfax Sud', 'Moyen', 'DataOps'],
        ['A-145', 'Bizerte', 'eleve', 'Ops Terrain']
      ]
    },
    previsions: {
      title: 'Previsions',
      description: 'Previsions consolidees des besoins et tendances de consommation.',
      stats: [
        { label: 'Precision modele', value: '94.2%', trend: '+0.9%' },
        { label: 'Horizon actif', value: '12 semaines', trend: 'Mise e jour auto' },
        { label: 'ecarts forts', value: '5', trend: '-1' }
      ],
      actions: ['Comparer scenario optimiste', 'Valider le plan d\'approvisionnement', 'Notifier les regions e risque'],
      events: [
        { title: 'Prevision hebdo recalculee', meta: 'Modele V3.4', level: 'info' },
        { title: 'ecart majeur detecte', meta: 'Produit Lub-20', level: 'warning' },
        { title: 'Risque de rupture anticipe', meta: 'Zone Centre', level: 'critical' }
      ],
      headers: ['Periode', 'Prevu', 'Realise', 'ecart'],
      rows: [
        ['Semaine 08', '1320 u', '1285 u', '-35 u'],
        ['Semaine 09', '1405 u', '1368 u', '-37 u'],
        ['Semaine 10', '1470 u', '-', '-']
      ]
    },
    categories: {
      title: 'Gerer categories',
      description: 'Creez, modifiez et organisez les categories de produits.',
      stats: [
        { label: 'Categories actives', value: '24', trend: '+2 ce mois' },
        { label: 'Categories inactives', value: '3', trend: '-1' },
        { label: 'Produits classes', value: '128', trend: 'Couverture 100%' }
      ],
      actions: ['Creer une categorie', 'Mettre e jour les descriptions', 'Desactiver les categories obsoletes'],
      events: [
        { title: 'Categorie CAT-09 creee', meta: 'Par Admin', level: 'info' },
        { title: 'Categorie CAT-03 sans produit', meta: 'Verification requise', level: 'warning' },
        { title: 'Conflit de classification detecte', meta: 'Correction urgente', level: 'critical' }
      ],
      headers: ['Code', 'Categorie', 'Produits', 'Statut'],
      rows: [
        ['CAT-01', 'Lubrifiants', '42', 'Active'],
        ['CAT-02', 'Additifs', '28', 'Active'],
        ['CAT-03', 'Consommables', '0', 'e revoir']
      ]
    },    produits: {
      title: 'Gerer produits',
      description: 'Catalogue produits, stocks et disponibilite operationnelle.',
      stats: [
        { label: 'Produits actifs', value: '128', trend: '+3 nouveaux' },
        { label: 'Produits e risque', value: '11', trend: '-2' },
        { label: 'Stock moyen', value: '21 jours', trend: '+1 jour' }
      ],
      actions: ['Creer un nouveau produit', 'Ajuster les seuils minimum', 'Lancer l\'inventaire tournant'],
      events: [
        { title: 'Produit PR-408 cree', meta: 'Gammes industrielles', level: 'info' },
        { title: 'Stock faible sur PR-118', meta: 'Seuil atteint', level: 'warning' },
        { title: 'Rupture imminente PR-072', meta: 'Action immediate', level: 'critical' }
      ],
      headers: ['Code', 'Produit', 'Stock', 'Statut'],
      rows: [
        ['PR-072', 'Huile Premium', '4 j', 'Critique'],
        ['PR-118', 'Additif A2', '7 j', 'Surveillance'],
        ['PR-408', 'Lubrifiant X', '28 j', 'Stable']
      ]
    },
    fournisseurs: {
      title: 'Gerer fournisseurs',
      description: 'Suivi fournisseurs, performance logistique et conformite.',
      stats: [
        { label: 'Fournisseurs actifs', value: '46', trend: '+1' },
        { label: 'Conformes SLA', value: '89%', trend: '+4%' },
        { label: 'Retards ouverts', value: '6', trend: '-3' }
      ],
      actions: ['evaluer les fournisseurs en retard', 'Mettre e jour les contrats cadres', 'Programmer audit qualite'],
      events: [
        { title: 'Fournisseur FN-22 relance', meta: 'Retard livraison', level: 'warning' },
        { title: 'Nouveau contrat signe', meta: 'Fournisseur FN-51', level: 'info' },
        { title: 'Non-conformite detectee', meta: 'Lot L-881', level: 'critical' }
      ],
      headers: ['Code', 'Fournisseur', 'SLA', 'Derniere livraison'],
      rows: [
        ['FN-22', 'PetroLink', '82%', 'En retard'],
        ['FN-36', 'SupplyOne', '95%', 'Conforme'],
        ['FN-51', 'Nordex', '98%', 'Conforme']
      ]
    },
    demandes: {
      title: 'Mes demandes',
      description: 'Suivez vos demandes, etats de traitement et reponses reeues.',
      stats: [
        { label: 'Demandes ouvertes', value: '9', trend: '+1' },
        { label: 'Traitees ce mois', value: '24', trend: '+6' },
        { label: 'Taux de reponse', value: '93%', trend: '+2%' }
      ],
      actions: ['Creer une nouvelle demande', 'Joindre les documents manquants', 'Relancer les demandes en attente'],
      events: [
        { title: 'Demande DM-511 en revue', meta: 'Validateur assigne', level: 'info' },
        { title: 'Demande DM-507 incomplete', meta: 'Complements requis', level: 'warning' },
        { title: 'Demande DM-499 rejetee', meta: 'Non-conformite', level: 'critical' }
      ],
      headers: ['Reference', 'Objet', 'Statut', 'Mise e jour'],
      rows: [
        ['DM-511', 'Ajustement seuil', 'En revue', 'Aujourd\'hui'],
        ['DM-507', 'Demande de stock', 'e completer', 'Hier'],
        ['DM-499', 'Demande exceptionnelle', 'Rejetee', '12/02/2026']
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

