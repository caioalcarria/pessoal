import React, { useState, useEffect } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

import { db, auth, appId } from "./firebase-config";
import LoginScreen from "./components/LoginScreen";
import {
  CalendarSkeleton,
  ListSkeleton,
  LoadingSpinner,
  PageLoading,
} from "./components/LoadingSkeleton";

// Adicionar estilos CSS inline
const styles = `
  .modal-backdrop {
    background-color: rgba(0, 0, 0, 0.5);
  }
  .calendar-day:not(.disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .toast {
    animation: fade-in-out 5s forwards;
  }
  @keyframes fade-in-out {
    0% { opacity: 0; transform: translateY(20px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(20px); }
  }
  .view-btn.active {
    background-color: #2563eb;
    color: white;
  }
  .mini-calendar-day.selected {
    background-color: #2563eb;
    color: white;
    border-radius: 50%;
  }
  .mini-calendar-day:not(.disabled):not(.selected):hover {
    background-color: #eff6ff;
    border-radius: 50%;
  }
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .calendar-day {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
`;

function App() {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [currentLogs, setCurrentLogs] = useState({});
  const [currentProjects, setCurrentProjects] = useState([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState("calendar");
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // Modal states
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [description, setDescription] = useState("");
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [files, setFiles] = useState([]);
  const [newFile, setNewFile] = useState("");
  const [fileProjectMap, setFileProjectMap] = useState({});
  const [fileSuggestions, setFileSuggestions] = useState([]);
  const [showFileSuggestions, setShowFileSuggestions] = useState(false);
  const [editingFileProject, setEditingFileProject] = useState(null);
  const [defaultFileProject, setDefaultFileProject] = useState("");
  const [fileCategoryMap, setFileCategoryMap] = useState({});
  const [editingFileCategory, setEditingFileCategory] = useState(null);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSourceDate, setDuplicateSourceDate] = useState("");
  const [duplicateTargetDate, setDuplicateTargetDate] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [exportTitle, setExportTitle] = useState("");

  // Toast notification
  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  // Helper Functions
  const calculateHoursForLog = (log) => {
    const hoursMap = {};
    if (!log || !log.projects || log.projects.length === 0) return hoursMap;

    const numProjects = log.projects.length;
    const baseHours = Math.floor(6 / numProjects);
    let remainder = 6 % numProjects;

    log.projects.forEach((projectName) => {
      let hours = baseHours;
      if (remainder > 0) {
        hours++;
        remainder--;
      }
      hoursMap[projectName] = hours;
    });
    return hoursMap;
  };

  const parseAndRenderFiles = (filesString, isList = false) => {
    if (!filesString) return "";
    const files = filesString
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f);
    if (files.length === 0) return "";

    const listClass = isList
      ? "list-disc list-inside text-slate-600 text-sm pl-2"
      : "list-disc list-inside text-slate-500 text-xs pl-2";

    // Para visualização de calendário, limitar a 3 arquivos
    const displayFiles = isList ? files : files.slice(0, 3);
    const hasMoreFiles = !isList && files.length > 3;

    let html = `<h4 class="font-semibold mt-2 text-slate-600">Arquivos:</h4><ul class="${listClass}">`;
    html += displayFiles
      .map((file) => `<li class="truncate">${file}</li>`)
      .join("");
    if (hasMoreFiles) {
      html += `<li class="text-slate-400 italic">+${
        files.length - 3
      } mais...</li>`;
    }
    html += "</ul>";

    return html;
  };

  // Navigation
  const prevMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const nextMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const setView = (view) => {
    setCurrentView(view);
  };

  // Modal handlers
  const openLogModal = (dateStr) => {
    setSelectedDate(dateStr);
    const log = currentLogs[dateStr] || {};
    setSelectedLog(log);
    setDescription(log.description || "");
    setSelectedProjects(log.projects || []);
    setFiles(
      log.files
        ? log.files
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f)
        : []
    );
    setNewFile("");

    // Carregar mapeamento de arquivos existente ou criar novo
    const existingFileProjectMap = {};
    if (log.files && log.projects && log.projects.length > 0) {
      const files = log.files
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f);

      // Se há mapeamento salvo, usar ele
      if (log.fileProjectMap) {
        Object.assign(existingFileProjectMap, log.fileProjectMap);
      } else {
        // Criar mapeamento baseado nos projetos
        files.forEach((file, index) => {
          // Se há apenas um projeto, usar ele para todos os arquivos
          if (log.projects.length === 1) {
            existingFileProjectMap[file] = log.projects[0];
          } else {
            // Para múltiplos projetos, tentar distribuir ou usar o último
            existingFileProjectMap[file] =
              log.projects[index % log.projects.length] ||
              log.projects[log.projects.length - 1];
          }
        });
      }
    }
    setFileProjectMap(existingFileProjectMap);

    setFileSuggestions([]);
    setShowFileSuggestions(false);
    setEditingFileProject(null);
    setEditingFileCategory(null);
    setDefaultFileProject(
      log.projects && log.projects.length > 0
        ? log.projects[log.projects.length - 1]
        : ""
    );

    // Carregar mapeamento de categorias se existir
    if (log.fileCategoryMap) {
      setFileCategoryMap(log.fileCategoryMap);
    }

    setLogModalOpen(true);

    // Atualizar projeto padrão se necessário
    setTimeout(updateDefaultProject, 100);
  };

  const closeLogModal = () => {
    setLogModalOpen(false);
    setSelectedDate("");
    setSelectedLog(null);
    setDescription("");
    setSelectedProjects([]);
    setFiles([]);
    setNewFile("");
    setFileProjectMap({});
    setFileSuggestions([]);
    setShowFileSuggestions(false);
    setEditingFileProject(null);
    setEditingFileCategory(null);
    setDefaultFileProject("");
    setFileCategoryMap({});
  };

  const handleProjectToggle = (projectName) => {
    setSelectedProjects((prev) =>
      prev.includes(projectName)
        ? prev.filter((p) => p !== projectName)
        : [...prev, projectName]
    );
  };

  const handleAddFile = () => {
    if (newFile.trim()) {
      const fileName = newFile.trim();

      // Verificar se o arquivo já existe
      if (files.includes(fileName)) {
        showToastMessage("Este arquivo já foi adicionado.");
        return;
      }

      // Usar projeto padrão se disponível e válido
      const projectToUse =
        defaultFileProject && selectedProjects.includes(defaultFileProject)
          ? defaultFileProject
          : selectedProjects.length > 0
          ? selectedProjects[0]
          : "";

      if (projectToUse) {
        setFileProjectMap((prev) => ({
          ...prev,
          [fileName]: projectToUse,
        }));
      }

      setFiles((prev) => [...prev, fileName]);
      setNewFile("");
      setShowFileSuggestions(false);
      setFileSuggestions([]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopyFile = async (fileName) => {
    try {
      await navigator.clipboard.writeText(fileName);
      showToastMessage("Nome do arquivo copiado!");
    } catch (error) {
      // Fallback para navegadores mais antigos
      const textArea = document.createElement("textarea");
      textArea.value = fileName;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showToastMessage("Nome do arquivo copiado!");
    }
  };

  const handleFileProjectChange = (fileName, projectName) => {
    setFileProjectMap((prev) => ({
      ...prev,
      [fileName]: projectName,
    }));
  };

  const getFileSuggestions = async (input) => {
    if (!input.trim() || !defaultFileProject || !userId) {
      setFileSuggestions([]);
      return;
    }

    const suggestions = new Set();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;

    // Buscar arquivos dos logs do mês atual
    const q = query(
      collection(db, `artifacts/${appId}/users/${userId}/logs`),
      where("__name__", ">=", startDate),
      where("__name__", "<=", endDate)
    );

    try {
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((doc) => {
        const log = doc.data();
        if (log.files && log.projects) {
          const logFiles = log.files
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f);
          const hasSelectedProject = log.projects.includes(defaultFileProject);

          if (hasSelectedProject) {
            logFiles.forEach((file) => {
              if (
                file.toLowerCase().includes(input.toLowerCase()) &&
                !files.includes(file)
              ) {
                suggestions.add(file);
              }
            });
          }
        }
      });

      setFileSuggestions(Array.from(suggestions).slice(0, 5));
    } catch (error) {
      console.error("Erro ao buscar sugestões:", error);
      setFileSuggestions([]);
    }
  };

  const handleFileInputChange = (e) => {
    const value = e.target.value;
    setNewFile(value);

    if (value.trim() && defaultFileProject) {
      getFileSuggestions(value);
      setShowFileSuggestions(true);
    } else {
      setShowFileSuggestions(false);
      setFileSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setNewFile(suggestion);
    setShowFileSuggestions(false);
    setFileSuggestions([]);
  };

  const handleDefaultProjectChange = (projectName) => {
    if (projectName && selectedProjects.includes(projectName)) {
      setDefaultFileProject(projectName);
    }
  };

  const handleFileProjectClick = (fileName) => {
    setEditingFileProject(fileName);
  };

  const handleFileProjectBlur = () => {
    setEditingFileProject(null);
  };

  const handleFileCategoryChange = (fileName, category) => {
    setFileCategoryMap((prev) => ({
      ...prev,
      [fileName]: category,
    }));
  };

  const handleFileCategoryClick = (fileName) => {
    setEditingFileCategory(fileName);
  };

  const handleFileCategoryBlur = () => {
    setEditingFileCategory(null);
  };

  const updateDefaultProject = () => {
    if (selectedProjects.length > 0) {
      // Se não há projeto padrão ou se o projeto padrão não está mais na lista
      if (
        !defaultFileProject ||
        !selectedProjects.includes(defaultFileProject)
      ) {
        setDefaultFileProject(selectedProjects[selectedProjects.length - 1]);
      }
    }
  };

  const getFileCategory = (fileName) => {
    // Se há categoria personalizada, usar ela
    if (fileCategoryMap[fileName]) {
      return fileCategoryMap[fileName];
    }

    const extension = fileName.split(".").pop()?.toLowerCase();

    if (extension === "trx" || extension === "qry") {
      return "mii";
    } else if (
      ["js", "ts", "tsx", "css", "jsx", "html", "xml", "json", "irpt"].includes(
        extension
      )
    ) {
      return "web-application";
    } else if (extension === "sql") {
      return "procedures";
    } else {
      return "outros";
    }
  };

  const getCategoryName = (category) => {
    const names = {
      mii: "MII",
      "web-application": "Web Application",
      procedures: "Procedures",
      outros: "Outros",
    };
    return names[category] || category;
  };

  const organizeFilesByProject = () => {
    const organized = {};

    files.forEach((file) => {
      const project = fileProjectMap[file] || "Sem projeto";
      const category = getFileCategory(file);

      if (!organized[project]) {
        organized[project] = {};
      }

      if (!organized[project][category]) {
        organized[project][category] = [];
      }

      organized[project][category].push(file);
    });

    return organized;
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();

    // Preparar dados dos arquivos com seus projetos
    let filesData = files.join(",");
    if (Object.keys(fileProjectMap).length > 0) {
      // Adicionar informações de projeto aos arquivos se necessário
      // Por enquanto, mantemos apenas os nomes dos arquivos
      // O mapeamento é mantido no estado local
    }

    const data = {
      description: description.trim(),
      files: filesData,
      projects: selectedProjects,
      userId,
      fileProjectMap: fileProjectMap, // Salvar o mapeamento
      fileCategoryMap: fileCategoryMap, // Salvar o mapeamento de categorias
    };

    if (!data.description && !data.files && data.projects.length === 0) {
      await handleDeleteLog();
    } else {
      await setDoc(
        doc(db, `artifacts/${appId}/users/${userId}/logs`, selectedDate),
        data
      );
      showToastMessage("Registro salvo com sucesso!");
    }
    closeLogModal();
  };

  const handleDeleteLog = async () => {
    await deleteDoc(
      doc(db, `artifacts/${appId}/users/${userId}/logs`, selectedDate)
    );
    showToastMessage("Registro excluído.");
    closeLogModal();
  };

  const handleDuplicateClick = (dateStr) => {
    setSelectedLog(currentLogs[dateStr]);
    setDuplicateModalOpen(true);
    setDuplicateSourceDate(dateStr);
    setDuplicateTargetDate("");
  };

  const openProjectsModal = () => {
    setProjectsModalOpen(true);
  };

  const closeProjectsModal = () => {
    setProjectsModalOpen(false);
  };

  const openImportModal = () => {
    setImportModalOpen(true);
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setIsProcessingImport(false);
  };

  const handleFileChange = (e) => {
    setImportFile(e.target.files[0]);
  };

  const processImport = async () => {
    if (!importFile || !userId) {
      showToastMessage("Nenhum arquivo selecionado.");
      return;
    }

    setIsProcessingImport(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth(); // 0-indexed
        const batch = writeBatch(db);
        let importedCount = 0;

        json.forEach((row) => {
          const dateValue = row["Data (YYYY-MM-DD)"] || row["Data"];
          if (!dateValue) return;

          let parsedDate;
          if (dateValue instanceof Date) {
            parsedDate = dateValue;
          } else if (typeof dateValue === "string") {
            const parts = dateValue.split(/[-/]/);
            if (parts.length === 3) {
              parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }
          }

          if (
            !parsedDate ||
            isNaN(parsedDate) ||
            parsedDate.getFullYear() !== year ||
            parsedDate.getMonth() !== month
          ) {
            return;
          }

          const dateStr = `${parsedDate.getFullYear()}-${String(
            parsedDate.getMonth() + 1
          ).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;

          const logData = {
            projects: (row["Projetos"] || "")
              .toString()
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean),
            description: (row["Descrição"] || "").toString().trim(),
            files: (row["Arquivos"] || "").toString().trim(),
            userId: userId,
          };

          batch.set(
            doc(db, `artifacts/${appId}/users/${userId}/logs`, dateStr),
            logData
          );
          importedCount++;
        });

        if (importedCount > 0) {
          await batch.commit();
          showToastMessage(
            `${importedCount} registros importados com sucesso!`
          );
        } else {
          showToastMessage(
            "Nenhum registro válido para o mês atual encontrado no arquivo."
          );
        }
      } catch (error) {
        console.error("Import error:", error);
        showToastMessage("Erro ao processar o arquivo. Verifique o formato.");
      } finally {
        closeImportModal();
        setIsProcessingImport(false);
      }
    };

    reader.readAsArrayBuffer(importFile);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToastMessage("Logout realizado com sucesso!");
    } catch (error) {
      console.error("Erro no logout:", error);
      showToastMessage("Erro ao fazer logout.");
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      try {
        await addDoc(
          collection(db, `artifacts/${appId}/public/data/projects`),
          {
            name: newProjectName.trim(),
          }
        );
        setNewProjectName("");
        showToastMessage("Projeto adicionado!");
      } catch (error) {
        console.error("Erro ao adicionar projeto:", error);
        showToastMessage("Erro ao adicionar projeto.");
      }
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await deleteDoc(
        doc(db, `artifacts/${appId}/public/data/projects`, projectId)
      );
      showToastMessage("Projeto excluído!");
    } catch (error) {
      console.error("Erro ao excluir projeto:", error);
      showToastMessage("Erro ao excluir projeto.");
    }
  };

  // Export functions
  const getLogsForCurrentMonth = async () => {
    if (!userId) return [];
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;
    const q = query(
      collection(db, `artifacts/${appId}/users/${userId}/logs`),
      where("__name__", ">=", startDate),
      where("__name__", "<=", endDate)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => ({ date: doc.id, ...doc.data() }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const downloadXLSX = async () => {
    const logs = await getLogsForCurrentMonth();
    if (logs.length === 0) {
      showToastMessage("Nenhum registro para exportar.");
      return;
    }

    // Criar workbook com ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema de Registro";
    workbook.lastModifiedBy = "Usuário";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Página 1: Resumo Geral
    const summarySheet = workbook.addWorksheet("Resumo Geral");

    // Configurar cabeçalho
    summarySheet.columns = [
      { header: "Data", key: "date", width: 15 },
      { header: "Projetos", key: "projects", width: 25 },
      { header: "Descrição", key: "description", width: 50 },
      { header: "Total Arquivos", key: "totalFiles", width: 15 },
    ];

    // Estilo do cabeçalho
    const headerRow = summarySheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "4472C4" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // Adicionar dados
    logs.forEach((log, index) => {
      const row = summarySheet.addRow({
        date: new Date(log.date + "T00:00:00").toLocaleDateString("pt-BR"),
        projects: log.projects.join(", "),
        description: log.description || "Sem descrição",
        totalFiles: log.files ? log.files.split(",").length : 0,
      });

      // Alternar cores das linhas
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F8F9FA" },
        };
      }
    });

    // Página 2: Detalhes por Projeto
    const projectSheet = workbook.addWorksheet("Detalhes por Projeto");

    projectSheet.columns = [
      { header: "Data", key: "date", width: 15 },
      { header: "Projeto", key: "project", width: 20 },
      { header: "Categoria", key: "category", width: 20 },
      { header: "Arquivo", key: "file", width: 40 },
      { header: "Descrição", key: "description", width: 50 },
    ];

    // Estilo do cabeçalho da página 2
    const projectHeaderRow = projectSheet.getRow(1);
    projectHeaderRow.font = { bold: true, color: { argb: "FFFFFF" } };
    projectHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "70AD47" },
    };
    projectHeaderRow.alignment = { horizontal: "center", vertical: "middle" };

    // Adicionar dados detalhados
    logs.forEach((log, logIndex) => {
      if (log.files && log.fileProjectMap) {
        const files = log.files
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f);

        files.forEach((file, fileIndex) => {
          const project = log.fileProjectMap[file] || "Sem projeto";
          const category = getFileCategory(file);

          const row = projectSheet.addRow({
            date: new Date(log.date + "T00:00:00").toLocaleDateString("pt-BR"),
            project: project,
            category: getCategoryName(category),
            file: file,
            description: log.description || "Sem descrição",
          });

          // Colorir por categoria
          let categoryColor = "FFFFFF";
          switch (category) {
            case "mii":
              categoryColor = "FFE699";
              break;
            case "web-application":
              categoryColor = "C6EFCE";
              break;
            case "procedures":
              categoryColor = "FFC7CE";
              break;
            default:
              categoryColor = "F8F9FA";
          }

          row.getCell("category").fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: categoryColor },
          };
        });
      }
    });

    // Página 3: Estatísticas
    const statsSheet = workbook.addWorksheet("Estatísticas");

    // Calcular estatísticas
    const projectStats = {};
    const categoryStats = {};

    logs.forEach((log) => {
      if (log.files && log.fileProjectMap) {
        const files = log.files
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f);

        files.forEach((file) => {
          const project = log.fileProjectMap[file] || "Sem projeto";
          const category = getFileCategory(file);

          projectStats[project] = (projectStats[project] || 0) + 1;
          categoryStats[category] = (categoryStats[category] || 0) + 1;
        });
      }
    });

    // Estatísticas por projeto
    statsSheet.addRow(["Estatísticas por Projeto"]);
    statsSheet.addRow(["Projeto", "Total de Arquivos"]);

    Object.entries(projectStats).forEach(([project, count], index) => {
      const row = statsSheet.addRow([project, count]);
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E7E6E6" },
        };
      }
    });

    statsSheet.addRow([]);
    statsSheet.addRow(["Estatísticas por Categoria"]);
    statsSheet.addRow(["Categoria", "Total de Arquivos"]);

    Object.entries(categoryStats).forEach(([category, count], index) => {
      const row = statsSheet.addRow([getCategoryName(category), count]);
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E7E6E6" },
        };
      }
    });

    // Estilo dos títulos das estatísticas
    statsSheet.getRow(1).font = { bold: true, size: 14 };
    statsSheet.getRow(5).font = { bold: true, size: 14 };

    // Salvar arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_detalhado_${currentDate.getFullYear()}_${
      currentDate.getMonth() + 1
    }.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);

    setShowExportOptions(false);
    showToastMessage("Relatório detalhado exportado com sucesso!");
  };

  const exportForCopy = async (type) => {
    const logs = await getLogsForCurrentMonth();
    if (logs.length === 0) {
      showToastMessage("Nenhum registro para exportar.");
      return;
    }

    let content = "";
    const monthName = currentDate.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    if (type === "table") {
      content = `<table class="w-full text-left border-collapse"><thead><tr class="bg-slate-100"><th class="p-2 border">Data</th><th class="p-2 border">Projetos</th><th class="p-2 border">Descrição</th><th class="p-2 border">Arquivos</th></tr></thead><tbody>`;
      logs.forEach((log) => {
        content += `<tr><td class="p-2 border align-top">${new Date(
          log.date + "T00:00:00"
        ).toLocaleDateString(
          "pt-BR"
        )}</td><td class="p-2 border align-top">${log.projects.join(
          ", "
        )}</td><td class="p-2 border align-top whitespace-pre-wrap">${
          log.description
        }</td><td class="p-2 border align-top whitespace-pre-wrap">${
          log.files
        }</td></tr>`;
      });
      content += "</tbody></table>";
    } else {
      // Teams Formatted Text
      content = `**Relatório de Atividades - ${monthName}**\n\n---\n\n`;
      logs.forEach((log) => {
        const date = new Date(log.date + "T00:00:00").toLocaleDateString(
          "pt-BR",
          { weekday: "long", day: "2-digit", month: "long" }
        );
        content += `**${date}**\n`;
        if (log.projects.length > 0)
          content += `* **Projetos:** ${log.projects.join(", ")}\n`;
        if (log.description) content += `* **Descrição:** ${log.description}\n`;
        if (log.files)
          content += `* **Arquivos:** ${log.files.replace(/,/g, ", ")}\n`;
        content += `\n---\n\n`;
      });
      content = `<pre class="whitespace-pre-wrap text-sm">${content}</pre>`;
    }

    setExportContent(content);
    setExportTitle(monthName);
    setExportModalOpen(true);
    setShowExportOptions(false);
  };

  const exportSummaryTable = async () => {
    const logs = await getLogsForCurrentMonth();
    if (logs.length === 0) {
      showToastMessage("Nenhum registro para resumir.");
      return;
    }

    const monthName = currentDate.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    const projectData = {};
    logs.forEach((log) => {
      const hoursMap = calculateHoursForLog(log);
      log.projects.forEach((projectName) => {
        if (!projectData[projectName]) {
          projectData[projectName] = { hours: 0, descriptions: [] };
        }
        projectData[projectName].hours += hoursMap[projectName] || 0;
        if (log.description) {
          projectData[projectName].descriptions.push(log.description);
        }
      });
    });

    let tableHTML = `<table class="w-full text-left border-collapse"><thead><tr class="bg-slate-100"><th class="p-2 border">Projeto</th><th class="p-2 border">Total de Horas</th><th class="p-2 border">Resumo das Atividades</th></tr></thead><tbody>`;
    for (const projectName in projectData) {
      const data = projectData[projectName];
      const summary =
        data.descriptions.length > 0
          ? data.descriptions.slice(0, 3).join("; ") +
            (data.descriptions.length > 3 ? "..." : "")
          : "Nenhuma atividade descrita.";
      tableHTML += `<tr><td class="p-2 border align-top font-semibold">${projectName}</td><td class="p-2 border align-top text-center">${data.hours}</td><td class="p-2 border align-top">${summary}</td></tr>`;
    }
    tableHTML += "</tbody></table>";

    setExportContent(tableHTML);
    setExportTitle(`Tabela Resumida de ${monthName}`);
    setExportModalOpen(true);
    setShowExportOptions(false);
  };

  const copyToClipboard = () => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = exportContent;
    const table = tempDiv.querySelector("table");

    if (table) {
      const range = document.createRange();
      range.selectNode(table);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      try {
        document.execCommand("copy");
        showToastMessage("Tabela copiada!");
      } catch (err) {
        showToastMessage("Falha ao copiar tabela.");
      }
      window.getSelection().removeAllRanges();
    } else {
      const text = tempDiv.innerText;
      navigator.clipboard.writeText(text).then(
        () => {
          showToastMessage("Texto copiado!");
        },
        () => {
          showToastMessage("Falha ao copiar texto.");
        }
      );
    }
  };

  const handleDuplicateActivity = async () => {
    if (!duplicateTargetDate || !selectedLog) {
      showToastMessage("Selecione uma data de destino.");
      return;
    }

    const { projects, description, files } = selectedLog;
    await setDoc(
      doc(db, `artifacts/${appId}/users/${userId}/logs`, duplicateTargetDate),
      { projects, description, files, userId }
    );
    showToastMessage(`Tarefa duplicada para ${duplicateTargetDate}!`);
    setDuplicateModalOpen(false);
    setDuplicateSourceDate("");
    setDuplicateTargetDate("");
    setSelectedLog(null);
  };

  const closeDuplicateModal = () => {
    setDuplicateModalOpen(false);
    setDuplicateSourceDate("");
    setDuplicateTargetDate("");
    setSelectedLog(null);
  };

  const closeExportModal = () => {
    setExportModalOpen(false);
    setExportContent("");
    setExportTitle("");
  };

  const renderDuplicateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let calendarHTML = `<div class="text-center font-bold mb-2">${currentDate.toLocaleDateString(
      "pt-BR",
      { month: "long", year: "numeric" }
    )}</div>`;
    calendarHTML += `<div class="grid grid-cols-7 gap-1 text-center text-xs text-slate-500"><div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div></div>`;
    calendarHTML += `<div class="grid grid-cols-7 gap-1 mt-1">`;

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      calendarHTML += "<div></div>";
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const isWeekend = [0, 6].includes(date.getDay());
      const isSource = dateStr === duplicateSourceDate;
      const isSelected = dateStr === duplicateTargetDate;

      let classes =
        "mini-calendar-day w-8 h-8 flex items-center justify-center cursor-pointer transition-colors";

      if (isWeekend || isSource) {
        classes += " text-slate-400 cursor-not-allowed disabled";
        if (isSource) classes += " bg-slate-200 rounded-full";
      }

      if (isSelected) {
        classes += " selected";
      }

      calendarHTML += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
    }

    calendarHTML += "</div>";
    return calendarHTML;
  };

  const handleDuplicateDayClick = (dateStr) => {
    setDuplicateTargetDate(dateStr);
  };

  // Atualizar o mini-calendário quando o estado mudar
  useEffect(() => {
    if (duplicateModalOpen) {
      // Forçar re-render do mini-calendário
      const calendarContainer = document.querySelector(
        "[data-calendar-container]"
      );
      if (calendarContainer) {
        calendarContainer.innerHTML = renderDuplicateCalendar();
      }
    }
  }, [duplicateTargetDate, duplicateModalOpen]);

  // Limpar sugestões quando projeto padrão mudar
  useEffect(() => {
    setFileSuggestions([]);
    setShowFileSuggestions(false);
  }, [defaultFileProject]);

  // Atualizar projeto padrão apenas quando abrir o modal
  // (não quando selecionar projetos para atividade)

  // Firebase Logic - Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        setUserId(user.uid);
        setIsDataLoading(true);

        try {
          await setupInitialProjects();
          listenToProjects();
          listenToLogs(user.uid);
        } catch (error) {
          console.error("Error loading data:", error);
          showToastMessage("Erro ao carregar dados.");
        } finally {
          setIsDataLoading(false);
        }
      } else {
        setUser(null);
        setUserId(null);
        setCurrentLogs({});
        setCurrentProjects([]);
        setIsDataLoading(false);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setupInitialProjects = async () => {
    const projectsRef = collection(
      db,
      `artifacts/${appId}/public/data/projects`
    );
    const q = query(projectsRef);
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      const batch = writeBatch(db);
      const initialProjects = ["CMPC", "Tekno", "Melitta", "Essentia"];

      initialProjects.forEach((name) => {
        const docRef = doc(projectsRef);
        batch.set(docRef, { name });
      });

      await batch.commit();
      console.log("Projetos iniciais criados");
    }
  };

  const listenToProjects = () => {
    const projectsRef = collection(
      db,
      `artifacts/${appId}/public/data/projects`
    );
    onSnapshot(query(projectsRef), (snapshot) => {
      const projects = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setCurrentProjects(projects);
    });
  };

  const listenToLogs = (uid) => {
    if (!uid) return;
    const logsRef = collection(db, `artifacts/${appId}/users/${uid}/logs`);
    onSnapshot(query(logsRef), (snapshot) => {
      const logs = {};
      snapshot.docs.forEach((doc) => {
        logs[doc.id] = doc.data();
      });
      setCurrentLogs(logs);
    });
  };

  // Close export options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportOptions) {
        setShowExportOptions(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showExportOptions]);

  // Render calendar
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`}></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const fullDate = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const isWeekend = [0, 6].includes(fullDate.getDay());
      const log = currentLogs[dateStr];
      const hoursMap = calculateHoursForLog(log);

      const projectPills =
        log?.projects?.map((project) => (
          <span
            key={project}
            className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full"
          >
            <span className="font-bold">{hoursMap[project] || 0}h</span>{" "}
            {project}
          </span>
        )) || [];

      const descriptionPreview = log?.description ? (
        <p className="text-xs text-slate-600 mt-2 line-clamp-2 overflow-hidden">
          {log.description}
        </p>
      ) : null;

      const filesList = log?.files ? (
        <div
          className="mt-1 overflow-hidden"
          dangerouslySetInnerHTML={{
            __html: parseAndRenderFiles(log.files, false),
          }}
        />
      ) : null;

      const duplicateIcon = log ? (
        <button
          title="Duplicar tarefa"
          onClick={(e) => {
            e.stopPropagation();
            handleDuplicateClick(dateStr);
          }}
          className="absolute top-1 right-1 text-slate-400 hover:text-blue-600 p-1"
        >
          <i className="fas fa-copy fa-xs"></i>
        </button>
      ) : null;

      days.push(
        <div
          key={day}
          className={`calendar-day p-2 border rounded-lg h-48 flex flex-col transition-all duration-200 overflow-hidden ${
            isWeekend
              ? "bg-slate-100 text-slate-400 cursor-not-allowed disabled"
              : "bg-white hover:bg-blue-50 cursor-pointer"
          }`}
          onClick={() => !isWeekend && openLogModal(dateStr)}
        >
          <div className="relative">
            <span className="font-bold">{day}</span>
            {duplicateIcon}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            {projectPills}
          </div>
          <div className="mt-1 text-xs flex-grow overflow-hidden">
            {descriptionPreview}
            {filesList}
          </div>
        </div>
      );
    }

    return days;
  };

  // Render list view
  const renderListView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const items = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const fullDate = new Date(year, month, day);
      if ([0, 6].includes(fullDate.getDay())) continue; // Skip weekends

      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const log = currentLogs[dateStr];
      const formattedDate = fullDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });

      if (log) {
        const hoursMap = calculateHoursForLog(log);
        const projectPills =
          log.projects?.map((project) => (
            <span
              key={project}
              className="text-sm font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
            >
              <span className="font-bold">{hoursMap[project] || 0}h</span>{" "}
              {project}
            </span>
          )) || [];

        const filesList = parseAndRenderFiles(log.files, true);

        items.push(
          <div key={day} className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  {formattedDate}
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">{projectPills}</div>
              </div>
              <div className="flex gap-2">
                <button
                  data-date={dateStr}
                  className="duplicate-log-btn px-3 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                  title="Duplicar"
                  onClick={() => handleDuplicateClick(dateStr)}
                >
                  <i className="fas fa-copy"></i>
                </button>
                <button
                  data-date={dateStr}
                  className="edit-log-btn px-3 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                  onClick={() => openLogModal(dateStr)}
                >
                  Editar
                </button>
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-700 space-y-2">
              <p className="whitespace-pre-wrap">
                {log.description || "Nenhuma descrição."}
              </p>
              <div dangerouslySetInnerHTML={{ __html: filesList }} />
            </div>
          </div>
        );
      } else {
        items.push(
          <div
            key={day}
            className="bg-white/60 p-4 rounded-lg border border-dashed"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-500">{formattedDate}</h3>
              <button
                data-date={dateStr}
                className="add-log-btn px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                onClick={() => openLogModal(dateStr)}
              >
                Adicionar
              </button>
            </div>
          </div>
        );
      }
    }

    return items.length > 0 ? (
      items
    ) : (
      <p className="text-center text-slate-500 py-8">
        Nenhum dia útil neste mês.
      </p>
    );
  };

  // Estados de loading e autenticação
  if (isAuthLoading) {
    return <PageLoading />;
  }

  if (!user) {
    return (
      <LoginScreen isLoading={isAuthLoading} setIsLoading={setIsAuthLoading} />
    );
  }

  return (
    <div className="text-slate-800">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div id="app" className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center space-x-2">
            <button
              id="prev-month"
              className="p-2 rounded-full hover:bg-slate-200 transition-colors"
              onClick={prevMonth}
              title="Mês anterior"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <h1
              id="current-month-year"
              className="text-2xl font-bold text-slate-700 w-48 text-center"
            >
              {currentDate.toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </h1>
            <button
              id="next-month"
              className="p-2 rounded-full hover:bg-slate-200 transition-colors"
              onClick={nextMonth}
              title="Próximo mês"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
            <div className="ml-4 bg-slate-200 p-1 rounded-lg flex items-center">
              <button
                id="calendar-view-btn"
                className={`view-btn px-3 py-1 rounded-md text-sm ${
                  currentView === "calendar"
                    ? "active bg-blue-600 text-white"
                    : ""
                }`}
                onClick={() => setView("calendar")}
                title="Visualização em Calendário"
              >
                <i className="fas fa-calendar-days"></i>
              </button>
              <button
                id="list-view-btn"
                className={`view-btn px-3 py-1 rounded-md text-sm ${
                  currentView === "list" ? "active bg-blue-600 text-white" : ""
                }`}
                onClick={() => setView("list")}
                title="Visualização em Lista"
              >
                <i className="fas fa-list"></i>
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="import-btn"
              className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg shadow-sm hover:bg-slate-100 transition-colors"
              onClick={openImportModal}
            >
              <i className="fas fa-upload mr-2"></i>Importar
            </button>
            <button
              id="manage-projects-btn"
              className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg shadow-sm hover:bg-slate-100 transition-colors"
              onClick={openProjectsModal}
            >
              <i className="fas fa-tags mr-2"></i>Projetos
            </button>
            <div className="relative">
              <button
                id="export-btn"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportOptions(!showExportOptions);
                }}
              >
                <i className="fas fa-download mr-2"></i>Exportar
              </button>
              <div
                id="export-options"
                className={`${
                  showExportOptions ? "" : "hidden"
                } absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-20`}
              >
                <a
                  href="#"
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault();
                    downloadXLSX();
                  }}
                >
                  <i className="fas fa-file-excel fa-fw mr-2"></i>Baixar
                  Relatório (XLSX)
                </a>
                <a
                  href="#"
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault();
                    exportForCopy("table");
                  }}
                >
                  <i className="fas fa-table fa-fw mr-2"></i>Copiar Tabela
                </a>
                <a
                  href="#"
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault();
                    exportSummaryTable();
                  }}
                >
                  <i className="fas fa-chart-pie fa-fw mr-2"></i>Tabela Resumida
                </a>
                <a
                  href="#"
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault();
                    exportForCopy("teams-text");
                  }}
                >
                  <i className="fab fa-teams fa-fw mr-2"></i>Copiar Texto
                  (Teams)
                </a>
              </div>
            </div>

            {/* User Info and Logout */}
            <div className="flex items-center space-x-3 ml-4">
              <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-lg">
                <img
                  src={user.photoURL || "https://via.placeholder.com/32"}
                  alt="Avatar"
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-sm text-slate-700 font-medium">
                  {user.displayName || user.email}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Logout"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div id="main-content">
          {isDataLoading ? (
            <div className="py-8">
              {currentView === "calendar" ? (
                <CalendarSkeleton />
              ) : (
                <ListSkeleton />
              )}
            </div>
          ) : (
            <>
              <div
                id="calendar-view"
                className={currentView !== "calendar" ? "hidden" : ""}
              >
                <div className="grid grid-cols-7 gap-2 mb-2">
                  <div className="text-center font-semibold text-slate-500 text-sm">
                    Dom
                  </div>
                  <div className="text-center font-semibold text-slate-500 text-sm">
                    Seg
                  </div>
                  <div className="text-center font-semibold text-slate-500 text-sm">
                    Ter
                  </div>
                  <div className="text-center font-semibold text-slate-500 text-sm">
                    Qua
                  </div>
                  <div className="text-center font-semibold text-slate-500 text-sm">
                    Qui
                  </div>
                  <div className="text-center font-semibold text-slate-500 text-sm">
                    Sex
                  </div>
                  <div className="text-center font-semibold text-slate-500 text-sm">
                    Sáb
                  </div>
                </div>
                <div id="calendar-grid" className="grid grid-cols-7 gap-2">
                  {renderCalendar()}
                </div>
              </div>
              <div
                id="list-view"
                className={`${
                  currentView !== "list" ? "hidden" : ""
                } space-y-3`}
              >
                {renderListView()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Log Entry Modal */}
      {logModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={closeLogModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-11/12 max-w-2xl transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-slate-800">
                  Registrar Atividade -{" "}
                  {selectedDate &&
                    new Date(selectedDate + "T00:00:00").toLocaleDateString(
                      "pt-BR",
                      { day: "2-digit", month: "long" }
                    )}
                </h2>
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={closeLogModal}
                >
                  &times;
                </button>
              </div>
              <form className="mt-4 space-y-4" onSubmit={handleSaveLog}>
                <input type="hidden" value={selectedDate} />
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Projetos
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {currentProjects.map((project) => (
                      <label
                        key={project.id}
                        className="flex items-center space-x-2 p-2 rounded-md hover:bg-slate-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          name="project"
                          value={project.name}
                          checked={selectedProjects.includes(project.name)}
                          onChange={() => handleProjectToggle(project.name)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{project.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-slate-600 mb-1"
                  >
                    Descrição
                  </label>
                  <textarea
                    id="description"
                    rows="4"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Escreva uma breve descrição..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Arquivos editados
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Nome do arquivo"
                      className="flex-grow p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      value={newFile}
                      onChange={handleFileInputChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddFile();
                        }
                      }}
                    />
                    {selectedProjects.length > 0 && (
                      <select
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm"
                        value={defaultFileProject}
                        onChange={(e) =>
                          handleDefaultProjectChange(e.target.value)
                        }
                      >
                        {selectedProjects.map((project) => (
                          <option key={project} value={project}>
                            {project}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                      onClick={handleAddFile}
                    >
                      Adicionar
                    </button>
                  </div>

                  {/* Sugestões de arquivos */}
                  {showFileSuggestions && fileSuggestions.length > 0 && (
                    <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-32 overflow-y-auto">
                      {fileSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 max-h-70 overflow-y-auto space-y-3">
                    {Object.entries(organizeFilesByProject()).map(
                      ([project, categories]) => (
                        <div key={project} className="space-y-3">
                          <h4 className="font-semibold text-sm text-slate-700 border-b border-slate-200 pb-2">
                            {project}
                          </h4>
                          {Object.entries(categories).map(
                            ([category, projectFiles]) => (
                              <div key={category} className="ml-2 space-y-2">
                                <h5 className="text-xs font-medium text-slate-600">
                                  {getCategoryName(category)}
                                </h5>
                                {projectFiles.map((file, index) => (
                                  <div
                                    key={`${file}-${index}`}
                                    className="flex justify-between items-center p-2 bg-slate-100 rounded-md text-sm"
                                  >
                                    <span className="flex-grow truncate">
                                      {file}
                                    </span>
                                    <div className="flex items-center space-x-2">
                                      {selectedProjects.length > 1 ? (
                                        editingFileProject === file ? (
                                          <select
                                            className="text-xs border border-slate-300 rounded px-1 py-0.5"
                                            value={fileProjectMap[file] || ""}
                                            onChange={(e) =>
                                              handleFileProjectChange(
                                                file,
                                                e.target.value
                                              )
                                            }
                                            onBlur={handleFileProjectBlur}
                                            autoFocus
                                          >
                                            <option value="">
                                              Selecione projeto
                                            </option>
                                            {selectedProjects.map((project) => (
                                              <option
                                                key={project}
                                                value={project}
                                              >
                                                {project}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <span
                                            className="text-xs text-slate-500 hover:text-slate-700 hover:font-medium cursor-pointer transition-all"
                                            onClick={() =>
                                              handleFileProjectClick(file)
                                            }
                                            title="Clique para editar projeto"
                                          >
                                            {fileProjectMap[file] ||
                                              "Selecione projeto"}
                                          </span>
                                        )
                                      ) : selectedProjects.length === 1 ? (
                                        <span className="text-xs text-slate-500">
                                          {fileProjectMap[file] ||
                                            selectedProjects[0]}
                                        </span>
                                      ) : null}

                                      {/* Seletor de categoria para arquivos em "outros" */}
                                      {getFileCategory(file) === "outros" &&
                                        (editingFileCategory === file ? (
                                          <select
                                            className="text-xs border border-slate-300 rounded px-1 py-0.5"
                                            value={fileCategoryMap[file] || ""}
                                            onChange={(e) =>
                                              handleFileCategoryChange(
                                                file,
                                                e.target.value
                                              )
                                            }
                                            onBlur={handleFileCategoryBlur}
                                            autoFocus
                                          >
                                            <option value="">Categoria</option>
                                            <option value="mii">MII</option>
                                            <option value="web-application">
                                              Web Application
                                            </option>
                                            <option value="procedures">
                                              Procedures
                                            </option>
                                            <option value="outros">
                                              Outros
                                            </option>
                                          </select>
                                        ) : (
                                          <span
                                            className="text-xs text-slate-400 hover:text-slate-600 hover:font-medium cursor-pointer transition-all"
                                            onClick={() =>
                                              handleFileCategoryClick(file)
                                            }
                                            title="Clique para editar categoria"
                                          >
                                            {fileCategoryMap[file]
                                              ? getCategoryName(
                                                  fileCategoryMap[file]
                                                )
                                              : "Categoria"}
                                          </span>
                                        ))}

                                      <div className="flex items-center space-x-1">
                                        <button
                                          type="button"
                                          className="text-blue-500 hover:text-blue-700 p-1"
                                          onClick={() => handleCopyFile(file)}
                                          title="Copiar nome do arquivo"
                                        >
                                          <i className="fas fa-copy text-xs"></i>
                                        </button>
                                        <button
                                          type="button"
                                          className="text-red-500 hover:text-red-700 p-1"
                                          onClick={() =>
                                            handleRemoveFile(
                                              files.indexOf(file)
                                            )
                                          }
                                          title="Remover arquivo"
                                        >
                                          &times;
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  {(description ||
                    files.length > 0 ||
                    selectedProjects.length > 0) && (
                    <button
                      type="button"
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      onClick={handleDeleteLog}
                    >
                      Excluir
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manage Projects Modal */}
      {projectsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={closeProjectsModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-11/12 max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-slate-800">
                  Gerenciar Projetos
                </h2>
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={closeProjectsModal}
                >
                  &times;
                </button>
              </div>
              <div className="mt-4">
                <form className="flex space-x-2" onSubmit={handleAddProject}>
                  <input
                    type="text"
                    placeholder="Nome do novo projeto"
                    className="flex-grow p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    disabled={isPageLoading}
                  >
                    {isPageLoading && <LoadingSpinner size="sm" />}
                    Add
                  </button>
                </form>
              </div>
              <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
                {currentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex justify-between items-center p-2 bg-slate-50 rounded-lg"
                  >
                    <span>{project.name}</span>
                    <button
                      className="text-red-500 hover:text-red-700 text-sm"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={closeImportModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-11/12 max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-slate-800">
                  Importar Registros
                </h2>
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={closeImportModal}
                >
                  &times;
                </button>
              </div>
              <div className="mt-4 text-sm text-slate-600 space-y-2">
                <p>
                  Importe os registros para o mês de{" "}
                  <strong>
                    {currentDate.toLocaleDateString("pt-BR", { month: "long" })}
                  </strong>
                  .
                </p>
                <p>
                  O arquivo deve ter as colunas no formato correto. Você pode
                  baixar o relatório e usá-lo como modelo.
                </p>
              </div>
              <div className="mt-4">
                <label
                  htmlFor="import-file-input"
                  className="block text-sm font-medium text-slate-700"
                >
                  Selecione o arquivo .xlsx
                </label>
                <input
                  type="file"
                  id="import-file-input"
                  accept=".xlsx, .xls"
                  className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={handleFileChange}
                />
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 flex items-center gap-2"
                  disabled={!importFile || isProcessingImport}
                  onClick={processImport}
                >
                  {isProcessingImport && <LoadingSpinner size="sm" />}
                  {isProcessingImport ? "Processando..." : "Processar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={closeExportModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-11/12 max-w-4xl h-5/6 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">
                  Exportar Dados - {exportTitle}
                </h2>
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={closeExportModal}
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 overflow-auto flex-grow prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: exportContent }} />
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end">
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                onClick={copyToClipboard}
              >
                <i className="fas fa-copy mr-2"></i>Copiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {duplicateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={closeDuplicateModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-11/12 max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-slate-800">
                  Duplicar Tarefa
                </h2>
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={closeDuplicateModal}
                >
                  &times;
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                Selecione o dia de destino para duplicar a tarefa de{" "}
                <strong>
                  {duplicateSourceDate &&
                    new Date(
                      duplicateSourceDate + "T00:00:00"
                    ).toLocaleDateString("pt-BR")}
                </strong>
                .
              </p>
              <div
                className="mt-4"
                data-calendar-container
                dangerouslySetInnerHTML={{ __html: renderDuplicateCalendar() }}
                onClick={(e) => {
                  const dayElement = e.target.closest(".mini-calendar-day");
                  if (
                    dayElement &&
                    !dayElement.classList.contains("disabled")
                  ) {
                    const dateStr = dayElement.dataset.date;
                    handleDuplicateDayClick(dateStr);
                  }
                }}
              />
              <div className="mt-6 flex justify-end">
                <button
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
                  disabled={!duplicateTargetDate}
                  onClick={handleDuplicateActivity}
                >
                  Duplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div
        id="toast-notification"
        className={`${
          showToast ? "" : "hidden"
        } fixed bottom-5 right-5 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-lg toast z-[100]`}
      >
        <p>{toastMessage}</p>
      </div>
    </div>
  );
}

export default App;
