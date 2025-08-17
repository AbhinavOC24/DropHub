import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import axios from "axios";

export async function POST(req: Request) {
  const update = await req.json();
  const text = update.message?.text;

  if (!text) return NextResponse.json({ ok: true });

  let slug: string | undefined;

  // 🟢 Case 1: /start subscribe_slug (deep link)
  if (text.startsWith("/start")) {
    const args = text.split(" ");
    const param = args[1]; // e.g. "subscribe_lunargear"
    if (param?.startsWith("subscribe_")) {
      slug = param.replace("subscribe_", ""); // "lunargear"
    }
  }

  // 🟢 Case 2: /subscribe slug (manual command)
  if (text.startsWith("/subscribe")) {
    const args = text.split(" ");
    slug = args[1]; // "lunargear"
  }

  // No slug → show usage
  if (!slug) {
    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: update.message.chat.id,
        text: "⚠️ Usage:\n/start subscribe_<store-slug>\nOR\n/subscribe <store-slug>",
      }
    );
    return NextResponse.json({ ok: false });
  }

  // 🔍 Look up store
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) {
    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: update.message.chat.id,
        text: `❌ Store '${slug}' not found`,
      }
    );
    return NextResponse.json({ ok: false });
  }

  // 📝 Save subscription (upsert so re-subscribing doesn’t error)
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
    update: {}, // nothing to update
  });

  // 🎉 Confirmation
  await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      chat_id: update.message.chat.id,
      text: `✅ Subscribed to ${store.name}`,
    }
  );

  return NextResponse.json({ ok: true });
}
