Frontend Reorg Mapping (dry-run)

But: proposer où déplacer les fichiers actuels de `src/app` pour obtenir une architecture professionnelle
sans appliquer de modifications. Utilisez ceci comme feuille de route pour les `git mv`.

Conventions cibles
- `core/` : singletons et services d'API, guards, interceptors, modèles partagés
- `shared/` : composants UI réutilisables, pipes, directives
- `features/<domain>/` : modules lazy-loaded par domaine (products, stock, suppliers, users, auth, dashboard, consumable-requests, admin)

Mapping proposé (exemples et règles)

1) Fichiers à laisser dans `core` (aucun changement requis):
  - core/services/* (auth.service.ts, api.service.ts, unit.service.ts, supplier.service.ts)
  - core/guards/* (auth.guard.ts, role.guard.ts)
  - core/models/* (supplier.model.ts, supplier-contact.model.ts)
  - core/interceptors/* (auth.interceptor.ts)

2) Fichiers à garder dans `shared` (UI réutilisable):
  - shared/components/product-batch-lifecycle/* -> shared/components/product-batch-lifecycle
  - shared/components/stock-form/* -> shared/components/stock-form
  - shared/components/storage-3d-viewer/* -> shared/components/storage-3d-viewer

3) Déplacer hors de `features/admin` vers modules domaine (principaux changements recommandés):
  - features/admin/products/** -> features/products/
    - products.component.ts/html/css
    - products-by-location/* -> features/products or features/stock (selon responsabilité)
    - products-by-cabinet, products-by-room, products-by-warehouse -> features/stock (views scoped to stock)

  - features/admin/product-stocks/** -> features/stock/
    - product-stocks.component.* -> features/stock/product-stocks

  - features/admin/stock-movements/** -> features/stock/
    - stock-movements.component.* -> features/stock/stock-movements

  - features/admin/suppliers/** -> features/suppliers/
    - suppliers.component.* -> features/suppliers/
    - services/admin-warehouse.service.ts? -> features/suppliers/services or core/services if shared

  - features/admin/users-list/**, archived-users/**, profile/** -> features/users/

  - features/admin/chat/** -> features/chat/ OR shared/components/chat if chat is reused across roles

  - features/admin/documents/** -> features/documents/

  - features/admin/references/** -> features/references/ or features/products depending on domain

4) Auth & Dashboard
  - features/auth/* -> features/auth/ (keep as is)
  - features/dashboard/* -> features/dashboard/ (keep as is)

5) Admin module
  - features/admin/* should be pruned to only admin-tools: admin-role-page, admin-layout, admin-routing.module.ts, admin.module.ts, admin-pagination.scss
  - Anything product/stock/user-specific must be moved to the domain features above

6) Files at app root
  - app-routing-module.ts / app-module.ts / app.ts / layout/* remain at root (app-level wiring)
  - REORG_PLAN.md, ARCHITECTURE.md, MAPPING.md — documentation files

Suggested per-file moves (concrete subset — expand if valid):
  - features/admin/products/products.component.* -> features/products/products.component.*
  - features/admin/products-by-location/* -> features/products/products-by-location/* OR features/stock/products-by-location/*
  - features/admin/product-stocks/* -> features/stock/product-stocks/*
  - features/admin/stock-movements/* -> features/stock/stock-movements/*
  - features/admin/suppliers/* -> features/suppliers/*
  - features/admin/users-list/* -> features/users/users-list/*
  - features/admin/chat/* -> features/chat/* or shared/components/chat/*
  - features/admin/documents/* -> features/documents/*

Checklist safe pour appliquer les moves
1. Créer branche: `git checkout -b reorg/frontend-features`
2. Pour chaque move validé: `git mv <old> <new>`
3. Mettre à jour imports (IDE refactor, or script using ts-morph)
4. Update feature module `declarations` / `imports` / `providers` as needed
5. Run `npm run build` and `npm test` (or `ng test`), fix issues
6. Commit & PR

Notes pratiques
- Prioriser un petit sous-ensemble (products + stock + suppliers) pour la première passe.
- Ne pas modifier controllers/services backend pendant le refactor frontend.
- Garder `features/admin` pour les pages exclusivement réservées aux administrateurs (roles, audits, config).

Prochaine étape (je propose)
- Je génère la liste complète des `git mv` recommandés (dry-run) pour tous les fichiers détectés. Vous validez, puis j'applique si vous donnez l'accord.
