<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Nouveau compte</title>
    <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .card { max-width:600px; margin:20px auto; padding:20px; border:1px solid #eee; border-radius:6px; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Bonjour {{ $name }},</h2>
        <p>Un compte a été créé pour vous sur l'application.</p>
        <p><strong>Accès :</strong></p>
        <ul>
            <li>Email : {{ $email }}</li>
            <li>Mot de passe temporaire : <strong>{{ $password }}</strong></li>
        </ul>
        <p>Veuillez vous connecter et changer votre mot de passe dès que possible.</p>
        <p>Cordialement,<br/>L'équipe</p>
    </div>
</body>
</html>
