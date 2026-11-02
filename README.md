# Vigie

L'Afrique en direct, le Mali au cœur : actualités, inondations, sécheresses, feux, séismes, poussières et débit des fleuves sur une seule carte.

Site : https://farabougou.github.io/vigie/

## Comment ça marche

- `index.html` est le site complet, en un seul fichier.
- `scripts/collecter-actus.mjs` lit les flux RSS de la presse et classe les titres par pays. La liste des médias se trouve en haut du fichier, dans `FLUX`.
- `.github/workflows/actus.yml` lance cette collecte toutes les 30 minutes et publie `actus.json` sur la branche `donnees`.
- Seuls le titre, le nom du média, la date et le lien vers l'article d'origine sont conservés.

## Arrêter la collecte

Onglet **Actions** du dépôt, puis **Collecte des actualités**, puis **Disable workflow**.
