'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// Importación de componentes de analítica con diseño unificado
import DistrictChart from '@/components/stats/DistrictChart'
import TimeDistributionChart from '@/components/stats/TimeDistributionChart'
import ViolenceGenderChart from '@/components/stats/ViolenceGenderChart'
import StolenItemsChart from '@/components/stats/StolenItemsChart'

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

// 🛠️ FUNCIÓN PURIFICADORA PARA CARACTERES MAL CODIFICADOS
// 🛠️ FUNCIÓN PURIFICADORA MEJORADA POR PALABRAS CLAVE
const cleanEncoding = (text: string | null | undefined): string => {
    if (!text) return '';
    
    const lower = text.toLowerCase();
    
    // 1. Corrección estricta para el distrito de Belén
    if (lower.includes('bel') && lower.includes('n')) {
        return 'Belén';
    }
    if (lower.includes('bel') && text.length <= 6) { 
        return 'Belén';
    }
    
    // 2. Corrección para Silla Metálica
    if (lower.includes('met') && lower.includes('lic')) {
        return 'Silla Metálica';
    }
    
    // 3. Corrección para equipo médico
    if (lower.includes('m') && lower.includes('dico')) {
        return 'equipo médico';
    }
    
    // Si no encuentra ningún patrón roto conocido, limpia espacios y lo retorna normal
    return text.trim();
};
export default function PaginaEstadisticas() {
    const router = useRouter()
    const [reports, setReports] = useState<IncidentReport[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    // --- ESTADOS PARA FILTROS EN CASCADA REAL ---
    const [selectedDept, setSelectedDept] = useState<string>('TODOS')
    const [selectedProv, setSelectedProv] = useState<string>('TODOS')
    const [selectedDist, setSelectedDist] = useState<string>('TODOS')

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const res = await fetch('/api/reports')
                const data = await res.json()
                setReports(Array.isArray(data) ? data : [])
            } catch (error) {
                console.error("Error en sincronización de datos de seguridad:", error)
                setReports([])
            } finally {
                setLoading(false)
            }
        }
        fetchReports()
    }, [])

    const safeReports = Array.isArray(reports) ? reports : [];

    // --- GENERACIÓN DINÁMICA DE OPCIONES EN FILTROS (CON LIMPIEZA) ---
    
    // 1. Departamentos únicos en la BD
    const departamentos = Array.from(
        new Set(safeReports.map(r => cleanEncoding(r.state)).filter(Boolean))
    ).sort() as string[];

    // 2. Provincias que pertenecen al departamento seleccionado
    const provincias = Array.from(
        new Set(
            safeReports
                .filter(r => selectedDept === 'TODOS' || cleanEncoding(r.state).toLowerCase() === selectedDept.toLowerCase())
                .map(r => cleanEncoding(r.province))
                .filter(Boolean)
        )
    ).sort() as string[];

    // 3. Distritos que pertenecen a la provincia seleccionada
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


    // --- 📉 FILTRADO FINAL DE LOS REPORTES EN TIEMPO REAL ---
    const filteredReports = safeReports.filter((report) => {
        const rDept = cleanEncoding(report.state);
        const rProv = cleanEncoding(report.province);
        const rDist = cleanEncoding(report.district);

        const matchDept = selectedDept === 'TODOS' || rDept.toLowerCase() === selectedDept.toLowerCase();
        const matchProv = selectedProv === 'TODOS' || rProv.toLowerCase() === selectedProv.toLowerCase();
        const matchDist = selectedDist === 'TODOS' || rDist.toLowerCase() === selectedDist.toLowerCase();

        return matchDept && matchProv && matchDist;
    });


    // --- 📊 PROCESAMIENTO ADAPTADO PARA LOS GRÁFICOS ---

    // 1. Objetos Sustraídos (Purificados de codificación)
    const countsItems = filteredReports.reduce((acc: Record<string, number>, curr: IncidentReport) => {
        const item = curr.stolenObject ? cleanEncoding(curr.stolenObject) : 'Otros';
        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});
    
    const dataItems = Object.keys(countsItems)
        .map(key => ({ name: key, value: countsItems[key] }))
        .sort((a, b) => b.value - a.value);

    // 2. Frecuencia por Distritos
    const activeDistricts = selectedDist !== 'TODOS' ? [selectedDist] : distritos;
    const dataDistricts = activeDistricts.map(d => ({
        name: d,
        cantidad: filteredReports.filter((r: IncidentReport) => cleanEncoding(r.district).toLowerCase() === d.toLowerCase()).length
    })).sort((a, b) => b.cantidad - a.cantidad);

    // 3. Distribución Horaria
    const momentos = ['Mañana', 'Tarde', 'Noche', 'Madrugada', 'No recuerdo'];
    const dataTime = momentos.map(m => {
        const count = filteredReports.filter((r: IncidentReport) => {
            const reportTime = r.timeOfDay ? r.timeOfDay.trim().toLowerCase() : '';
            if (m === 'No recuerdo') return reportTime === 'no recuerdo' || reportTime === '';
            return reportTime === m.toLowerCase();
        }).length;
        return { name: m, value: count };
    });

    // 4. Matriz de Violencia por Género
    const dataViolence = ['Hombre', 'Mujer', 'Prefiero no decirlo'].map(g => {
        const reportsByGender = filteredReports.filter((r: IncidentReport) => {
            const gender = r.victimGender ? r.victimGender.trim().toLowerCase() : '';
            if (g === 'Prefiero no decirlo') return gender.includes('prefiero') || gender === '';
            return gender === g.toLowerCase();
        });

        const conViolencia = reportsByGender.filter((r: IncidentReport) => {
            const type = r.incidentType ? r.incidentType.toLowerCase() : '';
            return type.includes('con') || type.includes('ame') || type.includes('ext') || type.includes('sec');
        }).length;

        const intento = reportsByGender.filter((r: IncidentReport) => {
            const type = r.incidentType ? r.incidentType.toLowerCase() : '';
            return type.includes('int') || type.includes('tra');
        }).length;

        const sinViolencia = reportsByGender.filter((r: IncidentReport) => {
            const type = r.incidentType ? r.incidentType.toLowerCase() : '';
            return type.includes('sin') || type.includes('hur') || type.includes('est');
        }).length;

        const totalProcesados = conViolencia + intento + sinViolencia;
        const faltantes = reportsByGender.length - totalProcesados;

        return {
            genero: g,
            'Con violencia': conViolencia,
            'Intento': intento,
            'Sin violencia': sinViolencia + (faltantes > 0 ? faltantes : 0)
        };
    });

    // --- 🏷️ LÓGICA DINÁMICA DEL LABEL Y VALOR DEL KPI ---
    const getKpiLocationLabel = () => {
        if (selectedDist !== 'TODOS') return 'Distrito Seleccionado';
        if (selectedProv !== 'TODOS') return 'Provincia Seleccionada';
        if (selectedDept !== 'TODOS') return 'Departamento Seleccionado';
        return 'Ubicación de Mayor Frecuencia';
    };

    const getKpiLocationValue = () => {
        if (selectedDist !== 'TODOS') return selectedDist;
        if (selectedProv !== 'TODOS') return selectedProv;
        if (selectedDept !== 'TODOS') return selectedDept;
        return dataDistricts[0]?.name || '---';
    };

    return (
        <div className="min-h-screen bg-[#d1e2d9] bg-[radial-gradient(circle_at_top_right,_#e8f5ee_0%,_#d1e2d9_50%,_#b8cdc2_100%)] p-6 md:p-12 font-sans text-slate-800">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-[#0F172A] tracking-tighter uppercase">
                            RESULTADOS DE LA ENCUESTA
                        </h1>
                    </div>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest shadow-sm"
                    >
                        ← Volver al Panel
                    </button>
                </div>

                {/* Contenedor de Filtros con Título de Sección */}
                <div className="space-y-3">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                       Filtros geográficos
                    </h2>
                    
                    <div className="w-full bg-white/70 backdrop-blur-md p-6 rounded-[2rem] border border-white/40 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
                        
                        {/* Selector de Departamento */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Departamento</label>
                            <select 
                                value={selectedDept} 
                                onChange={(e) => {
                                    setSelectedDept(e.target.value);
                                    setSelectedProv('TODOS'); 
                                    setSelectedDist('TODOS'); 
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 cursor-pointer"
                            >
                                <option value="TODOS">▼ Todos los Departamentos</option>
                                {departamentos.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>

                        {/* Selector de Provincia */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Provincia</label>
                            <select 
                                value={selectedProv} 
                                disabled={selectedDept === 'TODOS'}
                                onChange={(e) => {
                                    setSelectedProv(e.target.value);
                                    setSelectedDist('TODOS'); 
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 cursor-pointer disabled:bg-slate-100/50 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                                <option value="TODOS">▼ Todas las Provincias</option>
                                {provincias.map(prov => (
                                    <option key={prov} value={prov}>{prov}</option>
                                ))}
                            </select>
                        </div>

                        {/* Selector de Distrito */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Distrito</label>
                            <select 
                                value={selectedDist} 
                                disabled={selectedProv === 'TODOS'}
                                onChange={(e) => setSelectedDist(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 cursor-pointer disabled:bg-slate-100/50 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                                <option value="TODOS">▼ Todos los Distritos</option>
                                {distritos.map(dist => (
                                    <option key={dist} value={dist}>{dist}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="h-96 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase text-center">
                            Sincronizando base de datos nacional...
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Indicadores Clave de Riesgo (KPIs) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Incidentes Filtrados</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <p className="text-5xl font-black text-[#0F172A] tracking-tighter">{filteredReports.length}</p>
                                        <div className="px-2 py-1 bg-emerald-50 rounded-lg flex items-center gap-1">
                                            <span className="text-emerald-600 text-[10px] font-black">Muestra</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden sm:flex h-12 w-20 items-end gap-1">
                                    <div className="bg-slate-100 w-full h-[40%] rounded-t-sm"></div>
                                    <div className="bg-slate-200 w-full h-[60%] rounded-t-sm"></div>
                                    <div className="bg-[#10B981] w-full h-[90%] rounded-t-sm"></div>
                                </div>
                            </div>

                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    {getKpiLocationLabel()}
                                </p>
                                <div className="flex items-center gap-4 mt-2">
                                    <p className="text-4xl font-black text-[#0F172A] truncate max-w-[280px]">
                                        {getKpiLocationValue()}
                                    </p>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-full shrink-0">
                                        <div className="w-2 h-2 bg-rose-600 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-tighter">Monitoreado</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Visualización de Gráficos de Datos */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <StolenItemsChart data={dataItems} total={filteredReports.length} />
                            <DistrictChart data={dataDistricts} />
                            <TimeDistributionChart data={dataTime} />
                            <ViolenceGenderChart data={dataViolence} />
                        </div>

                        {/* Sección/Botón Call to Action */}
                        <div className="w-full bg-white/40 border border-dashed border-slate-300 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center gap-4 mt-6">
                            <div className="space-y-1">
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">¿Deseas revisar todos los registros?</h3>
                                <p className="text-xs text-slate-500 max-w-md mx-auto">
                                    Accede de forma directa a la base de datos completa con opción de búsqueda avanzada, filtros individuales y paginación tipo Excel.
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/estadisticas/listado')}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-[#0F172A] hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                📋 Ver listado completo
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}