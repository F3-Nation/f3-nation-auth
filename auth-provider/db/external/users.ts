import { pgTable, integer, text, timestamp } from 'drizzle-orm/pg-core';

// External users table - DO NOT MIGRATE
// This table is managed externally; we only read/write data
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  f3Name: text('f3_name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  homeRegionId: integer('home_region_id'),
  avatarUrl: text('avatar_url'),
  meta: text('meta'),
  created: timestamp('created', { withTimezone: true }).defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).defaultNow(),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  emergencyNotes: text('emergency_notes'),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  status: text('status').$type<'active' | 'inactive'>().default('active'),
});

export type ExternalUser = typeof users.$inferSelect;
export type NewExternalUser = typeof users.$inferInsert;
