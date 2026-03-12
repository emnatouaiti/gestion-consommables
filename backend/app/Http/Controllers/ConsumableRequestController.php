<?php

namespace App\Http\Controllers;

use App\Models\ConsumableRequest;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ConsumableRequestController extends Controller
{
    // Afficher les demandes selon le profil
    public function index()
    {
        $user = Auth::user();

        if ($this->isDirectorUser($user)) {
            $requests = ConsumableRequest::with('user.roles', 'product')->latest()->get()
                ->map(function (ConsumableRequest $request) {
                    $availableStock = $this->getAvailableStock($request);
                    $suggestion = $this->computeSuggestedQuantity($request, $availableStock);
                    $productThreshold = optional($request->product)->seuil_min ?? null;

                    $request->setAttribute('requester_name', $this->getRequesterName($request->user));
                    $request->setAttribute('requester_service', $this->getRequesterService($request->user));
                    $request->setAttribute('requester_poste', $this->getRequesterPoste($request->user));
                    $request->setAttribute('available_stock', $availableStock);
                    $request->setAttribute('suggested_approved_quantity', $suggestion['quantity']);
                    $request->setAttribute('suggestion_reason', $suggestion['reason']);
                    $request->setAttribute('product_threshold', $productThreshold);
                    $request->setAttribute('stock_alert', $this->isStockBelowThreshold($availableStock, $productThreshold, $request->requested_quantity));

                    return $request;
                })
                ->groupBy(fn ($req) => $req->batch_code ?: $req->id)
                ->map(function ($group) {
                    $first = $group->first();
                    $items = $group->values();
                    $requestedTotal = $group->sum('requested_quantity');
                    $approvedTotal = $group->sum('approved_quantity');

                    return [
                        'id' => $first->id,
                        'batch_code' => $first->batch_code,
                        'item_name' => count($items) > 1 ? count($items) . ' produits' : $first->item_name,
                        'requested_quantity' => $requestedTotal,
                        'approved_quantity' => $approvedTotal ?: null,
                        'status' => $this->computeGroupStatus($group),
                        'created_at' => $first->created_at,
                        'user' => $first->user,
                        'requester_name' => $first->getAttribute('requester_name'),
                        'requester_service' => $first->getAttribute('requester_service'),
                        'requester_poste' => $first->getAttribute('requester_poste'),
                        'available_stock' => $first->getAttribute('available_stock'),
                        'suggested_approved_quantity' => $first->getAttribute('suggested_approved_quantity'),
                        'suggestion_reason' => $first->getAttribute('suggestion_reason'),
                        'product_threshold' => $first->getAttribute('product_threshold'),
                        'stock_alert' => $first->getAttribute('stock_alert'),
                        'items' => $items,
                    ];
                })
                ->values();
        } else {
            $requests = ConsumableRequest::where('user_id', $user->id)
                ->with('user.roles', 'product')
                ->latest()
                ->get()
                ->groupBy(fn ($req) => $req->batch_code ?: $req->id)
                ->map(function ($group) {
                    $first = $group->first();
                    $items = $group->values();
                    $requestedTotal = $group->sum('requested_quantity');
                    $approvedTotal = $group->sum('approved_quantity');

                    return [
                        'id' => $first->id,
                        'batch_code' => $first->batch_code,
                        'item_name' => count($items) > 1 ? count($items) . ' produits' : $first->item_name,
                        'requested_quantity' => $requestedTotal,
                        'approved_quantity' => $approvedTotal ?: null,
                        'status' => $this->computeGroupStatus($group),
                        'created_at' => $first->created_at,
                        'user' => $first->user,
                        'requester_name' => $this->getRequesterName($first->user),
                        'requester_service' => $this->getRequesterService($first->user),
                        'requester_poste' => $this->getRequesterPoste($first->user),
                        'items' => $items,
                    ];
                })
                ->values();
        }

        return response()->json($requests);
    }

    // Cr�er une nouvelle demande
    public function store(Request $request)
    {
        $user = Auth::user();

        if (!$this->userHasAnyRole($user, ['utilisateur', 'responsable', 'agent', 'gestionnaire', 'employee', 'pdg'])) {
            return response()->json([
                'message' => 'Seuls les utilisateurs metier peuvent creer une demande.'
            ], 403);
        }

        $payloads = $this->buildCreateRequestPayloads($request);
        $createdRequests = [];
        $batchCode = count($payloads) > 1 ? (string) Str::uuid() : null;

        DB::transaction(function () use ($payloads, $user, $batchCode, &$createdRequests) {
            foreach ($payloads as $payload) {
                $createdRequests[] = ConsumableRequest::create(array_merge($payload, [
                    'user_id' => $user->id,
                    'batch_code' => $batchCode,
                    'status' => 'pending',
                ]));
            }
        });

        // Notifier uniquement le directeur (role/poste/role legacy).
        $directors = User::query()
            ->where(function ($query) {
                $query->whereHas('roles', function ($roleQuery) {
                    $roleQuery->whereRaw('LOWER(name) IN (?, ?, ?)', ['directeur', 'durecteur', 'director']);
                })
                ->orWhereRaw('LOWER(poste) IN (?, ?, ?)', ['directeur', 'durecteur', 'director'])
                ->orWhereRaw('LOWER(role) IN (?, ?, ?)', ['directeur', 'durecteur', 'director']);
            })
            ->where('id', '!=', $user->id)
            ->get();

        $notifiedCount = 0;
        foreach ($directors as $director) {
            try {
                foreach ($createdRequests as $createdRequest) {
                    $director->notify(new \App\Notifications\ConsumableRequestNotification($createdRequest));
                    $notifiedCount++;
                }
            } catch (\Throwable $e) {
                Log::error('Notification en echec pour demande consommable', [
                    'request_ids' => collect($createdRequests)->pluck('id')->all(),
                    'director_id' => $director->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            'requests' => $createdRequests,
            'notified_count' => $notifiedCount,
        ], 201);
    }

    // Modifier une demande (directeur uniquement)
    public function update($id, Request $request)
    {
        $editor = Auth::user();
        $consumableRequest = ConsumableRequest::findOrFail($id);
        if (!$this->canRequesterEditOrDelete($editor, $consumableRequest)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($consumableRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be modified.'], 422);
        }

        $payload = $this->buildRequestPayload($request);
        $consumableRequest->update($payload);

        return response()->json([
            'message' => 'Request updated successfully.',
            'request' => $consumableRequest->fresh(['user.roles', 'product']),
        ]);
    }

    // Supprimer une demande (directeur uniquement)
    public function destroy($id)
    {
        $editor = Auth::user();
        $consumableRequest = ConsumableRequest::findOrFail($id);
        if (!$this->canRequesterEditOrDelete($editor, $consumableRequest)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($consumableRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be deleted.'], 422);
        }

        $consumableRequest->delete();

        return response()->json(['message' => 'Request deleted successfully.']);
    }

    // Approuver une demande (directeur uniquement)
    public function approve($id, Request $request)
    {
        $consumableRequest = ConsumableRequest::with('user.roles')->findOrFail($id);
        $approver = Auth::user();
        $requestOwner = $consumableRequest->user;

        if (!$this->isDirectorUser($approver)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($consumableRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be approved.'], 422);
        }

        $availableStock = $this->getAvailableStock($consumableRequest);
        $maxAllowed = $this->getMaxAllowedApproval($consumableRequest, $availableStock);
        $suggestion = $this->computeSuggestedQuantity($consumableRequest, $availableStock);

        $request->validate([
            'approved_quantity' => 'nullable|integer|min:0',
        ]);

        $approvedQuantity = (int) ($request->input('approved_quantity', $suggestion['quantity']));
        if ($approvedQuantity > $maxAllowed) {
            return response()->json([
                'message' => "Quantite approuvee invalide. Maximum autorise: {$maxAllowed}.",
                'max_allowed' => $maxAllowed,
                'suggested_approved_quantity' => $suggestion['quantity'],
            ], 422);
        }

        DB::transaction(function () use ($consumableRequest, $approvedQuantity) {
            $hasProductIdColumn = Schema::hasColumn('consumable_requests', 'product_id');
            $productId = $hasProductIdColumn ? $consumableRequest->product_id : null;

            if ($productId && $approvedQuantity > 0) {
                $product = Product::findOrFail($productId);
                $this->deductStock($product, $approvedQuantity);
            }

            $consumableRequest->approved_quantity = $approvedQuantity;
            $consumableRequest->status = 'approved';
            $consumableRequest->save();
        });

        return response()->json([
            'message' => 'Request approved successfully.',
            'request' => $consumableRequest->fresh(['user.roles', 'product']),
            'approved_quantity' => $approvedQuantity,
            'max_allowed' => $maxAllowed,
            'suggested_approved_quantity' => $suggestion['quantity'],
            'suggestion_reason' => $suggestion['reason'],
        ]);
    }

    // Rejeter une demande (directeur uniquement)
    public function reject($id)
    {
        $consumableRequest = ConsumableRequest::findOrFail($id);
        $approver = Auth::user();

        if (!$this->isDirectorUser($approver)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $consumableRequest->status = 'rejected';
        $consumableRequest->save();

        return response()->json(['message' => 'Request rejected successfully.']);
    }

    private function getAvailableStock(ConsumableRequest $consumableRequest): ?int
    {
        $hasProductIdColumn = Schema::hasColumn('consumable_requests', 'product_id');
        $productId = $hasProductIdColumn ? $consumableRequest->product_id : null;

        $product = null;
        if ($productId) {
            $product = Product::find($productId);
        }

        // Fallback when DB schema does not contain product_id or legacy rows are not linked.
        if (!$product) {
            $itemName = trim((string) $consumableRequest->item_name);
            if ($itemName !== '') {
                $product = Product::query()
                    ->whereRaw('LOWER(title) = ?', [Str::lower($itemName)])
                    ->orWhere('reference', $itemName)
                    ->first();
            }
        }

        if (!$product) {
            return null;
        }

        $stocksSum = (int) $product->stocks()->sum('quantity');
        if ($stocksSum > 0) {
            return $stocksSum;
        }

        return (int) ($product->stock_quantity ?? 0);
    }

    private function buildRequestPayload(Request $request): array
    {
        $hasProductIdColumn = Schema::hasColumn('consumable_requests', 'product_id');

        $rules = [
            'item_name' => 'nullable|string|max:255',
            'requested_quantity' => 'required|integer|min:1',
        ];

        if ($hasProductIdColumn) {
            $rules['product_id'] = 'nullable|exists:products,id';
        }

        $validated = $request->validate($rules);

        $itemName = trim((string) ($validated['item_name'] ?? ''));
        $productId = $hasProductIdColumn ? ($validated['product_id'] ?? null) : null;

        if ($productId && $itemName === '') {
            $productTitle = Product::query()->whereKey($productId)->value('title');
            $itemName = (string) ($productTitle ?? '');
        }

        if ($itemName === '') {
            throw ValidationException::withMessages([
                'item_name' => 'Veuillez selectionner un produit ou saisir un article.'
            ]);
        }

        $payload = [
            'item_name' => $itemName,
            'requested_quantity' => $validated['requested_quantity'],
        ];

        if ($hasProductIdColumn) {
            $payload['product_id'] = $productId;
        }

        return $payload;
    }

    private function buildCreateRequestPayloads(Request $request): array
    {
        $items = $request->input('items');
        if (is_array($items) && count($items) > 0) {
            $request->validate([
                'items' => 'required|array|min:1',
                'items.*.product_id' => 'required|exists:products,id',
                'items.*.requested_quantity' => 'required|integer|min:1',
            ]);

            $hasProductIdColumn = Schema::hasColumn('consumable_requests', 'product_id');
            $payloads = [];

            foreach ($items as $item) {
                $productId = (int) ($item['product_id'] ?? 0);
                $qty = (int) ($item['requested_quantity'] ?? 0);
                $productTitle = (string) (Product::query()->whereKey($productId)->value('title') ?? '');

                if ($productTitle === '') {
                    continue;
                }

                $payload = [
                    'item_name' => $productTitle,
                    'requested_quantity' => $qty,
                ];

                if ($hasProductIdColumn) {
                    $payload['product_id'] = $productId;
                }

                $payloads[] = $payload;
            }

            if (count($payloads) === 0) {
                throw ValidationException::withMessages([
                    'items' => 'Aucun produit valide dans la demande.'
                ]);
            }

            return $payloads;
        }

        return [$this->buildRequestPayload($request)];
    }

    private function getMaxAllowedApproval(ConsumableRequest $consumableRequest, ?int $availableStock): int
    {
        $requested = (int) $consumableRequest->requested_quantity;

        if ($availableStock === null) {
            return $requested;
        }

        if ($availableStock <= 0) {
            return 0;
        }

        return min($requested, $availableStock);
    }

    private function computeSuggestedQuantity(ConsumableRequest $consumableRequest, ?int $availableStock): array
    {
        $requested = (int) $consumableRequest->requested_quantity;
        $poste = $this->getRequesterPoste($consumableRequest->user);
        $maxAllowed = $this->getMaxAllowedApproval($consumableRequest, $availableStock);

        if ($availableStock === null) {
            if (Str::lower($poste) !== 'pdg') {
                $suggested = max(1, (int) floor($requested * 0.70));
                return [
                    'quantity' => min($requested, $suggested),
                    'reason' => 'Stock non lie: proposition a 70% de la demande.',
                ];
            }

            return [
                'quantity' => $requested,
                'reason' => 'Pas de stock lie au produit, suggestion basee sur la demande.',
            ];
        }

        if ($availableStock <= 0) {
            return [
                'quantity' => 0,
                'reason' => 'Stock indisponible.',
            ];
        }

        if (Str::lower($poste) === 'pdg') {
            return [
                'quantity' => min($requested, $availableStock),
                'reason' => 'Poste PDG: proposition sur quantite complete selon stock.',
            ];
        }

        // Non-PDG rule:
        // - If requested quantity <= 20% of stock: approve full requested quantity.
        // - Otherwise: suggest 70% of the approvable quantity.
        if ($requested <= (int) floor($availableStock * 0.20)) {
            return [
                'quantity' => $maxAllowed,
                'reason' => 'Demande <= 20% du stock: proposition sur quantite complete.',
            ];
        }

        $suggested = max(1, (int) floor($maxAllowed * 0.70));
        return [
            'quantity' => min($maxAllowed, $suggested),
            'reason' => 'Demande > 20% du stock: proposition a 70% de la demande approuvable.',
        ];
    }

    private function getRequesterPoste(?User $user): string
    {
        $poste = trim((string) ($user?->poste ?? ''));
        if ($poste !== '') {
            return $poste;
        }

        $fallbackRole = trim((string) ($user?->role ?? ''));
        return $fallbackRole !== '' ? $fallbackRole : 'Non defini';
    }

    private function getRequesterName(?User $user): string
    {
        $name = trim((string) ($user?->nomprenom ?? $user?->name ?? ''));
        return $name !== '' ? $name : 'Utilisateur';
    }

    private function getRequesterService(?User $user): string
    {
        $service = trim((string) ($user?->service ?? ''));
        return $service !== '' ? $service : 'Non defini';
    }

    private function deductStock(Product $product, int $approvedQuantity): void
    {
        $remaining = $approvedQuantity;

        $stocks = $product->stocks()
            ->where('quantity', '>', 0)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($stocks as $stock) {
            if ($remaining <= 0) {
                break;
            }

            $take = min((int) $stock->quantity, $remaining);
            $stock->quantity = ((int) $stock->quantity) - $take;
            $stock->last_updated = now();
            $stock->save();

            $remaining -= $take;
        }
    }

    private function isPdgUser(?User $user): bool
    {
        $poste = Str::lower((string) ($user?->poste ?? ''));
        $role = Str::lower((string) ($user?->role ?? ''));

        return $poste === 'pdg'
            || $this->userHasAnyRole($user, ['pdg'])
            || $role === 'pdg';
    }

    private function isDirectorUser(?User $user): bool
    {
        return $this->userHasAnyRole($user, ['directeur', 'durecteur', 'director'])
            || in_array(Str::lower((string) ($user?->poste ?? '')), ['directeur', 'durecteur', 'director'], true)
            || in_array(Str::lower((string) ($user?->role ?? '')), ['directeur', 'durecteur', 'director'], true);
    }

    private function isStockBelowThreshold(?int $availableStock, ?int $threshold, int $requested): bool
    {
        if ($availableStock === null) {
            return false;
        }

        if ($threshold !== null && $threshold > 0 && $availableStock < $threshold) {
            return true;
        }

        return $availableStock < $requested;
    }

    private function computeGroupStatus($group): string
    {
        $statuses = collect($group)->pluck('status')->map(fn ($s) => Str::lower((string) $s));

        if ($statuses->contains('pending')) {
            return 'pending';
        }

        if ($statuses->contains('rejected')) {
            return 'rejected';
        }

        if ($statuses->every(fn ($s) => $s === 'approved')) {
            return 'approved';
        }

        return $statuses->first() ?? 'pending';
    }

    private function canRequesterEditOrDelete(?User $user, ConsumableRequest $consumableRequest): bool
    {
        if (!$user) {
            return false;
        }

        if ($this->isDirectorUser($user)) {
            return false;
        }

        $isBusinessRequester = $this->userHasAnyRole($user, [
            'utilisateur',
            'responsable',
            'agent',
            'gestionnaire',
            'employee',
            'pdg',
        ]);

        return $isBusinessRequester && (int) $consumableRequest->user_id === (int) $user->id;
    }

    private function userHasAnyRole(?User $user, array $expectedRoles): bool
    {
        if (!$user) {
            return false;
        }

        $normalizedExpected = collect($expectedRoles)
            ->map(fn ($role) => Str::lower((string) $role))
            ->filter()
            ->unique()
            ->values();

        $currentRoles = $user->getRoleNames()
            ->map(fn ($role) => Str::lower((string) $role));

        $fallbackRole = Str::lower((string) ($user->role ?? ''));
        if ($fallbackRole !== '') {
            $currentRoles->push($fallbackRole);
        }

        return $currentRoles->unique()->intersect($normalizedExpected)->isNotEmpty();
    }
}
