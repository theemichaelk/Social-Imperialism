const fs = require('fs');
const path = require('path');

const prismaSchema = \`generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projects  Project[]
}

model Project {
  id          String   @id @default(uuid())
  name        String
  domain      String?
  description String?
  guidelines  String?
  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user              User               @relation(fields: [userId], references: [id])
  socialAccounts    SocialAccount[]
  keywords          Keyword[]
  platformSettings  PlatformSetting[]
  rssFeeds          RssFeed[]
  metrics           Metric[]
  automations       Automation[]
}

model SocialAccount {
  id              String   @id @default(uuid())
  platform        String
  handle          String?
  encryptedTokens String?
  status          String   @default("connected")
  projectId       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project         Project          @relation(fields: [projectId], references: [id])
  scheduledPosts  ScheduledPost[]
}

model Keyword {
  id            String   @id @default(uuid())
  term          String
  platformFlags String   // JSON string or comma-separated list
  customPrompt  String?
  projectId     String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  project       Project  @relation(fields: [projectId], references: [id])
}

model PlatformSetting {
  id         String   @id @default(uuid())
  platform   String
  frequency  String   @default("auto") // auto vs manual
  projectId  String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  project    Project  @relation(fields: [projectId], references: [id])
}

model Post {
  id           String   @id @default(uuid())
  externalId   String   @unique
  platform     String
  authorHandle String
  content      String
  metadata     String?  // JSON
  fetchedAt    DateTime @default(now())

  aiReplies    AiReply[]
}

model AiReply {
  id           String   @id @default(uuid())
  content      String
  status       String   @default("draft") // draft, sent, failed
  postId       String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  post         Post     @relation(fields: [postId], references: [id])
}

model Automation {
  id                String   @id @default(uuid())
  ruleType          String   // auto_reply, like, share, follow, unfollow, first_to_comment
  watchKeywords     String?  // JSON
  watchAccounts     String?  // JSON
  scheduleContent   Boolean  @default(false)
  projectId         String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  project           Project  @relation(fields: [projectId], references: [id])
}

model RssFeed {
  id        String   @id @default(uuid())
  url       String
  projectId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project   Project  @relation(fields: [projectId], references: [id])
}

model ScheduledPost {
  id              String   @id @default(uuid())
  content         String
  mediaUrl        String?
  scheduledFor    DateTime
  status          String   @default("pending") // pending, published, failed
  socialAccountId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  socialAccount   SocialAccount @relation(fields: [socialAccountId], references: [id])
}

model Notification {
  id        String   @id @default(uuid())
  type      String   // email, slack, discord
  event     String
  target    String   // email address, webhook url
  status    String   @default("active")
  createdAt DateTime @default(now())
}

model Metric {
  id          String   @id @default(uuid())
  type        String   // replies_sent, clicks, page_growth
  value       Float
  date        DateTime @default(now())
  projectId   String

  project     Project  @relation(fields: [projectId], references: [id])
}\`;

const prismaDir = path.join(__dirname, 'prisma');
if (!fs.existsSync(prismaDir)) {
    fs.mkdirSync(prismaDir);
}
fs.writeFileSync(path.join(prismaDir, 'schema.prisma'), prismaSchema, 'utf8');
console.log('Prisma schema generated successfully.');