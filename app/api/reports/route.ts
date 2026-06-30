import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

// Evitar múltiples instancias de Prisma en desarrollo
const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// ========================================
// CORRIGE PROBLEMAS DE CODIFICACIÓN y ROMBOS
// ========================================
function fixEncoding(text: unknown): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== "string") return String(text);

  let cleaned = text;

  try {
    // Intento primario de conversión de búfer para recuperar caracteres desde latin1
    cleaned = Buffer.from(text, "latin1").toString("utf8");
  } catch {
    // Si falla, se mantiene el string base para la limpieza manual
  }

  // Usamos una lista de objetos en lugar de un diccionario para evitar llaves duplicadas
  const replacementList = [
    { broken: 'lpices', correct: 'lápices' },
    { broken: 'Beln', correct: 'Belén' },
    { broken: 'Metlica', correct: 'Metálica' },
    { broken: 'mdico', correct: 'médico' },
    { broken: 'telfono', correct: 'teléfono' },
    { broken: 'vehculo', correct: 'vehículo' },
    { broken: 'camionn', correct: 'camioneta' },
    { broken: 'sustrado', correct: 'sustraído' },
    { broken: 'violacin', correct: 'violación' },
    { broken: 'comisara', correct: 'comisaría' }
  ];

  // Recorremos la lista haciendo los reemplazos de forma segura
  replacementList.forEach(({ broken, correct }) => {
    cleaned = cleaned.split(broken).join(correct);
  });

  // Remueve cualquier rombo huérfano remanente usando su código Unicode puro (\uFFFD)
  return cleaned.replace(/\uFFFD/g, '').trim();
}

// ========================================
// GUARDAR REPORTE (POST)
// ========================================
export async function POST(req: Request) {
  try {
    const data = await req.json()

    const rawLat = data.latitude ?? data.lat
    const rawLng = data.longitude ?? data.lng

    if (
      rawLat === undefined ||
      rawLng === undefined ||
      rawLat === null ||
      rawLng === null
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'La latitud y longitud son campos obligatorios.',
        },
        {
          status: 400,
        }
      )
    }

    const parsedLat = parseFloat(rawLat)
    const parsedLng = parseFloat(rawLng)

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Las coordenadas proporcionadas no tienen un formato numérico válido.',
        },
        {
          status: 400,
        }
      )
    }

    let year = data.incidentYear
    let month = data.incidentMonth
    let day = data.incidentDay

    if (data.exactDate) {
      const fechaObj = new Date(data.exactDate)

      if (!isNaN(fechaObj.getTime())) {
        year = fechaObj.getFullYear()
        month = fechaObj.getMonth() + 1
        day = fechaObj.getDate()
      }
    }

    if (!year) {
      year = new Date().getFullYear()
    }

    const newReport = await prisma.incidentReport.create({
      data: {
        lat: parsedLat,
        lng: parsedLng,

        district: fixEncoding(data.district) || 'Iquitos',
        province: fixEncoding(data.province) || 'Maynas',
        state: fixEncoding(data.state) || 'Loreto',

        incidentType: fixEncoding(data.incidentType) || 'No especificado',
        stolenObject: fixEncoding(data.stolenObject),
        victimGender: fixEncoding(data.victimGender) || 'No especificado',

        incidentYear: Number(year),
        incidentMonth: month ? Number(month) : null,
        incidentDay: day ? Number(day) : null,

        timeOfDay: fixEncoding(data.timeOfDay) || 'No especificado',
        mobility: fixEncoding(data.mobility) || 'A pie',
        economicImpact: fixEncoding(data.economicImpact) || 'Bajo',
        description: fixEncoding(data.description),
        contactInfo: fixEncoding(data.contactInfo),
      },
    })

    return NextResponse.json({
      ok: true,
      data: newReport,
    })
  } catch (error) {
    console.error('❌ ERROR AL GUARDAR:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Error interno al guardar el reporte',
      },
      {
        status: 500,
      }
    )
  }
}

// ========================================
// OBTENER REPORTES (GET)
// ========================================
export async function GET() {
  try {
    const reports = await prisma.incidentReport.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    const diasSemana = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

    // Recorremos y limpiamos todos los datos que van hacia el frontend e inyectamos el día de la semana
    const sanitizedReports = reports.map(report => {
      let nombreDia = "NO ESPECIFICADO";

      // Calculamos dinámicamente el día de la semana basado en las columnas numéricas de la BD
      if (report.incidentYear && report.incidentMonth && report.incidentDay) {
        const fechaObj = new Date(
          Number(report.incidentYear),
          Number(report.incidentMonth) - 1, // Restamos 1 porque en JavaScript los meses van de 0 a 11
          Number(report.incidentDay)
        );

        if (!isNaN(fechaObj.getTime())) {
          nombreDia = diasSemana[fechaObj.getDay()];
        }
      }

      return {
        ...report,
        // Saneamiento riguroso al vuelo para reparar registros viejos corruptos en la respuesta de la API
        district: fixEncoding(report.district) || 'Iquitos',
        province: fixEncoding(report.province) || 'Maynas',
        state: fixEncoding(report.state) || 'Loreto',
        incidentType: fixEncoding(report.incidentType) || 'No especificado',
        stolenObject: fixEncoding(report.stolenObject),
        victimGender: fixEncoding(report.victimGender) || 'No especificado',
        timeOfDay: fixEncoding(report.timeOfDay) || 'No especificado',
        mobility: fixEncoding(report.mobility) || 'A pie',
        economicImpact: fixEncoding(report.economicImpact) || 'Bajo',
        description: fixEncoding(report.description),
        contactInfo: fixEncoding(report.contactInfo),
        
        // 🌟 Nueva propiedad lista para ser mapeada en las columnas de descarga
        dayOfWeek: nombreDia 
      };
    });

    return NextResponse.json(sanitizedReports)
  } catch (error) {
    console.error('❌ ERROR AL OBTENER DATOS:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Error al obtener los reportes',
      },
      {
        status: 500,
      }
    )
  }
}