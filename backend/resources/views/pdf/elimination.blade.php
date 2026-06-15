<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Proces-verbal d'Elimination de Lot</title>
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 14px; line-height: 1.5; color: #333; margin: 0; padding: 20px; }
        .header { border-bottom: 2px solid #e53e3e; padding-bottom: 10px; margin-bottom: 30px; }
        .header h1 { color: #e53e3e; margin: 0; font-size: 24px; text-transform: uppercase; }
        .header p { margin: 5px 0 0; color: #666; }
        .info-section { margin-bottom: 30px; width: 100%; display: table; }
        .info-block { display: table-cell; width: 100%; padding: 10px; background-color: #fff5f5; border: 1px solid #feb2b2; border-radius: 4px; }
        .info-block h3 { margin-top: 0; color: #c53030; font-size: 16px; border-bottom: 1px solid #feb2b2; padding-bottom: 5px; }
        .info-block p { margin: 5px 0; }
        table.details { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        table.details th, table.details td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        table.details th { background-color: #f4f4f4; color: #333; font-weight: bold; text-transform: uppercase; }
        .footer { text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 50px; }
        .signature-section { margin-top: 40px; display: table; width: 100%; }
        .signature-box { display: table-cell; width: 100%; text-align: center; }
        .signature-box div { margin-top: 50px; border-top: 1px dashed #333; display: inline-block; width: 200px; padding-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PROCES-VERBAL D'ELIMINATION</h1>
        <p>Date d'edition : {{ date('d/m/Y H:i') }}</p>
    </div>

    <div class="info-section">
        <div class="info-block">
            <h3>Details de l'elimination</h3>
            <p><strong>Reference PV :</strong> ELIM-{{ $stock->id }}-{{ date('YmdHi') }}</p>
            <p><strong>Date d'action :</strong> {{ date('d/m/Y') }}</p>
            <p><strong>Justification :</strong> {{ $justification }}</p>
            <p><strong>Operateur :</strong> {{ auth()->user()->name ?? 'Administrateur' }}</p>
        </div>
    </div>

    <table class="details">
        <thead>
            <tr>
                <th>Produit</th>
                <th>Reference</th>
                <th>Numero de Lot</th>
                <th>Date d'expiration</th>
                <th>Quantite Eliminee</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $stock->product->title ?? 'N/A' }}</td>
                <td>{{ $stock->product->reference ?? 'N/A' }}</td>
                <td>{{ $stock->batch_number ?? 'Sans numero' }}</td>
                <td>{{ $stock->expiration_date ? \Carbon\Carbon::parse($stock->expiration_date)->format('d/m/Y') : 'N/A' }}</td>
                <td><strong>{{ $quantity }} {{ $stock->product->unit->code ?? 'unite(s)' }}</strong></td>
            </tr>
        </tbody>
    </table>

    <div style="margin-top: 20px; font-style: italic; color: #666;">
        Note : Cette action est definitive. Les produits listes ci-dessus ont ete retires du stock physique et informatique pour destruction ou traitement comme dechet.
    </div>



    <div class="footer">
        <p>Document genere automatiquement par le systeme de gestion des stocks.</p>
    </div>
</body>
</html>
