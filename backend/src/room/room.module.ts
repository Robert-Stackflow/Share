import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AccessPolicyModule } from "src/accessPolicy/accessPolicy.module";
import { AssetModule } from "src/asset/asset.module";
import { RoomController } from "./room.controller";
import { OptionalJwtGuard } from "./room.guard";
import { RoomService } from "./room.service";

@Module({
  imports: [AssetModule, AccessPolicyModule, JwtModule.register({})],
  controllers: [RoomController],
  providers: [RoomService, OptionalJwtGuard],
})
export class RoomModule {}
