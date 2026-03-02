import prisma from "./prisma";
import { addMinutes, format, isAfter, isBefore, setHours, setMinutes, startOfDay, addDays, getDay } from "date-fns";

export async function getAvailableSlots(date: Date) {
    const configs = await prisma.config.findMany();
    const configMap = configs.reduce((acc: any, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {});

    const daysAllowed = JSON.parse(configMap.days_allowed || "[1,2,3,4,5,6]");
    const dayOfWeek = getDay(date);
    if (!daysAllowed.includes(dayOfWeek)) return [];

    const leadTimeDays = parseInt(configMap.lead_time_days || "1");
    const today = startOfDay(new Date());
    if (!isAfter(startOfDay(date), addDays(today, leadTimeDays - 1))) return [];

    const startStr = configMap.hours_start || "08:00";
    const endStr = configMap.hours_end || "19:00";
    const slotDuration = parseInt(configMap.slot_duration || "15");

    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    let currentSlot = setMinutes(setHours(startOfDay(date), startH), startM);
    const lastSlot = setMinutes(setHours(startOfDay(date), endH), endM);

    const existingAppointments = await prisma.agendamento.findMany({
        where: {
            dataHora: {
                gte: currentSlot,
                lte: lastSlot,
            },
            status: {
                notIn: ["CANCELADO"],
            },
        },
        select: { dataHora: true },
    });

    const slots = [];
    while (isBefore(currentSlot, lastSlot)) {
        const isBooked = existingAppointments.some(
            (app) => app.dataHora.getTime() === currentSlot.getTime()
        );

        if (!isBooked) {
            slots.push(new Date(currentSlot));
        }
        currentSlot = addMinutes(currentSlot, slotDuration);
    }

    return slots;
}


export function generateProtocol() {
    const random = Math.floor(100000 + Math.random() * 900000);
    return `AG-${random}`;
}
