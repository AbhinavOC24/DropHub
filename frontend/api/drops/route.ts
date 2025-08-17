import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storeSlug, title, description, price, imageUrl, productUrl } = body;
    const store = await prisma.store.findUnique({
      where: {
        slug: storeSlug,
      },
    });
    if (!store)
      return NextResponse.json(
        { ok: false, error: "Store not found" },
        { status: 404 }
      );
    const drop = await prisma.drop.create({
      data: {
        storeId: store.id,
        title,
        description,
        price,
        imageUrl,
        productUrl,
      },
    });
    return NextResponse.json({ ok: true, drop });
  } catch (err) {
    console.error("Error creating drop:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
