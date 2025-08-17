import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";

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
