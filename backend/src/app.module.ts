import { Module } from "@nestjs/common";

import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";

import { existsSync } from "fs";
import { join } from "path";
import { I18nModule } from "nestjs-i18n";

import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AccessPolicyModule } from "./accessPolicy/accessPolicy.module";
import { ActivityModule } from "./activity/activity.module";
import { AppCacheModule } from "./cache/cache.module";
import { AppController } from "./app.controller";
import { AssetModule } from "./asset/asset.module";
import { ClamScanModule } from "./clamscan/clamscan.module";
import { ConfigModule } from "./config/config.module";
import { EmailModule } from "./email/email.module";
import { FileModule } from "./file/file.module";
import { InboxModule } from "./inbox/inbox.module";
import { JobsModule } from "./jobs/jobs.module";
import { OAuthModule } from "./oauth/oauth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReverseShareModule } from "./reverseShare/reverseShare.module";
import { RoomModule } from "./room/room.module";
import { ShareModule } from "./share/share.module";
import { ShortLinkModule } from "./shortLink/shortLink.module";
import { UserModule } from "./user/user.module";
import { SystemModule } from "./system/system.module";

import { SystemLanguageResolver } from "./i18n/systemLanguage.resolver";

const i18nPath = existsSync(join(__dirname, "../i18n"))
  ? join(__dirname, "../i18n")
  : join(__dirname, "i18n");

@Module({
  imports: [
    ConfigModule,
    AccessPolicyModule,
    ActivityModule,
    AssetModule,
    RoomModule,
    AuthModule,
    ShareModule,
    ShortLinkModule,
    InboxModule,
    FileModule,
    EmailModule,
    PrismaModule,
    JobsModule,
    UserModule,
    SystemModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    ClamScanModule,
    ReverseShareModule,
    OAuthModule,
    AppCacheModule,
    I18nModule.forRoot({
      fallbackLanguage: "en-US",
      loaderOptions: {
        path: i18nPath,
        watch: process.env.NODE_ENV === "development",
      },
      resolvers: [SystemLanguageResolver],
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    SystemLanguageResolver,
  ],
})
export class AppModule {}
