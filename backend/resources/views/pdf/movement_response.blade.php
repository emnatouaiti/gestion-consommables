<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Décision Mouvement de Stock - {{ $movement->reference }}</title>
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .status { font-weight: bold; font-size: 1.4em; padding: 10px; border-radius: 5px; display: inline-block; margin-bottom: 20px; }
        .approved { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .rejected { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .info-section { margin-bottom: 20px; }
        .info-row { display: flex; margin-bottom: 5px; }
        .info-label { font-weight: bold; width: 150px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #eee; padding: 10px; text-align: left; }
        th { background-color: #f9f9f9; }
        .footer { margin-top: 50px; font-size: 0.8em; text-align: center; color: #777; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Décision de Mouvement de Stock</h1>
        <p>Référence : {{ $movement->reference }}</p>
    </div>

    <div style="text-align: center;">
        <div class="status {{ $movement->status === 'executed' ? 'approved' : 'rejected' }}">
            {{ $movement->status === 'executed' ? 'APPROUVÉ' : 'REJETÉ' }}
        </div>
    </div>

    <div class="info-section">
        <p><strong>Date de la décision :</strong> {{ now()->format('d/m/Y H:i') }}</p>
        <p><strong>Responsable :</strong> {{ $movement->validator->nomprenom ?? 'N/A' }}</p>
        <p><strong>Agent émetteur :</strong> {{ $movement->creator->nomprenom ?? 'N/A' }}</p>
        @if($movement->response_notes)
            <p><strong>Commentaire du responsable :</strong></p>
            <div style="background: #fdfdfd; border: 1px solid #eee; padding: 10px;">
                {{ $movement->response_notes }}
            </div>
        @endif
    </div>

    <h3>Détails du mouvement initial</h3>
    <table>
        <thead>
            <tr>
                <th>Produit</th>
                <th>Quantité</th>
                <th>Référence</th>
            </tr>
        </thead>
        <tbody>
            @foreach($movement->lines as $line)
                <tr>
                    <td>{{ $line->product->title }}</td>
                    <td>{{ $line->quantity }}</td>
                    <td>{{ $line->product->reference }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        Document généré automatiquement par le système de gestion des consommables.
    </div>
</body>
</html>
