# Loc and Go — prototype

Suivi des modules de location (bungalows, bâtiments modulaires) par QR code : import du parc, contrats en lignes, préparation à l'atelier, réception signée par le client, retour, constat et remise en état.

## Lancer le projet

Sur StackBlitz : ouvrir `https://stackblitz.com/github/theovigouroux7-dot/loc-and-go`. L'installation et le démarrage sont automatiques.

En local :

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

## Parcours à tester

1. **Import du parc** : fichier Excel ou CSV (avec correspondance des colonnes et contrôle des lignes), liste de numéros collée, ou ajout manuel. Un module avec un numéro de contrat est rattaché automatiquement et passe « loué ».
2. **Nouveau contrat** : déposer le PDF du contrat pour que Claude pré-remplisse le formulaire (client, chantier, dates, modules, équipements ; transport, montage et nettoyage sont écartés), joindre le plan d'implantation, puis vérifier et enregistrer. Saisie manuelle possible : référence, client, chantier, date de livraison, puis les groupes de modules comme sur le contrat papier (type, nombre, équipements en quantités totales : climatiseurs, tables, chaises, kitchenette…). Les équipements sont répartis entre les modules du groupe.
3. **Atelier** : la liste des contrats à préparer, puis, dans chaque contrat, les modules avec ce qu'il faut y installer. Pour chaque module : scanner (ou saisir) son numéro, prendre les photos, vérifier les équipements obligatoires, ajuster les équipements réellement installés, puis la personne qui a fait l'inventaire signe. Le module passe « prêt ».
4. **Date de livraison passée** : le module passe automatiquement « loué ».
5. **Vue client** (`/m/<id>`, ouverte par le QR code) : le client voit tous les modules de son contrat avec leur inventaire, signe la réception une seule fois pour tous (il note ce qui manque dans les remarques), demande un SAV ou le retour d'un ou plusieurs modules, y compris avant la date de livraison prévue.
6. **Atelier › retour** : scanner le module qui rentre, faire le constat (matériel présent, intact ou abîmé).
7. **Remise en état** : « à remettre en état » → « en réparation » → « disponible ».
8. **Espace client, services** : dans les paramètres, des offres (photo, titre, description) que le client voit avec un bouton « Demander un devis », et un lien d'avis Google activable. Les devis, retours (un par contrat, avec les modules qui sortent) et réserves arrivent dans Demandes clients.
9. **Planning** : livraisons, retours demandés, fins de contrat et SAV en vue mois ou en liste, avec export vers Google Agenda, Outlook ou Apple Calendrier (fichier .ics).

## Mettre l'application en ligne (Supabase + Vercel)

Le site public (page de présentation) est à la racine, le logiciel sous /app, l'administration sous /admin.
Chaque loueur a son propre espace : un lien /espace/<identifiant> et un code à 6 chiffres. Ses données sont cloisonnées.

### 1. Base de données (Supabase)

Dans Supabase : SQL Editor > New query > coller le contenu de `supabase/schema.sql` > Run.
Le script peut être relancé sans risque. Les données déjà présentes deviennent l'espace « principal » (version complète).
Il ferme aussi tout accès direct depuis le navigateur : seul le serveur lit et écrit.

### 2. Variables dans Vercel (Settings > Environment Variables)

- `NEXT_PUBLIC_SUPABASE_URL` : l'adresse du projet Supabase (déjà en place).
- `SUPABASE_SERVICE_ROLE_KEY` : Supabase > Project Settings > API Keys > clé « service_role » (ou « secret »). Elle reste sur le serveur, ne la partagez jamais.
- `ADMIN_PASSWORD` : le mot de passe de la page /admin.
- `ANTHROPIC_API_KEY` : pour l'analyse des contrats et des fichiers Excel par Claude (version complète uniquement).

Après avoir ajouté les variables : Deployments > … > Redeploy.

### 3. Créer les espaces

Ouvrez /admin, connectez-vous, créez les espaces (par exemple 100 en version d'essai), puis exportez le CSV des liens et des codes.
« Ouvrir » vous connecte directement à un espace ; l'espace « principal » est le vôtre, et son code s'affiche aussi dans la liste.

Version d'essai : pas d'analyse par Claude, pas de prestations complémentaires dans l'espace client, 50 QR codes au maximum.
Les fonctions bloquées restent visibles avec un cadenas et un bouton « Demander une démo ».
Les demandes de démo arrivent dans /admin (avec un signal sonore si la page est ouverte).

### 4. Nom de domaine

Vercel > projet > Settings > Domains > ajouter le domaine, puis copier les lignes DNS indiquées chez le registrar.
Branchez le domaine avant d'imprimer les plaques : l'adresse est inscrite dans chaque QR code.

## Limites du prototype

- Le scan par caméra demande l'autorisation du navigateur. Sur StackBlitz, ouvrir l'aperçu dans un nouvel onglet. Sinon, « Lire depuis une photo » ou la saisie manuelle du numéro fonctionnent toujours.
- Un QR code imprimé depuis StackBlitz contient une adresse d'aperçu qui ne fonctionne que dans le navigateur où tourne StackBlitz : scanné avec un téléphone, il ne mène nulle part. Pour tester avec un vrai téléphone, il faut l'application en ligne (Vercel).
- En mode développement (StackBlitz), chaque page est compilée à sa première ouverture : quelques secondes d'attente sont normales. Ce délai disparaît une fois en ligne sur Vercel.

## Technique

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS. Bibliothèques : `qrcode` (génération), `html5-qrcode` (lecture), `xlsx` (import Excel/CSV), `jspdf` (plaques en PDF), `idb-keyval` (cache des photos).

- `lib/types.ts` : modèle de données (un contrat = une liste de lignes module + dates).
- `lib/store.tsx` : état de l'application, actions et transitions automatiques.
- `lib/remote.ts` : synchronisation avec Supabase (n'envoie que ce qui change, récupère les modifications des autres appareils toutes les 5 secondes).
- `lib/inventory.ts` : catalogue d'équipements et inventaire final d'un module.
- `app/(app)/` : écrans bureau et atelier. `app/m/[id]/` : page client ouverte par le QR code.
