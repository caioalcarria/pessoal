# 🔥 Configuração do Firestore - month-tasks

Este projeto utiliza Firebase Firestore para armazenamento de dados e Firebase Auth para autenticação via Google.

## ✅ Passo a Passo para Configurar

### 1. Acessar o Console Firebase

1. Vá para [console.firebase.google.com](https://console.firebase.google.com)
2. Selecione o projeto **month-tasks**

### 2. Criar Firestore Database

1. No menu lateral, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de teste"** (para desenvolvimento)
4. Selecione localização: **us-central1**
5. Clique em **"Próximo"** e depois **"Concluir"**

### 3. Configurar Autenticação Google

1. No menu lateral, clique em **"Authentication"**
2. Clique em **"Começar"**
3. Na aba **"Sign-in method"**, clique em **"Google"**
4. Clique no toggle para **habilitar**
5. Adicione um **Project support email** (seu email do Google)
6. Clique em **"Salvar"**

**⚠️ Importante:** Desative a autenticação anônima se estiver habilitada, pois agora usamos apenas Google Auth.

### 4. Configurar Regras do Firestore

1. No Firestore Database, clique na aba **"Regras"**
2. Substitua as regras existentes por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir acesso apenas para usuários autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Clique em **"Publicar"**

## 🚀 Testar a Aplicação

1. Execute: `npm run dev`
2. Acesse: `http://localhost:5174`
3. Verifique se:
   - Os projetos são criados automaticamente (CMPC, Tekno, Melitta, Essentia)
   - Você consegue criar um registro
   - Os dados aparecem em tempo real

## 🔍 Verificar no Console Firebase

1. No console Firebase, vá para **Firestore Database**
2. Clique em **"Dados"**
3. Você deve ver a estrutura:
   ```
   artifacts/
   └── month-tasks/
       ├── public/
       │   └── data/
       │       └── projects/
       └── users/
           └── {userId}/
               └── logs/
   ```

## 🎯 Funcionalidades Testadas

- ✅ **Calendário** - Visualização mensal
- ✅ **Lista** - Visualização em lista
- ✅ **Salvar Registros** - Criar/editar logs
- ✅ **Projetos** - Seleção de projetos
- ✅ **Arquivos** - Adicionar/remover arquivos
- ✅ **Exportação XLSX** - Baixar relatório
- ✅ **Firebase** - Salvamento em tempo real

## 🚨 Se Algo Não Funcionar

### Erro de Permissões

- Verifique se as regras do Firestore estão configuradas
- Certifique-se de que o modo de teste está ativo

### Dados não aparecem

- Verifique se o Firestore foi criado
- Confirme se a autenticação anônima está habilitada
- Verifique o console do navegador para erros

### Erro de Autenticação

- Verifique se a autenticação anônima está habilitada
- Confirme se as configurações do Firebase estão corretas

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
