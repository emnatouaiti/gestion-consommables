<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Demande de Consommables</title>
    <style>
        body { font-family: sans-serif; font-size: 14px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ccc; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .footer { margin-top: 50px; font-size: 12px; text-align: right; }
        .signature { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
        .refus-box { margin-top: 15px; padding: 15px; border: 2px solid #dc2626; background: #fef2f2; color: #dc2626; border-radius: 8px; }
        .badge-approved { color: #16a34a; font-weight: bold; }
        .badge-rejected { color: #dc2626; font-weight: bold; }
        .badge-pending  { color: #d97706; font-weight: bold; }
    </style>
</head>
<body>

    {{-- ===== EN-TETE ===== --}}
    <div class="header">
        <table style="border: none; width: 100%;">
            <tr>
                <td style="border: none; width: 50%; text-align: left;">
                    @php $logoPath = public_path('images/etap-logo.png'); @endphp
                    @if(file_exists($logoPath))
                        <img src="data:image/png;base64,{{ base64_encode(file_get_contents($logoPath)) }}"
                             alt="Logo ETAP" style="height: 60px;">
                    @endif
                </td>
                <td style="border: none; width: 50%; text-align: right;">
                    <h2 style="margin: 0; color: #004a99;">Consotracker</h2>
                    <p style="margin: 0; font-size: 12px; color: #666;">Gestion Intelligente des Consommables</p>
                </td>
            </tr>
        </table>
        <hr style="border: 1px solid #004a99; margin-top: 10px;">

        @php
            /*
             * $requests doit contenir UNIQUEMENT les articles
             * de la demande / du lot concerne (filtre fait dans le controller).
             */
            $statuses = collect($requests)->pluck('status')
                            ->map(fn($s) => strtolower((string) $s));

            $allRejected  = $statuses->isNotEmpty() && $statuses->every(fn($s) => $s === 'rejected');
            // "BON DE SORTIE" only when ALL items have status 'approved' (after stock manager confirms exit)
            $allApproved  = $statuses->isNotEmpty() && $statuses->every(fn($s) => $s === 'approved');
            // For display purposes, consider both approved and approved_pending_exit as "approved"
            $anyApproved  = $statuses->contains(fn($s) => in_array($s, ['approved', 'approved_pending_exit']));
            $anyRejected  = $statuses->contains('rejected');
            $mixed        = $anyApproved && $anyRejected;

            // Titre et couleur selon statut reel
            if (isset($forceTitle) && $forceTitle) {
                $title      = $forceTitle;
                $titleColor = str_contains(strtoupper($forceTitle), 'REFUS')  ? '#dc2626'
                            : (str_contains(strtoupper($forceTitle), 'SORTIE') ? '#16a34a' : '#004a99');
            } elseif ($allRejected) {
                $title      = 'BON DE REFUS DE CONSOMMABLES';
                $titleColor = '#dc2626';
            } elseif ($allApproved) {
                // Only show "BON DE SORTIE DE CONSOMMABLES" when stock manager has confirmed the exit
                $title      = 'BON DE SORTIE DE CONSOMMABLES';
                $titleColor = '#16a34a';
            } elseif ($mixed) {
                $title      = 'DEMANDE DE CONSOMMABLES (PARTIELLEMENT TRAITEE)';
                $titleColor = '#ea580c';
            } elseif ($anyApproved) {
                // Director has approved but stock manager hasn't confirmed exit yet
                $title      = 'BON DE DEMANDE APPROUVE';
                $titleColor = '#004a99';
            } else {
                $title      = 'BON DE DEMANDE DE CONSOMMABLES';
                $titleColor = '#004a99';
            }

            $firstRequest = collect($requests)->first();
            $ref = $batch_code ?? ('REQ-' . ($firstRequest->id ?? '?'));
        @endphp

        <h1 style="margin-top: 20px; color: {{ $titleColor }}; text-transform: uppercase; font-size: 22px;">
            {{ $title }}
        </h1>
        <p style="font-size: 16px; font-weight: bold;">Reference: {{ $ref }}</p>
        <p>Date: {{ date('d/m/Y H:i') }}</p>

        {{-- Encadre refus global (seulement si TOUT est rejete) --}}
        @if($allRejected)
            @php
                $refusReasons = collect($requests)
                    ->pluck('reject_reason')
                    ->filter()
                    ->unique()
                    ->values();
            @endphp
            <div class="refus-box">
                <strong>MOTIF DU REFUS :</strong><br>
                @if($refusReasons->isNotEmpty())
                    {{ $refusReasons->implode(' / ') }}
                @else
                    Non specifie
                @endif
            </div>
        @endif

        {{-- Encadre avertissement si lot partiellement traite --}}
        @if($mixed)
            <div style="margin-top: 15px; padding: 12px; border: 2px solid #ea580c; background: #fff7ed; color: #9a3412; border-radius: 8px; font-size: 13px;">
                <strong>ATTENTION :</strong> Ce lot a ete partiellement traite. Certains articles ont ete approuves, d'autres refuses. Consultez le detail ci-dessous.
            </div>
        @endif
    </div>

    {{-- ===== INFORMATIONS DEMANDEUR ===== --}}
    <div class="section">
        <div class="section-title">Informations du Demandeur</div>
        <p><strong>Nom &amp; Prenom:</strong> {{ $user->nomprenom ?? $user->name ?? 'Non specifie' }}</p>
        <p><strong>Service:</strong> {{ $user->service ?? 'Non specifie' }}</p>
        <p><strong>Poste:</strong> {{ $user->poste ?? 'Non specifie' }}</p>
    </div>

    {{-- ===== LISTE DES ARTICLES ===== --}}
    <div class="section">
        <div class="section-title">Liste des Articles</div>
        <table>
            <thead>
                <tr>
                    <th>Article / Produit</th>
                    <th>Qte Demandee</th>
                    @if($anyApproved)
                        <th>{{ $allApproved ? 'Qte Livree' : 'Qte Approuvee' }}</th>
                    @endif
                    @if($mixed || $anyRejected)
                        <th>Statut</th>
                        <th>Motif refus</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($requests as $req)
                @php
                    $reqStatus = strtolower((string) ($req->status ?? ''));
                    $isApproved = in_array($reqStatus, ['approved', 'approved_pending_exit']);
                    $isRejected = $reqStatus === 'rejected';
                @endphp
                <tr style="{{ $isRejected ? 'background:#fef2f2;' : ($isApproved ? 'background:#f0fdf4;' : '') }}">
                    <td>{{ $req->item_name }}</td>
                    <td>{{ $req->requested_quantity }}</td>
                    @if($anyApproved)
                        <td class="badge-approved">
                            {{ $isApproved ? ($req->approved_quantity ?? '-') : '-' }}
                        </td>
                    @endif
                    @if($mixed || $anyRejected)
                        <td>
                            @if($isApproved)
                                <span class="badge-approved">Approuve</span>
                            @elseif($isRejected)
                                <span class="badge-rejected">Refuse</span>
                            @else
                                <span class="badge-pending">En attente</span>
                            @endif
                        </td>
                        <td style="font-size: 12px; color: #dc2626;">
                            {{ $isRejected ? ($req->reject_reason ?? 'Non specifie') : '' }}
                        </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    {{-- ===== SIGNATURES ===== --}}
    <table style="border: none; width: 100%; margin-top: 50px;">
        <tr>
            <td style="border: none; width: 50%; text-align: left;">
                <p>Signature Demandeur:</p>
                <div class="signature" style="margin-top: 40px; width: 200px;"></div>
            </td>
            <td style="border: none; width: 50%; text-align: right;">
                <p>Visa Direction:</p>
                <div class="signature" style="margin-top: 40px; display: inline-block; width: 200px;"></div>
            </td>
        </tr>
    </table>

    <div class="footer">
        <p>Document genere automatiquement le {{ date('d/m/Y') }}</p>
    </div>

</body>
</html>
