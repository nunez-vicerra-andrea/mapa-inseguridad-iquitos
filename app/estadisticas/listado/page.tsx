'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface IncidentReport {
    id: string;
    district?: string | null;
    province?: string | null;
    state?: string | null;
    incidentType?: string | null;
    stolenObject?: string | null;
    victimGender?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    exactDate?: string | null;
    approximateDate?: string | null;
    timeOfDay?: string | null;
    description?: string | null;
    contactInfo?: string | null;
    createdAt?: string | null;
}

const cleanEncoding = (text: string | null | undefined): string => {
    if (!text) return '';
    const lower = text.toLowerCase();
    
    if (lower.includes('bel') && (lower.includes('n') || text.length <= 6)) {
        return 'Belén';
    }
    if (lower.includes('met') && lower.includes('lic')) {
        return 'Silla Metálica';
    }
    if (lower.includes('m') && lower.includes('dico')) {
        return 'equipo médico';
    }
    return text.trim();
};

export default function ListadoCompletoEstadisticas() {
    const router = useRouter()
    const [reports, setReports] = useState<IncidentReport[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [searchTerm, setSearchTerm] = useState<string>('')

    const [selectedDept, setSelectedDept] = useState<string>('TODOS')
    const [selectedProv, setSelectedProv] = useState<string>('TODOS')
    const [selectedDist, setSelectedDist] = useState<string>('TODOS')

    const ITEMS_PER_PAGE = 15;
    const [currentPage, setCurrentPage] = useState<number>(1);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const res = await fetch('/api/reports')
                const data = await res.json()
                
                setReports(
                    Array.isArray(data)
                        ? data.sort(
                            (a, b) =>
                                new Date(b.createdAt || b.exactDate || '').getTime() -
                                new Date(a.createdAt || a.exactDate || '').getTime()
                          )
                        : []
                );
            } catch (error) {
                console.error("Error al cargar listado de seguridad:", error)
                setReports([])
            } finally {
                setLoading(false)
            }
        }
        fetchReports()
    }, [])

    const safeReports = Array.isArray(reports) ? reports : [];

    const departamentos = Array.from(
        new Set(safeReports.map(r => cleanEncoding(r.state)).filter(Boolean))
    ).sort() as string[];

    const provincias = Array.from(
        new Set(
            safeReports
                .filter(r => selectedDept === 'TODOS' || cleanEncoding(r.state).toLowerCase() === selectedDept.toLowerCase())
                .map(r => cleanEncoding(r.province))
                .filter(Boolean)
        )
    ).sort() as string[];

    const distritos = Array.from(
        new Set(
            safeReports
                .filter(r => {
                    const matchDept = selectedDept === 'TODOS' || cleanEncoding(r.state).toLowerCase() === selectedDept.toLowerCase();
                    const matchProv = selectedProv === 'TODOS' || cleanEncoding(r.province).toLowerCase() === selectedProv.toLowerCase();
                    return matchDept && matchProv;
                })
                .map(r => cleanEncoding(r.district))
                .filter(Boolean)
        )
    ).sort() as string[];

    const filteredReports = safeReports.filter((report) => {
        const rDept = cleanEncoding(report.state);
        const rProv = cleanEncoding(report.province);
        const rDist = cleanEncoding(report.district);
        const rObj = cleanEncoding(report.stolenObject);
        const rDesc = report.description || '';
        const rType = report.incidentType || '';

        const matchDept = selectedDept === 'TODOS' || rDept.toLowerCase() === selectedDept.toLowerCase();
        const matchProv = selectedProv === 'TODOS' || rProv.toLowerCase() === selectedProv.toLowerCase();
        const matchDist = selectedDist === 'TODOS' || rDist.toLowerCase() === selectedDist.toLowerCase();

        const matchSearch = 
            rDist.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rObj.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rDesc.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rType.toLowerCase().includes(searchTerm.toLowerCase());

        return matchDept && matchProv && matchDist && matchSearch;
    });

    const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);
    
    const currentReports = filteredReports.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '---';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const handleExportExcel = () => {
        if (filteredReports.length === 0) {
            alert("No hay registros en la vista actual para exportar.");
            return;
        }

        const dataToExport = filteredReports.map((report) => ({
            ID: report.id,
            Fecha: formatDate(report.exactDate || report.createdAt),
            Departamento: cleanEncoding(report.state) || 'No especificado',
            Provincia: cleanEncoding(report.province) || 'No especificado',
            Distrito: cleanEncoding(report.district) || 'No especificado',
            'Tipo de Incidente': report.incidentType || 'No especificado',
            'Objeto Sustraído': cleanEncoding(report.stolenObject) || 'Otros',
            Descripción: report.description || 'Sin descripción adicional.',
            'Género Víctima': report.victimGender || 'No especificado',
            'Hora Aproximada': report.timeOfDay || 'No especificado',
            Latitud: report.latitude || '',
            Longitud: report.longitude || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Incidentes");

        const maxProps = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
        worksheet['!cols'] = maxProps;

        const fecha = new Date().toISOString().split("T")[0];
        XLSX.writeFile(workbook, `reportes_seguridad_${fecha}.xlsx`);
    };

    const handleExportPDF = () => {
        if (filteredReports.length === 0) {
            alert("No hay registros en la vista actual para exportar.");
            return;
        }
        const doc = new jsPDF();
        const fecha = new Date().toISOString().split("T")[0];
        
        doc.text("Reporte de Incidentes de Seguridad", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generado el: ${fecha} | Registros: ${filteredReports.length}`, 14, 22);

        const tableRows = filteredReports.map(r => [
            formatDate(r.exactDate || r.createdAt),
            `${cleanEncoding(r.district)}, ${cleanEncoding(r.province)}`,
            r.incidentType || 'No especificado',
            cleanEncoding(r.stolenObject) || 'Otros'
        ]);

        autoTable(doc, {
            head: [['Fecha', 'Ubicación', 'Modalidad', 'Objeto Sustraído']],
            body: tableRows,
            startY: 28,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] }
        });

        doc.save(`reportes_seguridad_${fecha}.pdf`);
    };

    return (
        <div className="min-h-screen bg-[#d1e2d9] bg-[radial-gradient(circle_at_top_right,_#e8f5ee_0%,_#d1e2d9_50%,_#b8cdc2_100%)] p-6 md:p-12 font-sans text-slate-800">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Cabecera limpia */}
                <div className="space-y-4">
                    <div>
                        <button
                            onClick={() => router.push('/estadisticas')}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 duration-200"
                        >
                            ← Volver a Gráficos
                        </button>
                    </div>

                    <div className="">
                        <h1 className="text-2xl font-black text-[#0F172A] tracking-tighter uppercase">
                            BASE DE DATOS COMPLETA
                        </h1>
                        <p className="text-xs text-slate-600 font-medium mt-1">
                            Visualización de registros individuales indexados en el sistema de seguridad ciudadana.
                        </p>
                    </div>
                </div>

                {/* Filtros Avanzados */}
                <div className="bg-white/70 backdrop-blur-md p-6 rounded-[2rem] border border-white/40 shadow-sm space-y-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                        Herramientas de filtrado rápido
                    </h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-1.5 sm:col-span-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Término de Búsqueda</label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="🔍 Buscar objeto, distrito..."
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Departamento</label>
                            <select
                                value={selectedDept}
                                onChange={(e) => {
                                    setSelectedDept(e.target.value);
                                    setSelectedProv('TODOS');
                                    setSelectedDist('TODOS');
                                    setCurrentPage(1);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 cursor-pointer"
                            >
                                <option value="TODOS">▼ Todos</option>
                                {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Provincia</label>
                            <select
                                value={selectedProv}
                                disabled={selectedDept === 'TODOS'}
                                onChange={(e) => {
                                    setSelectedProv(e.target.value);
                                    setSelectedDist('TODOS');
                                    setCurrentPage(1);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 cursor-pointer disabled:bg-slate-100/50 disabled:text-slate-400"
                            >
                                <option value="TODOS">▼ Todas</option>
                                {provincias.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Distrito</label>
                            <select
                                value={selectedDist}
                                disabled={selectedProv === 'TODOS'}
                                onChange={(e) => {
                                    setSelectedDist(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 cursor-pointer disabled:bg-slate-100/50 disabled:text-slate-400"
                            >
                                <option value="TODOS">▼ Todos</option>
                                {distritos.map(di => <option key={di} value={di}>{di}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tabla de Datos Principal */}
                {loading ? (
                    <div className="h-96 flex flex-col items-center justify-center bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
                        <div className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Estructurando hoja de registros...</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                        
                        {/* ─── 📥 CUADRO DEL CONTADOR COMPLETAMENTE ALINEADO A LOS EXTREMOS (image_98ffc5.png) ─── */}
                        <div className="w-full px-8 py-5 bg-slate-50 border-b border-slate-100 flex flex-row justify-between items-center gap-4">
                            {/* Texto empujado 100% a la izquierda */}
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                                Mostrando <span className="text-emerald-700 font-extrabold">{currentReports.length}</span> de <span className="text-slate-900 font-extrabold">{filteredReports.length}</span> registros encontrados ({safeReports.length} totales)
                            </span>
                            
{/* Botones empujados 100% a la derecha en la esquina */}
<div className="flex items-center gap-2 shrink-0">
    <button
        onClick={handleExportExcel}
        className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-[9px] font-black text-white rounded-lg transition-all uppercase tracking-wider shadow-sm hover:-translate-y-0.5 active:translate-y-0 duration-150 flex items-center gap-1.5"
    >
        📥 Excel
    </button>
    <button
        onClick={handleExportPDF}
        className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-[9px] font-black text-white rounded-lg transition-all uppercase tracking-wider shadow-sm hover:-translate-y-0.5 active:translate-y-0 duration-150 flex items-center gap-1.5"
    >
        📄 PDF
    </button>
</div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Ubicación</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Modalidad / Tipo</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Objeto Sustraído</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Descripción Breve</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                    {currentReports.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center text-slate-400 uppercase font-black tracking-widest text-[10px]">
                                                No hay registros que coincidan con la búsqueda activa.
                                            </td>
                                        </tr>
                                    ) : (
                                        currentReports.map((report) => (
                                            <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-bold">
                                                    {formatDate(report.exactDate || report.createdAt)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900">{cleanEncoding(report.district) || '---'}</span>
                                                        <span className="text-[10px] text-slate-400 font-semibold">{cleanEncoding(report.province)}, {cleanEncoding(report.state)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-tight rounded-md">
                                                        {report.incidentType || 'No especificado'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-slate-800">
                                                    {cleanEncoding(report.stolenObject) || 'Otros'}
                                                </td>
                                                <td className="px-6 py-4 max-w-xs truncate text-slate-500 font-normal">
                                                    {report.description || 'Sin descripción adicional.'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Control de páginas */}
                        {totalPages > 1 && (
                            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/40 flex flex-row items-center justify-between gap-4">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-wider shadow-sm disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
                                >
                                    ← Anterior
                                </button>
                                
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    Página {currentPage} de {totalPages}
                                </span>

                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-wider shadow-sm disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
                                >
                                    Siguiente →
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}