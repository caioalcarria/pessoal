import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, appId } from "../firebase-config";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

const SharedView = () => {
  const { shareId } = useParams();
  const [shareData, setShareData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState("calendar");
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [exportTitle, setExportTitle] = useState("");

  // Estados para modal de visão geral do dia
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [selectedDayDate, setSelectedDayDate] = useState("");

  useEffect(() => {
    loadShareData();
  }, [shareId]);

  const loadShareData = async () => {
    try {
      setIsLoading(true);
      const shareDoc = await getDoc(
        doc(db, `artifacts/${appId}/shares`, shareId)
      );

      if (!shareDoc.exists()) {
        setError("Link de compartilhamento não encontrado ou expirado.");
        return;
      }

      const data = shareDoc.data();

      // Verificar se o link expirou
      if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        setError("Este link de compartilhamento expirou.");
        return;
      }

      if (!data.isActive) {
        setError("Este link de compartilhamento foi desativado.");
        return;
      }

      // Os dados já estão atualizados no documento de compartilhamento
      // pois o generateShareLink sempre atualiza os logs quando gerado
      setShareData(data);
    } catch (error) {
      console.error("Erro ao carregar dados compartilhados:", error);
      setError("Erro ao carregar dados compartilhados.");
    } finally {
      setIsLoading(false);
    }
  };

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

  const getFileCategory = (fileName) => {
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

  // Função para calcular horas totais e por projeto
  const calculateTotalHours = () => {
    const projectHours = {};
    let totalHours = 0;

    if (shareData && shareData.logs) {
      shareData.logs.forEach((log) => {
        if (log && log.projects && log.projects.length > 0) {
          const hoursMap = calculateHoursForLog(log);

          log.projects.forEach((project) => {
            const hours = hoursMap[project] || 0;
            projectHours[project] = (projectHours[project] || 0) + hours;
            totalHours += hours;
          });
        }
      });
    }

    return { totalHours, projectHours };
  };

  const downloadXLSX = async () => {
    if (!shareData || !shareData.logs || shareData.logs.length === 0) {
      return;
    }

    const logs = shareData.logs;

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
    link.download = `relatorio_compartilhado_${shareData.monthName.replace(
      /\s+/g,
      "_"
    )}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportForCopy = async (type) => {
    if (!shareData || !shareData.logs || shareData.logs.length === 0) {
      return;
    }

    const logs = shareData.logs;
    let content = "";
    const monthName = shareData.monthName;

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
        alert("Tabela copiada!");
      } catch (err) {
        alert("Falha ao copiar tabela.");
      }
      window.getSelection().removeAllRanges();
    } else {
      const text = tempDiv.innerText;
      navigator.clipboard.writeText(text).then(
        () => {
          alert("Texto copiado!");
        },
        () => {
          alert("Falha ao copiar texto.");
        }
      );
    }
  };

  const closeExportModal = () => {
    setExportModalOpen(false);
    setExportContent("");
    setExportTitle("");
  };

  // Funções para modal de visão geral do dia
  const openDayModal = (dateStr, dayData) => {
    setSelectedDayDate(dateStr);
    setSelectedDayData(dayData);
    setDayModalOpen(true);
  };

  const closeDayModal = () => {
    setDayModalOpen(false);
    setSelectedDayData(null);
    setSelectedDayDate("");
  };

  // Render calendar
  const renderCalendar = () => {
    if (!shareData || !shareData.logs) return [];

    const logs = shareData.logs;
    const year = shareData.year;
    const month = shareData.month;
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`}></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const fullDate = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const isWeekend = [0, 6].includes(fullDate.getDay());
      const log = logs.find((l) => l.date === dateStr);
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

      days.push(
        <div
          key={day}
          className={`calendar-day p-2 border rounded-lg h-48 flex flex-col transition-all duration-200 overflow-hidden ${
            isWeekend
              ? "bg-slate-100 text-slate-400 cursor-not-allowed disabled"
              : log
              ? "bg-white hover:bg-blue-50 cursor-pointer"
              : "bg-white"
          }`}
          onClick={() => !isWeekend && log && openDayModal(dateStr, log)}
        >
          <div className="relative">
            <span className="font-bold">{day}</span>
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
    if (!shareData || !shareData.logs) return [];

    const logs = shareData.logs;
    const items = [];

    logs.forEach((log) => {
      const fullDate = new Date(log.date + "T00:00:00");
      const formattedDate = fullDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });

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
        <div
          key={log.date}
          className="bg-white p-4 rounded-lg border shadow-sm"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg text-slate-800">
                {formattedDate}
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">{projectPills}</div>
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
    });

    return items.length > 0 ? (
      items
    ) : (
      <p className="text-center text-slate-500 py-8">
        Nenhum registro encontrado.
      </p>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">
            Carregando dados compartilhados...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Erro</h1>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!shareData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Dados não encontrados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-slate-800">
      <div id="app" className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-700">
              {shareData.monthName}
            </h1>
            <div className="ml-4 bg-slate-200 p-1 rounded-lg flex items-center">
              <button
                className={`view-btn px-3 py-1 rounded-md text-sm ${
                  currentView === "calendar"
                    ? "active bg-blue-600 text-white"
                    : ""
                }`}
                onClick={() => setCurrentView("calendar")}
                title="Visualização em Calendário"
              >
                <i className="fas fa-calendar-days"></i>
              </button>
              <button
                className={`view-btn px-3 py-1 rounded-md text-sm ${
                  currentView === "list" ? "active bg-blue-600 text-white" : ""
                }`}
                onClick={() => setCurrentView("list")}
                title="Visualização em Lista"
              >
                <i className="fas fa-list"></i>
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportOptions(!showExportOptions);
                }}
              >
                <i className="fas fa-download mr-2"></i>Exportar
              </button>
              <div
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
                    exportForCopy("teams-text");
                  }}
                >
                  <i className="fab fa-teams fa-fw mr-2"></i>Copiar Texto
                  (Teams)
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-lg">
              <i className="fas fa-user text-slate-600"></i>
              <span className="text-sm text-slate-700 font-medium">
                {shareData.userName}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div id="main-content">
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

            {/* Painel de Horas */}
            {(() => {
              const { totalHours, projectHours } = calculateTotalHours();
              return (
                <div className="mt-6 bg-slate-50 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">
                        Resumo de Horas - {shareData.monthName}
                      </h3>
                      <div className="text-2xl font-bold text-blue-600">
                        Total: {totalHours}h
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(projectHours)
                        .sort(([, a], [, b]) => b - a)
                        .map(([project, hours]) => (
                          <div
                            key={project}
                            className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg font-semibold"
                          >
                            {project}: {hours}h
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div
            id="list-view"
            className={`${currentView !== "list" ? "hidden" : ""} space-y-3`}
          >
            {renderListView()}
          </div>
        </div>
      </div>

      {/* Day Overview Modal */}
      {dayModalOpen && selectedDayData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={closeDayModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-11/12 max-w-2xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Visão Geral do Dia
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {selectedDayDate &&
                      new Date(
                        selectedDayDate + "T00:00:00"
                      ).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                  </p>
                </div>
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={closeDayModal}
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Projetos e Horas */}
              {selectedDayData.projects &&
                selectedDayData.projects.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">
                      Projetos e Horas
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedDayData.projects.map((project) => {
                        const hoursMap = calculateHoursForLog(selectedDayData);
                        return (
                          <span
                            key={project}
                            className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg font-semibold"
                          >
                            <span className="font-bold">
                              {hoursMap[project] || 0}h
                            </span>{" "}
                            {project}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Descrição */}
              {selectedDayData.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">
                    Descrição das Atividades
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-slate-700 whitespace-pre-wrap">
                      {selectedDayData.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Arquivos por Projeto */}
              {selectedDayData.files && selectedDayData.fileProjectMap && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">
                    Arquivos Editados por Projeto
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(
                      selectedDayData.files
                        .split(",")
                        .map((f) => f.trim())
                        .filter((f) => f)
                        .reduce((acc, file) => {
                          const project =
                            selectedDayData.fileProjectMap[file] ||
                            "Sem projeto";
                          if (!acc[project]) acc[project] = [];
                          acc[project].push(file);
                          return acc;
                        }, {})
                    ).map(([project, files]) => (
                      <div
                        key={project}
                        className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                      >
                        <h4 className="font-semibold text-slate-700 mb-3 flex items-center">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold mr-2">
                            {files.length} arquivo
                            {files.length !== 1 ? "s" : ""}
                          </span>
                          {project}
                        </h4>
                        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                          {files.map((file, index) => (
                            <li key={index} className="truncate">
                              {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Arquivos sem projeto (fallback) */}
              {selectedDayData.files && !selectedDayData.fileProjectMap && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">
                    Arquivos Editados
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: parseAndRenderFiles(
                          selectedDayData.files,
                          true
                        ),
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Estatísticas */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">
                  Resumo do Dia
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-slate-600">
                      Total de Projetos:
                    </span>
                    <span className="ml-2 text-slate-800">
                      {selectedDayData.projects?.length || 0}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">
                      Total de Arquivos:
                    </span>
                    <span className="ml-2 text-slate-800">
                      {selectedDayData.files
                        ? selectedDayData.files
                            .split(",")
                            .filter((f) => f.trim()).length
                        : 0}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">
                      Total de Horas:
                    </span>
                    <span className="ml-2 text-slate-800">
                      {selectedDayData.projects
                        ? Object.values(
                            calculateHoursForLog(selectedDayData)
                          ).reduce((sum, hours) => sum + hours, 0)
                        : 0}
                      h
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">
                      Tem Descrição:
                    </span>
                    <span className="ml-2 text-slate-800">
                      {selectedDayData.description ? "Sim" : "Não"}
                    </span>
                  </div>
                </div>
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
    </div>
  );
};

export default SharedView;
