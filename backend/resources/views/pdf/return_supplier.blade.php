<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Bon de Retour Fournisseur</title>
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 14px; line-height: 1.5; color: #333; margin: 0; padding: 20px; }
        .header { border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 30px; }
        .header h1 { color: #0056b3; margin: 0; font-size: 24px; text-transform: uppercase; }
        .header p { margin: 5px 0 0; color: #666; }
        .info-section { margin-bottom: 30px; width: 100%; display: table; }
        .info-block { display: table-cell; width: 50%; padding: 10px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; }
        .info-block h3 { margin-top: 0; color: #0056b3; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .info-block p { margin: 5px 0; }
        table.details { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        table.details th, table.details td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        table.details th { background-color: #f4f4f4; color: #333; font-weight: bold; text-transform: uppercase; }
        .footer { text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 50px; }
        .signature-section { margin-top: 40px; display: table; width: 100%; }
        .signature-box { display: table-cell; width: 50%; text-align: center; }
        .signature-box div { margin-top: 50px; border-top: 1px dashed #333; display: inline-block; width: 200px; padding-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>BON DE RETOUR FOURNISSEUR</h1>
        <p>Date d'édition : {{ date('d/m/Y') }}</p>
    </div>

    <div class="info-section">
        <div class="info-block">
            <h3>Informations Fournisseur</h3>
            <p><strong>Nom :</strong> {{ $supplier->name ?? 'N/A' }}</p>
            <p><strong>Email :</strong> {{ $supplier->email ?? 'N/A' }}</p>
            <p><strong>Téléphone :</strong> {{ $supplier->phone ?? 'N/A' }}</p>
        </div>
        <div style="display: table-cell; width: 2%;"></div>
        <div class="info-block">
            <h3>Informations Retour</h3>
            <p><strong>Référence :</strong> RET-{{ $stock->id }}-{{ date('Ymd') }}</p>
            <p><strong>Date de retour :</strong> {{ date('d/m/Y') }}</p>
            <p><strong>Justification :</strong> {{ $justification }}</p>
        </div>
    </div>

    <table class="details">
        <thead>
            <tr>
                <th>Produit</th>
                <th>Référence</th>
                <th>Numéro de Lot</th>
                <th>Date d'expiration</th>
                <th>Quantité Retournée</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $stock->product->title ?? 'N/A' }}</td>
                <td>{{ $stock->product->reference ?? 'N/A' }}</td>
                <td>{{ $stock->batch_number }}</td>
                <td>{{ $stock->expiration_date }}</td>
                <td><strong>{{ $quantity }} {{ $stock->product->unit->code ?? 'unité(s)' }}</strong></td>
            </tr>
        </tbody>
    </table>



    <div class="footer">
        <p>Document généré automatiquement par le système de gestion des stocks.</p>
    </div>
</body>
</html>
