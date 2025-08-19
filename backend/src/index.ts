import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import { Request, Response } from "express";
import prisma from "./lib/prisma";
import { Prisma } from "@prisma/client";
import {
  DropSchema,
  DropUpdateSchema,
  StoreSchema,
  StoreUpdateSchema,
} from "./zod/validations";
import bcrypt from "bcrypt";

import {
  sendMessage,
  handleSubscribe,
  handleUnsubscribe,
} from "./util/notif/index";
import { requireAuth } from "./middleware/requireAuth";

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

// create store
app.post(
  "/store/createstore",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const parsed = StoreSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid inputs", details: parsed.error });
      }

      const { slug, name, ownerId, description, imageUrl, tags } = parsed.data;

      const exist = await prisma.store.findFirst({ where: { slug } });
      if (exist) return res.status(400).json({ error: "Store already exists" });

      const store = await prisma.store.create({
        data: { slug, name, ownerId, description, imageUrl, tags },
      });

      return res.status(201).json({ store });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Something went wrong" });
    }
  }
);

//get store by slug
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
app.put("/store/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = StoreUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid inputs", details: parsed.error });
    }

    if (!id) {
      res.status(400).json({ error: "ID required" });
      return;
    }
    const store = await prisma.store.update({
      where: { id },
      data: parsed.data as Prisma.StoreUpdateInput,
    });

    res.json({ store });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});
//delete a store
app.delete("/store/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: "ID required" });
      return;
    }
    await prisma.store.delete({ where: { id } });
    res.json({ message: "Store deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
// create drop
app.post("/drop/create", requireAuth, async (req: Request, res: Response) => {
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

    // TODO: notify subscribers here

    return res.json({ drop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// get all drops of a store
app.get("/drops/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;
    const drops = await prisma.drop.findMany({ where: { storeId } });
    res.json({ drops });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// get single drop
app.get("/drop/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const drop = await prisma.drop.findUnique({ where: { id } });
    if (!drop) return res.status(404).json({ error: "Drop not found" });
    res.json({ drop });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// update drop
app.put("/drop/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = DropUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid inputs", details: parsed.error });
    }

    const drop = await prisma.drop.update({
      where: { id },
      data: parsed.data as Prisma.DropUpdateInput, // safe thanks to transform
    });

    res.json({ drop });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// delete drop
app.delete("/drop/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.drop.delete({ where: { id } });
    res.json({ message: "Drop deleted" });
  } catch {
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

// Signup
app.post("/auth/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username)
      return res.status(400).json({ error: "Email & password required" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(400).json({ error: "Email already in use" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashed },
    });

    req.session.userId = user.id;

    res.status(201).json({
      message: "Signup successful",
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email & password required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });

    req.session.userId = user.id; // 👈 session set

    res.json({
      message: "Login successful",
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Logout
app.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("connect.sid"); // default cookie name
    res.json({ message: "Logged out" });
  });
});
