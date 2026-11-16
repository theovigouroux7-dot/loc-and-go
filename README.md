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
2. **Nouveau contrat** : référence, client, chantier, date de livraison, types et quantités de modules. Chaque module demandé crée une ligne « à préparer ».
3. **Atelier › préparation** : scanner (ou saisir) le numéro du module, prendre les photos, cocher l'inventaire, valider. Le module passe « prêt ».
4. **Date de livraison passée** : le module passe automatiquement « loué ».
5. **Vue client** (`/m/<id>`, lien sur la fiche du module) : contrôle et signature de la réception, demande de SAV ou de retour.
6. **Atelier › retour** : scanner le module qui rentre, faire le constat (matériel présent, intact ou abîmé).
7. **Remise en état** : « à remettre en état » → « en réparation » → « disponible ».

## Limites du prototype

- Les données sont enregistrées dans le navigateur (localStorage, photos dans IndexedDB). Un autre appareil ne les voit pas. Prochaine étape : une base de données en ligne partagée (Supabase par exemple) avec comptes et rôles.
- Le scan par caméra demande l'autorisation du navigateur. Sur StackBlitz, ouvrir l'aperçu dans un nouvel onglet. La saisie manuelle du numéro reste toujours possible.

## Technique

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS. Bibliothèques : `qrcode` (génération), `html5-qrcode` (lecture), `xlsx` (import Excel/CSV), `idb-keyval` (photos).

- `lib/types.ts` : modèle de données (un contrat = une liste de lignes module + dates).
- `lib/store.tsx` : état de l'application, actions et transitions automatiques.
- `app/(app)/` : écrans bureau et atelier. `app/m/[id]/` : page client ouverte par le QR code.
