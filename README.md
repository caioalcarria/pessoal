# Registro de Atividades Diárias - React

Este é um projeto React que permite registrar e gerenciar atividades diárias de trabalho. O projeto foi convertido de uma aplicação HTML pura para uma estrutura React moderna usando Vite e styled-components.

## 🚀 Tecnologias Utilizadas

- **React 18** - Biblioteca JavaScript para interfaces de usuário
- **Vite** - Build tool rápida e moderna
- **Styled Components** - CSS-in-JS para estilização
- **Firebase** - Backend como serviço (Firestore e Auth)
- **XLSX** - Biblioteca para exportação de arquivos Excel
- **Font Awesome** - Ícones
- **Inter Font** - Tipografia

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── Calendar.jsx      # Componente de visualização em calendário
│   ├── ListView.jsx      # Componente de visualização em lista
│   └── LogModal.jsx      # Modal para edição de registros
├── App.jsx               # Componente principal
├── main.jsx              # Ponto de entrada da aplicação
└── firebase-config.js    # Configuração do Firebase
```

## 🛠️ Instalação e Configuração

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Firebase

Edite o arquivo `src/firebase-config.js` com suas configurações do Firebase:

```javascript
export const firebaseConfig = {
  apiKey: "sua-api-key",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "seu-app-id",
};
```

### 3. Executar o Projeto

```bash
npm run dev
```

O projeto estará disponível em `http://localhost:5173`

## 🎯 Funcionalidades

### ✅ Implementadas

- **Visualização em Calendário**: Visualize registros em formato de calendário mensal
- **Visualização em Lista**: Visualize registros em formato de lista
- **Navegação entre Meses**: Navegue entre diferentes meses
- **Edição de Registros**: Adicione, edite e exclua registros de atividades
- **Gerenciamento de Projetos**: Selecione projetos para cada registro
- **Arquivos Editados**: Adicione arquivos editados em cada registro
- **Exportação XLSX**: Exporte relatórios em formato Excel
- **IA Integrada**: Melhore descrições usando IA (Gemini API)
- **Autenticação Firebase**: Sistema de autenticação anônima
- **Sincronização em Tempo Real**: Dados sincronizados com Firestore

### 🔄 Em Desenvolvimento

- **Duplicação de Tarefas**: Duplicar registros para outros dias
- **Importação de Dados**: Importar registros de arquivos Excel
- **Resumos com IA**: Gerar resumos automáticos com IA
- **Gerenciamento de Projetos**: Interface para gerenciar projetos

## 🎨 Interface

A interface é responsiva e segue o design system do Tailwind CSS, mas implementada com styled-components:

- **Design Limpo**: Interface moderna e intuitiva
- **Responsivo**: Funciona em desktop e mobile
- **Acessível**: Botões com títulos e navegação por teclado
- **Animações**: Transições suaves e feedback visual

## 🔧 Componentes Principais

### Calendar

Renderiza a visualização em calendário com:

- Dias do mês organizados em grade
- Fins de semana desabilitados
- Indicadores visuais de projetos e horas
- Botões de ação para cada dia

### ListView

Renderiza a visualização em lista com:

- Registros organizados por data
- Informações detalhadas de cada registro
- Botões de ação para editar e duplicar

### LogModal

Modal para edição de registros com:

- Seleção de projetos via checkboxes
- Campo de descrição com IA integrada
- Gerenciamento de arquivos editados
- Validação de dados

## 📊 Estrutura de Dados

### Registro de Log

```javascript
{
  date: "2024-01-15",
  projects: ["CMPC", "Tekno"],
  description: "Desenvolvimento de funcionalidades...",
  files: "arquivo1.js, arquivo2.css",
  userId: "user123"
}
```

### Projeto

```javascript
{
  id: "project123",
  name: "CMPC"
}
```

## 🚀 Deploy

Para fazer deploy do projeto:

```bash
npm run build
```

Os arquivos de produção estarão na pasta `dist/`.

## 🔧 Scripts Disponíveis

- `npm run dev` - Executa o servidor de desenvolvimento
- `npm run build` - Gera build de produção
- `npm run preview` - Visualiza o build de produção localmente
- `npm run lint` - Executa o linter

## 📝 Notas

- O projeto usa autenticação anônima do Firebase por padrão
- A API Gemini está configurada mas requer uma chave de API válida
- Os dados são sincronizados em tempo real com o Firestore
- O projeto é totalmente responsivo e funciona em dispositivos móveis

## 🤝 Contribuição

Para contribuir com o projeto:

1. Faça um fork do repositório
2. Crie uma branch para sua feature
3. Faça commit das suas mudanças
4. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.
