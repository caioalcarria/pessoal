# Configuração do Firebase

Para usar este projeto, você precisa configurar o Firebase. Siga estes passos:

## 1. Criar Projeto no Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em "Adicionar projeto"
3. Digite um nome para seu projeto
4. Siga os passos de configuração

## 2. Configurar Firestore

1. No console do Firebase, vá para "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha "Iniciar no modo de teste" (para desenvolvimento)
4. Escolha uma localização (ex: us-central1)

## 3. Configurar Autenticação

1. No console do Firebase, vá para "Authentication"
2. Clique em "Começar"
3. Em "Sign-in method", habilite "Anônimo"
4. Clique em "Salvar"

## 4. Obter Configurações

1. No console do Firebase, clique na engrenagem (⚙️) ao lado de "Visão geral do projeto"
2. Selecione "Configurações do projeto"
3. Role até "Seus aplicativos" e clique em "Adicionar app"
4. Escolha "Web" e dê um nome ao app
5. Copie as configurações fornecidas

## 5. Configurar o Projeto

Edite o arquivo `src/firebase-config.js` com suas configurações:

```javascript
export const firebaseConfig = {
  apiKey: "sua-api-key-aqui",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "seu-app-id",
};

export const appId = "seu-app-id";
```

## 6. Regras do Firestore

Configure as regras do Firestore para permitir leitura/escrita:

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

**⚠️ Nota:** As regras acima permitem acesso total. Para produção, configure regras mais restritivas.

## 7. Estrutura de Dados

O projeto criará automaticamente esta estrutura no Firestore:

```
artifacts/
└── {appId}/
    ├── public/
    │   └── data/
    │       └── projects/
    │           ├── {projectId1}/
    │           │   └── name: "CMPC"
    │           └── {projectId2}/
    │               └── name: "Tekno"
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

## 8. Testar

Após configurar tudo:

1. Execute `npm run dev`
2. Abra o navegador em `http://localhost:5173`
3. Verifique se os projetos são criados automaticamente
4. Teste criando um registro

## Solução de Problemas

### Erro de Autenticação

- Verifique se a autenticação anônima está habilitada
- Confirme se as configurações do Firebase estão corretas

### Erro de Permissões

- Verifique as regras do Firestore
- Certifique-se de que o modo de teste está ativo

### Dados não aparecem

- Verifique se o Firestore está criado
- Confirme se a estrutura de dados está correta
