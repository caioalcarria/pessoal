# Sistema de Compartilhamento - Configuração

## Funcionalidades Implementadas

### 1. Botão de Compartilhamento

- Localizado no header da aplicação (botão verde "Compartilhar")
- Gera um link único para o mês atual
- O link expira em 30 dias

### 2. Página de Visualização Pública

- URL: `/share/{shareId}`
- Não requer login
- Mostra os dados do mês compartilhado
- Inclui funcionalidades de exportação

### 3. Estrutura de Dados no Firestore

#### Coleção: `artifacts/{appId}/shares/{shareId}`

```javascript
{
  shareId: "share_1234567890_abc123",
  userId: "user_uid",
  userName: "Nome do Usuário",
  month: 12,
  year: 2024,
  monthName: "dezembro de 2024",
  logs: [
    {
      date: "2024-12-01",
      projects: ["CMPC", "Tekno"],
      description: "Descrição da atividade",
      files: "arquivo1.js,arquivo2.css",
      fileProjectMap: { "arquivo1.js": "CMPC", "arquivo2.css": "Tekno" },
      fileCategoryMap: { "arquivo1.js": "web-application" }
    }
  ],
  createdAt: Timestamp,
  expiresAt: Timestamp, // 30 dias após criação
  isActive: true
}
```

## Configuração do Firebase

### 1. Regras de Segurança (firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Acesso público para compartilhamentos
    match /artifacts/{appId}/shares/{shareId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Dados de usuários - apenas o próprio usuário
    match /artifacts/{appId}/users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Projetos - leitura pública, escrita apenas autenticados
    match /artifacts/{appId}/public/data/projects/{projectId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### 2. Deploy das Regras

```bash
# Instalar Firebase CLI (se ainda não tiver)
npm install -g firebase-tools

# Login no Firebase
firebase login

# Inicializar projeto (se necessário)
firebase init firestore

# Deploy das regras
firebase deploy --only firestore:rules
```

## Como Usar

### 1. Gerar Link de Compartilhamento

1. Faça login na aplicação
2. Navegue para o mês desejado
3. Clique no botão "Compartilhar" (verde)
4. O link será gerado automaticamente
5. Copie o link e compartilhe

### 2. Acessar Dados Compartilhados

1. Acesse o link compartilhado
2. Os dados serão carregados automaticamente
3. Use as visualizações de calendário ou lista
4. Exporte os dados se necessário

### 3. Funcionalidades da Página Pública

- **Visualização em Calendário**: Mostra os dados em formato de calendário
- **Visualização em Lista**: Mostra os dados em formato de lista
- **Exportação**: Baixar relatório XLSX, copiar tabela ou texto formatado
- **Informações do Usuário**: Mostra quem compartilhou os dados

## Segurança

### Links de Compartilhamento

- **Expiração**: 30 dias após criação
- **Acesso**: Qualquer pessoa com o link pode visualizar
- **Edição**: Apenas o criador pode editar/excluir
- **Desativação**: Links podem ser desativados manualmente

### Dados Compartilhados

- **Escopo**: Apenas dados do mês específico
- **Projetos**: Inclui todos os projetos do mês
- **Arquivos**: Inclui mapeamento de projetos e categorias
- **Descrições**: Inclui todas as descrições das atividades

## Limitações

1. **Sem Edição**: Usuários com link público não podem editar dados
2. **Apenas Visualização**: Funcionalidade limitada à visualização e exportação
3. **Expiração Automática**: Links expiram após 30 dias
4. **Dados do Mês**: Apenas dados do mês específico são compartilhados

## Troubleshooting

### Link não funciona

- Verifique se o link não expirou (30 dias)
- Verifique se o link foi desativado
- Verifique se os dados existem no Firestore

### Erro de permissão

- Verifique se as regras do Firestore foram deployadas
- Verifique se a coleção `shares` existe
- Verifique se o documento do share existe

### Dados não aparecem

- Verifique se os logs do mês existem
- Verifique se o usuário que compartilhou tem dados no mês
- Verifique se a estrutura dos dados está correta
