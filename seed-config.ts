import "dotenv/config";
import prisma from "./src/lib/prisma";

async function main() {
    const configs = [
        { key: "hours_start", value: "08:00" },
        { key: "hours_end", value: "19:00" },
        { key: "days_allowed", value: JSON.stringify([1, 2, 3, 4, 5, 6]) }, // 1=Mon, 6=Sat
        { key: "slot_duration", value: "15" },
        { key: "capacity_per_slot", value: "1" },
        { key: "lead_time_days", value: "1" }
    ];

    for (const config of configs) {
        await prisma.config.upsert({
            where: { key: config.key },
            update: {},
            create: config
        });
    }
    console.log("Configurações iniciais carregadas.");
}

main().catch(console.error);
