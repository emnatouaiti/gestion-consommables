Architecture frontend - Angular (recommandations)

Structure recommandée:

- src/app/
  - core/         # services singleton, interceptors, guards, models partagés
  - shared/       # components réutilisables, pipes, directives
  - features/     # feature modules (ex: admin/, auth/, dashboard/)
  - app-routing-module.ts
  - app.module.ts

Bonnes pratiques:

- Chaque dossier dans `features/` doit être un module autonome (lazy-loaded si pertinent).
- `features/admin` doit contenir uniquement les composants/services relatifs à l'administration.
- Séparer `core` (singletons) de `feature` (scoped) — évitez d'exposer services non nécessaires globalement.
- Utiliser des `services` situés au niveau du feature pour la logique spécifique, et `core/services` pour l'API/connexion globale.
- Préférer des interfaces (models) dans `core/models` pour typage partagé.
- Garder les composants petits et testables; exporter les composants réutilisables depuis `shared/components`.
- Documenter les routes lazy-load dans `app-routing-module.ts`.
