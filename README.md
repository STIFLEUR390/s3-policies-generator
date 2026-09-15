# 🪣 S3 / RustFS Policy Generator

> Générez des policies S3 en un clic — JSON, Terraform, CloudFormation, CLI — avec guardrails de sécurité intégrés et testeur en temps réel.

**🔗 [Démo live](https://s3-policies-generator.vercel.app/)**

## Fonctionnalités

### 8 templates de policies

| Template | Usage |
|---|---|
| **Privé (auth)** | Accès complet via credentials IAM, anonymous denied |
| **Lecture publique** | Objets lisibles par tous, écriture refusée |
| **Public + Auth Write** | Lecture publique, écriture authentifiée |
| **CloudFront OAC** | Autorise uniquement une distribution CloudFront |
| **Cross-account** | Accès depuis un autre compte AWS |
| **Deny insecure transport** | Bloque tout accès non-HTTPS |
| **Restriction IP** | N'autorise qu'un CIDR IP spécifique |
| **MFA requis** | Exige MFA pour les écritures/suppressions |

### 4 formats d'export

- **JSON** — Policy AWS standard
- **Terraform** — Ressource `aws_s3_bucket_policy`
- **CloudFormation** — Ressource `AWS::S3::BucketPolicy`
- **CLI** — Commandes `aws s3api` prêtes à copier

### Guardrails de sécurité

Activez des Deny statements en un clic :

- 🛡️ Exiger HTTPS (deny insecure transport)
- 🔐 Exiger chiffrement SSE (encryption at rest)
- 🌐 Restreindre à un VPC Endpoint
- 🏢 Restreindre à une Organization AWS

### Testeur en temps réel

- **Signature V4** en pur browser (WebCrypto API, zero dépendance)
- Test List, Read, Write, Delete
- Upload d'image pour tester l'upload réel
- Résultats visuels (✅/❌) en temps réel

### Outputs

Pour chaque template, l'app génère :

- **Bucket Policy** (JSON)
- **IAM Policy** (JSON)
- **Fichier `.env`** prêt à copier
- **Commandes RustFS Admin** (curl + aws CLI)
- **Snippet Node.js** (SDK v3 avec upload/download/presigned URLs)

### PWA

Installable sur mobile et desktop pour un usage hors ligne.

## Tech Stack

- [Astro](https://astro.build) — framework
- [Vue 3](https://vuejs.org) — UI
- [Tailwind CSS v4](https://tailwindcss.com) — styling
- [shadcn-vue](https://www.shadcn-vue.com) — composants UI
- [Reka UI](https://reka-ui.com) — primitives

## Développement

```sh
# Installer les dépendances
bun install

# Lancer le serveur dev
bun dev

# Build production
bun build
```

## Déploiement

Le projet est automatiquement déployé sur Vercel depuis le repository GitHub.

Pour déployer manuellement :

```sh
bun build
bun preview
```

## Structure du projet

```text
src/
├── components/
│   ├── PolicyGenerator.vue    # Composant principal
│   ├── PolicyTester.vue       # Testeur de policies
│   └── ui/                    # Composants shadcn-vue
├── lib/
│   ├── policy.ts              # Génération de policies
│   ├── guardrails.ts          # Guardrails de sécurité
│   ├── iac.ts                 # Export Terraform/CloudFormation/CLI
│   ├── s3test.ts              # Test S3 (Signature V4)
│   └── utils.ts               # Utilitaires (cn)
├── layouts/
│   └── Layout.astro           # Layout + PWA + CSS vars
├── pages/
│   └── index.astro            # Page d'accueil
└── styles/
    └── global.css             # Tailwind + thème
```

## License

MIT
