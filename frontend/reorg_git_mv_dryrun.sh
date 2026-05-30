#!/usr/bin/env bash
# Dry-run list of git mv commands to reorganize `features/admin` into domain feature modules.
# Review before executing. NONE of these commands are applied by this script as provided (they are commented).

set -e

echo "DRY-RUN: Proposed git mv commands (files remain unchanged)."

# Create target folders (uncomment to create)
# mkdir -p src/app/features/products
# mkdir -p src/app/features/stock
# mkdir -p src/app/features/suppliers
# mkdir -p src/app/features/users
# mkdir -p src/app/features/chat
# mkdir -p src/app/features/documents
# mkdir -p src/app/features/references
# mkdir -p src/app/features/warehouses
# mkdir -p src/app/features/categories
# mkdir -p src/app/features/units

# Products
# git mv src/app/features/admin/products/products.component.ts src/app/features/products/products.component.ts
# git mv src/app/features/admin/products/products.component.html src/app/features/products/products.component.html
# git mv src/app/features/admin/products/products.component.css src/app/features/products/products.component.css

# Product by location / room / cabinet / warehouse -> consider features/stock or features/products
# git mv src/app/features/admin/products-by-location/products-by-location.component.ts src/app/features/stock/products-by-location.component.ts
# git mv src/app/features/admin/products-by-location/products-by-location.component.html src/app/features/stock/products-by-location.component.html
# git mv src/app/features/admin/products-by-location/products-by-location.component.css src/app/features/stock/products-by-location.component.css

# git mv src/app/features/admin/products-by-room/products-by-room.component.ts src/app/features/stock/products-by-room.component.ts
# git mv src/app/features/admin/products-by-room/products-by-room.component.html src/app/features/stock/products-by-room.component.html
# git mv src/app/features/admin/products-by-room/products-by-room.component.css src/app/features/stock/products-by-room.component.css

# git mv src/app/features/admin/products-by-cabinet/products-by-cabinet.component.ts src/app/features/stock/products-by-cabinet.component.ts
# git mv src/app/features/admin/products-by-cabinet/products-by-cabinet.component.html src/app/features/stock/products-by-cabinet.component.html
# git mv src/app/features/admin/products-by-cabinet/products-by-cabinet.component.css src/app/features/stock/products-by-cabinet.component.css

# git mv src/app/features/admin/products-by-warehouse/products-by-warehouse.component.ts src/app/features/stock/products-by-warehouse.component.ts
# git mv src/app/features/admin/products-by-warehouse/products-by-warehouse.component.html src/app/features/stock/products-by-warehouse.component.html
# git mv src/app/features/admin/products-by-warehouse/products-by-warehouse.component.css src/app/features/stock/products-by-warehouse.component.css

# Product stocks -> features/stock
# git mv src/app/features/admin/product-stocks/product-stocks.component.ts src/app/features/stock/product-stocks.component.ts
# git mv src/app/features/admin/product-stocks/product-stocks.component.html src/app/features/stock/product-stocks.component.html
# git mv src/app/features/admin/product-stocks/product-stocks.component.css src/app/features/stock/product-stocks.component.css

# Stock movements -> features/stock
# git mv src/app/features/admin/stock-movements/stock-movements.component.ts src/app/features/stock/stock-movements.component.ts
# git mv src/app/features/admin/stock-movements/stock-movements.component.html src/app/features/stock/stock-movements.component.html
# git mv src/app/features/admin/stock-movements/stock-movements.component.css src/app/features/stock/stock-movements.component.css

# Suppliers -> features/suppliers
# git mv src/app/features/admin/suppliers/suppliers.component.ts src/app/features/suppliers/suppliers.component.ts
# git mv src/app/features/admin/suppliers/suppliers.component.html src/app/features/suppliers/suppliers.component.html
# git mv src/app/features/admin/suppliers/suppliers.component.css src/app/features/suppliers/suppliers.component.css

# Users -> features/users
# git mv src/app/features/admin/users-list/users-list.component.ts src/app/features/users/users-list.component.ts
# git mv src/app/features/admin/users-list/users-list.component.html src/app/features/users/users-list.component.html
# git mv src/app/features/admin/users-list/users-list.component.css src/app/features/users/users-list.component.css
# git mv src/app/features/admin/archived-users/* src/app/features/users/archived-users/
# git mv src/app/features/admin/profile/* src/app/features/users/profile/

# Chat -> features/chat or shared
# git mv src/app/features/admin/chat/chat.component.ts src/app/features/chat/chat.component.ts
# git mv src/app/features/admin/chat/chat.component.html src/app/features/chat/chat.component.html
# git mv src/app/features/admin/chat/chat.component.css src/app/features/chat/chat.component.css
# git mv src/app/features/admin/chat/mini-threads.component.ts src/app/features/chat/mini-threads.component.ts
# git mv src/app/features/admin/chat/thread-widget.component.ts src/app/features/chat/thread-widget.component.ts

# Documents -> features/documents
# git mv src/app/features/admin/documents/documents.component.ts src/app/features/documents/documents.component.ts
# git mv src/app/features/admin/documents/documents.component.html src/app/features/documents/documents.component.html
# git mv src/app/features/admin/documents/documents.component.css src/app/features/documents/documents.component.css

# References -> features/references or features/products
# git mv src/app/features/admin/references/references.component.ts src/app/features/references/references.component.ts
# git mv src/app/features/admin/references/references.component.html src/app/features/references/references.component.html
# git mv src/app/features/admin/references/references.component.css src/app/features/references/references.component.css

# Warehouses -> features/warehouses (or features/stock)
# git mv src/app/features/admin/warehouses/warehouses.component.ts src/app/features/warehouses/warehouses.component.ts
# git mv src/app/features/admin/warehouses/warehouses.component.html src/app/features/warehouses/warehouses.component.html
# git mv src/app/features/admin/warehouses/warehouses.component.css src/app/features/warehouses/warehouses.component.css

# Categories -> features/categories
# git mv src/app/features/admin/categories/categories.component.ts src/app/features/categories/categories.component.ts
# git mv src/app/features/admin/categories/categories.component.html src/app/features/categories/categories.component.html
# git mv src/app/features/admin/categories/categories.component.css src/app/features/categories/categories.component.css

# Units -> features/units
# git mv src/app/features/admin/units/units.component.ts src/app/features/units/units.component.ts
# git mv src/app/features/admin/units/units.component.html src/app/features/units/units.component.html
# git mv src/app/features/admin/units/units.component.css src/app/features/units/units.component.css

# Admin services: consider moving to core/services or feature-level services
# git mv src/app/features/admin/services/admin-expiration.service.ts src/app/core/services/admin-expiration.service.ts
# git mv src/app/features/admin/services/admin-ref.service.ts src/app/core/services/admin-ref.service.ts
# git mv src/app/features/admin/services/admin-stock.service.ts src/app/core/services/admin-stock.service.ts
# git mv src/app/features/admin/services/admin-warehouse.service.ts src/app/core/services/admin-warehouse.service.ts
# git mv src/app/features/admin/services/admin-users.service.ts src/app/core/services/admin-users.service.ts
# git mv src/app/features/admin/services/product-stock.service.ts src/app/features/stock/services/product-stock.service.ts

echo "Dry-run file created: reorg_git_mv_dryrun.sh"

echo "Review the mapping files: src/app/MAPPING.md and src/app/REORG_PLAN.md"

exit 0
