import { pgEnum } from 'drizzle-orm/pg-core';

export const genderEnum = pgEnum('gender', ['male', 'female', 'non_binary', 'prefer_not_to_say']);

export const verificationStatusEnum = pgEnum('verification_status', [
  'unverified',
  'pending',
  'verified',
  'rejected',
]);

/** `friend` chats are permanent; `quick` chats belong to a timed quick match and expire. */
export const chatKindEnum = pgEnum('chat_kind', ['friend', 'quick']);

export const messageKindEnum = pgEnum('message_kind', ['text', 'gift', 'image', 'system']);

export const quickMatchStatusEnum = pgEnum('quick_match_status', [
  'waiting',
  'active',
  'completed',
  'cancelled',
]);

export const quickMatchDecisionEnum = pgEnum('quick_match_decision', ['keep', 'pass']);

export const coinTransactionTypeEnum = pgEnum('coin_transaction_type', [
  'signup_bonus',
  'purchase',
  'pro_bonus',
  'gift_sent',
  'gift_received',
  'quick_match',
  'quick_match_refund',
  'avatar_item',
  'adjustment',
]);

export const paymentProviderEnum = pgEnum('payment_provider', ['app_store', 'play_store', 'test']);

export const paymentProductTypeEnum = pgEnum('payment_product_type', ['coin_pack', 'pro_plan']);

export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'expired']);

export const reportReasonEnum = pgEnum('report_reason', [
  'spam',
  'harassment',
  'inappropriate_content',
  'fake_profile',
  'underage',
  'other',
]);

export const devicePlatformEnum = pgEnum('device_platform', ['ios', 'android', 'web']);

export const reportStatusEnum = pgEnum('report_status', ['open', 'resolved', 'dismissed']);

/** `super_admin` can also manage other admin accounts. */
export const adminRoleEnum = pgEnum('admin_role', ['super_admin', 'admin', 'moderator']);

export type Gender = (typeof genderEnum.enumValues)[number];
export type VerificationStatus = (typeof verificationStatusEnum.enumValues)[number];
export type ChatKind = (typeof chatKindEnum.enumValues)[number];
export type MessageKind = (typeof messageKindEnum.enumValues)[number];
export type QuickMatchStatus = (typeof quickMatchStatusEnum.enumValues)[number];
export type QuickMatchDecision = (typeof quickMatchDecisionEnum.enumValues)[number];
export type CoinTransactionType = (typeof coinTransactionTypeEnum.enumValues)[number];
export type PaymentProvider = (typeof paymentProviderEnum.enumValues)[number];
export type PaymentProductType = (typeof paymentProductTypeEnum.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];
export type ReportReason = (typeof reportReasonEnum.enumValues)[number];
export type DevicePlatform = (typeof devicePlatformEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type AdminRole = (typeof adminRoleEnum.enumValues)[number];
