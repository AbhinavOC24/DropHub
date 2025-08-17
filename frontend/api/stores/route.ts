import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const StoreSchema = z.object({
  name: z.string().min(3),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  ownerId: z.string().cuid(),
});
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = StoreSchema.parse(body);

    const store = await prisma.store.create({ data });
    return NextResponse.json(store);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
