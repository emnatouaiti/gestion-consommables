<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Nouvelle Demande de Consommable</title>
</head>
<body>
    <h2>Nouvelle demande de consommable</h2>
    <p>Bonjour Directeur,</p>
    <p>Une nouvelle demande de consommable a ete creee par <strong>{{ $demande->user->name }}</strong> le {{ $demande->created_at }}.</p>
    <p>Vous trouverez la demande en piece jointe (PDF).</p>
    <p>Cordialement,<br>L'equipe Consotracker</p>
</body>
</html>
