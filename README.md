# Un dîner à deux

Petite application web en français pour qu’Acho choisisse un dîner et indique le type de cadeau qu’elle souhaite pour son anniversaire.

## Lancer l’application

Il faut Node.js 18 ou plus récent. Sous Windows, double-cliquer sur `Démarrer.bat`. Le navigateur ouvrira l’application et la fenêtre noire restera ouverte tant qu’elle fonctionne.

Pour démarrer manuellement, ouvrir un terminal dans ce dossier et lancer :

```sh
node server.js
```

Puis ouvrir [http://localhost:3000](http://localhost:3000). Le serveur crée automatiquement `data/reservations.json` et y conserve les demandes et les réponses.

## Notifications

Dans « Espace de l’hôte », cliquer sur « Activer les alertes ». L’espace de l’hôte doit rester ouvert dans le navigateur pour recevoir une notification lorsqu’une nouvelle demande arrive. Pour activer les notifications du navigateur, il faut ouvrir l’application sur `localhost` ou en HTTPS. Sur un réseau local, Acho peut ouvrir l’adresse IP de l’ordinateur qui héberge l’application, sur le port `3000` ; la liste des demandes se mettra alors à jour en direct, même si les notifications natives du navigateur ne sont pas autorisées en HTTP.

Les notifications sont des alertes de navigateur en temps réel lorsque l’espace de l’hôte reste ouvert. Pour recevoir des notifications à distance quand le navigateur est fermé, il faudrait héberger l’application en ligne et ajouter un service de notifications push.
