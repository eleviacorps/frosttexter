import { customAlphabet } from "nanoid";
const inviteAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
const idAlphabet = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 18);
export function createInviteCode() {
    return inviteAlphabet();
}
export function createEntityId(prefix) {
    return `${prefix}_${idAlphabet()}`;
}
export function upsertById(items, nextItem) {
    const index = items.findIndex((item) => item.id === nextItem.id);
    if (index === -1) {
        return [nextItem, ...items];
    }
    const clone = [...items];
    clone[index] = nextItem;
    return clone;
}
export function getConversationTitle(conversation, users, currentUserId) {
    if (conversation.kind !== "dm") {
        return conversation.title;
    }
    const otherId = conversation.participantIds.find((id) => id !== currentUserId);
    return users.find((user) => user.id === otherId)?.username ?? conversation.title;
}
export function groupMessagesByDate(messages) {
    return messages.reduce((acc, message) => {
        const key = new Date(message.createdAt).toDateString();
        acc[key] = acc[key] ? [...acc[key], message] : [message];
        return acc;
    }, {});
}
export function summarizeMessage(message) {
    if (!message) {
        return "No messages yet";
    }
    if (message.deletedForEveryone) {
        return "Message removed";
    }
    if (message.attachments?.length) {
        const first = message.attachments[0];
        if (first.kind === "voice") {
            return "Voice note";
        }
        return `${first.kind[0].toUpperCase()}${first.kind.slice(1)} attachment`;
    }
    return message.body || "Message";
}
export function makeWaveform(seed = 16) {
    return Array.from({ length: seed }, (_, index) => {
        const pivot = Math.sin(index * 0.8) * 0.5 + 0.5;
        return Number((pivot + Math.random() * 0.25).toFixed(2));
    });
}
