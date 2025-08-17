import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import axios from "axios";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const drop = await prisma.drop.findUnique({
    where: { id: params.id },
    include: { store: true },
  });
  if (!drop) return NextResponse.json({ ok: false, error: "drop not found" });

  const subs = await prisma.subscription.findMany({
    where: { storeId: drop.storeId, platform: "telegram" },
  });

  const caption = ` *${drop.title}*\n${drop.price}\n${drop.description}\n[Buy now](${drop.productUrl})`;

  for (const sub of subs) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
        {
          chat_id: sub.externalUserId,
          photo: drop.imageUrl,
          caption,
          parse_mode: "Markdown",
        }
      );
    } catch (err: any) {
      console.error(
        `Failed to send to ${sub.externalUserId}`,
        err.response?.data || err.message
      );
    }
  }

  await prisma.drop.update({
    where: { id: drop.id },
    data: { publishedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
