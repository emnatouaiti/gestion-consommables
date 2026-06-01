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
      description: 'Choisissez un module depuis la barre lat�rale pour commencer.',
      stats: [
        { label: 'Modules actifs', value: '8', trend: '+2 ce mois' },
        { label: 'Taux de service', value: '98.6%', trend: '+1.1%' },
        { label: 'T�ches ouvertes', value: '14', trend: '-3 aujourd\'hui' }
      ],
      actions: ['Analyser les indicateurs', 'Valider les demandes en attente', 'Consulter les derni�res alertes'],
      events: [
        { title: 'Mise � jour des flux valid�e', meta: 'Il y a 12 min', level: 'info' },
        { title: 'Anomalie stock critique cl�tur�e', meta: 'Il y a 47 min', level: 'warning' },
        { title: 'Pic de consommation d�tect�', meta: 'Il y a 1 h', level: 'critical' }
      ],
      headers: ['Module', 'Responsable', 'Statut', '�ch�ance'],
      rows: [
        ['Validation des demandes', 'Direction', 'En cours', 'Aujourd\'hui'],
        ['Pr�visions', 'Pilotage', '� v�rifier', 'Demain'],
        ['Gestion produits', 'Op�rations', 'Stable', 'Semaine 08']
      ]
    },
    validation: {
      title: 'Validation des demandes',
      description: 'Priorisez, validez et suivez les demandes soumises par les �quipes.',
      stats: [
        { label: 'Demandes � valider', value: '23', trend: '6 urgentes' },
        { label: 'Valid�es aujourd\'hui', value: '18', trend: '+20%' },
        { label: 'D�lai moyen', value: '2h14', trend: '-35 min' }
      ],
      actions: ['Valider le lot prioritaire', 'Relancer les dossiers incomplets', 'Exporter le rapport journalier'],
      events: [
        { title: 'Demande #DM-219 approuv�e', meta: 'Direction r�gionale', level: 'info' },
        { title: 'Demande #DM-224 en retard', meta: 'D�passement SLA', level: 'warning' },
        { title: 'Demande #DM-228 bloqu�e', meta: '�cart critique', level: 'critical' }
      ],
      headers: ['R�f�rence', 'Type', '�metteur', 'Priorit�'],
      rows: [
        ['DM-219', 'Achat', 'Agence Nord', 'Moyenne'],
        ['DM-224', 'Maintenance', 'Unit� S1', 'Haute'],
        ['DM-228', 'Conformit�', 'Qualit� centrale', 'Critique']
      ]
    },
    anomalies: {
      title: 'Anomalies critiques',
      description: 'Vue consolid�e des anomalies critiques et des actions de mitigation.',
      stats: [
        { label: 'Anomalies critiques', value: '7', trend: '-2 en 24h' },
        { label: 'Sites impact�s', value: '4', trend: '1 site sous surveillance' },
        { label: 'Temps moyen de r�solution', value: '5h40', trend: '-1h10' }
      ],
      actions: ['Escalader les incidents bloquants', 'Affecter une �quipe d\'intervention', 'Recalculer le risque op�rationnel'],
      events: [
        { title: 'Capteur CT-88 hors plage', meta: 'Site Tunis Est', level: 'critical' },
        { title: 'Donn�es manquantes corrig�es', meta: 'Pipeline import', level: 'warning' },
        { title: 'Anomalie A-140 r�solue', meta: 'Contr�le qualit�', level: 'info' }
      ],
      headers: ['Code', 'Site', 'Impact', 'Responsable'],
      rows: [
        ['A-143', 'Tunis Est', '�lev�', 'Support N2'],
        ['A-144', 'Sfax Sud', 'Moyen', 'DataOps'],
        ['A-145', 'Bizerte', '�lev�', 'Ops Terrain']
      ]
    },
    previsions: {
      title: 'Pr�visions',
      description: 'Pr�visions consolid�es des besoins et tendances de consommation.',
      stats: [
        { label: 'Pr�cision mod�le', value: '94.2%', trend: '+0.9%' },
        { label: 'Horizon actif', value: '12 semaines', trend: 'Mise � jour auto' },
        { label: '�carts forts', value: '5', trend: '-1' }
      ],
      actions: ['Comparer sc�nario optimiste', 'Valider le plan d\'approvisionnement', 'Notifier les r�gions � risque'],
      events: [
        { title: 'Pr�vision hebdo recalcul�e', meta: 'Mod�le V3.4', level: 'info' },
        { title: '�cart majeur d�tect�', meta: 'Produit Lub-20', level: 'warning' },
        { title: 'Risque de rupture anticip�', meta: 'Zone Centre', level: 'critical' }
      ],
      headers: ['P�riode', 'Pr�vu', 'R�alis�', '�cart'],
      rows: [
        ['Semaine 08', '1320 u', '1285 u', '-35 u'],
        ['Semaine 09', '1405 u', '1368 u', '-37 u'],
        ['Semaine 10', '1470 u', '-', '-']
      ]
    },
    categories: {
      title: 'G�rer cat�gories',
      description: 'Cr�ez, modifiez et organisez les cat�gories de produits.',
      stats: [
        { label: 'Cat�gories actives', value: '24', trend: '+2 ce mois' },
        { label: 'Cat�gories inactives', value: '3', trend: '-1' },
        { label: 'Produits class�s', value: '128', trend: 'Couverture 100%' }
      ],
      actions: ['Cr�er une cat�gorie', 'Mettre � jour les descriptions', 'D�sactiver les cat�gories obsol�tes'],
      events: [
        { title: 'Cat�gorie CAT-09 cr��e', meta: 'Par Admin', level: 'info' },
        { title: 'Cat�gorie CAT-03 sans produit', meta: 'V�rification requise', level: 'warning' },
        { title: 'Conflit de classification d�tect�', meta: 'Correction urgente', level: 'critical' }
      ],
      headers: ['Code', 'Cat�gorie', 'Produits', 'Statut'],
      rows: [
        ['CAT-01', 'Lubrifiants', '42', 'Active'],
        ['CAT-02', 'Additifs', '28', 'Active'],
        ['CAT-03', 'Consommables', '0', '� revoir']
      ]
    },    produits: {
      title: 'G�rer produits',
      description: 'Catalogue produits, stocks et disponibilit� op�rationnelle.',
      stats: [
        { label: 'Produits actifs', value: '128', trend: '+3 nouveaux' },
        { label: 'Produits � risque', value: '11', trend: '-2' },
        { label: 'Stock moyen', value: '21 jours', trend: '+1 jour' }
      ],
      actions: ['Cr�er un nouveau produit', 'Ajuster les seuils minimum', 'Lancer l\'inventaire tournant'],
      events: [
        { title: 'Produit PR-408 cr��', meta: 'Gammes industrielles', level: 'info' },
        { title: 'Stock faible sur PR-118', meta: 'Seuil atteint', level: 'warning' },
        { title: 'Rupture imminente PR-072', meta: 'Action imm�diate', level: 'critical' }
      ],
      headers: ['Code', 'Produit', 'Stock', 'Statut'],
      rows: [
        ['PR-072', 'Huile Premium', '4 j', 'Critique'],
        ['PR-118', 'Additif A2', '7 j', 'Surveillance'],
        ['PR-408', 'Lubrifiant X', '28 j', 'Stable']
      ]
    },
    fournisseurs: {
      title: 'G�rer fournisseurs',
      description: 'Suivi fournisseurs, performance logistique et conformit�.',
      stats: [
        { label: 'Fournisseurs actifs', value: '46', trend: '+1' },
        { label: 'Conformes SLA', value: '89%', trend: '+4%' },
        { label: 'Retards ouverts', value: '6', trend: '-3' }
      ],
      actions: ['�valuer les fournisseurs en retard', 'Mettre � jour les contrats cadres', 'Programmer audit qualit�'],
      events: [
        { title: 'Fournisseur FN-22 relanc�', meta: 'Retard livraison', level: 'warning' },
        { title: 'Nouveau contrat sign�', meta: 'Fournisseur FN-51', level: 'info' },
        { title: 'Non-conformit� d�tect�e', meta: 'Lot L-881', level: 'critical' }
      ],
      headers: ['Code', 'Fournisseur', 'SLA', 'Derni�re livraison'],
      rows: [
        ['FN-22', 'PetroLink', '82%', 'En retard'],
        ['FN-36', 'SupplyOne', '95%', 'Conforme'],
        ['FN-51', 'Nordex', '98%', 'Conforme']
      ]
    },
    demandes: {
      title: 'Mes demandes',
      description: 'Suivez vos demandes, �tats de traitement et r�ponses re�ues.',
      stats: [
        { label: 'Demandes ouvertes', value: '9', trend: '+1' },
        { label: 'Trait�es ce mois', value: '24', trend: '+6' },
        { label: 'Taux de r�ponse', value: '93%', trend: '+2%' }
      ],
      actions: ['Cr�er une nouvelle demande', 'Joindre les documents manquants', 'Relancer les demandes en attente'],
      events: [
        { title: 'Demande DM-511 en revue', meta: 'Validateur assign�', level: 'info' },
        { title: 'Demande DM-507 incompl�te', meta: 'Compl�ments requis', level: 'warning' },
        { title: 'Demande DM-499 rejet�e', meta: 'Non-conformit�', level: 'critical' }
      ],
      headers: ['R�f�rence', 'Objet', 'Statut', 'Mise � jour'],
      rows: [
        ['DM-511', 'Ajustement seuil', 'En revue', 'Aujourd\'hui'],
        ['DM-507', 'Demande de stock', '� compl�ter', 'Hier'],
        ['DM-499', 'Demande exceptionnelle', 'Rejet�e', '12/02/2026']
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

