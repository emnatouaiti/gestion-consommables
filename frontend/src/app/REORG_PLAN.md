Plan de réorganisation (frontend) — essentiel et non-intrusif

But: proposer et documenter la réorganisation minimale nécessaire pour une architecture professionnelle
sans modifier le code. Ce document est un plan « dry-run » prêt à valider puis appliquer.

Structure cible (essentielle)
- src/app/
  - core/                # singletons, interceptors, guards, api service, auth
  - shared/              # composants réutilisables, pipes, directives
  - features/            # modules par domaine (lazy-loaded)
    - auth/
    - dashboard/
    - products/
    - stock/
    - suppliers/
    - consumable-requests/
    - users/              # gestion utilisateurs (admin)
    - admin/              # seulement outils d'administration (roles, audits)

Mapping proposé (exemples clés — dry-run)
- Déplacer les composants métier hors de `features/admin` vers des modules domaine :
  - `features/admin/products/*`  -> `features/products/` (liste, détails, create/edit)
  - `features/admin/product-stocks/*` -> `features/stock/` (product-stocks, mouvements)
  - `features/admin/products-by-*/*` -> `features/products/` or `features/stock/` selon la responsabilité
  - `features/admin/suppliers/*` -> `features/suppliers/`
  - `features/admin/users-*/*` -> `features/users/`
  - `features/admin/chat/*` -> `features/chat/` or `features/shared/components/chat` (si réutilisable)

Règles et conventions à appliquer
- Chaque dossier sous `features/<domain>` est un Module Angular autonome et lazy-loaded.
- Les `services` spécifiques au domaine vont dans le module (ex: `features/stock/services`).
- Les services singleton (Auth, Api) restent dans `core/services`.
- Les composants purement présentations/réutilisables vont dans `shared/components`.
- `features/admin` contient uniquement pages d'administration globales (roles, configuration, audits).

Checklist safe pour appliquer (manuel ou script)
1. Créer une branche git: `git checkout -b reorg/features-modules`
2. Générer inventaire (liste des fichiers) — fourni séparément.
3. Pour chaque déplacement:
   - `git mv src/app/features/admin/<thing> src/app/features/<domain>/<thing>`
   - Mettre à jour les imports (IDE: rename refactor ou script sed/ts-morph).
4. Mettre à jour les `NgModule` (declarer components, providers) et créer `index.ts` barrel files.
5. Lancer `npm run build` et `ng test` (ou `npm test`) pour détecter erreurs.
6. Corriger les imports restants / paths.
7. Commit et PR.

Commandes utiles (exemples)
```bash
git checkout -b reorg/features-modules
# mv example (dry-run): show planned moves
echo "Move: features/admin/products -> features/products"
# After validation, actually move:
# git mv src/app/features/admin/products src/app/features/products
# find/replace imports (example using rpl or sed)
```

Prochaine étape que je propose (choix)
- Option A (recommandée) : Je génère l'inventaire complet `src/app` + un mapping automatique dry-run (liste de mv proposés). Aucun changement de code.
- Option B : Je fournis uniquement la checklist et vous l'exécutez localement.

Choisissez A ou B.
