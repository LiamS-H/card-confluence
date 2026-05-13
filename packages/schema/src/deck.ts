import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const deck = pgTable("deck", {
    id: uuid("id").defaultRandom().primaryKey(),
    doc: text("doc").notNull().default(""),
    ownerId: text("owner_id")
        .notNull()
        .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deckPermission = pgTable("deck_permission", {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
        .notNull()
        .references(() => deck.id),
    userId: text("user_id")
        .notNull()
        .references(() => user.id),
    accessLevel: text("access_level", {
        enum: ["owner", "editor", "suggester"],
    }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
