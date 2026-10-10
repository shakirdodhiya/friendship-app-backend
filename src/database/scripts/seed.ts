import 'dotenv/config';

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../schema';
import { coinPacks, NewUser, posts, proPlans, users } from '../schema';

/**
 * Idempotent seed: store catalog (coin packs, Pro plans) plus demo profiles and community posts
 * mirroring the mobile app's mock data. Demo users get `seed-*` Firebase uids, so nobody can sign in as them.
 */

const COIN_PACKS: (typeof coinPacks.$inferInsert)[] = [
  { id: 'p1200', coins: 1200, priceCents: 4500, wasPriceCents: 9900, bonusLabel: 'Best value', sortOrder: 0 },
  { id: 'p100', coins: 100, priceCents: 500, sortOrder: 1 },
  { id: 'p200', coins: 200, priceCents: 1000, sortOrder: 2 },
  { id: 'p500', coins: 500, priceCents: 2000, sortOrder: 3 },
  { id: 'p1000', coins: 1000, priceCents: 4000, sortOrder: 4 },
  { id: 'p12000', coins: 12000, priceCents: 44900, sortOrder: 5 },
];

const PRO_PLANS: (typeof proPlans.$inferInsert)[] = [
  {
    id: 'year',
    term: '1 Year',
    durationMonths: 12,
    priceCents: 5500,
    wasPriceCents: 12000,
    bonusCoins: 200,
    badge: 'Save 53%  +  200 coins bonus',
    recommended: true,
    sortOrder: 0,
  },
  { id: 'sixmo', term: '6 Months', durationMonths: 6, priceCents: 3900, wasPriceCents: 6000, badge: 'Save 35%', sortOrder: 1 },
  { id: 'month', term: '1 Month', durationMonths: 1, priceCents: 990, wasPriceCents: 1200, sortOrder: 2 },
];

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

type DemoUser = NewUser & { firebaseUid: string };

const DEMO_USERS: DemoUser[] = [
  {
    firebaseUid: 'seed-alex',
    name: 'Alex Dux',
    birthday: '1998-09-02',
    gender: 'male',
    heightCm: 182,
    jobRole: 'Doctor',
    jobDepartment: 'Healthcare',
    country: 'Sweden',
    city: 'Stockholm',
    latitude: 59.3293,
    longitude: 18.0686,
    zodiac: 'Virgo',
    personality: 'ENTJ',
    languages: ['Hindi', 'English'],
    shortBio: 'Fitness coach by passion, doctor by profession. Calisthenics, martial arts and good conversations.',
    longBio:
      'You will see me training my students, calisthenics and martial arts, my life revolves around fitness, see you at my class :) Outside the gym I love travelling, reading business books and cooking big breakfasts for friends.',
    interests: ['Workout', 'Travel', 'Business', 'Music', 'Cooking', 'Reading', 'Gaming', 'Photography', 'Hiking'],
    avatar: { Tone: 4, Face: 2, Hair: 5 },
    avatarTint: '#e6d3b3',
    verificationStatus: 'verified',
    proUntil: daysFromNow(365),
    lastActiveAt: hoursAgo(4),
  },
  {
    firebaseUid: 'seed-stacy',
    name: 'Stacy',
    birthday: '2000-08-10',
    gender: 'female',
    heightCm: 168,
    jobRole: 'Designer',
    jobDepartment: 'Design',
    country: 'Germany',
    city: 'Berlin',
    latitude: 52.52,
    longitude: 13.405,
    zodiac: 'Leo',
    personality: 'ENFP',
    languages: ['German', 'English'],
    shortBio: 'Weekend hiker, weekday pixel pusher. Ask me about the best coffee in Kreuzberg.',
    interests: ['Travel', 'Coffee', 'Art', 'Hiking', 'Cinema', 'Music'],
    avatar: { Tone: 1, Face: 6, Hair: 2 },
    avatarTint: '#c4b5f0',
    verificationStatus: 'verified',
    proUntil: daysFromNow(180),
    lastActiveAt: new Date(),
  },
  {
    firebaseUid: 'seed-rosie',
    name: 'Rosie',
    birthday: '2001-03-01',
    gender: 'female',
    heightCm: 160,
    jobRole: 'Chef',
    jobDepartment: 'Hospitality',
    country: 'France',
    city: 'Paris',
    latitude: 48.8566,
    longitude: 2.3522,
    zodiac: 'Pisces',
    personality: 'ISFP',
    languages: ['French', 'English'],
    shortBio: 'I cook for a living and for love. Tell me your favourite dish and I will make it better.',
    interests: ['Cooking', 'Music', 'Travel', 'Reading', 'Baking'],
    avatar: { Tone: 0, Face: 3, Hair: 8 },
    avatarTint: '#bcd7e8',
    lastActiveAt: hoursAgo(48),
  },
  {
    firebaseUid: 'seed-hana',
    name: 'Hana',
    birthday: '1997-06-05',
    gender: 'female',
    heightCm: 158,
    jobRole: 'Designer',
    jobDepartment: 'Design',
    country: 'Japan',
    city: 'Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
    zodiac: 'Gemini',
    personality: 'INTJ',
    languages: ['Japanese', 'English'],
    shortBio: 'Drawing buildings by day, drawing bad conclusions about people by night. Fix me.',
    interests: ['Art', 'Photography', 'Cinema', 'Coffee', 'Reading'],
    avatar: { Tone: 2, Face: 0, Hair: 10 },
    avatarTint: '#f6cdb5',
    verificationStatus: 'verified',
    lastActiveAt: new Date(),
  },
  {
    firebaseUid: 'seed-mira',
    name: 'Mira',
    birthday: '1999-04-12',
    gender: 'female',
    heightCm: 171,
    jobRole: 'Teacher',
    jobDepartment: 'Education',
    country: 'Portugal',
    city: 'Lisbon',
    latitude: 38.7223,
    longitude: -9.1393,
    zodiac: 'Aries',
    personality: 'ESFP',
    languages: ['Portuguese', 'Spanish', 'English'],
    shortBio: 'Surf in the morning, lesson plans in the afternoon, terrible karaoke at night.',
    interests: ['Music', 'Dancing', 'Travel', 'Yoga', 'Cooking'],
    avatar: { Tone: 5, Face: 4, Hair: 1 },
    avatarTint: '#f4b98a',
    lastActiveAt: new Date(),
  },
  {
    firebaseUid: 'seed-june',
    name: 'June',
    birthday: '1996-12-30',
    gender: 'female',
    heightCm: 165,
    jobRole: 'Founder',
    jobDepartment: 'Operations',
    country: 'South Korea',
    city: 'Seoul',
    latitude: 37.5665,
    longitude: 126.978,
    zodiac: 'Capricorn',
    personality: 'ESTJ',
    languages: ['Korean', 'English'],
    shortBio: 'Roadmaps at work, no plans on weekends. Looking for someone to be spontaneous with.',
    interests: ['Business', 'Gaming', 'Cinema', 'Coffee', 'Workout'],
    avatar: { Tone: 3, Face: 9, Hair: 4 },
    avatarTint: '#d9cdf3',
    verificationStatus: 'verified',
    proUntil: daysFromNow(30),
    lastActiveAt: hoursAgo(1),
  },
  {
    firebaseUid: 'seed-founder',
    name: 'Lazy Kar',
    birthday: '1995-03-28',
    gender: 'male',
    jobRole: 'Founder',
    jobDepartment: 'Engineering',
    country: 'India',
    city: 'Mumbai',
    latitude: 19.076,
    longitude: 72.8777,
    zodiac: 'Aries',
    personality: 'INFJ',
    languages: ['Hindi', 'English', 'Marathi'],
    shortBio: 'Solo founder of this app. Building the place I wished existed for making real friends.',
    interests: ['Programming', 'Business', 'Philosophy', 'Books', 'Coffee'],
    avatar: { Tone: 6, Face: 1, Hair: 3 },
    avatarTint: '#f7d774',
    verificationStatus: 'verified',
    lastActiveAt: hoursAgo(12),
  },
];

