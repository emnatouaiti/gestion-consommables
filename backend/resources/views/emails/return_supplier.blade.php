<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Retour de Marchandise</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { width: 80%; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .header { background: #f4f4f4; padding: 10px; text-align: center; border-bottom: 2px solid #ccc; }
        .content { padding: 20px 0; }
        .footer { font-size: 0.9em; color: #777; text-align: center; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Notification de Retour de Marchandise</h2>
        </div>
        <div class="content">
            <p>Bonjour {{ $supplier->name }},</p>
            
            <p>Nous vous informons par la présente du retour d'un lot de marchandises concernant le produit <strong>{{ $stock->product->title ?? 'Produit Inconnu' }}</strong> (Réf: {{ $stock->product->reference ?? 'N/A' }}).</p>
            
            <p><strong>Détails du lot :</strong></p>
            <ul>
                <li>Numéro de Lot : {{ $stock->batch_number }}</li>
                <li>Date d'expiration : {{ $stock->expiration_date }}</li>
                <li>Motif du retour : {{ $justification }}</li>
            </ul>
            
            <p>Vous trouverez ci-joint le bon de retour au format PDF pour vos dossiers.</p>
            
            <p>Merci de votre collaboration.</p>
        </div>
        <div class="footer">
            <p>Ceci est un message automatique, merci de ne pas y répondre directement.</p>
        </div>
    </div>
</body>
</html>
