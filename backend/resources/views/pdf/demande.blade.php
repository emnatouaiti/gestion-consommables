<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Demande Consommable</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px;}
        th, td { border: 1px solid #ccc; padding: 6px; }
    </style>
</head>
<body>
    <h2>Nouvelle Demande de Consommable</h2>
    <p><strong>Demandeur :</strong> {{ $demande->user->name }}</p>
    <p><strong>Date :</strong> {{ $demande->created_at }}</p>
    <table>
        <thead>
            <tr>
                <th>Produit</th>
                <th>Quantité</th>
            </tr>
        </thead>
        <tbody>
            @foreach($demande->items as $item)
            <tr>
                <td>{{ $item->product->title }}</td>
                <td>{{ $item->quantity }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
