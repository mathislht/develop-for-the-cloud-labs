# Ships API - Projet Serverless AWS

## Description

Application serverless complète pour gérer une flotte de bateaux, utilisant une architecture moderne AWS avec API Gateway, DynamoDB et S3. Ce projet démontre l'intégration de services AWS pour créer une API REST sécurisée avec authentification par API Key.

## Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTPS + API Key
       │
┌──────▼──────────────────┐
│   API Gateway (REST)    │
│   - GET /ships          │
│   - GET /ships/profile  │
│   - GET /ships/photo    │
│   - CORS enabled        │
│   - API Key required    │
└──┬────────────────┬─────┘
   │                │
   │                │
┌──▼──────────┐  ┌─▼──────────┐
│  DynamoDB   │  │     S3      │
│ ShipsTable  │  │   Bucket    │
│             │  │   Images    │
└─────────────┘  └─────────────┘
```

## Fonctionnalités

### API REST sécurisée
- **3 endpoints REST** pour accéder aux données des bateaux
- **Authentification par API Key** avec Usage Plan configuré
- **CORS complet** pour l'accès depuis navigateur
- **Intégration directe** avec DynamoDB et S3 (sans Lambda)

### Gestion des données
- **Base de données DynamoDB** pour les informations des bateaux
- **Stockage S3** pour les photos des bateaux
- **2 bateaux d'exemple** préchargés avec leurs métadonnées et images

### Déploiement automatisé
- **Script de déploiement TypeScript** pour créer toute l'infrastructure
- **Script de destruction** pour nettoyer toutes les ressources
- **Configuration automatique** des rôles IAM et permissions

## Technologies

- **AWS API Gateway** - Point d'entrée REST API
- **AWS DynamoDB** - Base de données NoSQL
- **AWS S3** - Stockage d'objets (images)
- **AWS IAM** - Gestion des permissions et rôles
- **TypeScript** - Langage de développement
- **AWS SDK v3** - Client AWS pour Node.js

## Structure du projet

```
.
├── src/
│   ├── deploy-project.ts      # Script de déploiement complet
│   └── destroy-project.ts     # Script de nettoyage
├── data/
│   └── ships.json             # Données des bateaux
├── assets/
│   ├── pecheur-b-001.jpg      # Photo bateau de pêche
│   └── tanker-b-002.jpg       # Photo tanker
├── checker/
│   └── index.html             # Interface web de test
└── README.md
```

## Endpoints API

### GET /ships
Liste tous les bateaux disponibles.

**Réponse:**
```json
{
  "ships": [
    {
      "id": "B-001",
      "nom": "Le Vigilant",
      "type": "Pêcheur",
      "pavillon": "France",
      "taille": 12.5,
      "nombre_marins": 4,
      "s3_image_key": "pecheur-b-001.jpg"
    }
  ]
}
```

### GET /ships/profile/{key}
Récupère les détails d'un bateau spécifique depuis DynamoDB.

**Paramètres:**
- `key` - ID du bateau (ex: B-001)

**Réponse:**
```json
{
  "id": "B-001",
  "nom": "Le Vigilant",
  "type": "Pêcheur",
  "pavillon": "France",
  "taille": 12.5,
  "nombre_marins": 4,
  "s3_image_key": "pecheur-b-001.jpg"
}
```

### GET /ships/photo/{key}
Récupère la photo d'un bateau depuis S3.

**Paramètres:**
- `key` - Nom du fichier image (ex: pecheur-b-001.jpg)

**Réponse:** Image binaire (JPEG)

## Installation et déploiement

### Prérequis
- AWS CLI configuré avec SSO
- Node.js 18+ installé
- Session AWS active (`aws sso login`)
- Profil AWS `aws-labs` configuré

### Installation
```bash
cd labs/05-projet-capstone-one
npm install
```

### Déploiement
```bash
npx ts-node src/deploy-project.ts
```

Le script va :
1. Créer le bucket S3 `ships-capstone-project-bucket`
2. Uploader les 2 images des bateaux
3. Créer la table DynamoDB `ShipsTable`
4. Insérer les 2 bateaux dans la table
5. Créer l'API Gateway `ShipsAPI`
6. Configurer les 3 endpoints avec intégrations
7. Activer CORS sur tous les endpoints
8. Créer une API Key et un Usage Plan
9. Déployer l'API sur le stage `dev`

**Sortie attendue:**
```
Starting Project Deployment...
Creating S3 bucket: ships-capstone-project-bucket...
Bucket ships-capstone-project-bucket created successfully
Uploading images to S3...
Uploaded pecheur-b-001.jpg as pecheur-b-001.jpg
Uploaded tanker-b-002.jpg as tanker-b-002.jpg
...
API deployed successfully!
API URL: https://xxxxx.execute-api.eu-west-1.amazonaws.com/dev
API Key Value: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Suppression des ressources
```bash
npx ts-node src/destroy-project.ts
```

