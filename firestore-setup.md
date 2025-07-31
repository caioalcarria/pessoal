# Configuração do Firestore para month-tasks

## 🔥 Configuração no Console Firebase

### 1. Acessar o Console

1. Vá para [console.firebase.google.com](https://console.firebase.google.com)
2. Selecione o projeto **month-tasks**

### 2. Configurar Firestore Database

1. No menu lateral, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de teste"** (para desenvolvimento)
4. Selecione uma localização (recomendo: **us-central1**)
5. Clique em **"Próximo"** e depois **"Concluir"**

### 3. Configurar Autenticação

1. No menu lateral, clique em **"Authentication"**
2. Clique em **"Começar"**
3. Na aba **"Sign-in method"**, clique em **"Anônimo"**
4. Clique no toggle para **habilitar**
5. Clique em **"Salvar"**

### 4. Regras do Firestore

1. No Firestore Database, clique na aba **"Regras"**
2. Substitua as regras existentes por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir acesso anônimo para desenvolvimento
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Clique em **"Publicar"**

## 📊 Estrutura de Dados

O projeto criará automaticamente esta estrutura:

```
artifacts/
└── month-tasks/
    ├── public/
    │   └── data/
    │       └── projects/
    │           ├── {projectId1}/
    │           │   └── name: "CMPC"
    │           ├── {projectId2}/
    │           │   └── name: "Tekno"
    │           ├── {projectId3}/
    │           │   └── name: "Melitta"
    │           └── {projectId4}/
    │               └── name: "Essentia"
    └── users/
        └── {userId}/
            └── logs/
                ├── "2024-01-15"/
                │   ├── projects: ["CMPC", "Tekno"]
                │   ├── description: "Desenvolvimento..."
                │   ├── files: "arquivo1.js, arquivo2.css"
                │   └── userId: "user123"
                └── "2024-01-16"/
                    └── ...
```

## ✅ Testar a Configuração

1. Execute o projeto: `npm run dev`
2. Abra o navegador em `http://localhost:5174`
3. Verifique se:
   - Os projetos são criados automaticamente
   - Você consegue criar um registro
   - Os dados aparecem em tempo real

## 🔍 Verificar no Console

1. No console Firebase, vá para **Firestore Database**
2. Clique em **"Dados"**
3. Você deve ver a estrutura `artifacts/month-tasks/` sendo criada
4. Os projetos aparecerão em `public/data/projects/`
5. Os logs aparecerão em `users/{userId}/logs/`

## 🚨 Solução de Problemas

### Erro de Permissões

- Verifique se as regras do Firestore estão configuradas corretamente
- Certifique-se de que o modo de teste está ativo

### Dados não aparecem

- Verifique se o Firestore foi criado
- Confirme se a autenticação anônima está habilitada
- Verifique o console do navegador para erros

### Erro de Autenticação

- Verifique se a autenticação anônima está habilitada
- Confirme se as configurações do Firebase estão corretas no código

## 📱 Próximos Passos

Após configurar o Firestore:

1. Teste criando alguns registros
2. Teste a exportação XLSX
3. Teste a funcionalidade de IA (requer chave da API Gemini)
4. Configure as regras de segurança para produção

## 🔒 Para Produção

Quando estiver pronto para produção, atualize as regras do Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/projects/{projectId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /artifacts/{appId}/users/{userId}/logs/{logId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
