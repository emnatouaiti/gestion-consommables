Projet backend - Architecture recommandée

Structure recommandée (Laravel):

- app/
  - Http/
    - Controllers/
    - Requests/
    - Middleware/
  - Models/
  - Services/        # logique métier réutilisable
  - Repositories/    # accès aux données (Eloquent adapters)
  - Interfaces/      # interfaces pour les repositories/services
  - Events/
  - Listeners/
  - Jobs/

- database/
  - migrations/
  - seeders/

- routes/
  - api.php

- storage/

Conventions et bonnes pratiques:

- Créez une interface dans `app/Interfaces` pour chaque repository/service important.
- Fournissez une implémentation Eloquent dans `app/Repositories` et liez-la dans `App\Providers\AppServiceProvider`.
- Placez la logique métier réutilisable dans `app/Services` et injectez les `Repositories` via leurs interfaces.
- Gardez les contrôleurs fins: validation via `Requests`, délégation à `Services`.
- Écrire des `Events` et `Listeners` pour les opérations transverses.

Après ajout de nouvelles classes, exécuter:

composer dump-autoload