Le script supprime :
1. Tous les items de la table DynamoDB
2. La table DynamoDB
3. Tous les objets du bucket S3
4. Le bucket S3
5. L'API Gateway complète

## Test de l'API

### Avec curl
```bash
# Remplacer API_KEY et API_ID par vos valeurs
API_KEY="votre-api-key"
API_URL="https://xxxxx.execute-api.eu-west-1.amazonaws.com/dev"

# Lister tous les bateaux
curl -H "x-api-key: $API_KEY" "$API_URL/ships"

# Récupérer un profil
curl -H "x-api-key: $API_KEY" "$API_URL/ships/profile/B-001"

# Télécharger une photo
curl -H "x-api-key: $API_KEY" "$API_URL/ships/photo/pecheur-b-001.jpg" -o bateau.jpg
```

### Avec l'interface web
1. Ouvrir `checker/index.html` avec Live Server dans VS Code
2. Entrer l'URL de l'API Gateway
3. Entrer l'API Key
4. Cliquer sur "Test All Endpoints" ou "Load Ships"

## Configuration

### Variables dans deploy-project.ts
```typescript
const REGION = 'eu-west-1';
const BUCKET_NAME = 'ships-capstone-project-bucket';
const TABLE_NAME = 'ShipsTable';
const API_NAME = 'ShipsAPI';
```

### Rôles IAM requis
- `APIGatewayDynamoDBServiceRole` - Pour accès DynamoDB
- `APIGatewayS3ServiceRole` - Pour accès S3

Ces rôles doivent exister avant le déploiement.

## Sécurité

### API Keys
- Authentification requise sur tous les endpoints GET
- Usage Plan configuré avec quotas:
  - Rate Limit: 100 requêtes/seconde
  - Burst Limit: 200 requêtes
  - Quota: 10,000 requêtes/mois

### CORS
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token`

### Permissions IAM
- API Gateway assume des rôles IAM spécifiques pour accéder à DynamoDB et S3
- Principe du moindre privilège appliqué

## Bateaux disponibles

### B-001 - Le Vigilant
- **Type:** Pêcheur
- **Pavillon:** France
- **Taille:** 12.5 mètres
- **Équipage:** 4 marins

### B-002 - Ocean Giant
- **Type:** Tanker
- **Pavillon:** Libéria
- **Taille:** 330 mètres
- **Équipage:** 25 marins

## Dépannage

### Erreur CORS
Si les requêtes depuis le navigateur sont bloquées, vérifier que l'API Key est fournie dans les en-têtes.

### Erreur 403 Forbidden
- Vérifier que l'API Key est correcte
- Vérifier que l'API Key est associée au Usage Plan
- Vérifier que le quota n'est pas dépassé

### Ressources non trouvées
Vérifier que les rôles IAM `APIGatewayDynamoDBServiceRole` et `APIGatewayS3ServiceRole` existent.

## Licence

MIT
