import axios from "axios";
import prisma from "../../lib/prisma";
// helper: send message
export async function sendMessage(chatId: string | number, text: string) {
  return axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    { chat_id: chatId, text }
  );
}

// helper: subscribe
export async function handleSubscribe(slug: string, update: any) {
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) {
    await sendMessage(update.message.chat.id, `❌ Store '${slug}' not found`);
    return;
  }
  await prisma.subscription.upsert({
    where: {
      storeId_platform_externalUserId: {
        storeId: store.id,
        platform: "telegram",
        externalUserId: String(update.message.chat.id),
      },
    },
    create: {
      storeId: store.id,
      platform: "telegram",
      externalUserId: String(update.message.chat.id),
      username: update.message.chat.username ?? null,
    },
    update: {},
  });
  await sendMessage(update.message.chat.id, `✅ Subscribed to ${store.name}`);
}

// helper: unsubscribe
export async function handleUnsubscribe(slug: string, update: any) {
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) {
    await sendMessage(update.message.chat.id, `❌ Store '${slug}' not found`);
    return;
  }
  await prisma.subscription.deleteMany({
    where: {
      storeId: store.id,
      platform: "telegram",
      externalUserId: String(update.message.chat.id),
    },
  });
  await sendMessage(
    update.message.chat.id,
    `❌ Unsubscribed from ${store.name}`
  );
}
