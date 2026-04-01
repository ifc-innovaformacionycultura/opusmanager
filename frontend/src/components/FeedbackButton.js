import React, { useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FeedbackButton = ({ currentPage, currentSection }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "error",
    description: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await axios.post(`${API}/feedback`, {
        page: currentPage,
        section: currentSection || null,
        type: formData.type,
        description: formData.description,
        user_agent: navigator.userAgent
      });

      setSubmitSuccess(true);
      setFormData({ type: "error", description: "" });
      
      setTimeout(() => {
        setIsOpen(false);
        setSubmitSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error al enviar reporte:", error);
      alert("Error al enviar el reporte. Por favor, inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
        style={{ zIndex: 9999 }}
        title="Reportar error o mejora"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-medium">Reportar</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl border border-slate-200 p-6 w-96" style={{ zIndex: 9999 }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-slate-900">Reportar Problema</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {submitSuccess ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-green-600 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-green-900">¡Reporte enviado con éxito!</p>
          <p className="text-xs text-green-700 mt-1">Gracias por tu colaboración</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 rounded p-3 text-sm">
            <div className="font-medium text-slate-700">Ubicación:</div>
            <div className="text-slate-600">{currentPage}</div>
            {currentSection && <div className="text-slate-500 text-xs mt-1">{currentSection}</div>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tipo de reporte
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <input
                  type="radio"
                  name="type"
                  value="error"
                  checked={formData.type === "error"}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mr-2"
                />
                <span className="text-sm">🐛 Error</span>
              </label>
              <label className="flex-1">
                <input
                  type="radio"
                  name="type"
                  value="mejora"
                  checked={formData.type === "mejora"}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mr-2"
                />
                <span className="text-sm">💡 Mejora</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows="4"
              placeholder="Describe el problema o la mejora propuesta..."
              required
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {isSubmitting ? "Enviando..." : "Enviar Reporte"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default FeedbackButton;
