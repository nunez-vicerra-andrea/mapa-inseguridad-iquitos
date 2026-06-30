import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function fixText(text: string | null | undefined): string | null {
    if (!text) return text ?? null;

    return text
        // Caracteres UTF-8 rotos
        .replace(/Ã¡/g, "á")
        .replace(/Ã©/g, "é")
        .replace(/Ã­/g, "í")
        .replace(/Ã³/g, "ó")
        .replace(/Ãº/g, "ú")
        .replace(/Ã±/g, "ñ")
        .replace(/Ã/g, "Á")
        .replace(/Â/g, "")

        // Casos específicos
        .replace(/Bel.n/gi, "Belén")
        .replace(/BelÃ©n/gi, "Belén")
        .replace(/Met.lica/gi, "Metálica")
        .replace(/MetÃ¡lica/gi, "Metálica")
        .replace(/M.dico/gi, "Médico")
        .replace(/MÃ©dico/gi, "Médico")
        .replace(/PerÃº/gi, "Perú")

        .trim();
}

async function main() {

    const reports = await prisma.incidentReport.findMany();

    console.log(`Se encontraron ${reports.length} registros`);

    for (const report of reports) {

        await prisma.incidentReport.update({

            where: {
                id: report.id
            },

            data: {

                district: fixText(report.district)!,

                province: fixText(report.province),

                state: fixText(report.state),

                incidentType: fixText(report.incidentType)!,

                stolenObject: fixText(report.stolenObject),

                description: fixText(report.description),

                contactInfo: fixText(report.contactInfo)

            }

        });

    }

    console.log("✅ Base de datos corregida.");
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });