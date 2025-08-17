import { z } from "zod";

export const StoreSchema = z.object({
  name: z.string().min(3),
  slug: z.string(),
  ownerId: z.string(),
});

export const DropSchema = z.object({
  storeId: z.string(),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string(),
  price: z.string(),
  productUrl: z.string(),
});
