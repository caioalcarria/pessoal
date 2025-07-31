import React from "react";

export const CalendarSkeleton = () => {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-7 gap-2 mb-2">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div
            key={day}
            className="text-center font-semibold text-slate-500 text-sm"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }, (_, i) => (
          <div
            key={i}
            className="bg-slate-200 rounded-lg h-48 flex flex-col p-2"
          >
            <div className="h-4 bg-slate-300 rounded mb-2 w-6"></div>
            <div className="space-y-1">
              <div className="h-3 bg-slate-300 rounded w-16"></div>
              <div className="h-3 bg-slate-300 rounded w-12"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ListSkeleton = () => {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="bg-slate-200 p-4 rounded-lg">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="h-5 bg-slate-300 rounded w-32 mb-2"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-slate-300 rounded-full w-16"></div>
                <div className="h-6 bg-slate-300 rounded-full w-20"></div>
              </div>
            </div>
            <div className="h-8 bg-slate-300 rounded w-16"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-300 rounded w-full"></div>
            <div className="h-4 bg-slate-300 rounded w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const LoadingSpinner = ({ size = "md", className = "" }) => {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-3",
    xl: "w-12 h-12 border-4",
  };

  return (
    <div
      className={`${sizeClasses[size]} border-slate-300 border-t-blue-600 rounded-full animate-spin ${className}`}
    ></div>
  );
};

export const PageLoading = () => {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <LoadingSpinner size="xl" className="mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Carregando dados...</p>
      </div>
    </div>
  );
};
