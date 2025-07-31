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

import { db, auth, appId } from "./firebase-config";
import LoginScreen from "./components/LoginScreen";
import {
  CalendarSkeleton,
  ListSkeleton,
  LoadingSpinner,
  PageLoading,
} from "./components/LoadingSkeleton";

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
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);

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
    return `<h4 class="font-semibold mt-2 text-slate-600">Arquivos:</h4><ul class="${listClass}">${files
      .map((file) => `<li>${file}</li>`)
      .join("")}</ul>`;
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
    setLogModalOpen(true);
  };

  const closeLogModal = () => {
    setLogModalOpen(false);
    setSelectedDate("");
    setSelectedLog(null);
    setDescription("");
    setSelectedProjects([]);
    setFiles([]);
    setNewFile("");
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
      setFiles((prev) => [...prev, newFile.trim()]);
      setNewFile("");
    }
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();
    const data = {
      description: description.trim(),
      files: files.join(","),
      projects: selectedProjects,
      userId,
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
    showToastMessage(
      "Funcionalidade de duplicação será implementada em breve."
    );
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

    const dataToExport = logs.map((log) => ({
      "Data (YYYY-MM-DD)": log.date,
      Projetos: log.projects.join(", "),
      Descrição: log.description,
      Arquivos: log.files,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Style header
    const headerStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: "DDEEFF" } },
    };
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!worksheet[address]) continue;
      worksheet[address].s = headerStyle;
    }

    // Set column widths
    const colWidths = Object.keys(dataToExport[0]).map((key) => ({
      wch: dataToExport.reduce(
        (w, r) => Math.max(w, r[key] ? r[key].length : 10),
        key.length
      ),
    }));
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registros");
    XLSX.writeFile(
      workbook,
      `relatorio_${currentDate.getFullYear()}_${
        currentDate.getMonth() + 1
      }.xlsx`
    );
    setShowExportOptions(false);
  };

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
        <p className="text-xs text-slate-600 mt-2 truncate">
          {log.description}
        </p>
      ) : null;

      const filesList = log?.files ? (
        <div
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
          <div className="mt-1 overflow-y-auto text-xs flex-grow">
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
                    e.preventDefault(); /* exportForCopy('table') */
                  }}
                >
                  <i className="fas fa-table fa-fw mr-2"></i>Copiar Tabela
                </a>
                <a
                  href="#"
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault(); /* exportSummaryTable */
                  }}
                >
                  <i className="fas fa-chart-pie fa-fw mr-2"></i>Tabela Resumida
                </a>
                <a
                  href="#"
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault(); /* exportForCopy('teams-text') */
                  }}
                >
                  <i className="fab fa-teams fa-fw mr-2"></i>Copiar Texto
                  (Teams)
                </a>
                <div className="border-t my-1"></div>
                <a
                  href="#"
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault(); /* generateAiSummary */
                  }}
                >
                  <i className="fas fa-wand-magic-sparkles fa-fw mr-2"></i>Gerar
                  Resumo com IA
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
                  <div className="flex justify-between items-center mb-1">
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-slate-600"
                    >
                      Descrição
                    </label>
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      ✨ Melhorar com IA
                    </button>
                  </div>
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
                      onChange={(e) => setNewFile(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddFile();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                      onClick={handleAddFile}
                    >
                      Adicionar
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {files.map((file, index) => (
                      <li
                        key={index}
                        className="flex justify-between items-center p-1.5 bg-slate-100 rounded-md text-sm"
                      >
                        <span>{file}</span>
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleRemoveFile(index)}
                        >
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
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
