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
        .signature-box { margin-top: 40px; display: flex; justify-content: space-between; }
        .signature { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <table style="border: none; width: 100%;">
            <tr>
                <td style="border: none; width: 50%; text-align: left;">
                    <img src="data:image/png;base64,{{ base64_encode(file_get_contents(public_path('images/etap-logo.png'))) }}" alt="Logo ETAP" style="height: 60px;">
                </td>
                <td style="border: none; width: 50%; text-align: right;">
                    <h2 style="margin: 0; color: #004a99;">Consotracker</h2>
                    <p style="margin: 0; font-size: 12px; color: #666;">Gestion Intelligente des Consommables</p>
                </td>
            </tr>
        </table>
        <hr style="border: 1px solid #004a99; margin-top: 10px;">
        @php
            $statuses = collect($requests)->pluck('status')->map(fn($s) => strtolower((string)$s));
            
            $allRejected = $statuses->every(fn($s) => $s === 'rejected');
            $allApproved = $statuses->every(fn($s) => $s === 'approved');
            $anyApproved = $statuses->contains('approved') || $statuses->contains('approved_pending_exit');
            $anyRejected = $statuses->contains('rejected');
            
            $title = $forceTitle ?? 'BON DE DEMANDE DE CONSOMMABLES';
            $titleColor = '#004a99';
            
            if (!isset($forceTitle) || !$forceTitle) {
                if ($allRejected) {
                    $title = 'BON DE REFUS DE CONSOMMABLES';
                    $titleColor = '#dc2626';
                } elseif ($allApproved) {
                    $title = 'BON DE SORTIE DE CONSOMMABLES';
                    $titleColor = '#16a34a';
                } elseif ($anyRejected && $anyApproved) {
                    $title = 'DEMANDE DE CONSOMMABLES (PARTIELLEMENT TRAITÉE)';
                    $titleColor = '#ea580c';
                } elseif ($anyApproved) {
                    $title = 'BON DE DEMANDE APPROUVÉ';
                    $titleColor = '#004a99';
                }
            } else {
                // Adjust color based on forced title content
                if (str_contains(strtoupper($forceTitle), 'REFUS')) $titleColor = '#dc2626';
                if (str_contains(strtoupper($forceTitle), 'SORTIE')) $titleColor = '#16a34a';
            }
        @endphp

        <h1 style="margin-top: 20px; color: {{ $titleColor }}; text-transform: uppercase; font-size: 24px;">
            {{ $title }}
        </h1>
        <p style="font-size: 16px; font-weight: bold;">Référence: {{ $batch_code ?: 'REQ-' . $requests->first()->id }}</p>
        <p>Date d'émission: {{ date('d/m/Y H:i') }}</p>

        @if($anyRejected)
            <div style="margin-top: 15px; padding: 15px; border: 2px solid #dc2626; background: #fef2f2; color: #dc2626; border-radius: 8px;">
                <strong>MOTIF DU REFUS :</strong><br>
                {{ $requests->first(fn($r) => $r->status === 'rejected')->reject_reason ?: 'Non spécifié' }}
            </div>
        @endif
    </div>

    <div class="section">
        <div class="section-title">Informations du Demandeur</div>
        <p><strong>Nom & Prénom:</strong> {{ $user->nomprenom ?: $user->name }}</p>
        <p><strong>Service:</strong> {{ $user->service ?: 'Non spécifié' }}</p>
        <p><strong>Poste:</strong> {{ $user->poste ?: 'Non spécifié' }}</p>
    </div>

    <div class="section">
        <div class="section-title">Liste des Articles Demandés</div>
        <table>
            <thead>
                <tr>
                    <th>Article / Produit</th>
                    <th>Qté Demandée</th>
                    @if($requests->contains(fn($r) => $r->approved_quantity > 0))
                        <th>{{ str_contains($title, 'SORTIE') ? 'Qté Livrée' : 'Qté Approuvée' }}</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($requests as $req)
                <tr>
                    <td>{{ $req->item_name }}</td>
                    <td>{{ $req->requested_quantity }}</td>
                    @if($requests->contains(fn($r) => $r->approved_quantity > 0))
                        <td style="font-weight: bold; color: {{ str_contains($title, 'SORTIE') ? '#16a34a' : '#004a99' }};">
                            {{ $req->approved_quantity ?: '-' }}
                        </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <table style="border: none; width: 100%; margin-top: 50px;">
        <tr>
            <td style="border: none; width: 50%; text-align: left;">
                <p>Signature Demandeur:</p>
                <div class="signature" style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div>
            </td>
            <td style="border: none; width: 50%; text-align: right;">
                <div style="display: inline-block; text-align: center;">
                    <p>Visa Direction:</p>
                    <div class="signature" style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div>
                </div>
            </td>
        </tr>
    </table>

    <div class="footer">
        <p>Document généré automatiquement le {{ date('d/m/Y') }}</p>
    </div>
</body>
</html>
