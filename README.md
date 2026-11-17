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
2. **Nouveau contrat** : référence, client, chantier, date de livraison, puis les groupes de modules comme sur le contrat papier (type, nombre, équipements en quantités totales : climatiseurs, tables, chaises, kitchenette…). Les équipements sont répartis entre les modules du groupe.
3. **Atelier** : la liste des contrats à préparer, puis, dans chaque contrat, les modules avec ce qu'il faut y installer. Pour chaque module : scanner (ou saisir) son numéro, prendre les photos, vérifier les équipements obligatoires, ajuster les équipements réellement installés, puis la personne qui a fait l'inventaire signe. Le module passe « prêt ».
4. **Date de livraison passée** : le module passe automatiquement « loué ».
5. **Vue client** (`/m/<id>`, ouverte par le QR code) : le client voit tous les modules de son contrat avec leur inventaire, signe la réception une seule fois pour tous (il note ce qui manque dans les remarques), demande un SAV ou le retour d'un ou plusieurs modules, y compris avant la date de livraison prévue.
6. **Atelier › retour** : scanner le module qui rentre, faire le constat (matériel présent, intact ou abîmé).
7. **Remise en état** : « à remettre en état » → « en réparation » → « disponible ».
8. **Planning** : livraisons, retours demandés, fins de contrat et SAV en vue mois ou en liste, avec export vers Google Agenda, Outlook ou Apple Calendrier (fichier .ics).

## Mettre l'application en ligne (Supabase + Vercel)

Sans base de données, les données restent dans le navigateur : un téléphone ne voit pas le parc créé sur l'ordinateur. Pour que le bureau, l'atelier et les clients partagent les mêmes données, il faut une base en ligne (Supabase, gratuit) et un hébergement (Vercel, gratuit). Compter 10 minutes.

### 1. Créer la base de données (Supabase)

1. Créer un compte sur https://supabase.com puis **New project** (région : Europe, par exemple Paris ou Francfort). Noter le mot de passe proposé.
2. Une fois le projet prêt : menu **SQL Editor** > **New query**. Coller tout le contenu du fichier `supabase/schema.sql` de ce dépôt, puis **Run**. Le message « Success » doit s'afficher.
3. Menu **Project Settings** > **API** (ou **Data API**) : copier la **Project URL** et la clé **anon** (ou **publishable**). Ne jamais utiliser la clé `service_role` / `secret`.

### 2. Héberger l'application (Vercel)

1. Créer un compte sur https://vercel.com avec « Continue with GitHub ».
2. **Add New** > **Project** > importer le dépôt `loc-and-go`.
3. Avant de cliquer sur **Deploy**, ouvrir **Environment Variables** et ajouter :
   - `NEXT_PUBLIC_SUPABASE_URL` = la Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la clé anon / publishable
4. **Deploy**. Vercel donne une adresse du type `https://loc-and-go-xxx.vercel.app`.

En bas du menu de l'application, l'indicateur doit afficher « Données en ligne à jour ». Chaque `git push` sur GitHub redéploie automatiquement l'application.

Important : les QR codes contiennent l'adresse du site. Imprimer les plaques depuis l'adresse Vercel définitive, pas depuis StackBlitz.

### Sécurité

Dans ce prototype, toute personne qui connaît l'adresse du site peut lire et modifier les données. C'est suffisant pour des tests, pas pour de vraies données clients : l'étape suivante est d'ajouter des comptes (bureau, atelier) et un accès client limité à son propre contrat.

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
