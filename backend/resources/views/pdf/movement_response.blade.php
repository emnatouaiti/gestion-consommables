<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Décision Mouvement de Stock - {{ $movement->reference }}</title>
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

    {{-- ===== EN-TÊTE ===== --}}
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
            $isApproved = $movement->status === 'approved' || $movement->status === 'executed';
            $isRejected = $movement->status === 'cancelled';
            $titleColor = $isApproved ? '#16a34a' : ($isRejected ? '#dc2626' : '#004a99');
            $titleText  = $isApproved ? 'BON DE MOUVEMENT APPROUVÉ' : ($isRejected ? 'BON DE MOUVEMENT REJETÉ' : 'DÉCISION DE MOUVEMENT');
        @endphp

        <h1 style="margin-top: 20px; color: {{ $titleColor }}; text-transform: uppercase; font-size: 22px;">
            {{ $titleText }}
        </h1>
        <p style="font-size: 16px; font-weight: bold;">Référence: {{ $movement->reference }}</p>
        <p>Date de la décision: {{ now()->format('d/m/Y H:i') }}</p>

        @if($isRejected && $movement->response_notes)
            <div class="refus-box">
                <strong>MOTIF DU REFUS :</strong><br>
                {{ $movement->response_notes }}
            </div>
        @elseif($isApproved && $movement->response_notes)
            <div style="margin-top: 15px; padding: 12px; border: 2px solid #16a34a; background: #f0fdf4; color: #16a34a; border-radius: 8px; font-size: 13px;">
                <strong>COMMENTAIRE :</strong><br>
                {{ $movement->response_notes }}
            </div>
        @endif
    </div>

    {{-- ===== INFORMATIONS ACTEURS ===== --}}
    <div class="section">
        <div class="section-title">Informations du Flux</div>
        <p><strong>Agent Émetteur :</strong> {{ $movement->creator->nomprenom ?? $movement->creator->name ?? 'Non spécifié' }}</p>
        <p><strong>Responsable Validation :</strong> {{ $movement->validator->nomprenom ?? $movement->validator->name ?? 'Non spécifié' }}</p>
        <p><strong>Type de mouvement :</strong>
            @if($movement->movement_type === 'in') Entrée
            @elseif($movement->movement_type === 'out') Sortie
            @elseif($movement->movement_type === 'transfer') Transfert
            @else {{ $movement->movement_type }}
            @endif
        </p>
        @if($movement->motif)
            <p><strong>Motif :</strong> {{ $movement->motif }}</p>
        @endif
    </div>

    {{-- ===== LISTE DES ARTICLES ===== --}}
    <div class="section">
        <div class="section-title">Liste des Articles</div>
        <table>
            <thead>
                <tr>
                    <th>Produit</th>
                    <th>Référence</th>
                    <th>Quantité</th>
                </tr>
            </thead>
            <tbody>
                @foreach($movement->lines as $line)
                <tr>
                    <td>{{ $line->product->title }}</td>
                    <td>{{ $line->product->reference }}</td>
                    <td>{{ $line->quantity }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>



    <div class="footer">
        <p>Document généré automatiquement le {{ date('d/m/Y H:i') }}</p>
    </div>

</body>
</html>
