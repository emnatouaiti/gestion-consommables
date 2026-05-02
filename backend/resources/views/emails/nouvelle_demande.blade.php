<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Nouvelle Demande de Consommable</title>
</head>
<body>
    <h2>Nouvelle demande de consommable</h2>
    <p>Bonjour Directeur,</p>
    <p>Une nouvelle demande de consommable a été créée par <strong>{{ $demande->user->name }}</strong> le {{ $demande->created_at }}.</p>
    <p>Vous trouverez la demande en pièce jointe (PDF).</p>
    <p>Cordialement,<br>L'équipe Consotracker</p>
</body>
</html>
