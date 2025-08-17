import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import { Request, Response } from "express";
import prisma from "./lib/prisma";
import { DropSchema, StoreSchema } from "./zod/validations";
import axios from "axios";
dotenv.config();
const app = express();

app.use(express.json());

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

app.use(
  session({
    secret: "super-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    }, // secure: true in prod (HTTPS)
  })
);

app.listen(`${process.env.BACKEND_PORT}`, () => {
  console.log(`Running on ${process.env.BACKEND_PORT}`);
});

app.post("/store/createstore", async (req: Request, res: Response) => {
  try {
    const parsed = StoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid inputs", details: parsed.error });
    }

    const { slug, name, ownerId } = parsed.data;
    const exist = await prisma.store.findFirst({ where: { slug } });

    if (exist) {
      return res.status(400).json({ error: "Store already exists" });
    }

    const store = await prisma.store.create({
      data: { slug, name, ownerId },
    });

    return res.status(201).json({ store });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/store/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const store = await prisma.store.findUnique({ where: { slug } });
    if (!store) return res.status(404).json({ error: "Store not found" });
    res.json({ store });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

//get all owner's stores
app.get("/stores/:ownerId", async (req, res) => {
  try {
    const { ownerId } = req.params;
    const stores = await prisma.store.findMany({ where: { ownerId } });
    res.json({ stores });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

//update store details
app.put("/store/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = StoreSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid inputs" });
    const { name, slug, ownerId } = parsed.data;

    const store = await prisma.store.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(ownerId !== undefined ? { ownerId } : {}),
      },
    });
    res.json({ store });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
//delete a store
app.delete("/store/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.store.delete({ where: { id } });
    res.json({ message: "Store deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/webhook/telegram", async (req: Request, res: Response) => {
  try {
    const update = req.body;
    const text = update.message?.text;
    if (!text) return res.json({ ok: true });

    let slug: string | undefined;

    // /start subscribe_slug
    if (text.startsWith("/start")) {
      const args = text.split(" ");
      const params = args[1];
      if (params?.startsWith("subscribe_")) {
        slug = params.replace("subscribe_", "");
      }
    }

    // /subscribe slug
    if (text.startsWith("/subscribe")) {
      const args = text.split(" ");
      slug = args[1];
      if (!slug) {
        await sendMessage(
          update.message.chat.id,
          "Usage: /subscribe <store-slug>"
        );
        return res.json({ ok: false });
      }
      return await handleSubscribe(slug, update);
    }

    // /unsubscribe slug
    if (text.startsWith("/unsubscribe")) {
      const args = text.split(" ");
      slug = args[1];
      if (!slug) {
        await sendMessage(
          update.message.chat.id,
          "Usage: /unsubscribe <store-slug>"
        );
        return res.json({ ok: false });
      }
      return await handleUnsubscribe(slug, update);
    }

    // /help
    if (text.startsWith("/help")) {
      await sendMessage(
        update.message.chat.id,
        "Commands:\n/subscribe <store>\n/unsubscribe <store>\n/help"
      );
      return res.json({ ok: true });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
});

// helper: send message
async function sendMessage(chatId: string | number, text: string) {
  return axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    { chat_id: chatId, text }
  );
}

// helper: subscribe
async function handleSubscribe(slug: string, update: any) {
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
async function handleUnsubscribe(slug: string, update: any) {
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

app.post("/drop/create", async (req: Request, res: Response) => {
  try {
    const parsed = DropSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid inputs", details: parsed.error });
    }

    const { storeId, title, description, imageUrl, price, productUrl } =
      parsed.data;

    const drop = await prisma.drop.create({
      data: { storeId, title, description, imageUrl, price, productUrl },
    });

    // Find subscribers
    const subs = await prisma.subscription.findMany({
      where: { storeId, platform: "telegram" },
    });

    // Fan-out
    for (const sub of subs) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
          {
            chat_id: sub.externalUserId,
            photo: imageUrl,
            caption: `🔥 New drop: ${title}\n\n${description}`,
            parse_mode: "HTML",
          }
        );
      } catch (err: any) {
        console.error(
          "Failed to notify",
          sub.externalUserId,
          err.response?.data || err.message
        );
      }
    }

    return res.json({ drop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
