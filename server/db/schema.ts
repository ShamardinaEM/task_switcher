import {
    pgTable,
    text,
    timestamp,
    integer,
    boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Better-auth required tables ────────────────────────────────────────────

export const users = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const sessions = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const verifications = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
});

// ─── Game tables ─────────────────────────────────────────────────────────────

export const teams = pgTable("team", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull(),
});

export const matches = pgTable("match", {
    id: text("id").primaryKey(),
    roomCode: text("room_code").notNull().unique(),
    status: text("status").notNull().default("waiting"),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(), // Добавить это поле
    winningTeamId: text("winning_team_id").references(() => teams.id),
});

export const matchTeams = pgTable("match_team", {
    id: text("id").primaryKey(),
    matchId: text("match_id")
        .notNull()
        .references(() => matches.id, { onDelete: "cascade" }),
    teamId: text("team_id")
        .notNull()
        .references(() => teams.id),
    totalScore: integer("total_score").notNull().default(0),
});

export const participants = pgTable("participant", {
    id: text("id").primaryKey(),
    matchId: text("match_id")
        .notNull()
        .references(() => matches.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    teamId: text("team_id")
        .notNull()
        .references(() => teams.id),
    score: integer("score").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    wrong: integer("wrong").notNull().default(0),
    isBot: boolean("is_bot").notNull().default(false),
});

export const rounds = pgTable("round", {
    id: text("id").primaryKey(),
    matchId: text("match_id")
        .notNull()
        .references(() => matches.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    rule: text("rule").notNull(), // JSON-сериализованный GameRule
    correctAnswer: text("correct_answer").notNull(),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
});

export const answers = pgTable("answer", {
    id: text("id").primaryKey(),
    roundId: text("round_id")
        .notNull()
        .references(() => rounds.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    answer: text("answer").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    responseMs: integer("response_ms").notNull(),
    createdAt: timestamp("created_at").notNull(),
});

// ─── Relations (для Drizzle query builder с with:) ───────────────────────────

export const matchesRelations = relations(matches, ({ many }) => ({
    matchTeams: many(matchTeams),
    participants: many(participants),
    rounds: many(rounds),
}));

export const matchTeamsRelations = relations(matchTeams, ({ one }) => ({
    match: one(matches, {
        fields: [matchTeams.matchId],
        references: [matches.id],
    }),
    team: one(teams, { fields: [matchTeams.teamId], references: [teams.id] }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
    matchTeams: many(matchTeams),
    participants: many(participants),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
    match: one(matches, {
        fields: [participants.matchId],
        references: [matches.id],
    }),
    team: one(teams, { fields: [participants.teamId], references: [teams.id] }),
    user: one(users, { fields: [participants.userId], references: [users.id] }),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
    match: one(matches, { fields: [rounds.matchId], references: [matches.id] }),
    answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one }) => ({
    round: one(rounds, { fields: [answers.roundId], references: [rounds.id] }),
    user: one(users, { fields: [answers.userId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
    participants: many(participants),
    answers: many(answers),
}));
