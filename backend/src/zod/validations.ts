import { z } from "zod";

// -------------------- Store --------------------
export const StoreSchema = z.object({
  name: z.string().min(3, "Store name must be at least 3 characters"),
  slug: z.string().min(1, "Slug is required"),
  ownerId: z.string().min(1, "Owner ID is required"),
  description: z.string(),
  imageUrl: z.string().url("Must be a valid URL"),
  tags: z.array(z.string()).optional().default([]),
});

// Partial for updates
export const StoreUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  slug: z.string().optional(),
  ownerId: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

// -------------------- Drop --------------------
export const DropSchema = z.object({
  storeId: z.string().min(1, "Store ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  imageUrl: z.string().url("Must be a valid URL"),
  price: z.string().min(1, "Price is required"), // could later refine as regex for currency/number
  productUrl: z.string().url("Must be a valid URL"),
});

// Partial for updates
export const DropUpdateSchema = DropSchema.partial();

// -------------------- Subscription --------------------
export const SubscriptionSchema = z.object({
  storeId: z.string(),
  platform: z.enum(["telegram", "discord", "email"]), // restrict to known platforms
  externalUserId: z.string(),
  username: z.string(),
});

// Partial for updates
export const SubscriptionUpdateSchema = SubscriptionSchema.partial();

// -------------------- User --------------------
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email("Must be a valid email"),
  password: z.string().min(6, "Password must be at least 6 chars"),
});

// Partial for updates (probably not for password)
export const UserUpdateSchema = UserSchema.partial();