const POSTS: { author: string; body: string; pinned?: boolean; hoursAgo: number }[] = [
  {
    author: 'seed-founder',
    pinned: true,
    hoursAgo: 24 * 200,
    body: 'Hey Guys, Firstly thank you for using this app, I am the solo founder of this, made it with my limited pocket and it was a struggle. I will do my best to create the best app to make friends, not just friends, but connections that last. Feel free to provide your feedback so I can make a better app for you!',
  },
  {
    author: 'seed-stacy',
    hoursAgo: 12,
    body: 'What is everyone doing this weekend? I am looking for hiking buddies around Berlin 🥾',
  },
  {
    author: 'seed-hana',
    hoursAgo: 48,
    body: 'Anyone else here just to make friends? The 5 minute quick chats are weirdly less awkward than normal messaging.',
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });

  try {
    await db.transaction(async (tx) => {
      for (const pack of COIN_PACKS) {
        await tx.insert(coinPacks).values(pack).onConflictDoUpdate({ target: coinPacks.id, set: pack });
      }
      for (const plan of PRO_PLANS) {
        await tx.insert(proPlans).values(plan).onConflictDoUpdate({ target: proPlans.id, set: plan });
      }

      const ids = new Map<string, string>();
      for (const user of DEMO_USERS) {
        const values = { ...user, onboardingCompletedAt: new Date(), coinBalance: 500 };
        const [row] = await tx
          .insert(users)
          .values(values)
          .onConflictDoUpdate({ target: users.firebaseUid, set: { ...values, coinBalance: sql`${users.coinBalance}` } })
          .returning({ id: users.id });
        ids.set(user.firebaseUid, row.id);
      }

      for (const post of POSTS) {
        const authorId = ids.get(post.author)!;
        const [existing] = await tx.select({ id: posts.id }).from(posts).where(eq(posts.body, post.body));
        if (existing) continue;
        await tx.insert(posts).values({
          authorId,
          body: post.body,
          pinned: post.pinned ?? false,
          createdAt: hoursAgo(post.hoursAgo),
        });
      }
    });
    console.log(
      `Seeded ${COIN_PACKS.length} coin packs, ${PRO_PLANS.length} Pro plans, ${DEMO_USERS.length} demo users, ${POSTS.length} posts`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
